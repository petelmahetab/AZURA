import React, { useState, useEffect, useContext, useRef } from 'react';
import { UserContext } from '../context/user.context';
import { useLocation, useNavigate } from 'react-router-dom';
import axios from '../config/axios';
import { initializeSocket, receiveMessage, sendMessage, emitUserActivity } from '../config/socket.js';
import Markdown from 'markdown-to-jsx';
import hljs from 'highlight.js';
import { getWebContainer } from '../config/webContainer.js';
import { toast } from 'react-toastify';
import { BotMessageSquare } from 'lucide-react';

function SyntaxHighlightedCode(props) {
  const ref = useRef(null);

  React.useEffect(() => {
    if (ref.current && props.className?.includes('lang-') && window.hljs) {
      window.hljs.highlightElement(ref.current);
      ref.current.removeAttribute('data-highlighted');
    }
  }, [props.className, props.children]);

  return (
    <code {...props} ref={ref} className={`${props.className} bg-gray-800 rounded-md p-2 text-sm`} />
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
    <div className="code-editor-area h-full bg-gray-900 p-4 animate-fade-in overflow-y-auto custom-scrollbar">
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
            __html: hljs.highlight(fileTree[currentFile].file.contents, {
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
  const [isSidePanelOpen, setIsSidePanelOpen] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedUserId, setSelectedUserId] = useState(new Set());
  const [project, setProject] = useState(location.state?.project || {});
  const [message, setMessage] = useState('');
  const { user } = useContext(UserContext);
  const messageBox = React.createRef();
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
    setOpenFiles(prev => prev.map(file => file === oldName ? newFileName : file));
    if (currentFile === oldName) setCurrentFile(newFileName);

    saveFileTree(updatedFileTree)
      .then(() => toast.success('File renamed successfully'))
      .catch(() => toast.error('Failed to rename file'));
    
    setEditingFile(null);
  };

  function addCollaborators() {
    if (selectedUserId.size === 0) return;
    const payload = {
      projectId: project._id,
      users: Array.from(selectedUserId),
    };
    axios.put('/projects/add-user', payload)
      .then((res) => {
        setProject(res.data.project || project);
        setIsModalOpen(false);
        toast.success('Collaborators added!');
      })
      .catch((err) => toast.error('Failed to add collaborators'));
  }

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
        const mockResponse = {
          fileTree: {
            'script.js': {
              file: {
                contents: `console.log("Hello from script.js!");`,
              },
            },
          },
        };
        const parsedResponse = mockResponse;
        console.log('AI Response:', JSON.stringify(parsedResponse, null, 2));
        if (parsedResponse.fileTree) {
          const updatedFileTree = { ...fileTree, ...parsedResponse.fileTree };
          setFileTree(updatedFileTree);
          saveFileTree(updatedFileTree)
            .then(() => {
              const newFiles = Object.keys(parsedResponse.fileTree);
              setOpenFiles((prev) => [...new Set([...prev, ...newFiles])]);
              setCurrentFile(newFiles[0]);
              toast.success('Code added to editor!');
            })
            .catch(() => toast.error('Failed to add code to editor'));
          if (parsedResponse.text) {
            setMessages((prev) => [
              ...prev,
              { sender: { _id: 'ai', email: 'AI' }, message: { text: parsedResponse.text }, timestamp },
            ]);
          }
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
        <div className="bg-gradient-to-br from-gray-800 to-gray-900 rounded-xl p-4 shadow-lg transform transition-all duration-300 hover:scale-[1.02] hover:shadow-xl">
          <div className="mb-4">
            <Markdown
              options={{ overrides: { code: { component: SyntaxHighlightedCode } } }}
              className="text-gray-100 leading-relaxed prose prose-invert"
            >
              {text}
            </Markdown>
          </div>
          {fileTree && Object.keys(fileTree).length > 0 && (
            <div className="space-y-4">
              {Object.keys(fileTree).map((fileName, index) => {
                const { contents } = fileTree[fileName].file;
                const language = getLanguageFromFileName(fileName);
                return (
                  <div
                    key={index}
                    className="bg-gray-850 rounded-lg p-3 border border-gray-700 hover:border-indigo-500 transition-all duration-200"
                  >
                    <div className="flex justify-between items-center mb-2">
                      <h3 className="text-md font-semibold text-indigo-300">{fileName}</h3>
                      <button
                        onClick={() => navigator.clipboard.writeText(contents)}
                        className="p-1 text-gray-400 hover:text-indigo-300 transition-colors"
                      >
                        <i className="ri-file-copy-line"></i>
                      </button>
                    </div>
                    <pre className="bg-gray-900 rounded-md p-2 overflow-auto text-sm">
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
      <div className="bg-gradient-to-br from-gray-800 to-gray-900 rounded-xl p-4 shadow-lg transform transition-all duration-300 hover:scale-[1.02]">
        <Markdown
          options={{ overrides: { code: { component: SyntaxHighlightedCode } } }}
          className="text-gray-100 leading-relaxed prose prose-invert"
        >
          {typeof message === 'string' ? message : 'Error: Unexpected message format'}
        </Markdown>
      </div>
    );
  }

  const parseErrorLocation = (errorOutput) => {
    const match = errorOutput.match(/at\s+([^\s(]+):(\d+):(\d+)/);
    if (match) {
      const fileName = match[1].split('/').pop(); // Extract just the file name
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
    socket.on('connect_error', () => toast.error('Not connected', { toastId: `connect_error-${user._id}` }));
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
              saveFileTree(updatedFileTree)
                .then(() => {
                  const newFiles = Object.keys(parsed.fileTree);
                  setOpenFiles((prev) => [...new Set([...prev, ...newFiles])]);
                  setCurrentFile(newFiles[0]);
                  toast.success('Code added to editor!');
                })
                .catch(() => toast.error('Failed to add code to editor'));
              parsedMessage = { text: parsed.text };
            } else {
              parsedMessage = parsed;
            }
          } catch (error) {
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
        if (action === 'joined') {
          newMap.set(userId, { email });
        } else if (action === 'left') {
          newMap.delete(userId);
        }
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
        });
    }

    const fetchProjectData = async () => {
      try {
        const res = await axios.get(`/projects/get-project/${project._id}`);
        setProject(res.data.project);
        setFileTree(res.data.project.fileTree || {});
        setOpenFiles([]);
        setCurrentFile(null);
      } catch (error) {
        console.error('Failed to fetch project:', error);
        toast.error('Failed to load project data');
      }
    };

    fetchProjectData();
    axios.get('/users/all').then((res) => setUsers(res.data.users));

    return () => {
      socket.off('connect');
      socket.off('connect_error');
      socket.off('disconnect');
      socket.off('project-message');
      socket.off('user-activity-update');
    };
  }, [project._id, user.email, user._id]);

  useEffect(() => scrollToBottom(), [messages]);

  function saveFileTree(ft) {
    return axios.put('/projects/update-file-tree', {
      projectId: project._id,
      fileTree: ft,
    }).then((res) => res.data);
  }

  function scrollToBottom() {
    if (messageBox.current) {
      messageBox.current.scrollTop = messageBox.current.scrollHeight;
    }
  }

  const closeFile = (file) => {
    setOpenFiles((prev) => {
      const updatedFiles = prev.filter((f) => f !== file);
      if (currentFile === file) setCurrentFile(updatedFiles[0] || null);
      return updatedFiles;
    });
  };

  const stripAnsi = (str) => {
    return str.replace(/\x1B\[[0-9;]*[a-zA-Z]/g, '');
  };

  const runServer = async () => {
    try {
      setErroredFile(null);
      setOutput('');
      if (!webContainer) throw new Error('WebContainer not initialized');
      const transformedTree = convertToFileSystemTree(fileTree);
      await webContainer.mount(transformedTree);

      const hasPackageJson = Object.keys(fileTree).some((file) => file === 'package.json');
      const outputLogs = [];

      if (hasPackageJson) {
        const installProcess = await webContainer.spawn('npm', ['install']);
        installProcess.output.pipeTo(
          new WritableStream({
            write(chunk) {
              outputLogs.push(stripAnsi(chunk));
              setOutput(outputLogs.join('\n'));
            },
          })
        );
        const installExitCode = await installProcess.exit;
        if (installExitCode !== 0) {
          const errorOutput = outputLogs.join('\n');
          const errorLocation = parseErrorLocation(errorOutput);
          if (errorLocation && Object.keys(fileTree).includes(errorLocation.file)) {
            setErroredFile(errorLocation.file);
          }
          throw new Error(`npm install failed with exit code ${installExitCode}\n${errorOutput}`);
        }

        if (runProcess) runProcess.kill();
        const tempRunProcess = await webContainer.spawn('npm', ['start'], { tty: true });
        tempRunProcess.output.pipeTo(
          new WritableStream({
            write(chunk) {
              outputLogs.push(stripAnsi(chunk));
              setOutput(outputLogs.join('\n'));
            },
          })
        );
        tempRunProcess.exit.then((code) => {
          if (code !== 0) {
            const errorOutput = outputLogs.join('\n');
            const errorLocation = parseErrorLocation(errorOutput);
            if (errorLocation && Object.keys(fileTree).includes(errorLocation.file)) {
              setErroredFile(errorLocation.file);
            }
            toast.error(`Server failed with exit code ${code}`);
          } else {
            setErroredFile(null); // Clear error on successful run
          }
        });
        setRunProcess(tempRunProcess);

        webContainer.on('server-ready', (port, url) => {
          setIframeUrl(url);
        });
      } else if (currentFile && fileTree[currentFile]) {
        const scriptProcess = await webContainer.spawn('node', [currentFile]);
        scriptProcess.output.pipeTo(
          new WritableStream({
            write(chunk) {
              outputLogs.push(stripAnsi(chunk));
              setOutput(outputLogs.join('\n'));
            },
          })
        );
        const scriptExitCode = await scriptProcess.exit;
        if (scriptExitCode !== 0) {
          const errorOutput = outputLogs.join('\n');
          const errorLocation = parseErrorLocation(errorOutput);
          if (errorLocation && errorLocation.file === currentFile) {
            setErroredFile(currentFile);
          }
          throw new Error(`Script execution failed with exit code ${scriptExitCode}\n${errorOutput}`);
        } else {
          setErroredFile(null); // Clear error on successful run
          toast.success('Script executed successfully!');
        }
      } else {
        throw new Error('No valid file to execute');
      }

      setOutput(outputLogs.join('\n'));
    } catch (error) {
      console.error('Error running code:', error);
      const errorDetails = error.message.includes('\n') ? error.message : `${error.message}\nCheck console for more details`;
      setOutput(errorDetails);
      toast.error('Failed to execute code');
    }
  };

  const convertToFileSystemTree = (flatFileTree) => {
    const tree = {};
    for (const [path, value] of Object.entries(flatFileTree)) {
      const parts = path.split('/');
      let current = tree;
      for (let i = 0; i < parts.length; i++) {
        const part = parts[i];
        if (i === parts.length - 1) {
          current[part] = { file: { contents: value.file.contents } };
        } else {
          current[part] = current[part] || { directory: {} };
          current = current[part].directory;
        }
      }
    }
    return tree;
  };

  return (
    <main className="h-screen w-full flex bg-gray-900 font-sans overflow-hidden">
      <section className="left flex flex-col h-full w-1/3 bg-gradient-to-b from-gray-800 to-gray-900 shadow-2xl border-r border-gray-700 relative">
        <header className="flex justify-between items-center p-4 bg-gray-850 text-white shadow-md animate-fade-in-down">
          <button
            className="flex gap-2 items-center hover:bg-indigo-600 p-2 rounded-lg transition-all duration-300 transform hover:scale-105"
            onClick={() => setIsModalOpen(true)}
          >
            <i className="ri-add-fill"></i>
            <p>Add Collaborator</p>
          </button>
          <div className="flex gap-2">
            <button
              className="p-2 hover:bg-indigo-600 rounded-lg transition-all duration-300 transform hover:scale-110"
              onClick={() => navigate('/')}
              title="Back to Home"
            >
              <i className="ri-home-4-fill"></i>
            </button>
            <button
              className="p-2 hover:bg-indigo-600 rounded-lg transition-all duration-300 transform hover:scale-110"
              onClick={() => setIsSidePanelOpen(!isSidePanelOpen)}
            >
              <i className="ri-group-fill"></i>
            </button>
          </div>
        </header>
        <div className="conversation-area flex-grow flex flex-col p-4 overflow-hidden">
          <div
            ref={messageBox}
            className="message-box flex-grow flex flex-col gap-4 overflow-y-auto scrollbar-thin scrollbar-thumb-indigo-500 scrollbar-track-gray-800"
          >
            {messages.map((msg, index) => (
              <div
                key={index}
                className={`message flex flex-col p-3 rounded-xl shadow-md transition-all duration-300 transform hover:scale-[1.02] ${
                  msg.sender._id === 'ai'
                    ? 'max-w-[90%] bg-gradient-to-br from-indigo-800 to-gray-900 text-white'
                    : `max-w-64 bg-gray-700 text-white ${msg.sender._id === user._id.toString() ? 'ml-auto' : ''}`
                } animate-slide-up`}
              >
                <small className="opacity-70 text-xs mb-1">{msg.sender.email}</small>
                <div className="text-sm flex items-center gap-2">
                  {msg.sender._id === 'ai' ? (
                    WriteAiMessage(msg.message)
                  ) : (
                    <div className="flex flex-col flex-grow">
                      <p className="break-words pr-12">{msg.message}</p>
                      <span className="text-xs opacity-50 mt-1 self-end">{msg.timestamp}</span>
                    </div>
                  )}
                  <button
                    onClick={() => navigator.clipboard.writeText(typeof msg.message === 'object' ? msg.message.text : msg.message)}
                    className="p-1 text-gray-300 bg-gray-600 rounded-full hover:bg-indigo-500 transition-all duration-200"
                  >
                    <i className="ri-file-copy-line"></i>
                  </button>
                </div>
              </div>
            ))}
          </div>
          <div className="inputField w-full flex flex-col gap-2 p-4 bg-gray-850 rounded-xl shadow-inner animate-fade-in-up">
            <div className="flex justify-end">
              <button
                onClick={sendToAI}
                disabled={!message.trim()}
                className={`p-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 transition-all duration-300 transform hover:scale-110 ${
                  !message.trim() ? 'opacity-50 cursor-not-allowed' : ''
                }`}
                title="Send to AI"
              >
                <BotMessageSquare />
              </button>
            </div>
            <div className="flex gap-2">
              <input
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && send()}
                className="p-2 px-4 bg-gray-800 border border-gray-700 rounded-md flex-grow focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all duration-300 text-white placeholder-gray-400"
                type="text"
                placeholder="Enter message (@ai for AI response)"
              />
              <button
                onClick={send}
                disabled={!message.trim()}
                className={`px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 transition-all duration-300 transform hover:scale-105 ${
                  !message.trim() ? 'opacity-50 cursor-not-allowed' : ''
                }`}
              >
                <i className="ri-send-plane-fill"></i>
              </button>
            </div>
          </div>
        </div>
        <div
          className={`sidePanel absolute top-0 left-0 w-full h-full flex flex-col bg-gray-800 shadow-2xl transition-transform duration-500 ease-in-out z-10 ${
            isSidePanelOpen ? 'translate-x-0' : '-translate-x-full'
          }`}
        >
          <header className="flex justify-between items-center p-4 bg-gray-850 border-b border-gray-700 text-white">
            <h1 className="font-semibold text-lg">Collaborators</h1>
            <button
              className="p-2 hover:bg-indigo-600 rounded-lg transition-all duration-300 transform hover:scale-110"
              onClick={() => setIsSidePanelOpen(false)}
            >
              <i className="ri-close-fill"></i>
            </button>
          </header>
          <div className="users flex flex-col gap-2 p-4 overflow-y-auto">
            <div className="online-users mb-4">
              <h2 className="text-sm font-semibold text-indigo-300 mb-2">Online Collaborators</h2>
              {onlineUsers.size > 0 ? (
                Array.from(onlineUsers).map(([userId, { email }]) => (
                  <div
                    key={userId}
                    className="flex gap-2 items-center p-2 text-white animate-fade-in"
                  >
                    <div className="w-3 h-3 rounded-full bg-green-500"></div>
                    <span>{email}</span>
                  </div>
                ))
              ) : (
                <p className="text-gray-400">No collaborators online</p>
              )}
            </div>
            <div className="all-users">
              <h2 className="text-sm font-semibold text-indigo-300 mb-2">All Collaborators</h2>
              {project.users?.length > 0 ? (
                project.users.map((user, index) => (
                  <div
                    key={user._id || `user-${index}`}
                    className="user flex gap-2 items-center p-2 hover:bg-gray-700 rounded-md transition-all duration-300 transform hover:scale-105 cursor-pointer animate-fade-in"
                  >
                    <div className="w-10 h-10 rounded-full bg-indigo-600 flex items-center justify-center text-white shadow-md">
                      <i className="ri-user-fill"></i>
                    </div>
                    <h1 className="font-semibold text-white">{user.email || 'No email'}</h1>
                  </div>
                ))
              ) : (
                <p className="text-gray-400">No users available</p>
              )}
            </div>
          </div>
        </div>
      </section>

      <section className="right flex-grow h-full flex bg-gray-850">
        <div className="explorer w-64 h-full bg-gray-800 shadow-md border-r border-gray-700 animate-slide-in-left">
          <div className="file-tree w-full p-4">
            <h2 className="text-lg font-semibold text-indigo-300 mb-4">Files</h2>
            {Object.keys(fileTree).length > 0 ? (
              <div className="file-list space-y-2">
                {Object.keys(fileTree).map((file, index) => (
                  <div key={index} className="flex items-center gap-2">
                    {editingFile === file ? (
                      <input
                        type="text"
                        value={newFileName}
                        onChange={(e) => setNewFileName(e.target.value)}
                        onBlur={() => handleFileRename(file)}
                        onKeyPress={(e) => e.key === 'Enter' && handleFileRename(file)}
                        className="w-full p-1 bg-gray-700 text-white rounded-md border border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-400"
                        autoFocus
                      />
                    ) : (
                      <button
                        onClick={() => {
                          setCurrentFile(file);
                          setOpenFiles((prev) => [...new Set([...prev, file])]);
                        }}
                        onDoubleClick={() => startEditingFile(file)}
                        className={`file-button w-full flex items-center gap-2 p-2 rounded-md transition-all duration-300 text-white transform hover:scale-105 shadow-sm group ${
                          file === erroredFile ? 'bg-red-700' : 'bg-gray-750 hover:bg-indigo-700'
                        }`}
                        title="Double-click to rename"
                      >
                        <i className="ri-file-line text-indigo-400 flex-shrink-0"></i>
                        <span className="file-name flex-grow text-left truncate">{file}</span>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            startEditingFile(file);
                          }}
                          className="opacity-0 group-hover:opacity-100 text-gray-400 hover:text-indigo-300 transition-opacity"
                        >
                          <i className="ri-pencil-line"></i>
                        </button>
                      </button>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-gray-400 italic">No files yet</p>
            )}
          </div>
        </div>

        <div className="code-editor flex flex-col flex-grow h-full bg-gray-900 text-white shadow-inner">
          <div className="top flex justify-between items-center p-2 bg-gray-850 border-b border-gray-700">
            <div className="files flex gap-1 overflow-x-auto">
              {openFiles.map((file, index) => (
                <div key={index} className="flex items-center bg-gray-800 rounded-t-md shadow-sm">
                  <button
                    onClick={() => setCurrentFile(file)}
                    className={`p-2 px-4 flex items-center gap-2 text-white font-medium transition-all duration-300 ${
                      currentFile === file ? 'bg-indigo-600 border-t-2 border-indigo-400' : 'hover:bg-gray-700'
                    }`}
                  >
                    <span>{file}</span>
                  </button>
                  <button
                    onClick={() => closeFile(file)}
                    className="p-2 text-gray-400 hover:text-red-400 hover:bg-gray-700 rounded-r-md transition-all duration-300"
                  >
                    <i className="ri-close-line"></i>
                  </button>
                </div>
              ))}
            </div>
            <div className="actions flex gap-2 p-2">
              <button
                onClick={runServer}
                disabled={!isWebContainerReady}
                className={`p-2 px-4 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 transition-all duration-300 transform hover:scale-105 shadow-md ${
                  !isWebContainerReady ? 'opacity-50 cursor-not-allowed' : ''
                }`}
              >
                Run
              </button>
            </div>
          </div>
          <div className="editor-and-terminal flex flex-col h-[calc(100%-48px)]">
            <div className="editor h-3/4 overflow-y-auto custom-scrollbar">
              {currentFile && fileTree[currentFile] ? (
                <CodeEditorArea
                  fileTree={fileTree}
                  currentFile={currentFile}
                  setFileTree={setFileTree}
                  saveFileTree={saveFileTree}
                />
              ) : (
                <div className="h-full flex items-center justify-center bg-gray-900">
                  <h1 className="text-4xl font-bold text-indigo-400 animate-pulse tracking-wide">
                    Code Nexus
                  </h1>
                </div>
              )}
            </div>
            <div className="terminal h-1/4 bg-gray-800 border-t border-gray-700 p-2 overflow-y-auto custom-scrollbar">
              <h3 className="text-sm font-semibold text-indigo-300 mb-1">Output</h3>
              <pre className="text-white text-sm whitespace-pre-wrap">{output || ' '}</pre>
              {output.includes('Error') && (
                <div className="error-panel bg-red-900 text-white p-4 rounded-md mt-2">
                  <h3 className="font-bold">Error Details</h3>
                  <pre>{output}</pre>
                </div>
              )}
            </div>
          </div>
        </div>

        {iframeUrl && webContainer && (
          <div className="w-1/2 h-full bg-gray-800 shadow-md border-l border-gray-700 animate-slide-in-right">
            <div className="address-bar p-2 bg-gray-850">
              <input
                type="text"
                onChange={(e) => setIframeUrl(e.target.value)}
                sandbox="allow-scripts allow-same-origin"
                value={iframeUrl}
                className="w-full p-2 bg-black text-white border border-gray-700 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500 text-white transition-all duration-300"
              />
            </div>
            <iframe src={iframeUrl} className="w-full h-[calc(100%-48px)] border-0" />
          </div>
        )}
      </section>

      {isModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center animate-fade-in">
          <div className="bg-gray-800 p-6 rounded-xl w-96 shadow-2xl transform transition-all duration-300 scale-95 hover:scale-100">
            <header className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-semibold text-indigo-300">Select User</h2>
              <button
                className="p-2 hover:bg-gray-700 rounded-full transition-all duration-300 transform hover:scale-110"
                onClick={() => setIsModalOpen(false)}
              >
                <i className="ri-close-fill text-white"></i>
              </button>
            </header>
            <div className="users-list flex flex-col gap-2 max-h-64 overflow-y-auto scrollbar-thin scrollbar-thumb-indigo-500 scrollbar-track-gray-800">
              {users.map((user) => (
                <div
                  key={user._id}
                  className={`flex gap-2 items-center p-2 cursor-pointer hover:bg-gray-700 rounded-md transition-all duration-300 transform hover:scale-105 ${
                    selectedUserId.has(user._id) ? 'bg-indigo-700' : ''
                  }`}
                  onClick={() => handleUserClick(user._id)}
                >
                  <div className="w-10 h-10 rounded-full bg-indigo-600 flex items-center justify-center text-white shadow-md">
                    <i className="ri-user-fill"></i>
                  </div>
                  <h1 className="font-semibold text-white">{user.email}</h1>
                </div>
              ))}
            </div>
            <button
              onClick={addCollaborators}
              className="mt-4 w-full py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 transition-all duration-300 transform hover:scale-105 shadow-md"
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
