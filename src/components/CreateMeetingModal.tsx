import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Video, X, Loader2 } from 'lucide-react';
import GlassCard from './ui/GlassCard';
import Button from './ui/Button';

interface CreateMeetingModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreateMeeting: (meeting: {
    title: string;
    description: string;
    startTime: string;
    endTime: string;
    participants: string[];
  }) => Promise<void>;
}

const CreateMeetingModal: React.FC<CreateMeetingModalProps> = ({ 
  isOpen, 
  onClose, 
  onCreateMeeting 
}) => {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [startTime, setStartTime] = useState('');
  const [endTime, setEndTime] = useState('');
  const [participants, setParticipants] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!title.trim()) {
      setError('Meeting title is required');
      return;
    }
    
    setError('');
    setIsCreating(true);
    
    try {
      const participantList = participants
        .split(',')
        .map(email => email.trim())
        .filter(email => email && email.includes('@'));
      
      await onCreateMeeting({
        title,
        description,
        startTime,
        endTime,
        participants: participantList
      });
      
      // Reset form
      setTitle('');
      setDescription('');
      setStartTime('');
      setEndTime('');
      setParticipants('');
      
      onClose();
    } catch (err) {
      setError('Failed to create meeting. Please try again.');
      console.error('Error creating meeting:', err);
    } finally {
      setIsCreating(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <motion.div
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.9, opacity: 0 }}
        className="w-full max-w-md"
      >
        <GlassCard className="p-6" goldBorder>
          <div className="flex justify-between items-center mb-6">
            <h3 className="text-xl font-bold gradient-gold-silver">
              Create New Meeting
            </h3>
            <button
              onClick={onClose}
              className="text-secondary hover:text-primary p-2 rounded-lg glass-panel glass-panel-hover"
              disabled={isCreating}
            >
              <X className="w-5 h-5" />
            </button>
          </div>
          
          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <div className="p-3 glass-panel rounded-lg bg-red-500/10 border-red-500/30">
                <p className="text-red-400 text-sm">{error}</p>
              </div>
            )}
            
            <div>
              <label className="block text-sm font-medium text-primary mb-2">
                Meeting Title*
              </label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Team Standup"
                className="w-full glass-panel rounded-lg px-4 py-3 text-primary placeholder-secondary focus:outline-none focus:ring-2 focus:ring-yellow-500"
                required
                autoFocus
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-primary mb-2">
                Description (Optional)
              </label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="What's this meeting about?"
                className="w-full glass-panel rounded-lg px-4 py-3 text-primary placeholder-secondary focus:outline-none focus:ring-2 focus:ring-yellow-500 resize-none"
                rows={3}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-primary mb-2">
                  Start Time (Optional)
                </label>
                <input
                  type="datetime-local"
                  value={startTime}
                  onChange={(e) => setStartTime(e.target.value)}
                  className="w-full glass-panel rounded-lg px-4 py-3 text-primary focus:outline-none focus:ring-2 focus:ring-yellow-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-primary mb-2">
                  End Time (Optional)
                </label>
                <input
                  type="datetime-local"
                  value={endTime}
                  onChange={(e) => setEndTime(e.target.value)}
                  className="w-full glass-panel rounded-lg px-4 py-3 text-primary focus:outline-none focus:ring-2 focus:ring-yellow-500"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-primary mb-2">
                Participants (Optional)
              </label>
              <input
                type="text"
                value={participants}
                onChange={(e) => setParticipants(e.target.value)}
                placeholder="email1@example.com, email2@example.com"
                className="w-full glass-panel rounded-lg px-4 py-3 text-primary placeholder-secondary focus:outline-none focus:ring-2 focus:ring-yellow-500"
              />
              <p className="text-xs text-secondary mt-1">
                Separate multiple emails with commas
              </p>
            </div>

            <div className="flex space-x-4 mt-6">
              <Button
                type="button"
                onClick={onClose}
                variant="secondary"
                className="flex-1"
                disabled={isCreating}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                variant="premium"
                className="flex-1 flex items-center justify-center space-x-2"
                disabled={!title.trim() || isCreating}
              >
                {isCreating ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Video className="w-4 h-4" />
                )}
                <span>{isCreating ? 'Creating...' : 'Create Meeting'}</span>
              </Button>
            </div>
          </form>
        </GlassCard>
      </motion.div>
    </div>
  );
};

export default CreateMeetingModal;