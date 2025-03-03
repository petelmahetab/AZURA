import React, { useState, useEffect, useContext, useRef } from 'react';
import { UserContext } from '../context/user.context';
import { useLocation } from 'react-router-dom';
import axios from '../config/axios';
import { initializeSocket, receiveMessage, sendMessage } from '../config/socket';
import Markdown from 'markdown-to-jsx';
import hljs from 'highlight.js';
import { getWebContainer } from '../config/webcontainer';
import { toast } from 'react-toastify';

// SyntaxHighlightedCode component for code block highlighting
function SyntaxHighlightedCode(props) {
    const ref = useRef(null);

    React.useEffect(() => {
        if (ref.current && props.className?.includes('lang-') && window.hljs) {
            window.hljs.highlightElement(ref.current);
            ref.current.removeAttribute('data-highlighted');
        }
    }, [props.className, props.children]);

    return <code {...props} ref={ref} />;
}

const getLanguageFromFileName = (fileName) => {
    const extension = fileName.split('.').pop().toLowerCase();
    switch (extension) {
        case 'js':
            return 'javascript';
        case 'java':
            return 'java';
        case 'py':
            return 'python';
        case 'c':
            return 'c';
        case 'go':
            return 'go';
        default:
            return 'plaintext';
    }
};

const Project = () => {
    const location = useLocation();
    const [isSidePanelOpen, setIsSidePanelOpen] = useState(false);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [selectedUserId, setSelectedUserId] = useState(new Set());
    const [project, setProject] = useState(location.state.project);
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

    const handleUserClick = (id) => {
        setSelectedUserId(prevSelectedUserId => {
            const newSelectedUserId = new Set(prevSelectedUserId);
            if (newSelectedUserId.has(id)) {
                newSelectedUserId.delete(id);
            } else {
                newSelectedUserId.add(id);
            }
            return newSelectedUserId;
        });
    };

    function addCollaborators() {
        if (selectedUserId.size === 0) {
            console.log("No users selected");
            return;
        }
        const payload = {
            projectId: location.state.project._id,
            users: Array.from(selectedUserId)
        };
        axios.put("/projects/add-user", payload)
            .then(res => {
                setProject(res.data.project || project);
                setIsModalOpen(false);
            })
            .catch(err => {
                console.error("Error:", err.response ? err.response.data : err.message);
            });
    }

    const send = () => {
        if (!message.trim()) {
            return;
        }

        const timestamp = new Date().toLocaleTimeString();
        const messageData = {
            message,
            sender: user,
            timestamp
        };

        sendMessage('project-message', messageData);
        setMessages(prevMessages => [...prevMessages, messageData]);
        setMessage("");
    };

    // New function to send message to AI
    const sendToAI = () => {
        if (!message.trim()) {
            return;
        }
        const aiMessage = message.startsWith('@ai') ? message : `@ai ${message}`;
        const timestamp = new Date().toLocaleTimeString();
        const messageData = {
            message: aiMessage,
            sender: user,
            timestamp
        };

        sendMessage('project-message', messageData);
        setMessages(prevMessages => [...prevMessages, messageData]);
        setMessage("");
    };

    function WriteAiMessage(message) {
        if (typeof message === 'object' && message.text) {
            const { text, fileTree } = message;
            return (
                <div className="overflow-auto bg-slate-950 text-white rounded-sm p-2 max-w-full">
                    <Markdown
                        options={{
                            overrides: {
                                code: { component: SyntaxHighlightedCode },
                            },
                        }}
                    >
                        {text}
                    </Markdown>
                    {fileTree && Object.keys(fileTree).length > 0 && (
                        Object.keys(fileTree).map((fileName, index) => {
                            const { contents } = fileTree[fileName].file;
                            const language = getLanguageFromFileName(fileName);
                            return (
                                <div key={index} className="mt-4">
                                    <h3 className="text-white mb-2">{fileName}</h3>
                                    <pre>
                                        <code className={'lang-' + language} dangerouslySetInnerHTML={{ __html: hljs.highlight(language, contents).value }} />
                                    </pre>
                                </div>
                            );
                        })
                    )}
                </div>
            );
        } else {
            return (
                <div className="overflow-auto bg-slate-950 text-white rounded-sm p-2 max-w-full">
                    <Markdown
                        options={{
                            overrides: {
                                code: { component: SyntaxHighlightedCode },
                            },
                        }}
                    >
                        {typeof message === 'string' ? message : 'Error: Unexpected message format'}
                    </Markdown>
                </div>
            );
        }
    }

    useEffect(() => {
        const socket = initializeSocket(project._id);

        socket.on('connect', () => {
            console.log(`${user.email} connected`);
            toast.success(`${user.email} connected`, { toastId: `connect-${user._id}` });
        });
        socket.on('connect_error', (err) => {
            console.log(`${user.email} connection failed:`, err.message);
            toast.error('Not connected', { toastId: `connect_error-${user._id}` });
        });
        socket.on('disconnect', () => {
            console.log(`${user.email} disconnected`);
            toast.warn(`${user.email} disconnected`, { toastId: `disconnect-${user._id}` });
        });
        receiveMessage('project-message', data => {
            console.log('Raw socket data received:', data);
            setMessages(prevMessages => {
                const exists = prevMessages.some(
                    msg => msg.sender._id === data.sender._id &&
                           msg.message === data.message &&
                           msg.timestamp === data.timestamp
                );
                if (!exists) {
                    console.log(`${user.email} adding:`, data);
                    console.log('Raw data.message:', data.message);
                    if (data.sender._id === 'ai') {
                        let parsedMessage;
                        try {
                            console.log('Attempting to parse:', data.message);
                            let parsed = JSON.parse(data.message);
                            if (typeof parsed === 'string') {
                                console.log('Double-stringified detected, parsing again:', parsed);
                                parsed = JSON.parse(parsed);
                            }
                            console.log('Parsed object:', parsed);
                            if (typeof parsed === 'object' && parsed !== null && 'text' in parsed) {
                                parsedMessage = parsed;
                            } else {
                                console.warn('Invalid AI response format (missing required fields):', parsed);
                                parsedMessage = 'Error: Invalid AI response format';
                            }
                            console.log('Parsed AI message:', parsedMessage);
                        } catch (error) {
                            console.error('Failed to parse AI message:', error, 'Raw message:', data.message);
                            parsedMessage = 'Error: Invalid AI response';
                        }
                        return [...prevMessages, {
                            ...data,
                            message: parsedMessage
                        }];
                    }
                    return [...prevMessages, { ...data }];
                }
                console.log(`${user.email} skipped as duplicate:`, data);
                return prevMessages;
            });
        });

        if (!webContainer) {
            getWebContainer().then(container => {
                setWebContainer(container);
                console.log("container started");
            });
        }

        axios.get(`/projects/get-project/${project._id}`).then(res => {
            setProject(res.data.project);
            setFileTree(res.data.project.fileTree || {});
        });

        axios.get('/users/all').then(res => {
            setUsers(res.data.users);
        }).catch(err => {
            console.log(err);
        });

        return () => {
            socket.off('connect');
            socket.off('connect_error');
            socket.off('disconnect');
            socket.off('project-message');
        };
    }, [project._id, user.email, user._id]);

    useEffect(() => {
        scrollToBottom();
    }, [messages]);

    function saveFileTree(ft) {
        axios.put('/projects/update-file-tree', {
            projectId: project._id,
            fileTree: ft
        }).then(res => {
            console.log(res.data);
        }).catch(err => {
            console.log(err);
        });
    }

    function scrollToBottom() {
        if (messageBox.current) {
            messageBox.current.scrollTop = messageBox.current.scrollHeight;
        }
    }

    return (
        <main className='h-screen w-full flex'>
            <section className="left relative flex flex-col h-screen min-w-[30%] max-w-[35%] bg-slate-300 flex-shrink-0">
                <header className='flex justify-between items-center p-2 px-4 w-full bg-slate-100 absolute z-10 top-0'>
                    <button className='flex gap-2' onClick={() => setIsModalOpen(true)}>
                        <i className="ri-add-fill mr-1"></i>
                        <p>Add collaborator</p>
                    </button>
                    <button onClick={() => setIsSidePanelOpen(!isSidePanelOpen)} className='p-2'>
                        <i className="ri-group-fill"></i>
                    </button>
                </header>
                <div className="conversation-area pt-14 pb-10 flex-grow flex flex-col h-full relative">
                    <div
                        ref={messageBox}
                        className="message-box p-4 flex-grow flex flex-col gap-4 overflow-auto max-h-full scrollbar-thin scrollbar-thumb-slate-400 scrollbar-track-slate-200"
                    >
                        {messages.map((msg, index) => (
                            <div
                                key={index}
                                className={`${msg.sender._id === 'ai' ? 'max-w-[90%]' : 'max-w-52'} ${msg.sender._id === user._id.toString() && 'ml-auto'
                                    } message flex flex-col p-3 rounded-lg shadow-sm ${msg.sender._id === 'ai' ? 'bg-slate-950 text-white' : 'bg-slate-50 text-slate-900'
                                    }`}
                            >
                                <small className="opacity-70 text-xs mb-1">{msg.sender.email}</small>
                                <div className="text-sm relative min-h-[1.5rem] flex items-center gap-2">
                                    {msg.sender._id === 'ai' ? (
                                        WriteAiMessage(msg.message)
                                    ) : (
                                        <div className="flex flex-col flex-grow">
                                            <p className="break-words pr-16">
                                                {msg.message}
                                            </p>
                                            <span className="text-xs opacity-50 mt-1 self-end">
                                                {msg.timestamp}
                                            </span>
                                        </div>
                                    )}
                                    <button
                                        onClick={() => navigator.clipboard.writeText(msg.message)}
                                        className="p-1 text-white bg-slate-700 rounded-full hover:bg-slate-600">
                                        <i className="ri-file-copy-line"></i>
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>

                    <div className="inputField w-full flex absolute bottom-0 gap-2 p-2 flex-col">
                        <div className="flex justify-end">
                            <button
                                onClick={sendToAI}
                                disabled={!message.trim()}
                                className={`p-2 bg-slate-950 rounded-md text-white ${!message.trim() ? 'opacity-50 cursor-not-allowed' : ''}`}
                                title="Send to AI"
                            >
                                <i className="ri-robot-line"></i>
                            </button>
                        </div>
                        <div className="flex gap-2">
                            <input
                                value={message}
                                onChange={(e) => setMessage(e.target.value)}
                                onKeyPress={(e) => e.key === 'Enter' && send()}
                                className='p-2 px-4 border-none outline-none flex-grow'
                                type="text"
                                placeholder='Enter message (use AI button or @ai for AI response)'
                            />
                            <button
                                onClick={send}
                                disabled={!message.trim()}
                                className={`px-5 bg-slate-950 rounded-md text-white ${!message.trim() ? 'opacity-50 cursor-not-allowed' : ''}`}>
                                <i className="ri-send-plane-fill"></i>
                            </button>
                        </div>
                    </div>
                </div>
                <div className={`sidePanel w-full h-full flex flex-col gap-2 bg-slate-50 absolute transition-all ${isSidePanelOpen ? 'translate-x-0' : '-translate-x-full'} top-0`}>
                    <header className='flex justify-between items-center px-4 p-2 bg-slate-200'>
                        <h1 className='font-semibold text-lg'>Collaborators</h1>
                        <button
                            onClick={() => setIsSidePanelOpen(!isSidePanelOpen)}
                            className='p-2'>
                            <i className="ri-close-fill"></i>
                        </button>
                    </header>
                    <div className="users flex flex-col gap-2">
                        {project.users && project.users.length > 0 ? (
                            project.users.map((user, index) => {
                                const uniqueKey = user._id ? user._id : `user-${index}`;
                                return (
                                    <div
                                        key={uniqueKey}
                                        className="user cursor-pointer hover:bg-slate-200 p-2 flex gap-2 items-center">
                                        <div className="aspect-square rounded-full w-fit h-fit flex items-center justify-center p-5 text-white bg-slate-600">
                                            <i className="ri-user-fill absolute"></i>
                                        </div>
                                        <h1 className="font-semibold text-lg">{user.email || 'No email'}</h1>
                                    </div>
                                );
                            })
                        ) : (
                            <p>No users available</p>
                        )}
                    </div>
                </div>
            </section>

            <section className="right bg-red-50 flex-grow h-full flex">
                <div className="explorer h-full max-w-64 min-w-52 bg-slate-200">
                    <div className="file-tree w-full">
                        {Object.keys(fileTree).map((file, index) => (
                            <button
                                key={index}
                                onClick={() => {
                                    setCurrentFile(file);
                                    setOpenFiles([...new Set([...openFiles, file])]);
                                }}
                                className="tree-element cursor-pointer p-2 px-4 flex items-center gap-2 bg-slate-300 w-full">
                                <p className='font-semibold text-lg'>{file}</p>
                            </button>
                        ))}
                    </div>
                </div>

                <div className="code-editor flex flex-col flex-grow h-full shrink">
                    <div className="top flex justify-between w-full">
                        <div className="files flex">
                            {openFiles.map((file, index) => (
                                <button
                                    key={index}
                                    onClick={() => setCurrentFile(file)}
                                    className={`open-file cursor-pointer p-2 px-4 flex items-center w-fit gap-2 bg-slate-300 ${currentFile === file ? 'bg-slate-400' : ''}`}>
                                    <p className='font-semibold text-lg'>{file}</p>
                                </button>
                            ))}
                        </div>
                        <div className="actions flex gap-2">
                            <button
                                onClick={async () => {
                                    await webContainer.mount(fileTree);
                                    const installProcess = await webContainer.spawn("npm", ["install"]);
                                    installProcess.output.pipeTo(new WritableStream({
                                        write(chunk) {
                                            console.log(chunk);
                                        }
                                    }));
                                    if (runProcess) {
                                        runProcess.kill();
                                    }
                                    let tempRunProcess = await webContainer.spawn("npm", ["start"]);
                                    tempRunProcess.output.pipeTo(new WritableStream({
                                        write(chunk) {
                                            console.log(chunk);
                                        }
                                    }));
                                    setRunProcess(tempRunProcess);
                                    webContainer.on('server-ready', (port, url) => {
                                        console.log(port, url);
                                        setIframeUrl(url);
                                    });
                                }}
                                className='p-2 px-4 bg-slate-300 text-white'>
                                run
                            </button>
                        </div>
                    </div>
                    <div className="bottom flex flex-grow max-w-full shrink overflow-auto">
                        {fileTree[currentFile] && (
                            <div className="code-editor-area h-full overflow-auto flex-grow bg-slate-50">
                                <pre className="hljs h-full">
                                    <code
                                        className="hljs h-full outline-none"
                                        contentEditable
                                        suppressContentEditableWarning
                                        onBlur={(e) => {
                                            const updatedContent = e.target.innerText;
                                            const ft = {
                                                ...fileTree,
                                                [currentFile]: {
                                                    file: {
                                                        contents: updatedContent
                                                    }
                                                }
                                            };
                                            setFileTree(ft);
                                            saveFileTree(ft);
                                        }}
                                        dangerouslySetInnerHTML={{ __html: hljs.highlight('javascript', fileTree[currentFile].file.contents).value }}
                                        style={{
                                            whiteSpace: 'pre-wrap',
                                            paddingBottom: '25rem',
                                            counterSet: 'line-numbering',
                                        }}
                                    />
                                </pre>
                            </div>
                        )}
                    </div>
                </div>
                {iframeUrl && webContainer && (
                    <div className="flex min-w-96 flex-col h-full">
                        <div className="address-bar">
                            <input
                                type="text"
                                onChange={(e) => setIframeUrl(e.target.value)}
                                value={iframeUrl}
                                className="w-full p-2 px-4 bg-slate-200" />
                        </div>
                        <iframe src={iframeUrl} className="w-full h-full"></iframe>
                    </div>
                )}
            </section>
            {isModalOpen && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center">
                    <div className="bg-white p-4 rounded-md w-96 max-w-full relative">
                        <header className='flex justify-between items-center mb-4'>
                            <h2 className='text-xl font-semibold'>Select User</h2>
                            <button onClick={() => setIsModalOpen(false)} className='p-2'>
                                <i className="ri-close-fill"></i>
                            </button>
                        </header>
                        <div className="users-list flex flex-col gap-2 mb-16 max-h-96 overflow-auto">
                            {users.map(user => (
                                <div key={user._id} className={`user cursor-pointer hover:bg-slate-200 ${Array.from(selectedUserId).indexOf(user._id) != -1 ? 'bg-slate-200' : ""} p-2 flex gap-2 items-center`} onClick={() => handleUserClick(user._id)}>
                                    <div className='aspect-square relative rounded-full w-fit h-fit flex items-center justify-center p-5 text-white bg-slate-600'>
                                        <i className="ri-user-fill absolute"></i>
                                    </div>
                                    <h1 className='font-semibold text-lg'>{user.email}</h1>
                                </div>
                            ))}
                        </div>
                        <button
                            onClick={addCollaborators}
                            className='absolute bottom-4 left-1/2 transform -translate-x-1/2 px-4 py-2 bg-blue-600 text-white rounded-md'>
                            Add Collaborators
                        </button>
                    </div>
                </div>
            )}
        </main>
    );
};

export default Project;