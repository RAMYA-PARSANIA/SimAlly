import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowLeft, Hash, Users, Plus, Settings, Calendar, CheckSquare, MessageSquare, Upload, Paperclip, UserPlus, Clock, Target, TrendingUp, Video, Loader2, ExternalLink, FileText, Presentation, Kanban as LayoutKanban } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { supabase, workspaceAPI, type Channel, type Message, type Task } from '../lib/supabase';
import { meetingService } from '../services/meetingService';
import ThemeToggle from '../components/ThemeToggle';
import ChatPanel from '../components/ChatPanel';
import ChannelList from '../components/ChannelList';
import TaskPanel from '../components/TaskPanel';
import CalendarPanel from '../components/CalendarPanel';
import DocumentGenerationPanel from '../components/DocumentGenerationPanel';
import KanbanBoard from '../components/KanbanBoard';
import CreateChannelMeetingModal from '../components/CreateChannelMeetingModal';
import NotificationManager from '../components/NotificationManager';
import GlassCard from '../components/ui/GlassCard';
import Button from '../components/ui/Button';
const VITE_AI_API_URL = import.meta.env.VITE_AI_API_URL;
const VITE_API_URL = import.meta.env.VITE_API_URL;
const VITE_MEDIA_API_URL = import.meta.env.VITE_MEDIA_API_URL;
const VITE_WORKSPACE_API_URL = import.meta.env.VITE_WORKSPACE_API_URL;
const VITE_APP_URL = import.meta.env.VITE_APP_URL;
const FRONTEND_URL = import.meta.env.VITE_FRONTEND_URL;

