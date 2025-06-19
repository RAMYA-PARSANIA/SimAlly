import React, { useEffect, useRef } from 'react';
import { ArrowLeft } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import ThemeToggle from './ThemeToggle';

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

  useEffect(() => {
    // Load Jitsi Meet API script
    const loadJitsiScript = () => {
      return new Promise((resolve, reject) => {
        if (window.JitsiMeetExternalAPI) {
          resolve(window.JitsiMeetExternalAPI);
          return;
        }

        const script = document.createElement('script');
        script.src = 'https://meet.jit.si/external_api.js';
        script.async = true;
        script.onload = () => resolve(window.JitsiMeetExternalAPI);
        script.onerror = reject;
        document.head.appendChild(script);
      });
    };

    const initializeJitsi = async () => {
      try {
        await loadJitsiScript();
        
        if (jitsiContainerRef.current && window.JitsiMeetExternalAPI) {
          // Clean up any existing instance
          if (apiRef.current) {
            apiRef.current.dispose();
          }

          const options = {
            roomName: meetingId,
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
              enableUserRolesBasedOnToken: false,
              enableEmailInStats: false,
              enableClosePage: false,
              disableDeepLinking: true,
              prejoinPageEnabled: false,
              disableInviteFunctions: true,
              doNotStoreRoom: true,
              disableRemoteMute: true,
              remoteVideoMenu: {
                disableKick: true,
                disableGrantModerator: true
              },
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
                'recording',
                'livestreaming',
                'etherpad',
                'sharedvideo',
                'settings',
                'raisehand',
                'videoquality',
                'filmstrip',
                'invite',
                'feedback',
                'stats',
                'shortcuts',
                'tileview',
                'videobackgroundblur',
                'download',
                'help',
                'mute-everyone',
                'security'
              ]
            },
            interfaceConfigOverwrite: {
              SHOW_JITSI_WATERMARK: false,
              SHOW_WATERMARK_FOR_GUESTS: false,
              SHOW_BRAND_WATERMARK: false,
              BRAND_WATERMARK_LINK: '',
              SHOW_POWERED_BY: false,
              DISPLAY_WELCOME_PAGE_CONTENT: false,
              DISPLAY_WELCOME_PAGE_TOOLBAR_ADDITIONAL_CONTENT: false,
              APP_NAME: 'SimAlly Meeting',
              NATIVE_APP_NAME: 'SimAlly Meeting',
              PROVIDER_NAME: 'SimAlly',
              LANG_DETECTION: true,
              CONNECTION_INDICATOR_AUTO_HIDE_ENABLED: true,
              CONNECTION_INDICATOR_AUTO_HIDE_TIMEOUT: 5000,
              MAXIMUM_ZOOMING_COEFFICIENT: 1.3,
              FILM_STRIP_MAX_HEIGHT: 120,
              ENABLE_FEEDBACK_ANIMATION: false,
              DISABLE_FOCUS_INDICATOR: false,
              DISABLE_DOMINANT_SPEAKER_INDICATOR: false,
              DISABLE_TRANSCRIPTION_SUBTITLES: false,
              DISABLE_RINGING: false,
              AUDIO_LEVEL_PRIMARY_COLOR: 'rgba(255,255,255,0.4)',
              AUDIO_LEVEL_SECONDARY_COLOR: 'rgba(255,255,255,0.2)',
              POLICY_LOGO: null,
              LOCAL_THUMBNAIL_RATIO: 16 / 9,
              REMOTE_THUMBNAIL_RATIO: 1,
              LIVE_STREAMING_HELP_LINK: 'https://jitsi.org/live',
              MOBILE_APP_PROMO: false,
              ENFORCE_NOTIFICATION_AUTO_DISMISS_TIMEOUT: 15000,
              INDICATOR_FONT_SIZES: {
                1: 12,
                5: 14,
                plus5: 16
              },
              MOBILE_DYNAMIC_LINK: {
                APN: 'org.jitsi.meet',
                APP_CODE: 'w2atb',
                CUSTOM_DOMAIN: undefined,
                IBI: 'com.atlassian.JitsiMeet.ios',
                ISI: '1165103905'
              }
            }
          };

          apiRef.current = new window.JitsiMeetExternalAPI('meet.jit.si', options);

          // Event listeners
          apiRef.current.addEventListener('readyToClose', () => {
            handleLeave();
          });

          apiRef.current.addEventListener('participantLeft', (participant: any) => {
            console.log('Participant left:', participant);
          });

          apiRef.current.addEventListener('participantJoined', (participant: any) => {
            console.log('Participant joined:', participant);
          });

          apiRef.current.addEventListener('videoConferenceJoined', (participant: any) => {
            console.log('Conference joined:', participant);
          });

          apiRef.current.addEventListener('videoConferenceLeft', () => {
            console.log('Conference left');
            handleLeave();
          });
        }
      } catch (error) {
        console.error('Failed to initialize Jitsi:', error);
      }
    };

    initializeJitsi();

    // Cleanup on unmount
    return () => {
      if (apiRef.current) {
        apiRef.current.dispose();
        apiRef.current = null;
      }
    };
  }, [meetingId, displayName]);

  const handleLeave = () => {
    if (apiRef.current) {
      apiRef.current.dispose();
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
      apiRef.current.executeCommand('hangup');
    } else {
      handleLeave();
    }
  };

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
                  Room: {meetingId}
                </p>
              </div>
            </div>
            
            <div className="flex items-center space-x-3">
              <div className="flex items-center space-x-2">
                <div className="w-2 h-2 rounded-full bg-green-500" />
                <span className="text-xs text-secondary">Jitsi Meet</span>
              </div>
              <ThemeToggle />
            </div>
          </div>
        </div>
      </header>

      {/* Jitsi Meet Container */}
      <div className="flex-1">
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