export const initializeSocket = (projectId) => {
    let apiUrl = import.meta.env.VITE_API_URL || 'https://chat-with-me-inky.vercel.app/';
    console.log('Connecting to:', apiUrl);

    if (socketInstance && socketInstance.connected) {
        console.log(`Reusing socket for project: ${projectId}`);
        return socketInstance;
    }

    const token = localStorage.getItem('token');
    console.log('Token:', token);
    console.log('Project ID:', projectId); 
    socketInstance = io(apiUrl, {
        auth: { token },
        query: { projectId },
        transports: ['websocket'],
    });

    socketInstance.on('connect', () => console.log('Socket connected successfully'));
    socketInstance.on('connect_error', (err) => {
        console.error('Connection failed:', err.message); // Log specific error
    });

    return socketInstance;
};
