import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Bot, Gamepad2, LogOut, Settings, User } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import ThemeToggle from '../components/ThemeToggle';
import GlassCard from '../components/ui/GlassCard';

const Dashboard: React.FC = () => {
  const navigate = useNavigate();
  const { user, logout, isAuthenticated } = useAuth();

  useEffect(() => {
    if (!isAuthenticated) {
      navigate('/');
    }
  }, [isAuthenticated, navigate]);

  const features = [
    {
      id: 'assistant',
      icon: Bot,
      title: 'AI Assistant',
      description: 'Professional productivity support with Gmail management, Zoom integration, and intelligent assistance for your daily workflow.',
      route: '/assistant',
    },
    {
      id: 'game-mode',
      icon: Gamepad2,
      title: 'Interactive Games',
      description: 'Engaging mental exercises, problem-solving games, and intelligent entertainment for cognitive enhancement.',
      route: '/game-mode',
    },
  ];

  const handleFeatureClick = (route: string) => {
    navigate(route);
  };

  const handleLogout = () => {
    logout();
    navigate('/');
  };

  if (!isAuthenticated) {
    return null;
  }

  return (
    <div className="min-h-screen bg-primary">
      {/* Header */}
      <header className="glass-panel border-0 border-b silver-border">
        <div className="max-w-7xl mx-auto container-padding">
          <div className="flex justify-between items-center py-6">
            <div className="flex items-center space-x-4">
              <div className="w-12 h-12 rounded-full bg-gradient-gold-silver flex items-center justify-center">
                <User className="w-6 h-6 text-white" />
              </div>
              <div>
                <h2 className="text-lg font-bold gradient-gold-silver">
                  Welcome, {user?.name}
                </h2>
                <p className="text-sm text-secondary">
                  Select your preferred mode
                </p>
              </div>
            </div>
            
            <div className="flex items-center space-x-4">
              <ThemeToggle />
              <button className="glass-panel p-3 rounded-lg glass-panel-hover">
                <Settings className="w-5 h-5 text-secondary" />
              </button>
              <button
                onClick={handleLogout}
                className="glass-panel p-3 rounded-lg glass-panel-hover"
              >
                <LogOut className="w-5 h-5 text-secondary" />
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="section-spacing container-padding">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <h1 className="text-4xl md:text-5xl font-bold gradient-gold-silver mb-6">
              Your Professional Dashboard
            </h1>
            <p className="text-lg text-secondary max-w-2xl mx-auto">
              Choose from specialized AI modes, each designed to excel in specific professional domains.
            </p>
          </div>

          {/* Feature Cards Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 max-w-4xl mx-auto mb-16">
            {features.map((feature) => (
              <GlassCard
                key={feature.id}
                className="p-8 cursor-pointer group"
                hover
                goldBorder
                onClick={() => handleFeatureClick(feature.route)}
              >
                <div className="flex items-start space-x-6">
                  <div className="w-14 h-14 rounded-lg bg-gradient-gold-silver flex items-center justify-center flex-shrink-0">
                    <feature.icon className="w-7 h-7 text-white" />
                  </div>
                  
                  <div className="flex-1">
                    <h3 className="text-xl font-bold text-primary mb-3 group-hover:gold-text transition-colors">
                      {feature.title}
                    </h3>
                    <p className="text-secondary leading-relaxed mb-4 text-sm">
                      {feature.description}
                    </p>
                    <div className="flex items-center gradient-gold-silver font-semibold text-sm">
                      <span>Access {feature.title}</span>
                      <svg className="w-4 h-4 ml-2 transition-transform group-hover:translate-x-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                      </svg>
                    </div>
                  </div>
                </div>
              </GlassCard>
            ))}
          </div>

          {/* Usage Statistics */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-4xl mx-auto">
            {[
              { label: 'Sessions Today', value: '0', color: 'gold-text' },
              { label: 'Total Interactions', value: '0', color: 'silver-text' },
              { label: 'Preferred Mode', value: 'Not Set', color: 'gold-text' },
            ].map((stat, index) => (
              <GlassCard key={index} className="p-6 text-center" hover>
                <div className={`text-2xl font-bold ${stat.color} mb-2`}>
                  {stat.value}
                </div>
                <div className="text-secondary font-medium text-sm">
                  {stat.label}
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