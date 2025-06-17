import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { ArrowLeft, Heart, Smile, Moon } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import ThemeToggle from '../components/ThemeToggle';

const WellnessPage: React.FC = () => {
  const navigate = useNavigate();
  const [isFirstTime, setIsFirstTime] = useState(true);

  const benefits = [
    {
      icon: Heart,
      title: 'Emotional Support',
      description: 'Get personalized emotional guidance and support',
    },
    {
      icon: Smile,
      title: 'Mood Tracking',
      description: 'Monitor and improve your daily mood patterns',
    },
    {
      icon: Moon,
      title: 'Mindfulness',
      description: 'Practice meditation and mindfulness exercises',
    },
  ];

  const handleBack = () => {
    navigate('/dashboard');
  };

  const handleStartWellness = () => {
    setIsFirstTime(false);
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
                  Your Wellness Buddy
                </h1>
                <p className="text-lg text-secondary mb-8">
                  A caring companion dedicated to your mental health and emotional wellbeing.
                </p>
              </motion.div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12">
                {benefits.map((benefit, index) => (
                  <motion.div
                    key={index}
                    initial={{ y: 50, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    transition={{ delay: 0.2 + index * 0.1 }}
                    className="glass-card rounded-2xl p-6 glass-card-hover"
                  >
                    <benefit.icon className="w-10 h-10 text-purple-500 dark:text-purple-400 mx-auto mb-4" />
                    <h3 className="text-lg font-semibold text-primary mb-2">
                      {benefit.title}
                    </h3>
                    <p className="text-secondary text-sm">
                      {benefit.description}
                    </p>
                  </motion.div>
                ))}
              </div>

              <motion.button
                onClick={handleStartWellness}
                className="bg-gradient-to-r from-purple-700 via-purple-500 to-blue-500 text-white px-8 py-4 rounded-full text-lg font-semibold glass-card-hover"
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                initial={{ y: 50, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ delay: 0.6 }}
              >
                Begin Wellness Journey
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
                Wellness Buddy
              </h1>
              <ThemeToggle />
            </div>
          </div>
        </header>

        <main className="flex-1 flex items-center justify-center p-8">
          <div className="max-w-4xl mx-auto text-center">
            {/* Serene Background with Avatar */}
            <div className="relative mb-8">
              <motion.div
                className="w-56 h-56 mx-auto rounded-full bg-gradient-to-br from-purple-500/20 via-purple-400/20 to-blue-500/20 flex items-center justify-center glass-card"
                animate={{ 
                  y: [0, -10, 0],
                  scale: [1, 1.02, 1]
                }}
                transition={{ 
                  duration: 4, 
                  repeat: Infinity, 
                  ease: "easeInOut" 
                }}
              >
                <img
                  src="https://images.pexels.com/photos/1040880/pexels-photo-1040880.jpeg?auto=compress&cs=tinysrgb&w=200"
                  alt="Wellness Buddy"
                  className="w-40 h-40 rounded-full object-cover"
                />
              </motion.div>
            </div>

            <motion.div
              initial={{ y: 50, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.3 }}
              className="glass-card rounded-2xl p-8 glass-card-hover"
            >
              <h2 className="text-2xl font-bold gradient-text mb-4">
                Hello, I'm here for you 🌟
              </h2>
              <p className="text-lg text-secondary mb-6">
                How are you feeling today? I'm here to listen, support, and guide you towards better mental wellness.
              </p>
              
              <div className="flex justify-center space-x-4">
                {['😊', '😔', '😰', '😴', '🤔'].map((emoji, index) => (
                  <motion.button
                    key={index}
                    className="text-3xl p-3 glass-card rounded-full glass-card-hover"
                    whileHover={{ scale: 1.2 }}
                    whileTap={{ scale: 0.9 }}
                  >
                    {emoji}
                  </motion.button>
                ))}
              </div>
              
              <p className="text-secondary mt-4 text-sm">
                Click on how you're feeling to start our conversation
              </p>
            </motion.div>
          </div>
        </main>
      </div>
    </div>
  );
};

export default WellnessPage;