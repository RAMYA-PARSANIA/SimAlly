import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowLeft, Mic, MicOff, Send, Mail, MessageSquare, Loader2, User, Bot, Settings, Trash2, CheckSquare, Calendar, Video, BarChart3, ArrowRight, ExternalLink, Zap, Target, TrendingUp, FileText, Download, Eye, Code, Copy, Check } from 'lucide-react';
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
  agent?: AgentResponse;
}

interface AgentResponse {
  intent: string;
  subIntent: string;
  confidence: number;
  requiresData: boolean;
  dataQueries?: string[];
  actions: AgentAction[];
  response: string;
  suggestions: AgentSuggestion[];
  data?: any;
  analysis?: {
    insights: Insight[];
    recommendations: Recommendation[];
    enhancedResponse: string;
  };
  documentGeneration?: {
    prompt: string;
    type: string;
    ready: boolean;
  };
  generatedDocument?: GeneratedDocument;
}

// Update GeneratedDocument interface for generic document (HTML/pdfmake)
interface GeneratedDocument {
  content: string;
  downloadUrl?: string;
  message?: string;
  format?: string;
}

interface AgentAction {
  type: 'navigation' | 'data_display' | 'external_action' | 'suggestion' | 'document_generation';
  target: string;
  parameters: any;
}

interface AgentSuggestion {
  title: string;
  description: string;
  action: string;
  parameters: any;
}

interface Insight {
  type: string;
  title: string;
  description: string;
  severity: 'low' | 'medium' | 'high';
}

interface Recommendation {
  title: string;
  description: string;
  priority: 'low' | 'medium' | 'high';
  action: string;
}

