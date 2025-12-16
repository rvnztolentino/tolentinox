import { createServer } from 'http';
import { Server } from 'socket.io';
import express from 'express';

const app = express();
const httpServer = createServer(app);

const io = new Server(httpServer, {
  cors: {
    origin: process.env.CLIENT_URL || 'http://localhost:5173',
    methods: ['GET', 'POST'],
    credentials: true,
  },
});

interface UserSocket {
  userId: string;
  userName: string;
  userAvatar?: string;
}

// Store connected users
const connectedUsers = new Map<string, UserSocket>();

io.on('connection', (socket) => {
  console.log('User connected:', socket.id);

  // Handle user join
  socket.on('user:join', (userData: UserSocket) => {
    connectedUsers.set(socket.id, userData);
    
    // Broadcast to all clients that a user joined
    io.emit('user:joined', {
      userId: userData.userId,
      userName: userData.userName,
      userAvatar: userData.userAvatar,
      socketId: socket.id,
    });

    // Send current online users to the new user
    const onlineUsers = Array.from(connectedUsers.values());
    socket.emit('users:online', onlineUsers);
    
    console.log(`${userData.userName} joined the chat`);
  });

  // Handle new message
  socket.on('message:send', (message: {
    id: string;
    userId: string;
    userName: string;
    userAvatar?: string;
    content: string;
    timestamp: string;
  }) => {
    // Broadcast message to all connected clients
    io.emit('message:received', message);
    console.log(`Message from ${message.userName}: ${message.content}`);
  });

  // Handle typing indicator
  socket.on('typing:start', (data: { userId: string; userName: string }) => {
    socket.broadcast.emit('user:typing', data);
  });

  socket.on('typing:stop', (data: { userId: string }) => {
    socket.broadcast.emit('user:stopped-typing', data);
  });

  // Handle disconnect
  socket.on('disconnect', () => {
    const user = connectedUsers.get(socket.id);
    if (user) {
      connectedUsers.delete(socket.id);
      io.emit('user:left', {
        userId: user.userId,
        userName: user.userName,
        socketId: socket.id,
      });
      console.log(`${user.userName} left the chat`);
    }
    console.log('User disconnected:', socket.id);
  });
});

const PORT = process.env.PORT || 3001;

httpServer.listen(PORT, () => {
  console.log(`Socket.IO server running on port ${PORT}`);
});

export { io, httpServer };