const WorkspacePage: React.FC = () => {
  const navigate = useNavigate();
  const { user, isGoogleConnected } = useAuth();
  const [channels, setChannels] = useState<(Channel & { is_member?: boolean })[]>([]);
  const [activeChannel, setActiveChannel] = useState<Channel | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [activePanel, setActivePanel] = useState<'chat' | 'tasks' | 'calendar' | 'documents' | 'kanban'>('chat');
  const [loading, setLoading] = useState(true);
  const [isCreatingMeeting, setIsCreatingMeeting] = useState(false);
  const [showMeetingModal, setShowMeetingModal] = useState(false);
  const [selectedChannelForMeeting, setSelectedChannelForMeeting] = useState<{id: string, name: string} | null>(null);

  useEffect(() => {
    if (user) {
      loadChannels();
      loadTasks();
    }
  }, [user]);

  useEffect(() => {
    if (activeChannel) {
      loadMessages(activeChannel.id);
      
      // Subscribe to real-time messages for this channel
      const subscription = workspaceAPI.subscribeToChannel(activeChannel.id, (payload) => {
        //console.log('Real-time message update:', payload);
        if (payload.eventType === 'INSERT') {
          // Fetch the complete message with sender info
          loadMessages(activeChannel.id);
        }
      });

      return () => {
        subscription.unsubscribe();
      };
    }
  }, [activeChannel]);

  useEffect(() => {
    if (!user) return;

    // Subscribe to real-time task updates
    const taskSubscription = workspaceAPI.subscribeToTasks(user.id, (payload) => {
      //console.log('Real-time task update:', payload);
      loadTasks();
    });

    // Subscribe to real-time channel updates
    const channelSubscription = workspaceAPI.subscribeToChannels(user.id, (payload) => {
      //console.log('Real-time channel update:', payload);
      loadChannels();
    });

    return () => {
      taskSubscription.unsubscribe();
      channelSubscription.unsubscribe();
    };
  }, [user]);

  const loadChannels = async () => {
    if (!user) return;
    
    try {
      const response = await fetch(`${import.meta.env.VITE_WORKSPACE_API_URL}/api/workspace/channels/${user.id}`, {
        credentials: 'include'
      });
      
      const data = await response.json();
      
      if (data.success) {
        setChannels(data.channels);
        
        // Set first channel as active if none selected
        if (data.channels.length > 0 && !activeChannel) {
          const memberChannels = data.channels.filter((c: any) => c.is_member);
          if (memberChannels.length > 0) {
            setActiveChannel(memberChannels[0]);
          }
        }
      }
    } catch (error) {
      console.error('Error loading channels:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadMessages = async (channelId: string) => {
    try {
      const messageData = await workspaceAPI.getMessagesForChannel(channelId);
      setMessages(messageData);
    } catch (error) {
      console.error('Error loading messages:', error);
    }
  };

  const loadTasks = async () => {
    if (!user) return;
    
    try {
      const taskData = await workspaceAPI.getUserTasks(user.id);
      setTasks(taskData);
    } catch (error) {
      console.error('Error loading tasks:', error);
    }
  };

  const handleBack = () => {
    navigate('/dashboard');
  };

  const handleChannelSelect = (channel: Channel) => {
    // Add a smooth transition effect when changing channels
    if (activeChannel?.id !== channel.id) {
      // If it's a different channel, create a smooth transition
      // Slight delay to allow transition to complete
      setTimeout(() => {
        loadMessages(channel.id);
      }, 100);
      setActiveChannel(channel);
    } else {
      // If it's the same channel, just reload messages
      loadMessages(channel.id);
    }
    setActivePanel('chat'); // Always switch to chat when selecting a channel
  };

  const uploadFile = async (file: File): Promise<string> => {
    // In a real implementation, you would upload to a cloud storage service
    // For now, we'll create a mock URL
    return new Promise((resolve) => {
      setTimeout(() => {
        const mockUrl = `https://example.com/uploads/${file.name}`;
        resolve(mockUrl);
      }, 1000);
    });
  };

  const handleSendMessage = async (content: string, mentions: string[] = [], attachments: File[] = []) => {
    if (!activeChannel || !user) return;

    try {
      // Upload attachments first
      const uploadedAttachments = [];
      for (const file of attachments) {
        const url = await uploadFile(file);
        uploadedAttachments.push({
          id: Date.now().toString() + Math.random(),
          name: file.name,
          type: file.type,
          size: file.size,
          url: url
        });
      }

      // Send message to database
      const { data: messageData, error } = await supabase
        .from('messages')
        .insert({
          channel_id: activeChannel.id,
          sender_id: user.id,
          content,
          type: 'text',
          metadata: uploadedAttachments.length > 0 ? { attachments: uploadedAttachments } : {}
        })
        .select(`
          *,
          sender:profiles(*)
        `)
        .single();

      if (error) {
        console.error('Error sending message:', error);
        return;
      }

      // Process with AI for task detection (only for text messages)
      if (content && content !== '[Media]') {
        await processMessageForTasks(messageData, mentions);
      }

    } catch (error) {
      console.error('Error sending message:', error);
    }
  };

  const handleEditMessage = async (messageId: string, newContent: string) => {
    try {
      const response = await fetch(`${import.meta.env.VITE_WORKSPACE_API_URL}/api/workspace/messages/${messageId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({
          userId: user?.id,
          content: newContent
        })
      });

      const data = await response.json();
      
      if (data.success) {
        // Reload messages to show the edit
        if (activeChannel) {
          loadMessages(activeChannel.id);
        }
      } else {
        console.error('Error editing message:', data.error);
      }
    } catch (error) {
      console.error('Error editing message:', error);
    }
  };

  const handleDeleteMessage = async (messageId: string) => {
    try {
      const response = await fetch(`${import.meta.env.VITE_WORKSPACE_API_URL}/api/workspace/messages/${messageId}`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({
          userId: user?.id
        })
      });

      const data = await response.json();
      
      if (data.success) {
        // Reload messages to reflect the deletion
        if (activeChannel) {
          loadMessages(activeChannel.id);
        }
      } else {
        console.error('Error deleting message:', data.error);
      }
    } catch (error) {
      console.error('Error deleting message:', error);
    }
  };

  const processMessageForTasks = async (message: Message, mentions: string[]) => {
    try {
      const response = await fetch(`${import.meta.env.VITE_WORKSPACE_API_URL}/api/workspace/process-message`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({
          message: message.content,
          messageId: message.id,
          channelId: message.channel_id,
          senderId: message.sender_id,
          mentions,
          userId: user?.id
        })
      });

      const data = await response.json();
      
      if (data.success && data.taskCreated) {
        // Reload tasks to show the new one
        loadTasks();
        
        // Add AI confirmation message
        const { data: aiMessage } = await supabase
          .from('messages')
          .insert({
            channel_id: activeChannel?.id,
            sender_id: user?.id, // System message
            content: `✅ Task created: "${data.task.title}"${data.task.assignee ? ` assigned to ${data.task.assignee}` : ''}`,
            type: 'ai_task_creation',
            metadata: { task_id: data.task.id }
          })
          .select(`
            *,
            sender:profiles(*)
          `)
          .single();

        if (aiMessage) {
          // The real-time subscription will handle adding this message
        }
      }
    } catch (error) {
      console.error('Error processing message for tasks:', error);
    }
  };

  const handleCreateChannel = async (name: string, description: string, type: 'public' | 'private', password?: string) => {
    if (!user) return;

    try {
      const response = await fetch(`${import.meta.env.VITE_WORKSPACE_API_URL}/api/workspace/channels`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({
          name,
          description,
          type,
          password,
          userId: user.id
        })
      });

      const data = await response.json();
      
      if (data.success) {
        // Reload channels
        loadChannels();
      } else {
        console.error('Error creating channel:', data.error);
        alert(data.error);
      }
    } catch (error) {
      console.error('Error creating channel:', error);
    }
  };

  const handleJoinChannel = async (channelId: string, password?: string) => {
    if (!user) return;

    try {
      const response = await fetch(`${import.meta.env.VITE_WORKSPACE_API_URL}/api/workspace/channels/${channelId}/join`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({
          userId: user.id,
          password
        })
      });

      const data = await response.json();
      
      if (data.success) {
        // Reload channels to update membership
        loadChannels();
      } else {
        console.error('Error joining channel:', data.error);
        alert(data.error);
      }
    } catch (error) {
      console.error('Error joining channel:', error);
    }
  };

  const handleLeaveChannel = async (channelId: string) => {
    if (!user) return;

    try {
      const response = await fetch(`${import.meta.env.VITE_WORKSPACE_API_URL}/api/workspace/channels/${channelId}/leave`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({
          userId: user.id
        })
      });

      const data = await response.json();
      
      if (data.success) {
        // If the left channel was active, switch to another channel
        if (activeChannel?.id === channelId) {
          const remainingChannels = channels.filter(c => c.id !== channelId && c.is_member);
          setActiveChannel(remainingChannels.length > 0  ? remainingChannels[0] : null);
        }

        // Reload channels
        loadChannels();
      } else {
        console.error('Error leaving channel:', data.error);
        alert(data.error);
      }
    } catch (error) {
      console.error('Error leaving channel:', error);
    }
  };

  const handleDeleteChannel = async (channelId: string) => {
    try {
      const response = await fetch(`${import.meta.env.VITE_WORKSPACE_API_URL}/api/workspace/channels/${channelId}`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({
          userId: user?.id
        })
      });

      const data = await response.json();
      
      if (data.success) {
        // If the deleted channel was active, switch to another channel
        if (activeChannel?.id === channelId) {
          const remainingChannels = channels.filter(c => c.id !== channelId);
          setActiveChannel(remainingChannels.length > 0 ? remainingChannels[0] : null);
        }

        // Reload channels
        loadChannels();
      } else {
        console.error('Error deleting channel:', data.error);
        alert(data.error);
      }
    } catch (error) {
      console.error('Error deleting channel:', error);
    }
  };

  const handleSummarizeChannel = async (channelId: string) => {
    if (!user) return;

    try {
      const response = await fetch(`${import.meta.env.VITE_WORKSPACE_API_URL}/api/workspace/summarize-channel`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({
          channelId,
          userId: user.id,
          timeframe: '24h'
        })
      });

      const data = await response.json();
      
      if (data.success) {
        // Add summary message to the channel
        await supabase
          .from('messages')
          .insert({
            channel_id: channelId,
            sender_id: user.id,
            content: `**Channel Summary (Last 24h)**\n\n${data.summary}`,
            type: 'ai_summary',
            metadata: { 
              summary: true,
              messageCount: data.messageCount,
              timeframe: data.timeframe
            }
          });

        // Reload messages if this is the active channel
        if (activeChannel?.id === channelId) {
          loadMessages(channelId);
        }
      } else {
        console.error('Error summarizing channel:', data.error);
        alert(data.error);
      }
    } catch (error) {
      console.error('Error summarizing channel:', error);
    }
  };

  const handleStartMeeting = (channelId: string, channelName: string) => {
    if (!user || !isGoogleConnected) {
      alert('You need to connect your Google account to start meetings.');
      return;
    }

    // Show the meeting modal
    setSelectedChannelForMeeting({id: channelId, name: channelName});
    setShowMeetingModal(true);
  };

  const handleCreateMeeting = async (channelId: string, title: string, description: string, startTime: string, duration: number) => {
    if (!user || !isGoogleConnected) {
      alert('You need to connect your Google account to start meetings.');
      return;
    }

    setIsCreatingMeeting(true);
    setShowMeetingModal(false);

    try {
      // Create a meeting using Google Meet
      const response = await meetingService.createMeeting(user.id, {
        title: title,
        description: description,
        startTime: startTime,
        duration: duration,
        channelId: channelId
      });

      if (response.success) {
        const meeting = response.meeting;
        const startTimeFormatted = new Date(meeting.startTime).toLocaleString([], {
          weekday: 'short',
          month: 'short',
          day: 'numeric',
          year: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
          hour12: false
        });
        
        const endTimeFormatted = new Date(meeting.endTime).toLocaleTimeString([], {
          hour: '2-digit',
          minute: '2-digit',
          hour12: false
        });
        
        // Post a message in the channel with the meeting link
        await supabase
          .from('messages')
          .insert({
            channel_id: channelId,
            sender_id: user.id,
            content: ` ${user.full_name} started a meeting: "${meeting.title}"\nStart Time: ${startTimeFormatted}\nEnd Time: ${endTimeFormatted}\nDuration: ${duration} minutes\n`,
            type: 'text',
            metadata: { 
              meeting: {
                id: meeting.id,
                url: meeting.url,
                title: meeting.title,
                startTime: meeting.startTime,
                endTime: meeting.endTime,
                duration: duration,
                organizer: user.full_name,
                status: 'active',
                participants: []
              }
            }
          });

        // Reload messages if this is the active channel
        if (activeChannel?.id === channelId) {
          loadMessages(channelId);
        }
      }
    } catch (error) {
      console.error('Error creating meeting:', error);
      alert('Failed to create meeting. Please try again.');
    } finally {
      setIsCreatingMeeting(false);
      setSelectedChannelForMeeting(null);
    }
  };

  const handleJoinMeeting = (url: string) => {
    window.open(url, '_blank');
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-primary flex items-center justify-center">
        <div className="glass-panel rounded-2xl p-8 max-w-md mx-auto text-center">
          <div className="animate-spin w-8 h-8 border-2 border-gold-text border-t-transparent rounded-full mx-auto mb-4"></div>
          <h3 className="text-xl font-bold text-primary mb-2">Loading Workspace...</h3>
          <p className="text-secondary">Setting up your collaborative environment</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen bg-primary flex flex-col overflow-hidden">
      {/* Header - Fixed */}
      <header className="glass-panel border-0 border-b silver-border flex-shrink-0">
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
                  Workspace
                </h1>
                <p className="text-xs text-secondary">
                  {activeChannel?.name || 'Select a channel'} • Media sharing enabled
                </p>
              </div>
            </div>
            
            <div className="flex items-center space-x-3">
              {/* Panel Toggle Buttons */}
              <div className="flex items-center space-x-1 glass-panel rounded-lg p-1">
                <button
                  onClick={() => setActivePanel('chat')}
                  className={`p-2 rounded-md transition-all ${
                    activePanel === 'chat' 
                      ? 'bg-gradient-gold-silver text-white' 
                      : 'text-secondary hover:text-primary'
                  }`}
                  title="Chat"
                >
                  <MessageSquare className="w-4 h-4" />
                </button>
                <button
                  onClick={() => setActivePanel('tasks')}
                  className={`p-2 rounded-md transition-all ${
                    activePanel === 'tasks' 
                      ? 'bg-gradient-gold-silver text-white' 
                      : 'text-secondary hover:text-primary'
                  }`}
                  title="Tasks"
                >
                  <CheckSquare className="w-4 h-4" />
                </button>
                <button
                  onClick={() => setActivePanel('kanban')}
                  className={`p-2 rounded-md transition-all ${
                    activePanel === 'kanban' 
                      ? 'bg-gradient-gold-silver text-white' 
                      : 'text-secondary hover:text-primary'
                  }`}
                  title="Kanban Board"
                >
                  <LayoutKanban className="w-4 h-4" />
                </button>
                <button
                  onClick={() => setActivePanel('calendar')}
                  className={`p-2 rounded-md transition-all ${
                    activePanel === 'calendar' 
                      ? 'bg-gradient-gold-silver text-white' 
                      : 'text-secondary hover:text-primary'
                  }`}
                  title="Calendar"
                >
                  <Calendar className="w-4 h-4" />
                </button>
                <button
                  onClick={() => setActivePanel('documents')}
                  className={`p-2 rounded-md transition-all ${
                    activePanel === 'documents' 
                      ? 'bg-gradient-gold-silver text-white' 
                      : 'text-secondary hover:text-primary'
                  }`}
                  title="Documents"
                >
                  <FileText className="w-4 h-4" />
                </button>
              </div>
              
              <ThemeToggle />
            </div>
          </div>
        </div>
      </header>

      {/* Main Content - Fixed height with internal scrolling */}
      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar - Fixed height with internal scrolling */}
        <div className="w-80 glass-panel border-r silver-border flex flex-col h-full">
          <ChannelList
            channels={channels}
            activeChannel={activeChannel}
            onChannelSelect={handleChannelSelect}
            onCreateChannel={handleCreateChannel}
            onJoinChannel={handleJoinChannel}
            onLeaveChannel={handleLeaveChannel}
            onDeleteChannel={handleDeleteChannel}
            onSummarizeChannel={handleSummarizeChannel}
            onStartMeeting={handleStartMeeting}
            onJoinMeeting={handleJoinMeeting}
          />
        </div>

        {/* Main Panel - Dynamic content with fixed positioning */}
        <div className="flex-1 flex flex-col h-full">
          {isCreatingMeeting && (
            <div className="absolute inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50">
              <div className="glass-panel rounded-lg p-6 text-center">
                <Loader2 className="w-8 h-8 animate-spin text-blue-500 mx-auto mb-4" />
                <p className="text-primary font-medium">Creating meeting...</p>
              </div>
            </div>
          )}
          
          <AnimatePresence mode="wait">
            {activePanel === 'chat' && (
              <motion.div 
                key="chat-panel"
                className="flex-1 flex flex-col h-full"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                transition={{ duration: 0.2 }}
              >
                <ChatPanel
                  channel={activeChannel}
                  messages={messages}
                  onSendMessage={handleSendMessage}
                  onEditMessage={handleEditMessage}
                  onDeleteMessage={handleDeleteMessage}
                />
              </motion.div>
            )}
            
            {activePanel === 'tasks' && (
              <motion.div 
                key="tasks-panel"
                className="flex-1 overflow-hidden"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                transition={{ duration: 0.2 }}
              >
                <TaskPanel
                  tasks={tasks}
                  onTaskUpdate={loadTasks}
                />
              </motion.div>
            )}
            
            {activePanel === 'kanban' && (
              <motion.div 
                key="kanban-panel"
                className="flex-1 overflow-hidden"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                transition={{ duration: 0.2 }}
              >
                <KanbanBoard
                  tasks={tasks}
                  onTaskUpdate={loadTasks}
                />
              </motion.div>
            )}
            
            {activePanel === 'calendar' && (
              <motion.div 
                key="calendar-panel"
                className="flex-1 overflow-hidden"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                transition={{ duration: 0.2 }}
              >
                <CalendarPanel
                  tasks={tasks}
                />
              </motion.div>
            )}
            
            {activePanel === 'documents' && (
              <motion.div 
                key="documents-panel"
                className="flex-1 overflow-hidden"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                transition={{ duration: 0.2 }}
              >
                <DocumentGenerationPanel />
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* Meeting Modal */}
      {showMeetingModal && selectedChannelForMeeting && (
        <CreateChannelMeetingModal
          channelId={selectedChannelForMeeting.id}
          channelName={selectedChannelForMeeting.name}
          onClose={() => {
            setShowMeetingModal(false);
            setSelectedChannelForMeeting(null);
          }}
          onCreateMeeting={handleCreateMeeting}
        />
      )}

      {/* Notification Manager */}
      <NotificationManager />
    </div>
  );
};

export default WorkspacePage;