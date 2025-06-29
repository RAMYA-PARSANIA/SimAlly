import React, { useState } from 'react';
import { X, Video, FileText, Clock, Users, Calendar, Info, Globe } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { format, addHours, addMinutes, isValid } from 'date-fns';
import GlassCard from './ui/GlassCard';
import Button from './ui/Button';

interface CreateChannelMeetingModalProps {
  channelId: string;
  channelName: string;
  onClose: () => void;
  onCreateMeeting: (channelId: string, title: string, description: string, startTime: string, duration: number) => void;
}

const CreateChannelMeetingModal: React.FC<CreateChannelMeetingModalProps> = ({
  channelId,
  channelName,
  onClose,
  onCreateMeeting
}) => {
  const { user } = useAuth();
  const [isLoading, setIsLoading] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);
  
  // Get current time rounded to nearest 15 minutes for default start time
  const roundedDate = new Date();
  roundedDate.setMinutes(Math.ceil(roundedDate.getMinutes() / 15) * 15);
  roundedDate.setSeconds(0);
  roundedDate.setMilliseconds(0);
  
  const [formData, setFormData] = useState({
    title: `${channelName} Meeting`,
    description: `Meeting for channel: ${channelName}`,
    startTime: format(roundedDate, "yyyy-MM-dd'T'HH:mm"),
    durationHours: 1,
    durationMinutes: 0
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validate form
    if (!formData.title.trim()) {
      setValidationError("Meeting title is required");
      return;
    }
    
    const startDate = new Date(formData.startTime);
    if (!isValid(startDate)) {
      setValidationError("Invalid start time");
      return;
    }
    
    const totalDurationMinutes = (formData.durationHours * 60) + formData.durationMinutes;
    if (totalDurationMinutes <= 0) {
      setValidationError("Duration must be greater than 0");
      return;
    }
    
    if (totalDurationMinutes > 24 * 60) {
      setValidationError("Duration cannot exceed 24 hours");
      return;
    }
    
    setIsLoading(true);
    setValidationError(null);
    
    // Calculate total duration in minutes
    const duration = (formData.durationHours * 60) + formData.durationMinutes;
    
    onCreateMeeting(
      channelId, 
      formData.title, 
      formData.description, 
      formData.startTime,
      duration
    );
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: name === 'durationHours' || name === 'durationMinutes' ? parseInt(value, 10) : value
    }));
    
    // Clear validation error when user makes changes
    if (validationError) {
      setValidationError(null);
    }
  };
  
  // Calculate end time for preview
  const startDate = new Date(formData.startTime);
  const endDate = addMinutes(addHours(startDate, formData.durationHours), formData.durationMinutes);
  const isValidDates = isValid(startDate) && isValid(endDate);
  
  // Get timezone for display
  const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  const timeZoneAbbr = new Date().toLocaleTimeString('en-us', {timeZoneName: 'short'}).split(' ')[2];

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
              Meeting Title <span className="text-red-500">*</span>
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
          
          {/* Start Time */}
          <div>
            <label className="block text-sm font-medium text-primary mb-2">
              Start Time <span className="text-red-500">*</span>
            </label>
            <div className="relative">
              <Calendar className="absolute left-3 top-3 w-5 h-5 text-secondary" />
              <input
                type="datetime-local"
                name="startTime"
                value={formData.startTime}
                onChange={handleInputChange}
                className="w-full pl-10 pr-4 py-3 glass-panel rounded-lg text-primary focus:outline-none focus:ring-2 focus:ring-yellow-500"
                required
              />
            </div>
            <div className="flex items-center mt-1 text-xs text-secondary">
              <Globe className="w-3 h-3 mr-1" />
              <span>{timeZone} ({timeZoneAbbr})</span>
            </div>
          </div>
          
          {/* Duration */}
          <div>
            <label className="block text-sm font-medium text-primary mb-2">
              Duration <span className="text-red-500">*</span>
            </label>
            <div className="grid grid-cols-2 gap-4">
              <div className="relative">
                <Clock className="absolute left-3 top-3 w-5 h-5 text-secondary" />
                <select
                  name="durationHours"
                  value={formData.durationHours}
                  onChange={handleInputChange}
                  className="w-full pl-10 pr-4 py-3 glass-panel rounded-lg text-primary focus:outline-none focus:ring-2 focus:ring-yellow-500"
                >
                  {Array.from({ length: 25 }, (_, i) => (
                    <option key={i} value={i}>{i} hour{i !== 1 ? 's' : ''}</option>
                  ))}
                </select>
              </div>
              <div className="relative">
                <select
                  name="durationMinutes"
                  value={formData.durationMinutes}
                  onChange={handleInputChange}
                  className="w-full px-4 py-3 glass-panel rounded-lg text-primary focus:outline-none focus:ring-2 focus:ring-yellow-500"
                >
                  {[0, 15, 30, 45].map((min) => (
                    <option key={min} value={min}>{min} minute{min !== 1 ? 's' : ''}</option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* Meeting Preview */}
          <div className="glass-panel rounded-lg p-4 bg-blue-500/10 border-blue-500/30">
            <h3 className="text-sm font-medium text-blue-400 mb-2 flex items-center">
              <Info className="w-4 h-4 mr-2" />
              Meeting Preview
            </h3>
            <div className="space-y-2 text-sm text-secondary">
              <div className="flex items-center space-x-2">
                <Users className="w-4 h-4 text-blue-400" />
                <span>Channel: #{channelName}</span>
              </div>
              <div className="flex items-center space-x-2">
                <Calendar className="w-4 h-4 text-blue-400" />
                <span>
                  {isValidDates 
                    ? `${format(startDate, 'MMM d, yyyy')} at ${format(startDate, 'HH:mm')} - ${format(endDate, 'HH:mm')}`
                    : 'Invalid date/time selected'}
                </span>
              </div>
              <div className="flex items-center space-x-2">
                <Clock className="w-4 h-4 text-blue-400" />
                <span>
                  Duration: {formData.durationHours > 0 ? `${formData.durationHours}h ` : ''}
                  {formData.durationMinutes > 0 ? `${formData.durationMinutes}m` : formData.durationHours === 0 ? '0m' : ''}
                </span>
              </div>
              <div className="flex items-center space-x-2">
                <Video className="w-4 h-4 text-blue-400" />
                <span>Google Meet will be used for this meeting</span>
              </div>
            </div>
          </div>
          
          {/* Validation Error */}
          {validationError && (
            <div className="glass-panel rounded-lg p-3 bg-red-500/10 border-red-500/30">
              <p className="text-sm text-red-400">{validationError}</p>
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