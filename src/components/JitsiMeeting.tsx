import React, { useEffect, useRef, useState } from 'react';
import { Mic, MicOff, Video, VideoOff, PhoneOff, Bot, NutOff as BotOff, FileText, Download, Users, Settings } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import GlassCard from './ui/GlassCard';
import Button from './ui/Button';

interface JitsiMeetingProps {
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

declare global {
  interface Window {
    JitsiMeetExternalAPI: any;
  }
}

const JitsiMeeting: React.FC<JitsiMeetingProps> = ({ roomName, displayName, onLeave }) => {
  const jitsiContainerRef = useRef<HTMLDivElement>(null);
  const apiRef = useRef<any>(null);
  const recognitionRef = useRef<any>(null);
  
  const [isAIEnabled, setIsAIEnabled] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [transcript, setTranscript] = useState<TranscriptEntry[]>([]);
  const [notes, setNotes] = useState<Note[]>([]);
  const [participants, setParticipants] = useState<string[]>([]);
  const [showTranscript, setShowTranscript] = useState(false);
  const [showNotes, setShowNotes] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [meetingSummary, setMeetingSummary] = useState<string | null>(null);

  // Initialize Jitsi Meet
  useEffect(() => {
    const initJitsi = () => {
      if (!window.JitsiMeetExternalAPI) {
        console.error('Jitsi Meet API not loaded');
        return;
      }

      const domain = 'meet.jit.si';
      const options = {
        roomName: roomName,
        width: '100%',
        height: '100%',
        parentNode: jitsiContainerRef.current,
        userInfo: {
          displayName: displayName
        },
        configOverwrite: {
          startWithAudioMuted: false,
          startWithVideoMuted: false,
          enableWelcomePage: false,
          prejoinPageEnabled: false,
          disableModeratorIndicator: true,
          startScreenSharing: false,
          enableEmailInStats: false,
          // Disable authentication and waiting room
          enableUserRolesBasedOnToken: false,
          enableInsecureRoomNameWarning: false,
          enableAutomaticUrlCopy: false,
          // Security settings to avoid waiting room
          requireDisplayName: false,
          enableLobbyChat: false,
          enableClosePage: false,
          // Disable moderator requirements
          disableDeepLinking: true,
          enableNoAudioDetection: false,
          enableNoisyMicDetection: false,
          // Make everyone a moderator to avoid waiting
          enableUserRolesBasedOnToken: false,
          moderatedRoomServiceUrl: undefined,
          // Disable authentication
          hosts: {
            domain: 'meet.jit.si',
            anonymousdomain: 'guest.meet.jit.si',
            authdomain: 'meet.jit.si',
            focus: 'focus.meet.jit.si',
            muc: 'conference.meet.jit.si'
          }
        },
        interfaceConfigOverwrite: {
          DISABLE_JOIN_LEAVE_NOTIFICATIONS: false,
          DISABLE_PRESENCE_STATUS: false,
          DISPLAY_WELCOME_PAGE_CONTENT: false,
          ENABLE_DIAL_OUT: false,
          ENABLE_FEEDBACK_ANIMATION: false,
          FILM_STRIP_MAX_HEIGHT: 120,
          GENERATE_ROOMNAMES_ON_WELCOME_PAGE: false,
          HIDE_INVITE_MORE_HEADER: false,
          INITIAL_TOOLBAR_TIMEOUT: 20000,
          JITSI_WATERMARK_LINK: 'https://jitsi.org',
          MAXIMUM_ZOOMING_COEFFICIENT: 1.3,
          MOBILE_APP_PROMO: false,
          RANDOM_AVATAR_URL_PREFIX: false,
          RANDOM_AVATAR_URL_SUFFIX: false,
          REMOTE_THUMBNAIL_RATIO: 1,
          REMOVE_REMOTE_VIDEO_MENU_BUTTON: false,
          SHOW_BRAND_WATERMARK: false,
          SHOW_CHROME_EXTENSION_BANNER: false,
          SHOW_JITSI_WATERMARK: false,
          SHOW_POWERED_BY: false,
          SHOW_PROMOTIONAL_CLOSE_PAGE: false,
          TOOLBAR_ALWAYS_VISIBLE: false,
          TOOLBAR_TIMEOUT: 4000,
          // Remove authentication UI elements
          AUTHENTICATION_ENABLE: false,
          ENABLE_WELCOME_PAGE: false,
          HIDE_DEEP_LINKING_LOGO: true,
          SHOW_WATERMARK_FOR_GUESTS: false
        }
      };

      apiRef.current = new window.JitsiMeetExternalAPI(domain, options);

      // Event listeners
      apiRef.current.addEventListener('participantJoined', (participant: any) => {
        console.log('Participant joined:', participant);
        setParticipants(prev => [...prev, participant.displayName || 'Unknown']);
      });

      apiRef.current.addEventListener('participantLeft', (participant: any) => {
        console.log('Participant left:', participant);
        setParticipants(prev => prev.filter(p => p !== (participant.displayName || 'Unknown')));
      });

      apiRef.current.addEventListener('videoConferenceJoined', (participant: any) => {
        console.log('Successfully joined the meeting:', participant);
        // Auto-dismiss any authentication dialogs
        setTimeout(() => {
          // Try to click "Log-in" button if it exists to bypass waiting room
          const loginButton = document.querySelector('[data-testid="lobby.button.login"]') || 
                             document.querySelector('button:contains("Log-in")') ||
                             document.querySelector('.login-button');
          if (loginButton) {
            (loginButton as HTMLElement).click();
          }
        }, 1000);
      });

      apiRef.current.addEventListener('videoConferenceLeft', () => {
        console.log('Left the meeting');
        onLeave();
      });

      // Handle authentication/lobby events
      apiRef.current.addEventListener('readyToClose', () => {
        console.log('Ready to close');
        onLeave();
      });

      // Try to auto-join without waiting for moderator
      setTimeout(() => {
        if (apiRef.current) {
          // Execute commands to bypass lobby if possible
          try {
            apiRef.current.executeCommand('toggleLobby', false);
          } catch (error) {
            console.log('Could not disable lobby:', error);
          }
        }
      }, 2000);
    };

    // Load Jitsi Meet API
    if (!window.JitsiMeetExternalAPI) {
      const script = document.createElement('script');
      script.src = 'https://meet.jit.si/external_api.js';
      script.async = true;
      script.onload = initJitsi;
      document.head.appendChild(script);
    } else {
      initJitsi();
    }

    return () => {
      if (apiRef.current) {
        apiRef.current.dispose();
      }
    };
  }, [roomName, displayName, onLeave]);

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
        if (event.error === 'not-allowed') {
          alert('Microphone access is required for transcription. Please allow microphone access and try again.');
        }
      };

