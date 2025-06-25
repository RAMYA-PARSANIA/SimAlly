import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Bot, Gamepad2, Sparkles, ArrowRight, Users, Shield, Zap, LogOut } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import ThemeToggle from '../components/ThemeToggle';
import AuthModal from '../components/AuthModal';
import GlassCard from '../components/ui/GlassCard';
import Button from '../components/ui/Button';

const LandingPage: React.FC = () => {
  const navigate = useNavigate();
  const { isAuthenticated, signOut } = useAuth();
  const [authModal, setAuthModal] = useState<{ isOpen: boolean; mode: 'signin' | 'signup' }>({
    isOpen: false,
    mode: 'signin'
  });

  const features = [
    {
      icon: Bot,
      title: 'AI Assistant',
      description: 'Professional productivity with Gmail management, Zoom integration, and intelligent assistance for your daily workflow.',
      color: 'gold-text',
    },
    {
      icon: Gamepad2,
      title: 'Interactive Games',
      description: 'Engaging entertainment and mental exercises with intelligent gameplay including riddles and 20 questions.',
      color: 'silver-text',
    },
  ];

  const handleGetStarted = () => {
    if (isAuthenticated) {
      navigate('/dashboard');
    } else {
      setAuthModal({ isOpen: true, mode: 'signup' });
    }
  };

  const handleSignIn = () => {
    if (isAuthenticated) {
      navigate('/dashboard');
    } else {
      setAuthModal({ isOpen: true, mode: 'signin' });
    }
  };
  
  const handleLogout = async () => {
    await signOut();
    // After logout, stay on the landing page
  };

  return (
    <div className="min-h-screen bg-primary">
      {/* Header */}
      <header className="fixed top-0 w-full z-40 glass-panel border-0 border-b silver-border">
        <div className="max-w-7xl mx-auto container-padding">
          <div className="flex justify-between items-center py-4">
            <div className="flex items-center space-x-3">
              <Sparkles className="w-7 h-7 gold-text" />
              <h1 className="text-2xl font-bold gradient-gold-silver">SimAlly</h1>
            </div>
            
            <div className="flex items-center space-x-4">
              <ThemeToggle />
              {isAuthenticated ? (
                <>
                  <Button
                    onClick={() => navigate('/dashboard')}
                    variant="secondary"
                    size="sm"
                  >
                    Dashboard
                  </Button>
                  <Button
                    onClick={handleLogout}
                    variant="secondary"
                    size="sm"
                    className="flex items-center space-x-2"
                  >
                    <LogOut className="w-4 h-4" />
                    <span>Logout</span>
                  </Button>
                </>
              ) : (
                <>
                  <Button
                    onClick={handleSignIn}
                    variant="secondary"
                    size="sm"
                  >
                    Sign In
                  </Button>
                  <Button
                    onClick={handleGetStarted}
                    variant="premium"
                    size="sm"
                  >
                    Get Started
                  </Button>
                </>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="pt-32 pb-20 container-padding">
        <div className="max-w-7xl mx-auto">
          <div className="text-center max-w-4xl mx-auto">
            <h1 className="text-5xl md:text-6xl lg:text-7xl font-bold mb-6 gradient-gold-silver">
              SimAlly
            </h1>
            
            <p className="text-xl md:text-2xl text-primary mb-4 font-light">
              Your Professional AI Companion
            </p>
            
            <p className="text-lg gold-text font-medium mb-6">
              One intelligent assistant. Infinite professional possibilities.
            </p>
            
            <p className="text-base text-secondary max-w-2xl mx-auto mb-12 leading-relaxed">
              Experience premium AI assistance designed for professionals. From productivity enhancement 
              with Gmail and Zoom integration to intelligent entertainment.
            </p>

            <Button
              onClick={handleGetStarted}
              variant="premium"
              size="lg"
              className="inline-flex items-center space-x-2"
            >
              <span>{isAuthenticated ? 'Access Dashboard' : 'Begin Your Journey'}</span>
              <ArrowRight className="w-5 h-5" />
            </Button>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="section-spacing container-padding">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold gradient-gold-silver mb-6">
              Two Professional Modes
            </h2>
            <p className="text-lg text-secondary max-w-2xl mx-auto">
              Each mode is carefully crafted to excel in specific professional and personal domains.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-4xl mx-auto">
            {features.map((feature, index) => (
              <GlassCard key={index} className="p-8" hover goldBorder>
                <div className="flex items-start space-x-6">
                  <div className="w-12 h-12 rounded-lg bg-gradient-gold-silver flex items-center justify-center flex-shrink-0">
                    <feature.icon className="w-6 h-6 text-white" />
                  </div>
                  
                  <div className="flex-1">
                    <h3 className="text-xl font-bold text-primary mb-3">
                      {feature.title}
                    </h3>
                    <p className="text-secondary leading-relaxed">
                      {feature.description}
                    </p>
                  </div>
                </div>
              </GlassCard>
            ))}
          </div>
        </div>
      </section>

      {/* Stats Section */}
      <section className="section-spacing container-padding">
        <div className="max-w-7xl mx-auto">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-4xl mx-auto">
            {[
              { icon: Users, label: 'Professionals Served', value: '10,000+', color: 'gold-text' },
              { icon: Shield, label: 'Privacy Guaranteed', value: '100%', color: 'silver-text' },
              { icon: Zap, label: 'Average Response', value: '<1 second', color: 'gold-text' },
            ].map((stat, index) => (
              <GlassCard key={index} className="p-8 text-center" hover>
                <stat.icon className={`w-8 h-8 ${stat.color} mx-auto mb-4`} />
                <div className="text-2xl font-bold gradient-gold-silver mb-2">
                  {stat.value}
                </div>
                <div className="text-secondary font-medium">
                  {stat.label}
                </div>
              </GlassCard>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="section-spacing container-padding">
        <div className="max-w-4xl mx-auto text-center">
          <GlassCard className="p-12" goldBorder>
            <h2 className="text-3xl md:text-4xl font-bold gradient-gold-silver mb-6">
              Ready for Professional AI Assistance?
            </h2>
            <p className="text-lg text-secondary mb-8 max-w-2xl mx-auto">
              Join thousands of professionals who have elevated their productivity and entertainment with SimAlly.
            </p>
            <Button
              onClick={handleGetStarted}
              variant="premium"
              size="lg"
            >
              {isAuthenticated ? 'Access Dashboard' : 'Start Free Trial'}
            </Button>
          </GlassCard>
        </div>
      </section>

      <AuthModal
        isOpen={authModal.isOpen}
        onClose={() => setAuthModal({ ...authModal, isOpen: false })}
        mode={authModal.mode}
        onModeChange={(mode) => setAuthModal({ ...authModal, mode })}
      />
    </div>
  );
};

export default LandingPage;