const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
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
const participants = new Map();

io.on('connection', (socket) => {
  console.log('User connected:', socket.id);

  // Join a meeting room
  socket.on('join-room', (data) => {
    const { roomId, displayName } = data;
    console.log(`User ${displayName} (${socket.id}) joining room ${roomId}`);
    
    // Leave any previous rooms
    Array.from(socket.rooms).forEach(room => {
      if (room !== socket.id) {
        socket.leave(room);
        console.log(`User ${socket.id} left room ${room}`);
      }
    });
    
    // Join the new room
    socket.join(roomId);
    
    // Store participant info
    participants.set(socket.id, {
      id: socket.id,
      displayName,
      roomId
    });
    
    // Initialize room if it doesn't exist
    if (!rooms.has(roomId)) {
      rooms.set(roomId, new Set());
    }
    
    const room = rooms.get(roomId);
    
    // Get existing users in the room (excluding the new user)
    const existingUsers = Array.from(room)
      .filter(id => id !== socket.id)
      .map(id => participants.get(id))
      .filter(Boolean);
    
    console.log(`Existing users in room ${roomId}:`, existingUsers);
    
    // Send existing users to the new user
    socket.emit('existing-participants', existingUsers);
    
    // Add new user to room
    room.add(socket.id);
    
    // Notify existing users about the new user
    socket.to(roomId).emit('participant-joined', participants.get(socket.id));
    
    console.log(`Room ${roomId} now has ${room.size} users`);
  });

  // WebRTC signaling
  socket.on('webrtc-offer', (data) => {
    console.log(`Relaying offer from ${socket.id} to ${data.to}`);
    io.to(data.to).emit('webrtc-offer', {
      from: socket.id,
      offer: data.offer,
      fromUser: participants.get(socket.id)
    });
  });

  socket.on('webrtc-answer', (data) => {
    console.log(`Relaying answer from ${socket.id} to ${data.to}`);
    io.to(data.to).emit('webrtc-answer', {
      from: socket.id,
      answer: data.answer
    });
  });

  socket.on('webrtc-ice-candidate', (data) => {
    console.log(`Relaying ICE candidate from ${socket.id} to ${data.to}`);
    io.to(data.to).emit('webrtc-ice-candidate', {
      from: socket.id,
      candidate: data.candidate
    });
  });

  // Chat messages
  socket.on('chat-message', (data) => {
    const participant = participants.get(socket.id);
    if (participant) {
      const message = {
        id: Date.now().toString(),
        sender: participant.displayName,
        message: data.message,
        timestamp: new Date()
      };
      
      // Broadcast to all users in the room
      io.to(participant.roomId).emit('chat-message', message);
    }
  });

  // Media state changes
  socket.on('media-state-change', (data) => {
    const participant = participants.get(socket.id);
    if (participant) {
      socket.to(participant.roomId).emit('participant-media-change', {
        participantId: socket.id,
        ...data
      });
    }
  });

  socket.on('disconnect', (reason) => {
    console.log(`User ${socket.id} disconnected:`, reason);
    
    const participant = participants.get(socket.id);
    if (participant) {
      const { roomId } = participant;
      
      // Remove user from room
      if (rooms.has(roomId)) {
        const room = rooms.get(roomId);
        room.delete(socket.id);
        
        // Notify other users in the room
        socket.to(roomId).emit('participant-left', {
          participantId: socket.id,
          displayName: participant.displayName
        });
        
        // Clean up empty room
        if (room.size === 0) {
          rooms.delete(roomId);
          console.log(`Deleted empty room ${roomId}`);
        } else {
          console.log(`Room ${roomId} now has ${room.size} users`);
        }
      }
      
      // Remove participant
      participants.delete(socket.id);
    }
  });

  // Handle explicit leave room
  socket.on('leave-room', () => {
    const participant = participants.get(socket.id);
    if (participant) {
      const { roomId } = participant;
      
      console.log(`User ${socket.id} leaving room ${roomId}`);
      
      socket.leave(roomId);
      
      if (rooms.has(roomId)) {
        const room = rooms.get(roomId);
        room.delete(socket.id);
        
        // Notify other users
        socket.to(roomId).emit('participant-left', {
          participantId: socket.id,
          displayName: participant.displayName
        });
        
        // Clean up empty room
        if (room.size === 0) {
          rooms.delete(roomId);
          console.log(`Deleted empty room ${roomId}`);
        }
      }
      
      participants.delete(socket.id);
    }
  });
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    activeRooms: rooms.size,
    totalParticipants: participants.size,
    connections: io.engine.clientsCount
  });
});

app.get('/', (req, res) => {
  res.json({
    message: 'SimAlly WebRTC Signaling Server',
    version: '1.0.0',
    activeRooms: rooms.size,
    participants: participants.size
  });
});

const PORT = process.env.WEBRTC_PORT || 5001;
server.listen(PORT, () => {
  console.log(`WebRTC Signaling server running on port ${PORT}`);
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

module.exports = { app, server, io };