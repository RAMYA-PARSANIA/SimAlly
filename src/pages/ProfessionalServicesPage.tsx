import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { ArrowLeft, Stethoscope, Scale, User, Bot, Loader2, Video, MessageSquare, Heart, Brain, Briefcase, FileText, Shield, AlertCircle } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import ThemeToggle from '../components/ThemeToggle';
import TavusVideoCall from '../components/TavusVideoCall';
import GlassCard from '../components/ui/GlassCard';
import Button from '../components/ui/Button';

const VITE_AI_API_URL = import.meta.env.VITE_AI_API_URL;
const VITE_API_URL = import.meta.env.VITE_API_URL;

interface ProfessionalService {
  id: string;
  icon: React.ElementType;
  title: string;
  description: string;
  color: string;
  endpoint: string;
}

const ProfessionalServicesPage: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [isLoading, setIsLoading] = useState(false);
  const [conversationUrl, setConversationUrl] = useState<string | null>(null);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [currentService, setCurrentService] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [disclaimer, setDisclaimer] = useState(true);

  const professionalServices: ProfessionalService[] = [
    {
      id: 'mental-health',
      icon: Stethoscope,
      title: 'Emotional Support',
      description: 'Speak with an AI-powered mental health professional for emotional support and guidance',
      color: 'from-green-500 via-teal-500 to-cyan-500',
      endpoint: '/api/create-mental-health-conversation'
    },
    {
      id: 'legal-advice',
      icon: Scale,
      title: 'Legal Consultation',
      description: 'Get professional legal advice for your business and personal matters',
      color: 'from-blue-500 via-indigo-500 to-purple-500',
      endpoint: '/api/create-legal-advice-conversation'
    }
  ];

  const handleBack = () => {
    // End conversation if active before going back
    if (conversationId && userId) {
      endConversation();
    }
    navigate('/dashboard');
  };

  const createServiceConversation = async (service: ProfessionalService) => {
    setIsLoading(true);
    setError(null);
    setConversationUrl(null);
    setConversationId(null);
    setUserId(null);
    setCurrentService(service.id);

    try {
      const response = await fetch(`${VITE_API_URL}${service.endpoint}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({
          user_id: user?.id || null
        })
      });

      const data = await response.json();

      if (data.success) {
        setConversationUrl(data.conversation_url);
        setConversationId(data.conversation_id);
        setUserId(data.user_id);
      } else {
        setError(data.error || 'Failed to create conversation');
      }
    } catch (err) {
      setError('Failed to connect to backend service');
      console.error('Error creating conversation:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const endConversation = async () => {
    if (!conversationId || !userId) return;

    try {
      await fetch(`${VITE_API_URL}/api/end-conversation`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({
          user_id: userId
        })
      });
    } catch (err) {
      console.error('Error ending conversation:', err);
    } finally {
      setConversationUrl(null);
      setConversationId(null);
      setUserId(null);
      setCurrentService(null);
    }
  };

  const handleSelectService = async (service: ProfessionalService) => {
    if (conversationId && userId) {
      await endConversation();
    }
    
    // Show disclaimer first
    setDisclaimer(true);
    setCurrentService(service.id);
  };

  const handleAcceptDisclaimer = () => {
    setDisclaimer(false);
    const service = professionalServices.find(s => s.id === currentService);
    if (service) {
      createServiceConversation(service);
    }
  };

  const handleLeaveCall = () => {
    endConversation();
  };

  const getServiceTitle = () => {
    if (currentService === 'mental-health') return 'Mental Health Support';
    if (currentService === 'legal-advice') return 'Legal Consultation';
    return 'Professional Services';
  };

  // Cleanup conversation on component unmount
  useEffect(() => {
    return () => {
      if (conversationId && userId) {
        endConversation();
      }
    };
  }, [conversationId, userId]);

  // Always join the meeting if conversationUrl is present, no waiting UI
  if (conversationUrl) {
    return (
      <div className="min-h-screen bg-primary">
        <div className="relative z-10 flex flex-col h-screen">
          <header className="glass-panel border-0 border-b silver-border">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
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
                  <h1 className="text-lg font-semibold text-primary">
                    {getServiceTitle()}
                  </h1>
                </div>
                <ThemeToggle />
              </div>
            </div>
          </header>

          <main className="flex-1">
            <TavusVideoCall 
              meetingUrl={conversationUrl} 
              onLeave={handleLeaveCall}
              gameType={currentService === 'mental-health' ? 'mentalHealth' : currentService === 'legal-advice' ? 'legalAdvice' : undefined}
            />
          </main>
        </div>
      </div>
    );
  }

  if (isLoading) {
    const service = professionalServices.find(s => s.id === currentService);
    const serviceTitle = service?.title || 'Professional Service';
    
    return (
      <div className="min-h-screen flex items-center justify-center bg-primary">
        <div className="glass-panel p-8 rounded-xl flex flex-col items-center">
          <Loader2 className="w-10 h-10 animate-spin mb-4 text-secondary" />
          <p className="text-lg font-semibold text-primary">Connecting to {serviceTitle.toLowerCase()}...</p>
        </div>
      </div>
    );
  }

  // Show disclaimer
  if (disclaimer && currentService) {
    const service = professionalServices.find(s => s.id === currentService);
    
    return (
      <div className="min-h-screen bg-primary">
        <div className="relative z-10 flex flex-col h-screen">
          <header className="glass-panel border-0 border-b silver-border">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
              <div className="flex justify-between items-center py-4">
                <motion.button
                  onClick={() => setCurrentService(null)}
                  className="glass-panel p-2 rounded-full glass-panel-hover"
                  whileHover={{ scale: 1.1 }}
                  whileTap={{ scale: 0.95 }}
                >
                  <ArrowLeft className="w-5 h-5 text-secondary" />
                </motion.button>
                <h1 className="text-lg font-semibold text-primary">
                  {service?.title || 'Professional Service'} - Disclaimer
                </h1>
                <ThemeToggle />
              </div>
            </div>
          </header>

          <main className="flex-1 flex items-center justify-center p-8">
            <GlassCard className="max-w-2xl w-full p-8" goldBorder>
              <div className="flex items-center space-x-4 mb-6">
                <div className={`w-12 h-12 rounded-full bg-gradient-to-r ${service?.color || 'from-blue-500 to-purple-500'} flex items-center justify-center`}>
                  <AlertCircle className="w-6 h-6 text-white" />
                </div>
                <h2 className="text-2xl font-bold gradient-gold-silver">Important Disclaimer</h2>
              </div>
              
              <div className="space-y-4 mb-8">
                <p className="text-primary">
                  The {service?.title} service is provided by an AI system and is for informational purposes only. 
                  {currentService === 'mental-health' ? (
                    <span> It is not a substitute for professional medical advice, diagnosis, or treatment. Always seek the advice of your physician or other qualified health provider with any questions you may have regarding a medical condition.</span>
                  ) : (
                    <span> It is not a substitute for professional legal advice. The information provided does not create an attorney-client relationship, and you should not rely on it as legal advice for any specific situation.</span>
                  )}
                </p>
                
                <div className="glass-panel p-4 rounded-lg bg-yellow-500/10 border-yellow-500/30">
                  <div className="flex items-center space-x-2 mb-2">
                    <AlertCircle className="w-5 h-5 text-yellow-500" />
                    <h3 className="font-medium text-yellow-500">Important Notice</h3>
                  </div>
                  <p className="text-secondary text-sm">
                    {currentService === 'mental-health' ? (
                      <>
                        In case of emergency, please call your local emergency services immediately. 
                        This service cannot provide crisis intervention or emergency services.
                      </>
                    ) : (
                      <>
                        The legal information provided is general in nature and may not apply to your specific situation.
                        For specific legal advice, please consult with a licensed attorney in your jurisdiction.
                      </>
                    )}
                  </p>
                </div>
                
                <p className="text-secondary">
                  By continuing, you acknowledge that you understand and agree to these terms.
                </p>
              </div>
              
              <div className="flex space-x-4">
                <Button
                  onClick={() => setCurrentService(null)}
                  variant="secondary"
                  className="flex-1"
                >
                  Go Back
                </Button>
                <Button
                  onClick={handleAcceptDisclaimer}
                  variant="premium"
                  className="flex-1"
                >
                  I Understand, Continue
                </Button>
              </div>
            </GlassCard>
          </main>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-primary">
      <div className="relative z-10 flex flex-col h-screen">
        <header className="glass-panel border-0 border-b silver-border">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex justify-between items-center py-4">
              <motion.button
                onClick={handleBack}
                className="glass-panel p-2 rounded-full glass-panel-hover"
                whileHover={{ scale: 1.1 }}
                whileTap={{ scale: 0.95 }}
              >
                <ArrowLeft className="w-5 h-5 text-secondary" />
              </motion.button>
              <h1 className="text-lg font-semibold text-primary">
                Professional Services
              </h1>
              <ThemeToggle />
            </div>
          </div>
        </header>

        <main className="flex-1 flex items-center justify-center p-8">
          <div className="max-w-6xl mx-auto w-full">
            <div className="text-center mb-12">
              <motion.h2
                initial={{ y: 50, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                className="text-3xl font-bold gradient-gold-silver mb-4"
              >
                Professional Consultations
              </motion.h2>
              <p className="text-lg text-secondary">
                Connect with AI-powered professionals for guidance and support
              </p>
            </div>

            {error && (
              <div className="mb-8 p-4 glass-panel rounded-lg border border-red-500/30 bg-red-500/10">
                <p className="text-red-400 text-center">{error}</p>
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-4xl mx-auto">
              {professionalServices.map((service, index) => (
                <motion.button
                  key={service.id}
                  onClick={() => handleSelectService(service)}
                  disabled={isLoading}
                  initial={{ y: 50, opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  transition={{ delay: 0.3 + index * 0.2 }}
                  className="glass-panel rounded-2xl p-8 glass-panel-hover text-left group disabled:opacity-50 disabled:cursor-not-allowed"
                  whileHover={{ y: -10, scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                >
                  <div className={`w-14 h-14 rounded-full bg-gradient-to-r ${service.color} flex items-center justify-center mb-6 group-hover:animate-pulse`}>
                    <service.icon className="w-7 h-7 text-white" />
                  </div>
                  <h3 className="text-xl font-bold text-primary mb-4">
                    {service.title}
                  </h3>
                  <p className="text-secondary mb-4 text-sm">
                    {service.description}
                  </p>
                  <div className="flex items-center gold-text font-semibold text-sm">
                    <span>Start Consultation</span>
                    <motion.svg
                      className="w-4 h-4 ml-2"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                      whileHover={{ x: 5 }}
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </motion.svg>
                  </div>
                </motion.button>
              ))}
            </div>

            <div className="mt-16 max-w-4xl mx-auto">
              <GlassCard className="p-6 bg-blue-500/10 border-blue-500/30">
                <div className="flex items-start space-x-4">
                  <Shield className="w-8 h-8 text-blue-400 flex-shrink-0" />
                  <div>
                    <h3 className="text-lg font-bold text-blue-400 mb-2">Privacy & Confidentiality</h3>
                    <p className="text-secondary mb-4">
                      All consultations are private and confidential. Your information is encrypted and securely stored.
                      These services are provided by AI for informational purposes only and should not replace professional human advice.
                    </p>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                      <div className="flex items-center space-x-2">
                        <Heart className="w-4 h-4 text-blue-400" />
                        <span className="text-primary">Emotional Support</span>
                      </div>
                      <div className="flex items-center space-x-2">
                        <Brain className="w-4 h-4 text-blue-400" />
                        <span className="text-primary">Mental Wellness</span>
                      </div>
                      <div className="flex items-center space-x-2">
                        <Briefcase className="w-4 h-4 text-blue-400" />
                        <span className="text-primary">Business Guidance</span>
                      </div>
                      <div className="flex items-center space-x-2">
                        <FileText className="w-4 h-4 text-blue-400" />
                        <span className="text-primary">Legal Information</span>
                      </div>
                    </div>
                  </div>
                </div>
              </GlassCard>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
};

export default ProfessionalServicesPage;