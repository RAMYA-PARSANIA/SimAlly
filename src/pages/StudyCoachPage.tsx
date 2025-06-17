import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { ArrowLeft, BookOpen, Map, Globe, Play } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import ThemeToggle from '../components/ThemeToggle';

const StudyCoachPage: React.FC = () => {
  const navigate = useNavigate();
  const [isFirstTime, setIsFirstTime] = useState(true);
  const [topic, setTopic] = useState('');
  const [level, setLevel] = useState('');

  const features = [
    {
      icon: Map,
      title: 'Learning Mindmaps',
      description: 'Visual learning paths tailored to your topic',
    },
    {
      icon: Globe,
      title: 'Curated Resources',
      description: 'Best resources from across the web',
    },
    {
      icon: Play,
      title: 'Interactive Teaching',
      description: 'Personalized lessons with your AI coach',
    },
  ];

  const handleBack = () => {
    navigate('/dashboard');
  };

  const handleStartCoaching = () => {
    setIsFirstTime(false);
  };

  const handleGenerateRoadmap = () => {
    if (topic && level) {
      // Generate roadmap logic here
      console.log(`Generating roadmap for ${topic} at ${level} level`);
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
                  Your Study Coach
                </h1>
                <p className="text-lg text-secondary mb-8">
                  Personalized learning with AI-powered teaching, mindmaps, and curated resources.
                </p>
              </motion.div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12">
                {features.map((feature, index) => (
                  <motion.div
                    key={index}
                    initial={{ y: 50, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    transition={{ delay: 0.2 + index * 0.1 }}
                    className="glass-card rounded-2xl p-6 glass-card-hover"
                  >
                    <feature.icon className="w-10 h-10 text-blue-500 dark:text-blue-400 mx-auto mb-4" />
                    <h3 className="text-lg font-semibold text-primary mb-2">
                      {feature.title}
                    </h3>
                    <p className="text-secondary text-sm">
                      {feature.description}
                    </p>
                  </motion.div>
                ))}
              </div>

              <motion.button
                onClick={handleStartCoaching}
                className="bg-gradient-to-r from-blue-500 via-cyan-500 to-blue-700 text-white px-8 py-4 rounded-full text-lg font-semibold glass-card-hover"
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                initial={{ y: 50, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ delay: 0.6 }}
              >
                Start Learning
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
                Study Coach
              </h1>
              <ThemeToggle />
            </div>
          </div>
        </header>

        <main className="flex-1 flex">
          {/* Coach Avatar (1/4 width) */}
          <div className="w-1/4 p-6 flex flex-col items-center justify-center glass-card border-r border-white/20">
            <motion.div
              className="w-28 h-28 rounded-full bg-gradient-to-br from-blue-500 via-cyan-500 to-blue-700 flex items-center justify-center mb-4"
              animate={{ y: [0, -10, 0] }}
              transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
            >
              <img
                src="https://images.pexels.com/photos/1182825/pexels-photo-1182825.jpeg?auto=compress&cs=tinysrgb&w=200"
                alt="Study Coach"
                className="w-24 h-24 rounded-full object-cover"
              />
            </motion.div>
            <h3 className="text-base font-semibold text-primary text-center">
              Your Study Coach
            </h3>
          </div>

          {/* Learning Interface (3/4 width) */}
          <div className="flex-1 p-8">
            <div className="max-w-3xl mx-auto">
              <motion.div
                initial={{ y: 50, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                className="glass-card rounded-2xl p-8 glass-card-hover mb-8"
              >
                <h2 className="text-2xl font-bold gradient-text mb-6">
                  What would you like to learn today?
                </h2>
                
                <div className="space-y-4">
                  <div>
                    <label className="block text-primary mb-2 font-medium text-sm">
                      Topic
                    </label>
                    <input
                      type="text"
                      value={topic}
                      onChange={(e) => setTopic(e.target.value)}
                      placeholder="e.g., Machine Learning, React, Python..."
                      className="w-full glass-card rounded-lg px-4 py-3 text-primary placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                    />
                  </div>
                  
                  <div>
                    <label className="block text-primary mb-2 font-medium text-sm">
                      Level
                    </label>
                    <select
                      value={level}
                      onChange={(e) => setLevel(e.target.value)}
                      className="w-full glass-card rounded-lg px-4 py-3 text-primary focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                    >
                      <option value="">Select your level</option>
                      <option value="beginner">Beginner</option>
                      <option value="intermediate">Intermediate</option>
                      <option value="advanced">Advanced</option>
                    </select>
                  </div>
                  
                  <motion.button
                    onClick={handleGenerateRoadmap}
                    disabled={!topic || !level}
                    className="w-full bg-gradient-to-r from-blue-500 via-cyan-500 to-blue-700 text-white py-3 rounded-lg font-semibold glass-card-hover disabled:opacity-50 disabled:cursor-not-allowed text-sm"
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                  >
                    Generate Learning Roadmap
                  </motion.button>
                </div>
              </motion.div>

              {/* Placeholder for D3.js mindmap */}
              <motion.div
                initial={{ y: 50, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ delay: 0.3 }}
                className="glass-card rounded-2xl p-8 glass-card-hover h-64 flex items-center justify-center"
              >
                <div className="text-center">
                  <BookOpen className="w-14 h-14 text-slate-400 mx-auto mb-4" />
                  <p className="text-secondary text-sm">
                    Your interactive learning mindmap will appear here
                  </p>
                </div>
              </motion.div>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
};

export default StudyCoachPage;