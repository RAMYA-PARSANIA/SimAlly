import React, { useEffect, useRef, useState } from 'react';
import { ArrowLeft, Copy, Users, Mic, MicOff, Video, VideoOff, PhoneOff, Monitor, MessageSquare } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import ThemeToggle from './ThemeToggle';
import Button from './ui/Button';

interface JitsiMeetingProps {
  meetingId: string;
  displayName: string;
  onLeave?: () => void;
}

declare global {
  interface Window {
    JitsiMeetExternalAPI: any;
  }
}

const JitsiMeeting: React.FC<JitsiMeetingProps> = ({ meetingId, displayName, onLeave }) => {
  const navigate = useNavigate();
  const jitsiContainerRef = useRef<HTMLDivElement>(null);
  const apiRef = useRef<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [participants, setParticipants] = useState<number>(0);
  const [isMuted, setIsMuted] = useState(false);
  const [isVideoOff, setIsVideoOff] = useState(false);

  useEffect(() => {
    const initializeJitsi = async () => {
      try {
        setIsLoading(true);
        setError(null);

        // Load Jitsi Meet API script from their CDN
        await loadJitsiScript();
        
        if (jitsiContainerRef.current && window.JitsiMeetExternalAPI) {
          // Clean up any existing instance
          if (apiRef.current) {
            apiRef.current.dispose();
          }

          // Use Jitsi Meet's free public instance
          const domain = 'meet.jit.si';
          
          const options = {
            roomName: `SimAlly-${meetingId}`,
            width: '100%',
            height: '100%',
            parentNode: jitsiContainerRef.current,
            userInfo: {
              displayName: displayName,
              email: '' // Leave empty to avoid auth requirements
            },
            configOverwrite: {
              // Disable authentication requirements
              enableUserRolesBasedOnToken: false,
              requireDisplayName: false,
              enableWelcomePage: false,
              enableClosePage: false,
              disableDeepLinking: true,
              
              // Meeting settings
              startWithAudioMuted: false,
              startWithVideoMuted: false,
              prejoinPageEnabled: false,
              
              // Disable features that might require auth
              disableInviteFunctions: false,
              doNotStoreRoom: true,
              disableRemoteMute: false,
              
              // UI customization
              defaultLanguage: 'en',
              disableThirdPartyRequests: true,
              
              // Toolbar configuration
              toolbarButtons: [
                'microphone',
                'camera',
                'closedcaptions',
                'desktop',
                'fullscreen',
                'fodeviceselection',
                'hangup',
                'profile',
                'chat',
                'raisehand',
                'videoquality',
                'filmstrip',
                'invite',
                'stats',
                'shortcuts',
                'tileview',
                'videobackgroundblur',
                'help'
              ],
              
              // Disable problematic features
              disableModeratorIndicator: false,
              startScreenSharing: false,
              channelLastN: -1,
              
              // Performance settings
              resolution: 720,
              constraints: {
                video: {
                  aspectRatio: 16 / 9,
                  height: {
                    ideal: 720,
                    max: 720,
                    min: 240
                  }
                }
              }
            },
            interfaceConfigOverwrite: {
              // Branding
              SHOW_JITSI_WATERMARK: false,
              SHOW_WATERMARK_FOR_GUESTS: false,
              SHOW_BRAND_WATERMARK: false,
              BRAND_WATERMARK_LINK: '',
              SHOW_POWERED_BY: false,
              APP_NAME: 'SimAlly Meeting',
              NATIVE_APP_NAME: 'SimAlly Meeting',
              PROVIDER_NAME: 'SimAlly',
              
              // UI settings
              DISPLAY_WELCOME_PAGE_CONTENT: false,
              DISPLAY_WELCOME_PAGE_TOOLBAR_ADDITIONAL_CONTENT: false,
              LANG_DETECTION: true,
              CONNECTION_INDICATOR_AUTO_HIDE_ENABLED: true,
              CONNECTION_INDICATOR_AUTO_HIDE_TIMEOUT: 5000,
              FILM_STRIP_MAX_HEIGHT: 120,
              ENABLE_FEEDBACK_ANIMATION: false,
              MOBILE_APP_PROMO: false,
              
              // Disable problematic UI elements
              SETTINGS_SECTIONS: ['devices', 'language', 'moderator', 'profile', 'calendar'],
              TOOLBAR_TIMEOUT: 4000,
              INITIAL_TOOLBAR_TIMEOUT: 20000,
              TOOLBAR_ALWAYS_VISIBLE: false,
              
              // Colors and styling
              AUDIO_LEVEL_PRIMARY_COLOR: 'rgba(255,255,255,0.4)',
              AUDIO_LEVEL_SECONDARY_COLOR: 'rgba(255,255,255,0.2)',
              
              // Disable authentication-related features
              AUTHENTICATION_ENABLE: false,
              GUEST_PROMOTION_ENABLE: false,
              
              // Video settings
              LOCAL_THUMBNAIL_RATIO: 16 / 9,
              REMOTE_THUMBNAIL_RATIO: 1,
              
              // Notification settings
              ENFORCE_NOTIFICATION_AUTO_DISMISS_TIMEOUT: 15000
            }
          };

          console.log('Initializing Jitsi with options:', options);
          apiRef.current = new window.JitsiMeetExternalAPI(domain, options);

          // Event listeners
          apiRef.current.addEventListener('readyToClose', () => {
            console.log('Jitsi ready to close');
            handleLeave();
          });

          apiRef.current.addEventListener('participantLeft', (participant: any) => {
            console.log('Participant left:', participant);
            setParticipants(prev => Math.max(0, prev - 1));
          });

          apiRef.current.addEventListener('participantJoined', (participant: any) => {
            console.log('Participant joined:', participant);
            setParticipants(prev => prev + 1);
          });

          apiRef.current.addEventListener('videoConferenceJoined', (participant: any) => {
            console.log('Conference joined:', participant);
            setIsLoading(false);
            setParticipants(1); // Self joined
          });

          apiRef.current.addEventListener('videoConferenceLeft', () => {
            console.log('Conference left');
            handleLeave();
          });

          apiRef.current.addEventListener('audioMuteStatusChanged', (event: any) => {
            setIsMuted(event.muted);
          });

          apiRef.current.addEventListener('videoMuteStatusChanged', (event: any) => {
            setIsVideoOff(event.muted);
          });

          // Handle errors
          apiRef.current.addEventListener('participantRoleChanged', (event: any) => {
            console.log('Participant role changed:', event);
          });

          // Set loading to false after a timeout if conference doesn't join
          setTimeout(() => {
            if (isLoading) {
              setIsLoading(false);
            }
          }, 10000);
        }
      } catch (error) {
        console.error('Failed to initialize Jitsi:', error);
        setError('Failed to load meeting. Please try again.');
        setIsLoading(false);
      }
    };

    initializeJitsi();

    // Cleanup on unmount
    return () => {
      if (apiRef.current) {
        try {
          apiRef.current.dispose();
        } catch (e) {
          console.error('Error disposing Jitsi API:', e);
        }
        apiRef.current = null;
      }
    };
  }, [meetingId, displayName]);

  const loadJitsiScript = (): Promise<void> => {
    return new Promise((resolve, reject) => {
      if (window.JitsiMeetExternalAPI) {
        resolve();
        return;
      }

      const script = document.createElement('script');
      script.src = 'https://meet.jit.si/external_api.js';
      script.async = true;
      script.onload = () => {
        console.log('Jitsi script loaded successfully');
        resolve();
      };
      script.onerror = (error) => {
        console.error('Failed to load Jitsi script:', error);
        reject(new Error('Failed to load Jitsi Meet'));
      };
      document.head.appendChild(script);
    });
  };

  const handleLeave = () => {
    if (apiRef.current) {
      try {
        apiRef.current.dispose();
      } catch (e) {
        console.error('Error disposing Jitsi API:', e);
      }
      apiRef.current = null;
    }
    if (onLeave) {
      onLeave();
    } else {
      navigate('/assistant');
    }
  };

  const handleBack = () => {
    if (apiRef.current) {
      try {
        apiRef.current.executeCommand('hangup');
      } catch (e) {
        console.error('Error hanging up:', e);
        handleLeave();
      }
    } else {
      handleLeave();
    }
  };

  const copyMeetingLink = () => {
    const link = `${window.location.origin}/meeting/${meetingId}`;
    navigator.clipboard.writeText(link).then(() => {
      // You could add a toast notification here
      console.log('Meeting link copied to clipboard');
    });
  };

  const toggleMute = () => {
    if (apiRef.current) {
      apiRef.current.executeCommand('toggleAudio');
    }
  };

  const toggleVideo = () => {
    if (apiRef.current) {
      apiRef.current.executeCommand('toggleVideo');
    }
  };

  const toggleScreenShare = () => {
    if (apiRef.current) {
      apiRef.current.executeCommand('toggleShareScreen');
    }
  };

  const toggleChat = () => {
    if (apiRef.current) {
      apiRef.current.executeCommand('toggleChat');
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
                  Room: {meetingId} • {participants} participant{participants !== 1 ? 's' : ''}
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
                    className="glass-panel p-2 rounded-lg glass-panel-hover"
                    title="Share screen"
                  >
                    <Monitor className="w-4 h-4 text-secondary" />
                  </button>
                  
                  <button
                    onClick={toggleChat}
                    className="glass-panel p-2 rounded-lg glass-panel-hover"
                    title="Toggle chat"
                  >
                    <MessageSquare className="w-4 h-4 text-secondary" />
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
                <div className="w-2 h-2 rounded-full bg-green-500" />
                <span className="text-xs text-secondary">Jitsi Meet (Free)</span>
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
            <h3 className="text-xl font-bold text-primary mb-2">Connecting to Meeting...</h3>
            <p className="text-secondary">Setting up your free video conference</p>
          </div>
        </div>
      )}

      {/* Jitsi Meet Container */}
      <div className="flex-1 relative">
        <div 
          ref={jitsiContainerRef}
          className="w-full h-full"
          style={{ minHeight: 'calc(100vh - 80px)' }}
        />
      </div>
    </div>
  );
};

export default JitsiMeeting;