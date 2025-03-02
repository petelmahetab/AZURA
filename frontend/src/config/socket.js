import { io } from 'socket.io-client';

let socketInstance;

export const initializeSocket = (projectId) => {
    let apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:4000';
    

    if (socketInstance && socketInstance.connected) {
       // console.log(`Reusing socket for project: ${projectId}`);
        return socketInstance;
    }

    const token = localStorage.getItem('token');
    socketInstance = io(apiUrl, {
        auth: { token },
        query: { projectId }
    });

    return socketInstance;
};

export const receiveMessage = (eventName, cb) => {
    socketInstance.on(eventName, cb);
}

export const sendMessage = (eventName, data) => {
    socketInstance.emit(eventName, data);
}