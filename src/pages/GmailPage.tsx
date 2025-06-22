import React from 'react';
import { motion } from 'framer-motion';
import { ArrowLeft } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import ThemeToggle from '../components/ThemeToggle';
import GmailClient from '../components/GmailClient';

const GmailPage: React.FC = () => {
  const navigate = useNavigate();

  const handleBack = () => {
    navigate('/assistant');
  };

  return (
    <div className="min-h-screen bg-primary">
      {/* Header */}
      <header className="glass-panel border-0 border-b silver-border">
        <div className="max-w-full px-6">
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
                  Gmail Client
                </h1>
                <p className="text-xs text-secondary">
                  Professional email management
                </p>
              </div>
            </div>
            
            <ThemeToggle />
          </div>
        </div>
      </header>

      {/* Gmail Client */}
      <main className="h-[calc(100vh-80px)]">
        <GmailClient />
      </main>
    </div>
  );
};

export default GmailPage;