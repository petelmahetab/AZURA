import { io } from 'socket.io-client';

let socketInstance;

export const initializeSocket = (projectId) => {
    let apiUrl = import.meta.env.VITE_API_URL || 'https://chat-with-me-inky.vercel.app/';
    if (socketInstance && socketInstance.connected) {
        return socketInstance;
    }
    const token = localStorage.getItem('token');
    socketInstance = io(apiUrl, {
        auth: { token },
        query: { projectId },
        transports: ['websocket'],
    });
    return socketInstance;
};

export const receiveMessage = (eventName, cb) => {
    socketInstance.on(eventName, cb);
};

export const sendMessage = (eventName, data) => {
    socketInstance.emit(eventName, data);
};

export const emitUserActivity = (action) => {
    if (socketInstance) {
        socketInstance.emit('user-activity', { action });
    }
};
