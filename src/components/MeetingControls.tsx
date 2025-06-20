import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Video, Users, Plus, LogIn, ArrowRight, Copy, Check } from 'lucide-react';
import GlassCard from './ui/GlassCard';
import Button from './ui/Button';

interface MeetingControlsProps {
  onStartMeeting: (roomName: string, displayName: string) => void;
  onJoinMeeting: (roomName: string, displayName: string) => void;
}

const MeetingControls: React.FC<MeetingControlsProps> = ({ onStartMeeting, onJoinMeeting }) => {
  const [showStartModal, setShowStartModal] = useState(false);
  const [showJoinModal, setShowJoinModal] = useState(false);
  const [displayName, setDisplayName] = useState('');
  const [roomName, setRoomName] = useState('');
  const [generatedRoom, setGeneratedRoom] = useState('');
  const [copied, setCopied] = useState(false);

  const generateRoomName = () => {
    const adjectives = ['swift', 'bright', 'clever', 'dynamic', 'focused', 'creative', 'efficient', 'innovative'];
    const nouns = ['meeting', 'session', 'conference', 'discussion', 'workshop', 'sync', 'huddle', 'standup'];
    const randomNum = Math.floor(Math.random() * 1000);
    
    const adjective = adjectives[Math.floor(Math.random() * adjectives.length)];
    const noun = nouns[Math.floor(Math.random() * nouns.length)];
    
    return `${adjective}-${noun}-${randomNum}`;
  };

  const handleStartMeeting = () => {
    const room = generatedRoom || generateRoomName();
    setGeneratedRoom(room);
    
    if (displayName.trim()) {
      onStartMeeting(room, displayName.trim());
      setShowStartModal(false);
      setDisplayName('');
      setGeneratedRoom('');
    }
  };

  const handleJoinMeeting = () => {
    if (roomName.trim() && displayName.trim()) {
      onJoinMeeting(roomName.trim(), displayName.trim());
      setShowJoinModal(false);
      setDisplayName('');
      setRoomName('');
    }
  };

  const copyRoomName = async () => {
    if (generatedRoom) {
      try {
        await navigator.clipboard.writeText(generatedRoom);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      } catch (error) {
        console.error('Failed to copy room name:', error);
      }
    }
  };

  const openStartModal = () => {
    setGeneratedRoom(generateRoomName());
    setShowStartModal(true);
  };

  return (
    <>
      {/* Meeting Controls */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-4xl mx-auto">
        {/* Start Meeting */}
        <motion.div
          initial={{ y: 50, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.2 }}
        >
          <GlassCard className="p-8 text-center" hover goldBorder>
            <div className="w-16 h-16 rounded-full bg-gradient-to-r from-green-500 to-emerald-500 flex items-center justify-center mx-auto mb-6">
              <Video className="w-8 h-8 text-white" />
            </div>
            <h3 className="text-xl font-bold text-primary mb-4">Start New Meeting</h3>
            <p className="text-secondary mb-6 text-sm">
              Create a new meeting room and invite others to join your video conference with AI assistance.
            </p>
            <Button
              onClick={openStartModal}
              variant="premium"
              className="w-full flex items-center justify-center space-x-2"
            >
              <Plus className="w-4 h-4" />
              <span>Start Meeting</span>
            </Button>
          </GlassCard>
        </motion.div>

        {/* Join Meeting */}
        <motion.div
          initial={{ y: 50, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.4 }}
        >
          <GlassCard className="p-8 text-center" hover goldBorder>
            <div className="w-16 h-16 rounded-full bg-gradient-to-r from-blue-500 to-cyan-500 flex items-center justify-center mx-auto mb-6">
              <Users className="w-8 h-8 text-white" />
            </div>
            <h3 className="text-xl font-bold text-primary mb-4">Join Meeting</h3>
            <p className="text-secondary mb-6 text-sm">
              Enter a meeting room name to join an existing video conference with AI-powered features.
            </p>
            <Button
              onClick={() => setShowJoinModal(true)}
              variant="secondary"
              className="w-full flex items-center justify-center space-x-2"
            >
              <LogIn className="w-4 h-4" />
              <span>Join Meeting</span>
            </Button>
          </GlassCard>
        </motion.div>
      </div>

      {/* Start Meeting Modal */}
      {showStartModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="w-full max-w-md"
          >
            <GlassCard className="p-8" goldBorder>
              <h2 className="text-2xl font-bold gradient-gold-silver mb-6">Start New Meeting</h2>
              
              <div className="space-y-6">
                <div>
                  <label className="block text-sm font-medium text-primary mb-2">
                    Your Display Name
                  </label>
                  <input
                    type="text"
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    placeholder="Enter your name"
                    className="w-full glass-panel rounded-lg px-4 py-3 text-primary placeholder-secondary focus:outline-none focus:ring-2 focus:ring-yellow-500"
                    autoFocus
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-primary mb-2">
                    Meeting Room Name
                  </label>
                  <div className="flex space-x-2">
                    <input
                      type="text"
                      value={generatedRoom}
                      onChange={(e) => setGeneratedRoom(e.target.value)}
                      placeholder="Auto-generated room name"
                      className="flex-1 glass-panel rounded-lg px-4 py-3 text-primary placeholder-secondary focus:outline-none focus:ring-2 focus:ring-yellow-500"
                    />
                    <Button
                      onClick={copyRoomName}
                      variant="ghost"
                      size="sm"
                      className="px-3"
                    >
                      {copied ? <Check className="w-4 h-4 text-green-500" /> : <Copy className="w-4 h-4" />}
                    </Button>
                  </div>
                  <p className="text-xs text-secondary mt-1">
                    Share this room name with others to invite them
                  </p>
                </div>

                <div className="flex space-x-4">
                  <Button
                    onClick={() => setShowStartModal(false)}
                    variant="secondary"
                    className="flex-1"
                  >
                    Cancel
                  </Button>
                  <Button
                    onClick={handleStartMeeting}
                    variant="premium"
                    className="flex-1 flex items-center justify-center space-x-2"
                    disabled={!displayName.trim()}
                  >
                    <span>Start Meeting</span>
                    <ArrowRight className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            </GlassCard>
          </motion.div>
        </div>
      )}

      {/* Join Meeting Modal */}
      {showJoinModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="w-full max-w-md"
          >
            <GlassCard className="p-8" goldBorder>
              <h2 className="text-2xl font-bold gradient-gold-silver mb-6">Join Meeting</h2>
              
              <div className="space-y-6">
                <div>
                  <label className="block text-sm font-medium text-primary mb-2">
                    Your Display Name
                  </label>
                  <input
                    type="text"
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    placeholder="Enter your name"
                    className="w-full glass-panel rounded-lg px-4 py-3 text-primary placeholder-secondary focus:outline-none focus:ring-2 focus:ring-yellow-500"
                    autoFocus
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-primary mb-2">
                    Meeting Room Name
                  </label>
                  <input
                    type="text"
                    value={roomName}
                    onChange={(e) => setRoomName(e.target.value)}
                    placeholder="Enter room name to join"
                    className="w-full glass-panel rounded-lg px-4 py-3 text-primary placeholder-secondary focus:outline-none focus:ring-2 focus:ring-yellow-500"
                  />
                </div>

                <div className="flex space-x-4">
                  <Button
                    onClick={() => setShowJoinModal(false)}
                    variant="secondary"
                    className="flex-1"
                  >
                    Cancel
                  </Button>
                  <Button
                    onClick={handleJoinMeeting}
                    variant="premium"
                    className="flex-1 flex items-center justify-center space-x-2"
                    disabled={!displayName.trim() || !roomName.trim()}
                  >
                    <span>Join Meeting</span>
                    <ArrowRight className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            </GlassCard>
          </motion.div>
        </div>
      )}
    </>
  );
};

export default MeetingControls;