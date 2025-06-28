import React, { useState } from 'react';
import { X, Calendar, Clock, FileText } from 'lucide-react';
import { meetingService } from '../services/meetingService';
import { Meeting } from '../types';
import GlassCard from './ui/GlassCard';
import Button from './ui/Button';

interface CreateMeetingModalProps {
  onClose: () => void;
  onMeetingCreated: (meeting: Meeting) => void;
}

const CreateMeetingModal: React.FC<CreateMeetingModalProps> = ({ onClose, onMeetingCreated }) => {
  const [isLoading, setIsLoading] = useState(false);
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    startTime: new Date(new Date().getTime() + 30 * 60000).toISOString().slice(0, 16), // 30 minutes from now
    duration: 60
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      setIsLoading(true);
      const response = await meetingService.createMeeting({
        title: formData.title || 'Google Meet Meeting',
        description: formData.description,
        startTime: new Date(formData.startTime).toISOString(),
        duration: formData.duration
      });

      if (response.success) {
        onMeetingCreated(response.meeting);
        onClose();
      }
    } catch (error) {
      console.error('Failed to create meeting:', error);
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
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <GlassCard className="p-0" goldBorder>
          {/* Header */}
          <div className="flex items-center justify-between p-6 border-b silver-border">
            <h2 className="text-xl font-bold gradient-gold-silver">Create New Meeting</h2>
            <button
              onClick={onClose}
              className="text-secondary hover:text-primary transition-colors"
            >
              <X className="w-6 h-6" />
            </button>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="p-6 space-y-6">
            {/* Title */}
            <div>
              <label htmlFor="title" className="block text-sm font-medium text-primary mb-2">
                Meeting Title
              </label>
              <div className="relative">
                <FileText className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-secondary" />
                <input
                  type="text"
                  id="title"
                  name="title"
                  value={formData.title}
                  onChange={handleInputChange}
                  placeholder="Enter meeting title (optional)"
                  className="w-full pl-10 pr-4 py-3 glass-panel rounded-lg focus:outline-none focus:ring-2 focus:ring-yellow-500 text-primary placeholder-secondary"
                />
              </div>
            </div>

            {/* Description */}
            <div>
              <label htmlFor="description" className="block text-sm font-medium text-primary mb-2">
                Description
              </label>
              <textarea
                id="description"
                name="description"
                value={formData.description}
                onChange={handleInputChange}
                placeholder="Add meeting description (optional)"
                rows={3}
                className="w-full px-4 py-3 glass-panel rounded-lg focus:outline-none focus:ring-2 focus:ring-yellow-500 text-primary placeholder-secondary resize-none"
              />
            </div>

            {/* Start Time */}
            <div>
              <label htmlFor="startTime" className="block text-sm font-medium text-primary mb-2">
                Start Time
              </label>
              <div className="relative">
                <Calendar className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-secondary" />
                <input
                  type="datetime-local"
                  id="startTime"
                  name="startTime"
                  value={formData.startTime}
                  onChange={handleInputChange}
                  className="w-full pl-10 pr-4 py-3 glass-panel rounded-lg focus:outline-none focus:ring-2 focus:ring-yellow-500 text-primary"
                />
              </div>
            </div>

            {/* Duration */}
            <div>
              <label htmlFor="duration" className="block text-sm font-medium text-primary mb-2">
                Duration
              </label>
              <div className="relative">
                <Clock className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-secondary" />
                <select
                  id="duration"
                  name="duration"
                  value={formData.duration}
                  onChange={handleInputChange}
                  className="w-full pl-10 pr-4 py-3 glass-panel rounded-lg focus:outline-none focus:ring-2 focus:ring-yellow-500 text-primary appearance-none"
                >
                  <option value={30}>30 minutes</option>
                  <option value={60}>1 hour</option>
                  <option value={90}>1.5 hours</option>
                  <option value={120}>2 hours</option>
                  <option value={180}>3 hours</option>
                </select>
              </div>
            </div>

            {/* Actions */}
            <div className="flex space-x-3 pt-4">
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
                disabled={isLoading}
                variant="premium"
                className="flex-1 flex items-center justify-center"
              >
                {isLoading ? (
                  <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                ) : (
                  'Create Meeting'
                )}
              </Button>
            </div>
          </form>
        </GlassCard>
      </div>
    </div>
  );
};

export default CreateMeetingModal;