      recognitionRef.current.onend = () => {
        if (isTranscribing && isAIEnabled) {
          // Restart recognition if it stops unexpectedly
          setTimeout(() => {
            if (recognitionRef.current && isTranscribing) {
              recognitionRef.current.start();
            }
          }, 1000);
        }
      };
    }
  }, [displayName, isTranscribing, isAIEnabled]);

  const toggleAI = async () => {
    if (!isAIEnabled) {
      // Request microphone permission
      try {
        await navigator.mediaDevices.getUserMedia({ audio: true });
        setIsAIEnabled(true);
        startTranscription();
      } catch (error) {
        alert('Microphone access is required for AI features. Please allow microphone access.');
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
          participants: participants,
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
            <span>{participants.length + 1} participants</span>
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
        {/* Jitsi Meeting Container */}
        <div className="flex-1 relative">
          <div ref={jitsiContainerRef} className="w-full h-full" />
          
          {/* AI Status Overlay */}
          {isAIEnabled && (
            <div className="absolute top-4 left-4 glass-panel px-3 py-2 rounded-lg">
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
            <div className="absolute top-4 right-4 glass-panel px-3 py-2 rounded-lg">
              <div className="flex items-center space-x-2">
                <div className="w-4 h-4 border-2 border-gold-text border-t-transparent rounded-full animate-spin" />
                <span className="text-sm text-primary">Processing...</span>
              </div>
            </div>
          )}

          {/* Instructions Overlay for Authentication Issues */}
          <div className="absolute bottom-4 left-4 right-4">
            <div className="glass-panel p-4 rounded-lg border-yellow-500/50 bg-yellow-500/10">
              <p className="text-yellow-400 text-sm">
                💡 <strong>Tip:</strong> If you see a "Waiting for authenticated user" message, click "Log-in" to join as a guest, or wait a moment for the meeting to start automatically.
              </p>
            </div>
          </div>
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
    </div>
  );
};

export default JitsiMeeting;