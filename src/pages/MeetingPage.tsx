import React from 'react';
import { ArrowLeft, Video, Calendar, Users, AlertCircle } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import ThemeToggle from '../components/ThemeToggle';
import GlassCard from '../components/ui/GlassCard';
import Button from '../components/ui/Button';

const MeetingPage: React.FC = () => {
  const navigate = useNavigate();
  const { user, isGoogleConnected } = useAuth();

  const handleBack = () => {
    navigate('/dashboard');
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
            <div className="w-16 h-16 rounded-full bg-gradient-to-r from-blue-500 to-purple-500 flex items-center justify-center mx-auto mb-6">
              <Video className="w-8 h-8 text-white" />
            </div>
            <h2 className="text-2xl font-bold text-primary mb-4">Google Meet Integration</h2>
            <p className="text-secondary mb-6 max-w-2xl mx-auto">
              The Google Meet integration is currently being updated to use the latest Google API version. 
              This feature will be available again soon.
            </p>
            <div className="flex flex-col md:flex-row gap-4 justify-center">
              <Button
                onClick={() => window.open('https://meet.google.com/new', '_blank')}
                variant="premium"
                className="flex items-center justify-center space-x-2"
              >
                <Video className="w-4 h-4" />
                <span>Create Meeting on Google Meet</span>
              </Button>
              <Button
                onClick={() => navigate('/dashboard')}
                variant="secondary"
              >
                Return to Dashboard
              </Button>
            </div>
            
            <div className="mt-8 p-4 glass-panel rounded-lg bg-blue-500/10 border-blue-500/30 max-w-2xl mx-auto">
              <h3 className="font-medium text-blue-400 mb-2 flex items-center justify-center">
                <Calendar className="w-4 h-4 mr-2" />
                Alternative Options
              </h3>
              <p className="text-sm text-secondary mb-4">
                While we update our Google Meet integration, you can use these alternatives:
              </p>
              <ul className="text-sm text-secondary text-left list-disc pl-6 space-y-2">
                <li>Create meetings directly on <a href="https://meet.google.com" target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:underline">Google Meet</a></li>
                <li>Use the AI Assistant to help schedule meetings</li>
                <li>Use the Calendar feature in the Workspace to manage your schedule</li>
              </ul>
            </div>
          </GlassCard>
        </div>
      </main>
    </div>
  );
};

export default MeetingPage;