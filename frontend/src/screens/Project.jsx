import React, { useState, useEffect, useContext, useRef } from 'react';
import { UserContext } from '../context/user.context';
import { useLocation, useNavigate } from 'react-router-dom';
import axios from '../config/axios';
import { initializeSocket, receiveMessage, sendMessage, emitUserActivity } from '../config/socket.js';
import Markdown from 'markdown-to-jsx';
import hljs from 'highlight.js';
import { getWebContainer } from '../config/webContainer.js';
import { toast } from 'react-toastify';
import { BotMessageSquare, Users as UsersIcon } from 'lucide-react';

function SyntaxHighlightedCode(props) {
  const ref = useRef(null);

  useEffect(() => {
    if (ref.current && props.className?.includes('lang-') && window.hljs) {
      window.hljs.highlightElement(ref.current);
      ref.current.removeAttribute('data-highlighted');
    }
  }, [props.className, props.children]);

  return (
    <code {...props} ref={ref} className={`${props.className} bg-gray-800 rounded-md p-2 text-sm font-mono`} />
  );
}

const getLanguageFromFileName = (fileName) => {
  const extension = fileName.split('.').pop().toLowerCase();
  switch (extension) {
    case 'js': return 'javascript';
    case 'java': return 'java';
    case 'py': return 'python';
    case 'c': return 'c';
    case 'go': return 'go';
    default: return 'plaintext';
  }
};

const CodeEditorArea = ({ fileTree, currentFile, setFileTree, saveFileTree }) => {
  const codeRef = useRef(null);

  useEffect(() => {
    if (codeRef.current && fileTree[currentFile]) {
      hljs.highlightElement(codeRef.current);
    }
  }, [currentFile, fileTree]);

  return (
    <div className="code-editor-area h-full bg-gray-900 p-3 overflow-y-auto custom-scrollbar rounded-lg shadow-inner md:p-4">
      <pre className="hljs h-full">
        <code
          ref={codeRef}
          className={`hljs language-${getLanguageFromFileName(currentFile)} h-full outline-none text-sm text-white`}
          contentEditable
          suppressContentEditableWarning
          onBlur={(e) => {
            const updatedContent = e.target.innerText;
            const ft = { ...fileTree, [currentFile]: { file: { contents: updatedContent } } };
            setFileTree(ft);
            saveFileTree(ft);
          }}
          dangerouslySetInnerHTML={{
            __html: hljs.highlight(fileTree[currentFile]?.file?.contents || '', {
              language: getLanguageFromFileName(currentFile),
              ignoreIllegals: true,
            }).value,
          }}
          style={{ whiteSpace: 'pre-wrap', minHeight: '100%' }}
        />
      </pre>
    </div>
  );
};

