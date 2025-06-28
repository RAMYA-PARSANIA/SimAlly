import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { ArrowLeft, Video, Bot, Users, Zap, Shield, Mic } from 'lucide-react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import ThemeToggle from '../components/ThemeToggle';
import MeetingControls from '../components/MeetingControls';
import VideoMeeting from '../components/VideoMeeting';
import GlassCard from '../components/ui/GlassCard';
import Button from '../components/ui/Button';

const MeetingPage: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();
  const [currentMeeting, setCurrentMeeting] = useState<{
    roomName: string;
    displayName: string;
  } | null>(null);
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [showJoinMeetingModal, setShowJoinMeetingModal] = useState(false);
  const [joinMeetingData, setJoinMeetingData] = useState({
    roomName: '',
    displayName: user?.full_name || ''
  });

  // Check for room parameter in URL
  useEffect(() => {
    const urlParams = new URLSearchParams(location.search);
    const roomFromUrl = urlParams.get('room');
    if (roomFromUrl) {
      setJoinMeetingData(prev => ({
        ...prev,
        roomName: roomFromUrl
      }));
      setShowJoinMeetingModal(true);
    }
  }, [location.search]);

  const handleBack = () => {
    navigate('/dashboard');
  };

  const handleStartMeeting = (roomName: string, displayName: string) => {
    setCurrentMeeting({ roomName, displayName });
    // Update URL to include room parameter
    const newUrl = `${window.location.pathname}?room=${encodeURIComponent(roomName)}`;
    window.history.replaceState({}, '', newUrl);
  };

  const handleJoinMeeting = (roomName: string, displayName: string) => {
    setCurrentMeeting({ roomName, displayName });
    // Update URL to include room parameter
    const newUrl = `${window.location.pathname}?room=${encodeURIComponent(roomName)}`;
    window.history.replaceState({}, '', newUrl);
  };

  const handleLeaveMeeting = () => {
    setCurrentMeeting(null);
    // Remove room parameter from URL
    window.history.replaceState({}, '', window.location.pathname);
  };

  // If in a meeting, show the meeting interface with invite options
  if (currentMeeting) {
    return (
      <div className="min-h-screen bg-primary">
        {/* Meeting Header with Invite Button */}
        <div className="absolute top-4 right-4 z-50">
          <Button
            onClick={() => setShowInviteModal(true)}
            variant="secondary"
            size="sm"
            className="flex items-center space-x-2"
          >
            <Users className="w-4 h-4" />
            <span>Invite Others</span>
          </Button>
        </div>

        <VideoMeeting
          roomName={currentMeeting.roomName}
          displayName={currentMeeting.displayName}
          onLeave={handleLeaveMeeting}
        />
      </div>
    );
  }

  // Show meeting lobby/controls
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
                  Powered by AI Assistant
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
      <main className="section-spacing container-padding">
        <div className="max-w-7xl mx-auto">
          {/* Hero Section */}
          <div className="text-center mb-16">
            <motion.h1
              initial={{ y: 50, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              className="text-4xl md:text-5xl font-bold gradient-gold-silver mb-6"
            >
              Smart Video Meetings
            </motion.h1>
            <motion.p
              initial={{ y: 50, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.1 }}
              className="text-lg text-secondary max-w-2xl mx-auto mb-8"
            >
              Professional video conferencing with AI-powered transcription, note-taking, and meeting summaries.
            </motion.p>

            {/* Features Grid */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6 max-w-4xl mx-auto mb-12">
              {[
                { icon: Video, title: 'HD Video', desc: 'Crystal clear video calls' },
                { icon: Bot, title: 'AI Assistant', desc: 'Smart transcription & notes' },
                { icon: Users, title: 'Multi-party', desc: 'Unlimited participants' },
                { icon: Shield, title: 'Secure', desc: 'End-to-end encryption' },
              ].map((feature, index) => (
                <motion.div
                  key={index}
                  initial={{ y: 30, opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  transition={{ delay: 0.2 + index * 0.1 }}
                >
                  <GlassCard className="p-6 text-center" hover>
                    <feature.icon className="w-8 h-8 gold-text mx-auto mb-3" />
                    <h3 className="font-bold text-primary mb-1">{feature.title}</h3>
                    <p className="text-xs text-secondary">{feature.desc}</p>
                  </GlassCard>
                </motion.div>
              ))}
            </div>
          </div>

          {/* Meeting Controls */}
          <MeetingControls
            onStartMeeting={handleStartMeeting}
            onJoinMeeting={handleJoinMeeting}
          />

          {/* AI Features Section */}
          <div className="mt-20">
            <div className="text-center mb-12">
              <motion.h2
                initial={{ y: 30, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                className="text-3xl font-bold gradient-gold-silver mb-4"
              >
                AI-Powered Meeting Features
              </motion.h2>
              <motion.p
                initial={{ y: 30, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ delay: 0.1 }}
                className="text-secondary max-w-2xl mx-auto"
              >
                Turn on the AI assistant during your meeting to unlock powerful productivity features
              </motion.p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 max-w-6xl mx-auto">
              {[
                {
                  icon: Mic,
                  title: 'Live Transcription',
                  description: 'Real-time speech-to-text conversion with speaker identification',
                  color: 'from-blue-500 to-cyan-500'
                },
                {
                  icon: Bot,
                  title: 'Smart Notes',
                  description: 'AI automatically extracts key points, action items, and decisions',
                  color: 'from-purple-500 to-pink-500'
                },
                {
                  icon: Zap,
                  title: 'Meeting Summary',
                  description: 'Generate comprehensive summaries with next steps and follow-ups',
                  color: 'from-green-500 to-emerald-500'
                },
              ].map((feature, index) => (
                <motion.div
                  key={index}
                  initial={{ y: 50, opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  transition={{ delay: 0.3 + index * 0.1 }}
                >
                  <GlassCard className="p-8 h-full" hover>
                    <div className={`w-12 h-12 rounded-lg bg-gradient-to-r ${feature.color} flex items-center justify-center mb-6`}>
                      <feature.icon className="w-6 h-6 text-white" />
                    </div>
                    <h3 className="text-xl font-bold text-primary mb-4">{feature.title}</h3>
                    <p className="text-secondary text-sm leading-relaxed">{feature.description}</p>
                  </GlassCard>
                </motion.div>
              ))}
            </div>
          </div>

          {/* How It Works */}
          <div className="mt-20">
            <div className="text-center mb-12">
              <motion.h2
                initial={{ y: 30, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                className="text-3xl font-bold gradient-gold-silver mb-4"
              >
                How It Works
              </motion.h2>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-4xl mx-auto">
              {[
                {
                  step: '1',
                  title: 'Start or Join',
                  description: 'Create a new meeting or join with a room name'
                },
                {
                  step: '2',
                  title: 'Invite Others',
                  description: 'Share the room name or meeting link with participants'
                },
                {
                  step: '3',
                  title: 'Enable AI',
                  description: 'Turn on the AI assistant for transcription and smart features'
                }
              ].map((step, index) => (
                <motion.div
                  key={index}
                  initial={{ y: 30, opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  transition={{ delay: 0.4 + index * 0.1 }}
                  className="text-center"
                >
                  <div className="w-12 h-12 rounded-full bg-gradient-gold-silver flex items-center justify-center mx-auto mb-4">
                    <span className="text-white font-bold">{step.step}</span>
                  </div>
                  <h3 className="font-bold text-primary mb-2">{step.title}</h3>
                  <p className="text-secondary text-sm">{step.description}</p>
                </motion.div>
              ))}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
};

export default MeetingPage;