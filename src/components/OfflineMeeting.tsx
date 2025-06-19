import React, { useEffect, useRef, useState, useCallback } from 'react';
import { ArrowLeft, Copy, Users, Mic, MicOff, Video, VideoOff, PhoneOff, Monitor, MessageSquare, Send } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { io, Socket } from 'socket.io-client';
import ThemeToggle from './ThemeToggle';
import Button from './ui/Button';

interface OfflineMeetingProps {
  meetingId: string;
  displayName: string;
  onLeave?: () => void;
}

interface Participant {
  id: string;
  name: string;
  stream?: MediaStream;
  isLocal?: boolean;
}

interface ChatMessage {
  id: string;
  sender: string;
  message: string;
  timestamp: Date;
}

const OfflineMeeting: React.FC<OfflineMeetingProps> = ({ meetingId, displayName, onLeave }) => {
  const navigate = useNavigate();
  
  // Media state
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [isMuted, setIsMuted] = useState(false);
  const [isVideoOff, setIsVideoOff] = useState(false);
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  
  // UI state
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showChat, setShowChat] = useState(false);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [connectionStatus, setConnectionStatus] = useState<'connecting' | 'connected' | 'disconnected'>('connecting');
  
  // Refs
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideosRef = useRef<{ [id: string]: HTMLVideoElement }>({});
  const chatEndRef = useRef<HTMLDivElement>(null);
  const socketRef = useRef<Socket | null>(null);
  
  // WebRTC state
  const peerConnections = useRef<{ [id: string]: RTCPeerConnection }>({});
  const dataChannels = useRef<{ [id: string]: RTCDataChannel }>({});

  // ICE servers configuration
  const iceServers = [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    { urls: 'stun:stun2.l.google.com:19302' },
  ];

  // Initialize socket connection and media
  useEffect(() => {
    initializeSocket();
    initializeMedia();
    
    return () => {
      cleanup();
    };
  }, [meetingId, displayName]);

  // Auto-scroll chat
  useEffect(() => {
    if (showChat && chatEndRef.current) {
      chatEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [chatMessages, showChat]);

  const initializeSocket = () => {
    // Connect to WebRTC signaling server
    socketRef.current = io('http://localhost:5001', {
      transports: ['websocket', 'polling']
    });

    const socket = socketRef.current;

    socket.on('connect', () => {
      console.log('Connected to signaling server');
      setConnectionStatus('connected');
      
      // Join the meeting room
      socket.emit('join-room', { roomId: meetingId, displayName });
    });

    socket.on('disconnect', () => {
      console.log('Disconnected from signaling server');
      setConnectionStatus('disconnected');
    });

    socket.on('existing-participants', (existingParticipants: any[]) => {
      console.log('Existing participants:', existingParticipants);
      
      // Create peer connections for existing participants
      existingParticipants.forEach(participant => {
        createPeerConnection(participant.id, participant.displayName, true);
      });
    });

    socket.on('participant-joined', (participant: any) => {
      console.log('New participant joined:', participant);
      addChatMessage('System', `${participant.displayName} joined the meeting`);
      
      // Create peer connection for new participant
      createPeerConnection(participant.id, participant.displayName, false);
    });

    socket.on('participant-left', (data: any) => {
      console.log('Participant left:', data);
      addChatMessage('System', `${data.displayName} left the meeting`);
      
      // Remove participant and clean up connection
      removeParticipant(data.participantId);
    });

    socket.on('webrtc-offer', async (data: any) => {
      console.log('Received offer from:', data.from);
      await handleOffer(data.from, data.offer, data.fromUser);
    });

    socket.on('webrtc-answer', async (data: any) => {
      console.log('Received answer from:', data.from);
      await handleAnswer(data.from, data.answer);
    });

    socket.on('webrtc-ice-candidate', async (data: any) => {
      console.log('Received ICE candidate from:', data.from);
      await handleIceCandidate(data.from, data.candidate);
    });

    socket.on('chat-message', (message: any) => {
      const chatMessage: ChatMessage = {
        id: message.id,
        sender: message.sender,
        message: message.message,
        timestamp: new Date(message.timestamp)
      };
      setChatMessages(prev => [...prev, chatMessage]);
    });

    socket.on('participant-media-change', (data: any) => {
      console.log('Participant media change:', data);
      // Handle remote participant media state changes
    });

    socket.on('connect_error', (error) => {
      console.error('Socket connection error:', error);
      setError('Failed to connect to meeting server. Please check if the signaling server is running.');
      setConnectionStatus('disconnected');
    });
  };

  const initializeMedia = async () => {
    try {
      setIsLoading(true);
      setError(null);

      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          width: { ideal: 1280, max: 1920 },
          height: { ideal: 720, max: 1080 },
          frameRate: { ideal: 30, max: 60 }
        },
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true
        }
      });

      setLocalStream(stream);
      
      if (localVideoRef.current) {
        localVideoRef.current.srcObject = stream;
      }

      // Add self as first participant
      const selfParticipant: Participant = {
        id: 'local',
        name: displayName,
        stream: stream,
        isLocal: true
      };
      setParticipants([selfParticipant]);

      // Add welcome message
      addChatMessage('System', `${displayName} joined the meeting`);
      
      setIsLoading(false);
    } catch (error) {
      console.error('Failed to get media:', error);
      setError('Failed to access camera/microphone. Please check permissions and ensure the signaling server is running.');
      setIsLoading(false);
    }
  };

  const createPeerConnection = async (participantId: string, participantName: string, isInitiator: boolean) => {
    try {
      const peerConnection = new RTCPeerConnection({ iceServers });
      peerConnections.current[participantId] = peerConnection;

      // Add local stream to peer connection
      if (localStream) {
        localStream.getTracks().forEach(track => {
          peerConnection.addTrack(track, localStream);
        });
      }

      // Handle remote stream
      peerConnection.ontrack = (event) => {
        console.log('Received remote track from:', participantId);
        const [remoteStream] = event.streams;
        
        // Add participant with remote stream
        setParticipants(prev => {
          const existing = prev.find(p => p.id === participantId);
          if (existing) {
            return prev.map(p => 
              p.id === participantId 
                ? { ...p, stream: remoteStream }
                : p
            );
          } else {
            return [...prev, {
              id: participantId,
              name: participantName,
              stream: remoteStream,
              isLocal: false
            }];
          }
        });

        // Attach to video element
        setTimeout(() => {
          const videoElement = document.getElementById(`remote-video-${participantId}`) as HTMLVideoElement;
          if (videoElement && remoteStream) {
            videoElement.srcObject = remoteStream;
          }
        }, 100);
      };

      // Handle ICE candidates
      peerConnection.onicecandidate = (event) => {
        if (event.candidate && socketRef.current) {
          socketRef.current.emit('webrtc-ice-candidate', {
            to: participantId,
            candidate: event.candidate
          });
        }
      };

      // Create data channel for chat
      if (isInitiator) {
        const dataChannel = peerConnection.createDataChannel('chat');
        dataChannels.current[participantId] = dataChannel;
        
        dataChannel.onopen = () => {
          console.log('Data channel opened with:', participantId);
        };
        
        dataChannel.onmessage = (event) => {
          const message = JSON.parse(event.data);
          addChatMessage(message.sender, message.message);
        };
      } else {
        peerConnection.ondatachannel = (event) => {
          const dataChannel = event.channel;
          dataChannels.current[participantId] = dataChannel;
          
          dataChannel.onmessage = (event) => {
            const message = JSON.parse(event.data);
            addChatMessage(message.sender, message.message);
          };
        };
      }

      // Create offer if initiator
      if (isInitiator) {
        const offer = await peerConnection.createOffer();
        await peerConnection.setLocalDescription(offer);
        
        if (socketRef.current) {
          socketRef.current.emit('webrtc-offer', {
            to: participantId,
            offer: offer
          });
        }
      }

      // Add participant to list if not already there
      setParticipants(prev => {
        const existing = prev.find(p => p.id === participantId);
        if (!existing) {
          return [...prev, {
            id: participantId,
            name: participantName,
            isLocal: false
          }];
        }
        return prev;
      });

    } catch (error) {
      console.error('Error creating peer connection:', error);
    }
  };

  const handleOffer = async (fromId: string, offer: RTCSessionDescriptionInit, fromUser: any) => {
    try {
      const peerConnection = peerConnections.current[fromId];
      if (!peerConnection) {
        await createPeerConnection(fromId, fromUser.displayName, false);
      }

      const pc = peerConnections.current[fromId];
      await pc.setRemoteDescription(offer);
      
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);
      
      if (socketRef.current) {
        socketRef.current.emit('webrtc-answer', {
          to: fromId,
          answer: answer
        });
      }
    } catch (error) {
      console.error('Error handling offer:', error);
    }
  };

  const handleAnswer = async (fromId: string, answer: RTCSessionDescriptionInit) => {
    try {
      const peerConnection = peerConnections.current[fromId];
      if (peerConnection) {
        await peerConnection.setRemoteDescription(answer);
      }
    } catch (error) {
      console.error('Error handling answer:', error);
    }
  };

  const handleIceCandidate = async (fromId: string, candidate: RTCIceCandidateInit) => {
    try {
      const peerConnection = peerConnections.current[fromId];
      if (peerConnection) {
        await peerConnection.addIceCandidate(candidate);
      }
    } catch (error) {
      console.error('Error handling ICE candidate:', error);
    }
  };

  const removeParticipant = (participantId: string) => {
    // Close peer connection
    if (peerConnections.current[participantId]) {
      peerConnections.current[participantId].close();
      delete peerConnections.current[participantId];
    }

    // Close data channel
    if (dataChannels.current[participantId]) {
      dataChannels.current[participantId].close();
      delete dataChannels.current[participantId];
    }

    // Remove from participants list
    setParticipants(prev => prev.filter(p => p.id !== participantId));
  };

  const cleanup = () => {
    // Stop local stream
    if (localStream) {
      localStream.getTracks().forEach(track => {
        track.stop();
      });
    }

    // Close all peer connections
    Object.values(peerConnections.current).forEach(pc => {
      pc.close();
    });
    
    // Close all data channels
    Object.values(dataChannels.current).forEach(dc => {
      dc.close();
    });

    // Disconnect socket
    if (socketRef.current) {
      socketRef.current.emit('leave-room');
      socketRef.current.disconnect();
    }
  };

  const handleLeave = () => {
    cleanup();
    if (onLeave) {
      onLeave();
    } else {
      navigate('/assistant');
    }
  };

  const handleBack = () => {
    addChatMessage('System', `${displayName} left the meeting`);
    handleLeave();
  };

  const copyMeetingLink = () => {
    const link = `${window.location.origin}/meeting/${meetingId}`;
    navigator.clipboard.writeText(link).then(() => {
      addChatMessage('System', 'Meeting link copied to clipboard');
    });
  };

  const toggleMute = () => {
    if (localStream) {
      const audioTrack = localStream.getAudioTracks()[0];
      if (audioTrack) {
        audioTrack.enabled = !audioTrack.enabled;
        setIsMuted(!audioTrack.enabled);
        
        addChatMessage('System', `${displayName} ${audioTrack.enabled ? 'unmuted' : 'muted'} their microphone`);
        
        // Notify other participants
        if (socketRef.current) {
          socketRef.current.emit('media-state-change', {
            audio: audioTrack.enabled
          });
        }
      }
    }
  };

  const toggleVideo = () => {
    if (localStream) {
      const videoTrack = localStream.getVideoTracks()[0];
      if (videoTrack) {
        videoTrack.enabled = !videoTrack.enabled;
        setIsVideoOff(!videoTrack.enabled);
        
        addChatMessage('System', `${displayName} ${videoTrack.enabled ? 'turned on' : 'turned off'} their camera`);
        
        // Notify other participants
        if (socketRef.current) {
          socketRef.current.emit('media-state-change', {
            video: videoTrack.enabled
          });
        }
      }
    }
  };

  const toggleScreenShare = async () => {
    try {
      if (!isScreenSharing) {
        // Start screen sharing
        const screenStream = await navigator.mediaDevices.getDisplayMedia({
          video: {
            width: { ideal: 1920, max: 1920 },
            height: { ideal: 1080, max: 1080 },
            frameRate: { ideal: 30, max: 60 }
          },
          audio: true
        });

        // Replace video track in all peer connections
        const videoTrack = screenStream.getVideoTracks()[0];
        
        Object.values(peerConnections.current).forEach(async (pc) => {
          const sender = pc.getSenders().find(s => 
            s.track && s.track.kind === 'video'
          );
          
          if (sender) {
            await sender.replaceTrack(videoTrack);
          }
        });
        
        // Update local video
        if (localVideoRef.current) {
          localVideoRef.current.srcObject = screenStream;
        }
        
        // Handle screen share end
        videoTrack.onended = () => {
          setIsScreenSharing(false);
          // Switch back to camera
          if (localStream) {
            const cameraTrack = localStream.getVideoTracks()[0];
            Object.values(peerConnections.current).forEach(async (pc) => {
              const sender = pc.getSenders().find(s => 
                s.track && s.track.kind === 'video'
              );
              
              if (sender && cameraTrack) {
                await sender.replaceTrack(cameraTrack);
              }
            });
            
            if (localVideoRef.current) {
              localVideoRef.current.srcObject = localStream;
            }
          }
          addChatMessage('System', `${displayName} stopped screen sharing`);
        };
        
        setIsScreenSharing(true);
        addChatMessage('System', `${displayName} started screen sharing`);
      } else {
        // Stop screen sharing - switch back to camera
        if (localStream) {
          const cameraTrack = localStream.getVideoTracks()[0];
          
          Object.values(peerConnections.current).forEach(async (pc) => {
            const sender = pc.getSenders().find(s => 
              s.track && s.track.kind === 'video'
            );
            
            if (sender && cameraTrack) {
              await sender.replaceTrack(cameraTrack);
            }
          });
          
          if (localVideoRef.current) {
            localVideoRef.current.srcObject = localStream;
          }
        }
        setIsScreenSharing(false);
        addChatMessage('System', `${displayName} stopped screen sharing`);
      }
    } catch (error) {
      console.error('Screen sharing error:', error);
      addChatMessage('System', 'Screen sharing failed - permission denied or not supported');
    }
  };

  const toggleChat = () => {
    setShowChat(!showChat);
  };

  const addChatMessage = (sender: string, message: string) => {
    const chatMessage: ChatMessage = {
      id: Date.now().toString(),
      sender,
      message,
      timestamp: new Date()
    };
    setChatMessages(prev => [...prev, chatMessage]);
  };

  const sendChatMessage = () => {
    if (newMessage.trim() && socketRef.current) {
      // Send via socket for system-wide chat
      socketRef.current.emit('chat-message', {
        message: newMessage.trim()
      });
      
      // Also send via data channels for P2P backup
      Object.values(dataChannels.current).forEach(dc => {
        if (dc.readyState === 'open') {
          dc.send(JSON.stringify({
            sender: displayName,
            message: newMessage.trim()
          }));
        }
      });
      
      setNewMessage('');
    }
  };

  const handleChatKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendChatMessage();
    }
  };

  const getConnectionStatusColor = () => {
    switch (connectionStatus) {
      case 'connected': return 'bg-green-500';
      case 'connecting': return 'bg-yellow-500';
      case 'disconnected': return 'bg-red-500';
      default: return 'bg-gray-500';
    }
  };

  const getConnectionStatusText = () => {
    switch (connectionStatus) {
      case 'connected': return 'Connected';
      case 'connecting': return 'Connecting...';
      case 'disconnected': return 'Disconnected';
      default: return 'Unknown';
    }
  };

  if (error) {
    return (
      <div className="min-h-screen bg-primary flex items-center justify-center">
        <div className="glass-panel p-8 rounded-xl text-center max-w-md">
          <h3 className="text-xl font-bold text-primary mb-4">Meeting Error</h3>
          <p className="text-secondary mb-6">{error}</p>
          <div className="space-y-3">
            <Button
              onClick={() => window.location.reload()}
              variant="premium"
              className="w-full"
            >
              Try Again
            </Button>
            <Button
              onClick={handleLeave}
              variant="secondary"
              className="w-full"
            >
              Go Back
            </Button>
          </div>
          <div className="mt-4 p-3 glass-panel rounded-lg">
            <p className="text-xs text-secondary">
              💡 Make sure the signaling server is running:
              <br />
              <code className="text-gold-text">cd server && npm run dev:webrtc</code>
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-primary flex flex-col">
      {/* Header */}
      <header className="glass-panel border-0 border-b silver-border">
        <div className="max-w-7xl mx-auto container-padding">
          <div className="flex justify-between items-center py-4">
            <div className="flex items-center space-x-4">
              <button
                onClick={handleBack}
                className="glass-panel p-2 rounded-full glass-panel-hover"
              >
                <ArrowLeft className="w-5 h-5 text-secondary" />
              </button>
              <div>
                <h1 className="text-lg font-bold gradient-gold-silver">
                  SimAlly Meeting
                </h1>
                <p className="text-sm text-secondary">
                  Room: {meetingId} • {participants.length} participant{participants.length !== 1 ? 's' : ''}
                </p>
              </div>
            </div>
            
            <div className="flex items-center space-x-3">
              {/* Quick Controls */}
              {!isLoading && (
                <div className="flex items-center space-x-2">
                  <button
                    onClick={toggleMute}
                    className={`glass-panel p-2 rounded-lg glass-panel-hover ${
                      isMuted ? 'bg-red-500/20 border-red-500/50' : ''
                    }`}
                    title={isMuted ? 'Unmute' : 'Mute'}
                  >
                    {isMuted ? (
                      <MicOff className="w-4 h-4 text-red-400" />
                    ) : (
                      <Mic className="w-4 h-4 text-secondary" />
                    )}
                  </button>
                  
                  <button
                    onClick={toggleVideo}
                    className={`glass-panel p-2 rounded-lg glass-panel-hover ${
                      isVideoOff ? 'bg-red-500/20 border-red-500/50' : ''
                    }`}
                    title={isVideoOff ? 'Turn on camera' : 'Turn off camera'}
                  >
                    {isVideoOff ? (
                      <VideoOff className="w-4 h-4 text-red-400" />
                    ) : (
                      <Video className="w-4 h-4 text-secondary" />
                    )}
                  </button>
                  
                  <button
                    onClick={toggleScreenShare}
                    className={`glass-panel p-2 rounded-lg glass-panel-hover ${
                      isScreenSharing ? 'bg-blue-500/20 border-blue-500/50' : ''
                    }`}
                    title={isScreenSharing ? 'Stop screen share' : 'Share screen'}
                  >
                    <Monitor className={`w-4 h-4 ${isScreenSharing ? 'text-blue-400' : 'text-secondary'}`} />
                  </button>
                  
                  <button
                    onClick={toggleChat}
                    className={`glass-panel p-2 rounded-lg glass-panel-hover ${
                      showChat ? 'bg-green-500/20 border-green-500/50' : ''
                    }`}
                    title="Toggle chat"
                  >
                    <MessageSquare className={`w-4 h-4 ${showChat ? 'text-green-400' : 'text-secondary'}`} />
                  </button>
                </div>
              )}

              <Button
                onClick={copyMeetingLink}
                variant="secondary"
                size="sm"
                className="flex items-center space-x-2"
              >
                <Copy className="w-4 h-4" />
                <span>Copy Link</span>
              </Button>
              
              <div className="flex items-center space-x-2">
                <div className={`w-2 h-2 rounded-full ${getConnectionStatusColor()}`} />
                <span className="text-xs text-secondary">{getConnectionStatusText()}</span>
              </div>
              
              <ThemeToggle />
            </div>
          </div>
        </div>
      </header>

      {/* Loading State */}
      {isLoading && (
        <div className="absolute inset-0 bg-primary/80 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="glass-panel p-8 rounded-xl text-center">
            <div className="animate-spin w-8 h-8 border-2 border-gold-text border-t-transparent rounded-full mx-auto mb-4"></div>
            <h3 className="text-xl font-bold text-primary mb-2">Setting up your camera...</h3>
            <p className="text-secondary">Connecting to meeting room</p>
          </div>
        </div>
      )}

      {/* Main Meeting Area */}
      <div className="flex-1 flex">
        {/* Video Grid */}
        <div className="flex-1 p-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 h-full">
            {/* Local Video */}
            <div className="relative glass-panel rounded-xl overflow-hidden aspect-video">
              <video
                ref={localVideoRef}
                autoPlay
                muted
                playsInline
                className="w-full h-full object-cover"
              />
              <div className="absolute bottom-4 left-4 glass-panel px-3 py-1 rounded-lg">
                <span className="text-primary text-sm font-medium">
                  {displayName} (You)
                  {isScreenSharing && ' - Screen Sharing'}
                </span>
              </div>
              {isMuted && (
                <div className="absolute top-4 right-4 bg-red-500 p-2 rounded-full">
                  <MicOff className="w-4 h-4 text-white" />
                </div>
              )}
              {isVideoOff && (
                <div className="absolute inset-0 bg-gray-800 flex items-center justify-center">
                  <div className="text-center">
                    <VideoOff className="w-12 h-12 text-gray-400 mx-auto mb-2" />
                    <p className="text-gray-400 text-sm">Camera Off</p>
                  </div>
                </div>
              )}
            </div>

            {/* Remote Participants */}
            {participants
              .filter(p => !p.isLocal)
              .map((participant) => (
                <div key={participant.id} className="relative glass-panel rounded-xl overflow-hidden aspect-video">
                  {participant.stream ? (
                    <video
                      id={`remote-video-${participant.id}`}
                      autoPlay
                      playsInline
                      className="w-full h-full object-cover"
                      ref={(el) => {
                        if (el && participant.stream) {
                          el.srcObject = participant.stream;
                        }
                      }}
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-purple-500/20 to-blue-500/20">
                      <div className="text-center">
                        <div className="w-16 h-16 rounded-full bg-gradient-gold-silver flex items-center justify-center mx-auto mb-3">
                          <span className="text-white text-xl font-bold">
                            {participant.name.charAt(0).toUpperCase()}
                          </span>
                        </div>
                        <p className="text-primary font-medium">{participant.name}</p>
                        <p className="text-xs text-secondary mt-1">Connecting...</p>
                      </div>
                    </div>
                  )}
                  <div className="absolute bottom-4 left-4 glass-panel px-3 py-1 rounded-lg">
                    <span className="text-primary text-sm font-medium">
                      {participant.name}
                    </span>
                  </div>
                </div>
              ))}

            {/* Empty slots */}
            {participants.length < 6 && (
              <div className="relative glass-panel rounded-xl overflow-hidden aspect-video border-2 border-dashed border-gray-500/30">
                <div className="w-full h-full flex items-center justify-center">
                  <div className="text-center">
                    <Users className="w-12 h-12 text-gray-500 mx-auto mb-3" />
                    <p className="text-gray-500 text-sm">Waiting for participants...</p>
                    <p className="text-xs text-gray-600 mt-1">Share the meeting link to invite others</p>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Chat Sidebar */}
        {showChat && (
          <div className="w-80 glass-panel border-l silver-border flex flex-col">
            <div className="p-4 border-b silver-border">
              <h3 className="font-semibold text-primary">Meeting Chat</h3>
            </div>
            
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {chatMessages.map((msg) => (
                <div key={msg.id} className={`${msg.sender === 'System' ? 'text-center' : ''}`}>
                  {msg.sender === 'System' ? (
                    <p className="text-xs text-secondary italic">{msg.message}</p>
                  ) : (
                    <div className={`glass-panel p-3 rounded-lg ${
                      msg.sender === displayName 
                        ? 'bg-blue-500/10 border-blue-500/30 ml-4' 
                        : 'bg-gray-500/10 border-gray-500/30 mr-4'
                    }`}>
                      <div className="flex justify-between items-start mb-1">
                        <span className="font-medium text-primary text-sm">{msg.sender}</span>
                        <span className="text-xs text-secondary">
                          {msg.timestamp.toLocaleTimeString()}
                        </span>
                      </div>
                      <p className="text-secondary text-sm">{msg.message}</p>
                    </div>
                  )}
                </div>
              ))}
              <div ref={chatEndRef} />
            </div>
            
            <div className="p-4 border-t silver-border">
              <div className="flex space-x-2">
                <input
                  type="text"
                  value={newMessage}
                  onChange={(e) => setNewMessage(e.target.value)}
                  onKeyPress={handleChatKeyPress}
                  placeholder="Type a message..."
                  className="flex-1 glass-panel rounded-lg px-3 py-2 text-primary placeholder-secondary focus:outline-none focus:ring-2 focus:ring-yellow-500"
                />
                <button
                  onClick={sendChatMessage}
                  disabled={!newMessage.trim()}
                  className="premium-button p-2 rounded-lg disabled:opacity-50"
                >
                  <Send className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Controls Bar */}
      <div className="glass-panel border-t silver-border p-4">
        <div className="max-w-7xl mx-auto flex justify-center items-center space-x-4">
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
            onClick={toggleScreenShare}
            className={`glass-panel p-4 rounded-full glass-panel-hover transition-all ${
              isScreenSharing ? 'bg-blue-500/20 border-blue-500/50' : ''
            }`}
          >
            <Monitor className={`w-6 h-6 ${isScreenSharing ? 'text-blue-400' : 'text-primary'}`} />
          </button>

          <button
            onClick={handleBack}
            className="glass-panel p-4 rounded-full glass-panel-hover bg-red-500/20 border-red-500/50 hover:bg-red-500/30"
          >
            <PhoneOff className="w-6 h-6 text-red-400" />
          </button>
        </div>
      </div>
    </div>
  );
};

export default OfflineMeeting;