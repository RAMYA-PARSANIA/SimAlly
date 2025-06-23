import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { ArrowLeft, Hash, Users, Plus, Settings, Calendar, CheckSquare, MessageSquare, Upload, Paperclip } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { supabase, workspaceAPI, type Channel, type Message, type Task } from '../lib/supabase';
import ThemeToggle from '../components/ThemeToggle';
import ChatPanel from '../components/ChatPanel';
import ChannelList from '../components/ChannelList';
import TaskPanel from '../components/TaskPanel';
import CalendarPanel from '../components/CalendarPanel';
import GlassCard from '../components/ui/GlassCard';
import Button from '../components/ui/Button';

const WorkspacePage: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [channels, setChannels] = useState<Channel[]>([]);
  const [activeChannel, setActiveChannel] = useState<Channel | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [activePanel, setActivePanel] = useState<'chat' | 'tasks' | 'calendar'>('chat');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) {
      navigate('/');
      return;
    }
    
    loadChannels();
    loadTasks();
  }, [user, navigate]);

  useEffect(() => {
    if (activeChannel) {
      loadMessages(activeChannel.id);
      
      // Subscribe to real-time messages for this channel
      const subscription = workspaceAPI.subscribeToChannel(activeChannel.id, (payload) => {
        console.log('Real-time message update:', payload);
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
      console.log('Real-time task update:', payload);
      loadTasks();
    });

    // Subscribe to real-time channel updates
    const channelSubscription = workspaceAPI.subscribeToChannels(user.id, (payload) => {
      console.log('Real-time channel update:', payload);
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
      const channelData = await workspaceAPI.getChannelsForUser(user.id);
      setChannels(channelData);
      
      // Set first channel as active if none selected
      if (channelData.length > 0 && !activeChannel) {
        setActiveChannel(channelData[0]);
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

  const processMessageForTasks = async (message: Message, mentions: string[]) => {
    try {
      const response = await fetch('http://localhost:8001/api/chat/process-message', {
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

  const handleCreateChannel = async (name: string, description: string, type: 'public' | 'private') => {
    if (!user) return;

    try {
      const { data, error } = await supabase
        .from('channels')
        .insert({
          name,
          description,
          type,
          created_by: user.id
        })
        .select()
        .single();

      if (error) {
        console.error('Error creating channel:', error);
        return;
      }

      // Add creator as admin member
      await supabase
        .from('channel_members')
        .insert({
          channel_id: data.id,
          user_id: user.id,
          role: 'admin'
        });

      // Reload channels
      loadChannels();
    } catch (error) {
      console.error('Error creating channel:', error);
    }
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
    <div className="min-h-screen bg-primary flex flex-col">
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
                >
                  <CheckSquare className="w-4 h-4" />
                </button>
                <button
                  onClick={() => setActivePanel('calendar')}
                  className={`p-2 rounded-md transition-all ${
                    activePanel === 'calendar' 
                      ? 'bg-gradient-gold-silver text-white' 
                      : 'text-secondary hover:text-primary'
                  }`}
                >
                  <Calendar className="w-4 h-4" />
                </button>
              </div>
              
              <ThemeToggle />
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <div className="flex-1 flex overflow-hidden">
        {/* Sidebar */}
        <div className="w-80 glass-panel border-r silver-border flex flex-col">
          <ChannelList
            channels={channels}
            activeChannel={activeChannel}
            onChannelSelect={setActiveChannel}
            onCreateChannel={handleCreateChannel}
          />
        </div>

        {/* Main Panel */}
        <div className="flex-1 flex flex-col">
          {activePanel === 'chat' && (
            <ChatPanel
              channel={activeChannel}
              messages={messages}
              onSendMessage={handleSendMessage}
            />
          )}
          
          {activePanel === 'tasks' && (
            <TaskPanel
              tasks={tasks}
              onTaskUpdate={loadTasks}
            />
          )}
          
          {activePanel === 'calendar' && (
            <CalendarPanel
              tasks={tasks}
            />
          )}
        </div>
      </div>
    </div>
  );
};

export default WorkspacePage;