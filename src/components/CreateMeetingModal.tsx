import React, { useState } from 'react';
import { X, Calendar, Clock, FileText, Users } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { meetingService } from '../services/meetingService';
import { Meeting } from '../types';
import GlassCard from './ui/GlassCard';
import Button from './ui/Button';

interface CreateMeetingModalProps {
  onClose: () => void;
  onMeetingCreated: (meeting: Meeting) => void;
}

const CreateMeetingModal: React.FC<CreateMeetingModalProps> = ({ onClose, onMeetingCreated }) => {
  const { user } = useAuth();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    startTime: new Date(Date.now() + 30 * 60000).toISOString().slice(0, 16), // 30 minutes from now
    duration: 60,
    attendees: ''
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    
    setError(null);
    setIsLoading(true);

    try {
      // Parse attendees from comma-separated string
      const attendeesList = formData.attendees
        ? formData.attendees.split(',').map(email => email.trim()).filter(email => email)
        : [];

      const response = await meetingService.createMeeting(user.id, {
        title: formData.title || 'New Meeting',
        description: formData.description,
        startTime: new Date(formData.startTime).toISOString(),
        duration: formData.duration,
        attendees: attendeesList
      });

      if (response.success) {
        onMeetingCreated(response.meeting);
      }
    } catch (error: any) {
      console.error('Failed to create meeting:', error);
      setError(error.message || 'Failed to create meeting. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: name === 'duration' ? parseInt(value, 10) : value
    }));
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <GlassCard className="w-full max-w-md" goldBorder>
        <div className="flex items-center justify-between p-6 border-b silver-border">
          <h2 className="text-xl font-bold gradient-gold-silver">Create New Meeting</h2>
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

          {/* Start Time */}
          <div>
            <label className="block text-sm font-medium text-primary mb-2">
              Start Time
            </label>
            <div className="relative">
              <Calendar className="absolute left-3 top-3 w-5 h-5 text-secondary" />
              <input
                type="datetime-local"
                name="startTime"
                value={formData.startTime}
                onChange={handleInputChange}
                className="w-full pl-10 pr-4 py-3 glass-panel rounded-lg text-primary focus:outline-none focus:ring-2 focus:ring-yellow-500"
              />
            </div>
          </div>

          {/* Duration */}
          <div>
            <label className="block text-sm font-medium text-primary mb-2">
              Duration
            </label>
            <div className="relative">
              <Clock className="absolute left-3 top-3 w-5 h-5 text-secondary" />
              <select
                name="duration"
                value={formData.duration}
                onChange={handleInputChange}
                className="w-full pl-10 pr-4 py-3 glass-panel rounded-lg text-primary focus:outline-none focus:ring-2 focus:ring-yellow-500 appearance-none"
              >
                <option value={30}>30 minutes</option>
                <option value={60}>1 hour</option>
                <option value={90}>1.5 hours</option>
                <option value={120}>2 hours</option>
                <option value={180}>3 hours</option>
              </select>
            </div>
          </div>

          {/* Attendees */}
          <div>
            <label className="block text-sm font-medium text-primary mb-2">
              Attendees (Optional)
            </label>
            <div className="relative">
              <Users className="absolute left-3 top-3 w-5 h-5 text-secondary" />
              <input
                type="text"
                name="attendees"
                value={formData.attendees}
                onChange={handleInputChange}
                placeholder="Enter email addresses, separated by commas"
                className="w-full pl-10 pr-4 py-3 glass-panel rounded-lg text-primary placeholder-secondary focus:outline-none focus:ring-2 focus:ring-yellow-500"
              />
            </div>
            <p className="text-xs text-secondary mt-1">
              Invitations will be sent to all attendees
            </p>
          </div>

          {/* Error message */}
          {error && (
            <div className="p-3 glass-panel rounded-lg bg-red-500/10 border-red-500/30">
              <p className="text-red-400 text-sm">{error}</p>
            </div>
          )}

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
              disabled={isLoading}
            >
              {isLoading ? (
                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin mx-auto" />
              ) : (
                'Create Meeting'
              )}
            </Button>
          </div>
        </form>
      </GlassCard>
    </div>
  );
};

export default CreateMeetingModal;