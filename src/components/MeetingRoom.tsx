import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import JitsiMeeting from './JitsiMeeting';
import Button from './ui/Button';

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
          <Button
            onClick={() => navigate('/assistant')}
            variant="premium"
            className="w-full"
          >
            Go Back
          </Button>
        </div>
      </div>
    );
  }

  if (!hasEnteredName) {
    return (
      <div className="min-h-screen bg-primary flex items-center justify-center">
        <div className="glass-panel p-8 rounded-xl text-center max-w-sm">
          <div className="mb-6">
            <div className="w-16 h-16 rounded-full bg-gradient-gold-silver flex items-center justify-center mx-auto mb-4">
              <span className="text-2xl">🎥</span>
            </div>
            <h2 className="text-xl font-bold mb-2 text-primary">Join Meeting</h2>
            <p className="text-sm text-secondary">
              Enter your name to join the free video conference
            </p>
          </div>
          
          <div className="space-y-4">
            <input
              type="text"
              className="w-full p-3 rounded-lg glass-panel text-primary placeholder-secondary focus:outline-none focus:ring-2 focus:ring-yellow-500"
              placeholder="Your display name"
              value={displayName}
              onChange={e => setDisplayName(e.target.value)}
              onKeyPress={(e) => {
                if (e.key === 'Enter' && displayName.trim().length > 0) {
                  setHasEnteredName(true);
                }
              }}
              autoFocus
            />
            
            <Button
              onClick={() => {
                if (displayName.trim().length > 0) {
                  setHasEnteredName(true);
                }
              }}
              disabled={displayName.trim().length === 0}
              variant="premium"
              className="w-full"
            >
              Join Meeting
            </Button>
            
            <button
              onClick={() => navigate('/assistant')}
              className="w-full text-secondary hover:text-primary text-sm transition-colors"
            >
              Cancel
            </button>
          </div>
          
          <div className="mt-6 p-3 glass-panel rounded-lg">
            <p className="text-xs text-secondary">
              ✅ Free video conferencing powered by Jitsi Meet
              <br />
              🔒 No registration required • End-to-end encryption
            </p>
          </div>
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