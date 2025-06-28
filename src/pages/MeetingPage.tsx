import React from 'react';
import { ArrowLeft } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import ThemeToggle from '../components/ThemeToggle';
import GlassCard from '../components/ui/GlassCard';
import Button from '../components/ui/Button';

const MeetingPage: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuth();

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
                  This feature has been removed
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
            <h2 className="text-2xl font-bold text-primary mb-4">Meeting Functionality Removed</h2>
            <p className="text-secondary mb-6 max-w-2xl mx-auto">
              The Google Meeting functionality has been removed from this application.
            </p>
            <Button
              onClick={() => navigate('/dashboard')}
              variant="premium"
            >
              Return to Dashboard
            </Button>
          </GlassCard>
        </div>
      </main>
    </div>
  );
};

export default MeetingPage;