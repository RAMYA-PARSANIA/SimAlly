import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { ArrowLeft, Video, Bot, Users, Zap, Shield, Mic, Share2, Copy, Check, Plus, Calendar, Clock, Trash2, ExternalLink, RefreshCw, AlertCircle } from 'lucide-react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import ThemeToggle from '../components/ThemeToggle';
import GlassCard from '../components/ui/GlassCard';
import Button from '../components/ui/Button';
import CreateMeetingModal from '../components/CreateMeetingModal';
import MeetingCard from '../components/MeetingCard';
import { meetingService } from '../services/meetingService';
import { Meeting } from '../types';

const MeetingPage: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, isGoogleConnected } = useAuth();
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    if (user) {
      fetchMeetings();
    } else {
      setLoading(false);
    }
  }, [user]);

  const fetchMeetings = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const response = await meetingService.listMeetings(user?.id);
      
      if (response.success) {
        setMeetings(response.meetings);
      } else {
        setError(response.error || 'Failed to load meetings');
      }
    } catch (error: any) {
      console.error('Failed to fetch meetings:', error);
      setError(error.response?.data?.error || 'Failed to load meetings. Please try again later.');
    } finally {
      setLoading(false);
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    await fetchMeetings();
    setRefreshing(false);
  };

  const handleBack = () => {
    navigate('/dashboard');
  };

  const handleCreateMeeting = (meeting: Meeting) => {
    setMeetings(prev => [meeting, ...prev]);
    setShowCreateModal(false);
  };

  const handleJoinMeeting = (url: string) => {
    window.open(url, '_blank');
  };

  const handleCopyLink = (url: string) => {
    navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDeleteMeeting = async (eventId: string) => {
    if (!confirm('Are you sure you want to cancel this meeting?')) return;
    
    try {
      const response = await meetingService.deleteMeeting(eventId, user?.id);
      if (response.success) {
        setMeetings(prev => prev.filter(meeting => meeting.id !== eventId));
      } else {
        setError(response.error || 'Failed to cancel meeting');
      }
    } catch (error: any) {
      console.error('Failed to delete meeting:', error);
      setError(error.response?.data?.error || 'Failed to cancel meeting. Please try again.');
    }
  };

  return (
    <div className="min-h-screen bg-primary">
      {/* Header */}
      <header className="glass-panel border-0 border-b silver-border">
        <div className="max-w-7xl mx-auto container-padding">
          <div className="flex justify-between items-center py-4">
            <div className="flex items-center space-x-4">
              <motion.button
                onClick={handleBack}
                className="glass-panel p-2 rounded-full glass-panel-hover"
                whileHover={{ scale: 1.1 }}
                whileTap={{ scale: 0.95 }}
              >
                <ArrowLeft className="w-5 h-5 text-secondary" />
              </motion.button>
              <div>
                <h1 className="text-lg font-bold gradient-gold-silver">
                  Video Meetings
                </h1>
                <p className="text-xs text-secondary">
                  Powered by Google Meet
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
          {!isGoogleConnected ? (
            <GlassCard className="p-8 text-center" goldBorder>
              <Video className="w-16 h-16 text-secondary mx-auto mb-6 opacity-50" />
              <h2 className="text-2xl font-bold text-primary mb-4">Connect Google to Use Meetings</h2>
              <p className="text-secondary mb-6 max-w-2xl mx-auto">
                You need to connect your Google account to create and join Google Meet meetings. 
                Please go to the Dashboard and click "Connect Google" to enable this feature.
              </p>
              <Button
                onClick={() => navigate('/dashboard')}
                variant="premium"
              >
                Go to Dashboard
              </Button>
            </GlassCard>
          ) : (
            <>
              {/* Meetings Header */}
              <div className="flex justify-between items-center mb-8">
                <h2 className="text-2xl font-bold gradient-gold-silver">Your Meetings</h2>
                <div className="flex items-center space-x-3">
                  <Button
                    onClick={handleRefresh}
                    variant="ghost"
                    size="sm"
                    className="p-2"
                    disabled={refreshing}
                  >
                    <RefreshCw className={`w-5 h-5 ${refreshing ? 'animate-spin' : ''}`} />
                  </Button>
                  <Button
                    onClick={() => setShowCreateModal(true)}
                    variant="premium"
                    className="flex items-center space-x-2"
                  >
                    <Plus className="w-4 h-4" />
                    <span>New Meeting</span>
                  </Button>
                </div>
              </div>

              {/* Error Message */}
              {error && (
                <div className="mb-6 p-4 glass-panel rounded-lg bg-red-500/10 border-red-500/30 flex items-center space-x-3">
                  <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0" />
                  <p className="text-red-400">{error}</p>
                </div>
              )}

              {/* Meetings List */}
              {loading ? (
                <div className="flex justify-center items-center py-12">
                  <div className="animate-spin w-8 h-8 border-2 border-gold-text border-t-transparent rounded-full"></div>
                </div>
              ) : meetings.length === 0 ? (
                <GlassCard className="p-8 text-center">
                  <Video className="w-16 h-16 text-secondary mx-auto mb-6 opacity-50" />
                  <h3 className="text-xl font-bold text-primary mb-4">No Meetings Found</h3>
                  <p className="text-secondary mb-6">
                    You don't have any upcoming Google Meet meetings. Create a new meeting to get started.
                  </p>
                  <Button
                    onClick={() => setShowCreateModal(true)}
                    variant="premium"
                    className="flex items-center space-x-2"
                  >
                    <Plus className="w-4 h-4" />
                    <span>Create Meeting</span>
                  </Button>
                </GlassCard>
              ) : (
                <div className="grid grid-cols-1 gap-6">
                  {meetings.map(meeting => (
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

              {/* Features Section */}
              <div className="mt-16">
                <h2 className="text-2xl font-bold gradient-gold-silver mb-8 text-center">Google Meet Features</h2>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <GlassCard className="p-6 text-center" hover>
                    <div className="w-12 h-12 rounded-full bg-gradient-to-r from-blue-500 to-cyan-500 flex items-center justify-center mx-auto mb-4">
                      <Video className="w-6 h-6 text-white" />
                    </div>
                    <h3 className="text-lg font-bold text-primary mb-2">HD Video Conferencing</h3>
                    <p className="text-secondary text-sm">
                      Crystal clear video and audio for professional meetings with up to 100 participants.
                    </p>
                  </GlassCard>
                  
                  <GlassCard className="p-6 text-center" hover>
                    <div className="w-12 h-12 rounded-full bg-gradient-to-r from-green-500 to-emerald-500 flex items-center justify-center mx-auto mb-4">
                      <Calendar className="w-6 h-6 text-white" />
                    </div>
                    <h3 className="text-lg font-bold text-primary mb-2">Calendar Integration</h3>
                    <p className="text-secondary text-sm">
                      Seamlessly integrated with Google Calendar for easy scheduling and reminders.
                    </p>
                  </GlassCard>
                  
                  <GlassCard className="p-6 text-center" hover>
                    <div className="w-12 h-12 rounded-full bg-gradient-to-r from-purple-500 to-pink-500 flex items-center justify-center mx-auto mb-4">
                      <Shield className="w-6 h-6 text-white" />
                    </div>
                    <h3 className="text-lg font-bold text-primary mb-2">Secure Meetings</h3>
                    <p className="text-secondary text-sm">
                      Enterprise-grade security with encryption and advanced meeting controls.
                    </p>
                  </GlassCard>
                </div>
              </div>
            </>
          )}
        </div>
      </main>

      {/* Create Meeting Modal */}
      {showCreateModal && (
        <CreateMeetingModal
          onClose={() => setShowCreateModal(false)}
          onMeetingCreated={handleCreateMeeting}
        />
      )}
    </div>
  );
};

export default MeetingPage;