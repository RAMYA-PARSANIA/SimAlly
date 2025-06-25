import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Bot, Gamepad2, Video, LogOut, Settings, User, Users, MessageSquare } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import ThemeToggle from '../components/ThemeToggle';
import GlassCard from '../components/ui/GlassCard';

const Dashboard: React.FC = () => {
  const navigate = useNavigate();
  const { user, signOut } = useAuth();

  const features = [
    {
      id: 'workspace',
      icon: Users,
      title: 'Workspace',
      description: 'Collaborative chat with AI task detection, calendar integration, and intelligent project management.',
      route: '/workspace',
      color: 'from-purple-500 to-blue-500',
    },
    {
      id: 'assistant',
      icon: Bot,
      title: 'AI Assistant',
      description: 'Professional productivity support with Gmail management and intelligent assistance for your daily workflow.',
      route: '/assistant',
      color: 'from-blue-500 to-cyan-500',
    },
    {
      id: 'meetings',
      icon: Video,
      title: 'Video Meetings',
      description: 'Smart video conferencing with AI-powered transcription, note-taking, and meeting summaries.',
      route: '/meetings',
      color: 'from-cyan-500 to-green-500',
    },
    {
      id: 'game-mode',
      icon: Gamepad2,
      title: 'Interactive Games',
      description: 'Engaging mental exercises, problem-solving games, and intelligent entertainment for cognitive enhancement.',
      route: '/game-mode',
      color: 'from-green-500 to-yellow-500',
    },
  ];

  const handleFeatureClick = (route: string) => {
    navigate(route);
  };

  const handleLogout = async () => {
    await signOut();
    navigate('/');
  };

  if (!user) {
    return (
      <div className="min-h-screen bg-primary flex items-center justify-center">
        <div className="glass-panel rounded-2xl p-8 max-w-md mx-auto text-center">
          <div className="animate-spin w-8 h-8 border-2 border-gold-text border-t-transparent rounded-full mx-auto mb-4"></div>
          <h3 className="text-xl font-bold text-primary mb-2">Loading Dashboard...</h3>
          <p className="text-secondary">Setting up your workspace</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-primary flex flex-col h-screen max-h-screen">
      {/* Header - Fixed */}
      <header className="glass-panel border-0 border-b silver-border z-10">
        <div className="max-w-7xl mx-auto container-padding">
          <div className="flex justify-between items-center py-4">
            <div className="flex items-center space-x-4">
              <div className="w-10 h-10 rounded-full bg-gradient-gold-silver flex items-center justify-center">
                <User className="w-5 h-5 text-white" />
              </div>
              <div>
                <h2 className="text-lg font-bold gradient-gold-silver">
                  Welcome, {user.full_name || user.username}
                </h2>
                <p className="text-sm text-secondary">
                  Select your preferred mode
                </p>
              </div>
            </div>
            
            <div className="flex items-center space-x-4">
              <ThemeToggle />
              {/* <button className="glass-panel p-3 rounded-lg glass-panel-hover">
                <Settings className="w-5 h-5 text-secondary" />
              </button> */}
              <button
                onClick={handleLogout}
                className="glass-panel p-3 rounded-lg glass-panel-hover"
              >
                <LogOut className="w-4 h-4 text-primary" />
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content - Only scrollable when needed */}
      <main className="flex-1 overflow-auto py-4 sm:py-6 md:py-8 px-3 sm:px-4 md:px-6">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row justify-between gap-6 md:gap-8">
          {/* Left Column - Dashboard Information */}
          <div className="w-full md:w-1/3 relative min-h-[300px] h-auto">
            <div className="glass-panel rounded-2xl silver-border absolute inset-0"></div>
            <div className="relative z-1 p-4 sm:p-6 h-full flex flex-col justify-between">
              <div>
                <div className="mb-6 md:mb-8">
                  <h2 className="text-xl sm:text-2xl md:text-3xl font-bold gradient-gold-silver mb-3 md:mb-4">SimAlly Dashboard</h2>
                  <p className="text-secondary mb-4 md:mb-6 text-xs sm:text-sm md:text-base">
                    Welcome to your professional toolkit. Choose from our specialized AI modes designed for your unique workflows.
                  </p>
                  <div className="h-1 w-24 bg-gradient-to-r from-gold-text to-silver-text rounded-full"></div>
                </div>

                <div className="space-y-4 md:space-y-6">
                  <div className="flex items-start space-x-3">
                    <div className="w-6 h-6 sm:w-8 sm:h-8 rounded-lg bg-gradient-to-r from-purple-500 to-blue-500 flex items-center justify-center mt-0.5 sm:mt-1 flex-shrink-0">
                      <Users className="w-3 h-3 sm:w-4 sm:h-4 text-white" />
                    </div>
                    <div className="min-w-0">
                      <h3 className="font-semibold text-primary mb-0.5 sm:mb-1 text-sm sm:text-base break-words">Collaborative Workspace</h3>
                      <p className="text-secondary text-xs break-words">Unified environment for team collaboration and AI-powered productivity.</p>
                    </div>
                  </div>
                  
                  <div className="flex items-start space-x-3">
                    <div className="w-6 h-6 sm:w-8 sm:h-8 rounded-lg bg-gradient-to-r from-blue-500 to-cyan-500 flex items-center justify-center mt-0.5 sm:mt-1 flex-shrink-0">
                      <Bot className="w-3 h-3 sm:w-4 sm:h-4 text-white" />
                    </div>
                    <div className="min-w-0">
                      <h3 className="font-semibold text-primary mb-0.5 sm:mb-1 text-sm sm:text-base break-words">Smart Assistance</h3>
                      <p className="text-secondary text-xs break-words">Personalized AI support adapting to your workflow needs.</p>
                    </div>
                  </div>
                  
                  <div className="flex items-start space-x-3">
                    <div className="w-6 h-6 sm:w-8 sm:h-8 rounded-lg bg-gradient-to-r from-cyan-500 to-green-500 flex items-center justify-center mt-0.5 sm:mt-1 flex-shrink-0">
                      <Video className="w-3 h-3 sm:w-4 sm:h-4 text-white" />
                    </div>
                    <div className="min-w-0">
                      <h3 className="font-semibold text-primary mb-0.5 sm:mb-1 text-sm sm:text-base break-words">Enhanced Communication</h3>
                      <p className="text-secondary text-xs break-words">AI-powered meetings with transcription and intelligent summaries.</p>
                    </div>
                  </div>
                </div>
              </div>

              <div className="hidden md:block mt-4">
                <div className="h-1 w-full bg-gradient-to-r from-transparent via-gold-text/20 to-transparent rounded-full mb-4"></div>
                <p className="text-xs text-center text-secondary italic">Select any mode to get started with your workflow</p>
              </div>
            </div>
          </div>

          {/* Right Column - Feature Cards Grid */}
          <div className="w-full md:w-2/3 grid grid-cols-1 lg:grid-cols-2 gap-4 md:gap-6 h-auto md:h-full">
            {features.map((feature) => (
              <GlassCard
                key={feature.id}
                className="p-4 cursor-pointer group h-full flex flex-col"
                hover
                goldBorder
                onClick={() => handleFeatureClick(feature.route)}
              >
                <div className="text-center flex flex-col h-full justify-between">
                  <div className="text-center">
                    <div className={`w-10 h-10 sm:w-12 sm:h-12 md:w-16 md:h-16 rounded-lg bg-gradient-to-r ${feature.color} flex items-center justify-center mx-auto mb-3 md:mb-4`}>
                      <feature.icon className="w-5 h-5 sm:w-6 sm:h-6 md:w-8 md:h-8 text-white" />
                    </div>
                  
                  <h3 className="text-base sm:text-lg md:text-xl font-bold text-primary mb-2 group-hover:gold-text transition-colors">
                    {feature.title}
                  </h3>
                  <p className="text-secondary leading-relaxed mb-3 md:mb-4 text-xs md:text-sm">
                    {feature.description}
                  </p>
                  </div>
                  
                  <div className="flex items-center justify-center gradient-gold-silver font-semibold text-xs md:text-sm mt-auto">
                    <span>Access {feature.title}</span>
                    <svg className="w-3 h-3 md:w-4 md:h-4 ml-2 transition-transform group-hover:translate-x-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </div>
                </div>
              </GlassCard>
            ))}
          </div>
        </div>
      </main>
    </div>
  );
};

export default Dashboard;