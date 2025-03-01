import 'dotenv/config';
import http from 'http';
import app from './app.js';
import { Server } from 'socket.io';
import jwt from 'jsonwebtoken';
import mongoose from 'mongoose';
import projectModel from './models/project.model.js';
import { generateResult } from './services/ai.service.js';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

import dotenv from 'dotenv';
dotenv.config({ path: resolve(__dirname, '../.env') });

const port = process.env.PORT || 4000;

const server = http.createServer(app);
const io = new Server(server, {
    cors: {
        origin: "http://localhost:5173",
        methods: ["GET", "POST"],
        credentials: true,
    },
});

io.use(async (socket, next) => {
    try {
        const token = socket.handshake.auth?.token || socket.handshake.headers.authorization?.split(' ')[1];
        const projectId = socket.handshake.query.projectId;

        console.log('Handshake data:', { projectId, token });

        if (!mongoose.Types.ObjectId.isValid(projectId)) {
            console.log('Invalid projectId:', projectId);
            return next(new Error('Invalid projectId'));
        }

        socket.project = await projectModel.findById(projectId);
        if (!socket.project) {
            console.log('Project not found for ID:', projectId);
            return next(new Error('Project not found'));
        }

        if (!token) {
            console.log('No token provided');
            return next(new Error('Without Token we cant connect'));
        }

        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        if (!decoded) {
            console.log('Token verification failed');
            return next(new Error('Authentication error'));
        }

        socket.user = decoded;
        console.log(`User authenticated: ${socket.user.id}`);
        next();
    } catch (error) {
        console.error('Middleware error:', error.message);
        next(error);
    }
});

io.on('connection', socket => {
    socket.roomId = socket.project._id.toString();
    console.log(`User ${socket.user.id} (email: ${socket.user.email || 'unknown'}) joined room: ${socket.roomId}`);
    socket.join(socket.roomId);
    console.log(`Active rooms for ${socket.user.id}: ${Array.from(socket.rooms)}`);

    // io.to(socket.roomId).emit('project-message', {
    //     message: `${socket.user.email || socket.user.id} has joined the room`,
    //     sender: { _id: 'system', email: 'System' }
    // });
    socket.on('project-message', async data => {
        const message = data.message;
        const aiIsPresentInMessage = message.includes('@ai');
    
        console.log(`Received from ${socket.user.email || socket.user.id} in room ${socket.roomId}:`, data);
        io.to(socket.roomId).emit('project-message', data);
    
        if (aiIsPresentInMessage) {
            const prompt = message.replace('@ai', '').trim();
            const result = await generateResult(prompt);
            console.log(`AI response before sending to room ${socket.roomId}:`, JSON.stringify(result, null, 2)); // Detailed log
            io.to(socket.roomId).emit('project-message', {
                message: JSON.stringify(result),
                sender: { _id: 'ai', email: 'AI' }
            });
        }
    });
    
    socket.on('disconnect', () => {
        console.log(`User ${socket.user.id} (email: ${socket.user.email || 'unknown'}) disconnected from room: ${socket.roomId}`);
        socket.leave(socket.roomId);
    });
});
server.listen(port, () => {
    console.log(`Server is running on port ${port}`);
})

