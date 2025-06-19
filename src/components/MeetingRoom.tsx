import React, { useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { 
  Mic, MicOff, Video, VideoOff, PhoneOff, Users, 
  MessageSquare, Settings, Bot, BotOff, FileText, 
  Download, Copy, Loader2 
} from 'lucide-react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import GlassCard from './ui/GlassCard';
import Button from './ui/Button';

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
  
  // Media state
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [isMuted, setIsMuted] = useState(false);
  const [isVideoOff, setIsVideoOff] = useState(false);
  
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
  const remoteVideosRef = useRef<{ [key: string]: HTMLVideoElement }>({});

  // Initialize meeting
  useEffect(() => {
    if (meetingId) {
      joinMeeting();
      initializeMedia();
      initializeSpeechRecognition();
    }

    return () => {
      cleanup();
    };
  }, [meetingId]);

  const joinMeeting = async () => {
    try {
      const response = await fetch('http://localhost:8001/api/meetings/join', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          meetingId,
          userId: user?.id
        })
      });

      const data = await response.json();
      if (data.success) {
        setMeeting(data.meeting);
        setIsHost(data.meeting.host === user?.id);
        setAiEnabled(data.meeting.aiEnabled);
        
        // Add self as participant
        setParticipants([{
          id: user?.id || 'local',
          name: user?.name || 'You',
          isHost: data.meeting.host === user?.id,
          isMuted: false,
          isVideoOff: false
        }]);
      }
    } catch (error) {
      console.error('Failed to join meeting:', error);
      navigate('/assistant');
    }
  };

  const initializeMedia = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: true,
        audio: true
      });
      
      setLocalStream(stream);
      if (localVideoRef.current) {
        localVideoRef.current.srcObject = stream;
      }
    } catch (error) {
      console.error('Failed to get media:', error);
    }
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
      recognitionRef.current.start();
      setIsRecording(true);
    }
  };

  const stopRecording = () => {
    if (recognitionRef.current) {
      recognitionRef.current.stop();
      setIsRecording(false);
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
    if (localStream) {
      localStream.getTracks().forEach(track => track.stop());
    }
    if (recognitionRef.current) {
      recognitionRef.current.stop();
    }
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

  if (!meeting) {
    return (
      <div className="min-h-screen bg-primary flex items-center justify-center">
        <div className="glass-panel p-8 rounded-xl">
          <Loader2 className="w-8 h-8 animate-spin mx-auto mb-4 text-secondary" />
          <p className="text-primary">Joining meeting...</p>
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
                  {user?.name || 'You'} {isHost && '(Host)'}
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

            {/* Remote participants would go here */}
            {participants.slice(1).map((participant) => (
              <div key={participant.id} className="relative glass-panel rounded-xl overflow-hidden aspect-video">
                <div className="w-full h-full bg-gray-800 flex items-center justify-center">
                  <Users className="w-8 h-8 text-gray-400" />
                </div>
                <div className="absolute bottom-4 left-4 glass-panel px-3 py-1 rounded-lg">
                  <span className="text-primary text-sm font-medium">
                    {participant.name} {participant.isHost && '(Host)'}
                  </span>
                </div>
              </div>
            ))}
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