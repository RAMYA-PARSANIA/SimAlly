import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Mic, MicOff, Video, VideoOff, PhoneOff, Settings, Users, MessageSquare, Share2, Copy, Check, AlertCircle } from 'lucide-react';
import Button from './ui/Button';

interface GoogleMeetComponentProps {
  roomName: string;
  displayName: string;
  onLeave: () => void;
}

const GoogleMeetComponent: React.FC<GoogleMeetComponentProps> = ({ roomName, displayName, onLeave }) => {
  const [isMuted, setIsMuted] = useState(false);
  const [isVideoOff, setIsVideoOff] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const [isConnecting, setIsConnecting] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [meetLink, setMeetLink] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showParticipants, setShowParticipants] = useState(false);
  const [participantCount, setParticipantCount] = useState(1);

  useEffect(() => {
    // Create a Google Meet meeting
    const createMeeting = async () => {
      try {
        setIsConnecting(true);
        
        // In a real implementation, this would call your backend API to create a Google Meet meeting
        // For now, we'll simulate the API call with a timeout
        setTimeout(() => {
          // Generate a fake Google Meet link based on the room name
          const meetLink = `https://meet.google.com/${roomName.replace(/[^a-zA-Z0-9]/g, '').substring(0, 10)}-${Math.random().toString(36).substring(2, 7)}-${Math.random().toString(36).substring(2, 7)}`;
          setMeetLink(meetLink);
          setIsConnected(true);
          setIsConnecting(false);
        }, 2000);
      } catch (error) {
        console.error('Error creating Google Meet meeting:', error);
        setError('Failed to create Google Meet meeting. Please try again.');
        setIsConnecting(false);
      }
    };

    createMeeting();

    // Cleanup function
    return () => {
      // In a real implementation, you might want to end the meeting or perform other cleanup
    };
  }, [roomName]);

  const toggleMute = () => {
    setIsMuted(!isMuted);
  };

  const toggleVideo = () => {
    setIsVideoOff(!isVideoOff);
  };

  const copyMeetingLink = async () => {
    if (meetLink) {
      try {
        await navigator.clipboard.writeText(meetLink);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      } catch (error) {
        console.error('Failed to copy meeting link:', error);
      }
    }
  };

  const joinMeeting = () => {
    if (meetLink) {
      window.open(meetLink, '_blank');
    }
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

  // If connecting, show loading screen
  if (isConnecting) {
    return (
      <div className="min-h-screen bg-primary flex items-center justify-center">
        <div className="glass-panel rounded-2xl p-8 max-w-md mx-auto text-center">
          <div className="animate-spin w-12 h-12 border-4 border-gold-text border-t-transparent rounded-full mx-auto mb-6"></div>
          <h3 className="text-xl font-bold text-primary mb-4">Creating Meeting</h3>
          <p className="text-secondary mb-2">Setting up your Google Meet session...</p>
          <p className="text-xs text-secondary">Room: {roomName}</p>
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
    <div className="min-h-screen bg-primary flex flex-col">
      {/* Main Content Area */}
      <div className="flex-1 p-4 relative">
        <div className="max-w-4xl mx-auto glass-panel rounded-2xl p-8 h-full flex flex-col items-center justify-center">
          <div className="w-24 h-24 rounded-full bg-gradient-gold-silver flex items-center justify-center mb-8">
            <Video className="w-12 h-12 text-white" />
          </div>
          
          <h2 className="text-2xl font-bold text-primary mb-4">Your Google Meet is Ready!</h2>
          
          <p className="text-secondary mb-8 text-center max-w-lg">
            Your meeting has been created and is ready to join. You can share the link with others or join the meeting directly.
          </p>
          
          {meetLink && (
            <div className="w-full max-w-lg mb-8">
              <div className="flex items-center space-x-2 mb-2">
                <div className="flex-1 glass-panel rounded-lg p-3 text-primary overflow-hidden overflow-ellipsis">
                  {meetLink}
                </div>
                <Button
                  onClick={copyMeetingLink}
                  variant="ghost"
                  size="sm"
                  className="p-2"
                >
                  {copied ? <Check className="w-5 h-5 text-green-500" /> : <Copy className="w-5 h-5" />}
                </Button>
              </div>
              <p className="text-xs text-secondary">
                Share this link with others to invite them to your meeting
              </p>
            </div>
          )}
          
          <div className="flex space-x-4">
            <Button
              onClick={joinMeeting}
              variant="premium"
              size="lg"
              className="flex items-center space-x-2"
            >
              <Video className="w-5 h-5" />
              <span>Join Meeting</span>
            </Button>
            
            <Button
              onClick={onLeave}
              variant="secondary"
              size="lg"
            >
              Go Back
            </Button>
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
              onClick={onLeave}
              className="glass-panel p-4 rounded-full glass-panel-hover bg-red-500/20 border-red-500/50 hover:bg-red-500/30"
            >
              <PhoneOff className="w-6 h-6 text-red-400" />
            </button>
          </div>
          
          <div className="flex items-center space-x-2">
            <Button
              onClick={copyMeetingLink}
              variant="ghost"
              size="sm"
              className="p-2"
            >
              {copied ? <Check className="w-5 h-5 text-green-500" /> : <Share2 className="w-5 h-5 text-primary" />}
            </Button>
            
            <Button
              variant="ghost"
              size="sm"
              className="p-2"
            >
              <MessageSquare className="w-5 h-5 text-primary" />
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
                  <h4 className="font-medium text-primary mb-2">Meeting Link</h4>
                  <div className="flex items-center space-x-2">
                    <input
                      type="text"
                      value={meetLink || ''}
                      readOnly
                      className="w-full glass-panel rounded-lg px-4 py-2 text-primary"
                    />
                    <Button
                      onClick={copyMeetingLink}
                      variant="ghost"
                      size="sm"
                    >
                      {copied ? <Check className="w-4 h-4 text-green-500" /> : <Copy className="w-4 h-4" />}
                    </Button>
                  </div>
                </div>
                
                <div>
                  <h4 className="font-medium text-primary mb-2">Connection Status</h4>
                  <div className="glass-panel rounded-lg p-3">
                    <div className="flex items-center space-x-2 mb-2">
                      <div className={`w-3 h-3 rounded-full ${isConnected ? 'bg-green-500' : 'bg-red-500'}`}></div>
                      <span className="text-sm text-primary">{isConnected ? 'Meeting Ready' : 'Not Connected'}</span>
                    </div>
                    <div className="text-xs text-secondary">
                      <p>Room: {roomName}</p>
                      <p>Display Name: {displayName}</p>
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
                <h3 className="text-xl font-bold gradient-gold-silver">Participants (1)</h3>
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

export default GoogleMeetComponent;