import React, { useState, useEffect } from 'react';
import { ArrowLeft, Plus, Video, Calendar, Users, ExternalLink, Trash2, Copy, CheckCircle, X, Loader2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { meetingService } from '../services/meetingService';
import { Meeting } from '../types';
import ThemeToggle from '../components/ThemeToggle';
import GlassCard from '../components/ui/GlassCard';
import Button from '../components/ui/Button';
import MeetingCard from '../components/MeetingCard';
import CreateMeetingModal from '../components/CreateMeetingModal';

const MeetingPage: React.FC = () => {
  const navigate = useNavigate();
  const { user, isGoogleConnected } = useAuth();
  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [notification, setNotification] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  useEffect(() => {
    if (user && isGoogleConnected) {
      loadMeetings();
    } else {
      setIsLoading(false);
    }
  }, [user, isGoogleConnected]);

  const loadMeetings = async () => {
    if (!user) return;
    
    try {
      setIsLoading(true);
      const response = await meetingService.listMeetings(user.id);
      if (response.success) {
        setMeetings(response.meetings);
      }
    } catch (error) {
      console.error('Failed to load meetings:', error);
      showNotification('error', 'Failed to load meetings');
    } finally {
      setIsLoading(false);
    }
  };

  const showNotification = (type: 'success' | 'error', message: string) => {
    setNotification({ type, message });
    setTimeout(() => setNotification(null), 5000);
  };

  const handleBack = () => {
    navigate('/dashboard');
  };

  const handleMeetingCreated = (meeting: Meeting) => {
    setMeetings(prev => [meeting, ...prev]);
    setShowCreateModal(false);
    showNotification('success', 'Meeting created successfully!');
  };

  const handleDeleteMeeting = async (meetingId: string) => {
    if (!user) return;
    
    try {
      const response = await meetingService.deleteMeeting(user.id, meetingId);
      if (response.success) {
        setMeetings(prev => prev.filter(m => m.id !== meetingId));
        showNotification('success', 'Meeting cancelled successfully');
      }
    } catch (error) {
      console.error('Failed to delete meeting:', error);
      showNotification('error', 'Failed to cancel meeting');
    }
  };

  const handleJoinMeeting = (url: string) => {
    window.open(url, '_blank');
  };

  const handleCopyLink = async (url: string) => {
    try {
      await navigator.clipboard.writeText(url);
      showNotification('success', 'Meeting link copied to clipboard');
    } catch (error) {
      showNotification('error', 'Failed to copy link');
    }
  };

  return (
    <div className="min-h-screen bg-primary">
      {/* Header */}
      <header className="glass-panel border-0 border-b silver-border">
        <div className="max-w-7xl mx-auto container-padding">
          <div className="flex justify-between items-center py-4">
            <div className="flex items-center space-x-4">
              <button
                onClick={handleBack}
                className="glass-panel p-2 rounded-full glass-panel-hover"
              >
                <ArrowLeft className="w-5 h-5 text-secondary" />
              </button>
              <div>
                <h1 className="text-lg font-bold gradient-gold-silver">
                  Video Meetings
                </h1>
                <p className="text-xs text-secondary">
                  Schedule and join Google Meet meetings
                </p>
              </div>
            </div>
            
            <div className="flex items-center space-x-3">
              <ThemeToggle />
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container-padding py-8">
        <div className="max-w-7xl mx-auto">
          {/* Quick Actions */}
          <div className="mb-8">
            <div className="grid md:grid-cols-2 gap-6">
              <GlassCard 
                className="p-6 cursor-pointer group" 
                hover 
                goldBorder
                onClick={() => isGoogleConnected ? setShowCreateModal(true) : showNotification('error', 'Please connect your Google account first')}
              >
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-lg font-bold text-primary mb-2 group-hover:gold-text transition-colors">Create New Meeting</h3>
                    <p className="text-secondary">Schedule a Google Meet and invite attendees</p>
                  </div>
                  <div className="w-12 h-12 rounded-lg bg-gradient-gold-silver flex items-center justify-center">
                    <Plus className="w-6 h-6 text-white" />
                  </div>
                </div>
              </GlassCard>

              <GlassCard className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-lg font-bold text-primary mb-2">Quick Stats</h3>
                    <div className="flex items-center space-x-4 text-sm text-secondary">
                      <span className="flex items-center">
                        <Calendar className="w-4 h-4 mr-1" />
                        {meetings.length} meetings
                      </span>
                      <span className="flex items-center">
                        <Users className="w-4 h-4 mr-1" />
                        {meetings.reduce((count, meeting) => count + (meeting.attendees?.length || 0), 0)} attendees
                      </span>
                    </div>
                  </div>
                  <div className="w-12 h-12 rounded-lg bg-gradient-gold-silver flex items-center justify-center">
                    <Video className="w-6 h-6 text-white" />
                  </div>
                </div>
              </GlassCard>
            </div>
          </div>

          {/* Google Connection Status */}
          {!isGoogleConnected && (
            <GlassCard className="p-6 mb-8 bg-yellow-500/10 border-yellow-500/30">
              <div className="flex items-center space-x-4">
                <div className="w-12 h-12 rounded-full bg-yellow-500/20 flex items-center justify-center">
                  <Calendar className="w-6 h-6 text-yellow-500" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-yellow-500 mb-1">Google Account Required</h3>
                  <p className="text-secondary">
                    Please connect your Google account from the Dashboard to use the Video Meetings feature.
                  </p>
                </div>
              </div>
              <div className="mt-4">
                <Button
                  onClick={() => navigate('/dashboard')}
                  variant="secondary"
                  className="text-yellow-500 border-yellow-500"
                >
                  Go to Dashboard
                </Button>
              </div>
            </GlassCard>
          )}

          {/* Meetings List */}
          <GlassCard className="overflow-hidden">
            <div className="p-6 border-b silver-border">
              <h2 className="text-xl font-bold gradient-gold-silver">Your Meetings</h2>
              <p className="text-secondary mt-1">Manage your upcoming and recent meetings</p>
            </div>

            <div className="p-6">
              {isLoading ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="w-8 h-8 animate-spin text-secondary" />
                </div>
              ) : !isGoogleConnected ? (
                <div className="text-center py-12">
                  <Video className="w-16 h-16 text-secondary mx-auto mb-4 opacity-50" />
                  <h3 className="text-lg font-bold text-primary mb-2">Google Account Not Connected</h3>
                  <p className="text-secondary mb-6">
                    Connect your Google account to create and manage meetings
                  </p>
                </div>
              ) : meetings.length === 0 ? (
                <div className="text-center py-12">
                  <Video className="w-16 h-16 text-secondary mx-auto mb-4 opacity-50" />
                  <h3 className="text-lg font-bold text-primary mb-2">No meetings yet</h3>
                  <p className="text-secondary mb-6">
                    Create your first meeting to get started
                  </p>
                  <Button
                    onClick={() => setShowCreateModal(true)}
                    variant="premium"
                  >
                    Create Meeting
                  </Button>
                </div>
              ) : (
                <div className="space-y-4">
                  {meetings.map((meeting) => (
                    <MeetingCard
                      key={meeting.id}
                      meeting={meeting}
                      onJoin={handleJoinMeeting}
                      onCopyLink={handleCopyLink}
                      onDelete={handleDeleteMeeting}
                    />
                  ))}
                </div>
              )}
            </div>
          </GlassCard>
        </div>
      </main>

      {/* Create Meeting Modal */}
      {showCreateModal && (
        <CreateMeetingModal
          onClose={() => setShowCreateModal(false)}
          onMeetingCreated={handleMeetingCreated}
        />
      )}

      {/* Notification */}
      {notification && (
        <div className={`fixed bottom-4 right-4 z-50 glass-panel p-4 rounded-lg shadow-lg flex items-center space-x-3 ${
          notification.type === 'success' 
            ? 'bg-green-500/10 border-green-500/30' 
            : 'bg-red-500/10 border-red-500/30'
        }`}>
          {notification.type === 'success' ? (
            <CheckCircle className="w-5 h-5 text-green-500" />
          ) : (
            <X className="w-5 h-5 text-red-500" />
          )}
          <span className={notification.type === 'success' ? 'text-green-500' : 'text-red-500'}>
            {notification.message}
          </span>
        </div>
      )}
    </div>
  );
};

export default MeetingPage;