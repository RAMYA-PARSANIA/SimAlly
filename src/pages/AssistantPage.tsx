import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowLeft, Send, Bot, User, Loader2, Mail, MailOpen, Trash2, CheckSquare, Calendar, Download, RefreshCw, ExternalLink, Check, X, AlertCircle, Inbox, Users, FileText, Zap, ChevronDown, ChevronUp, Eye, Search } from 'lucide-react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import ThemeToggle from '../components/ThemeToggle';
import GlassCard from '../components/ui/GlassCard';
import Button from '../components/ui/Button';

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  type?: 'text' | 'gmail_operation' | 'document_generation';
  data?: any;
}

interface GmailEmail {
  id: string;
  threadId: string;
  from: string;
  subject: string;
  date: string;
  snippet: string;
  isUnread: boolean;
  body?: string; // Full email body
}

interface GmailStatus {
  connected: boolean;
  email?: string;
  unreadCount?: number;
}

const AssistantPage: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, loading } = useAuth();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputMessage, setInputMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [gmailStatus, setGmailStatus] = useState<GmailStatus>({ connected: false });
  const [isCheckingGmail, setIsCheckingGmail] = useState(true);
  const [selectedEmails, setSelectedEmails] = useState<Set<string>>(new Set());
  const [showEmailActions, setShowEmailActions] = useState(false);
  const [expandedEmails, setExpandedEmails] = useState<Set<string>>(new Set());
  const [loadingEmailBodies, setLoadingEmailBodies] = useState<Set<string>>(new Set());
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (loading) {
      return;
    }

    if (!user) {
      navigate('/');
      return;
    }

    const urlParams = new URLSearchParams(location.search);
    if (urlParams.get('gmail_connected') === 'true') {
      setMessages(prev => [...prev, {
        id: Date.now().toString(),
        role: 'assistant',
        content: '✅ Gmail connected successfully! You can now ask me to show your emails, search them, or help manage your inbox.',
        timestamp: new Date()
      }]);
      window.history.replaceState({}, '', location.pathname);
    }

    checkGmailStatus();
  }, [user, loading, navigate, location]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const checkGmailStatus = async () => {
    if (!user) return;
    
    setIsCheckingGmail(true);
    try {
      const response = await fetch(`http://localhost:8001/api/gmail/status?userId=${user.id}`, {
        credentials: 'include'
      });
      
      if (response.ok) {
        const data = await response.json();
        setGmailStatus(data);
      }
    } catch (error) {
      console.error('Error checking Gmail status:', error);
    } finally {
      setIsCheckingGmail(false);
    }
  };

  const connectGmail = async () => {
    if (!user) return;
    
    try {
      const response = await fetch(`http://localhost:8001/api/gmail/auth-url?userId=${user.id}`, {
        credentials: 'include'
      });
      
      if (response.ok) {
        const data = await response.json();
        if (data.success) {
          window.location.href = data.authUrl;
        }
      }
    } catch (error) {
      console.error('Error getting Gmail auth URL:', error);
    }
  };

  const disconnectGmail = async () => {
    if (!user) return;
    
    try {
      const response = await fetch('http://localhost:8001/api/gmail/disconnect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ userId: user.id })
      });
      
      if (response.ok) {
        setGmailStatus({ connected: false });
        setMessages(prev => [...prev, {
          id: Date.now().toString(),
          role: 'assistant',
          content: '📧 Gmail disconnected successfully.',
          timestamp: new Date()
        }]);
      }
    } catch (error) {
      console.error('Error disconnecting Gmail:', error);
    }
  };

  const handleSendMessage = async () => {
    if (!inputMessage.trim() || isLoading) return;

    const userMessage: ChatMessage = {
      id: Date.now().toString(),
      role: 'user',
      content: inputMessage.trim(),
      timestamp: new Date()
    };

    setMessages(prev => [...prev, userMessage]);
    setInputMessage('');
    setIsLoading(true);

    try {
      const agentResponse = await fetch('http://localhost:8001/api/chat/agent-process', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          message: userMessage.content,
          userId: user?.id,
          context: { gmailConnected: gmailStatus.connected }
        })
      });

      if (!agentResponse.ok) {
        throw new Error('Failed to process message');
      }

      const agentData = await agentResponse.json();
      
      if (agentData.success && agentData.agent) {
        const agent = agentData.agent;
        
        if (agent.intent === 'gmail_management' && gmailStatus.connected) {
          await handleGmailOperation(agent, userMessage.content);
        }
        else if (agent.intent === 'document_generation') {
          await handleDocumentGeneration(agent, userMessage.content);
        }
        else {
          const assistantMessage: ChatMessage = {
            id: (Date.now() + 1).toString(),
            role: 'assistant',
            content: agent.response,
            timestamp: new Date()
          };
          setMessages(prev => [...prev, assistantMessage]);
        }
      } else {
        throw new Error('Invalid agent response');
      }
    } catch (error) {
      console.error('Error processing message:', error);
      const errorMessage: ChatMessage = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: 'I apologize, but I encountered an error processing your request. Please try again.',
        timestamp: new Date()
      };
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleGmailOperation = async (agent: any, originalMessage: string) => {
    if (!user) return;

    try {
      let response;
      let assistantMessage: ChatMessage;

      switch (agent.subIntent) {
        case 'list_unread':
          response = await fetch(`http://localhost:8001/api/gmail/unread?userId=${user.id}&maxResults=20`, {
            credentials: 'include'
          });
          
          if (response.ok) {
            const data = await response.json();
            if (data.success) {
              assistantMessage = {
                id: (Date.now() + 1).toString(),
                role: 'assistant',
                content: `📧 Found ${data.emails.length} unread emails:`,
                timestamp: new Date(),
                type: 'gmail_operation',
                data: { operation: 'list_unread', emails: data.emails, totalCount: data.totalCount }
              };
            } else {
              throw new Error('Failed to fetch emails');
            }
          } else {
            throw new Error('Gmail API request failed');
          }
          break;

        case 'search_emails':
          // Extract search query from message
          const searchMatch = originalMessage.match(/search|find|show.*emails?.*(?:with|containing|about|for)\s+(.+)/i);
          if (!searchMatch) {
            assistantMessage = {
              id: (Date.now() + 1).toString(),
              role: 'assistant',
              content: 'Please specify what you want to search for in your emails.',
              timestamp: new Date()
            };
            break;
          }

          const searchQuery = searchMatch[1].trim();
          response = await fetch(`http://localhost:8001/api/gmail/search?userId=${user.id}&query=${encodeURIComponent(searchQuery)}&maxResults=10`, {
            credentials: 'include'
          });
          
          if (response.ok) {
            const data = await response.json();
            if (data.success) {
              assistantMessage = {
                id: (Date.now() + 1).toString(),
                role: 'assistant',
                content: `🔍 Found ${data.emails.length} emails matching "${searchQuery}":`,
                timestamp: new Date(),
                type: 'gmail_operation',
                data: { operation: 'search_emails', emails: data.emails, searchQuery }
              };
            } else {
              throw new Error('Failed to search emails');
            }
          } else {
            throw new Error('Gmail API request failed');
          }
          break;

        case 'search_sender':
          const senderMatch = originalMessage.match(/from\s+([^\s]+@[^\s]+|[^@\s]+)/i);
          if (!senderMatch) {
            assistantMessage = {
              id: (Date.now() + 1).toString(),
              role: 'assistant',
              content: 'Please specify the sender email address or name you want to search for.',
              timestamp: new Date()
            };
            break;
          }

          const sender = senderMatch[1];
          response = await fetch(`http://localhost:8001/api/gmail/search-by-sender?userId=${user.id}&sender=${encodeURIComponent(sender)}&maxResults=10`, {
            credentials: 'include'
          });
          
          if (response.ok) {
            const data = await response.json();
            if (data.success) {
              assistantMessage = {
                id: (Date.now() + 1).toString(),
                role: 'assistant',
                content: `📧 Found ${data.emails.length} emails from "${sender}":`,
                timestamp: new Date(),
                type: 'gmail_operation',
                data: { operation: 'search_sender', emails: data.emails, sender }
              };
            } else {
              throw new Error('Failed to search emails');
            }
          } else {
            throw new Error('Gmail API request failed');
          }
          break;

        case 'summarize_emails':
          response = await fetch(`http://localhost:8001/api/gmail/unread?userId=${user.id}&maxResults=10`, {
            credentials: 'include'
          });
          
          if (response.ok) {
            const emailData = await response.json();
            if (emailData.success && emailData.emails.length > 0) {
              const messageIds = emailData.emails.map((email: GmailEmail) => email.id);
              
              const summaryResponse = await fetch('http://localhost:8001/api/gmail/summarize-emails', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({ userId: user.id, messageIds })
              });
              
              if (summaryResponse.ok) {
                const summaryData = await summaryResponse.json();
                if (summaryData.success) {
                  assistantMessage = {
                    id: (Date.now() + 1).toString(),
                    role: 'assistant',
                    content: `📊 Email Summary:\n\n${summaryData.summary}`,
                    timestamp: new Date(),
                    type: 'gmail_operation',
                    data: { 
                      operation: 'summarize', 
                      summary: summaryData.summary,
                      groups: summaryData.groups,
                      tasks: summaryData.tasks,
                      events: summaryData.events
                    }
                  };
                } else {
                  throw new Error('Failed to summarize emails');
                }
              } else {
                throw new Error('Email summarization failed');
              }
            } else {
              assistantMessage = {
                id: (Date.now() + 1).toString(),
                role: 'assistant',
                content: '📧 No unread emails found to summarize.',
                timestamp: new Date()
              };
            }
          } else {
            throw new Error('Failed to fetch emails for summarization');
          }
          break;

        case 'extract_tasks':
          response = await fetch(`http://localhost:8001/api/gmail/unread?userId=${user.id}&maxResults=10`, {
            credentials: 'include'
          });
          
          if (response.ok) {
            const emailData = await response.json();
            if (emailData.success && emailData.emails.length > 0) {
              const messageIds = emailData.emails.map((email: GmailEmail) => email.id);
              
              const extractResponse = await fetch('http://localhost:8001/api/gmail/extract-tasks-events', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({ userId: user.id, messageIds })
              });
              
              if (extractResponse.ok) {
                const extractData = await extractResponse.json();
                if (extractData.success) {
                  assistantMessage = {
                    id: (Date.now() + 1).toString(),
                    role: 'assistant',
                    content: `✅ Extracted from your emails:\n• ${extractData.tasksCreated} tasks added to your task list\n• ${extractData.eventsCreated} events added to your calendar\n\n${extractData.summary}`,
                    timestamp: new Date(),
                    type: 'gmail_operation',
                    data: { 
                      operation: 'extract_tasks',
                      tasksCreated: extractData.tasksCreated,
                      eventsCreated: extractData.eventsCreated,
                      tasks: extractData.tasks,
                      events: extractData.events
                    }
                  };
                } else {
                  throw new Error('Failed to extract tasks and events');
                }
              } else {
                throw new Error('Task extraction failed');
              }
            } else {
              assistantMessage = {
                id: (Date.now() + 1).toString(),
                role: 'assistant',
                content: '📧 No unread emails found to extract tasks from.',
                timestamp: new Date()
              };
            }
          } else {
            throw new Error('Failed to fetch emails for task extraction');
          }
          break;

        default:
          assistantMessage = {
            id: (Date.now() + 1).toString(),
            role: 'assistant',
            content: agent.response,
            timestamp: new Date()
          };
      }

      setMessages(prev => [...prev, assistantMessage]);
    } catch (error) {
      console.error('Gmail operation error:', error);
      const errorMessage: ChatMessage = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: 'I encountered an error accessing your Gmail. Please make sure Gmail is connected and try again.',
        timestamp: new Date()
      };
      setMessages(prev => [...prev, errorMessage]);
    }
  };

  const handleDocumentGeneration = async (agent: any, originalMessage: string) => {
    try {
      const response = await fetch('http://localhost:8001/api/documents/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          prompt: originalMessage,
          documentType: agent.actions.find((a: any) => a.type === 'document_generation')?.parameters?.type || 'general',
          format: 'html'
        })
      });

      if (response.ok) {
        const data = await response.json();
        if (data.success) {
          const assistantMessage: ChatMessage = {
            id: (Date.now() + 1).toString(),
            role: 'assistant',
            content: '📄 Document generated successfully!',
            timestamp: new Date(),
            type: 'document_generation',
            data: { document: data.document }
          };
          setMessages(prev => [...prev, assistantMessage]);
        } else {
          throw new Error('Document generation failed');
        }
      } else {
        throw new Error('Document generation request failed');
      }
    } catch (error) {
      console.error('Document generation error:', error);
      const errorMessage: ChatMessage = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: 'I encountered an error generating the document. Please try again with a more specific request.',
        timestamp: new Date()
      };
      setMessages(prev => [...prev, errorMessage]);
    }
  };

  const handleEmailSelection = (emailId: string, selected: boolean) => {
    setSelectedEmails(prev => {
      const newSet = new Set(prev);
      if (selected) {
        newSet.add(emailId);
      } else {
        newSet.delete(emailId);
      }
      setShowEmailActions(newSet.size > 0);
      return newSet;
    });
  };

  const handleSelectAllEmails = (emails: GmailEmail[], selectAll: boolean) => {
    if (selectAll) {
      setSelectedEmails(new Set(emails.map(email => email.id)));
      setShowEmailActions(true);
    } else {
      setSelectedEmails(new Set());
      setShowEmailActions(false);
    }
  };

  const handleDeleteSelectedEmails = async () => {
    if (!user || selectedEmails.size === 0) return;

    try {
      const response = await fetch('http://localhost:8001/api/gmail/delete-emails', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          userId: user.id,
          messageIds: Array.from(selectedEmails)
        })
      });

      if (response.ok) {
        const data = await response.json();
        if (data.success) {
          // Update messages to remove deleted emails from email lists
          setMessages(prev => prev.map(message => {
            if (message.type === 'gmail_operation' && message.data?.emails) {
              const updatedEmails = message.data.emails.filter((email: GmailEmail) => 
                !selectedEmails.has(email.id)
              );
              
              return {
                ...message,
                data: {
                  ...message.data,
                  emails: updatedEmails
                },
                content: message.data.operation === 'list_unread' 
                  ? `📧 Found ${updatedEmails.length} unread emails:`
                  : message.data.operation === 'search_sender'
                  ? `📧 Found ${updatedEmails.length} emails from "${message.data.sender}":`
                  : message.data.operation === 'search_emails'
                  ? `🔍 Found ${updatedEmails.length} emails matching "${message.data.searchQuery}":`
                  : message.content
              };
            }
            return message;
          }));

          setSelectedEmails(new Set());
          setShowEmailActions(false);
          
          const successMessage: ChatMessage = {
            id: Date.now().toString(),
            role: 'assistant',
            content: `✅ Successfully deleted ${data.deleted} emails. ${data.failed > 0 ? `Failed to delete ${data.failed} emails.` : ''}`,
            timestamp: new Date()
          };
          setMessages(prev => [...prev, successMessage]);
        }
      }
    } catch (error) {
      console.error('Error deleting emails:', error);
    }
  };

  const handleToggleEmailExpansion = async (emailId: string) => {
    if (expandedEmails.has(emailId)) {
      // Collapse email
      setExpandedEmails(prev => {
        const newSet = new Set(prev);
        newSet.delete(emailId);
        return newSet;
      });
    } else {
      // Expand email - fetch full body if not already loaded
      const emailInMessages = messages.find(msg => 
        msg.type === 'gmail_operation' && 
        msg.data?.emails?.some((email: GmailEmail) => email.id === emailId)
      );
      
      const email = emailInMessages?.data?.emails?.find((e: GmailEmail) => e.id === emailId);
      
      if (email && !email.body) {
        // Fetch full email body
        setLoadingEmailBodies(prev => new Set(prev.add(emailId)));
        
        try {
          const response = await fetch(`http://localhost:8001/api/gmail/email/${emailId}?userId=${user?.id}`, {
            credentials: 'include'
          });
          
          if (response.ok) {
            const data = await response.json();
            if (data.success) {
              // Update the email in messages with full body
              setMessages(prev => prev.map(message => {
                if (message.type === 'gmail_operation' && message.data?.emails) {
                  const updatedEmails = message.data.emails.map((e: GmailEmail) => 
                    e.id === emailId ? { ...e, body: data.email.body } : e
                  );
                  
                  return {
                    ...message,
                    data: {
                      ...message.data,
                      emails: updatedEmails
                    }
                  };
                }
                return message;
              }));
            }
          }
        } catch (error) {
          console.error('Error fetching email body:', error);
        } finally {
          setLoadingEmailBodies(prev => {
            const newSet = new Set(prev);
            newSet.delete(emailId);
            return newSet;
          });
        }
      }
      
      setExpandedEmails(prev => new Set(prev.add(emailId)));
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const formatTime = (timestamp: Date) => {
    return timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const renderEmailList = (emails: GmailEmail[], operation: string, additionalData?: any) => {
    if (!emails || emails.length === 0) {
      return (
        <div className="text-center py-8">
          <Inbox className="w-12 h-12 text-secondary mx-auto mb-4 opacity-50" />
          <p className="text-secondary">No emails found</p>
        </div>
      );
    }

    return (
      <div className="space-y-4">
        {/* Email Actions Bar */}
        <div className="flex items-center justify-between p-3 glass-panel rounded-lg">
          <div className="flex items-center space-x-4">
            <label className="flex items-center space-x-2 cursor-pointer">
              <input
                type="checkbox"
                checked={selectedEmails.size === emails.length && emails.length > 0}
                onChange={(e) => handleSelectAllEmails(emails, e.target.checked)}
                className="rounded border-gray-300 text-yellow-500 focus:ring-yellow-500"
              />
              <span className="text-sm text-secondary">
                {selectedEmails.size > 0 ? `${selectedEmails.size} selected` : 'Select all'}
              </span>
            </label>
            
            {operation === 'search_sender' && additionalData?.sender && (
              <span className="text-sm text-secondary">
                From: <span className="font-medium text-primary">{additionalData.sender}</span>
              </span>
            )}
            
            {operation === 'search_emails' && additionalData?.searchQuery && (
              <span className="text-sm text-secondary">
                Search: <span className="font-medium text-primary">"{additionalData.searchQuery}"</span>
              </span>
            )}
          </div>

          {showEmailActions && (
            <Button
              onClick={handleDeleteSelectedEmails}
              variant="secondary"
              size="sm"
              className="flex items-center space-x-2 bg-red-500/20 border-red-500/50 hover:bg-red-500/30"
            >
              <Trash2 className="w-4 h-4 text-red-400" />
              <span className="text-red-400">Delete Selected</span>
            </Button>
          )}
        </div>

        {/* Email List */}
        <div className="space-y-2 max-h-96 overflow-y-auto">
          {emails.map((email) => {
            const isExpanded = expandedEmails.has(email.id);
            const isLoadingBody = loadingEmailBodies.has(email.id);
            
            return (
              <div
                key={email.id}
                className={`glass-panel rounded-lg border transition-all ${
                  selectedEmails.has(email.id) ? 'border-yellow-500 bg-yellow-500/10' : ''
                }`}
              >
                <div className="p-4">
                  <div className="flex items-start space-x-3">
                    <input
                      type="checkbox"
                      checked={selectedEmails.has(email.id)}
                      onChange={(e) => handleEmailSelection(email.id, e.target.checked)}
                      className="mt-1 rounded border-gray-300 text-yellow-500 focus:ring-yellow-500"
                    />
                    
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center space-x-2 mb-1">
                        {email.isUnread ? (
                          <MailOpen className="w-4 h-4 text-blue-500" />
                        ) : (
                          <Mail className="w-4 h-4 text-gray-500" />
                        )}
                        <span className={`font-medium truncate ${email.isUnread ? 'text-primary' : 'text-secondary'}`}>
                          {email.from}
                        </span>
                        <span className="text-xs text-secondary">
                          {new Date(email.date).toLocaleDateString()}
                        </span>
                      </div>
                      
                      <h4 className={`font-medium mb-1 truncate ${email.isUnread ? 'text-primary' : 'text-secondary'}`}>
                        {email.subject || '(No Subject)'}
                      </h4>
                      
                      <p className="text-sm text-secondary line-clamp-2 mb-2">
                        {email.snippet}
                      </p>
                    </div>

                    <div className="flex items-center space-x-2">
                      <Button
                        onClick={() => handleToggleEmailExpansion(email.id)}
                        variant="ghost"
                        size="sm"
                        className="p-2"
                        disabled={isLoadingBody}
                      >
                        {isLoadingBody ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : isExpanded ? (
                          <ChevronUp className="w-4 h-4" />
                        ) : (
                          <ChevronDown className="w-4 h-4" />
                        )}
                      </Button>
                    </div>
                  </div>

                  {/* Expanded Email Body */}
                  <AnimatePresence>
                    {isExpanded && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700"
                      >
                        <div className="flex items-center space-x-2 mb-3">
                          <Eye className="w-4 h-4 text-blue-500" />
                          <span className="text-sm font-medium text-primary">Full Email</span>
                        </div>
                        
                        {email.body ? (
                          <div className="max-h-64 overflow-y-auto">
                            <div 
                              className="prose prose-sm max-w-none text-secondary"
                              dangerouslySetInnerHTML={{ __html: email.body }}
                            />
                          </div>
                        ) : (
                          <div className="text-center py-4">
                            <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2 text-secondary" />
                            <p className="text-sm text-secondary">Loading full email...</p>
                          </div>
                        )}
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  const renderMessage = (message: ChatMessage) => {
    const isUser = message.role === 'user';
    
    return (
      <motion.div
        key={message.id}
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className={`flex items-start space-x-3 ${isUser ? 'flex-row-reverse space-x-reverse' : ''}`}
      >
        {/* Avatar */}
        <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${
          isUser ? 'bg-gradient-to-r from-blue-500 to-purple-500' : 'bg-gradient-gold-silver'
        }`}>
          {isUser ? <User className="w-4 h-4 text-white" /> : <Bot className="w-4 h-4 text-white" />}
        </div>

        {/* Message */}
        <div className={`glass-panel rounded-2xl p-4 max-w-4xl ${
          isUser ? 'bg-gradient-to-r from-blue-500/10 to-purple-500/10 border-blue-500/30' : 'border-gold-border'
        }`}>
          {/* Message content */}
          <p className="text-primary whitespace-pre-wrap mb-2">{message.content}</p>

          {/* Gmail operation results */}
          {message.type === 'gmail_operation' && message.data && (
            <div className="mt-4">
              {(message.data.operation === 'list_unread' || message.data.operation === 'search_sender' || message.data.operation === 'search_emails') && (
                renderEmailList(message.data.emails, message.data.operation, message.data)
              )}
              {message.data.operation === 'summarize' && message.data.groups && (
                <div className="space-y-4">
                  {message.data.groups.map((group: any, index: number) => (
                    <div key={index} className="glass-panel p-3 rounded-lg">
                      <h4 className="font-medium text-primary mb-2">{group.category}</h4>
                      <p className="text-sm text-secondary mb-2">{group.summary}</p>
                      <div className="text-xs text-secondary">
                        Emails: {group.emails.join(', ')}
                      </div>
                    </div>
                  ))}
                </div>
              )}
              {message.data.operation === 'extract_tasks' && (
                <div className="space-y-3">
                  {message.data.tasks && message.data.tasks.length > 0 && (
                    <div className="glass-panel p-3 rounded-lg bg-green-500/10 border-green-500/30">
                      <h4 className="font-medium text-green-400 mb-2 flex items-center">
                        <CheckSquare className="w-4 h-4 mr-2" />
                        Tasks Created ({message.data.tasks.length})
                      </h4>
                      {message.data.tasks.map((task: any, index: number) => (
                        <div key={index} className="text-sm text-secondary mb-1">
                          • {task.title}
                        </div>
                      ))}
                    </div>
                  )}
                  {message.data.events && message.data.events.length > 0 && (
                    <div className="glass-panel p-3 rounded-lg bg-blue-500/10 border-blue-500/30">
                      <h4 className="font-medium text-blue-400 mb-2 flex items-center">
                        <Calendar className="w-4 h-4 mr-2" />
                        Events Created ({message.data.events.length})
                      </h4>
                      {message.data.events.map((event: any, index: number) => (
                        <div key={index} className="text-sm text-secondary mb-1">
                          • {event.title}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Document generation results */}
          {message.type === 'document_generation' && message.data?.document && (
            <div className="mt-4">
              <div className="glass-panel p-4 rounded-lg bg-green-500/10 border-green-500/30">
                <div className="flex items-center justify-between mb-3">
                  <h4 className="font-medium text-green-400 flex items-center">
                    <FileText className="w-4 h-4 mr-2" />
                    Generated Document
                  </h4>
                  <Button
                    onClick={() => {
                      const blob = new Blob([message.data.document.content], { type: 'text/html' });
                      const url = URL.createObjectURL(blob);
                      const a = document.createElement('a');
                      a.href = url;
                      a.download = 'document.html';
                      a.click();
                      URL.revokeObjectURL(url);
                    }}
                    variant="ghost"
                    size="sm"
                  >
                    <Download className="w-4 h-4" />
                  </Button>
                </div>
                <div 
                  className="prose prose-sm max-w-none text-secondary"
                  dangerouslySetInnerHTML={{ __html: message.data.document.content.substring(0, 500) + '...' }}
                />
              </div>
            </div>
          )}

          {/* Timestamp */}
          <div className="text-xs text-secondary mt-2">
            {formatTime(message.timestamp)}
          </div>
        </div>
      </motion.div>
    );
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-primary flex items-center justify-center">
        <div className="glass-panel rounded-2xl p-8 max-w-md mx-auto text-center">
          <div className="animate-spin w-8 h-8 border-2 border-gold-text border-t-transparent rounded-full mx-auto mb-4"></div>
          <h3 className="text-xl font-bold text-primary mb-2">Loading Assistant...</h3>
          <p className="text-secondary">Verifying your session</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-primary flex flex-col">
      {/* Header */}
      <header className="glass-panel border-0 border-b silver-border">
        <div className="max-w-7xl mx-auto container-padding">
          <div className="flex justify-between items-center py-4">
            <div className="flex items-center space-x-4">
              <motion.button
                onClick={() => navigate('/dashboard')}
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
                  Professional productivity & Gmail management
                </p>
              </div>
            </div>
            
            <div className="flex items-center space-x-3">
              {/* Gmail Status */}
              <div className="flex items-center space-x-2">
                <div className={`w-2 h-2 rounded-full ${
                  isCheckingGmail ? 'bg-yellow-500 animate-pulse' : 
                  gmailStatus.connected ? 'bg-green-500' : 'bg-gray-500'
                }`} />
                <span className="text-sm text-secondary">
                  Gmail {gmailStatus.connected ? 'Connected' : 'Disconnected'}
                </span>
                {gmailStatus.connected ? (
                  <Button
                    onClick={disconnectGmail}
                    variant="ghost"
                    size="sm"
                    className="text-xs"
                  >
                    Disconnect
                  </Button>
                ) : (
                  <Button
                    onClick={connectGmail}
                    variant="secondary"
                    size="sm"
                    className="text-xs"
                  >
                    Connect Gmail
                  </Button>
                )}
              </div>
              
              <ThemeToggle />
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <div className="flex-1 flex flex-col max-w-6xl mx-auto w-full">
        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {messages.length === 0 && (
            <div className="text-center py-12">
              <Bot className="w-16 h-16 text-secondary mx-auto mb-6 opacity-50" />
              <h3 className="text-xl font-bold text-primary mb-4">Welcome to Your AI Assistant</h3>
              <p className="text-secondary mb-6 max-w-2xl mx-auto">
                I can help you manage your Gmail, generate documents, and boost your productivity. 
                {!gmailStatus.connected && ' Connect your Gmail to get started with email management.'}
              </p>
              
              {/* Quick Actions */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 max-w-4xl mx-auto">
                {[
                  { icon: Mail, text: 'Show unread emails', disabled: !gmailStatus.connected },
                  { icon: Search, text: 'Search emails for "project"', disabled: !gmailStatus.connected },
                  { icon: FileText, text: 'Generate a document', disabled: false },
                  { icon: Zap, text: 'Summarize my emails', disabled: !gmailStatus.connected },
                ].map((action, index) => (
                  <button
                    key={index}
                    onClick={() => !action.disabled && setInputMessage(action.text)}
                    disabled={action.disabled}
                    className={`glass-panel p-4 rounded-lg text-center transition-all ${
                      action.disabled 
                        ? 'opacity-50 cursor-not-allowed' 
                        : 'glass-panel-hover cursor-pointer'
                    }`}
                  >
                    <action.icon className={`w-6 h-6 mx-auto mb-2 ${
                      action.disabled ? 'text-gray-500' : 'gold-text'
                    }`} />
                    <p className={`text-sm ${action.disabled ? 'text-gray-500' : 'text-primary'}`}>
                      {action.text}
                    </p>
                  </button>
                ))}
              </div>
            </div>
          )}

          <AnimatePresence>
            {messages.map(renderMessage)}
          </AnimatePresence>

          {isLoading && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex items-start space-x-3"
            >
              <div className="w-8 h-8 rounded-full bg-gradient-gold-silver flex items-center justify-center">
                <Bot className="w-4 h-4 text-white" />
              </div>
              <div className="glass-panel rounded-2xl p-4 border-gold-border">
                <div className="flex items-center space-x-2">
                  <Loader2 className="w-4 h-4 animate-spin text-secondary" />
                  <span className="text-secondary">Processing your request...</span>
                </div>
              </div>
            </motion.div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Input */}
        <div className="glass-panel border-t silver-border p-6">
          <div className="flex items-end space-x-4">
            <div className="flex-1">
              <textarea
                ref={inputRef}
                value={inputMessage}
                onChange={(e) => setInputMessage(e.target.value)}
                onKeyPress={handleKeyPress}
                placeholder="Ask me to search emails, manage your Gmail, generate documents, or help with productivity..."
                className="w-full glass-panel rounded-xl px-4 py-3 text-primary placeholder-secondary focus:outline-none focus:ring-2 focus:ring-yellow-500 resize-none min-h-[50px] max-h-32"
                rows={1}
              />
              <div className="flex items-center justify-between mt-2">
                <div className="text-xs text-secondary">
                  {gmailStatus.connected ? (
                    <span className="flex items-center space-x-1">
                      <Check className="w-3 h-3 text-green-500" />
                      <span>Gmail connected - Try "search emails for project" or "show unread emails"</span>
                    </span>
                  ) : (
                    <span className="flex items-center space-x-1">
                      <AlertCircle className="w-3 h-3 text-yellow-500" />
                      <span>Connect Gmail for email management features</span>
                    </span>
                  )}
                </div>
                <div className="text-xs text-secondary">
                  Enter to send • Shift+Enter for new line
                </div>
              </div>
            </div>

            <Button
              onClick={handleSendMessage}
              variant="premium"
              size="sm"
              className="p-3"
              disabled={!inputMessage.trim() || isLoading}
            >
              <Send className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AssistantPage;