const AssistantPage: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [isListening, setIsListening] = useState(false);
  const [message, setMessage] = useState('');
  const [messages, setMessages] = useState<Message[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isGmailConnected, setIsGmailConnected] = useState(false);
  const [isGeneratingDocument, setIsGeneratingDocument] = useState(false);
  const [generatedDocuments, setGeneratedDocuments] = useState<GeneratedDocument[]>([]);
  const [showLatexCode, setShowLatexCode] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [files, setFiles] = useState<any[]>([]);
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

  // Load chat history on mount
  useEffect(() => {
    loadChatHistory();
  }, []);

  const loadChatHistory = async () => {
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

  const processWithAgent = async (userMessage: string, filesToSend: any[] = []): Promise<AgentResponse> => {
    try {
      const response = await fetch('http://localhost:8001/api/chat/agent-process', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({
          message: userMessage,
          userId: user?.id,
          context: {
            currentPage: 'assistant',
            timestamp: new Date().toISOString()
          },
          files: filesToSend
        })
      });

      const data = await response.json();
      if (data.success && data.agent) return data.agent;
      throw new Error('Agent response failed');
    } catch (error) {
      return {
        intent: 'general_assistance',
        subIntent: 'error',
        confidence: 0.5,
        requiresData: false,
        actions: [],
        response: 'I apologize, but I encountered an error processing your request. Please try again.',
        suggestions: []
      };
    }
  };

  const generateDocument = async (prompt: string, documentType: string = 'general', format: string = 'html', download: boolean = false) => {
    setIsGeneratingDocument(true);

    try {
      const response = await fetch('http://localhost:8001/api/documents/generate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({
          prompt,
          documentType,
          format,
          download
        })
      });

      const data = await response.json();

      if (data.success) {
        setGeneratedDocuments(prev => [data.document, ...prev]);
        return data.document;
      } else {
        throw new Error(data.error || 'Failed to generate document');
      }
    } catch (error) {
      console.error('Document generation failed:', error);
      throw error;
    } finally {
      setIsGeneratingDocument(false);
    }
  };

  const handleSendMessage = async () => {
    if (!message.trim() && files.length === 0 || isProcessing) return;

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
      // Process with enhanced agent
      const agentResponse = await processWithAgent(userMessage.content, files);
      setFiles([]); // Clear files after sending
      
      // Handle document generation if requested
      if (agentResponse.documentGeneration?.ready) {
        try {
          const document = await generateDocument(
            agentResponse.documentGeneration.prompt,
            agentResponse.documentGeneration.type
          );
          
          agentResponse.generatedDocument = document;
          agentResponse.response += `\n\n✅ Document generated successfully! You can preview the document and download the PDF below.`;
        } catch (docError: any) {
          agentResponse.response += `\n\n❌ Failed to generate document: ${docError?.message || docError}`;
        }
      }
      
      // Create assistant response
      const assistantMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: agentResponse.analysis?.enhancedResponse || agentResponse.response,
        timestamp: new Date(),
        agent: agentResponse
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

  const handleSuggestionClick = (suggestion: AgentSuggestion) => {
    switch (suggestion.action) {
      case 'navigate':
        if (suggestion.parameters.target === 'meeting') {
          navigate('/meetings');
        } else if (suggestion.parameters.target === 'tasks') {
          navigate('/workspace');
        } else if (suggestion.parameters.target === 'calendar') {
          navigate('/workspace');
        }
        break;
      case 'message':
        setMessage(suggestion.parameters.message || suggestion.title);
        break;
      case 'document':
        setMessage(`Create a ${suggestion.parameters.type || 'professional'} document`);
        break;
      default:
        console.log('Suggestion clicked:', suggestion);
    }
  };

  const handleDocumentGeneration = async (prompt: string, type: string) => {
    try {
      const document = await generateDocument(prompt, type);
      
      // Add a message about the generated document
      const documentMessage: Message = {
        id: Date.now().toString(),
        role: 'assistant',
        content: `✅ Document generated successfully! You can preview the document and download the PDF.`,
        timestamp: new Date(),
        agent: {
          intent: 'document_generation',
          subIntent: 'generated',
          confidence: 1.0,
          requiresData: false,
          actions: [],
          response: 'Document generated successfully!',
          suggestions: [],
          generatedDocument: document
        }
      };
      
      setMessages(prev => [...prev, documentMessage]);
    } catch (error) {
      console.error('Document generation failed:', error);
    }
  };

  const copyLatexCode = async (code: string) => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      console.error('Failed to copy LaTeX code:', error);
    }
  };

  const clearChat = async () => {
    try {
      await fetch('http://localhost:8001/api/chat/history', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ userId: user?.id })
      });
      setMessages([]);
    } catch (error) {
      console.error('Failed to clear chat:', error);
    }
  };

  const connectGmail = async () => {
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

  const getIntentIcon = (intent?: string) => {
    switch (intent) {
      case 'task_management':
        return <CheckSquare className="w-4 h-4" />;
      case 'calendar_management':
        return <Calendar className="w-4 h-4" />;
      case 'meeting_control':
        return <Video className="w-4 h-4" />;
      case 'gmail_operations':
        return <Mail className="w-4 h-4" />;
      case 'productivity_analysis':
        return <BarChart3 className="w-4 h-4" />;
      case 'document_generation':
        return <FileText className="w-4 h-4" />;
      default:
        return <MessageSquare className="w-4 h-4" />;
    }
  };

  const getIntentColor = (intent?: string) => {
    switch (intent) {
      case 'task_management':
        return 'text-blue-500';
      case 'calendar_management':
        return 'text-green-500';
      case 'meeting_control':
        return 'text-purple-500';
      case 'gmail_operations':
        return 'text-red-500';
      case 'productivity_analysis':
        return 'text-yellow-500';
      case 'document_generation':
        return 'text-orange-500';
      default:
        return 'text-gray-500';
    }
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'high':
        return 'text-red-500 bg-red-500/10 border-red-500/30';
      case 'medium':
        return 'text-yellow-500 bg-yellow-500/10 border-yellow-500/30';
      case 'low':
        return 'text-green-500 bg-green-500/10 border-green-500/30';
      default:
        return 'text-gray-500 bg-gray-500/10 border-gray-500/30';
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'high':
        return 'text-red-500';
      case 'medium':
        return 'text-yellow-500';
      case 'low':
        return 'text-green-500';
      default:
        return 'text-gray-500';
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const fileList = e.target.files;
    if (!fileList) return;
    const newFiles: any[] = [];
    let loaded = 0;
    Array.from(fileList).forEach((file) => {
      if (file.type.startsWith('image/')) {
        const reader = new FileReader();
        reader.onload = (event) => {
          newFiles.push({ type: 'image', data: event.target?.result });
          loaded++;
          if (loaded === fileList.length) {
            setFiles((prev) => [...prev, ...newFiles]);
          }
        };
        reader.readAsDataURL(file);
      }
    });
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
                  AI Agent Assistant
                </h1>
                <p className="text-xs text-secondary">
                  Advanced Intelligence • Document Generation • Data Analysis • Smart Actions
                </p>
              </div>
            </div>
            
            <div className="flex items-center space-x-3">
              {/* Status Indicators */}
              <div className="flex items-center space-x-4">
                <div className="flex items-center space-x-2">
                  <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                  <span className="text-xs text-secondary">Agent Active</span>
                </div>
                <div className="flex items-center space-x-2">
                  <div className={`w-2 h-2 rounded-full ${isGmailConnected ? 'bg-green-500' : 'bg-gray-500'}`} />
                  <span className="text-xs text-secondary">Gmail</span>
                </div>
                <div className="flex items-center space-x-2">
                  <div className="w-2 h-2 rounded-full bg-green-500" />
                  <span className="text-xs text-secondary">Document Generation</span>
                </div>
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

      {/* Main Chat Interface */}
      <main className="flex flex-col h-[calc(100vh-80px)]">
        {/* Messages Area */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          <div className="max-w-6xl mx-auto">
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
                  Hello! I'm your Advanced AI Agent
                </h2>
                <p className="text-secondary mb-8 max-w-3xl mx-auto">
                  I can analyze your data, provide insights, manage your tasks and calendar, control meetings, 
                  handle Gmail operations, generate professional documents, and much more. Just tell me what you need in natural language!
                </p>
                
                {/* Quick Actions */}
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4 max-w-5xl mx-auto mb-8">
                  <GlassCard className="p-4 text-center" hover>
                    <CheckSquare className="w-8 h-8 text-blue-500 mx-auto mb-2" />
                    <h3 className="font-semibold text-primary mb-1">Task Management</h3>
                    <p className="text-xs text-secondary">
                      "What tasks do I need to do today?"
                    </p>
                  </GlassCard>
                  
                  <GlassCard className="p-4 text-center" hover>
                    <BarChart3 className="w-8 h-8 text-yellow-500 mx-auto mb-2" />
                    <h3 className="font-semibold text-primary mb-1">Productivity Analysis</h3>
                    <p className="text-xs text-secondary">
                      "How productive was I this week?"
                    </p>
                  </GlassCard>

                  <GlassCard className="p-4 text-center" hover>
                    <Video className="w-8 h-8 text-purple-500 mx-auto mb-2" />
                    <h3 className="font-semibold text-primary mb-1">Meeting Control</h3>
                    <p className="text-xs text-secondary">
                      "Start a new meeting"
                    </p>
                  </GlassCard>

                  <GlassCard className="p-4 text-center" hover>
                    <FileText className="w-8 h-8 text-orange-500 mx-auto mb-2" />
                    <h3 className="font-semibold text-primary mb-1">Document Generation</h3>
                    <p className="text-xs text-secondary">
                      "Create a business letter"
                    </p>
                  </GlassCard>
                </div>

                <p className="text-xs text-secondary mb-8">
                  I can access your data, generate LaTeX documents, and provide personalized insights
                </p>
                
                {!isGmailConnected && (
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
                  className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'} mb-6`}
                >
                  <div className={`flex items-start space-x-3 max-w-5xl ${msg.role === 'user' ? 'flex-row-reverse space-x-reverse' : ''}`}>
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
                      {msg.role === 'assistant' && msg.agent && (
                        <div className={`flex items-center space-x-2 mb-3 text-xs ${getIntentColor(msg.agent.intent)}`}>
                          {getIntentIcon(msg.agent.intent)}
                          <span className="font-medium capitalize">
                            {msg.agent.intent.replace('_', ' ')} • {(msg.agent.confidence * 100).toFixed(0)}% confidence
                          </span>
                        </div>
                      )}
                      
                      <p className="text-primary whitespace-pre-wrap mb-3">{msg.content}</p>

                      {/* Generated Document Display */}
                      {msg.agent?.generatedDocument && (
                        <div className="mt-4 glass-panel p-4 rounded-lg border-orange-500/30">
                          <h4 className="font-semibold text-primary mb-3 flex items-center">
                            <FileText className="w-4 h-4 mr-2 text-orange-500" />
                            Generated Document
                          </h4>
                          <div className="space-y-3">
                            <div className="flex items-center justify-between">
                              <div>
                                <p className="font-medium text-primary">{msg.agent.generatedDocument.filename}</p>
                                <p className="text-xs text-secondary">
                                  {msg.agent.generatedDocument.type} • {msg.agent.generatedDocument.createdAt}
                                </p>
                              </div>
                              
                              <div className="flex items-center space-x-2">
                                {/* Download button for PDFMake/HTML */}
                                {msg.agent.generatedDocument.downloadUrl ? (
                                  <Button
                                    onClick={() => window.open(`http://localhost:8001${msg.agent.generatedDocument.downloadUrl}`, '_blank')}
                                    variant="secondary"
                                    size="sm"
                                    className="flex items-center space-x-1"
                                  >
                                    <Download className="w-4 h-4" />
                                    <span>Download</span>
                                  </Button>
                                ) : (
                                  <Button
                                    onClick={async () => {
                                      // Download HTML as PDF using html2pdf.js (client-side)
                                      const blob = new Blob([msg.agent.generatedDocument.content], { type: 'text/html' });
                                      const url = URL.createObjectURL(blob);
                                      const a = document.createElement('a');
                                      a.href = url;
                                      a.download = 'document.html';
                                      document.body.appendChild(a);
                                      a.click();
                                      document.body.removeChild(a);
                                      URL.revokeObjectURL(url);
                                    }}
                                    variant="secondary"
                                    size="sm"
                                    className="flex items-center space-x-1"
                                  >
                                    <Download className="w-4 h-4" />
                                    <span>Download</span>
                                  </Button>
                                )}
                              </div>
                            </div>
                            
                            {msg.agent.generatedDocument.pdfError && (
                              <div className="p-2 bg-yellow-500/10 border border-yellow-500/30 rounded text-yellow-400 text-xs">
                                ⚠️ {msg.agent.generatedDocument.pdfError}
                              </div>
                            )}
                          </div>
                        </div>
                      )}

                      {/* Data Display */}
                      {msg.agent?.data && (
                        <div className="mt-4 space-y-4">
                          {/* Tasks Data */}
                          {msg.agent.data.tasks && msg.agent.data.tasks.length > 0 && (
                            <div className="glass-panel p-4 rounded-lg">
                              <h4 className="font-semibold text-primary mb-3 flex items-center">
                                <CheckSquare className="w-4 h-4 mr-2" />
                                Your Tasks ({msg.agent.data.tasks.length})
                              </h4>
                              <div className="space-y-2 max-h-40 overflow-y-auto">
                                {msg.agent.data.tasks.slice(0, 5).map((task: any) => (
                                  <div key={task.id} className="flex items-center justify-between p-2 glass-panel rounded">
                                    <div className="flex-1">
                                      <p className="text-sm font-medium text-primary">{task.title}</p>
                                      <p className="text-xs text-secondary">
                                        {task.status} • {task.priority} priority
                                        {task.due_date && ` • Due: ${new Date(task.due_date).toLocaleDateString()}`}
                                      </p>
                                    </div>
                                  </div>
                                ))}
                                {msg.agent.data.tasks.length > 5 && (
                                  <p className="text-xs text-secondary text-center">
                                    +{msg.agent.data.tasks.length - 5} more tasks
                                  </p>
                                )}
                              </div>
                            </div>
                          )}

                          {/* Productivity Data */}
                          {msg.agent.data.productivity && (
                            <div className="glass-panel p-4 rounded-lg">
                              <h4 className="font-semibold text-primary mb-3 flex items-center">
                                <BarChart3 className="w-4 h-4 mr-2" />
                                Productivity Overview
                              </h4>
                              <div className="grid grid-cols-2 gap-4">
                                <div className="text-center">
                                  <div className="text-2xl font-bold gradient-gold-silver">
                                    {msg.agent.data.productivity.tasks.completionRate}%
                                  </div>
                                  <div className="text-xs text-secondary">Completion Rate</div>
                                </div>
                                <div className="text-center">
                                  <div className="text-2xl font-bold text-blue-500">
                                    {msg.agent.data.productivity.tasks.inProgress}
                                  </div>
                                  <div className="text-xs text-secondary">In Progress</div>
                                </div>
                                <div className="text-center">
                                  <div className="text-2xl font-bold text-red-500">
                                    {msg.agent.data.productivity.tasks.overdue}
                                  </div>
                                  <div className="text-xs text-secondary">Overdue</div>
                                </div>
                                <div className="text-center">
                                  <div className="text-2xl font-bold text-green-500">
                                    {msg.agent.data.productivity.calendar.todayEvents}
                                  </div>
                                  <div className="text-xs text-secondary">Today's Events</div>
                                </div>
                              </div>
                            </div>
                          )}
                        </div>
                      )}

                      {/* Insights */}
                      {msg.agent?.analysis?.insights && msg.agent.analysis.insights.length > 0 && (
                        <div className="mt-4">
                          <h4 className="font-semibold text-primary mb-3 flex items-center">
                            <TrendingUp className="w-4 h-4 mr-2" />
                            Key Insights
                          </h4>
                          <div className="space-y-2">
                            {msg.agent.analysis.insights.map((insight, index) => (
                              <div key={index} className={`p-3 rounded-lg border ${getSeverityColor(insight.severity)}`}>
                                <div className="font-medium text-sm">{insight.title}</div>
                                <div className="text-xs mt-1">{insight.description}</div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Recommendations */}
                      {msg.agent?.analysis?.recommendations && msg.agent.analysis.recommendations.length > 0 && (
                        <div className="mt-4">
                          <h4 className="font-semibold text-primary mb-3 flex items-center">
                            <Target className="w-4 h-4 mr-2" />
                            Recommendations
                          </h4>
                          <div className="space-y-2">
                            {msg.agent.analysis.recommendations.map((rec, index) => (
                              <div key={index} className="p-3 glass-panel rounded-lg">
                                <div className="flex items-center justify-between">
                                  <div className="font-medium text-sm text-primary">{rec.title}</div>
                                  <div className={`text-xs px-2 py-1 rounded ${getPriorityColor(rec.priority)}`}>
                                    {rec.priority}
                                  </div>
                                </div>
                                <div className="text-xs text-secondary mt-1">{rec.description}</div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                      
                      <div className="text-xs text-secondary mt-3">
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
                <div className="flex items-start space-x-3 max-w-5xl">
                  <div className="w-8 h-8 rounded-full bg-gradient-gold-silver flex items-center justify-center flex-shrink-0">
                    <Bot className="w-4 h-4 text-white" />
                  </div>
                  <div className="glass-panel rounded-2xl p-4 border-gold-border">
                    <div className="flex items-center space-x-2">
                      <Loader2 className="w-4 h-4 animate-spin text-secondary" />
                      <span className="text-secondary">
                        {isGeneratingDocument ? 'Generating document...' : 'Analyzing your request...'}
                      </span>
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
          <div className="max-w-6xl mx-auto">
            <div className="flex items-end space-x-4">
              <div className="flex-1">
                <textarea
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  placeholder="Ask me anything... (e.g., 'What tasks do I need to do?', 'Create a business letter', 'Start a meeting', 'Generate a project report')"
                  className="w-full glass-panel rounded-xl px-4 py-3 text-primary placeholder-secondary focus:outline-none focus:ring-2 focus:ring-yellow-500 resize-none min-h-[50px] max-h-32"
                  onKeyPress={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      handleSendMessage();
                    }
                  }}
                  disabled={isProcessing}
                />
                <div className="flex items-center justify-between mt-2">
                  <div className="text-xs text-secondary">
                    I can analyze data, manage tasks, control meetings, generate documents, and much more
                  </div>
                  <div className="text-xs text-secondary">
                    Enter to send • Shift+Enter for new line
                  </div>
                </div>
                {/* Image upload */}
                <div className="mt-2 flex items-center space-x-2">
                  <label className="glass-panel px-3 py-2 rounded-lg cursor-pointer hover:bg-secondary/10">
                    <input
                      type="file"
                      accept="image/*"
                      multiple
                      className="hidden"
                      onChange={handleFileChange}
                      disabled={isProcessing}
                    />
                    <span className="text-xs text-secondary">Attach Image</span>
                  </label>
                  {/* Show thumbnails of selected images */}
                  {files.map((file, idx) => file.type === 'image' && (
                    <img
                      key={idx}
                      src={file.data}
                      alt="preview"
                      className="w-8 h-8 object-cover rounded border border-gray-300"
                    />
                  ))}
                </div>
              </div>
              
              <div className="flex items-center space-x-2">
                <motion.button
                  onClick={toggleListening}
                  className={`glass-panel p-3 rounded-xl glass-panel-hover ${
                    isListening ? 'bg-red-500/20 border-red-500/50' : ''
                  }`}
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  disabled={isProcessing}
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