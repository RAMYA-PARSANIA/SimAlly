import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import JitsiMeeting from './JitsiMeeting';

const MeetingRoom: React.FC = () => {
  const { meetingId } = useParams<{ meetingId: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [displayName, setDisplayName] = useState<string>('');
  const [hasEnteredName, setHasEnteredName] = useState(false);

  useEffect(() => {
    // Auto-set display name if user is logged in
    if (user?.name) {
      setDisplayName(user.name);
      setHasEnteredName(true);
    }
  }, [user]);

  const handleLeave = () => {
    navigate('/assistant');
  };

  if (!meetingId) {
    return (
      <div className="min-h-screen bg-primary flex items-center justify-center">
        <div className="glass-panel p-8 rounded-xl text-center max-w-md">
          <h3 className="text-xl font-bold text-primary mb-4">Invalid Meeting</h3>
          <p className="text-secondary mb-6">
            No meeting ID provided. Please check your meeting link.
          </p>
          <button
            onClick={() => navigate('/assistant')}
            className="premium-button px-6 py-3 rounded-lg"
          >
            Go Back
          </button>
        </div>
      </div>
    );
  }

  if (!hasEnteredName) {
    return (
      <div className="min-h-screen bg-primary flex items-center justify-center">
        <div className="glass-panel p-8 rounded-xl text-center max-w-sm">
          <h2 className="text-xl font-bold mb-4 text-primary">Enter your display name</h2>
          <input
            type="text"
            className="w-full p-3 rounded-lg glass-panel text-primary placeholder-secondary mb-4 focus:outline-none focus:ring-2 focus:ring-yellow-500"
            placeholder="Your name"
            value={displayName}
            onChange={e => setDisplayName(e.target.value)}
            onKeyPress={(e) => {
              if (e.key === 'Enter' && displayName.trim().length > 0) {
                setHasEnteredName(true);
              }
            }}
          />
          <button
            onClick={() => {
              if (displayName.trim().length > 0) {
                setHasEnteredName(true);
              }
            }}
            disabled={displayName.trim().length === 0}
            className="premium-button w-full px-6 py-3 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Join Meeting
          </button>
          <button
            onClick={() => navigate('/assistant')}
            className="w-full mt-3 text-secondary hover:text-primary text-sm"
          >
            Cancel
          </button>
        </div>
      </div>
    );
  }

  return (
    <JitsiMeeting
      meetingId={meetingId}
      displayName={displayName}
      onLeave={handleLeave}
    />
  );
};

export default MeetingRoom;