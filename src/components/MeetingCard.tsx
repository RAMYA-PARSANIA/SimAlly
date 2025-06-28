import React from 'react';
import { ExternalLink, Copy, Trash2, Calendar, Clock } from 'lucide-react';
import { Meeting } from '../types';
import Button from './ui/Button';

interface MeetingCardProps {
  meeting: Meeting;
  onJoin: (url: string) => void;
  onCopyLink: (url: string) => void;
  onDelete: (eventId: string) => void;
}

const MeetingCard: React.FC<MeetingCardProps> = ({ meeting, onJoin, onCopyLink, onDelete }) => {
  const formatDateTime = (dateTime: string) => {
    const date = new Date(dateTime);
    return {
      date: date.toLocaleDateString('en-US', { 
        weekday: 'short', 
        month: 'short', 
        day: 'numeric' 
      }),
      time: date.toLocaleTimeString('en-US', { 
        hour: '2-digit', 
        minute: '2-digit' 
      })
    };
  };

  const isUpcoming = (startTime: string) => {
    return new Date(startTime) > new Date();
  };

  const startDateTime = formatDateTime(meeting.startTime);
  const upcoming = isUpcoming(meeting.startTime);

  return (
    <div className="glass-panel rounded-lg p-6 hover:border-gold-border transition-all">
      <div className="flex items-start justify-between mb-4">
        <div className="flex-1">
          <h3 className="text-lg font-semibold text-primary mb-2">{meeting.title}</h3>
          {meeting.description && (
            <p className="text-secondary text-sm mb-3">{meeting.description}</p>
          )}
          <div className="flex items-center space-x-4 text-sm text-secondary">
            <span className="flex items-center">
              <Calendar className="w-4 h-4 mr-1" />
              {startDateTime.date}
            </span>
            <span className="flex items-center">
              <Clock className="w-4 h-4 mr-1" />
              {startDateTime.time}
            </span>
            <span className={`px-2 py-1 rounded-full text-xs font-medium ${
              upcoming 
                ? 'bg-green-500/20 text-green-500' 
                : 'bg-gray-500/20 text-gray-500'
            }`}>
              {upcoming ? 'Upcoming' : 'Past'}
            </span>
          </div>
        </div>
      </div>

      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <Button
            onClick={() => onJoin(meeting.url)}
            variant="premium"
            size="sm"
            className="flex items-center space-x-2"
          >
            <ExternalLink className="w-4 h-4" />
            <span>Join Meeting</span>
          </Button>
          
          <Button
            onClick={() => onCopyLink(meeting.url)}
            variant="secondary"
            size="sm"
            className="flex items-center space-x-2"
          >
            <Copy className="w-4 h-4" />
            <span>Copy Link</span>
          </Button>
        </div>

        <Button
          onClick={() => onDelete(meeting.id)}
          variant="ghost"
          size="sm"
          className="text-red-400 hover:text-red-500 p-2"
          title="Cancel Meeting"
        >
          <Trash2 className="w-4 h-4" />
        </Button>
      </div>
    </div>
  );
};

export default MeetingCard;