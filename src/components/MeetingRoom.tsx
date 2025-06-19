import React, { useEffect, useRef, useState } from 'react';
import io from 'socket.io-client';
import { motion } from 'framer-motion';
import { Mic, MicOff, Video, VideoOff, PhoneOff, Users, MessageSquare, Settings, Bot, NutOff as BotOff, FileText, Download, Copy, Loader2 } from 'lucide-react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import GlassCard from './ui/GlassCard';
import Button from './ui/Button';
import SimplePeer from 'simple-peer';

const SIGNALING_SERVER_URL = 'http://localhost:5000';

interface Participant {
  id: string;
  name: string;
  isHost: boolean;
  isMuted: boolean;
  isVideoOff: boolean;
  stream?: MediaStream;
}

interface TranscriptEntry {
  id: number;
  text: string;
  speaker: string;
  timestamp: Date;
}

interface Note {
  id: number;
  content: string;
  timestamp: Date;
  source: 'auto' | 'manual';
}

const MeetingRoom: React.FC = () => {
  const { meetingId } = useParams<{ meetingId: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  
  // Meeting state
  const [meeting, setMeeting] = useState<any>(null);
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [isHost, setIsHost] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<'connecting' | 'connected' | 'failed'>('connecting');
  
  // Media state
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [isMuted, setIsMuted] = useState(false);
  const [isVideoOff, setIsVideoOff] = useState(false);
  const [remoteStreams, setRemoteStreams] = useState<{ [id: string]: MediaStream }>({});
  
  // AI Assistant state
  const [aiEnabled, setAiEnabled] = useState(false);
  const [transcript, setTranscript] = useState<TranscriptEntry[]>([]);
  const [notes, setNotes] = useState<Note[]>([]);
  const [isRecording, setIsRecording] = useState(false);

  // UI state
  const [activeTab, setActiveTab] = useState<'participants' | 'transcript' | 'notes'>('participants');
  const [isGeneratingSummary, setIsGeneratingSummary] = useState(false);
  const [summary, setSummary] = useState<any>(null);
  
  // Refs
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const recognitionRef = useRef<any>(null);
  const socketRef = useRef<any>(null);
  const peersRef = useRef<{ [id: string]: SimplePeer.Instance }>({});
  const isInitializedRef = useRef(false);

  // New state for display name feature
  const [displayName, setDisplayName] = useState<string>('');
  const [hasEnteredName, setHasEnteredName] = useState(false);
  const [userId, setUserId] = useState<string>(user?.id || '');

  // Initialize meeting
  useEffect(() => {
    if (!isInitializedRef.current && meetingId && userId && hasEnteredName) {
      isInitializedRef.current = true;
      initializeMeeting();
    }
    return () => {
      cleanup();
    };
  }, [meetingId, userId, hasEnteredName]);

  const initializeMeeting = async () => {
    try {
      console.log('Initializing meeting...', { meetingId, userId: user?.id });

      // Try to get media, but don't abort if it fails
      await initializeMedia();

      // Then join the meeting
      await joinMeeting();

      // Finally connect to signaling server
      connectToSignalingServer();

    } catch (error) {
      console.error('Failed to initialize meeting:', error);
      setConnectionStatus('failed');
    }
  };

  const initializeMedia = async () => {
    try {
      console.log('Getting user media...');
      const stream = await navigator.mediaDevices.getUserMedia({
        video: true,
        audio: true
      });

      setLocalStream(stream);
      if (localVideoRef.current) {
        localVideoRef.current.srcObject = stream;
      }
      console.log('Media initialized successfully');
    } catch (error) {
      // Log the error, but do NOT throw
      console.error('Failed to get media:', error);
      setLocalStream(null);
      if (localVideoRef.current) {
        localVideoRef.current.srcObject = null;
      }
      // Continue without throwing!
    }
  };

  const joinMeeting = async () => {
    try {
      console.log('Joining meeting via API...', { meetingId, userId: user?.id });
      
      const response = await fetch('http://localhost:8001/api/meetings/join', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          meetingId,
          userId,
          name: displayName
        })
      });

      const data = await response.json();
      console.log('Join meeting response:', data);
      
      if (data.success) {
        setMeeting(data.meeting);
        setIsHost(data.meeting.host === user?.id);
        setAiEnabled(data.meeting.aiEnabled);
        
        // Add self as participant
        const selfParticipant: Participant = {
          id: userId || 'local',
          name: displayName || user?.name || 'You',
          isHost: data.meeting.host === userId,
          isMuted: false,
          isVideoOff: false
        };
        
        setParticipants([selfParticipant]);
        console.log('Meeting joined successfully');
      } else {
        throw new Error(data.error || 'Failed to join meeting');
      }
    } catch (error) {
      console.error('Failed to join meeting:', error);
      throw error;
    }
  };

  const connectToSignalingServer = () => {
    try {
      console.log('Connecting to signaling server...', SIGNALING_SERVER_URL);
      
      // Clean up existing socket
      if (socketRef.current) {
        socketRef.current.disconnect();
      }
      
      socketRef.current = io(SIGNALING_SERVER_URL, {
        transports: ['websocket'],
        timeout: 10000,
        forceNew: true
      });

      socketRef.current.on('connect', () => {
        console.log('Connected to signaling server');
        setConnectionStatus('connected');
        
        // Join the room
        console.log('Joining room:', meetingId, user?.id);
        socketRef.current.emit('join-room', meetingId, user?.id);
      });

      socketRef.current.on('connect_error', (error: any) => {
        console.error('Signaling server connection error:', error);
        setConnectionStatus('failed');
      });

      socketRef.current.on('disconnect', (reason: string) => {
        console.log('Disconnected from signaling server:', reason);
        setConnectionStatus('connecting');
      });

      socketRef.current.on('all-users', (users: string[]) => {
        console.log('Received all users:', users);
        
        // Filter out self
        const otherUsers = users.filter(id => id !== socketRef.current.id);
        console.log('Other users to connect to:', otherUsers);
        
        otherUsers.forEach((socketId) => {
          if (!peersRef.current[socketId]) {
            console.log('Creating peer connection to:', socketId);
            const peer = createPeer(socketId, true);
            peersRef.current[socketId] = peer;
          }
        });

        // Add participants for all users
        setParticipants(prev => {
          const existingIds = prev.map(p => p.id);
          const newParticipants = users
            .filter(id => id !== socketRef.current.id && !existingIds.includes(id))
            .map(id => ({
              id,
              name: `Participant ${id.slice(0, 6)}`,
              isHost: false,
              isMuted: false,
              isVideoOff: false
            }));
          return [...prev, ...newParticipants];
        });
      });

      socketRef.current.on('user-joined', (socketId: string) => {
        console.log('User joined:', socketId);
        
        if (socketId !== socketRef.current.id && !peersRef.current[socketId]) {
          console.log('Creating peer connection for new user:', socketId);
          const peer = createPeer(socketId, false);
          peersRef.current[socketId] = peer;
        }

        setParticipants(prev => {
          if (!prev.find(p => p.id === socketId)) {
            return [
              ...prev,
              {
                id: socketId,
                name: `Participant ${socketId.slice(0, 6)}`,
                isHost: false,
                isMuted: false,
                isVideoOff: false
              }
            ];
          }
          return prev;
        });
      });

      socketRef.current.on('signal', ({ from, signal }: { from: string; signal: any }) => {
        console.log('Received signal from:', from);
        
        const peer = peersRef.current[from];
        if (peer) {
          try {
            peer.signal(signal);
          } catch (error) {
            console.error('Error processing signal:', error);
          }
        } else {
          console.warn('Received signal from unknown peer:', from);
        }
      });

      socketRef.current.on('user-left', (socketId: string) => {
        console.log('User left:', socketId);
        
        if (peersRef.current[socketId]) {
          peersRef.current[socketId].destroy();
          delete peersRef.current[socketId];
          
          setRemoteStreams((prev) => {
            const copy = { ...prev };
            delete copy[socketId];
            return copy;
          });
          
          // Update participants list
          setParticipants(prev => prev.filter(p => p.id !== socketId));
        }
      });

    } catch (error) {
      console.error('Failed to connect to signaling server:', error);
      setConnectionStatus('failed');
    }
  };

  const createPeer = (socketId: string, initiator: boolean): SimplePeer.Instance => {
    console.log('Creating peer:', { socketId, initiator, hasLocalStream: !!localStream });
    
    const peer = new SimplePeer({
      initiator,
      trickle: false,
      stream: localStream || undefined,
      config: {
        iceServers: [
          { urls: 'stun:stun.l.google.com:19302' },
          { urls: 'stun:stun1.l.google.com:19302' }
        ]
      }
    });

    peer.on('signal', (signal: any) => {
      console.log('Sending signal to:', socketId);
      if (socketRef.current && socketRef.current.connected) {
        socketRef.current.emit('signal', { to: socketId, signal });
      }
    });

    peer.on('stream', (stream: MediaStream) => {
      console.log('Received stream from:', socketId);
      setRemoteStreams((prev) => ({ ...prev, [socketId]: stream }));
      
      // Add participant if not already added
      setParticipants(prev => {
        const exists = prev.find(p => p.id === socketId);
        if (!exists) {
          return [...prev, {
            id: socketId,
            name: `Participant ${socketId.slice(0, 6)}`,
            isHost: false,
            isMuted: false,
            isVideoOff: false
          }];
        }
        return prev;
      });
    });

    peer.on('connect', () => {
      console.log('Peer connected:', socketId);
    });

    peer.on('close', () => {
      console.log('Peer connection closed:', socketId);
      setRemoteStreams((prev) => {
        const copy = { ...prev };
        delete copy[socketId];
        return copy;
      });
    });

    peer.on('error', (err) => {
      console.error('Peer error:', socketId, err);
      // Clean up failed peer
      if (peersRef.current[socketId]) {
        delete peersRef.current[socketId];
      }
    });

    return peer;
  };

  const initializeSpeechRecognition = () => {
    if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
      const SpeechRecognition = (window as any).webkitSpeechRecognition || (window as any).SpeechRecognition;
      recognitionRef.current = new SpeechRecognition();
      recognitionRef.current.continuous = true;
      recognitionRef.current.interimResults = true;
      recognitionRef.current.lang = 'en-US';

      recognitionRef.current.onresult = (event: any) => {
        const results = Array.from(event.results);
        const transcript = results
          .map((result: any) => result[0].transcript)
          .join('');

        if (event.results[event.results.length - 1].isFinal) {
          addTranscriptEntry(transcript, user?.name || 'You');
        }
      };

      recognitionRef.current.onerror = (event: any) => {
        console.error('Speech recognition error:', event.error);
      };
    }
  };

  const toggleAI = async () => {
    if (!isHost) return;

    try {
      const response = await fetch(`http://localhost:8001/api/meetings/${meetingId}/ai-toggle`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          enabled: !aiEnabled,
          userId: user?.id
        })
      });

      const data = await response.json();
      if (data.success) {
        setAiEnabled(data.aiEnabled);
        
        if (data.aiEnabled) {
          startRecording();
        } else {
          stopRecording();
        }
      }
    } catch (error) {
      console.error('Failed to toggle AI:', error);
    }
  };

  const startRecording = () => {
    if (recognitionRef.current && aiEnabled) {
      try {
        recognitionRef.current.start();
        setIsRecording(true);
      } catch (error) {
        console.error('Failed to start recording:', error);
      }
    }
  };

  const stopRecording = () => {
    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
        setIsRecording(false);
      } catch (error) {
        console.error('Failed to stop recording:', error);
      }
    }
  };

  const addTranscriptEntry = async (text: string, speaker: string) => {
    if (!aiEnabled || text.trim().length < 10) return;

    const entry: TranscriptEntry = {
      id: Date.now(),
      text: text.trim(),
      speaker,
      timestamp: new Date()
    };

    setTranscript(prev => [...prev, entry]);

    // Send to backend for processing
    try {
      await fetch(`http://localhost:8001/api/meetings/${meetingId}/transcript`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          text: entry.text,
          speaker: entry.speaker,
          userId: user?.id
        })
      });
    } catch (error) {
      console.error('Failed to save transcript:', error);
    }
  };

  const generateSummary = async () => {
    setIsGeneratingSummary(true);
    try {
      const response = await fetch(`http://localhost:8001/api/meetings/${meetingId}/summary`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({})
      });

      const data = await response.json();
      if (data.success) {
        setSummary(data.summary);
      }
    } catch (error) {
      console.error('Failed to generate summary:', error);
    } finally {
      setIsGeneratingSummary(false);
    }
  };

  const toggleMute = () => {
    if (localStream) {
      const audioTrack = localStream.getAudioTracks()[0];
      if (audioTrack) {
        audioTrack.enabled = !audioTrack.enabled;
        setIsMuted(!audioTrack.enabled);
      }
    }
  };

  const toggleVideo = () => {
    if (localStream) {
      const videoTrack = localStream.getVideoTracks()[0];
      if (videoTrack) {
        videoTrack.enabled = !videoTrack.enabled;
        setIsVideoOff(!videoTrack.enabled);
      }
    }
  };

  const leaveMeeting = async () => {
    try {
      if (isHost) {
        await fetch(`http://localhost:8001/api/meetings/${meetingId}/end`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ userId: user?.id })
        });
      }
    } catch (error) {
      console.error('Failed to end meeting:', error);
    } finally {
      cleanup();
      navigate('/assistant');
    }
  };

  const cleanup = () => {
    console.log('Cleaning up meeting resources...');
    
    // Stop local stream
    if (localStream) {
      localStream.getTracks().forEach(track => {
        track.stop();
        console.log('Stopped track:', track.kind);
      });
    }
    
    // Stop speech recognition
    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch (error) {
        console.error('Error stopping speech recognition:', error);
      }
    }
    
    // Close all peer connections
    Object.values(peersRef.current).forEach(peer => {
      try {
        peer.destroy();
      } catch (error) {
        console.error('Error destroying peer:', error);
      }
    });
    peersRef.current = {};
    
    // Disconnect socket
    if (socketRef.current) {
      socketRef.current.disconnect();
      socketRef.current = null;
    }
    
    // Clear state
    setRemoteStreams({});
    setParticipants([]);
    setLocalStream(null);
  };

  const copyTranscript = () => {
    const transcriptText = transcript
      .map(entry => `${entry.speaker}: ${entry.text}`)
      .join('\n');
    navigator.clipboard.writeText(transcriptText);
  };

  const downloadNotes = () => {
    const content = [
      `Meeting: ${meeting?.title || 'Untitled Meeting'}`,
      `Date: ${new Date().toLocaleDateString()}`,
      `Participants: ${participants.map(p => p.name).join(', ')}`,
      '',
      'TRANSCRIPT:',
      ...transcript.map(entry => `${entry.speaker}: ${entry.text}`),
      '',
      'NOTES:',
      ...notes.map(note => `• ${note.content}`),
      ''
    ];

    if (summary) {
      content.push(
        'SUMMARY:',
        `Overview: ${summary.overview}`,
        `Key Points: ${summary.keyPoints?.join(', ') || 'None'}`,
        `Action Items: ${summary.actionItems?.join(', ') || 'None'}`,
        `Next Steps: ${summary.nextSteps?.join(', ') || 'None'}`
      );
    }

    const blob = new Blob([content.join('\n')], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `meeting-notes-${Date.now()}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  useEffect(() => {
    initializeSpeechRecognition();
  }, []);

  useEffect(() => {
    if (aiEnabled && recognitionRef.current && localStream) {
      try {
        recognitionRef.current.start();
        setIsRecording(true);
      } catch (e) {
        console.error('Speech recognition error:', e);
      }
    } else if (recognitionRef.current) {
      recognitionRef.current.stop();
      setIsRecording(false);
    }
  }, [aiEnabled, localStream]);

  // Show loading state
  if (connectionStatus === 'connecting' || !meeting) {
    return (
      <div className="min-h-screen bg-primary flex items-center justify-center">
        <div className="glass-panel p-8 rounded-xl text-center">
          <Loader2 className="w-8 h-8 animate-spin mx-auto mb-4 text-secondary" />
          <p className="text-primary mb-2">
            {!meeting ? 'Joining meeting...' : 'Connecting to other participants...'}
          </p>
          <p className="text-sm text-secondary">
            Status: {connectionStatus}
          </p>
        </div>
      </div>
    );
  }

  // Show error state
  if (connectionStatus === 'failed') {
    return (
      <div className="min-h-screen bg-primary flex items-center justify-center">
        <div className="glass-panel p-8 rounded-xl text-center max-w-md">
          <h3 className="text-xl font-bold text-primary mb-4">Connection Failed</h3>
          <p className="text-secondary mb-6">
            Unable to connect to the meeting. Please check your internet connection and try again.
          </p>
          <div className="space-y-3">
            <Button
              onClick={() => {
                setConnectionStatus('connecting');
                initializeMeeting();
              }}
              variant="premium"
              className="w-full"
            >
              Retry Connection
            </Button>
            <Button
              onClick={() => navigate('/assistant')}
              variant="secondary"
              className="w-full"
            >
              Go Back
            </Button>
          </div>
        </div>
      </div>
    );
  }

  if (!hasEnteredName) {
    return (
      <div className="min-h-screen bg-primary flex items-center justify-center">
        <div className="glass-panel p-8 rounded-xl text-center max-w-sm">
          <h2 className="text-xl font-bold mb-4 text-primary">Enter your display name</h2>
          <input
            type="text"
            className="w-full p-3 rounded-lg border border-gray-300 mb-4 text-black"
            placeholder="Your name"
            value={displayName}
            onChange={e => setDisplayName(e.target.value)}
          />
          <Button
            onClick={() => {
              if (displayName.trim().length > 0) {
                setHasEnteredName(true);
                if (!user?.id) setUserId(randomId());
                else setUserId(user.id);
              }
            }}
            variant="premium"
            className="w-full"
          >
            Join Meeting
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-primary flex flex-col">
      {/* Header */}
      <header className="glass-panel border-0 border-b silver-border p-4">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-lg font-bold text-primary">{meeting.title}</h1>
            <p className="text-sm text-secondary">
              {participants.length} participant{participants.length !== 1 ? 's' : ''}
              {aiEnabled && <span className="ml-2 text-green-400">• AI Assistant Active</span>}
              <span className="ml-2 text-blue-400">• {connectionStatus}</span>
            </p>
          </div>
          
          <div className="flex items-center space-x-2">
            {isHost && (
              <Button
                onClick={toggleAI}
                variant={aiEnabled ? 'premium' : 'secondary'}
                size="sm"
                className="flex items-center space-x-2"
              >
                {aiEnabled ? <Bot className="w-4 h-4" /> : <BotOff className="w-4 h-4" />}
                <span>AI {aiEnabled ? 'ON' : 'OFF'}</span>
              </Button>
            )}
            
            {aiEnabled && (
              <Button
                onClick={generateSummary}
                disabled={isGeneratingSummary || transcript.length === 0}
                variant="secondary"
                size="sm"
                className="flex items-center space-x-2"
              >
                {isGeneratingSummary ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <FileText className="w-4 h-4" />
                )}
                <span>Summary</span>
              </Button>
            )}

            <Button
              onClick={() => {
                navigator.clipboard.writeText(`${window.origin}/meeting/${meetingId}`);
              }}
              variant="secondary"
              size="sm"
              className="flex items-center space-x-2"
            >
              <Users className="w-4 h-4" />
              <span>Copy Invite Link</span>
            </Button>
          </div>
        </div>
      </header>

      <div className="flex-1 flex">
        {/* Main Video Area */}
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
                  {displayName || user?.name || 'You'} {isHost && '(Host)'}
                </span>
              </div>
              {isMuted && (
                <div className="absolute top-4 right-4 bg-red-500 p-2 rounded-full">
                  <MicOff className="w-4 h-4 text-white" />
                </div>
              )}
              {isVideoOff && (
                <div className="absolute inset-0 bg-gray-800 flex items-center justify-center">
                  <VideoOff className="w-8 h-8 text-gray-400" />
                </div>
              )}
            </div>

            {/* Show all participants except self */}
            {participants
              .filter(p => p.id !== user?.id)
              .map((participant) => {
                const stream = remoteStreams[participant.id];
                return (
                  <div key={participant.id} className="relative glass-panel rounded-xl overflow-hidden aspect-video">
                    {stream ? (
                      <video
                        ref={el => {
                          if (el && el.srcObject !== stream) {
                            el.srcObject = stream;
                          }
                        }}
                        autoPlay
                        playsInline
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center bg-gray-900">
                        <Users className="w-12 h-12 text-gray-600" />
                      </div>
                    )}
                    <div className="absolute bottom-4 left-4 glass-panel px-3 py-1 rounded-lg">
                      <span className="text-primary text-sm font-medium">
                        {participant.name || `Participant ${participant.id.slice(0, 6)}`}
                      </span>
                    </div>
                  </div>
                );
              })}
          </div>
        </div>
        {/* Sidebar */}
        {aiEnabled && (
          <div className="w-80 glass-panel border-l silver-border flex flex-col">
            {/* Tabs */}
            <div className="flex border-b silver-border">
              {[
                { id: 'participants', label: 'Participants', icon: Users },
                { id: 'transcript', label: 'Transcript', icon: MessageSquare },
                { id: 'notes', label: 'Notes', icon: FileText }
              ].map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id as any)}
                  className={`flex-1 p-3 flex items-center justify-center space-x-2 transition-colors ${
                    activeTab === tab.id 
                      ? 'bg-gradient-gold-silver text-white' 
                      : 'text-secondary hover:text-primary'
                  }`}
                >
                  <tab.icon className="w-4 h-4" />
                  <span className="text-sm font-medium">{tab.label}</span>
                </button>
              ))}
            </div>

            {/* Tab Content */}
            <div className="flex-1 overflow-y-auto p-4">
              {activeTab === 'participants' && (
                <div className="space-y-3">
                  {participants.map((participant) => (
                    <div key={participant.id} className="flex items-center space-x-3">
                      <div className="w-8 h-8 rounded-full bg-gradient-gold-silver flex items-center justify-center">
                        <span className="text-white text-sm font-medium">
                          {participant.name.charAt(0).toUpperCase()}
                        </span>
                      </div>
                      <div className="flex-1">
                        <p className="text-primary font-medium">{participant.name}</p>
                        <p className="text-xs text-secondary">
                          {participant.isHost ? 'Host' : 'Participant'}
                        </p>
                      </div>
                      <div className="flex space-x-1">
                        {participant.isMuted && <MicOff className="w-4 h-4 text-red-400" />}
                        {participant.isVideoOff && <VideoOff className="w-4 h-4 text-red-400" />}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {activeTab === 'transcript' && (
                <div className="space-y-3">
                  <div className="flex justify-between items-center">
                    <h3 className="font-semibold text-primary">Live Transcript</h3>
                    <div className="flex space-x-2">
                      <button
                        onClick={copyTranscript}
                        className="glass-panel p-1 rounded glass-panel-hover"
                        title="Copy transcript"
                      >
                        <Copy className="w-4 h-4 text-secondary" />
                      </button>
                      {isRecording && (
                        <div className="flex items-center space-x-1">
                          <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse" />
                          <span className="text-xs text-red-400">Recording</span>
                        </div>
                      )}
                    </div>
                  </div>
                  
                  <div className="space-y-2 max-h-96 overflow-y-auto">
                    {transcript.map((entry) => (
                      <div key={entry.id} className="glass-panel p-3 rounded-lg">
                        <div className="flex justify-between items-start mb-1">
                          <span className="font-medium text-primary text-sm">{entry.speaker}</span>
                          <span className="text-xs text-secondary">
                            {entry.timestamp.toLocaleTimeString()}
                          </span>
                        </div>
                        <p className="text-secondary text-sm">{entry.text}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {activeTab === 'notes' && (
                <div className="space-y-3">
                  <div className="flex justify-between items-center">
                    <h3 className="font-semibold text-primary">AI Notes</h3>
                    <button
                      onClick={downloadNotes}
                      className="glass-panel p-1 rounded glass-panel-hover"
                      title="Download notes"
                    >
                      <Download className="w-4 h-4 text-secondary" />
                    </button>
                  </div>
                  
                  <div className="space-y-2">
                    {notes.map((note) => (
                      <div key={note.id} className="glass-panel p-3 rounded-lg">
                        <div className="flex justify-between items-start mb-1">
                          <span className="text-xs text-secondary">
                            {note.source === 'auto' ? 'AI Generated' : 'Manual'}
                          </span>
                          <span className="text-xs text-secondary">
                            {note.timestamp.toLocaleTimeString()}
                          </span>
                        </div>
                        <p className="text-primary text-sm">{note.content}</p>
                      </div>
                    ))}
                  </div>

                  {summary && (
                    <div className="mt-6">
                      <h4 className="font-semibold text-primary mb-3">Meeting Summary</h4>
                      <div className="space-y-3">
                        <div className="glass-panel p-3 rounded-lg">
                          <h5 className="font-medium text-primary mb-1">Overview</h5>
                          <p className="text-secondary text-sm">{summary.overview}</p>
                        </div>
                        
                        {summary.keyPoints && summary.keyPoints.length > 0 && (
                          <div className="glass-panel p-3 rounded-lg">
                            <h5 className="font-medium text-primary mb-1">Key Points</h5>
                            <ul className="text-secondary text-sm space-y-1">
                              {summary.keyPoints.map((point: string, index: number) => (
                                <li key={index}>• {point}</li>
                              ))}
                            </ul>
                          </div>
                        )}
                        
                        {summary.actionItems && summary.actionItems.length > 0 && (
                          <div className="glass-panel p-3 rounded-lg">
                            <h5 className="font-medium text-primary mb-1">Action Items</h5>
                            <ul className="text-secondary text-sm space-y-1">
                              {summary.actionItems.map((item: string, index: number) => (
                                <li key={index}>• {item}</li>
                              ))}
                            </ul>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Controls */}
      <div className="glass-panel border-t silver-border p-4">
        <div className="flex justify-center items-center space-x-4">
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
            onClick={leaveMeeting}
            className="glass-panel p-4 rounded-full glass-panel-hover bg-red-500/20 border-red-500/50 hover:bg-red-500/30"
          >
            <PhoneOff className="w-6 h-6 text-red-400" />
          </button>
        </div>
      </div>
    </div>
  );
};

export default MeetingRoom;

function randomId() {
  return Math.random().toString(36).slice(2, 10);
}