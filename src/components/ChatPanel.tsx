import React, { useState, useRef, useEffect } from 'react';
import { Send, Bot, User, Hash, AtSign } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '../contexts/AuthContext';
import { type Channel, type Message } from '../lib/supabase';
import Button from './ui/Button';

interface ChatPanelProps {
  channel: Channel | null;
  messages: Message[];
  onSendMessage: (content: string, mentions?: string[]) => void;
}

const ChatPanel: React.FC<ChatPanelProps> = ({ channel, messages, onSendMessage }) => {
  const { user } = useAuth();
  const [messageInput, setMessageInput] = useState('');
  const [mentions, setMentions] = useState<string[]>([]);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSendMessage = () => {
    if (!messageInput.trim() || !channel) return;

    onSendMessage(messageInput.trim(), mentions);
    setMessageInput('');
    setMentions([]);
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const formatTime = (timestamp: string) => {
    return new Date(timestamp).toLocaleTimeString([], { 
      hour: '2-digit', 
      minute: '2-digit' 
    });
  };

  const getMessageIcon = (message: Message) => {
    switch (message.type) {
      case 'ai_task_creation':
      case 'ai_summary':
        return <Bot className="w-4 h-4 text-blue-500" />;
      case 'system':
        return <Hash className="w-4 h-4 text-gray-500" />;
      default:
        return <User className="w-4 h-4 text-primary" />;
    }
  };

  const getMessageStyle = (message: Message) => {
    switch (message.type) {
      case 'ai_task_creation':
        return 'bg-blue-500/10 border-blue-500/30';
      case 'ai_summary':
        return 'bg-purple-500/10 border-purple-500/30';
      case 'system':
        return 'bg-gray-500/10 border-gray-500/30';
      default:
        return message.sender_id === user?.id 
          ? 'bg-gradient-to-r from-blue-500/10 to-purple-500/10 border-blue-500/30'
          : 'border-gold-border';
    }
  };

  if (!channel) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="text-center">
          <Hash className="w-16 h-16 text-secondary mx-auto mb-4 opacity-50" />
          <h3 className="text-xl font-bold text-primary mb-2">Welcome to Workspace</h3>
          <p className="text-secondary">Select a channel to start chatting</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col">
      {/* Channel Header */}
      <div className="glass-panel border-b silver-border p-4">
        <div className="flex items-center space-x-3">
          <div className="w-8 h-8 rounded-lg bg-gradient-gold-silver flex items-center justify-center">
            <Hash className="w-4 h-4 text-white" />
          </div>
          <div>
            <h2 className="font-bold text-primary">{channel.name}</h2>
            {channel.description && (
              <p className="text-sm text-secondary">{channel.description}</p>
            )}
          </div>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        <AnimatePresence>
          {messages.map((message) => (
            <motion.div
              key={message.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className={`flex items-start space-x-3 ${
                message.sender_id === user?.id ? 'flex-row-reverse space-x-reverse' : ''
              }`}
            >
              {/* Avatar */}
              <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${
                message.type === 'ai_task_creation' || message.type === 'ai_summary'
                  ? 'bg-gradient-to-r from-blue-500 to-purple-500'
                  : message.sender_id === user?.id
                  ? 'bg-gradient-to-r from-blue-500 to-purple-500'
                  : 'bg-gradient-gold-silver'
              }`}>
                {getMessageIcon(message)}
              </div>

              {/* Message */}
              <div className={`glass-panel rounded-2xl p-4 max-w-2xl ${getMessageStyle(message)}`}>
                {/* Sender info */}
                <div className="flex items-center space-x-2 mb-1">
                  <span className="font-medium text-primary text-sm">
                    {message.type === 'ai_task_creation' || message.type === 'ai_summary'
                      ? 'AI Assistant'
                      : message.sender?.full_name || 'Unknown User'}
                  </span>
                  <span className="text-xs text-secondary">
                    {formatTime(message.created_at)}
                  </span>
                </div>

                {/* Message content */}
                <p className="text-primary whitespace-pre-wrap">{message.content}</p>

                {/* Task metadata */}
                {message.type === 'ai_task_creation' && message.metadata?.task_id && (
                  <div className="mt-2 p-2 glass-panel rounded-lg bg-green-500/10 border-green-500/30">
                    <p className="text-green-400 text-xs font-medium">
                      ✓ Task created successfully
                    </p>
                  </div>
                )}
              </div>
            </motion.div>
          ))}
        </AnimatePresence>

        {messages.length === 0 && (
          <div className="text-center py-12">
            <Hash className="w-12 h-12 text-secondary mx-auto mb-4 opacity-50" />
            <h3 className="text-lg font-bold text-primary mb-2">Start the conversation</h3>
            <p className="text-secondary">
              Be the first to send a message in #{channel.name}
            </p>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Message Input */}
      <div className="glass-panel border-t silver-border p-4">
        <div className="flex items-end space-x-4">
          <div className="flex-1">
            <textarea
              ref={inputRef}
              value={messageInput}
              onChange={(e) => setMessageInput(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder={`Message #${channel.name}... (mention @users for tasks)`}
              className="w-full glass-panel rounded-xl px-4 py-3 text-primary placeholder-secondary focus:outline-none focus:ring-2 focus:ring-yellow-500 resize-none min-h-[50px] max-h-32"
              rows={1}
            />
            <div className="flex items-center justify-between mt-2">
              <div className="flex items-center space-x-2 text-xs text-secondary">
                <AtSign className="w-3 h-3" />
                <span>Use @username to assign tasks</span>
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
            disabled={!messageInput.trim()}
          >
            <Send className="w-4 h-4" />
          </Button>
        </div>
      </div>
    </div>
  );
};

export default ChatPanel;