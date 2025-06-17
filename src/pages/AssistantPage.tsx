import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { ArrowLeft, Mic, MicOff, Send, Code, Mail, Search } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import ThemeToggle from '../components/ThemeToggle';

const AssistantPage: React.FC = () => {
  const navigate = useNavigate();
  const [isListening, setIsListening] = useState(false);
  const [message, setMessage] = useState('');
  const [isFirstTime, setIsFirstTime] = useState(true);

  const capabilities = [
    {
      icon: Search,
      title: 'Web Search',
      description: 'Open new tabs and search for information',
    },
    {
      icon: Code,
      title: 'Code Assistant',
      description: 'Get help with coding and problem-solving',
    },
    {
      icon: Mail,
      title: 'Email Helper',
      description: 'Compose and draft professional emails',
    },
  ];

  const handleBack = () => {
    navigate('/dashboard');
  };

  const handleStartAssistant = () => {
    setIsFirstTime(false);
  };

  const toggleListening = () => {
    setIsListening(!isListening);
  };

  const handleSendMessage = () => {
    if (message.trim()) {
      // Handle message sending logic here
      setMessage('');
    }
  };

  if (isFirstTime) {
    return (
      <div className="min-h-screen relative overflow-hidden">
        <div className="relative z-10">
          <header className="glass-card border-0 border-b border-white/20">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
              <div className="flex justify-between items-center py-4">
                <motion.button
                  onClick={handleBack}
                  className="glass-card p-2 rounded-full glass-card-hover"
                  whileHover={{ scale: 1.1 }}
                  whileTap={{ scale: 0.95 }}
                >
                  <ArrowLeft className="w-5 h-5 text-secondary" />
                </motion.button>
                <ThemeToggle />
              </div>
            </div>
          </header>

          <main className="pt-16 pb-20 px-4 sm:px-6 lg:px-8">
            <div className="max-w-4xl mx-auto text-center">
              <motion.div
                initial={{ y: 50, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                className="mb-12"
              >
                <h1 className="text-3xl md:text-4xl font-bold gradient-text mb-6">
                  Meet Your AI Assistant
                </h1>
                <p className="text-lg text-secondary mb-8">
                  Your intelligent companion is ready to help you with various tasks and boost your productivity.
                </p>
              </motion.div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12">
                {capabilities.map((capability, index) => (
                  <motion.div
                    key={index}
                    initial={{ y: 50, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    transition={{ delay: 0.2 + index * 0.1 }}
                    className="glass-card rounded-2xl p-6 glass-card-hover"
                  >
                    <capability.icon className="w-10 h-10 text-purple-500 dark:text-purple-400 mx-auto mb-4" />
                    <h3 className="text-lg font-semibold text-primary mb-2">
                      {capability.title}
                    </h3>
                    <p className="text-secondary text-sm">
                      {capability.description}
                    </p>
                  </motion.div>
                ))}
              </div>

              <motion.button
                onClick={handleStartAssistant}
                className="bg-gradient-to-r from-purple-500 via-blue-500 to-cyan-500 text-white px-8 py-4 rounded-full text-lg font-semibold glass-card-hover"
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                initial={{ y: 50, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ delay: 0.6 }}
              >
                Start Assistant
              </motion.button>
            </div>
          </main>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen relative overflow-hidden">
      <div className="relative z-10 flex flex-col h-screen">
        <header className="glass-card border-0 border-b border-white/20">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex justify-between items-center py-4">
              <motion.button
                onClick={handleBack}
                className="glass-card p-2 rounded-full glass-card-hover"
                whileHover={{ scale: 1.1 }}
                whileTap={{ scale: 0.95 }}
              >
                <ArrowLeft className="w-5 h-5 text-secondary" />
              </motion.button>
              <h1 className="text-lg font-semibold text-primary">
                AI Assistant
              </h1>
              <ThemeToggle />
            </div>
          </div>
        </header>

        <main className="flex-1 flex">
          {/* Avatar Section */}
          <div className="flex-1 flex items-center justify-center p-8">
            <motion.div
              className="glass-card rounded-full p-8 glass-card-hover"
              animate={{ y: [0, -20, 0] }}
              transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
            >
              <div className="w-40 h-40 rounded-full bg-gradient-to-br from-purple-500 via-blue-500 to-cyan-500 flex items-center justify-center">
                <img
                  src="https://images.pexels.com/photos/3992656/pexels-photo-3992656.png?auto=compress&cs=tinysrgb&w=200"
                  alt="Assistant Avatar"
                  className="w-32 h-32 rounded-full object-cover"
                />
              </div>
            </motion.div>
          </div>

          {/* Chat Section */}
          <div className="w-96 glass-card border-l border-white/20 flex flex-col">
            <div className="p-6 border-b border-white/20">
              <h2 className="text-lg font-semibold text-primary mb-2">
                Chat with Assistant
              </h2>
              <p className="text-secondary text-xs">
                Type your message or use voice commands
              </p>
            </div>

            <div className="flex-1 p-6 overflow-y-auto">
              <div className="space-y-4">
                <div className="glass-card rounded-lg p-3">
                  <p className="text-primary text-sm">
                    Hello! I'm your AI Assistant. How can I help you today?
                  </p>
                </div>
              </div>
            </div>

            <div className="p-6 border-t border-white/20">
              <div className="flex space-x-2">
                <input
                  type="text"
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  placeholder="Type your message..."
                  className="flex-1 glass-card rounded-lg px-4 py-2 text-primary placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-purple-500 text-sm"
                  onKeyPress={(e) => e.key === 'Enter' && handleSendMessage()}
                />
                <motion.button
                  onClick={toggleListening}
                  className={`glass-card p-2 rounded-lg glass-card-hover ${isListening ? 'bg-red-500' : ''}`}
                  whileHover={{ scale: 1.1 }}
                  whileTap={{ scale: 0.95 }}
                >
                  {isListening ? (
                    <MicOff className="w-4 h-4 text-white" />
                  ) : (
                    <Mic className="w-4 h-4 text-secondary" />
                  )}
                </motion.button>
                <motion.button
                  onClick={handleSendMessage}
                  className="glass-card p-2 rounded-lg glass-card-hover"
                  whileHover={{ scale: 1.1 }}
                  whileTap={{ scale: 0.95 }}
                >
                  <Send className="w-4 h-4 text-secondary" />
                </motion.button>
              </div>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
};

export default AssistantPage;