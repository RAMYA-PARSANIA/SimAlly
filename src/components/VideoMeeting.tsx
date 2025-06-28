import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Mic, MicOff, Video, VideoOff, PhoneOff, Settings, Users, Share2, ScreenShare, Shield, AlertCircle } from 'lucide-react';
import Button from './ui/Button';

interface VideoMeetingProps {
  roomName: string;
  displayName: string;
  onLeave: () => void;
}

const VideoMeeting: React.FC<VideoMeetingProps> = ({ roomName, displayName, onLeave }) => {
  const [isMuted, setIsMuted] = useState(false);
  const [isVideoOff, setIsVideoOff] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showParticipants, setShowParticipants] = useState(false);
  
  // Placeholder for participants - in a real implementation, this would come from the video service
  const participants = [
    { id: '1', name: displayName, isLocal: true, isMuted, isVideoOff },
    { id: '2', name: 'Demo Participant', isLocal: false, isMuted: false, isVideoOff: false }
  ];

  const toggleMute = () => {
    setIsMuted(!isMuted);
  };

  const toggleVideo = () => {
    setIsVideoOff(!isVideoOff);
  };

  return (
    <div className="min-h-screen bg-primary flex flex-col">
      {/* Main Video Area */}
      <div className="flex-1 p-4 relative">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 h-full">
          {/* Local Participant */}
          <div className="relative glass-panel rounded-2xl overflow-hidden aspect-video">
            {/* Placeholder for video - in a real implementation, this would be a video element */}
            <div className={`absolute inset-0 flex items-center justify-center bg-gray-800 ${isVideoOff ? 'visible' : 'hidden'}`}>
              <div className="w-20 h-20 rounded-full bg-gradient-gold-silver flex items-center justify-center">
                <span className="text-2xl font-bold text-white">
                  {displayName.charAt(0).toUpperCase()}
                </span>
              </div>
            </div>
            
            {/* Placeholder for video when enabled */}
            <div className={`absolute inset-0 bg-gradient-to-r from-blue-500/20 to-purple-500/20 flex items-center justify-center ${isVideoOff ? 'hidden' : 'visible'}`}>
              <span className="text-white text-opacity-70">Video Preview (Placeholder)</span>
            </div>
            
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

          {/* Remote Participant (Demo) */}
          <div className="relative glass-panel rounded-2xl overflow-hidden aspect-video">
            {/* Placeholder for remote video */}
            <div className="absolute inset-0 bg-gradient-to-r from-purple-500/20 to-pink-500/20 flex items-center justify-center">
              <div className="w-20 h-20 rounded-full bg-gradient-to-r from-blue-500 to-purple-500 flex items-center justify-center">
                <span className="text-2xl font-bold text-white">D</span>
              </div>
            </div>
            
            <div className="absolute bottom-4 left-4 glass-panel px-4 py-2 rounded-lg">
              <span className="text-primary font-medium flex items-center">
                <span className="w-2 h-2 bg-green-500 rounded-full mr-2"></span>
                Demo Participant
              </span>
            </div>
          </div>

          {/* Empty slot for visual balance */}
          <div className="glass-panel rounded-2xl overflow-hidden aspect-video bg-opacity-30 flex items-center justify-center">
            <Users className="w-12 h-12 text-secondary opacity-30" />
          </div>
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
              <span className="ml-1">{participants.length}</span>
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
              onClick={onLeave}
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
                    disabled
                  >
                    <option value="default">Default Microphone</option>
                  </select>
                </div>
                
                <div>
                  <h4 className="font-medium text-primary mb-2">Video</h4>
                  <select
                    className="w-full glass-panel rounded-lg px-4 py-2 text-primary"
                    disabled
                  >
                    <option value="default">Default Camera</option>
                  </select>
                </div>
                
                <div>
                  <h4 className="font-medium text-primary mb-2">Connection Status</h4>
                  <div className="glass-panel rounded-lg p-3">
                    <div className="flex items-center space-x-2 mb-2">
                      <div className="w-3 h-3 rounded-full bg-yellow-500"></div>
                      <span className="text-sm text-primary">Demo Mode</span>
                    </div>
                    <div className="text-xs text-secondary">
                      <p>Video functionality is currently disabled</p>
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
                <h3 className="text-xl font-bold gradient-gold-silver">Participants ({participants.length})</h3>
                <button
                  onClick={() => setShowParticipants(false)}
                  className="text-secondary hover:text-primary"
                >
                  ×
                </button>
              </div>
              
              <div className="space-y-2 max-h-80 overflow-y-auto">
                {participants.map(participant => (
                  <div key={participant.id} className="glass-panel rounded-lg p-3 flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                      <div className={`w-8 h-8 rounded-full ${
                        participant.isLocal 
                          ? 'bg-gradient-gold-silver' 
                          : 'bg-gradient-to-r from-blue-500 to-purple-500'
                      } flex items-center justify-center`}>
                        <span className="text-white font-bold">{participant.name.charAt(0).toUpperCase()}</span>
                      </div>
                      <div>
                        <p className="text-primary font-medium">{participant.name} {participant.isLocal && '(You)'}</p>
                        <p className="text-xs text-secondary">{participant.isLocal ? 'Host' : 'Participant'}</p>
                      </div>
                    </div>
                    <div className="flex items-center space-x-1">
                      {participant.isMuted && <MicOff className="w-4 h-4 text-red-400" />}
                      {participant.isVideoOff && <VideoOff className="w-4 h-4 text-red-400" />}
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

      {/* Demo Mode Notice */}
      <div className="fixed bottom-4 left-4 glass-panel p-3 rounded-lg bg-yellow-500/10 border-yellow-500/30">
        <div className="flex items-center space-x-2">
          <AlertCircle className="w-4 h-4 text-yellow-500" />
          <span className="text-sm text-yellow-500">Demo Mode: Video functionality is disabled</span>
        </div>
      </div>
    </div>
  );
};

export default VideoMeeting;