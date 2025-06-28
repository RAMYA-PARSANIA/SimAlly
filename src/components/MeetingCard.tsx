import React, { useState } from 'react';
import { Video, Calendar, Users, Clock, ExternalLink, Trash2, Copy, CheckCircle } from 'lucide-react';
import GlassCard from './ui/GlassCard';
import Button from './ui/Button';

interface MeetingCardProps {
  meeting: {
    id: string;
    spaceId: string;
    meetingCode: string;
    meetingUri: string;
    title: string;
    description?: string;
    startTime?: string;
    endTime?: string;
    status: 'active' | 'ended' | 'cancelled';
    created_at: string;
    participants?: any[];
  };
  onEndMeeting: (spaceId: string) => void;
  onDeleteMeeting: (spaceId: string) => void;
}

const MeetingCard: React.FC<MeetingCardProps> = ({ meeting, onEndMeeting, onDeleteMeeting }) => {
  const [copied, setCopied] = useState(false);

  const formatDateTime = (dateString: string) => {
    return new Date(dateString).toLocaleString([], {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active': return 'text-green-500 bg-green-500/10 border-green-500/30';
      case 'ended': return 'text-gray-500 bg-gray-500/10 border-gray-500/30';
      case 'cancelled': return 'text-red-500 bg-red-500/10 border-red-500/30';
      default: return 'text-gray-500 bg-gray-500/10 border-gray-500/30';
    }
  };

  const copyMeetingLink = async () => {
    try {
      await navigator.clipboard.writeText(meeting.meetingUri);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      console.error('Failed to copy meeting link:', error);
    }
  };

  return (
    <GlassCard className="p-6 h-full" hover>
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center space-x-3">
          <div className="w-12 h-12 rounded-lg bg-gradient-to-r from-blue-500 to-purple-500 flex items-center justify-center">
            <Video className="w-6 h-6 text-white" />
          </div>
          <div className="flex-1">
            <h3 className="font-bold text-primary hover:gold-text transition-colors">
              {meeting.title}
            </h3>
            <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(meeting.status)}`}>
              {meeting.status}
            </span>
          </div>
        </div>
      </div>

      {meeting.description && (
        <p className="text-secondary text-sm mb-4 line-clamp-2">
          {meeting.description}
        </p>
      )}

      {/* Meeting Details */}
      <div className="space-y-2 mb-4 text-sm">
        <div className="flex items-center space-x-2">
          <Calendar className="w-4 h-4 text-secondary" />
          <span className="text-secondary">
            {formatDateTime(meeting.created_at)}
          </span>
        </div>
        
        {meeting.participants && meeting.participants.length > 0 && (
          <div className="flex items-center space-x-2">
            <Users className="w-4 h-4 text-secondary" />
            <span className="text-secondary">
              {meeting.participants.length} participant{meeting.participants.length > 1 ? 's' : ''}
            </span>
          </div>
        )}

        <div className="flex items-center space-x-2">
          <span className="text-xs text-secondary font-mono bg-surface px-2 py-1 rounded">
            {meeting.meetingCode}
          </span>
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center space-x-2">
        <Button
          onClick={() => window.open(meeting.meetingUri, '_blank')}
          variant="premium"
          size="sm"
          className="flex-1 flex items-center justify-center space-x-2"
          disabled={meeting.status !== 'active'}
        >
          <ExternalLink className="w-4 h-4" />
          <span>Join</span>
        </Button>
        
        <Button
          onClick={copyMeetingLink}
          variant="secondary"
          size="sm"
          className="p-2"
        >
          {copied ? (
            <CheckCircle className="w-4 h-4 text-green-500" />
          ) : (
            <Copy className="w-4 h-4" />
          )}
        </Button>

        {meeting.status === 'active' && (
          <Button
            onClick={() => onEndMeeting(meeting.spaceId)}
            variant="secondary"
            size="sm"
            className="p-2 text-orange-500 border-orange-400"
          >
            <Clock className="w-4 h-4" />
          </Button>
        )}

        <Button
          onClick={() => onDeleteMeeting(meeting.spaceId)}
          variant="secondary"
          size="sm"
          className="p-2 text-red-500 border-red-400"
        >
          <Trash2 className="w-4 h-4" />
        </Button>
      </div>
    </GlassCard>
  );
};

export default MeetingCard;