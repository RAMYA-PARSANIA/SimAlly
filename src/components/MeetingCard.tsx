import React from 'react';
import { ExternalLink, Copy, Trash2, Calendar, Clock } from 'lucide-react';
import { Meeting } from '../types';

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
    <div className="bg-white rounded-lg border border-gray-200 p-6 hover:shadow-md transition-shadow">
      <div className="flex items-start justify-between mb-4">
        <div className="flex-1">
          <h3 className="text-lg font-semibold text-gray-900 mb-2">{meeting.title}</h3>
          {meeting.description && (
            <p className="text-gray-600 text-sm mb-3">{meeting.description}</p>
          )}
          <div className="flex items-center space-x-4 text-sm text-gray-500">
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
                ? 'bg-green-100 text-green-800' 
                : 'bg-gray-100 text-gray-800'
            }`}>
              {upcoming ? 'Upcoming' : 'Past'}
            </span>
          </div>
        </div>
      </div>

      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <button
            onClick={() => onJoin(meeting.url)}
            className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors flex items-center space-x-2"
          >
            <ExternalLink className="w-4 h-4" />
            <span>Join Meeting</span>
          </button>
          
          <button
            onClick={() => onCopyLink(meeting.url)}
            className="bg-gray-100 hover:bg-gray-200 text-gray-700 px-4 py-2 rounded-lg text-sm font-medium transition-colors flex items-center space-x-2"
          >
            <Copy className="w-4 h-4" />
            <span>Copy Link</span>
          </button>
        </div>

        <button
          onClick={() => onDelete(meeting.id)}
          className="text-red-600 hover:text-red-700 p-2 hover:bg-red-50 rounded-lg transition-colors"
          title="Cancel Meeting"
        >
          <Trash2 className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};

export default MeetingCard;