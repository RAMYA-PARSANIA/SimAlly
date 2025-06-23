import React, { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import { ArrowLeft, Hash, Users, Plus, Settings, Calendar, CheckSquare, MessageSquare, Bell, Search, UserPlus } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { WorkspaceAPI, RealtimeManager, type Channel, type Message, type Task, type Profile } from '../lib/supabase';
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
  const [realtimeManager] = useState(new RealtimeManager());
  const [unreadCounts, setUnreadCounts] = useState<Map<string, number>>(new Map());
  const [onlineUsers, setOnlineUsers] = useState<Set<string>>(new Set());
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<Profile[]>([]);

  useEffect(() => {
    if (!user) {
      navigate('/');
      return;
    }
    
    initializeWorkspace();
    
    return () => {
      realtimeManager.unsubscribeAll();
    };
  }, [user, navigate]);

  useEffect(() => {
    if (activeChannel) {
      loadMessages(activeChannel.id);
      setupChannelSubscription(activeChannel.id);
    }
  }, [activeChannel]);

  const initializeWorkspace = async () => {
    try {
      await Promise.all([
        loadChannels(),
        loadTasks(),
        setupUserSubscriptions()
      ]);
    } catch (error) {
      console.error('Error initializing workspace:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadChannels = async () => {
    if (!user) return;
    
    try {
      const channelsData = await WorkspaceAPI.getChannelsForUser(user.id);
      setChannels(channelsData);
      
      // Set first channel as active if none selected
      if (channelsData.length > 0 && !activeChannel) {
        setActiveChannel(channelsData[0]);
      }
    } catch (error) {
      console.error('Error loading channels:', error);
    }
  };

  const loadMessages = async (channelId: string) => {
    try {
      const messagesData = await WorkspaceAPI.getChannelMessages(channelId);
      setMessages(messagesData);
      
      // Mark channel as read
      setUnreadCounts(prev => {
        const newCounts = new Map(prev);
        newCounts.set(channelId, 0);
        return newCounts;
      });
    } catch (error) {
      console.error('Error loading messages:', error);
    }
  };

  const loadTasks = async () => {
    if (!user) return;
    
    try {
      const tasksData = await WorkspaceAPI.getUserTasks(user.id);
      setTasks(tasksData);
    } catch (error) {
      console.error('Error loading tasks:', error);
    }
  };

  const setupChannelSubscription = (channelId: string) => {
    // Unsubscribe from previous channel
    realtimeManager.unsubscribe(`channel:${channelId}`);
    
    // Subscribe to new channel
    realtimeManager.subscribeToChannel(channelId, {
      onMessage: (message) => {
        setMessages(prev => [...prev, message]);
        
        // Update unread count if not current channel
        if (activeChannel?.id !== channelId) {
          setUnreadCounts(prev => {
            const newCounts = new Map(prev);
            const current = newCounts.get(channelId) || 0;
            newCounts.set(channelId, current + 1);
            return newCounts;
          });
        }
      },
      onMemberJoin: (member) => {
        console.log('Member joined:', member);
        // Reload channels to update member count
        loadChannels();
      },
      onMemberLeave: (member) => {
        console.log('Member left:', member);
        // Reload channels to update member count
        loadChannels();
      }
    });
  };

  const setupUserSubscriptions = () => {
    if (!user) return;
    
    // Subscribe to task updates
    realtimeManager.subscribeToTasks(user.id, {
      onTaskCreate: (task) => {
        setTasks(prev => [task, ...prev]);
      },
      onTaskUpdate: (task) => {
        setTasks(prev => prev.map(t => t.id === task.id ? task : t));
      },
      onTaskAssign: (assignment) => {
        console.log('Task assigned:', assignment);
        loadTasks(); // Reload to get full task data
      }
    });

    // Subscribe to channel updates
    realtimeManager.subscribeToUserChannels(user.id, {
      onChannelCreate: (channel) => {
        setChannels(prev => [...prev, channel]);
      },
      onChannelUpdate: (channel) => {
        setChannels(prev => prev.map(c => c.id === channel.id ? channel : c));
      }
    });
  };

  const handleBack = () => {
    navigate('/dashboard');
  };

  const handleSendMessage = async (content: string, mentions: string[] = []) => {
    if (!activeChannel || !user) return;

    try {
      // Send message to database (will trigger real-time update)
      const message = await WorkspaceAPI.sendMessage(
        activeChannel.id,
        user.id,
        content,
        'text',
        { mentions }
      );

      // Process with AI for task detection if mentions are present
      if (mentions.length > 0 || content.toLowerCase().includes('task') || content.toLowerCase().includes('todo')) {
        await processMessageForTasks(message, mentions);
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
        // Task will be added via real-time subscription
        
        // Add AI confirmation message
        await WorkspaceAPI.sendMessage(
          activeChannel?.id || '',
          user?.id || '',
          `✅ Task created: "${data.task.title}"${data.task.assignee ? ` assigned to ${data.task.assignee}` : ''}`,
          'ai_task_creation',
          { task_id: data.task.id }
        );
      }
    } catch (error) {
      console.error('Error processing message for tasks:', error);
    }
  };

  const handleCreateChannel = async (name: string, description: string, type: 'public' | 'private') => {
    if (!user) return;

    try {
      const channel = await WorkspaceAPI.createChannel(name, description, type, user.id);
      // Channel will be added via real-time subscription
      setActiveChannel(channel);
    } catch (error) {
      console.error('Error creating channel:', error);
    }
  };

  const handleChannelSelect = (channel: Channel) => {
    setActiveChannel(channel);
    setActivePanel('chat'); // Switch to chat when selecting a channel
  };

  const handleTaskUpdate = () => {
    loadTasks();
  };

  const handleSearchUsers = async (query: string) => {
    setSearchQuery(query);
    if (query.trim().length < 2) {
      setSearchResults([]);
      return;
    }

    try {
      const results = await WorkspaceAPI.searchUsers(query);
      setSearchResults(results);
    } catch (error) {
      console.error('Error searching users:', error);
    }
  };

  const handleInviteUser = async (userId: string) => {
    if (!activeChannel) return;

    try {
      await WorkspaceAPI.joinChannel(activeChannel.id, userId);
      setShowInviteModal(false);
      setSearchQuery('');
      setSearchResults([]);
      
      // Send system message
      await WorkspaceAPI.sendMessage(
        activeChannel.id,
        user?.id || '',
        `User invited to the channel`,
        'system'
      );
    } catch (error) {
      console.error('Error inviting user:', error);
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
              <div className="flex items-center space-x-3">
                <div>
                  <h1 className="text-lg font-bold gradient-gold-silver">
                    Workspace
                  </h1>
                  <p className="text-xs text-secondary">
                    {activeChannel?.name || 'Select a channel'} • {channels.length} channels
                  </p>
                </div>
                
                {/* Online indicator */}
                <div className="flex items-center space-x-2">
                  <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                  <span className="text-xs text-secondary">
                    {onlineUsers.size} online
                  </span>
                </div>
              </div>
            </div>
            
            <div className="flex items-center space-x-3">
              {/* Notifications */}
              <button className="glass-panel p-2 rounded-lg glass-panel-hover relative">
                <Bell className="w-4 h-4 text-secondary" />
                {Array.from(unreadCounts.values()).reduce((a, b) => a + b, 0) > 0 && (
                  <div className="absolute -top-1 -right-1 w-3 h-3 bg-red-500 rounded-full flex items-center justify-center">
                    <span className="text-xs text-white font-bold">
                      {Math.min(Array.from(unreadCounts.values()).reduce((a, b) => a + b, 0), 9)}
                    </span>
                  </div>
                )}
              </button>

              {/* Invite Users */}
              {activeChannel && (
                <Button
                  onClick={() => setShowInviteModal(true)}
                  variant="secondary"
                  size="sm"
                  className="flex items-center space-x-2"
                >
                  <UserPlus className="w-4 h-4" />
                  <span>Invite</span>
                </Button>
              )}

              {/* Panel Toggle Buttons */}
              <div className="flex items-center space-x-1 glass-panel rounded-lg p-1">
                <button
                  onClick={() => setActivePanel('chat')}
                  className={`p-2 rounded-md transition-all relative ${
                    activePanel === 'chat' 
                      ? 'bg-gradient-gold-silver text-white' 
                      : 'text-secondary hover:text-primary'
                  }`}
                >
                  <MessageSquare className="w-4 h-4" />
                  {Array.from(unreadCounts.values()).reduce((a, b) => a + b, 0) > 0 && activePanel !== 'chat' && (
                    <div className="absolute -top-1 -right-1 w-2 h-2 bg-red-500 rounded-full"></div>
                  )}
                </button>
                <button
                  onClick={() => setActivePanel('tasks')}
                  className={`p-2 rounded-md transition-all relative ${
                    activePanel === 'tasks' 
                      ? 'bg-gradient-gold-silver text-white' 
                      : 'text-secondary hover:text-primary'
                  }`}
                >
                  <CheckSquare className="w-4 h-4" />
                  {tasks.filter(t => t.status === 'todo').length > 0 && activePanel !== 'tasks' && (
                    <div className="absolute -top-1 -right-1 w-2 h-2 bg-blue-500 rounded-full"></div>
                  )}
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
            channels={channels.map(channel => ({
              ...channel,
              unread_count: unreadCounts.get(channel.id) || 0
            }))}
            activeChannel={activeChannel}
            onChannelSelect={handleChannelSelect}
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
              onTaskUpdate={handleTaskUpdate}
            />
          )}
          
          {activePanel === 'calendar' && (
            <CalendarPanel
              tasks={tasks}
            />
          )}
        </div>
      </div>

      {/* Invite Users Modal */}
      {showInviteModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="w-full max-w-md"
          >
            <GlassCard className="p-6" goldBorder>
              <div className="flex justify-between items-center mb-6">
                <h3 className="text-xl font-bold gradient-gold-silver">
                  Invite Users to #{activeChannel?.name}
                </h3>
                <button
                  onClick={() => setShowInviteModal(false)}
                  className="text-secondary hover:text-primary"
                >
                  ×
                </button>
              </div>
              
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-primary mb-2">
                    Search Users
                  </label>
                  <div className="relative">
                    <Search className="absolute left-3 top-3 w-4 h-4 text-secondary" />
                    <input
                      type="text"
                      value={searchQuery}
                      onChange={(e) => handleSearchUsers(e.target.value)}
                      placeholder="Search by username or name..."
                      className="w-full pl-9 pr-4 py-3 glass-panel rounded-lg text-primary placeholder-secondary focus:outline-none focus:ring-2 focus:ring-yellow-500"
                    />
                  </div>
                </div>

                {/* Search Results */}
                {searchResults.length > 0 && (
                  <div className="space-y-2 max-h-48 overflow-y-auto">
                    {searchResults.map((user) => (
                      <div
                        key={user.id}
                        className="flex items-center justify-between p-3 glass-panel rounded-lg"
                      >
                        <div className="flex items-center space-x-3">
                          <div className="w-8 h-8 rounded-full bg-gradient-gold-silver flex items-center justify-center">
                            <span className="text-white text-sm font-bold">
                              {user.full_name.charAt(0).toUpperCase()}
                            </span>
                          </div>
                          <div>
                            <div className="font-medium text-primary">{user.full_name}</div>
                            <div className="text-xs text-secondary">@{user.username}</div>
                          </div>
                        </div>
                        <Button
                          onClick={() => handleInviteUser(user.id)}
                          variant="secondary"
                          size="sm"
                        >
                          Invite
                        </Button>
                      </div>
                    ))}
                  </div>
                )}

                {searchQuery.length >= 2 && searchResults.length === 0 && (
                  <div className="text-center py-4 text-secondary">
                    No users found matching "{searchQuery}"
                  </div>
                )}

                {searchQuery.length < 2 && (
                  <div className="text-center py-4 text-secondary text-sm">
                    Type at least 2 characters to search for users
                  </div>
                )}
              </div>
            </GlassCard>
          </motion.div>
        </div>
      )}
    </div>
  );
};

export default WorkspacePage;