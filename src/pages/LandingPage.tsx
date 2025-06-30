import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Bot, Gamepad2, Sparkles, ArrowRight, Users, Shield, Zap, LogOut, MessageSquare, CheckSquare, Calendar, Mail, Brain, FileText, Settings, Target } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import ThemeToggle from '../components/ThemeToggle';
import AuthModal from '../components/AuthModal';
import GlassCard from '../components/ui/GlassCard';
import Button from '../components/ui/Button';
import NumberedFeature from '../components/ui/NumberedFeature';
import TrustedBy from '../components/ui/TrustedBy';
import EnhancedHero from '../components/ui/EnhancedHero';
import StatsShowcase from '../components/ui/StatsShowcase';
import AnimatedBackground from '../components/ui/AnimatedBackground';
import useScrollReveal from '../hooks/useScrollReveal';

const LandingPage: React.FC = () => {
  const navigate = useNavigate();
  const { isAuthenticated, signOut } = useAuth();
  const [authModal, setAuthModal] = useState<{ isOpen: boolean; mode: 'signin' | 'signup' }>({
    isOpen: false,
    mode: 'signin'
  });

  // Initialize scroll reveal animations
  useScrollReveal();

  // Stats data for showcase
  const statsData = [
    { value: '10000', label: 'Active Users', suffix: '+' },
    { value: '50000', label: 'Tasks Completed', suffix: '+' },
    { value: '99', label: 'Uptime', suffix: '%' },
    { value: '24', label: 'Support Available', suffix: '/7' }
  ];

  // Effortel-inspired numbered features
  const numberedFeatures = [
    {
      number: '01',
      title: 'Powerful Self-Service Tools',
      description: 'AI-powered automation for reduced operational overhead and increased user satisfaction with intelligent task management.',
      icon: Settings,
    },
    {
      number: '02',
      title: 'Customizable Dashboards',
      description: 'Tailored information access and personalized workflows for optimal efficiency and team collaboration.',
      icon: Target,
    },
    {
      number: '03',
      title: 'Intuitive User Interface',
      description: 'Easy navigation and user-friendly workflows designed for faster business growth and seamless adoption.',
      icon: Users,
    },
    {
      number: '04',
      title: 'Automated Workflows',
      description: 'Streamlined processes with intelligent automation that eliminates manual tasks for strategic focus.',
      icon: Zap,
    },
  ];

  // Trusted by logos (you can replace these with actual client logos)
  const trustedLogos = [
    { name: 'Microsoft', url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/4/44/Microsoft_logo.svg/200px-Microsoft_logo.svg.png', alt: 'Microsoft' },
    { name: 'Google', url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/2/2f/Google_2015_logo.svg/200px-Google_2015_logo.svg.png', alt: 'Google' },
    { name: 'OpenAI', url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/0/04/ChatGPT_logo.svg/200px-ChatGPT_logo.svg.png', alt: 'OpenAI' },
    { name: 'Vercel', url: 'https://assets.vercel.com/image/upload/front/favicon/vercel/180x180.png', alt: 'Vercel' },
    { name: 'Supabase', url: 'https://supabase.com/favicon/favicon-96x96.png', alt: 'Supabase' },
    { name: 'React', url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/a/a7/React-icon.svg/200px-React-icon.svg.png', alt: 'React' },
    { name: 'TailwindCSS', url: 'https://tailwindcss.com/favicons/favicon-32x32.png', alt: 'TailwindCSS' },
    { name: 'TypeScript', url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/4/4c/Typescript_logo_2020.svg/200px-Typescript_logo_2020.svg.png', alt: 'TypeScript' },
  ];

  const mainFeatures = [
    {
      icon: Users,
      title: 'Workspace',
      description: 'Collaborate seamlessly with AI-powered chat, automatic task detection, calendar integration, and intelligent project management tools.',
      color: 'from-purple-500 to-blue-500',
      highlights: ['AI Task Detection', 'Real-time Chat', 'Calendar Integration', 'Project Management']
    },
    {
      icon: Bot,
      title: 'AI Assistant',
      description: 'Your intelligent co-pilot for daily productivity with Gmail management, document generation, and smart insights for professional workflows.',
      color: 'from-blue-500 to-cyan-500',
      highlights: ['Gmail Integration', 'Document Generation', 'Smart Insights', 'Productivity Tools']
    },
    {
      icon: Gamepad2,
      title: 'Interactive Games',
      description: 'Engage your mind with AI-powered riddles, classic guessing games, and intelligent entertainment for cognitive enhancement.',
      color: 'from-green-500 to-yellow-500',
      highlights: ['AI Riddles', '20 Questions', 'Mind Games', 'Cognitive Training']
    },
  ];

  const additionalFeatures = [
    {
      icon: MessageSquare,
      title: 'Smart Chat',
      description: 'AI-enhanced messaging with automatic task creation from conversations',
    },
    {
      icon: CheckSquare,
      title: 'Task Management',
      description: 'Intelligent task tracking with AI-powered priority suggestions',
    },
    {
      icon: Calendar,
      title: 'Calendar Integration',
      description: 'Seamless scheduling with smart meeting coordination',
    },
    {
      icon: Mail,
      title: 'Gmail Management',
      description: 'Professional email handling with AI-powered organization',
    },
    {
      icon: Brain,
      title: 'AI Processing',
      description: 'Advanced natural language understanding for all interactions',
    },
    {
      icon: FileText,
      title: 'Document Generation',
      description: 'Create professional documents with AI assistance',
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
    <div className="min-h-screen bg-primary page-enter">
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
                    className="flex p-2 items-center space-x-2"
                  >
                    Dashboard
                  </Button>
                  <Button
                    onClick={handleLogout}
                    variant="secondary"
                    size="sm"
                    className="flex p-2 items-center space-x-2"
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

      {/* Enhanced Hero Section */}
      <EnhancedHero
        title="SimAlly"
        subtitle="The Future of AI Productivity"
        description="SimAlly combines advanced AI assistance, collaborative workspaces, and engaging interactive experiences into one seamless platform. From managing your Gmail and generating documents to playing mind-enhancing games, SimAlly is your complete digital companion for professional and personal growth."
        ctaText={isAuthenticated ? 'Access Dashboard' : 'Start Your Journey'}
        onCtaClick={handleGetStarted}
      />

      {/* Stats Showcase */}
      <StatsShowcase stats={statsData} />

      {/* Animated Background for Visual Appeal */}
      <section className="relative py-16 overflow-hidden">
        <AnimatedBackground variant="waves" />
      </section>

      {/* Trusted By Section */}
      <section className="py-16 container-padding">
        <div className="max-w-7xl mx-auto">
          <TrustedBy logos={trustedLogos} />
        </div>
      </section>

      {/* Section Divider */}
      <div className="max-w-7xl mx-auto container-padding">
        <div className="section-divider"></div>
      </div>

      {/* Numbered Features Section - Enhanced Effortel Style */}
      <section className="section-spacing container-padding relative">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16 reveal">
            <h2 className="text-3xl md:text-4xl font-bold gradient-gold-silver mb-6">
              Efficiency, Scalability, and Agility
            </h2>
            <p className="text-lg text-secondary max-w-3xl mx-auto">
              Empower your team and your customers with intelligent tools designed for the modern workplace.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-5xl mx-auto stagger-children">
            {numberedFeatures.map((feature, index) => (
              <NumberedFeature
                key={index}
                number={feature.number}
                title={feature.title}
                description={feature.description}
                icon={feature.icon}
                delay={index * 150}
              />
            ))}
          </div>
        </div>
        
        {/* Background decoration */}
        <div className="absolute top-1/2 left-1/4 w-32 h-32 bg-gradient-to-r from-purple-500 to-blue-500 rounded-full opacity-5 animate-float-slow" />
        <div className="absolute bottom-1/4 right-1/4 w-24 h-24 bg-gradient-to-r from-yellow-500 to-orange-500 rounded-full opacity-5 animate-float-delayed" />
      </section>

      {/* Section Divider */}
      <div className="max-w-7xl mx-auto container-padding">
        <div className="section-divider"></div>
      </div>

      {/* Enhanced Main Features Section */}
      <section className="section-spacing container-padding relative">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16 reveal">
            <h2 className="text-3xl md:text-4xl font-bold gradient-gold-silver mb-6">
              Three Powerful Modes, Infinite Possibilities
            </h2>
            <p className="text-lg text-secondary max-w-3xl mx-auto">
              Each mode is meticulously designed to excel in specific domains, providing you with 
              specialized AI assistance tailored to your unique needs.
            </p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 max-w-6xl mx-auto mb-16">
            {mainFeatures.map((feature, index) => (
              <GlassCard key={index} className={`p-8 h-full reveal delay-${index + 1}`} hover goldBorder>
                <div className="flex flex-col h-full">
                  <div className="flex items-start space-x-6 mb-6">
                    <div className={`w-16 h-16 rounded-xl bg-gradient-to-r ${feature.color} flex items-center justify-center flex-shrink-0`}>
                      <feature.icon className="w-8 h-8 text-white" />
                    </div>
                    
                    <div className="flex-1">
                      <h3 className="text-2xl font-bold text-primary mb-3">
                        {feature.title}
                      </h3>
                      <p className="text-secondary leading-relaxed mb-4">
                        {feature.description}
                      </p>
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-3 mt-auto">
                    {feature.highlights.map((highlight, idx) => (
                      <div key={idx} className="flex items-center space-x-2 text-sm">
                        <div className="w-2 h-2 rounded-full bg-gradient-gold-silver"></div>
                        <span className="text-primary font-medium">{highlight}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </GlassCard>
            ))}
          </div>
        </div>
        
        {/* Floating background elements */}
        <div className="absolute top-1/4 right-10 w-20 h-20 bg-gradient-to-r from-cyan-500 to-blue-500 rounded-full opacity-10 animate-float" />
        <div className="absolute bottom-1/3 left-16 w-16 h-16 bg-gradient-to-r from-green-500 to-emerald-500 rounded-full opacity-10 animate-float-delayed" />
      </section>

      {/* Section Divider */}
      <div className="max-w-7xl mx-auto container-padding">
        <div className="section-divider"></div>
      </div>

      {/* Enhanced Additional Features Grid */}
      <section className="section-spacing container-padding relative">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16 reveal">
            <h2 className="text-3xl md:text-4xl font-bold gradient-gold-silver mb-6">
              Comprehensive Feature Set
            </h2>
            <p className="text-lg text-secondary max-w-2xl mx-auto">
              Every feature is designed to work seamlessly together, creating a unified experience 
              that adapts to your workflow.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 max-w-6xl mx-auto stagger-children">
            {additionalFeatures.map((feature, index) => (
              <div key={index} className="glass-card-enhanced p-6 text-center animate-cardHover group relative overflow-hidden">
                <div className="absolute inset-0 bg-gradient-to-br from-purple-500/5 to-blue-500/5 opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
                
                <div className="relative z-10">
                  <div className="w-12 h-12 mx-auto mb-4 rounded-xl bg-gradient-to-r from-purple-500 to-blue-500 flex items-center justify-center group-hover:scale-110 group-hover:rotate-3 transition-all duration-300">
                    <feature.icon className="w-6 h-6 text-white" />
                  </div>
                  <h3 className="text-lg font-bold text-primary mb-3 group-hover:gold-text transition-colors duration-300">
                    {feature.title}
                  </h3>
                  <p className="text-secondary text-sm leading-relaxed group-hover:text-primary transition-colors duration-300">
                    {feature.description}
                  </p>
                  
                  {/* Hover accent */}
                  <div className="w-0 h-0.5 bg-gradient-to-r from-purple-500 to-blue-500 group-hover:w-full transition-all duration-500 mt-4 mx-auto" />
                </div>
              </div>
            ))}
          </div>
        </div>
        
        {/* Background grid pattern */}
        <div className="absolute inset-0 opacity-5">
          <div className="grid grid-cols-8 gap-8 h-full">
            {Array.from({ length: 32 }).map((_, i) => (
              <div key={i} className="border-r border-accent-gold" />
            ))}
          </div>
        </div>
      </section>

      {/* Section Divider */}
      <div className="max-w-7xl mx-auto container-padding">
        <div className="section-divider"></div>
      </div>

      {/* Enhanced Stats Section */}
      <StatsShowcase 
        stats={[
          { value: '10000', label: 'Active Users', suffix: '+' },
          { value: '500', label: 'AI Interactions', suffix: 'K+' },
          { value: '99', label: 'Uptime Guarantee', suffix: '%' },
          { value: '2', label: 'Response Time', prefix: '<', suffix: 's' }
        ]}
        title="Trusted by Professionals Worldwide"
        subtitle="Join thousands of users who have transformed their productivity with SimAlly"
      />

      {/* Technology Highlights */}
      <section className="section-spacing container-padding">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold gradient-gold-silver mb-6">
              Built with Cutting-Edge Technology
            </h2>
            <p className="text-lg text-secondary max-w-2xl mx-auto">
              Powered by advanced AI models and modern web technologies for unparalleled performance.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-4xl mx-auto">
            {[
              {
                title: 'Advanced AI Models',
                description: 'Powered by state-of-the-art language models for intelligent assistance',
                icon: Brain,
                color: 'from-purple-500 to-blue-500'
              },
              {
                title: 'Real-time Collaboration',
                description: 'Instant synchronization across all devices and team members',
                icon: Zap,
                color: 'from-blue-500 to-cyan-500'
              },
              {
                title: 'Enterprise Security',
                description: 'Bank-level encryption and privacy protection for all your data',
                icon: Shield,
                color: 'from-cyan-500 to-green-500'
              }
            ].map((tech, index) => (
              <GlassCard key={index} className="p-8 text-center" hover>
                <div className={`w-16 h-16 rounded-xl bg-gradient-to-r ${tech.color} flex items-center justify-center mx-auto mb-6`}>
                  <tech.icon className="w-8 h-8 text-white" />
                </div>
                <h3 className="text-xl font-bold text-primary mb-4">{tech.title}</h3>
                <p className="text-secondary leading-relaxed">{tech.description}</p>
              </GlassCard>
            ))}
          </div>
        </div>
      </section>

      {/* Enhanced CTA Section */}
      <section className="section-spacing container-padding relative">
        <div className="max-w-4xl mx-auto text-center">
          <div className="glass-card-enhanced p-12 relative overflow-hidden reveal-scale">
            {/* Background animation */}
            <div className="absolute inset-0 bg-gradient-to-br from-purple-500/10 via-blue-500/10 to-cyan-500/10 animate-gradientShift" />
            
            <div className="relative z-10">
              <h2 className="text-3xl md:text-4xl font-bold gradient-gold-silver mb-6 ">
                Ready to Transform Your Workflow?
              </h2>
              <p className="text-lg text-secondary mb-8 max-w-2xl mx-auto">
                Join thousands of professionals who have revolutionized their productivity and collaboration 
                with SimAlly's intelligent platform.
              </p>
              <div className="flex flex-col sm:flex-row gap-4 justify-center items-center mb-6">
                <Button
                  onClick={handleGetStarted}
                  variant="premium"
                  size="lg"
                  className="flex items-center space-x-2 group relative overflow-hidden"
                >
                  <span className="relative z-10">{isAuthenticated ? 'Access Dashboard' : 'Start Free Today'}</span>
                  <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform duration-200 relative z-10" />
                  
                  {/* Button shimmer effect */}
                  <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white to-transparent -skew-x-12 -translate-x-full group-hover:translate-x-full transition-transform duration-700 opacity-20" />
                </Button>
              </div>
              <p className="text-sm text-secondary">
                No setup fees • Cancel anytime • Full feature access
              </p>
            </div>
            
            {/* Decorative elements */}
            <div className="absolute top-4 right-4 w-4 h-4 bg-gradient-to-r from-purple-500 to-blue-500 rounded-full animate-pulse-slow" />
            <div className="absolute bottom-4 left-4 w-3 h-3 bg-gradient-to-r from-yellow-500 to-orange-500 rounded-full animate-pulse-slow" style={{ animationDelay: '1s' }} />
          </div>
        </div>
      </section>

      {/* Floating Action Button */}
      {!isAuthenticated && (
        <div className="fixed bottom-8 right-8 z-50">
          <Button
            onClick={handleGetStarted}
            variant="premium"
            size="lg"
            className="rounded-full w-16 h-16 flex items-center justify-center shadow-2xl animate-bounce-slow group"
          >
            <ArrowRight className="w-6 h-6 group-hover:scale-110 transition-transform duration-200" />
          </Button>
        </div>
      )}

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