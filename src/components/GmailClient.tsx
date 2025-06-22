import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { 
  Mail, 
  Inbox, 
  Send, 
  Archive, 
  Trash2, 
  RefreshCw, 
  Plus, 
  Settings,
  User,
  LogOut,
  AlertCircle
} from 'lucide-react';
import { GmailService } from '../services/gmail';
import EmailList from './EmailList';
import LoginScreen from './LoginScreen';
import GlassCard from './ui/GlassCard';
import Button from './ui/Button';

const GmailClient: React.FC = () => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [currentView, setCurrentView] = useState('inbox');
  const [profile, setProfile] = useState<any>(null);
  const [showCompose, setShowCompose] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const gmailService = GmailService.getInstance();

  useEffect(() => {
    initializeGmail();
  }, []);

  const initializeGmail = async () => {
    try {
      setIsLoading(true);
      setError(null);
      
      await gmailService.initialize();
      const authenticated = gmailService.isAuthenticated();
      setIsAuthenticated(authenticated);
      
      if (authenticated) {
        const userProfile = await gmailService.getProfile();
        setProfile(userProfile);
      }
    } catch (err: any) {
      console.error('Gmail initialization error:', err);
      setError(err.message || 'Failed to initialize Gmail');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSignIn = async () => {
    try {
      setError(null);
      await gmailService.signIn();
      setIsAuthenticated(true);
      
      const userProfile = await gmailService.getProfile();
      setProfile(userProfile);
    } catch (err: any) {
      console.error('Sign in error:', err);
      setError(err.message || 'Failed to sign in');
      throw err;
    }
  };

  const handleSignOut = async () => {
    try {
      await gmailService.signOut();
      setIsAuthenticated(false);
      setProfile(null);
      setCurrentView('inbox');
    } catch (err: any) {
      console.error('Sign out error:', err);
      setError(err.message || 'Failed to sign out');
    }
  };

  const sidebarItems = [
    { id: 'inbox', label: 'Inbox', icon: Inbox, count: profile?.messagesTotal },
    { id: 'sent', label: 'Sent', icon: Send },
    { id: 'archived', label: 'Archived', icon: Archive },
    { id: 'trash', label: 'Trash', icon: Trash2 },
  ];

  if (isLoading) {
    return (
      <div className="min-h-screen bg-primary flex items-center justify-center">
        <div className="glass-panel rounded-2xl p-8 max-w-md mx-auto text-center">
          <div className="animate-spin w-8 h-8 border-2 border-gold-text border-t-transparent rounded-full mx-auto mb-4"></div>
          <h3 className="text-xl font-bold text-primary mb-2">Initializing Gmail...</h3>
          <p className="text-secondary">Setting up your email client</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <LoginScreen onSignIn={handleSignIn} />;
  }

  return (
    <div className="min-h-screen bg-primary flex">
      {/* Sidebar */}
      <div className="w-64 glass-panel border-r silver-border flex flex-col">
        {/* Header */}
        <div className="p-4 border-b silver-border">
          <div className="flex items-center space-x-3 mb-4">
            <div className="w-10 h-10 rounded-full bg-gradient-gold-silver flex items-center justify-center">
              <Mail className="w-5 h-5 text-white" />
            </div>
            <div className="flex-1 min-w-0">
              <h2 className="font-bold text-primary truncate">Gmail</h2>
              <p className="text-xs text-secondary truncate">
                {profile?.emailAddress}
              </p>
            </div>
          </div>
          
          <Button
            onClick={() => setShowCompose(true)}
            variant="premium"
            className="w-full flex items-center justify-center space-x-2"
          >
            <Plus className="w-4 h-4" />
            <span>Compose</span>
          </Button>
        </div>

        {/* Navigation */}
        <div className="flex-1 p-4">
          <nav className="space-y-2">
            {sidebarItems.map((item) => (
              <motion.button
                key={item.id}
                onClick={() => setCurrentView(item.id)}
                className={`w-full flex items-center space-x-3 p-3 rounded-lg text-left transition-all ${
                  currentView === item.id
                    ? 'bg-gradient-gold-silver text-white'
                    : 'text-secondary hover:text-primary hover:bg-surface'
                }`}
                whileHover={{ x: 4 }}
                whileTap={{ scale: 0.98 }}
              >
                <item.icon className="w-5 h-5" />
                <span className="flex-1">{item.label}</span>
                {item.count && (
                  <span className="text-xs bg-surface px-2 py-1 rounded-full">
                    {item.count > 999 ? '999+' : item.count}
                  </span>
                )}
              </motion.button>
            ))}
          </nav>
        </div>

        {/* Footer */}
        <div className="p-4 border-t silver-border">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <User className="w-4 h-4 text-secondary" />
              <span className="text-xs text-secondary truncate max-w-[120px]">
                {profile?.emailAddress?.split('@')[0]}
              </span>
            </div>
            <div className="flex items-center space-x-2">
              <button className="p-1 text-secondary hover:text-primary">
                <Settings className="w-4 h-4" />
              </button>
              <button
                onClick={handleSignOut}
                className="p-1 text-secondary hover:text-primary"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col">
        {error && (
          <div className="p-4 bg-red-500/10 border-b border-red-500/30">
            <div className="flex items-center space-x-2">
              <AlertCircle className="w-4 h-4 text-red-400" />
              <span className="text-red-400 text-sm">{error}</span>
              <button
                onClick={() => setError(null)}
                className="ml-auto text-red-400 hover:text-red-300"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        <EmailList currentView={currentView} />
      </div>

      {/* Compose Modal */}
      {showCompose && (
        <ComposeModal
          onClose={() => setShowCompose(false)}
          onSend={async (to, subject, body) => {
            await gmailService.sendEmail(to, subject, body);
            setShowCompose(false);
          }}
        />
      )}
    </div>
  );
};

// Compose Modal Component
interface ComposeModalProps {
  onClose: () => void;
  onSend: (to: string, subject: string, body: string) => Promise<void>;
}

const ComposeModal: React.FC<ComposeModalProps> = ({ onClose, onSend }) => {
  const [to, setTo] = useState('');
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [sending, setSending] = useState(false);

  const handleSend = async () => {
    if (!to.trim() || !subject.trim()) return;

    try {
      setSending(true);
      await onSend(to, subject, body);
    } catch (error) {
      console.error('Send error:', error);
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <motion.div
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        className="w-full max-w-2xl"
      >
        <GlassCard className="p-6" goldBorder>
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-xl font-bold gradient-gold-silver">Compose Email</h2>
            <button
              onClick={onClose}
              className="text-secondary hover:text-primary"
            >
              <X className="w-6 h-6" />
            </button>
          </div>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-primary mb-2">To</label>
              <input
                type="email"
                value={to}
                onChange={(e) => setTo(e.target.value)}
                placeholder="recipient@example.com"
                className="w-full glass-panel rounded-lg px-4 py-3 text-primary placeholder-secondary focus:outline-none focus:ring-2 focus:ring-yellow-500"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-primary mb-2">Subject</label>
              <input
                type="text"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                placeholder="Email subject"
                className="w-full glass-panel rounded-lg px-4 py-3 text-primary placeholder-secondary focus:outline-none focus:ring-2 focus:ring-yellow-500"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-primary mb-2">Message</label>
              <textarea
                value={body}
                onChange={(e) => setBody(e.target.value)}
                placeholder="Write your message..."
                className="w-full glass-panel rounded-lg px-4 py-3 text-primary placeholder-secondary focus:outline-none focus:ring-2 focus:ring-yellow-500 resize-none"
                rows={8}
              />
            </div>
          </div>

          <div className="flex space-x-4 mt-6">
            <Button
              onClick={onClose}
              variant="secondary"
              className="flex-1"
              disabled={sending}
            >
              Cancel
            </Button>
            <Button
              onClick={handleSend}
              variant="premium"
              className="flex-1"
              disabled={!to.trim() || !subject.trim() || sending}
            >
              {sending ? (
                <div className="flex items-center space-x-2">
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span>Sending...</span>
                </div>
              ) : (
                <div className="flex items-center space-x-2">
                  <Send className="w-4 h-4" />
                  <span>Send</span>
                </div>
              )}
            </Button>
          </div>
        </GlassCard>
      </motion.div>
    </div>
  );
};

export default GmailClient;