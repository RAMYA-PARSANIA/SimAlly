const http = require('http');
const { Server } = require('socket.io');
const express = require('express');
const cors = require('cors');

const app = express();
app.use(cors({ origin: '*', credentials: true }));

const server = http.createServer(app);
const io = new Server(server, { 
  cors: { 
    origin: '*',
    methods: ['GET', 'POST']
  },
  transports: ['websocket', 'polling']
});

// Store room information
const rooms = new Map();

io.on('connection', (socket) => {
  console.log('User connected:', socket.id);

  socket.on('join-room', (roomId, userId) => {
    console.log(`User ${userId} (${socket.id}) joining room ${roomId}`);
    
    // Leave any previous rooms
    Array.from(socket.rooms).forEach(room => {
      if (room !== socket.id) {
        socket.leave(room);
        console.log(`User ${socket.id} left room ${room}`);
      }
    });
    
    // Join the new room
    socket.join(roomId);
    
    // Initialize room if it doesn't exist
    if (!rooms.has(roomId)) {
      rooms.set(roomId, new Set());
    }
    
    const room = rooms.get(roomId);
    
    // Get existing users in the room (excluding the new user)
    const existingUsers = Array.from(room).filter(id => id !== socket.id);
    console.log(`Existing users in room ${roomId}:`, existingUsers);
    
    // Send existing users to the new user
    socket.emit('all-users', existingUsers);
    
    // Add new user to room
    room.add(socket.id);
    
    // Notify existing users about the new user
    socket.to(roomId).emit('user-joined', socket.id);
    
    console.log(`Room ${roomId} now has ${room.size} users:`, Array.from(room));
  });

  socket.on('signal', (data) => {
    console.log(`Relaying signal from ${socket.id} to ${data.to}`);
    io.to(data.to).emit('signal', {
      from: socket.id,
      signal: data.signal,
    });
  });

  socket.on('disconnect', (reason) => {
    console.log(`User ${socket.id} disconnected:`, reason);
    
    // Remove user from all rooms
    rooms.forEach((users, roomId) => {
      if (users.has(socket.id)) {
        users.delete(socket.id);
        console.log(`Removed ${socket.id} from room ${roomId}`);
        
        // Notify other users in the room
        socket.to(roomId).emit('user-left', socket.id);
        
        // Clean up empty rooms
        if (users.size === 0) {
          rooms.delete(roomId);
          console.log(`Deleted empty room ${roomId}`);
        } else {
          console.log(`Room ${roomId} now has ${users.size} users:`, Array.from(users));
        }
      }
    });
  });

  // Handle explicit leave room
  socket.on('leave-room', (roomId) => {
    console.log(`User ${socket.id} leaving room ${roomId}`);
    
    socket.leave(roomId);
    
    if (rooms.has(roomId)) {
      const room = rooms.get(roomId);
      room.delete(socket.id);
      
      // Notify other users
      socket.to(roomId).emit('user-left', socket.id);
      
      // Clean up empty room
      if (room.size === 0) {
        rooms.delete(roomId);
        console.log(`Deleted empty room ${roomId}`);
      }
    }
  });
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    activeRooms: rooms.size,
    totalConnections: io.engine.clientsCount
  });
});

const PORT = 5000;
server.listen(PORT, () => {
  console.log(`Signaling server running on port ${PORT}`);
  console.log(`Health check: http://localhost:${PORT}/health`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM received, shutting down gracefully');
  server.close(() => {
    console.log('Server closed');
    process.exit(0);
  });
});