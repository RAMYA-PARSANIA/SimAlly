import React, { useState, useEffect } from 'react';
import { Plus, Video, Calendar, Users, ExternalLink, Trash2, Copy, CheckCircle } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { meetingService } from '../services/meetingService';
import { Meeting } from '../types';
import CreateMeetingModal from './CreateMeetingModal';
import MeetingCard from './MeetingCard';

const Dashboard: React.FC = () => {
  const { user, logout, sessionId } = useAuth();
  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [notification, setNotification] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  useEffect(() => {
    if (sessionId) {
      loadMeetings();
    }
  }, [sessionId]);

  const loadMeetings = async () => {
    if (!sessionId) return;
    
    try {
      setIsLoading(true);
      const response = await meetingService.listMeetings(sessionId);
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

  const handleMeetingCreated = (meeting: Meeting) => {
    setMeetings(prev => [meeting, ...prev]);
    setShowCreateModal(false);
    showNotification('success', 'Meeting created successfully!');
  };

  const handleDeleteMeeting = async (eventId: string) => {
    if (!sessionId) return;
    
    try {
      await meetingService.deleteMeeting(sessionId, eventId);
      setMeetings(prev => prev.filter(m => m.id !== eventId));
      showNotification('success', 'Meeting cancelled successfully');
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
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-green-50">
      {/* Header */}
      <header className="bg-white/80 backdrop-blur-sm border-b border-white/20 sticky top-0 z-40">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-green-500 rounded-lg flex items-center justify-center">
                <Video className="w-6 h-6 text-white" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-gray-900">Meet Integration</h1>
                <p className="text-sm text-gray-600">Welcome back, {user?.name}</p>
              </div>
            </div>
            
            <div className="flex items-center space-x-4">
              <img
                src={user?.picture}
                alt={user?.name}
                className="w-10 h-10 rounded-full border-2 border-white shadow-sm"
              />
              <button
                onClick={logout}
                className="text-gray-600 hover:text-gray-900 text-sm font-medium transition-colors"
              >
                Sign Out
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-8">
        {/* Quick Actions */}
        <div className="mb-8">
          <div className="grid md:grid-cols-2 gap-6">
            <button
              onClick={() => setShowCreateModal(true)}
              className="bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white p-6 rounded-xl shadow-lg hover:shadow-xl transition-all duration-300 hover:-translate-y-1 text-left group"
            >
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-semibold mb-2">Create New Meeting</h3>
                  <p className="text-blue-100">Start an instant meeting or schedule for later</p>
                </div>
                <Plus className="w-8 h-8 text-blue-200 group-hover:text-white transition-colors" />
              </div>
            </button>

            <div className="bg-white/70 backdrop-blur-sm p-6 rounded-xl border border-white/20 shadow-lg">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-2">Quick Stats</h3>
                  <div className="flex items-center space-x-4 text-sm text-gray-600">
                    <span className="flex items-center">
                      <Calendar className="w-4 h-4 mr-1" />
                      {meetings.length} meetings
                    </span>
                    <span className="flex items-center">
                      <Users className="w-4 h-4 mr-1" />
                      Active today
                    </span>
                  </div>
                </div>
                <div className="w-12 h-12 bg-gradient-to-br from-green-500 to-green-600 rounded-lg flex items-center justify-center">
                  <Calendar className="w-6 h-6 text-white" />
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Meetings List */}
        <div className="bg-white/70 backdrop-blur-sm rounded-xl border border-white/20 shadow-lg overflow-hidden">
          <div className="p-6 border-b border-gray-200/50">
            <h2 className="text-xl font-semibold text-gray-900">Your Meetings</h2>
            <p className="text-gray-600 mt-1">Manage your upcoming and recent meetings</p>
          </div>

          <div className="p-6">
            {isLoading ? (
              <div className="flex items-center justify-center py-12">
                <div className="w-8 h-8 border-2 border-blue-600/30 border-t-blue-600 rounded-full animate-spin"></div>
              </div>
            ) : meetings.length === 0 ? (
              <div className="text-center py-12">
                <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Video className="w-8 h-8 text-gray-400" />
                </div>
                <h3 className="text-lg font-medium text-gray-900 mb-2">No meetings yet</h3>
                <p className="text-gray-600 mb-6">Create your first meeting to get started</p>
                <button
                  onClick={() => setShowCreateModal(true)}
                  className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-lg font-medium transition-colors"
                >
                  Create Meeting
                </button>
              </div>
            ) : (
              <div className="grid gap-4">
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
        <div className={`fixed top-4 right-4 z-50 p-4 rounded-lg shadow-lg flex items-center space-x-3 ${
          notification.type === 'success' 
            ? 'bg-green-500 text-white' 
            : 'bg-red-500 text-white'
        }`}>
          {notification.type === 'success' ? (
            <CheckCircle className="w-5 h-5" />
          ) : (
            <div className="w-5 h-5 border-2 border-white rounded-full flex items-center justify-center">
              <span className="text-xs font-bold">!</span>
            </div>
          )}
          <span>{notification.message}</span>
        </div>
      )}
    </div>
  );
};

export default Dashboard;