const Project = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedUserId, setSelectedUserId] = useState(new Set());
  const [project, setProject] = useState(location.state?.project || {});
  const [message, setMessage] = useState('');
  const { user } = useContext(UserContext);
  const messageBox = useRef(null);
  const [users, setUsers] = useState([]);
  const [messages, setMessages] = useState([]);
  const [fileTree, setFileTree] = useState({});
  const [currentFile, setCurrentFile] = useState(null);
  const [openFiles, setOpenFiles] = useState([]);
  const [webContainer, setWebContainer] = useState(null);
  const [iframeUrl, setIframeUrl] = useState(null);
  const [runProcess, setRunProcess] = useState(null);
  const [output, setOutput] = useState('');
  const [onlineUsers, setOnlineUsers] = useState(new Map());
  const [isWebContainerReady, setIsWebContainerReady] = useState(false);
  const [editingFile, setEditingFile] = useState(null);
  const [newFileName, setNewFileName] = useState('');
  const [erroredFile, setErroredFile] = useState(null);
  const [isRunning, setIsRunning] = useState(false);

  const handleUserClick = (id) => {
    setSelectedUserId((prev) => {
      const newSet = new Set(prev);
      newSet.has(id) ? newSet.delete(id) : newSet.add(id);
      return newSet;
    });
  };

  const startEditingFile = (fileName) => {
    setEditingFile(fileName);
    setNewFileName(fileName);
  };

  const handleFileRename = (oldName) => {
    if (!newFileName || newFileName === oldName || newFileName.trim() === '') {
      setEditingFile(null);
      return;
    }

    const updatedFileTree = { ...fileTree };
    updatedFileTree[newFileName] = updatedFileTree[oldName];
    delete updatedFileTree[oldName];

    setFileTree(updatedFileTree);
    setOpenFiles((prev) => prev.map((file) => (file === oldName ? newFileName : file)));
    if (currentFile === oldName) setCurrentFile(newFileName);

    saveFileTree(updatedFileTree)
      .then(() => toast.success('File renamed successfully'))
      .catch((err) => {
        console.error('Rename failed:', err);
        toast.error('Failed to rename file');
      });

    setEditingFile(null);
  };

  const addCollaborators = () => {
    if (selectedUserId.size === 0) return;
    const payload = { projectId: project._id, users: Array.from(selectedUserId) };
    axios.put('/projects/add-user', payload)
      .then((res) => {
        setProject(res.data.project || project);
        setIsModalOpen(false);
        toast.success('Collaborators added!');
      })
      .catch((err) => {
        console.error('Add collaborators failed:', err);
        toast.error('Failed to add collaborators');
      });
  };

  const send = () => {
    if (!message.trim()) return;
    const timestamp = new Date().toLocaleTimeString();
    const messageData = { message, sender: user, timestamp };
    sendMessage('project-message', messageData);
    setMessages((prev) => [...prev, messageData]);
    setMessage('');
  };

  const sendToAI = async () => {
    if (!message.trim()) return;
    const aiMessage = message.startsWith('@ai') ? message : `@ai ${message}`;
    const timestamp = new Date().toLocaleTimeString();
    const messageData = { message: aiMessage, sender: user, timestamp };
    sendMessage('project-message', messageData);
    setMessages((prev) => [...prev, messageData]);
    setMessage('');

    if (aiMessage.startsWith('@ai')) {
      try {
        const mockResponse = { fileTree: { 'script.js': { file: { contents: `console.log("Hello from script.js!");` } } } };
        const parsedResponse = mockResponse;
        console.log('AI Response:', JSON.stringify(parsedResponse, null, 2));
        if (parsedResponse.fileTree) {
          const updatedFileTree = { ...fileTree, ...parsedResponse.fileTree };
          setFileTree(updatedFileTree);
          setIframeUrl(null);
          await saveFileTree(updatedFileTree);
          const newFiles = Object.keys(parsedResponse.fileTree);
          setOpenFiles((prev) => [...new Set([...prev, ...newFiles])]);
          setCurrentFile(newFiles[0]);
          toast.success('Code added to editor!');
        }
      } catch (error) {
        console.error('AI response error:', error);
        toast.error('Failed to process AI response');
      }
    }
  };

  function WriteAiMessage(message) {
    if (typeof message === 'object' && message.text) {
      const { text, fileTree } = message;
      return (
        <div className="bg-gradient-to-br from-gray-800 to-gray-900 rounded-lg p-3 shadow-lg hover:shadow-xl transition-all duration-300 md:p-4">
          <div className="mb-2 md:mb-3">
            <Markdown options={{ overrides: { code: { component: SyntaxHighlightedCode } } }} className="text-gray-100 prose prose-invert">
              {text}
            </Markdown>
          </div>
          {fileTree && Object.keys(fileTree).length > 0 && (
            <div className="space-y-3 md:space-y-4">
              {Object.keys(fileTree).map((fileName, index) => {
                const { contents } = fileTree[fileName].file;
                const language = getLanguageFromFileName(fileName);
                return (
                  <div key={index} className="bg-gray-850 rounded-lg p-2 border border-gray-700 hover:border-indigo-500 transition-all md:p-3">
                    <div className="flex justify-between items-center mb-1 md:mb-2">
                      <h3 className="text-md font-semibold text-indigo-300">{fileName}</h3>
                      <button onClick={() => navigator.clipboard.writeText(contents)} className="p-1 text-gray-400 hover:text-indigo-300">
                        <i className="ri-file-copy-line"></i>
                      </button>
                    </div>
                    <pre className="bg-gray-900 rounded-md p-1 overflow-auto text-sm md:p-2">
                      <code className={`lang-${language}`} dangerouslySetInnerHTML={{ __html: hljs.highlight(contents, { language }).value }} />
                    </pre>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      );
    }
    return (
      <div className="bg-gradient-to-br from-gray-800 to-gray-900 rounded-lg p-3 shadow-lg hover:shadow-xl transition-all md:p-4">
        <Markdown options={{ overrides: { code: { component: SyntaxHighlightedCode } } }} className="text-gray-100 prose prose-invert">
          {typeof message === 'string' ? message : 'Error: Unexpected message format'}
        </Markdown>
      </div>
    );
  }

  const parseErrorLocation = (errorOutput) => {
    const match = errorOutput.match(/at\s+([^\s(]+):(\d+):(\d+)/);
    if (match) {
      const fileName = match[1].split('/').pop();
      return { file: fileName, line: parseInt(match[2]), column: parseInt(match[3]) };
    }
    return null;
  };

  useEffect(() => {
    if (!project._id) return;

    const socket = initializeSocket(project._id);
    socket.on('connect', () => {
      toast.success(`${user.email} connected`, { toastId: `connect-${user._id}` });
      emitUserActivity('joined');
    });
    socket.on('connect_error', (err) => {
      console.error('Socket connection error:', err);
      toast.error('Not connected', { toastId: `connect_error-${user._id}` });
    });
    socket.on('disconnect', () => {
      toast.warn(`${user.email} disconnected`, { toastId: `disconnect-${user._id}` });
      emitUserActivity('left');
    });

    receiveMessage('project-message', (data) => {
      setMessages((prev) => {
        if (prev.some((msg) => msg.sender._id === data.sender._id && msg.message === data.message && msg.timestamp === data.timestamp)) {
          return prev;
        }
        if (data.sender._id === 'ai') {
          let parsedMessage;
          try {
            let parsed = JSON.parse(data.message);
            if (typeof parsed === 'string') parsed = JSON.parse(parsed);
            if (parsed.fileTree && Object.keys(parsed.fileTree).length > 0) {
              const updatedFileTree = { ...fileTree, ...parsed.fileTree };
              setFileTree(updatedFileTree);
              setIframeUrl(null);
              saveFileTree(updatedFileTree)
                .then(() => {
                  const newFiles = Object.keys(parsed.fileTree);
                  setOpenFiles((prev) => [...new Set([...prev, ...newFiles])]);
                  setCurrentFile(newFiles[0]);
                  toast.success('Code added to editor!');
                })
                .catch((err) => {
                  console.error('Save file tree failed:', err);
                  toast.error('Failed to add code to editor');
                });
              parsedMessage = { text: parsed.text };
            } else {
              parsedMessage = parsed;
            }
          } catch (error) {
            console.error('AI message parse error:', error);
            parsedMessage = 'Error: Invalid AI response';
          }
          return [...prev, { ...data, message: parsedMessage }];
        }
        return [...prev, { ...data }];
      });
    });

    receiveMessage('user-activity-update', ({ userId, email, action }) => {
      setOnlineUsers((prev) => {
        const newMap = new Map(prev);
        if (action === 'joined') newMap.set(userId, { email });
        else if (action === 'left') newMap.delete(userId);
        return newMap;
      });
    });

    if (!webContainer) {
      getWebContainer()
        .then((container) => {
          setWebContainer(container);
          setIsWebContainerReady(true);
          toast.success('WebContainer initialized');
        })
        .catch((error) => {
          console.error('WebContainer initialization failed:', error);
          toast.error(`WebContainer failed to initialize: ${error.message}`);
          setIsWebContainerReady(false);
        });
    }

    const fetchProjectData = async () => {
      try {
        const res = await axios.get(`/projects/get-project/${project._id}`);
        setProject(res.data.project || {});
        setFileTree(res.data.project.fileTree || {});
        setOpenFiles([]);
        setCurrentFile(null);
      } catch (error) {
        console.error('Failed to fetch project:', error);
        toast.error('Failed to load project data');
        setFileTree({});
      }
    };

    fetchProjectData();
    axios.get('/users/all').then((res) => setUsers(res.data.users || [])).catch((err) => console.error('Fetch users failed:', err));

    return () => {
      socket.off('connect');
      socket.off('connect_error');
      socket.off('disconnect');
      socket.off('project-message');
      socket.off('user-activity-update');
    };
  }, [project._id, user.email, user._id]);

  useEffect(() => scrollToBottom(), [messages]);

  useEffect(() => {
    console.log('Debug State:', { isWebContainerReady, isRunning, iframeUrl, webContainer });
  }, [isWebContainerReady, isRunning, iframeUrl, webContainer]);

  function saveFileTree(ft) {
    return axios.put('/projects/update-file-tree', { projectId: project._id, fileTree: ft })
      .then((res) => res.data)
      .catch((err) => {
        console.error('Save file tree error:', err);
        throw err;
      });
  }

  function scrollToBottom() {
    if (messageBox.current) messageBox.current.scrollTop = messageBox.current.scrollHeight;
  }

  const closeFile = (file) => {
    setOpenFiles((prev) => {
      const updatedFiles = prev.filter((f) => f !== file);
      if (currentFile === file) setCurrentFile(updatedFiles[0] || null);
      return updatedFiles;
    });
  };

  const stripAnsi = (str) => str.replace(/\x1B\[[0-9;]*[a-zA-Z]/g, '');

  const runServer = async () => {
    try {
      setIsRunning(true);
      setErroredFile(null);
      setOutput('');
      setIframeUrl(null);
      if (!webContainer) throw new Error('WebContainer not initialized');
      const transformedTree = convertToFileSystemTree(fileTree);
      await webContainer.mount(transformedTree);

      const hasPackageJson = Object.keys(fileTree).some((file) => file === 'package.json');
      const outputLogs = [];

      if (hasPackageJson) {
        const installProcess = await webContainer.spawn('npm', ['install']);
        installProcess.output.pipeTo(new WritableStream({ write(chunk) { outputLogs.push(stripAnsi(chunk)); setOutput(outputLogs.join('\n')); } }));
        const installExitCode = await installProcess.exit;
        if (installExitCode !== 0) {
          const errorOutput = outputLogs.join('\n');
          const errorLocation = parseErrorLocation(errorOutput);
          if (errorLocation && Object.keys(fileTree).includes(errorLocation.file)) setErroredFile(errorLocation.file);
          throw new Error(`npm install failed with exit code ${installExitCode}\n${errorOutput}`);
        }

        if (runProcess) runProcess.kill();
        const tempRunProcess = await webContainer.spawn('npm', ['start'], { tty: true });
        tempRunProcess.output.pipeTo(new WritableStream({ write(chunk) { outputLogs.push(stripAnsi(chunk)); setOutput(outputLogs.join('\n')); } }));
        tempRunProcess.exit.then((code) => {
          if (code !== 0) {
            const errorOutput = outputLogs.join('\n');
            const errorLocation = parseErrorLocation(errorOutput);
            if (errorLocation && Object.keys(fileTree).includes(errorLocation.file)) setErroredFile(errorLocation.file);
            toast.error(`Server failed with exit code ${code}`);
            setIframeUrl(null);
          } else setErroredFile(null);
          setIsRunning(false);
        });
        setRunProcess(tempRunProcess);

        webContainer.on('server-ready', (port, url) => {
          console.log('Server ready at:', url);
          setIframeUrl(url);
          setIsRunning(false);
        });
      } else if (currentFile && fileTree[currentFile]) {
        const scriptProcess = await webContainer.spawn('node', [currentFile]);
        scriptProcess.output.pipeTo(new WritableStream({ write(chunk) { outputLogs.push(stripAnsi(chunk)); setOutput(outputLogs.join('\n')); } }));
        const scriptExitCode = await scriptProcess.exit;
        if (scriptExitCode !== 0) {
          const errorOutput = outputLogs.join('\n');
          const errorLocation = parseErrorLocation(errorOutput);
          if (errorLocation && errorLocation.file === currentFile) setErroredFile(currentFile);
          throw new Error(`Script execution failed with exit code ${scriptExitCode}\n${errorOutput}`);
        } else {
          setErroredFile(null);
          toast.success('Script executed successfully!');
        }
        setIsRunning(false);
      } else throw new Error('No valid file to execute');

      setOutput(outputLogs.join('\n'));
    } catch (error) {
      console.error('Error running code:', error);
      const errorDetails = error.message.includes('\n') ? error.message : `${error.message}\nCheck console for more details`;
      setOutput(errorDetails);
      toast.error('Failed to execute code');
      setIframeUrl(null);
      setIsRunning(false);
    }
  };

  const convertToFileSystemTree = (flatFileTree) => {
    const tree = {};
    for (const [path, value] of Object.entries(flatFileTree)) {
      const parts = path.split('/');
      let current = tree;
      for (let i = 0; i < parts.length; i++) {
        const part = parts[i];
        if (i === parts.length - 1) current[part] = { file: { contents: value.file?.contents || '' } };
        else {
          current[part] = current[part] || { directory: {} };
          current = current[part].directory;
        }
      }
    }
    return tree;
  };

  return (
    <main className="min-h-screen w-full flex flex-col bg-gray-900 font-sans text-white overflow-hidden">
      <section className="left flex flex-col h-full w-full bg-gradient-to-b from-gray-800 to-gray-900 shadow-lg border-r border-gray-700 md:w-1/4 lg:w-1/5">
        <header className="flex justify-between items-center p-2 bg-gray-850 shadow-md md:p-3">
          <div className="flex items-center gap-1 md:gap-2">
            <button
              className="p-1 text-indigo-300 hover:bg-indigo-600 rounded-md transition-all duration-300 md:p-2"
              onClick={() => navigate('/')}
              title="Back to Home"
            >
              <i className="ri-home-4-fill text-sm md:text-base"></i>
            </button>
            <button
              className="p-1 text-indigo-300 hover:bg-indigo-600 rounded-md transition-all duration-300 md:p-1"
              onClick={() => setIsModalOpen(true)}
              aria-label="Add Collaborator"
            >
              <UsersIcon size={14} className="md:size-16" />
            </button>
          </div>
        </header>
        <div className="conversation-area flex-grow flex flex-col p-2 overflow-hidden md:p-3">
          <div ref={messageBox} className="message-box flex-grow flex flex-col gap-2 overflow-y-auto scrollbar-thin scrollbar-thumb-indigo-500 scrollbar-track-gray-800">
            {messages.map((msg, index) => (
              <div
                key={index}
                className={`message flex flex-col p-2 rounded-lg shadow-md hover:shadow-lg transition-all duration-300 ${
                  msg.sender._id === 'ai'
                    ? 'max-w-[90%] bg-gradient-to-br from-indigo-800 to-gray-900'
                    : `max-w-[80%] sm:max-w-60 bg-gray-700 ${msg.sender._id === user._id.toString() ? 'ml-auto' : ''}`
                }`}
              >
                <small className="opacity-70 text-xs mb-1">{msg.sender.email}</small>
                <div className="text-sm flex items-center gap-2">
                  {msg.sender._id === 'ai' ? (
                    WriteAiMessage(msg.message)
                  ) : (
                    <div className="flex flex-col flex-grow">
                      <p className="break-words pr-4">{msg.message}</p>
                      <span className="text-xs opacity-50 mt-1 self-end">{msg.timestamp}</span>
                    </div>
                  )}
                  <button
                    onClick={() => navigator.clipboard.writeText(typeof msg.message === 'object' ? msg.message.text || '' : msg.message)}
                    className="p-1 text-gray-300 bg-gray-600 rounded-full hover:bg-indigo-500 transition-all"
                    aria-label="Copy Message"
                  >
                    <i className="ri-file-copy-line text-sm"></i>
                  </button>
                </div>
              </div>
            ))}
          </div>
          <div className="input-field flex items-center gap-2 p-2 bg-gray-850 rounded-xl shadow-inner md:p-3">
            <input
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && send()}
              className="flex-grow p-2 px-3 bg-gray-800 border border-gray-700 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500 text-white placeholder-gray-400 text-sm md:text-base"
              type="text"
              placeholder="Enter message (@ai for AI response)"
            />
            <button
              onClick={send}
              disabled={!message.trim()}
              className={`px-2 py-1 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 transition-all duration-300 ${
                !message.trim() ? 'opacity-50 cursor-not-allowed' : ''
              } md:px-3 md:py-2`}
            >
              <i className="ri-send-plane-fill text-sm md:text-base"></i>
            </button>
            <button
              onClick={sendToAI}
              disabled={!message.trim()}
              className={`p-1 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 transition-all duration-300 ${
                !message.trim() ? 'opacity-50 cursor-not-allowed' : ''
              } md:p-1`}
              title="Send to AI"
            >
              <BotMessageSquare size={14} className="md:size-16" />
            </button>
          </div>
        </div>
      </section>

      <section className="right flex flex-col flex-grow h-full bg-gray-850">
        <div className="explorer w-full bg-gray-800 shadow-md border-r border-gray-700 md:w-64">
          <div className="file-tree w-full p-2">
            <div className="flex justify-between items-center mb-2">
              <h2 className="text-lg font-semibold text-indigo-300">Files</h2>
            </div>
            {Object.keys(fileTree).length > 0 ? (
              <div className="file-list space-y-1">
                {Object.keys(fileTree).map((file, index) => (
                  <div key={index} className="flex items-center">
                    {editingFile === file ? (
                      <input
                        type="text"
                        value={newFileName}
                        onChange={(e) => setNewFileName(e.target.value)}
                        onBlur={() => handleFileRename(file)}
                        onKeyPress={(e) => e.key === 'Enter' && handleFileRename(file)}
                        className="w-full p-1 bg-gray-700 text-white rounded-md border border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-400 text-sm"
                        autoFocus
                        aria-label="Rename File"
                      />
                    ) : (
                      <button
                        onClick={() => {
                          setCurrentFile(file);
                          setOpenFiles((prev) => [...new Set([...prev, file])]);
                        }}
                        onDoubleClick={() => startEditingFile(file)}
                        className={`file-button w-full flex items-center gap-1 p-1 rounded-md transition-all duration-300 text-white hover:bg-indigo-700 shadow-sm ${
                          file === erroredFile ? 'bg-red-700' : 'bg-gray-750'
                        } ${onlineUsers.has(file) ? 'border-l-4 border-green-500' : ''}`}
                        title="Double-click to rename"
                      >
                        <i className="ri-file-line text-indigo-400 text-sm flex-shrink-0"></i>
                        <span className="file-name flex-grow text-left truncate text-sm">{file}</span>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            startEditingFile(file);
                          }}
                          className="opacity-0 hover:opacity-100 text-gray-400 hover:text-indigo-300 transition-opacity"
                        >
                          <i className="ri-pencil-line text-sm"></i>
                        </button>
                      </button>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-gray-400 italic text-sm">No files yet</p>
            )}
          </div>
        </div>

        <div className="code-editor flex flex-col flex-grow h-[calc(100%-64px)] bg-gray-900 shadow-inner">
          <div className="top flex justify-between items-center p-1 bg-gray-850 border-b border-gray-700 min-h-[40px]">
            <div className="files flex flex-row overflow-x-auto space-x-1">
              {openFiles.map((file, index) => (
                <div key={index} className="flex items-center bg-gray-800 rounded-t-md shadow-sm">
                  <button
                    onClick={() => setCurrentFile(file)}
                    className={`p-1 px-2 flex items-center gap-1 text-white font-medium transition-all duration-300 ${
                      currentFile === file ? 'bg-indigo-600 border-t-2 border-indigo-400' : 'hover:bg-gray-700'
                    } text-sm`}
                  >
                    <span>{file}</span>
                  </button>
                  <button
                    onClick={() => closeFile(file)}
                    className="p-1 text-gray-400 hover:text-red-400 hover:bg-gray-700 rounded-r-md transition-all"
                  >
                    <i className="ri-close-line text-sm"></i>
                  </button>
                </div>
              ))}
            </div>
            <div className="actions flex gap-1 p-1 min-w-[120px]">
              <button
                onClick={runServer}
                disabled={!isWebContainerReady || isRunning}
                className={`px-2 py-1 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 transition-all duration-300 shadow-md ${
                  !isWebContainerReady || isRunning ? 'opacity-50 cursor-not-allowed' : ''
                } text-sm`}
              >
                {isRunning ? 'Running...' : 'Run'}
              </button>
              {iframeUrl && webContainer && (
                <button
                  onClick={() => {
                    setIframeUrl(null);
                    if (runProcess) runProcess.kill();
                    setIsRunning(false);
                  }}
                  className="px-2 py-1 bg-red-600 text-white rounded-md hover:bg-red-700 transition-all duration-300 shadow-md text-sm"
                >
                  Stop Server
                </button>
              )}
            </div>
          </div>
          <div className="editor-and-terminal flex flex-col h-full">
            <div className="editor flex-1 overflow-y-auto custom-scrollbar">
              {currentFile && fileTree[currentFile] ? (
                <CodeEditorArea fileTree={fileTree} currentFile={currentFile} setFileTree={setFileTree} saveFileTree={saveFileTree} />
              ) : (
                <div className="h-full flex items-center justify-center bg-gray-900">
                  <h1 className="text-2xl font-bold text-indigo-400 animate-pulse tracking-wide">Code Nexus</h1>
                </div>
              )}
            </div>
            <div className="terminal h-1/4 bg-gray-800 border-t border-gray-700 p-1 overflow-y-auto custom-scrollbar">
              <h3 className="text-sm font-semibold text-indigo-300 mb-1">Output</h3>
              <pre className="text-white text-sm whitespace-pre-wrap">{output || ' '}</pre>
              {output.includes('Error') && (
                <div className="error-panel bg-red-900 text-white p-1 rounded-md mt-1">
                  <h3 className="font-bold text-sm">Error Details</h3>
                  <pre className="text-sm">{output}</pre>
                  <p className="mt-1 text-sm">Fix the error in the code and click "Run" again to retry.</p>
                </div>
              )}
            </div>
          </div>
        </div>

        {iframeUrl && webContainer && (
          <div className="w-full h-1/3 bg-gray-800 shadow-md border-l border-gray-700 md:w-1/2 lg:w-2/5">
            <div className="address-bar p-1 bg-gray-850">
              <input
                type="text"
                onChange={(e) => setIframeUrl(e.target.value)}
                sandbox="allow-scripts allow-same-origin"
                value={iframeUrl}
                className="w-full p-1 bg-black text-white border border-gray-700 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm"
              />
            </div>
            <iframe src={iframeUrl} className="w-full h-[calc(100%-32px)] border-0" />
          </div>
        )}
      </section>

      {isModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-50 animate-fade-in">
          <div className="bg-gray-800 p-4 rounded-lg shadow-2xl w-11/12 max-w-md transform transition-all duration-300">
            <header className="flex justify-between items-center mb-3">
              <h2 className="text-lg font-semibold text-indigo-300">Collaborators</h2>
              <button
                className="p-1 text-white hover:bg-gray-700 rounded-full transition-all duration-300"
                onClick={() => setIsModalOpen(false)}
                aria-label="Close Modal"
              >
                <i className="ri-close-fill text-sm"></i>
              </button>
            </header>
            <div className="users-list flex flex-col gap-2 max-h-64 overflow-y-auto scrollbar-thin scrollbar-thumb-indigo-500 scrollbar-track-gray-800">
              <div className="online-users mb-2">
                <h3 className="text-sm font-semibold text-indigo-300 mb-1">Online</h3>
                {Array.from(onlineUsers).map(([userId, { email }]) => (
                  <div key={userId} className="flex items-center gap-2 p-1 text-white bg-green-900/50 rounded-md">
                    <div className="w-2 h-2 rounded-full bg-green-500"></div>
                    <span className="text-sm truncate">{email}</span>
                  </div>
                ))}
              </div>
              <div className="all-users">
                <h3 className="text-sm font-semibold text-indigo-300 mb-1">All</h3>
                {project.users?.map((user, index) => (
                  <div
                    key={user._id || `user-${index}`}
                    className={`flex items-center gap-2 p-1 hover:bg-gray-700 rounded-md transition-all duration-300 ${
                      selectedUserId.has(user._id) ? 'bg-indigo-700' : ''
                    }`}
                    onClick={() => handleUserClick(user._id)}
                  >
                    <div className="w-6 h-6 rounded-full bg-indigo-600 flex items-center justify-center text-white">
                      <i className="ri-user-fill text-sm"></i>
                    </div>
                    <h1 className="font-semibold text-sm truncate">{user.email || 'No email'}</h1>
                  </div>
                ))}
              </div>
            </div>
            <button
              onClick={addCollaborators}
              className="mt-3 w-full py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 transition-all duration-300 shadow-md"
              disabled={selectedUserId.size === 0}
            >
              Add Collaborators
            </button>
          </div>
        </div>
      )}
    </main>
  );
};

export default Project;
