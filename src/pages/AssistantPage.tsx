import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowLeft, Mic, MicOff, Send, Mail, Video, MessageSquare, Loader2, User, Bot, Settings, Trash2, Users, Calendar, Plus, Copy, ExternalLink } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import ThemeToggle from '../components/ThemeToggle';
import GlassCard from '../components/ui/GlassCard';
import Button from '../components/ui/Button';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  intent?: string;
  action?: any;
}

interface IntentResult {
  intent: string;
  confidence: number;
  parameters: any;
  response: string;
}

interface Meeting {
  id: string;
  title: string;
  host: string;
  participants: number;
  createdAt: string;
  aiEnabled: boolean;
}

const AssistantPage: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [isListening, setIsListening] = useState(false);
  const [message, setMessage] = useState('');
  const [messages, setMessages] = useState<Message[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isGmailConnected, setIsGmailConnected] = useState(false);
  const [activeMeetings, setActiveMeetings] = useState<Meeting[]>([]);
  const [isCreatingMeeting, setIsCreatingMeeting] = useState(false);
  const [backendStatus, setBackendStatus] = useState<'checking' | 'online' | 'offline'>('checking');
  const [signalingStatus, setSignalingStatus] = useState<'checking' | 'online' | 'offline'>('checking');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const recognition = useRef<any>(null);

  // Initialize speech recognition
  useEffect(() => {
    if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
      const SpeechRecognition = (window as any).webkitSpeechRecognition || (window as any).SpeechRecognition;
      recognition.current = new SpeechRecognition();
      recognition.current.continuous = false;
      recognition.current.interimResults = false;
      recognition.current.lang = 'en-US';

      recognition.current.onresult = (event: any) => {
        const transcript = event.results[0][0].transcript;
        setMessage(transcript);
        setIsListening(false);
      };

      recognition.current.onerror = () => {
        setIsListening(false);
      };

      recognition.current.onend = () => {
        setIsListening(false);
      };
    }
  }, []);

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Check backend status and load data on mount
  useEffect(() => {
    checkBackendStatus();
    checkSignalingStatus();
  }, []);

  const checkBackendStatus = async () => {
    try {
      const response = await fetch('http://localhost:8001/api/health', {
        credentials: 'include',
        signal: AbortSignal.timeout(5000) // 5 second timeout
      });
      
      if (response.ok) {
        setBackendStatus('online');
        loadChatHistory();
        loadActiveMeetings();
      } else {
        setBackendStatus('offline');
      }
    } catch (error) {
      console.log('AI Backend not available');
      setBackendStatus('offline');
    }
  };

  const checkSignalingStatus = async () => {
    try {
      const response = await fetch('http://localhost:5001/health', {
        signal: AbortSignal.timeout(5000) // 5 second timeout
      });
      
      if (response.ok) {
        setSignalingStatus('online');
      } else {
        setSignalingStatus('offline');
      }
    } catch (error) {
      console.log('Signaling server not available');
      setSignalingStatus('offline');
    }
  };

  const loadChatHistory = async () => {
    if (backendStatus !== 'online') return;
    
    try {
      const response = await fetch(`http://localhost:8001/api/chat/history?userId=${user?.id}`, {
        credentials: 'include'
      });
      const data = await response.json();
      
      if (data.success && data.history) {
        const formattedMessages = data.history.map((msg: any, index: number) => ({
          id: `${index}`,
          role: msg.role,
          content: msg.content,
          timestamp: new Date(msg.timestamp)
        }));
        setMessages(formattedMessages);
      }
    } catch (error) {
      console.error('Failed to load chat history:', error);
    }
  };

  const loadActiveMeetings = async () => {
    if (backendStatus !== 'online') return;
    
    try {
      const response = await fetch(`http://localhost:8001/api/meetings/active?userId=${user?.id}`, {
        credentials: 'include'
      });
      const data = await response.json();
      
      if (data.success) {
        setActiveMeetings(data.meetings);
      }
    } catch (error) {
      console.error('Failed to load active meetings:', error);
    }
  };

  const handleBack = () => {
    navigate('/dashboard');
  };

  const toggleListening = () => {
    if (isListening) {
      recognition.current?.stop();
      setIsListening(false);
    } else {
      recognition.current?.start();
      setIsListening(true);
    }
  };

  const detectIntent = async (userMessage: string): Promise<IntentResult> => {
    if (backendStatus !== 'online') {
      // Handle basic meeting requests offline
      const lowerMessage = userMessage.toLowerCase();
      if (lowerMessage.includes('start') && lowerMessage.includes('meeting')) {
        return {
          intent: 'meeting_start',
          confidence: 1.0,
          parameters: { title: 'Quick Meeting' },
          response: 'I\'ll start a meeting for you right away!'
        };
      }
      
      return {
        intent: 'chat',
        confidence: 1.0,
        parameters: {},
        response: `I'm currently in offline mode. I can help you start meetings using our custom WebRTC system ${signalingStatus === 'online' ? '(signaling server is running)' : '(requires signaling server)'}, but other AI features require the backend to be running. Try saying "start a meeting" or use the Start Meeting button!`
      };
    }

    try {
      const response = await fetch('http://localhost:8001/api/chat/detect-intent', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({
          message: userMessage,
          userId: user?.id
        })
      });

      const data = await response.json();
      return data;
    } catch (error) {
      console.error('Intent detection failed:', error);
      return {
        intent: 'chat',
        confidence: 1.0,
        parameters: {},
        response: 'I apologize, but I encountered an error. Please try again or use the direct meeting controls.'
      };
    }
  };

  const executeAction = async (intent: string, parameters: any): Promise<any> => {
    if (intent === 'meeting_start') {
      // Create meeting using custom WebRTC system
      const meetingId = `simally-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`;
      navigate(`/meeting/${meetingId}`);
      return { 
        success: true, 
        meetingId, 
        platform: 'Custom WebRTC',
        signalingRequired: signalingStatus !== 'online'
      };
    }

    if (backendStatus !== 'online') {
      return { error: 'Backend services not available' };
    }

    try {
      switch (intent) {
        case 'gmail_send':
          return await sendEmail(parameters);
        case 'gmail_read':
          return await getEmails(parameters);
        case 'gmail_delete':
          return await deleteEmail(parameters);
        case 'gmail_unsubscribe':
          return await unsubscribeEmail(parameters);
        case 'gmail_compose_help':
          return await getComposeHelp(parameters);
        case 'meeting_join':
          return await joinMeeting(parameters);
        case 'meeting_transcribe':
          return await toggleTranscription(parameters);
        case 'meeting_notes':
          return await getMeetingNotes(parameters);
        case 'meeting_summary':
          return await getMeetingSummary(parameters);
        default:
          return null;
      }
    } catch (error) {
      console.error('Action execution failed:', error);
      return { error: 'Failed to execute action' };
    }
  };

  // Gmail Actions
  const sendEmail = async (params: any) => {
    const response = await fetch('http://localhost:8001/api/gmail/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({
        userId: user?.id,
        to: params.to,
        subject: params.subject,
        body: params.body
      })
    });
    return await response.json();
  };

  const getEmails = async (params: any) => {
    const response = await fetch(`http://localhost:8001/api/gmail/messages?userId=${user?.id}&maxResults=${params.count || 5}`, {
      credentials: 'include'
    });
    return await response.json();
  };

  const deleteEmail = async (params: any) => {
    const response = await fetch(`http://localhost:8001/api/gmail/messages/${params.messageId}?userId=${user?.id}`, {
      method: 'DELETE',
      credentials: 'include'
    });
    return await response.json();
  };

  const unsubscribeEmail = async (params: any) => {
    const response = await fetch('http://localhost:8001/api/gmail/unsubscribe', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({
        userId: user?.id,
        messageId: params.messageId
      })
    });
    return await response.json();
  };

  const getComposeHelp = async (params: any) => {
    const response = await fetch('http://localhost:8001/api/gmail/compose-help', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({
        prompt: params.prompt,
        context: params.context,
        tone: params.tone
      })
    });
    return await response.json();
  };

  // Meeting Actions
  const joinMeeting = async (params: any) => {
    // Join meeting using custom WebRTC
    navigate(`/meeting/${params.meetingId}`);
    return { success: true, platform: 'Custom WebRTC' };
  };

  const toggleTranscription = async (params: any) => {
    // This would be handled in the meeting room component
    return { success: true, message: 'Transcription toggled' };
  };

  const getMeetingNotes = async (params: any) => {
    const response = await fetch(`http://localhost:8001/api/meetings/${params.meetingId}/transcript`, {
      credentials: 'include'
    });
    return await response.json();
  };

  const getMeetingSummary = async (params: any) => {
    const response = await fetch(`http://localhost:8001/api/meetings/${params.meetingId}/summary`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({})
    });
    return await response.json();
  };

  const handleSendMessage = async () => {
    if (!message.trim() || isProcessing) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: message.trim(),
      timestamp: new Date()
    };

    setMessages(prev => [...prev, userMessage]);
    setMessage('');
    setIsProcessing(true);

    try {
      // Detect intent and get AI response
      const intentResult = await detectIntent(userMessage.content);
      
      // Execute action if needed
      let actionResult = null;
      if (intentResult.intent !== 'chat') {
        actionResult = await executeAction(intentResult.intent, intentResult.parameters);
      }

      // Create assistant response
      const assistantMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: intentResult.response,
        timestamp: new Date(),
        intent: intentResult.intent,
        action: actionResult
      };

      setMessages(prev => [...prev, assistantMessage]);
    } catch (error) {
      console.error('Message processing failed:', error);
      const errorMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: 'I apologize, but I encountered an error processing your request. Please try again.',
        timestamp: new Date()
      };
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsProcessing(false);
    }
  };

  const clearChat = async () => {
    if (backendStatus === 'online') {
      try {
        await fetch('http://localhost:8001/api/chat/history', {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ userId: user?.id })
        });
      } catch (error) {
        console.error('Failed to clear chat:', error);
      }
    }
    setMessages([]);
  };

  const connectGmail = async () => {
    if (backendStatus !== 'online') {
      alert('Gmail integration requires the AI Assistant backend to be running.');
      return;
    }

    try {
      const response = await fetch('http://localhost:8001/api/gmail/auth-url', {
        credentials: 'include'
      });
      const data = await response.json();
      
      if (data.authUrl) {
        window.open(data.authUrl, '_blank', 'width=500,height=600');
        // In a real app, you'd handle the OAuth callback
        setIsGmailConnected(true);
      }
    } catch (error) {
      console.error('Gmail connection failed:', error);
    }
  };

  const handleStartMeeting = async () => {
    setIsCreatingMeeting(true);
    try {
      // Create meeting using custom WebRTC system
      const meetingId = `simally-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`;
      navigate(`/meeting/${meetingId}`);
    } catch (error) {
      console.error('Failed to create meeting:', error);
    } finally {
      setIsCreatingMeeting(false);
    }
  };

  const copyMeetingLink = (meetingId: string) => {
    const link = `${window.location.origin}/meeting/${meetingId}`;
    navigator.clipboard.writeText(link);
    // You could add a toast notification here
  };

  const getIntentIcon = (intent?: string) => {
    switch (intent) {
      case 'gmail_send':
      case 'gmail_read':
      case 'gmail_delete':
      case 'gmail_unsubscribe':
      case 'gmail_compose_help':
        return <Mail className="w-4 h-4" />;
      case 'meeting_start':
      case 'meeting_join':
      case 'meeting_transcribe':
      case 'meeting_notes':
      case 'meeting_summary':
        return <Video className="w-4 h-4" />;
      default:
        return <MessageSquare className="w-4 h-4" />;
    }
  };

  const getIntentColor = (intent?: string) => {
    switch (intent) {
      case 'gmail_send':
      case 'gmail_read':
      case 'gmail_delete':
      case 'gmail_unsubscribe':
      case 'gmail_compose_help':
        return 'text-blue-500';
      case 'meeting_start':
      case 'meeting_join':
      case 'meeting_transcribe':
      case 'meeting_notes':
      case 'meeting_summary':
        return 'text-green-500';
      default:
        return 'text-purple-500';
    }
  };

  const getBackendStatusColor = () => {
    switch (backendStatus) {
      case 'online': return 'bg-green-500';
      case 'offline': return 'bg-red-500';
      case 'checking': return 'bg-yellow-500';
      default: return 'bg-gray-500';
    }
  };

  const getSignalingStatusColor = () => {
    switch (signalingStatus) {
      case 'online': return 'bg-green-500';
      case 'offline': return 'bg-red-500';
      case 'checking': return 'bg-yellow-500';
      default: return 'bg-gray-500';
    }
  };

  const getBackendStatusText = () => {
    switch (backendStatus) {
      case 'online': return 'AI Backend';
      case 'offline': return 'AI Backend Offline';
      case 'checking': return 'Checking...';
      default: return 'Unknown';
    }
  };

  const getSignalingStatusText = () => {
    switch (signalingStatus) {
      case 'online': return 'WebRTC Ready';
      case 'offline': return 'WebRTC Offline';
      case 'checking': return 'Checking...';
      default: return 'Unknown';
    }
  };

  return (
    <div className="min-h-screen bg-primary">
      {/* Header */}
      <header className="glass-panel border-0 border-b silver-border">
        <div className="max-w-7xl mx-auto container-padding">
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
                  AI Assistant
                </h1>
                <p className="text-xs text-secondary">
                  Custom WebRTC Meetings • Gmail • AI Chat
                </p>
              </div>
            </div>
            
            <div className="flex items-center space-x-3">
              {/* Quick Start Meeting Button */}
              <Button
                onClick={handleStartMeeting}
                disabled={isCreatingMeeting}
                variant="premium"
                size="sm"
                className="flex items-center space-x-2"
              >
                {isCreatingMeeting ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Plus className="w-4 h-4" />
                )}
                <span>Start Meeting</span>
              </Button>

              {/* Status Indicators */}
              <div className="flex items-center space-x-2">
                <div className={`w-2 h-2 rounded-full ${getBackendStatusColor()}`} />
                <span className="text-xs text-secondary">{getBackendStatusText()}</span>
              </div>
              <div className="flex items-center space-x-2">
                <div className={`w-2 h-2 rounded-full ${getSignalingStatusColor()}`} />
                <span className="text-xs text-secondary">{getSignalingStatusText()}</span>
              </div>
              <div className="flex items-center space-x-2">
                <div className={`w-2 h-2 rounded-full ${isGmailConnected ? 'bg-green-500' : 'bg-gray-500'}`} />
                <span className="text-xs text-secondary">Gmail</span>
              </div>
              
              <button
                onClick={clearChat}
                className="glass-panel p-2 rounded-lg glass-panel-hover"
                title="Clear Chat"
              >
                <Trash2 className="w-4 h-4 text-secondary" />
              </button>
              
              <ThemeToggle />
            </div>
          </div>
        </div>
      </header>

      {/* Status Banner */}
      {(backendStatus === 'offline' || signalingStatus === 'offline') && (
        <div className="bg-blue-500/10 border-b border-blue-500/30 px-6 py-2">
          <div className="max-w-7xl mx-auto">
            <p className="text-blue-400 text-sm text-center">
              ℹ️ {signalingStatus === 'online' 
                ? 'Using custom WebRTC for video meetings. AI features available when backend is connected.'
                : 'Start signaling server (npm run dev:webrtc) for multi-user meetings.'
              }
              <button 
                onClick={() => {
                  checkBackendStatus();
                  checkSignalingStatus();
                }}
                className="ml-2 underline hover:no-underline"
              >
                Refresh Status
              </button>
            </p>
          </div>
        </div>
      )}

      {/* Main Chat Interface */}
      <main className="flex flex-col h-[calc(100vh-80px)]">
        {/* Messages Area */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          <div className="max-w-4xl mx-auto">
            {messages.length === 0 && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="text-center py-12"
              >
                <div className="w-20 h-20 rounded-full bg-gradient-gold-silver flex items-center justify-center mx-auto mb-6">
                  <Bot className="w-10 h-10 text-white" />
                </div>
                <h2 className="text-2xl font-bold gradient-gold-silver mb-4">
                  Hello! I'm your AI Assistant
                </h2>
                <p className="text-secondary mb-8 max-w-2xl mx-auto">
                  {backendStatus === 'online' 
                    ? "I can help you with Gmail management, video meetings, and answer any questions you have. Just tell me what you need in natural language!"
                    : `I can help you start ${signalingStatus === 'online' ? 'multi-user' : 'single-user'} video meetings using our custom WebRTC system! AI features will be available when the backend is connected.`
                  }
                </p>
                
                {/* Quick Actions */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 max-w-3xl mx-auto mb-8">
                  <GlassCard className={`p-4 text-center ${backendStatus === 'offline' ? 'opacity-50' : ''}`} hover={backendStatus === 'online'}>
                    <Mail className="w-8 h-8 text-blue-500 mx-auto mb-2" />
                    <h3 className="font-semibold text-primary mb-1">Gmail</h3>
                    <p className="text-xs text-secondary">
                      {backendStatus === 'online' 
                        ? '"Send an email to John about the meeting"'
                        : 'Requires AI backend'
                      }
                    </p>
                  </GlassCard>
                  
                  <GlassCard className="p-4 text-center" hover>
                    <Video className="w-8 h-8 text-green-500 mx-auto mb-2" />
                    <h3 className="font-semibold text-primary mb-1">Meetings</h3>
                    <p className="text-xs text-secondary">
                      "Start a meeting" - Custom WebRTC
                    </p>
                  </GlassCard>
                  
                  <GlassCard className={`p-4 text-center ${backendStatus === 'offline' ? 'opacity-50' : ''}`} hover={backendStatus === 'online'}>
                    <MessageSquare className="w-8 h-8 text-purple-500 mx-auto mb-2" />
                    <h3 className="font-semibold text-primary mb-1">Chat</h3>
                    <p className="text-xs text-secondary">
                      {backendStatus === 'online' 
                        ? '"What\'s the weather like today?"'
                        : 'Requires AI backend'
                      }
                    </p>
                  </GlassCard>
                </div>

                {/* Quick Start Meeting Button */}
                <div className="mb-8">
                  <Button
                    onClick={handleStartMeeting}
                    disabled={isCreatingMeeting}
                    variant="premium"
                    size="lg"
                    className="inline-flex items-center space-x-2"
                  >
                    {isCreatingMeeting ? (
                      <Loader2 className="w-5 h-5 animate-spin" />
                    ) : (
                      <Video className="w-5 h-5" />
                    )}
                    <span>Start Custom Meeting</span>
                  </Button>
                  <p className="text-xs text-secondary mt-2">
                    {signalingStatus === 'online' 
                      ? 'Multi-user WebRTC meetings with P2P connections'
                      : 'Single-user mode (start signaling server for multi-user)'
                    }
                  </p>
                </div>

                {/* Active Meetings */}
                {activeMeetings.length > 0 && (
                  <div className="mb-8">
                    <h3 className="text-lg font-semibold text-primary mb-4">Active Meetings</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-w-2xl mx-auto">
                      {activeMeetings.map((meeting) => (
                        <GlassCard 
                          key={meeting.id} 
                          className="p-4 text-left" 
                          hover
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex items-center space-x-3">
                              <Users className="w-6 h-6 text-green-500" />
                              <div className="flex-1">
                                <h4 className="font-semibold text-primary">{meeting.title}</h4>
                                <p className="text-xs text-secondary">
                                  {meeting.participants} participants • AI {meeting.aiEnabled ? 'ON' : 'OFF'}
                                </p>
                              </div>
                            </div>
                            <div className="flex space-x-2">
                              <button
                                onClick={() => copyMeetingLink(meeting.id)}
                                className="glass-panel p-2 rounded glass-panel-hover"
                                title="Copy meeting link"
                              >
                                <Copy className="w-4 h-4 text-secondary" />
                              </button>
                              <button
                                onClick={() => navigate(`/meeting/${meeting.id}`)}
                                className="glass-panel p-2 rounded glass-panel-hover"
                                title="Join meeting"
                              >
                                <ExternalLink className="w-4 h-4 text-secondary" />
                              </button>
                            </div>
                          </div>
                        </GlassCard>
                      ))}
                    </div>
                  </div>
                )}
                
                {backendStatus === 'online' && !isGmailConnected && (
                  <div className="mt-8">
                    <Button
                      onClick={connectGmail}
                      variant="secondary"
                      className="inline-flex items-center space-x-2"
                    >
                      <Mail className="w-4 h-4" />
                      <span>Connect Gmail</span>
                    </Button>
                  </div>
                )}
              </motion.div>
            )}

            <AnimatePresence>
              {messages.map((msg) => (
                <motion.div
                  key={msg.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -20 }}
                  className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'} mb-4`}
                >
                  <div className={`flex items-start space-x-3 max-w-3xl ${msg.role === 'user' ? 'flex-row-reverse space-x-reverse' : ''}`}>
                    {/* Avatar */}
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${
                      msg.role === 'user' 
                        ? 'bg-gradient-to-r from-blue-500 to-purple-500' 
                        : 'bg-gradient-gold-silver'
                    }`}>
                      {msg.role === 'user' ? (
                        <User className="w-4 h-4 text-white" />
                      ) : (
                        <Bot className="w-4 h-4 text-white" />
                      )}
                    </div>
                    
                    {/* Message */}
                    <div className={`glass-panel rounded-2xl p-4 ${
                      msg.role === 'user' 
                        ? 'bg-gradient-to-r from-blue-500/10 to-purple-500/10 border-blue-500/30' 
                        : 'border-gold-border'
                    }`}>
                      {/* Intent indicator for assistant messages */}
                      {msg.role === 'assistant' && msg.intent && msg.intent !== 'chat' && (
                        <div className={`flex items-center space-x-2 mb-2 text-xs ${getIntentColor(msg.intent)}`}>
                          {getIntentIcon(msg.intent)}
                          <span className="font-medium capitalize">
                            {msg.intent.replace('_', ' ')}
                          </span>
                        </div>
                      )}
                      
                      <p className="text-primary whitespace-pre-wrap">{msg.content}</p>
                      
                      {/* Action results */}
                      {msg.action && msg.action.success && (
                        <div className="mt-3 p-3 glass-panel rounded-lg bg-green-500/10 border-green-500/30">
                          <p className="text-green-400 text-sm font-medium">
                            ✓ {msg.action.signalingRequired 
                              ? `Meeting created (start signaling server for multi-user support)` 
                              : `Meeting created using ${msg.action.platform || 'Custom WebRTC'}`}
                          </p>
                        </div>
                      )}
                      
                      {msg.action && msg.action.error && (
                        <div className="mt-3 p-3 glass-panel rounded-lg bg-red-500/10 border-red-500/30">
                          <p className="text-red-400 text-sm font-medium">✗ {msg.action.error}</p>
                        </div>
                      )}
                      
                      <div className="text-xs text-secondary mt-2">
                        {msg.timestamp.toLocaleTimeString()}
                      </div>
                    </div>
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>

            {isProcessing && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="flex justify-start mb-4"
              >
                <div className="flex items-start space-x-3 max-w-3xl">
                  <div className="w-8 h-8 rounded-full bg-gradient-gold-silver flex items-center justify-center flex-shrink-0">
                    <Bot className="w-4 h-4 text-white" />
                  </div>
                  <div className="glass-panel rounded-2xl p-4 border-gold-border">
                    <div className="flex items-center space-x-2">
                      <Loader2 className="w-4 h-4 animate-spin text-secondary" />
                      <span className="text-secondary">Thinking...</span>
                    </div>
                  </div>
                </div>
              </motion.div>
            )}

            <div ref={messagesEndRef} />
          </div>
        </div>

        {/* Input Area */}
        <div className="glass-panel border-t silver-border p-6">
          <div className="max-w-4xl mx-auto">
            <div className="flex items-end space-x-4">
              <div className="flex-1">
                <textarea
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  placeholder={backendStatus === 'online' 
                    ? "Tell me what you need... (e.g., 'Send an email to John', 'Start a meeting with my team', 'What's the weather?')"
                    : "Try: 'Start a meeting' or use the Start Meeting button above for custom WebRTC calls!"
                  }
                  className="w-full glass-panel rounded-xl px-4 py-3 text-primary placeholder-secondary focus:outline-none focus:ring-2 focus:ring-yellow-500 resize-none min-h-[50px] max-h-32"
                  onKeyPress={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      handleSendMessage();
                    }
                  }}
                  disabled={isProcessing}
                />
              </div>
              
              <div className="flex items-center space-x-2">
                <motion.button
                  onClick={toggleListening}
                  className={`glass-panel p-3 rounded-xl glass-panel-hover ${
                    isListening ? 'bg-red-500/20 border-red-500/50' : ''
                  } ${backendStatus === 'offline' ? 'opacity-50' : ''}`}
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  disabled={isProcessing || backendStatus === 'offline'}
                  title={backendStatus === 'offline' ? 'Voice input requires AI backend' : 'Voice input'}
                >
                  {isListening ? (
                    <MicOff className="w-5 h-5 text-red-400" />
                  ) : (
                    <Mic className="w-5 h-5 text-secondary" />
                  )}
                </motion.button>
                
                <motion.button
                  onClick={handleSendMessage}
                  className="premium-button p-3 rounded-xl"
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  disabled={!message.trim() || isProcessing}
                >
                  {isProcessing ? (
                    <Loader2 className="w-5 h-5 animate-spin" />
                  ) : (
                    <Send className="w-5 h-5" />
                  )}
                </motion.button>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
};

export default AssistantPage;