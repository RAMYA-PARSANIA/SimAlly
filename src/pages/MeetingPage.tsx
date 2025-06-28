import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowLeft, Video, Plus, Calendar, Users, Clock, ExternalLink, Trash2, Settings, Copy, CheckCircle, AlertCircle, Loader2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import ThemeToggle from '../components/ThemeToggle';
import GlassCard from '../components/ui/GlassCard';
import Button from '../components/ui/Button';

interface GoogleMeetSpace {
  id: string;
  spaceId: string;
  meetingCode: string;
  meetingUri: string;
  title: string;
  description: string;
  startTime?: string;
  endTime?: string;
  status: 'active' | 'ended' | 'cancelled';
  created_at: string;
  participants?: any[];
  recordings?: any[];
}

const MeetingPage: React.FC = () => {
  const navigate = useNavigate();
  const { user, isGoogleConnected } = useAuth();
  const [meetings, setMeetings] = useState<GoogleMeetSpace[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newMeeting, setNewMeeting] = useState({
    title: '',
    description: '',
    startTime: '',
    endTime: '',
    participants: ''
  });
  const [copiedMeetingId, setCopiedMeetingId] = useState<string | null>(null);

  useEffect(() => {
    if (user && isGoogleConnected) {
      loadMeetings();
    } else {
      setLoading(false);
    }
  }, [user, isGoogleConnected]);

  const loadMeetings = async () => {
    if (!user) return;
    
    try {
      const response = await fetch(`${import.meta.env.VITE_API_URL}/api/google/meet/spaces?userId=${user.id}`, {
        credentials: 'include'
      });
      
      const data = await response.json();
      
      if (data.success) {
        setMeetings(data.meetings);
      } else {
        console.error('Error loading meetings:', data.error);
      }
    } catch (error) {
      console.error('Error loading meetings:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateMeeting = async () => {
    if (!user || !newMeeting.title.trim()) return;
    
    setCreating(true);
    
    try {
      const participants = newMeeting.participants
        .split(',')
        .map(email => email.trim())
        .filter(email => email && email.includes('@'));
      
      const response = await fetch(`${import.meta.env.VITE_API_URL}/api/google/meet/spaces/create`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({
          userId: user.id,
          title: newMeeting.title,
          description: newMeeting.description,
          startTime: newMeeting.startTime || null,
          endTime: newMeeting.endTime || null,
          participants: participants.length > 0 ? participants : null
        })
      });
      
      const data = await response.json();
      
      if (data.success) {
        setShowCreateModal(false);
        setNewMeeting({
          title: '',
          description: '',
          startTime: '',
          endTime: '',
          participants: ''
        });
        loadMeetings();
      } else {
        console.error('Error creating meeting:', data.error);
        alert(data.error || 'Failed to create meeting');
      }
    } catch (error) {
      console.error('Error creating meeting:', error);
      alert('Failed to create meeting. Please try again.');
    } finally {
      setCreating(false);
    }
  };

  const handleEndMeeting = async (spaceId: string) => {
    if (!user || !confirm('Are you sure you want to end this meeting?')) return;
    
    try {
      const response = await fetch(`${import.meta.env.VITE_API_URL}/api/google/meet/spaces/${spaceId}/end`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({
          userId: user.id
        })
      });
      
      const data = await response.json();
      
      if (data.success) {
        loadMeetings();
      } else {
        console.error('Error ending meeting:', data.error);
        alert(data.error || 'Failed to end meeting');
      }
    } catch (error) {
      console.error('Error ending meeting:', error);
      alert('Failed to end meeting. Please try again.');
    }
  };

  const handleDeleteMeeting = async (spaceId: string) => {
    if (!user || !confirm('Are you sure you want to cancel this meeting?')) return;
    
    try {
      const response = await fetch(`${import.meta.env.VITE_API_URL}/api/google/meet/spaces/${spaceId}`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({
          userId: user.id
        })
      });
      
      const data = await response.json();
      
      if (data.success) {
        loadMeetings();
      } else {
        console.error('Error deleting meeting:', data.error);
        alert(data.error || 'Failed to cancel meeting');
      }
    } catch (error) {
      console.error('Error deleting meeting:', error);
      alert('Failed to cancel meeting. Please try again.');
    }
  };

  const copyMeetingLink = async (meetingUri: string, meetingId: string) => {
    try {
      await navigator.clipboard.writeText(meetingUri);
      setCopiedMeetingId(meetingId);
      setTimeout(() => setCopiedMeetingId(null), 2000);
    } catch (error) {
      console.error('Failed to copy meeting link:', error);
    }
  };

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

  const handleBack = () => {
    navigate('/dashboard');
  };

  if (!isGoogleConnected) {
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
                    Google Meet integration
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
            <GlassCard className="p-8 text-center" goldBorder>
              <AlertCircle className="w-16 h-16 text-yellow-500 mx-auto mb-6" />
              <h2 className="text-2xl font-bold text-primary mb-4">Google Account Required</h2>
              <p className="text-secondary mb-6 max-w-2xl mx-auto">
                To use Google Meet features, you need to connect your Google account first. 
                This will allow you to create and manage video meetings directly from SimAlly.
              </p>
              <Button
                onClick={() => navigate('/dashboard')}
                variant="premium"
              >
                Go to Dashboard to Connect Google
              </Button>
            </GlassCard>
          </div>
        </main>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-primary flex items-center justify-center">
        <div className="glass-panel rounded-2xl p-8 max-w-md mx-auto text-center">
          <div className="animate-spin w-8 h-8 border-2 border-gold-text border-t-transparent rounded-full mx-auto mb-4"></div>
          <h3 className="text-xl font-bold text-primary mb-2">Loading Meetings...</h3>
          <p className="text-secondary">Fetching your Google Meet spaces</p>
        </div>
      </div>
    );
  }

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
                  Create and manage Google Meet sessions
                </p>
              </div>
            </div>
            
            <div className="flex items-center space-x-3">
              <Button
                onClick={() => setShowCreateModal(true)}
                variant="premium"
                size="sm"
                className="flex items-center space-x-2"
              >
                <Plus className="w-4 h-4" />
                <span>New Meeting</span>
              </Button>
              
              <ThemeToggle />
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container-padding py-8">
        <div className="max-w-7xl mx-auto">
          {/* Meetings Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            <AnimatePresence>
              {meetings.map((meeting) => (
                <motion.div
                  key={meeting.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -20 }}
                  className="group"
                >
                  <GlassCard className="p-6 h-full" hover>
                    <div className="flex items-start justify-between mb-4">
                      <div className="flex items-center space-x-3">
                        <div className="w-12 h-12 rounded-lg bg-gradient-to-r from-blue-500 to-purple-500 flex items-center justify-center">
                          <Video className="w-6 h-6 text-white" />
                        </div>
                        <div className="flex-1">
                          <h3 className="font-bold text-primary group-hover:gold-text transition-colors">
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
                        onClick={() => copyMeetingLink(meeting.meetingUri, meeting.id)}
                        variant="secondary"
                        size="sm"
                        className="p-2"
                      >
                        {copiedMeetingId === meeting.id ? (
                          <CheckCircle className="w-4 h-4 text-green-500" />
                        ) : (
                          <Copy className="w-4 h-4" />
                        )}
                      </Button>

                      {meeting.status === 'active' && (
                        <Button
                          onClick={() => handleEndMeeting(meeting.spaceId)}
                          variant="secondary"
                          size="sm"
                          className="p-2 text-orange-500 border-orange-400"
                        >
                          <Clock className="w-4 h-4" />
                        </Button>
                      )}

                      <Button
                        onClick={() => handleDeleteMeeting(meeting.spaceId)}
                        variant="secondary"
                        size="sm"
                        className="p-2 text-red-500 border-red-400"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </GlassCard>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>

          {meetings.length === 0 && (
            <div className="text-center py-12">
              <Video className="w-16 h-16 text-secondary mx-auto mb-6 opacity-50" />
              <h3 className="text-xl font-bold text-primary mb-4">No meetings yet</h3>
              <p className="text-secondary mb-6 max-w-2xl mx-auto">
                Create your first Google Meet session to start collaborating with your team.
              </p>
              <Button
                onClick={() => setShowCreateModal(true)}
                variant="premium"
                className="flex items-center space-x-2"
              >
                <Plus className="w-4 h-4" />
                <span>Create Your First Meeting</span>
              </Button>
            </div>
          )}
        </div>
      </main>

      {/* Create Meeting Modal */}
      <AnimatePresence>
        {showCreateModal && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="w-full max-w-md"
            >
              <GlassCard className="p-6" goldBorder>
                <h3 className="text-xl font-bold gradient-gold-silver mb-6">
                  Create New Meeting
                </h3>
                
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-primary mb-2">
                      Meeting Title
                    </label>
                    <input
                      type="text"
                      value={newMeeting.title}
                      onChange={(e) => setNewMeeting(prev => ({ ...prev, title: e.target.value }))}
                      placeholder="Team Standup"
                      className="w-full glass-panel rounded-lg px-4 py-3 text-primary placeholder-secondary focus:outline-none focus:ring-2 focus:ring-yellow-500"
                      autoFocus
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-primary mb-2">
                      Description (Optional)
                    </label>
                    <textarea
                      value={newMeeting.description}
                      onChange={(e) => setNewMeeting(prev => ({ ...prev, description: e.target.value }))}
                      placeholder="What's this meeting about?"
                      className="w-full glass-panel rounded-lg px-4 py-3 text-primary placeholder-secondary focus:outline-none focus:ring-2 focus:ring-yellow-500 resize-none"
                      rows={3}
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-primary mb-2">
                        Start Time (Optional)
                      </label>
                      <input
                        type="datetime-local"
                        value={newMeeting.startTime}
                        onChange={(e) => setNewMeeting(prev => ({ ...prev, startTime: e.target.value }))}
                        className="w-full glass-panel rounded-lg px-4 py-3 text-primary focus:outline-none focus:ring-2 focus:ring-yellow-500"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-primary mb-2">
                        End Time (Optional)
                      </label>
                      <input
                        type="datetime-local"
                        value={newMeeting.endTime}
                        onChange={(e) => setNewMeeting(prev => ({ ...prev, endTime: e.target.value }))}
                        className="w-full glass-panel rounded-lg px-4 py-3 text-primary focus:outline-none focus:ring-2 focus:ring-yellow-500"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-primary mb-2">
                      Participants (Optional)
                    </label>
                    <input
                      type="text"
                      value={newMeeting.participants}
                      onChange={(e) => setNewMeeting(prev => ({ ...prev, participants: e.target.value }))}
                      placeholder="email1@example.com, email2@example.com"
                      className="w-full glass-panel rounded-lg px-4 py-3 text-primary placeholder-secondary focus:outline-none focus:ring-2 focus:ring-yellow-500"
                    />
                    <p className="text-xs text-secondary mt-1">
                      Separate multiple emails with commas
                    </p>
                  </div>
                </div>

                <div className="flex space-x-4 mt-6">
                  <Button
                    onClick={() => setShowCreateModal(false)}
                    variant="secondary"
                    className="flex-1"
                    disabled={creating}
                  >
                    Cancel
                  </Button>
                  <Button
                    onClick={handleCreateMeeting}
                    variant="premium"
                    className="flex-1 flex items-center justify-center space-x-2"
                    disabled={!newMeeting.title.trim() || creating}
                  >
                    {creating ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Video className="w-4 h-4" />
                    )}
                    <span>{creating ? 'Creating...' : 'Create Meeting'}</span>
                  </Button>
                </div>
              </GlassCard>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default MeetingPage;