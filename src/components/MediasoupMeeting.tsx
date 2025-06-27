import React, { useState, useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import { Mic, MicOff, Video, VideoOff, PhoneOff, Settings, Users, MessageSquare, Share2, ScreenShare, Shield, AlertCircle } from 'lucide-react';
import * as mediasoupClient from 'mediasoup-client';
import io from 'socket.io-client';
import Button from './ui/Button';

interface MediasoupMeetingProps {
  roomName: string;
  displayName: string;
  onLeave: () => void;
}

const MediasoupMeeting: React.FC<MediasoupMeetingProps> = ({ roomName, displayName, onLeave }) => {
  const [isMuted, setIsMuted] = useState(false);
  const [isVideoOff, setIsVideoOff] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const [isConnecting, setIsConnecting] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [peers, setPeers] = useState<Record<string, any>>({});
  const [connectionStatus, setConnectionStatus] = useState<string>('Connecting to media server...');
  const [showSettings, setShowSettings] = useState(false);
  const [showParticipants, setShowParticipants] = useState(false);
  const [participantCount, setParticipantCount] = useState(1); // Including self

  // Refs
  const socketRef = useRef<any>(null);
  const deviceRef = useRef<any>(null);
  const producerTransportRef = useRef<any>(null);
  const consumerTransportRef = useRef<any>(null);
  const producersRef = useRef<Record<string, any>>({});
  const consumersRef = useRef<Record<string, any>>({});
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const mediaApiUrlRef = useRef<string>(import.meta.env.VITE_MEDIA_API_URL || 'https://simally-media.onrender.com');

  // Connection status tracking
  const [lastIceState, setLastIceState] = useState<string>('');
  const [lastDtlsState, setLastDtlsState] = useState<string>('');
  const [reconnectAttempts, setReconnectAttempts] = useState(0);
  const maxReconnectAttempts = 3;

  // Debug info
  const [debugInfo, setDebugInfo] = useState<any>({
    connection: {
      onLine: navigator.onLine,
      userAgent: navigator.userAgent,
      timestamp: new Date().toISOString(),
      mediaApiUrl: mediaApiUrlRef.current,
      webrtcSupport: {
        getUserMedia: !!navigator.mediaDevices?.getUserMedia,
        RTCPeerConnection: !!window.RTCPeerConnection,
        RTCDataChannel: !!window.RTCDataChannel
      }
    }
  });

  // Initialize meeting
  useEffect(() => {
    console.log('🚀 Initializing Mediasoup meeting', {
      roomName,
      displayName,
      mediaApiUrl: mediaApiUrlRef.current
    });

    // Check for WebRTC support
    if (!deviceRef.current && !checkWebRtcSupport()) {
      setError('Your browser does not support WebRTC. Please use a modern browser like Chrome, Firefox, or Edge.');
      setIsConnecting(false);
      return;
    }

    // Connect to signaling server
    connectToSignalingServer();

    // Add window event listeners
    window.addEventListener('online', handleNetworkChange);
    window.addEventListener('offline', handleNetworkChange);

    // Cleanup function
    return () => {
      cleanupMediasoup();
      window.removeEventListener('online', handleNetworkChange);
      window.removeEventListener('offline', handleNetworkChange);
    };
  }, [roomName]);

  // Update debug info periodically
  useEffect(() => {
    const interval = setInterval(() => {
      setDebugInfo(prev => ({
        ...prev,
        connection: {
          ...prev.connection,
          onLine: navigator.onLine,
          timestamp: new Date().toISOString()
        }
      }));
    }, 10000);

    return () => clearInterval(interval);
  }, []);

  // Check WebRTC support
  const checkWebRtcSupport = () => {
    return !!(
      navigator.mediaDevices &&
      navigator.mediaDevices.getUserMedia &&
      window.RTCPeerConnection
    );
  };

  // Handle network changes
  const handleNetworkChange = () => {
    setDebugInfo(prev => ({
      ...prev,
      connection: {
        ...prev.connection,
        onLine: navigator.onLine,
        timestamp: new Date().toISOString()
      }
    }));

    if (!navigator.onLine) {
      setConnectionStatus('Network connection lost. Waiting to reconnect...');
    } else if (socketRef.current && !socketRef.current.connected) {
      setConnectionStatus('Network connection restored. Attempting to reconnect...');
      attemptReconnect();
    }
  };

  // Attempt to reconnect
  const attemptReconnect = () => {
    if (reconnectAttempts >= maxReconnectAttempts) {
      setError('Failed to reconnect after multiple attempts. Please try joining again.');
      return;
    }

    setReconnectAttempts(prev => prev + 1);
    setConnectionStatus(`Reconnecting... Attempt ${reconnectAttempts + 1}/${maxReconnectAttempts}`);
    
    // Clean up existing connections
    cleanupMediasoup();
    
    // Try to reconnect
    setTimeout(() => {
      connectToSignalingServer();
    }, 1000);
  };

  // Connect to signaling server
  const connectToSignalingServer = () => {
    try {
      setIsConnecting(true);
      setConnectionStatus('Connecting to media server...');

      // Create socket connection
      const socket = io(mediaApiUrlRef.current, {
        transports: ['websocket'],
        reconnection: true,
        reconnectionAttempts: 5,
        reconnectionDelay: 1000,
        reconnectionDelayMax: 5000,
        timeout: 20000
      });

      socketRef.current = socket;

      // Socket event handlers
      socket.on('connect', () => {
        console.log('✅ Connected to mediasoup server', {
          socketId: socket.id
        });
        setConnectionStatus('Connected to server. Joining room...');
        joinRoom();
      });

      socket.on('connect_error', (err: any) => {
        console.error('❌ Socket connection error:', err);
        setConnectionStatus(`Connection error: ${err.message}`);
        if (reconnectAttempts < maxReconnectAttempts) {
          attemptReconnect();
        } else {
          setError('Failed to connect to media server. Please try again later.');
          setIsConnecting(false);
        }
      });

      socket.on('disconnect', (reason: string) => {
        console.warn('⚠️ Socket disconnected:', reason);
        setConnectionStatus(`Disconnected: ${reason}`);
        if (reason === 'io server disconnect' || reason === 'transport close') {
          // Server disconnected us, try to reconnect
          if (reconnectAttempts < maxReconnectAttempts) {
            attemptReconnect();
          } else {
            setError('Connection to media server lost. Please try again later.');
            setIsConnecting(false);
          }
        }
      });

      socket.on('error', (err: any) => {
        console.error('❌ Socket error:', err);
        setConnectionStatus(`Error: ${err.message}`);
      });

      // Mediasoup specific events
      socket.on('routerRtpCapabilities', async (routerRtpCapabilities: any) => {
        console.log('📡 Received router RTP capabilities', {
          codecsCount: routerRtpCapabilities.codecs.length,
          headerExtensionsCount: routerRtpCapabilities.headerExtensions.length
        });
        
        try {
          await loadDevice(routerRtpCapabilities);
        } catch (err: any) {
          console.error('❌ Error loading device:', err);
          setError(`Failed to initialize media device: ${err.message}`);
          setIsConnecting(false);
        }
      });

      socket.on('webRtcTransportCreated', async (transportInfo: any) => {
        console.log('🚛 Transport created:', transportInfo.direction, {
          transportId: transportInfo.id,
          iceParametersFragment: transportInfo.iceParameters.usernameFragment,
          iceCandidatesCount: transportInfo.iceCandidates.length,
          dtlsRole: transportInfo.dtlsParameters.role
        });
        
        try {
          await setupTransport(transportInfo);
        } catch (err: any) {
          console.error('❌ Error setting up transport:', err);
          setConnectionStatus(`Transport setup error: ${err.message}`);
        }
      });

      socket.on('transportConnected', async (data: any) => {
        console.log('✅ Transport connected confirmation', {
          transportId: data.transportId
        });
        
        if (data.transportId === producerTransportRef.current?.id) {
          setConnectionStatus('Transport connected. Getting media...');
          await getLocalMedia();
        }
      });

      socket.on('produced', (data: any) => {
        console.log('✅ Producer created confirmation', {
          producerId: data.id
        });
      });

      socket.on('consumed', async (data: any) => {
        console.log('✅ Consumer created', {
          consumerId: data.id,
          producerId: data.producerId,
          kind: data.kind
        });
        
        try {
          await setupConsumer(data);
        } catch (err: any) {
          console.error('❌ Error setting up consumer:', err);
        }
      });

      socket.on('consumerClosed', (data: any) => {
        console.log('🛑 Consumer closed', {
          consumerId: data.consumerId
        });
        
        removeConsumer(data.consumerId);
      });

      socket.on('newProducer', async (data: any) => {
        console.log('🎬 New producer available', {
          producerId: data.producerId,
          kind: data.kind
        });
        
        await consumeProducer(data);
      });

      socket.on('peerJoined', (data: any) => {
        console.log('👤 Peer joined', {
          peerId: data.peerId,
          displayName: data.displayName
        });
        
        setPeers(prev => ({
          ...prev,
          [data.peerId]: {
            id: data.peerId,
            displayName: data.displayName,
            consumers: {}
          }
        }));
        
        setParticipantCount(prev => prev + 1);
      });

      socket.on('peerLeft', (data: any) => {
        console.log('👋 Peer left', {
          peerId: data.peerId
        });
        
        setPeers(prev => {
          const newPeers = { ...prev };
          delete newPeers[data.peerId];
          return newPeers;
        });
        
        setParticipantCount(prev => Math.max(1, prev - 1));
      });

      socket.on('existingPeers', (existingPeers: any[]) => {
        console.log('👥 Existing peers in room', {
          count: existingPeers.length,
          peers: existingPeers.map(p => p.id)
        });
        
        const peersMap: Record<string, any> = {};
        existingPeers.forEach(peer => {
          peersMap[peer.id] = {
            id: peer.id,
            displayName: peer.displayName,
            consumers: {}
          };
        });
        
        setPeers(peersMap);
        setParticipantCount(existingPeers.length + 1); // +1 for self
      });

      socket.on('existingProducers', async (producers: any[]) => {
        console.log('🎬 Existing producers in room', {
          count: producers.length
        });
        
        for (const producer of producers) {
          await consumeProducer(producer);
        }
      });

    } catch (err: any) {
      console.error('❌ Error connecting to signaling server:', err);
      setError(`Failed to connect to media server: ${err.message}`);
      setIsConnecting(false);
    }
  };

  // Join room
  const joinRoom = () => {
    if (!socketRef.current) return;
    
    setConnectionStatus('Joining room...');
    socketRef.current.emit('join-room', {
      roomId: roomName,
      displayName: displayName
    });
  };

  // Load mediasoup device
  const loadDevice = async (routerRtpCapabilities: any) => {
    try {
      const device = new mediasoupClient.Device();
      
      await device.load({ routerRtpCapabilities });
      
      deviceRef.current = device;
      
      console.log('✅ Device loaded successfully', {
        canProduce: device.canProduce('video'),
        rtpCapabilities: device.rtpCapabilities
      });
      
      setConnectionStatus('Device loaded. Creating transports...');
      
      // Create send transport
      socketRef.current.emit('createWebRtcTransport', { direction: 'send' });
      
      // Create receive transport
      socketRef.current.emit('createWebRtcTransport', { direction: 'recv' });
      
    } catch (err: any) {
      console.error('❌ Error loading device:', err);
      setError(`Failed to load media device: ${err.message}`);
      setIsConnecting(false);
    }
  };

  // Setup transport
  const setupTransport = async (transportInfo: any) => {
    try {
      const { id, iceParameters, iceCandidates, dtlsParameters, direction } = transportInfo;
      
      if (direction === 'send') {
        // Create send transport
        const sendTransport = deviceRef.current.createSendTransport({
          id,
          iceParameters,
          iceCandidates,
          dtlsParameters,
          iceServers: [
            { urls: 'stun:stun.l.google.com:19302' },
            { urls: 'stun:stun1.l.google.com:19302' }
          ],
          proprietaryConstraints: {
            optional: [{ googDscp: true }]
          }
        });
        
        producerTransportRef.current = sendTransport;
        
        // Set up send transport event handlers
        sendTransport.on('connect', async ({ dtlsParameters }: any, callback: any, errback: any) => {
          try {
            console.log('🔗 Send transport connect event', {
              transportId: sendTransport.id,
              dtlsRole: dtlsParameters.role
            });
            
            socketRef.current.emit('connectTransport', {
              transportId: sendTransport.id,
              dtlsParameters
            });
            
            // Wait for transportConnected event before calling callback
            const onTransportConnected = (data: any) => {
              if (data.transportId === sendTransport.id) {
                socketRef.current.off('transportConnected', onTransportConnected);
                callback();
              }
            };
            
            socketRef.current.on('transportConnected', onTransportConnected);
            
          } catch (err) {
            console.error('❌ Error in send transport connect:', err);
            errback(err);
          }
        });
        
        sendTransport.on('produce', async ({ kind, rtpParameters, appData }: any, callback: any, errback: any) => {
          try {
            console.log('🎬 Send transport produce event', {
              transportId: sendTransport.id,
              kind,
              rtpParametersCount: rtpParameters.encodings?.length
            });
            
            socketRef.current.emit('produce', {
              transportId: sendTransport.id,
              kind,
              rtpParameters,
              appData
            });
            
            // Wait for produced event before calling callback
            const onProduced = (data: any) => {
              callback({ id: data.id });
              socketRef.current.off('produced', onProduced);
            };
            
            socketRef.current.on('produced', onProduced);
            
          } catch (err) {
            console.error('❌ Error in send transport produce:', err);
            errback(err);
          }
        });
        
        sendTransport.on('connectionstatechange', (state: string) => {
          console.log('📤 Send transport connection state:', state);
          setLastIceState(state);
          
          if (state === 'failed' || state === 'disconnected') {
            console.error('📤 Send transport connection state:', state);
            setDebugInfo(prev => ({
              ...prev,
              connection: {
                ...prev.connection,
                timestamp: new Date().toISOString()
              }
            }));
            
            // Try to restart ICE
            if (sendTransport.iceGatheringState !== 'complete') {
              try {
                sendTransport.restartIce();
                console.log('🧊 Restarting ICE for send transport');
              } catch (err) {
                console.error('❌ Error restarting ICE:', err);
              }
            }
          }
        });
        
      } else if (direction === 'recv') {
        // Create receive transport
        const recvTransport = deviceRef.current.createRecvTransport({
          id,
          iceParameters,
          iceCandidates,
          dtlsParameters,
          iceServers: [
            { urls: 'stun:stun.l.google.com:19302' },
            { urls: 'stun:stun1.l.google.com:19302' }
          ]
        });
        
        consumerTransportRef.current = recvTransport;
        
        // Set up receive transport event handlers
        recvTransport.on('connect', async ({ dtlsParameters }: any, callback: any, errback: any) => {
          try {
            console.log('🔗 Receive transport connect event', {
              transportId: recvTransport.id,
              dtlsRole: dtlsParameters.role
            });
            
            socketRef.current.emit('connectTransport', {
              transportId: recvTransport.id,
              dtlsParameters
            });
            
            // Wait for transportConnected event before calling callback
            const onTransportConnected = (data: any) => {
              if (data.transportId === recvTransport.id) {
                socketRef.current.off('transportConnected', onTransportConnected);
                callback();
              }
            };
            
            socketRef.current.on('transportConnected', onTransportConnected);
            
          } catch (err) {
            console.error('❌ Error in receive transport connect:', err);
            errback(err);
          }
        });
        
        recvTransport.on('connectionstatechange', (state: string) => {
          console.log('📥 Receive transport connection state:', state);
          setLastDtlsState(state);
          
          if (state === 'failed' || state === 'disconnected') {
            console.error('📥 Receive transport connection state:', state);
            
            // Try to restart ICE
            if (recvTransport.iceGatheringState !== 'complete') {
              try {
                recvTransport.restartIce();
                console.log('🧊 Restarting ICE for receive transport');
              } catch (err) {
                console.error('❌ Error restarting ICE:', err);
              }
            }
          }
        });
      }
      
    } catch (err: any) {
      console.error('❌ Error setting up transport:', err);
      setError(`Failed to set up media transport: ${err.message}`);
      setIsConnecting(false);
    }
  };

  // Get local media
  const getLocalMedia = async () => {
    try {
      setConnectionStatus('Getting media devices...');
      
      console.log('🎥 Getting user media');
      
      // Define constraints with fallbacks
      const constraints = {
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
          sampleRate: 48000
        },
        video: {
          width: { ideal: 1280, min: 640 },
          height: { ideal: 720, min: 360 },
          frameRate: { ideal: 30, min: 15 }
        }
      };
      
      console.log('🎥 Requesting media with constraints', constraints);
      
      // Get user media
      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      
      console.log('✅ Got user media stream', {
        streamId: stream.id,
        tracks: stream.getTracks().map(t => ({
          id: t.id,
          kind: t.kind,
          label: t.label
        }))
      });
      
      // Save stream reference
      localStreamRef.current = stream;
      
      // Display local video
      if (localVideoRef.current) {
        localVideoRef.current.srcObject = stream;
        localVideoRef.current.muted = true; // Mute local video to prevent echo
      }
      
      // Produce audio track
      const audioTrack = stream.getAudioTracks()[0];
      if (audioTrack) {
        console.log('🎵 Producing audio track', {
          trackId: audioTrack.id,
          settings: audioTrack.getSettings(),
          constraints: audioTrack.getConstraints()
        });
        
        await produceTrack(audioTrack);
      }
      
      // Produce video track
      const videoTrack = stream.getVideoTracks()[0];
      if (videoTrack) {
        console.log('📹 Producing video track', {
          trackId: videoTrack.id,
          settings: videoTrack.getSettings(),
          constraints: videoTrack.getConstraints()
        });
        
        await produceTrack(videoTrack);
      }
      
      setConnectionStatus('');
      setIsConnected(true);
      setIsConnecting(false);
      
      console.log('🎉 Successfully connected and producing media');
      
      // Get existing producers
      socketRef.current.emit('getProducers');
      
    } catch (err: any) {
      console.error('❌ Error getting local media:', err);
      
      // Try fallback with just audio if video fails
      if (err.name === 'NotFoundError' || err.name === 'NotReadableError' || err.name === 'OverconstrainedError') {
        try {
          console.log('⚠️ Video failed, trying audio only');
          const audioStream = await navigator.mediaDevices.getUserMedia({ audio: true });
          
          // Save stream reference
          localStreamRef.current = audioStream;
          
          // Produce audio track
          const audioTrack = audioStream.getAudioTracks()[0];
          if (audioTrack) {
            await produceTrack(audioTrack);
          }
          
          setConnectionStatus('Connected with audio only (no video available)');
          setIsConnected(true);
          setIsConnecting(false);
          setIsVideoOff(true);
          
          // Get existing producers
          socketRef.current.emit('getProducers');
          
        } catch (audioErr: any) {
          console.error('❌ Error getting audio:', audioErr);
          setError(`Failed to access media devices: ${audioErr.message}`);
          setIsConnecting(false);
        }
      } else {
        setError(`Failed to access media devices: ${err.message}`);
        setIsConnecting(false);
      }
    }
  };

  // Produce track
  const produceTrack = async (track: MediaStreamTrack) => {
    if (!producerTransportRef.current) {
      console.error('❌ Producer transport not created yet');
      return;
    }
    
    try {
      console.log('🎬 Producing media', {
        kind: track.kind,
        codecOptions: undefined,
        rtpParameters: {
          codecs: 2,
          encodings: 1
        }
      });
      
      const producer = await producerTransportRef.current.produce({ track });
      
      producersRef.current[producer.id] = producer;
      
      console.log('✅ Media produced successfully', {
        producerId: producer.id,
        kind: track.kind
      });
      
      // Handle producer events
      producer.on('transportclose', () => {
        console.log('🛑 Producer transport closed', {
          producerId: producer.id
        });
        producer.close();
        delete producersRef.current[producer.id];
      });
      
      producer.on('trackended', () => {
        console.log('🛑 Producer track ended', {
          producerId: producer.id
        });
        producer.close();
        delete producersRef.current[producer.id];
        
        // Notify server
        socketRef.current.emit('producerClosed', {
          producerId: producer.id
        });
      });
      
      return producer;
      
    } catch (err: any) {
      console.error('❌ Error producing track:', err);
      throw err;
    }
  };

  // Consume producer
  const consumeProducer = async (producerInfo: any) => {
    if (!deviceRef.current || !consumerTransportRef.current) {
      console.error('❌ Device or consumer transport not ready');
      return;
    }
    
    const { producerId, peerId, kind } = producerInfo;
    
    try {
      // Check if we can consume this producer
      if (!deviceRef.current.canConsume({
        producerId,
        rtpCapabilities: deviceRef.current.rtpCapabilities
      })) {
        console.warn('⚠️ Cannot consume producer', {
          producerId,
          kind
        });
        return;
      }
      
      // Request to consume
      socketRef.current.emit('consume', {
        transportId: consumerTransportRef.current.id,
        producerId,
        rtpCapabilities: deviceRef.current.rtpCapabilities
      });
      
    } catch (err: any) {
      console.error('❌ Error consuming producer:', err);
    }
  };

  // Setup consumer
  const setupConsumer = async (consumerInfo: any) => {
    if (!consumerTransportRef.current) {
      console.error('❌ Consumer transport not ready');
      return;
    }
    
    const { id, producerId, kind, rtpParameters, peerId } = consumerInfo;
    
    try {
      // Consume the track
      const consumer = await consumerTransportRef.current.consume({
        id,
        producerId,
        kind,
        rtpParameters
      });
      
      consumersRef.current[id] = consumer;
      
      // Resume the consumer
      socketRef.current.emit('resumeConsumer', { consumerId: id });
      
      // Update peers state
      setPeers(prev => {
        const newPeers = { ...prev };
        if (!newPeers[peerId]) {
          newPeers[peerId] = {
            id: peerId,
            displayName: 'Participant',
            consumers: {}
          };
        }
        
        newPeers[peerId].consumers[id] = {
          id,
          kind,
          track: consumer.track
        };
        
        return newPeers;
      });
      
      // Handle consumer events
      consumer.on('transportclose', () => {
        console.log('🛑 Consumer transport closed', {
          consumerId: consumer.id
        });
        removeConsumer(consumer.id);
      });
      
      consumer.on('trackended', () => {
        console.log('🛑 Consumer track ended', {
          consumerId: consumer.id
        });
        removeConsumer(consumer.id);
      });
      
      // If it's a video consumer, attach it to a video element
      if (kind === 'video') {
        const videoElement = document.getElementById(`video-${peerId}`) as HTMLVideoElement;
        if (videoElement) {
          const stream = new MediaStream([consumer.track]);
          videoElement.srcObject = stream;
          videoElement.play().catch(err => console.error('❌ Error playing video:', err));
        }
      }
      
      // If it's an audio consumer, attach it to an audio element
      if (kind === 'audio') {
        const audioElement = document.getElementById(`audio-${peerId}`) as HTMLAudioElement;
        if (audioElement) {
          const stream = new MediaStream([consumer.track]);
          audioElement.srcObject = stream;
          audioElement.play().catch(err => console.error('❌ Error playing audio:', err));
        }
      }
      
    } catch (err: any) {
      console.error('❌ Error setting up consumer:', err);
    }
  };

  // Remove consumer
  const removeConsumer = (consumerId: string) => {
    const consumer = consumersRef.current[consumerId];
    if (!consumer) return;
    
    consumer.close();
    delete consumersRef.current[consumerId];
    
    // Update peers state
    setPeers(prev => {
      const newPeers = { ...prev };
      
      // Find which peer has this consumer
      for (const peerId in newPeers) {
        if (newPeers[peerId].consumers[consumerId]) {
          delete newPeers[peerId].consumers[consumerId];
          break;
        }
      }
      
      return newPeers;
    });
  };

  // Toggle mute
  const toggleMute = () => {
    if (!localStreamRef.current) return;
    
    const audioTracks = localStreamRef.current.getAudioTracks();
    if (audioTracks.length === 0) return;
    
    const newMuteState = !isMuted;
    
    // Update track enabled state
    audioTracks.forEach(track => {
      track.enabled = !newMuteState;
    });
    
    // Find audio producer and pause/resume it
    Object.values(producersRef.current).forEach(producer => {
      if (producer.kind === 'audio') {
        if (newMuteState) {
          producer.pause();
        } else {
          producer.resume();
        }
      }
    });
    
    setIsMuted(newMuteState);
  };

  // Toggle video
  const toggleVideo = () => {
    if (!localStreamRef.current) return;
    
    const videoTracks = localStreamRef.current.getVideoTracks();
    if (videoTracks.length === 0) return;
    
    const newVideoState = !isVideoOff;
    
    // Update track enabled state
    videoTracks.forEach(track => {
      track.enabled = !newVideoState;
    });
    
    // Find video producer and pause/resume it
    Object.values(producersRef.current).forEach(producer => {
      if (producer.kind === 'video') {
        if (newVideoState) {
          producer.pause();
        } else {
          producer.resume();
        }
      }
    });
    
    setIsVideoOff(newVideoState);
  };

  // Leave meeting
  const handleLeave = () => {
    cleanupMediasoup();
    onLeave();
  };

  // Cleanup mediasoup
  const cleanupMediasoup = () => {
    // Close all consumers
    Object.values(consumersRef.current).forEach(consumer => {
      consumer.close();
    });
    consumersRef.current = {};
    
    // Close all producers
    Object.values(producersRef.current).forEach(producer => {
      producer.close();
    });
    producersRef.current = {};
    
    // Close transports
    if (producerTransportRef.current) {
      producerTransportRef.current.close();
      producerTransportRef.current = null;
    }
    
    if (consumerTransportRef.current) {
      consumerTransportRef.current.close();
      consumerTransportRef.current = null;
    }
    
    // Stop local media
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach(track => {
        track.stop();
      });
      localStreamRef.current = null;
    }
    
    // Disconnect socket
    if (socketRef.current) {
      socketRef.current.disconnect();
      socketRef.current = null;
    }
    
    // Reset device
    deviceRef.current = null;
    
    // Reset state
    setIsConnected(false);
    setIsConnecting(false);
    setPeers({});
    setParticipantCount(1);
  };

  // If there's an error, show error screen
  if (error) {
    return (
      <div className="min-h-screen bg-primary flex items-center justify-center">
        <div className="glass-panel rounded-2xl p-8 max-w-md mx-auto text-center">
          <AlertCircle className="w-16 h-16 text-red-500 mx-auto mb-6" />
          <h3 className="text-xl font-bold text-primary mb-4">Connection Error</h3>
          <p className="text-secondary mb-6">{error}</p>
          <Button
            onClick={handleLeave}
            variant="premium"
            className="px-6 py-3 rounded-lg"
          >
            Go Back
          </Button>
        </div>
      </div>
    );
  }

  // If connecting, show loading screen
  if (isConnecting) {
    return (
      <div className="min-h-screen bg-primary flex items-center justify-center">
        <div className="glass-panel rounded-2xl p-8 max-w-md mx-auto text-center">
          <div className="animate-spin w-12 h-12 border-4 border-gold-text border-t-transparent rounded-full mx-auto mb-6"></div>
          <h3 className="text-xl font-bold text-primary mb-4">Joining Meeting</h3>
          <p className="text-secondary mb-2">{connectionStatus}</p>
          <p className="text-xs text-secondary">Room: {roomName}</p>
          <Button
            onClick={handleLeave}
            variant="secondary"
            className="mt-6"
          >
            Cancel
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-primary flex flex-col">
      {/* Main Video Area */}
      <div className="flex-1 p-4 relative">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 h-full">
          {/* Local Video */}
          <div className="relative glass-panel rounded-2xl overflow-hidden aspect-video">
            <video
              ref={localVideoRef}
              autoPlay
              playsInline
              muted
              className={`w-full h-full object-cover ${isVideoOff ? 'invisible' : ''}`}
            />
            
            {isVideoOff && (
              <div className="absolute inset-0 flex items-center justify-center bg-gray-800">
                <div className="w-20 h-20 rounded-full bg-gradient-gold-silver flex items-center justify-center">
                  <span className="text-2xl font-bold text-white">
                    {displayName.charAt(0).toUpperCase()}
                  </span>
                </div>
              </div>
            )}
            
            <div className="absolute bottom-4 left-4 glass-panel px-4 py-2 rounded-lg">
              <span className="text-primary font-medium flex items-center">
                <span className="w-2 h-2 bg-green-500 rounded-full mr-2"></span>
                {displayName} (You)
              </span>
            </div>
            
            {isMuted && (
              <div className="absolute top-4 right-4 bg-red-500 p-2 rounded-full">
                <MicOff className="w-4 h-4 text-white" />
              </div>
            )}
          </div>

          {/* Remote Participants */}
          {Object.entries(peers).map(([peerId, peer]: [string, any]) => (
            <div key={peerId} className="relative glass-panel rounded-2xl overflow-hidden aspect-video">
              <video
                id={`video-${peerId}`}
                autoPlay
                playsInline
                className="w-full h-full object-cover"
              />
              <audio id={`audio-${peerId}`} autoPlay />
              
              <div className="absolute bottom-4 left-4 glass-panel px-4 py-2 rounded-lg">
                <span className="text-primary font-medium flex items-center">
                  <span className="w-2 h-2 bg-green-500 rounded-full mr-2"></span>
                  {peer.displayName || 'Participant'}
                </span>
              </div>
            </div>
          ))}

          {/* Empty slots for visual balance */}
          {Array.from({ length: Math.max(0, 3 - Object.keys(peers).length - 1) }).map((_, index) => (
            <div key={`empty-${index}`} className="glass-panel rounded-2xl overflow-hidden aspect-video bg-opacity-30 flex items-center justify-center">
              <Users className="w-12 h-12 text-secondary opacity-30" />
            </div>
          ))}
        </div>
      </div>

      {/* Controls */}
      <div className="glass-panel border-t silver-border p-4">
        <div className="max-w-6xl mx-auto flex justify-between items-center">
          <div className="flex items-center space-x-2">
            <Button
              onClick={() => setShowParticipants(!showParticipants)}
              variant="ghost"
              size="sm"
              className="p-2"
            >
              <Users className="w-5 h-5 text-primary" />
              <span className="ml-1">{participantCount}</span>
            </Button>
            
            <Button
              onClick={() => setShowSettings(!showSettings)}
              variant="ghost"
              size="sm"
              className="p-2"
            >
              <Settings className="w-5 h-5 text-primary" />
            </Button>
          </div>
          
          <div className="flex items-center space-x-4">
            <button
              onClick={toggleMute}
              className={`glass-panel p-4 rounded-full glass-panel-hover transition-all ${
                isMuted ? 'bg-red-500/20 border-red-500/50' : ''
              }`}
            >
              {isMuted ? (
                <MicOff className="w-6 h-6 text-red-400" />
              ) : (
                <Mic className="w-6 h-6 text-primary" />
              )}
            </button>

            <button
              onClick={toggleVideo}
              className={`glass-panel p-4 rounded-full glass-panel-hover transition-all ${
                isVideoOff ? 'bg-red-500/20 border-red-500/50' : ''
              }`}
            >
              {isVideoOff ? (
                <VideoOff className="w-6 h-6 text-red-400" />
              ) : (
                <Video className="w-6 h-6 text-primary" />
              )}
            </button>

            <button
              onClick={handleLeave}
              className="glass-panel p-4 rounded-full glass-panel-hover bg-red-500/20 border-red-500/50 hover:bg-red-500/30"
            >
              <PhoneOff className="w-6 h-6 text-red-400" />
            </button>
          </div>
          
          <div className="flex items-center space-x-2">
            <Button
              variant="ghost"
              size="sm"
              className="p-2"
            >
              <Share2 className="w-5 h-5 text-primary" />
            </Button>
            
            <Button
              variant="ghost"
              size="sm"
              className="p-2"
            >
              <ScreenShare className="w-5 h-5 text-primary" />
            </Button>
          </div>
        </div>
      </div>

      {/* Settings Modal */}
      {showSettings && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="w-full max-w-md"
          >
            <div className="glass-panel rounded-lg p-6">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-xl font-bold gradient-gold-silver">Settings</h3>
                <button
                  onClick={() => setShowSettings(false)}
                  className="text-secondary hover:text-primary"
                >
                  ×
                </button>
              </div>
              
              <div className="space-y-4">
                <div>
                  <h4 className="font-medium text-primary mb-2">Audio</h4>
                  <select
                    className="w-full glass-panel rounded-lg px-4 py-2 text-primary"
                    onChange={(e) => {
                      // Handle audio device change
                    }}
                  >
                    <option value="default">Default Microphone</option>
                  </select>
                </div>
                
                <div>
                  <h4 className="font-medium text-primary mb-2">Video</h4>
                  <select
                    className="w-full glass-panel rounded-lg px-4 py-2 text-primary"
                    onChange={(e) => {
                      // Handle video device change
                    }}
                  >
                    <option value="default">Default Camera</option>
                  </select>
                </div>
                
                <div>
                  <h4 className="font-medium text-primary mb-2">Connection Status</h4>
                  <div className="glass-panel rounded-lg p-3">
                    <div className="flex items-center space-x-2 mb-2">
                      <div className={`w-3 h-3 rounded-full ${isConnected ? 'bg-green-500' : 'bg-red-500'}`}></div>
                      <span className="text-sm text-primary">{isConnected ? 'Connected' : 'Disconnected'}</span>
                    </div>
                    <div className="text-xs text-secondary">
                      <p>Room: {roomName}</p>
                      <p>Transport: {lastIceState || 'unknown'}</p>
                      <p>Network: {navigator.onLine ? 'Online' : 'Offline'}</p>
                    </div>
                  </div>
                </div>
                
                <div className="flex justify-end">
                  <Button
                    onClick={() => setShowSettings(false)}
                    variant="secondary"
                  >
                    Close
                  </Button>
                </div>
              </div>
            </div>
          </motion.div>
        </div>
      )}

      {/* Participants Modal */}
      {showParticipants && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="w-full max-w-md"
          >
            <div className="glass-panel rounded-lg p-6">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-xl font-bold gradient-gold-silver">Participants ({participantCount})</h3>
                <button
                  onClick={() => setShowParticipants(false)}
                  className="text-secondary hover:text-primary"
                >
                  ×
                </button>
              </div>
              
              <div className="space-y-2 max-h-80 overflow-y-auto">
                {/* Local participant */}
                <div className="glass-panel rounded-lg p-3 flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <div className="w-8 h-8 rounded-full bg-gradient-gold-silver flex items-center justify-center">
                      <span className="text-white font-bold">{displayName.charAt(0).toUpperCase()}</span>
                    </div>
                    <div>
                      <p className="text-primary font-medium">{displayName} (You)</p>
                      <p className="text-xs text-secondary">Host</p>
                    </div>
                  </div>
                  <div className="flex items-center space-x-1">
                    {isMuted && <MicOff className="w-4 h-4 text-red-400" />}
                    {isVideoOff && <VideoOff className="w-4 h-4 text-red-400" />}
                  </div>
                </div>
                
                {/* Remote participants */}
                {Object.entries(peers).map(([peerId, peer]: [string, any]) => (
                  <div key={peerId} className="glass-panel rounded-lg p-3 flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                      <div className="w-8 h-8 rounded-full bg-gradient-to-r from-blue-500 to-purple-500 flex items-center justify-center">
                        <span className="text-white font-bold">{(peer.displayName || 'User').charAt(0).toUpperCase()}</span>
                      </div>
                      <div>
                        <p className="text-primary font-medium">{peer.displayName || 'Participant'}</p>
                        <p className="text-xs text-secondary">Participant</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
              
              <div className="flex justify-end mt-4">
                <Button
                  onClick={() => setShowParticipants(false)}
                  variant="secondary"
                >
                  Close
                </Button>
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
};

export default MediasoupMeeting;