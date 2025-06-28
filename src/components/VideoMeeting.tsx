import React, { useState, useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import { Mic, MicOff, Video, VideoOff, PhoneOff, Settings, Users, MessageSquare, Share2, ScreenShare, Shield, AlertCircle } from 'lucide-react';
import { DailyProvider, useDaily, useLocalParticipant, useParticipantIds, useVideoTrack, useAudioTrack, DailyVideo } from '@daily-co/daily-react';
import DailyIframe from '@daily-co/daily-js';
import Button from './ui/Button';

interface VideoMeetingProps {
  roomName: string;
  displayName: string;
  onLeave: () => void;
}

// Main component that wraps the Daily provider
const VideoMeeting: React.FC<VideoMeetingProps> = ({ roomName, displayName, onLeave }) => {
  const [callObject, setCallObject] = useState<any>(null);
  const [appState, setAppState] = useState<'joining' | 'joined' | 'error'>('joining');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    // Create the Daily call object
    const daily = DailyIframe.createCallObject({
      url: `https://simally.daily.co/${roomName}`,
      userName: displayName,
    });

    setCallObject(daily);

    // Set up event listeners
    const events = ['joined-meeting', 'left-meeting', 'error'];

    // Handle events
    const handleEvent = (event: any) => {
      switch (event.action) {
        case 'joined-meeting':
          setAppState('joined');
          break;
        case 'left-meeting':
          onLeave();
          break;
        case 'error':
          setAppState('error');
          setErrorMessage(event.errorMsg);
          break;
        default:
          break;
      }
    };

    // Add event listeners
    events.forEach(event => daily.on(event, handleEvent));

    // Join the call
    daily.join();

    // Clean up
    return () => {
      events.forEach(event => daily.off(event, handleEvent));
      daily.leave();
    };
  }, [roomName, displayName, onLeave]);

  if (appState === 'error') {
    return (
      <div className="min-h-screen bg-primary flex items-center justify-center">
        <div className="glass-panel rounded-2xl p-8 max-w-md mx-auto text-center">
          <AlertCircle className="w-16 h-16 text-red-500 mx-auto mb-6" />
          <h3 className="text-xl font-bold text-primary mb-4">Connection Error</h3>
          <p className="text-secondary mb-6">{errorMessage || 'Failed to connect to the meeting'}</p>
          <Button
            onClick={onLeave}
            variant="premium"
            className="px-6 py-3 rounded-lg"
          >
            Go Back
          </Button>
        </div>
      </div>
    );
  }

  if (appState === 'joining') {
    return (
      <div className="min-h-screen bg-primary flex items-center justify-center">
        <div className="glass-panel rounded-2xl p-8 max-w-md mx-auto text-center">
          <div className="animate-spin w-12 h-12 border-4 border-gold-text border-t-transparent rounded-full mx-auto mb-6"></div>
          <h3 className="text-xl font-bold text-primary mb-4">Joining Meeting</h3>
          <p className="text-secondary mb-2">Connecting to room: {roomName}</p>
          <p className="text-xs text-secondary">You'll join as: {displayName}</p>
          <Button
            onClick={onLeave}
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
    <DailyProvider callObject={callObject}>
      <MeetingContent onLeave={onLeave} />
    </DailyProvider>
  );
};

