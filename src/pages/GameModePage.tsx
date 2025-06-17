import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { ArrowLeft, HelpCircle, MessageSquare, Loader2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import ThemeToggle from '../components/ThemeToggle';
import TavusVideoCall from '../components/TavusVideoCall';

const GameModePage: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [isLoading, setIsLoading] = useState(false);
  const [conversationUrl, setConversationUrl] = useState<string | null>(null);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const games = [
    {
      id: 'riddle',
      icon: HelpCircle,
      title: 'RiddleMeThis',
      description: 'Solve creative and tricky riddles with your avatar companion',
      color: 'from-cyan-500 via-blue-500 to-purple-500',
    },
    {
      id: 'twenty-questions',
      icon: MessageSquare,
      title: '20 Questions',
      description: 'Play the classic guessing game in both directions',
      color: 'from-purple-500 via-blue-500 to-cyan-500',
    },
  ];

  const handleBack = () => {
    // End conversation if active before going back
    if (conversationId && userId) {
      endConversation();
    }
    navigate('/dashboard');
  };

  const createRiddleConversation = async () => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch('http://localhost:8000/api/create-riddle-conversation', {
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
      await fetch('http://localhost:8000/api/end-conversation', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({
          user_id: userId
        })
      });

      setConversationUrl(null);
      setConversationId(null);
      setUserId(null);
    } catch (err) {
      console.error('Error ending conversation:', err);
    }
  };

  const handleSelectGame = (gameId: string) => {
    if (gameId === 'riddle') {
      createRiddleConversation();
    } else {
      // Handle other games
      console.log(`Selected game: ${gameId}`);
    }
  };

  const handleLeaveCall = () => {
    endConversation();
  };

  // Cleanup conversation on component unmount
  useEffect(() => {
    return () => {
      if (conversationId && userId) {
        endConversation();
      }
    };
  }, [conversationId, userId]);

  // If conversation is active, show the Daily.js video call
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
                    RiddleMeThis - Game Mode
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
            />
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
                Game Mode
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
                Ready to Play? 🎮
              </motion.h2>
              <p className="text-lg text-secondary">
                Choose a game and let's have some fun together!
              </p>
            </div>

            {error && (
              <div className="mb-8 p-4 glass-panel rounded-lg border border-red-500/30 bg-red-500/10">
                <p className="text-red-400 text-center">{error}</p>
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-4xl mx-auto">
              {games.map((game, index) => (
                <motion.button
                  key={game.id}
                  onClick={() => handleSelectGame(game.id)}
                  disabled={isLoading}
                  initial={{ y: 50, opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  transition={{ delay: 0.3 + index * 0.2 }}
                  className="glass-panel rounded-2xl p-8 glass-panel-hover text-left group disabled:opacity-50 disabled:cursor-not-allowed"
                  whileHover={{ y: -10, scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                >
                  <div className={`w-14 h-14 rounded-full bg-gradient-to-r ${game.color} flex items-center justify-center mb-6 group-hover:animate-pulse`}>
                    {isLoading && game.id === 'riddle' ? (
                      <Loader2 className="w-7 h-7 text-white animate-spin" />
                    ) : (
                      <game.icon className="w-7 h-7 text-white" />
                    )}
                  </div>
                  <h3 className="text-xl font-bold text-primary mb-4">
                    {game.title}
                  </h3>
                  <p className="text-secondary mb-4 text-sm">
                    {game.description}
                  </p>
                  <div className="flex items-center gold-text font-semibold text-sm">
                    <span>
                      {isLoading && game.id === 'riddle' ? 'Starting Game...' : 'Start Playing'}
                    </span>
                    {!isLoading && (
                      <motion.svg
                        className="w-4 h-4 ml-2"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                        whileHover={{ x: 5 }}
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                      </motion.svg>
                    )}
                  </div>
                </motion.button>
              ))}
            </div>
          </div>
        </main>
      </div>
    </div>
  );
};

export default GameModePage;