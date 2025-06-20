import React, { useEffect, useRef, useState, useCallback } from 'react';
import { Device } from 'mediasoup-client';
import io from 'socket.io-client';
import { Mic, MicOff, Video, VideoOff, PhoneOff, Bot, NutOff as BotOff, FileText, Download, Users, Settings } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import GlassCard from './ui/GlassCard';
import Button from './ui/Button';

interface MediasoupMeetingProps {
  roomName: string;
  displayName: string;
  onLeave: () => void;
}

interface TranscriptEntry {
  id: string;
  speaker: string;
  text: string;
  timestamp: Date;
}

interface Note {
  id: string;
  content: string;
  timestamp: Date;
  type: 'auto' | 'manual';
}

interface Peer {
  id: string;
  displayName: string;
  videoElement?: HTMLVideoElement;
  audioElement?: HTMLAudioElement;
}

const MediasoupMeeting: React.FC<MediasoupMeetingProps> = ({ roomName, displayName, onLeave }) => {
  const socketRef = useRef<any>(null);
  const deviceRef = useRef<Device | null>(null);
  const sendTransportRef = useRef<any>(null);
  const recvTransportRef = useRef<any>(null);
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const recognitionRef = useRef<any>(null);
  
  const [isConnected, setIsConnected] = useState(false);
  const [isAudioEnabled, setIsAudioEnabled] = useState(true);
  const [isVideoEnabled, setIsVideoEnabled] = useState(true);
  const [isAIEnabled, setIsAIEnabled] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [transcript, setTranscript] = useState<TranscriptEntry[]>([]);
  const [notes, setNotes] = useState<Note[]>([]);
  const [peers, setPeers] = useState<Map<string, Peer>>(new Map());
  const [showTranscript, setShowTranscript] = useState(false);
  const [showNotes, setShowNotes] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [meetingSummary, setMeetingSummary] = useState<string | null>(null);
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [producers, setProducers] = useState<Map<string, any>>(new Map());
  const [consumers, setConsumers] = useState<Map<string, any>>(new Map());

  // Initialize socket connection
  useEffect(() => {
    socketRef.current = io('http://localhost:3001');
    
    socketRef.current.on('connect', () => {
      console.log('Connected to mediasoup server');
      joinRoom();
    });

    socketRef.current.on('routerRtpCapabilities', async (rtpCapabilities: any) => {
      await initializeDevice(rtpCapabilities);
    });

    socketRef.current.on('webRtcTransportCreated', handleTransportCreated);
    socketRef.current.on('transportConnected', handleTransportConnected);
    socketRef.current.on('produced', handleProduced);
    socketRef.current.on('consumed', handleConsumed);
    socketRef.current.on('consumerResumed', handleConsumerResumed);
    socketRef.current.on('producers', handleProducers);
    socketRef.current.on('newProducer', handleNewProducer);
    socketRef.current.on('peerJoined', handlePeerJoined);
    socketRef.current.on('peerLeft', handlePeerLeft);
    socketRef.current.on('existingPeers', handleExistingPeers);
    socketRef.current.on('consumerClosed', handleConsumerClosed);
    socketRef.current.on('error', handleError);

    return () => {
      if (socketRef.current) {
        socketRef.current.disconnect();
      }
      if (localStream) {
        localStream.getTracks().forEach(track => track.stop());
      }
    };
  }, []);

  // Initialize Speech Recognition
  useEffect(() => {
    if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
      const SpeechRecognition = (window as any).webkitSpeechRecognition || (window as any).SpeechRecognition;
      recognitionRef.current = new SpeechRecognition();
      recognitionRef.current.continuous = true;
      recognitionRef.current.interimResults = true;
      recognitionRef.current.lang = 'en-US';

      recognitionRef.current.onresult = (event: any) => {
        const results = Array.from(event.results);
        const finalTranscript = results
          .filter((result: any) => result.isFinal)
          .map((result: any) => result[0].transcript)
          .join(' ');

        if (finalTranscript.trim()) {
          const newEntry: TranscriptEntry = {
            id: Date.now().toString(),
            speaker: displayName || 'You',
            text: finalTranscript.trim(),
            timestamp: new Date()
          };
          
          setTranscript(prev => [...prev, newEntry]);
          
          // Auto-generate notes for significant content
          if (finalTranscript.length > 30) {
            generateAutoNotes(finalTranscript, displayName || 'You');
          }
        }
      };

      recognitionRef.current.onerror = (event: any) => {
        console.error('Speech recognition error:', event.error);
      };

      recognitionRef.current.onend = () => {
        if (isTranscribing && isAIEnabled) {
          setTimeout(() => {
            if (recognitionRef.current && isTranscribing) {
              recognitionRef.current.start();
            }
          }, 1000);
        }
      };
    }
  }, [displayName, isTranscribing, isAIEnabled]);

  const joinRoom = () => {
    socketRef.current.emit('join-room', {
      roomId: roomName,
      displayName: displayName
    });
  };

  const initializeDevice = async (rtpCapabilities: any) => {
    try {
      deviceRef.current = new Device();
      await deviceRef.current.load({ routerRtpCapabilities: rtpCapabilities });
      console.log('Device loaded');
      
      await createTransports();
      await getUserMedia();
      setIsConnected(true);
    } catch (error) {
      console.error('Error initializing device:', error);
    }
  };

  const createTransports = async () => {
    // Create send transport
    socketRef.current.emit('createWebRtcTransport', { direction: 'send' });
    
    // Create receive transport
    socketRef.current.emit('createWebRtcTransport', { direction: 'recv' });
  };

  const handleTransportCreated = async (data: any) => {
    const { id, iceParameters, iceCandidates, dtlsParameters } = data;
    
    if (!sendTransportRef.current) {
      // This is the send transport
      sendTransportRef.current = deviceRef.current!.createSendTransport({
        id,
        iceParameters,
        iceCandidates,
        dtlsParameters,
      });

      sendTransportRef.current.on('connect', async ({ dtlsParameters }: any, callback: any, errback: any) => {
        try {
          socketRef.current.emit('connectTransport', {
            transportId: id,
            dtlsParameters,
          });
          callback();
        } catch (error) {
          errback(error);
        }
      });

      sendTransportRef.current.on('produce', async (parameters: any, callback: any, errback: any) => {
        try {
          socketRef.current.emit('produce', {
            transportId: id,
            kind: parameters.kind,
            rtpParameters: parameters.rtpParameters,
          });
          
          socketRef.current.once('produced', (data: any) => {
            callback({ id: data.id });
          });
        } catch (error) {
          errback(error);
        }
      });
    } else {
      // This is the receive transport
      recvTransportRef.current = deviceRef.current!.createRecvTransport({
        id,
        iceParameters,
        iceCandidates,
        dtlsParameters,
      });

      recvTransportRef.current.on('connect', async ({ dtlsParameters }: any, callback: any, errback: any) => {
        try {
          socketRef.current.emit('connectTransport', {
            transportId: id,
            dtlsParameters,
          });
          callback();
        } catch (error) {
          errback(error);
        }
      });
    }
  };

  const handleTransportConnected = () => {
    console.log('Transport connected');
  };

  const getUserMedia = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: true,
        audio: true,
      });
      
      setLocalStream(stream);
      
      if (localVideoRef.current) {
        localVideoRef.current.srcObject = stream;
      }

      // Produce audio and video
      const audioTrack = stream.getAudioTracks()[0];
      const videoTrack = stream.getVideoTracks()[0];

      if (audioTrack && sendTransportRef.current) {
        const audioProducer = await sendTransportRef.current.produce({ track: audioTrack });
        setProducers(prev => new Map(prev.set('audio', audioProducer)));
      }

      if (videoTrack && sendTransportRef.current) {
        const videoProducer = await sendTransportRef.current.produce({ track: videoTrack });
        setProducers(prev => new Map(prev.set('video', videoProducer)));
      }

      // Get existing producers
      socketRef.current.emit('getProducers');

    } catch (error) {
      console.error('Error getting user media:', error);
    }
  };

  const handleProduced = (data: any) => {
    console.log('Producer created:', data.id);
  };

  const handleConsumed = async (data: any) => {
    const { id, producerId, kind, rtpParameters } = data;
    
    try {
      const consumer = await recvTransportRef.current.consume({
        id,
        producerId,
        kind,
        rtpParameters,
      });

      setConsumers(prev => new Map(prev.set(id, consumer)));

      // Resume consumer
      socketRef.current.emit('resumeConsumer', { consumerId: id });

      // Create media element for remote stream
      const stream = new MediaStream([consumer.track]);
      
      // Find the peer and attach stream
      setPeers(prevPeers => {
        const newPeers = new Map(prevPeers);
        newPeers.forEach((peer, peerId) => {
          if (kind === 'video') {
            const videoElement = document.getElementById(`video-${peerId}`) as HTMLVideoElement;
            if (videoElement) {
              videoElement.srcObject = stream;
            }
          } else if (kind === 'audio') {
            const audioElement = document.getElementById(`audio-${peerId}`) as HTMLAudioElement;
            if (audioElement) {
              audioElement.srcObject = stream;
            }
          }
        });
        return newPeers;
      });

    } catch (error) {
      console.error('Error consuming:', error);
    }
  };

  const handleConsumerResumed = () => {
    console.log('Consumer resumed');
  };

  const handleProducers = (producers: any[]) => {
    producers.forEach(({ peerId, producerId, kind }) => {
      consume(producerId);
    });
  };

  const handleNewProducer = ({ peerId, producerId, kind }: any) => {
    consume(producerId);
  };

  const consume = (producerId: string) => {
    socketRef.current.emit('consume', {
      transportId: recvTransportRef.current.id,
      producerId,
      rtpCapabilities: deviceRef.current!.rtpCapabilities,
    });
  };

  const handlePeerJoined = ({ peerId, displayName }: any) => {
    setPeers(prev => new Map(prev.set(peerId, { id: peerId, displayName })));
  };

  const handlePeerLeft = ({ peerId }: any) => {
    setPeers(prev => {
      const newPeers = new Map(prev);
      newPeers.delete(peerId);
      return newPeers;
    });
  };

  const handleExistingPeers = (existingPeers: any[]) => {
    const newPeers = new Map();
    existingPeers.forEach(peer => {
      newPeers.set(peer.id, peer);
    });
    setPeers(newPeers);
  };

  const handleConsumerClosed = ({ consumerId }: any) => {
    setConsumers(prev => {
      const newConsumers = new Map(prev);
      newConsumers.delete(consumerId);
      return newConsumers;
    });
  };

  const handleError = (error: any) => {
    console.error('Socket error:', error);
  };

  const toggleAudio = () => {
    if (localStream) {
      const audioTrack = localStream.getAudioTracks()[0];
      if (audioTrack) {
        audioTrack.enabled = !audioTrack.enabled;
        setIsAudioEnabled(audioTrack.enabled);
      }
    }
  };

  const toggleVideo = () => {
    if (localStream) {
      const videoTrack = localStream.getVideoTracks()[0];
      if (videoTrack) {
        videoTrack.enabled = !videoTrack.enabled;
        setIsVideoEnabled(videoTrack.enabled);
      }
    }
  };

  const toggleAI = async () => {
    if (!isAIEnabled) {
      try {
        setIsAIEnabled(true);
        startTranscription();
      } catch (error) {
        alert('Microphone access is required for AI features.');
        console.error('Microphone access denied:', error);
      }
    } else {
      setIsAIEnabled(false);
      stopTranscription();
    }
  };

  const startTranscription = () => {
    if (recognitionRef.current && !isTranscribing) {
      setIsTranscribing(true);
      recognitionRef.current.start();
    }
  };

  const stopTranscription = () => {
    if (recognitionRef.current && isTranscribing) {
      setIsTranscribing(false);
      recognitionRef.current.stop();
    }
  };

  const generateAutoNotes = async (text: string, speaker: string) => {
    try {
      setIsProcessing(true);
      const response = await fetch('http://localhost:8001/api/meetings/auto-notes', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({
          text,
          speaker,
          userId: 'meeting-user'
        })
      });

      const data = await response.json();
      
      if (data.success && data.notes) {
        const newNote: Note = {
          id: Date.now().toString(),
          content: data.notes,
          timestamp: new Date(),
          type: 'auto'
        };
        setNotes(prev => [...prev, newNote]);
      }
    } catch (error) {
      console.error('Auto notes generation failed:', error);
    } finally {
      setIsProcessing(false);
    }
  };

  const generateMeetingSummary = async () => {
    if (transcript.length === 0) {
      alert('No transcript available to summarize.');
      return;
    }

    try {
      setIsProcessing(true);
      const response = await fetch('http://localhost:8001/api/meetings/summary', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({
          transcript: transcript.map(t => `${t.speaker}: ${t.text}`).join('\n'),
          participants: Array.from(peers.values()).map(p => p.displayName),
          duration: Math.round((new Date().getTime() - (transcript[0]?.timestamp.getTime() || Date.now())) / 60000)
        })
      });

      const data = await response.json();
      
      if (data.success && data.summary) {
        setMeetingSummary(data.summary);
      }
    } catch (error) {
      console.error('Summary generation failed:', error);
      alert('Failed to generate meeting summary. Please try again.');
    } finally {
      setIsProcessing(false);
    }
  };

  const downloadTranscript = () => {
    const transcriptText = transcript
      .map(entry => `[${entry.timestamp.toLocaleTimeString()}] ${entry.speaker}: ${entry.text}`)
      .join('\n');
    
    const blob = new Blob([transcriptText], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `meeting-transcript-${roomName}-${new Date().toISOString().split('T')[0]}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const downloadNotes = () => {
    const notesText = notes
      .map(note => `[${note.timestamp.toLocaleTimeString()}] ${note.type.toUpperCase()}: ${note.content}`)
      .join('\n\n');
    
    const blob = new Blob([notesText], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `meeting-notes-${roomName}-${new Date().toISOString().split('T')[0]}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  if (!isConnected) {
    return (
      <div className="min-h-screen bg-primary flex items-center justify-center">
        <div className="glass-panel rounded-2xl p-8 max-w-md mx-auto text-center">
          <div className="animate-spin w-8 h-8 border-2 border-gold-text border-t-transparent rounded-full mx-auto mb-4"></div>
          <h3 className="text-xl font-bold text-primary mb-2">Connecting to Meeting...</h3>
          <p className="text-secondary">Setting up your video conference</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen flex flex-col bg-primary">
      {/* Meeting Header */}
      <div className="glass-panel border-b silver-border p-4 flex justify-between items-center">
        <div className="flex items-center space-x-4">
          <h1 className="text-lg font-bold gradient-gold-silver">
            Meeting: {roomName}
          </h1>
          <div className="flex items-center space-x-2 text-sm text-secondary">
            <Users className="w-4 h-4" />
            <span>{peers.size + 1} participants</span>
          </div>
        </div>

        <div className="flex items-center space-x-3">
          {/* AI Toggle */}
          <Button
            onClick={toggleAI}
            variant={isAIEnabled ? "premium" : "secondary"}
            size="sm"
            className="flex items-center space-x-2"
          >
            {isAIEnabled ? <Bot className="w-4 h-4" /> : <BotOff className="w-4 h-4" />}
            <span>{isAIEnabled ? 'AI On' : 'AI Off'}</span>
          </Button>

          {/* Transcript Toggle */}
          {isAIEnabled && (
            <Button
              onClick={() => setShowTranscript(!showTranscript)}
              variant="secondary"
              size="sm"
              className="flex items-center space-x-2"
            >
              <FileText className="w-4 h-4" />
              <span>Transcript ({transcript.length})</span>
            </Button>
          )}

          {/* Notes Toggle */}
          {isAIEnabled && (
            <Button
              onClick={() => setShowNotes(!showNotes)}
              variant="secondary"
              size="sm"
              className="flex items-center space-x-2"
            >
              <FileText className="w-4 h-4" />
              <span>Notes ({notes.length})</span>
            </Button>
          )}

          {/* Leave Meeting */}
          <Button
            onClick={onLeave}
            variant="secondary"
            size="sm"
            className="flex items-center space-x-2 bg-red-500/20 border-red-500/50 hover:bg-red-500/30"
          >
            <PhoneOff className="w-4 h-4 text-red-400" />
            <span className="text-red-400">Leave</span>
          </Button>
        </div>
      </div>

      {/* Main Meeting Area */}
      <div className="flex-1 flex">
        {/* Video Grid */}
        <div className="flex-1 p-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 h-full">
            {/* Local Video */}
            <div className="relative glass-panel rounded-lg overflow-hidden">
              <video
                ref={localVideoRef}
                autoPlay
                muted
                playsInline
                className="w-full h-full object-cover"
              />
              <div className="absolute bottom-2 left-2 glass-panel px-2 py-1 rounded text-sm">
                <span className="text-primary font-medium">{displayName} (You)</span>
              </div>
              {!isVideoEnabled && (
                <div className="absolute inset-0 bg-gray-800 flex items-center justify-center">
                  <VideoOff className="w-8 h-8 text-gray-400" />
                </div>
              )}
            </div>

            {/* Remote Videos */}
            {Array.from(peers.values()).map((peer) => (
              <div key={peer.id} className="relative glass-panel rounded-lg overflow-hidden">
                <video
                  id={`video-${peer.id}`}
                  autoPlay
                  playsInline
                  className="w-full h-full object-cover"
                />
                <audio
                  id={`audio-${peer.id}`}
                  autoPlay
                />
                <div className="absolute bottom-2 left-2 glass-panel px-2 py-1 rounded text-sm">
                  <span className="text-primary font-medium">{peer.displayName}</span>
                </div>
              </div>
            ))}
          </div>

          {/* AI Status Overlay */}
          {isAIEnabled && (
            <div className="absolute top-8 left-8 glass-panel px-3 py-2 rounded-lg">
              <div className="flex items-center space-x-2">
                <div className={`w-2 h-2 rounded-full ${isTranscribing ? 'bg-green-500 animate-pulse' : 'bg-gray-500'}`} />
                <span className="text-sm text-primary font-medium">
                  {isTranscribing ? 'AI Listening' : 'AI Ready'}
                </span>
              </div>
            </div>
          )}

          {/* Processing Indicator */}
          {isProcessing && (
            <div className="absolute top-8 right-8 glass-panel px-3 py-2 rounded-lg">
              <div className="flex items-center space-x-2">
                <div className="w-4 h-4 border-2 border-gold-text border-t-transparent rounded-full animate-spin" />
                <span className="text-sm text-primary">Processing...</span>
              </div>
            </div>
          )}
        </div>

        {/* Transcript Panel */}
        <AnimatePresence>
          {showTranscript && (
            <motion.div
              initial={{ width: 0, opacity: 0 }}
              animate={{ width: 400, opacity: 1 }}
              exit={{ width: 0, opacity: 0 }}
              className="glass-panel border-l silver-border flex flex-col"
            >
              <div className="p-4 border-b silver-border">
                <div className="flex justify-between items-center">
                  <h3 className="font-bold text-primary">Live Transcript</h3>
                  <div className="flex space-x-2">
                    <Button
                      onClick={downloadTranscript}
                      variant="ghost"
                      size="sm"
                      disabled={transcript.length === 0}
                    >
                      <Download className="w-4 h-4" />
                    </Button>
                    <Button
                      onClick={() => setShowTranscript(false)}
                      variant="ghost"
                      size="sm"
                    >
                      ×
                    </Button>
                  </div>
                </div>
              </div>
              
              <div className="flex-1 overflow-y-auto p-4 space-y-3">
                {transcript.map((entry) => (
                  <div key={entry.id} className="glass-panel p-3 rounded-lg">
                    <div className="flex justify-between items-start mb-1">
                      <span className="font-medium text-primary text-sm">{entry.speaker}</span>
                      <span className="text-xs text-secondary">
                        {entry.timestamp.toLocaleTimeString()}
                      </span>
                    </div>
                    <p className="text-sm text-secondary">{entry.text}</p>
                  </div>
                ))}
                
                {transcript.length === 0 && (
                  <div className="text-center text-secondary py-8">
                    <FileText className="w-8 h-8 mx-auto mb-2 opacity-50" />
                    <p>Transcript will appear here when AI is listening</p>
                  </div>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Notes Panel */}
        <AnimatePresence>
          {showNotes && (
            <motion.div
              initial={{ width: 0, opacity: 0 }}
              animate={{ width: 400, opacity: 1 }}
              exit={{ width: 0, opacity: 0 }}
              className="glass-panel border-l silver-border flex flex-col"
            >
              <div className="p-4 border-b silver-border">
                <div className="flex justify-between items-center">
                  <h3 className="font-bold text-primary">AI Notes</h3>
                  <div className="flex space-x-2">
                    <Button
                      onClick={generateMeetingSummary}
                      variant="ghost"
                      size="sm"
                      disabled={transcript.length === 0 || isProcessing}
                    >
                      <Bot className="w-4 h-4" />
                    </Button>
                    <Button
                      onClick={downloadNotes}
                      variant="ghost"
                      size="sm"
                      disabled={notes.length === 0}
                    >
                      <Download className="w-4 h-4" />
                    </Button>
                    <Button
                      onClick={() => setShowNotes(false)}
                      variant="ghost"
                      size="sm"
                    >
                      ×
                    </Button>
                  </div>
                </div>
              </div>
              
              <div className="flex-1 overflow-y-auto p-4 space-y-3">
                {/* Meeting Summary */}
                {meetingSummary && (
                  <div className="glass-panel p-4 rounded-lg border-gold-border">
                    <h4 className="font-bold text-primary mb-2 flex items-center">
                      <Bot className="w-4 h-4 mr-2" />
                      Meeting Summary
                    </h4>
                    <p className="text-sm text-secondary whitespace-pre-wrap">{meetingSummary}</p>
                  </div>
                )}

                {/* Auto Notes */}
                {notes.map((note) => (
                  <div key={note.id} className="glass-panel p-3 rounded-lg">
                    <div className="flex justify-between items-start mb-1">
                      <span className={`text-xs px-2 py-1 rounded ${
                        note.type === 'auto' ? 'bg-blue-500/20 text-blue-400' : 'bg-green-500/20 text-green-400'
                      }`}>
                        {note.type === 'auto' ? 'AI Generated' : 'Manual'}
                      </span>
                      <span className="text-xs text-secondary">
                        {note.timestamp.toLocaleTimeString()}
                      </span>
                    </div>
                    <p className="text-sm text-secondary">{note.content}</p>
                  </div>
                ))}
                
                {notes.length === 0 && (
                  <div className="text-center text-secondary py-8">
                    <Bot className="w-8 h-8 mx-auto mb-2 opacity-50" />
                    <p>AI will automatically take notes during the meeting</p>
                  </div>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Controls */}
      <div className="glass-panel border-t silver-border p-4">
        <div className="flex justify-center items-center space-x-4">
          <button
            onClick={toggleAudio}
            className={`glass-panel p-4 rounded-full glass-panel-hover transition-all ${
              !isAudioEnabled ? 'bg-red-500/20 border-red-500/50' : ''
            }`}
          >
            {isAudioEnabled ? (
              <Mic className="w-6 h-6 text-primary" />
            ) : (
              <MicOff className="w-6 h-6 text-red-400" />
            )}
          </button>

          <button
            onClick={toggleVideo}
            className={`glass-panel p-4 rounded-full glass-panel-hover transition-all ${
              !isVideoEnabled ? 'bg-red-500/20 border-red-500/50' : ''
            }`}
          >
            {isVideoEnabled ? (
              <Video className="w-6 h-6 text-primary" />
            ) : (
              <VideoOff className="w-6 h-6 text-red-400" />
            )}
          </button>

          <button
            onClick={onLeave}
            className="glass-panel p-4 rounded-full glass-panel-hover bg-red-500/20 border-red-500/50 hover:bg-red-500/30"
          >
            <PhoneOff className="w-6 h-6 text-red-400" />
          </button>
        </div>
      </div>
    </div>
  );
};

export default MediasoupMeeting;