// Meeting content component that uses Daily hooks
const MeetingContent: React.FC<{ onLeave: () => void }> = ({ onLeave }) => {
  const daily = useDaily();
  const localParticipant = useLocalParticipant();
  const participantIds = useParticipantIds();
  const [isMuted, setIsMuted] = useState(false);
  const [isVideoOff, setIsVideoOff] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showParticipants, setShowParticipants] = useState(false);

  const toggleMute = () => {
    if (daily) {
      daily.setLocalAudio(!isMuted);
      setIsMuted(!isMuted);
    }
  };

  const toggleVideo = () => {
    if (daily) {
      daily.setLocalVideo(!isVideoOff);
      setIsVideoOff(!isVideoOff);
    }
  };

  const handleLeave = () => {
    if (daily) {
      daily.leave();
    }
    onLeave();
  };

  return (
    <div className="min-h-screen bg-primary flex flex-col">
      {/* Main Video Area */}
      <div className="flex-1 p-4 relative">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 h-full">
          {/* Local Participant */}
          <LocalParticipantTile 
            participantId={localParticipant?.session_id || ''} 
            isLocal={true} 
            displayName={localParticipant?.user_name || 'You'} 
            isMuted={isMuted}
            isVideoOff={isVideoOff}
          />

          {/* Remote Participants */}
          {participantIds
            .filter(id => id !== localParticipant?.session_id)
            .map(participantId => (
              <RemoteParticipantTile 
                key={participantId} 
                participantId={participantId} 
              />
            ))}

          {/* Empty slots for visual balance */}
          {Array.from({ length: Math.max(0, 3 - participantIds.length) }).map((_, index) => (
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
              <span className="ml-1">{participantIds.length}</span>
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
                      <div className="w-3 h-3 rounded-full bg-green-500"></div>
                      <span className="text-sm text-primary">Connected</span>
                    </div>
                    <div className="text-xs text-secondary">
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
                <h3 className="text-xl font-bold gradient-gold-silver">Participants ({participantIds.length})</h3>
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
                      <span className="text-white font-bold">{localParticipant?.user_name?.charAt(0).toUpperCase() || 'Y'}</span>
                    </div>
                    <div>
                      <p className="text-primary font-medium">{localParticipant?.user_name || 'You'} (You)</p>
                      <p className="text-xs text-secondary">Host</p>
                    </div>
                  </div>
                  <div className="flex items-center space-x-1">
                    {isMuted && <MicOff className="w-4 h-4 text-red-400" />}
                    {isVideoOff && <VideoOff className="w-4 h-4 text-red-400" />}
                  </div>
                </div>
                
                {/* Remote participants */}
                {participantIds
                  .filter(id => id !== localParticipant?.session_id)
                  .map(id => (
                    <ParticipantListItem key={id} participantId={id} />
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

// Local participant tile component
const LocalParticipantTile: React.FC<{
  participantId: string;
  isLocal: boolean;
  displayName: string;
  isMuted: boolean;
  isVideoOff: boolean;
}> = ({ participantId, isLocal, displayName, isMuted, isVideoOff }) => {
  const videoTrack = useVideoTrack(participantId);
  const videoState = videoTrack?.state;
  const hasVideo = videoState === 'playable' && !isVideoOff;

  return (
    <div className="relative glass-panel rounded-2xl overflow-hidden aspect-video">
      {hasVideo ? (
        <DailyVideo
          automirror
          sessionId={participantId}
          type="video"
          className="w-full h-full object-cover"
        />
      ) : (
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
          {displayName} {isLocal && '(You)'}
        </span>
      </div>
      
      {isMuted && (
        <div className="absolute top-4 right-4 bg-red-500 p-2 rounded-full">
          <MicOff className="w-4 h-4 text-white" />
        </div>
      )}
    </div>
  );
};

// Remote participant tile component
const RemoteParticipantTile: React.FC<{ participantId: string }> = ({ participantId }) => {
  const videoTrack = useVideoTrack(participantId);
  const audioTrack = useAudioTrack(participantId);
  const daily = useDaily();
  const participant = daily?.participants()?.[participantId];
  const displayName = participant?.user_name || 'Participant';
  const isMuted = audioTrack?.state !== 'playable';
  const hasVideo = videoTrack?.state === 'playable';

  return (
    <div className="relative glass-panel rounded-2xl overflow-hidden aspect-video">
      {hasVideo ? (
        <DailyVideo
          sessionId={participantId}
          type="video"
          className="w-full h-full object-cover"
        />
      ) : (
        <div className="absolute inset-0 flex items-center justify-center bg-gray-800">
          <div className="w-20 h-20 rounded-full bg-gradient-to-r from-blue-500 to-purple-500 flex items-center justify-center">
            <span className="text-2xl font-bold text-white">
              {displayName.charAt(0).toUpperCase()}
            </span>
          </div>
        </div>
      )}
      
      <div className="absolute bottom-4 left-4 glass-panel px-4 py-2 rounded-lg">
        <span className="text-primary font-medium flex items-center">
          <span className="w-2 h-2 bg-green-500 rounded-full mr-2"></span>
          {displayName}
        </span>
      </div>
      
      {isMuted && (
        <div className="absolute top-4 right-4 bg-red-500 p-2 rounded-full">
          <MicOff className="w-4 h-4 text-white" />
        </div>
      )}
    </div>
  );
};

// Participant list item for the participants modal
const ParticipantListItem: React.FC<{ participantId: string }> = ({ participantId }) => {
  const daily = useDaily();
  const participant = daily?.participants()?.[participantId];
  const displayName = participant?.user_name || 'Participant';
  const audioTrack = useAudioTrack(participantId);
  const videoTrack = useVideoTrack(participantId);
  const isMuted = audioTrack?.state !== 'playable';
  const isVideoOff = videoTrack?.state !== 'playable';

  return (
    <div className="glass-panel rounded-lg p-3 flex items-center justify-between">
      <div className="flex items-center space-x-3">
        <div className="w-8 h-8 rounded-full bg-gradient-to-r from-blue-500 to-purple-500 flex items-center justify-center">
          <span className="text-white font-bold">{displayName.charAt(0).toUpperCase()}</span>
        </div>
        <div>
          <p className="text-primary font-medium">{displayName}</p>
          <p className="text-xs text-secondary">Participant</p>
        </div>
      </div>
      <div className="flex items-center space-x-1">
        {isMuted && <MicOff className="w-4 h-4 text-red-400" />}
        {isVideoOff && <VideoOff className="w-4 h-4 text-red-400" />}
      </div>
    </div>
  );
};

export default VideoMeeting;