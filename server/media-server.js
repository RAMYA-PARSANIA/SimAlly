const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const mediasoup = require('mediasoup');
const cors = require('cors');

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
  cors: {
    origin: "http://localhost:5173",
    methods: ["GET", "POST"]
  }
});

app.use(cors({
  origin: 'http://localhost:5173',
  credentials: true
}));
app.use(express.json());

const PORT = process.env.MEDIA_PORT || 3001;

// Mediasoup configuration
const mediaCodecs = [
  {
    kind: 'audio',
    mimeType: 'audio/opus',
    clockRate: 48000,
    channels: 2,
  },
  {
    kind: 'video',
    mimeType: 'video/VP8',
    clockRate: 90000,
    parameters: {
      'x-google-start-bitrate': 1000,
    },
  },
  {
    kind: 'video',
    mimeType: 'video/VP9',
    clockRate: 90000,
    parameters: {
      'profile-id': 2,
      'x-google-start-bitrate': 1000,
    },
  },
  {
    kind: 'video',
    mimeType: 'video/h264',
    clockRate: 90000,
    parameters: {
      'packetization-mode': 1,
      'profile-level-id': '4d0032',
      'level-asymmetry-allowed': 1,
      'x-google-start-bitrate': 1000,
    },
  },
  {
    kind: 'video',
    mimeType: 'video/H264',
    clockRate: 90000,
    parameters: {
      'packetization-mode': 1,
      'profile-level-id': '42e01f',
      'level-asymmetry-allowed': 1,
      'x-google-start-bitrate': 1000,
    },
  },
];

// Global variables
let worker;
let router;
const rooms = new Map();
const peers = new Map();

// Initialize mediasoup worker
async function createWorker() {
  worker = await mediasoup.createWorker({
    rtcMinPort: 10000,
    rtcMaxPort: 10100,
  });

  console.log(`Mediasoup worker pid: ${worker.pid}`);

  worker.on('died', (error) => {
    console.error('Mediasoup worker has died:', error);
    setTimeout(() => process.exit(1), 2000);
  });

  return worker;
}

// Create router
async function createRouter() {
  router = await worker.createRouter({ mediaCodecs });
  console.log('Mediasoup router created');
  return router;
}

// Room management
class Room {
  constructor(roomId) {
    this.id = roomId;
    this.peers = new Map();
    this.router = null;
    this.createdAt = new Date();
  }

  async initialize() {
    this.router = await worker.createRouter({ mediaCodecs });
    console.log(`Room ${this.id} initialized with router`);
  }

  addPeer(peerId, socket) {
    const peer = {
      id: peerId,
      socket: socket,
      transports: new Map(),
      producers: new Map(),
      consumers: new Map(),
      displayName: '',
      joined: false
    };
    
    this.peers.set(peerId, peer);
    peers.set(peerId, peer);
    console.log(`Peer ${peerId} added to room ${this.id}`);
    return peer;
  }

  removePeer(peerId) {
    const peer = this.peers.get(peerId);
    if (peer) {
      // Close all transports
      peer.transports.forEach(transport => transport.close());
      
      // Remove peer
      this.peers.delete(peerId);
      peers.delete(peerId);
      
      console.log(`Peer ${peerId} removed from room ${this.id}`);
      
      // Notify other peers
      this.broadcast('peerLeft', { peerId }, peerId);
      
      // Clean up room if empty
      if (this.peers.size === 0) {
        this.router.close();
        rooms.delete(this.id);
        console.log(`Room ${this.id} closed - no peers remaining`);
      }
    }
  }

  broadcast(event, data, excludePeerId = null) {
    this.peers.forEach((peer, peerId) => {
      if (peerId !== excludePeerId && peer.socket) {
        peer.socket.emit(event, data);
      }
    });
  }

  getPeersInfo() {
    const peersInfo = [];
    this.peers.forEach((peer, peerId) => {
      if (peer.joined) {
        peersInfo.push({
          id: peerId,
          displayName: peer.displayName
        });
      }
    });
    return peersInfo;
  }
}

