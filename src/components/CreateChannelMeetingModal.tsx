import React, { useState } from 'react';
import { X, Video, FileText, Clock, Users } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import GlassCard from './ui/GlassCard';
import Button from './ui/Button';

interface CreateChannelMeetingModalProps {
  channelId: string;
  channelName: string;
  onClose: () => void;
  onCreateMeeting: (channelId: string, title: string, description: string) => void;
}

const CreateChannelMeetingModal: React.FC<CreateChannelMeetingModalProps> = ({
  channelId,
  channelName,
  onClose,
  onCreateMeeting
}) => {
  const { user } = useAuth();
  const [isLoading, setIsLoading] = useState(false);
  const [formData, setFormData] = useState({
    title: `${channelName} Meeting`,
    description: `Meeting for channel: ${channelName}`
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    onCreateMeeting(channelId, formData.title, formData.description);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <GlassCard className="w-full max-w-md" goldBorder>
        <div className="flex items-center justify-between p-6 border-b silver-border">
          <h2 className="text-xl font-bold gradient-gold-silver">Start Channel Meeting</h2>
          <button
            onClick={onClose}
            className="text-secondary hover:text-primary p-2 rounded-lg glass-panel glass-panel-hover"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {/* Title */}
          <div>
            <label className="block text-sm font-medium text-primary mb-2">
              Meeting Title
            </label>
            <div className="relative">
              <FileText className="absolute left-3 top-3 w-5 h-5 text-secondary" />
              <input
                type="text"
                name="title"
                value={formData.title}
                onChange={handleInputChange}
                placeholder="Enter meeting title"
                className="w-full pl-10 pr-4 py-3 glass-panel rounded-lg text-primary placeholder-secondary focus:outline-none focus:ring-2 focus:ring-yellow-500"
                required
              />
            </div>
          </div>

          {/* Description */}
          <div>
            <label className="block text-sm font-medium text-primary mb-2">
              Description (Optional)
            </label>
            <textarea
              name="description"
              value={formData.description}
              onChange={handleInputChange}
              placeholder="Add meeting description"
              rows={3}
              className="w-full px-4 py-3 glass-panel rounded-lg text-primary placeholder-secondary focus:outline-none focus:ring-2 focus:ring-yellow-500 resize-none"
            />
          </div>

          {/* Meeting Info */}
          <div className="glass-panel rounded-lg p-4 bg-blue-500/10 border-blue-500/30">
            <h3 className="text-sm font-medium text-blue-400 mb-2">Meeting Information</h3>
            <div className="space-y-2 text-sm text-secondary">
              <div className="flex items-center space-x-2">
                <Clock className="w-4 h-4 text-blue-400" />
                <span>Duration: 60 minutes (default)</span>
              </div>
              <div className="flex items-center space-x-2">
                <Users className="w-4 h-4 text-blue-400" />
                <span>Channel: #{channelName}</span>
              </div>
              <div className="flex items-center space-x-2">
                <Video className="w-4 h-4 text-blue-400" />
                <span>Google Meet will be used for this meeting</span>
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="flex space-x-4 pt-4">
            <Button
              type="button"
              onClick={onClose}
              variant="secondary"
              className="flex-1"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              variant="premium"
              className="flex-1"
              disabled={isLoading || !formData.title.trim()}
            >
              {isLoading ? (
                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin mx-auto" />
              ) : (
                'Start Meeting'
              )}
            </Button>
          </div>
        </form>
      </GlassCard>
    </div>
  );
};

export default CreateChannelMeetingModal;