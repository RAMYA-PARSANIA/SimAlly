import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Bot, Gamepad2, Video, LogOut, Settings, User, Users, MessageSquare, ToggleLeft as Google, Stethoscope, Scale } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import ThemeToggle from '../components/ThemeToggle';
import GlassCard from '../components/ui/GlassCard';
import Button from '../components/ui/Button';
import AnimatedBackground from '../components/ui/AnimatedBackground';
import useScrollReveal from '../hooks/useScrollReveal';
import { useTheme } from '../contexts/ThemeContext';

const Dashboard: React.FC = () => {
  const navigate = useNavigate();
  const { user, signOut, loading, isGoogleConnected, connectGoogle, disconnectGoogle } = useAuth();
  const { isDark } = useTheme();
  const [googleConnecting, setGoogleConnecting] = useState(false);

  // Initialize scroll reveal animations
  useScrollReveal();

  useEffect(() => {
    if (!loading && !user) {
      navigate('/');
    }

    // Check for Google connection status in URL params
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get('google_connected') === 'true') {
      // Clear the URL parameter
      window.history.replaceState({}, '', window.location.pathname);
    } else if (urlParams.get('google_error') === 'true') {
      // Clear the URL parameter
      window.history.replaceState({}, '', window.location.pathname);
    }
  }, [user, loading, navigate]);

  const handleGoogleConnect = async () => {
    try {
      setGoogleConnecting(true);
      await connectGoogle();
    } catch (error) {
      console.error('Failed to connect Google:', error);
    } finally {
      setGoogleConnecting(false);
    }
  };

  const handleGoogleDisconnect = async () => {
    try {
      await disconnectGoogle();
    } catch (error) {
      console.error('Failed to disconnect Google:', error);
    }
  };

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
      requiresGoogle: true,
    },
    {
      id: 'meetings',
      icon: Video,
      title: 'Video Meetings',
      description: 'Schedule and join Google Meet video conferences directly from the platform.',
      route: '/meetings',
      color: 'from-cyan-500 to-teal-500',
      requiresGoogle: true,
    },
    {
      id: 'game-mode',
      icon: Gamepad2,
      title: 'Interactive Games',
      description: 'Engaging mental exercises, problem-solving games, and intelligent entertainment for cognitive enhancement.',
      route: '/game-mode',
      color: 'from-green-500 to-yellow-500',
    },
    {
      id: 'professional-services',
      icon: Stethoscope,
      title: 'Professional Services',
      description: 'Access emotional support and legal advice through AI-powered video consultations.',
      route: '/professional-services',
      color: 'from-red-500 to-orange-500',
    },
  ];

  const handleFeatureClick = (route: string, requiresGoogle: boolean = false) => {
    if (requiresGoogle && !isGoogleConnected) {
      alert('Please connect your Google account first to use this feature.');
      return;
    }
    navigate(route);
  };

  const handleLogout = async () => {
    await signOut();
    navigate('/');
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-primary flex items-center justify-center page-enter">
        <div className="glass-card-enhanced rounded-2xl p-8 max-w-md mx-auto text-center animate-fadeInScale">
          <div className="animate-spin w-8 h-8 border-2 border-gold-text border-t-transparent rounded-full mx-auto mb-4"></div>
          <h3 className="text-xl font-bold text-primary mb-2 gradient-gold-silver">Loading Dashboard...</h3>
          <p className="text-secondary">Setting up your workspace</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return null;
  }

  return (
    <div className="min-h-screen bg-primary page-enter relative">
      {/* Animated Background */}
      <div className="fixed inset-0 pointer-events-none">
        <AnimatedBackground variant="grid" />
      </div>
      
      {/* Header */}
      <header className="glass-panel border-0 border-b silver-border relative z-10">
        <div className="max-w-7xl mx-auto container-padding">
          <div className="flex justify-between items-center py-6">
            <div className="flex items-center space-x-4 reveal-left">
              <div className="w-12 h-12 rounded-full bg-gradient-gold-silver flex items-center justify-center animate-pulse-slow">
                <User className="w-6 h-6 text-white" />
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
            
            <div className="flex items-center space-x-4 reveal-right">
              {/* Google Connection Status */}
              {isGoogleConnected ? (
                <Button
                  onClick={handleGoogleDisconnect}
                  variant="secondary"
                  size="sm"
                  className="flex items-center space-x-2 hover-lift"
                >
                  <Google className="w-4 h-4" />
                  <span>Disconnect Google</span>
                </Button>
              ) : (
                <Button
                  onClick={handleGoogleConnect}
                  variant="secondary"
                  size="sm"
                  className="flex items-center space-x-2 hover-lift"
                  disabled={googleConnecting}
                >
                  <Google className="w-4 h-4" />
                  <span>{googleConnecting ? 'Connecting...' : 'Connect Google'}</span>
                </Button>
              )}
              
              <ThemeToggle />
              
              <button
                onClick={handleLogout}
                className="flex glass-panel border-white p-2 rounded-lg glass-panel-hover space-x-2 hover-lift"
              >
                <LogOut className="w-5 h-6 text-primary" />
                <span>Logout</span>
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="section-spacing container-padding relative z-10">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-16 reveal relative flex items-center justify-between gap-2 sm:gap-4">
            {/* Left Logo */}
            
            <a
              href="https://bolt.new"
              target="_blank"
              rel="noopener noreferrer"
              className="w-16 h-8 sm:w-20 sm:h-10 md:w-24 md:h-12 hover:scale-110 transition-transform duration-200 flex-shrink-0"
            >
              <img
                src={isDark ? '/logotext_poweredby_360w.svg' : '/logotext_poweredby_360b.svg'}
                alt="Powered by Bolt"
                className="w-full h-full object-contain"
              />
            </a>

            {/* Center Title */}
            <div className="flex-1">
              <h1 className="text-4xl md:text-5xl font-bold gradient-gold-silver mb-6">
                Your Professional Dashboard
              </h1>
              <p className="text-lg text-secondary max-w-2xl mx-auto">
                Choose from specialized AI modes, each designed to excel in specific professional domains.
              </p>
            </div>

            {/* Right Badge */}
            <a
              href="https://bolt.new"
              target="_blank"
              rel="noopener noreferrer"
              className="w-12 h-12 sm:w-16 sm:h-16 md:w-20 md:h-20 hover:scale-110 transition-transform duration-200 flex-shrink-0"
            >
              <img
                src={isDark ? '/white_circle_360x360.svg' : '/black_circle_360x360.svg'}
                alt="Bolt Logo"
                className="w-full h-full object-contain"
              />
            </a>
          </div>

          {/* Section Divider */}
          <div className="section-divider mb-16"></div>

          {/* Feature Cards Grid */}
          {/* Feature Cards Grid - First row with 3 cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-6xl mx-auto mb-8">
            {features.slice(0, 3).map((feature) => (
              <GlassCard
                key={feature.id}
                className={`p-8 cursor-pointer group h-full ${
                  feature.requiresGoogle && !isGoogleConnected ? 'opacity-70' : ''
                }`}
                hover
                goldBorder
                onClick={() => handleFeatureClick(feature.route, feature.requiresGoogle)}
              >
                <div className="text-center h-full flex flex-col">
                  <div className={`w-16 h-16 rounded-lg bg-gradient-to-r ${feature.color} flex items-center justify-center mx-auto mb-6`}>
                    <feature.icon className="w-8 h-8 text-white" />
                  </div>
                  
                  <h3 className="text-xl font-bold text-primary mb-4 group-hover:gold-text transition-colors">
                    {feature.title}
                  </h3>
                  <p className="text-secondary leading-relaxed mb-6 text-sm flex-grow">
                    {feature.description}
                  </p>
                  <div className="flex items-center justify-center gradient-gold-silver font-semibold text-sm mt-auto">
                    <span>Access {feature.title}</span>
                    <svg className="w-4 h-4 ml-2 transition-transform group-hover:translate-x-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </div>
                  
                  {feature.requiresGoogle && !isGoogleConnected && (
                    <div className="mt-4 text-xs text-yellow-500 bg-yellow-500/10 p-2 rounded-lg">
                      Requires Google connection
                    </div>
                  )}
                </div>
              </GlassCard>
            ))}
          </div>

          {/* Feature Cards Grid - Second row with 2 cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-4xl mx-auto mb-16">
            {features.slice(3, 5).map((feature) => (
              <GlassCard
                key={feature.id}
                className={`p-8 cursor-pointer group h-full ${
                  feature.requiresGoogle && !isGoogleConnected ? 'opacity-70' : ''
                }`}
                hover
                goldBorder
                onClick={() => handleFeatureClick(feature.route, feature.requiresGoogle)}
              >
                <div className="text-center h-full flex flex-col">
                  <div className={`w-16 h-16 rounded-lg bg-gradient-to-r ${feature.color} flex items-center justify-center mx-auto mb-6`}>
                    <feature.icon className="w-8 h-8 text-white" />
                  </div>
                  
                  <h3 className="text-xl font-bold text-primary mb-4 group-hover:gold-text transition-colors">
                    {feature.title}
                  </h3>
                  <p className="text-secondary leading-relaxed mb-6 text-sm flex-grow">
                    {feature.description}
                  </p>
                  <div className="flex items-center justify-center gradient-gold-silver font-semibold text-sm mt-auto">
                    <span>Access {feature.title}</span>
                    <svg className="w-4 h-4 ml-2 transition-transform group-hover:translate-x-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </div>
                  
                  {feature.requiresGoogle && !isGoogleConnected && (
                    <div className="mt-4 text-xs text-yellow-500 bg-yellow-500/10 p-2 rounded-lg">
                      Requires Google connection
                    </div>
                  )}
                </div>
              </GlassCard>
            ))}
          </div>
        </div>
      </main>
    </div>
  );
}
export default Dashboard;