// Socket.IO connection handling
io.on('connection', (socket) => {
  console.log(`Socket connected: ${socket.id}`);

  socket.on('join-room', async (data) => {
    try {
      const { roomId, displayName } = data;
      console.log(`${socket.id} joining room ${roomId} as ${displayName}`);

      // Get or create room
      let room = rooms.get(roomId);
      if (!room) {
        room = new Room(roomId);
        await room.initialize();
        rooms.set(roomId, room);
      }

      // Add peer to room
      const peer = room.addPeer(socket.id, socket);
      peer.displayName = displayName;
      
      socket.join(roomId);
      socket.roomId = roomId;

      // Send router RTP capabilities
      socket.emit('routerRtpCapabilities', room.router.rtpCapabilities);

    } catch (error) {
      console.error('Error joining room:', error);
      socket.emit('error', { message: 'Failed to join room' });
    }
  });

  socket.on('createWebRtcTransport', async (data) => {
    try {
      const { direction } = data; // 'send' or 'recv'
      const room = rooms.get(socket.roomId);
      const peer = peers.get(socket.id);

      if (!room || !peer) {
        throw new Error('Room or peer not found');
      }

      const transport = await room.router.createWebRtcTransport({
        listenIps: [
          {
            ip: '0.0.0.0',
            announcedIp: '127.0.0.1', // Replace with your server's public IP in production
          },
        ],
        enableUdp: true,
        enableTcp: true,
        preferUdp: true,
      });

      peer.transports.set(transport.id, transport);

      transport.on('dtlsstatechange', (dtlsState) => {
        if (dtlsState === 'closed') {
          transport.close();
          peer.transports.delete(transport.id);
        }
      });

      socket.emit('webRtcTransportCreated', {
        id: transport.id,
        iceParameters: transport.iceParameters,
        iceCandidates: transport.iceCandidates,
        dtlsParameters: transport.dtlsParameters,
      });

    } catch (error) {
      console.error('Error creating WebRTC transport:', error);
      socket.emit('error', { message: 'Failed to create transport' });
    }
  });

  socket.on('connectTransport', async (data) => {
    try {
      const { transportId, dtlsParameters } = data;
      const peer = peers.get(socket.id);

      if (!peer) {
        throw new Error('Peer not found');
      }

      const transport = peer.transports.get(transportId);
      if (!transport) {
        throw new Error('Transport not found');
      }

      await transport.connect({ dtlsParameters });
      socket.emit('transportConnected');

    } catch (error) {
      console.error('Error connecting transport:', error);
      socket.emit('error', { message: 'Failed to connect transport' });
    }
  });

  socket.on('produce', async (data) => {
    try {
      const { transportId, kind, rtpParameters } = data;
      const room = rooms.get(socket.roomId);
      const peer = peers.get(socket.id);

      if (!room || !peer) {
        throw new Error('Room or peer not found');
      }

      const transport = peer.transports.get(transportId);
      if (!transport) {
        throw new Error('Transport not found');
      }

      const producer = await transport.produce({ kind, rtpParameters });
      peer.producers.set(producer.id, producer);

      producer.on('transportclose', () => {
        producer.close();
        peer.producers.delete(producer.id);
      });

      // Mark peer as joined when they start producing
      if (!peer.joined) {
        peer.joined = true;
        
        // Notify other peers
        room.broadcast('peerJoined', {
          peerId: socket.id,
          displayName: peer.displayName
        }, socket.id);

        // Send existing peers to new peer
        socket.emit('existingPeers', room.getPeersInfo());
      }

      // Notify other peers about new producer
      room.broadcast('newProducer', {
        peerId: socket.id,
        producerId: producer.id,
        kind: producer.kind
      }, socket.id);

      socket.emit('produced', { id: producer.id });

    } catch (error) {
      console.error('Error producing:', error);
      socket.emit('error', { message: 'Failed to produce' });
    }
  });

  socket.on('consume', async (data) => {
    try {
      const { transportId, producerId, rtpCapabilities } = data;
      const room = rooms.get(socket.roomId);
      const peer = peers.get(socket.id);

      if (!room || !peer) {
        throw new Error('Room or peer not found');
      }

      const transport = peer.transports.get(transportId);
      if (!transport) {
        throw new Error('Transport not found');
      }

      if (!room.router.canConsume({ producerId, rtpCapabilities })) {
        throw new Error('Cannot consume');
      }

      const consumer = await transport.consume({
        producerId,
        rtpCapabilities,
        paused: true,
      });

      peer.consumers.set(consumer.id, consumer);

      consumer.on('transportclose', () => {
        consumer.close();
        peer.consumers.delete(consumer.id);
      });

      consumer.on('producerclose', () => {
        consumer.close();
        peer.consumers.delete(consumer.id);
        socket.emit('consumerClosed', { consumerId: consumer.id });
      });

      socket.emit('consumed', {
        id: consumer.id,
        producerId: producerId,
        kind: consumer.kind,
        rtpParameters: consumer.rtpParameters,
      });

    } catch (error) {
      console.error('Error consuming:', error);
      socket.emit('error', { message: 'Failed to consume' });
    }
  });

  socket.on('resumeConsumer', async (data) => {
    try {
      const { consumerId } = data;
      const peer = peers.get(socket.id);

      if (!peer) {
        throw new Error('Peer not found');
      }

      const consumer = peer.consumers.get(consumerId);
      if (!consumer) {
        throw new Error('Consumer not found');
      }

      await consumer.resume();
      socket.emit('consumerResumed');

    } catch (error) {
      console.error('Error resuming consumer:', error);
      socket.emit('error', { message: 'Failed to resume consumer' });
    }
  });

  socket.on('getProducers', () => {
    try {
      const room = rooms.get(socket.roomId);
      if (!room) {
        throw new Error('Room not found');
      }

      const producers = [];
      room.peers.forEach((peer, peerId) => {
        if (peerId !== socket.id && peer.joined) {
          peer.producers.forEach((producer, producerId) => {
            producers.push({
              peerId: peerId,
              producerId: producerId,
              kind: producer.kind
            });
          });
        }
      });

      socket.emit('producers', producers);

    } catch (error) {
      console.error('Error getting producers:', error);
      socket.emit('error', { message: 'Failed to get producers' });
    }
  });

  socket.on('disconnect', () => {
    console.log(`Socket disconnected: ${socket.id}`);
    
    const room = rooms.get(socket.roomId);
    if (room) {
      room.removePeer(socket.id);
    }
  });
});

// REST API endpoints
app.get('/api/media/health', (req, res) => {
  res.json({
    status: 'healthy',
    rooms: rooms.size,
    peers: peers.size,
    worker: worker ? 'running' : 'not initialized'
  });
});

app.get('/api/media/rooms', (req, res) => {
  const roomList = [];
  rooms.forEach((room, roomId) => {
    roomList.push({
      id: roomId,
      peers: room.peers.size,
      createdAt: room.createdAt
    });
  });
  res.json({ rooms: roomList });
});

// Initialize and start server
async function startServer() {
  try {
    await createWorker();
    
    server.listen(PORT, () => {
      console.log(`Mediasoup server running on http://localhost:${PORT}`);
      console.log(`Health check: http://localhost:${PORT}/api/media/health`);
    });
  } catch (error) {
    console.error('Failed to start mediasoup server:', error);
    process.exit(1);
  }
}

startServer();

module.exports = { app, server };