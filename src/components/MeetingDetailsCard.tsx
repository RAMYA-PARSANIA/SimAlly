import React, { useState } from 'react';
import { Video, Calendar, Clock, Users, ExternalLink, Trash2, Edit, Copy, AlertCircle, CheckCircle } from 'lucide-react';
import { format, formatDistance, isAfter, isBefore } from 'date-fns';
import GlassCard from './ui/GlassCard';
import Button from './ui/Button';

interface MeetingDetailsCardProps {
  meeting: {
    id: string;
    title: string;
    description?: string;
    url: string;
    startTime: string;
    endTime: string;
    duration: number;
    organizer: string;
    status: 'scheduled' | 'active' | 'completed' | 'cancelled';
    participants: Array<{
      email: string;
      displayName?: string;
      status?: string;
    }>;
    agenda?: string;
  };
  onJoin: (url: string) => void;
  onCopyLink: (url: string) => void;
  onEdit?: (meetingId: string) => void;
  onCancel?: (meetingId: string) => void;
  isOrganizer?: boolean;
}

const MeetingDetailsCard: React.FC<MeetingDetailsCardProps> = ({
  meeting,
  onJoin,
  onCopyLink,
  onEdit,
  onCancel,
  isOrganizer = false
}) => {
  const [showCopiedMessage, setShowCopiedMessage] = useState(false);
  
  const startDate = new Date(meeting.startTime);
  const endDate = new Date(meeting.endTime);
  const now = new Date();
  
  const isUpcoming = isAfter(startDate, now);
  const isActive = isBefore(startDate, now) && isAfter(endDate, now);
  const isCompleted = isBefore(endDate, now);
  
  const timeRemaining = isUpcoming ? formatDistance(startDate, now, { addSuffix: true }) : '';
  const timeElapsed = isActive ? formatDistance(now, endDate, { addSuffix: false }) : '';
  
  const getMeetingStatusColor = () => {
    if (isActive) return 'bg-green-500/20 text-green-500';
    if (isUpcoming) return 'bg-blue-500/20 text-blue-500';
    if (isCompleted) return 'bg-gray-500/20 text-gray-500';
    return 'bg-red-500/20 text-red-500';
  };
  
  const getMeetingStatusText = () => {
    if (isActive) return 'In Progress';
    if (isUpcoming) return 'Upcoming';
    if (isCompleted) return 'Completed';
    return 'Cancelled';
  };
  
  const handleCopyLink = () => {
    onCopyLink(meeting.url);
    setShowCopiedMessage(true);
    setTimeout(() => setShowCopiedMessage(false), 2000);
  };

  return (
    <GlassCard className="p-6" goldBorder>
      <div className="flex items-start justify-between mb-6">
        <div className="flex items-start space-x-4">
          <div className="w-12 h-12 rounded-lg bg-gradient-gold-silver flex items-center justify-center">
            <Video className="w-6 h-6 text-white" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-primary mb-1">{meeting.title}</h2>
            <div className="flex items-center space-x-2">
              <span className={`px-2 py-1 rounded-full text-xs font-medium ${getMeetingStatusColor()}`}>
                {getMeetingStatusText()}
              </span>
              {isActive && (
                <span className="text-xs text-secondary">
                  Ends in {timeElapsed}
                </span>
              )}
              {isUpcoming && (
                <span className="text-xs text-secondary">
                  Starts {timeRemaining}
                </span>
              )}
            </div>
          </div>
        </div>
        
        {showCopiedMessage && (
          <div className="glass-panel rounded-lg p-2 bg-green-500/10 border-green-500/30 text-xs text-green-500 flex items-center">
            <CheckCircle className="w-3 h-3 mr-1" />
            Link copied!
          </div>
        )}
      </div>
      
      {meeting.description && (
        <div className="mb-6">
          <h3 className="text-sm font-medium text-secondary mb-2">Description</h3>
          <p className="text-primary">{meeting.description}</p>
        </div>
      )}
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
        <div className="glass-panel rounded-lg p-4">
          <h3 className="text-sm font-medium text-secondary mb-3 flex items-center">
            <Calendar className="w-4 h-4 mr-2" />
            Date & Time
          </h3>
          <div className="space-y-2">
            <div className="flex justify-between">
              <span className="text-xs text-secondary">Start:</span>
              <span className="text-sm text-primary">
                {format(startDate, 'EEE, MMM d, yyyy')} at {format(startDate, 'HH:mm')}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-xs text-secondary">End:</span>
              <span className="text-sm text-primary">
                {format(endDate, 'HH:mm')}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-xs text-secondary">Duration:</span>
              <span className="text-sm text-primary">
                {meeting.duration} minutes
              </span>
            </div>
          </div>
        </div>
        
        <div className="glass-panel rounded-lg p-4">
          <h3 className="text-sm font-medium text-secondary mb-3 flex items-center">
            <Users className="w-4 h-4 mr-2" />
            Participants
          </h3>
          <div className="space-y-2">
            <div className="flex justify-between">
              <span className="text-xs text-secondary">Organizer:</span>
              <span className="text-sm text-primary">{meeting.organizer}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-xs text-secondary">Current:</span>
              <span className="text-sm text-primary">
                {meeting.participants.length} participant(s)
              </span>
            </div>
          </div>
        </div>
      </div>
      
      {meeting.agenda && (
        <div className="mb-6">
          <h3 className="text-sm font-medium text-secondary mb-2">Agenda</h3>
          <div className="glass-panel rounded-lg p-4 bg-blue-500/10 border-blue-500/30">
            <p className="text-primary whitespace-pre-wrap">{meeting.agenda}</p>
          </div>
        </div>
      )}
      
      <div className="flex flex-wrap gap-3">
        <Button
          onClick={() => onJoin(meeting.url)}
          variant="premium"
          className="flex items-center space-x-2"
          disabled={isCompleted}
        >
          <Video className="w-4 h-4" />
          <span>Join Meeting</span>
        </Button>
        
        <Button
          onClick={handleCopyLink}
          variant="secondary"
          className="flex items-center space-x-2"
        >
          <Copy className="w-4 h-4" />
          <span>Copy Link</span>
        </Button>
        
        {isOrganizer && (
          <>
            {onEdit && !isCompleted && (
              <Button
                onClick={() => onEdit(meeting.id)}
                variant="secondary"
                className="flex items-center space-x-2"
              >
                <Edit className="w-4 h-4" />
                <span>Edit</span>
              </Button>
            )}
            
            {onCancel && !isCompleted && (
              <Button
                onClick={() => onCancel(meeting.id)}
                variant="ghost"
                className="flex items-center space-x-2 text-red-400 hover:text-red-500 hover:bg-red-500/10"
              >
                <Trash2 className="w-4 h-4" />
                <span>Cancel</span>
              </Button>
            )}
          </>
        )}
      </div>
      
      {isCompleted && (
        <div className="mt-4 glass-panel rounded-lg p-3 bg-gray-500/10 border-gray-500/30 flex items-center">
          <AlertCircle className="w-4 h-4 text-gray-500 mr-2" />
          <p className="text-sm text-gray-500">This meeting has ended</p>
        </div>
      )}
    </GlassCard>
  );
};

export default MeetingDetailsCard;