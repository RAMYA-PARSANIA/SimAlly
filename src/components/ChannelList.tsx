import React, { useState } from 'react';
import { Hash, Lock, Plus, Users, Search } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { type Channel } from '../lib/supabase';
import GlassCard from './ui/GlassCard';
import Button from './ui/Button';

interface ChannelListProps {
  channels: Channel[];
  activeChannel: Channel | null;
  onChannelSelect: (channel: Channel) => void;
  onCreateChannel: (name: string, description: string, type: 'public' | 'private') => void;
}

const ChannelList: React.FC<ChannelListProps> = ({
  channels,
  activeChannel,
  onChannelSelect,
  onCreateChannel
}) => {
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [newChannel, setNewChannel] = useState({
    name: '',
    description: '',
    type: 'public' as 'public' | 'private'
  });

  const filteredChannels = channels.filter(channel =>
    channel.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const publicChannels = filteredChannels.filter(c => c.type === 'public');
  const privateChannels = filteredChannels.filter(c => c.type === 'private');
  const dmChannels = filteredChannels.filter(c => c.type === 'dm');

  const handleCreateChannel = () => {
    if (!newChannel.name.trim()) return;
    
    onCreateChannel(newChannel.name, newChannel.description, newChannel.type);
    setNewChannel({ name: '', description: '', type: 'public' });
    setShowCreateModal(false);
  };

  const getChannelIcon = (channel: Channel) => {
    switch (channel.type) {
      case 'private':
        return <Lock className="w-4 h-4" />;
      case 'dm':
        return <Users className="w-4 h-4" />;
      default:
        return <Hash className="w-4 h-4" />;
    }
  };

  return (
    <>
      <div className="p-4 border-b silver-border">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-bold text-primary">Channels</h2>
          <Button
            onClick={() => setShowCreateModal(true)}
            variant="ghost"
            size="sm"
            className="p-2"
          >
            <Plus className="w-4 h-4" />
          </Button>
        </div>
        
        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-3 w-4 h-4 text-secondary" />
          <input
            type="text"
            placeholder="Search channels..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-4 py-2 glass-panel rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-yellow-500 text-primary placeholder-secondary"
          />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-6">
        {/* Public Channels */}
        {publicChannels.length > 0 && (
          <div>
            <h3 className="text-xs font-semibold text-secondary uppercase tracking-wider mb-2">
              Public Channels
            </h3>
            <div className="space-y-1">
              {publicChannels.map((channel) => (
                <motion.button
                  key={channel.id}
                  onClick={() => onChannelSelect(channel)}
                  className={`w-full flex items-center space-x-3 p-3 rounded-lg text-left transition-all ${
                    activeChannel?.id === channel.id
                      ? 'bg-gradient-gold-silver text-white'
                      : 'text-secondary hover:text-primary hover:bg-surface'
                  }`}
                  whileHover={{ x: 4 }}
                  whileTap={{ scale: 0.98 }}
                >
                  {getChannelIcon(channel)}
                  <div className="flex-1 min-w-0">
                    <div className="font-medium truncate">{channel.name}</div>
                    {channel.description && (
                      <div className="text-xs opacity-75 truncate">
                        {channel.description}
                      </div>
                    )}
                  </div>
                </motion.button>
              ))}
            </div>
          </div>
        )}

        {/* Private Channels */}
        {privateChannels.length > 0 && (
          <div>
            <h3 className="text-xs font-semibold text-secondary uppercase tracking-wider mb-2">
              Private Channels
            </h3>
            <div className="space-y-1">
              {privateChannels.map((channel) => (
                <motion.button
                  key={channel.id}
                  onClick={() => onChannelSelect(channel)}
                  className={`w-full flex items-center space-x-3 p-3 rounded-lg text-left transition-all ${
                    activeChannel?.id === channel.id
                      ? 'bg-gradient-gold-silver text-white'
                      : 'text-secondary hover:text-primary hover:bg-surface'
                  }`}
                  whileHover={{ x: 4 }}
                  whileTap={{ scale: 0.98 }}
                >
                  {getChannelIcon(channel)}
                  <div className="flex-1 min-w-0">
                    <div className="font-medium truncate">{channel.name}</div>
                    {channel.description && (
                      <div className="text-xs opacity-75 truncate">
                        {channel.description}
                      </div>
                    )}
                  </div>
                </motion.button>
              ))}
            </div>
          </div>
        )}

        {/* Direct Messages */}
        {dmChannels.length > 0 && (
          <div>
            <h3 className="text-xs font-semibold text-secondary uppercase tracking-wider mb-2">
              Direct Messages
            </h3>
            <div className="space-y-1">
              {dmChannels.map((channel) => (
                <motion.button
                  key={channel.id}
                  onClick={() => onChannelSelect(channel)}
                  className={`w-full flex items-center space-x-3 p-3 rounded-lg text-left transition-all ${
                    activeChannel?.id === channel.id
                      ? 'bg-gradient-gold-silver text-white'
                      : 'text-secondary hover:text-primary hover:bg-surface'
                  }`}
                  whileHover={{ x: 4 }}
                  whileTap={{ scale: 0.98 }}
                >
                  {getChannelIcon(channel)}
                  <div className="flex-1 min-w-0">
                    <div className="font-medium truncate">{channel.name}</div>
                  </div>
                </motion.button>
              ))}
            </div>
          </div>
        )}

        {filteredChannels.length === 0 && (
          <div className="text-center py-8">
            <Hash className="w-8 h-8 text-secondary mx-auto mb-2 opacity-50" />
            <p className="text-secondary text-sm">
              {searchTerm ? 'No channels found' : 'No channels yet'}
            </p>
          </div>
        )}
      </div>

      {/* Create Channel Modal */}
      <AnimatePresence>
        {showCreateModal && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="w-full max-w-md"
            >
              <GlassCard className="p-6" goldBorder>
                <h3 className="text-xl font-bold gradient-gold-silver mb-6">
                  Create Channel
                </h3>
                
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-primary mb-2">
                      Channel Name
                    </label>
                    <input
                      type="text"
                      value={newChannel.name}
                      onChange={(e) => setNewChannel(prev => ({ ...prev, name: e.target.value }))}
                      placeholder="e.g., project-alpha"
                      className="w-full glass-panel rounded-lg px-4 py-3 text-primary placeholder-secondary focus:outline-none focus:ring-2 focus:ring-yellow-500"
                      autoFocus
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-primary mb-2">
                      Description (Optional)
                    </label>
                    <textarea
                      value={newChannel.description}
                      onChange={(e) => setNewChannel(prev => ({ ...prev, description: e.target.value }))}
                      placeholder="What's this channel about?"
                      className="w-full glass-panel rounded-lg px-4 py-3 text-primary placeholder-secondary focus:outline-none focus:ring-2 focus:ring-yellow-500 resize-none"
                      rows={3}
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-primary mb-2">
                      Channel Type
                    </label>
                    <div className="space-y-2">
                      <label className="flex items-center space-x-3 cursor-pointer">
                        <input
                          type="radio"
                          name="channelType"
                          value="public"
                          checked={newChannel.type === 'public'}
                          onChange={(e) => setNewChannel(prev => ({ ...prev, type: e.target.value as 'public' | 'private' }))}
                          className="text-yellow-500 focus:ring-yellow-500"
                        />
                        <div>
                          <div className="font-medium text-primary">Public</div>
                          <div className="text-xs text-secondary">Anyone can join</div>
                        </div>
                      </label>
                      <label className="flex items-center space-x-3 cursor-pointer">
                        <input
                          type="radio"
                          name="channelType"
                          value="private"
                          checked={newChannel.type === 'private'}
                          onChange={(e) => setNewChannel(prev => ({ ...prev, type: e.target.value as 'public' | 'private' }))}
                          className="text-yellow-500 focus:ring-yellow-500"
                        />
                        <div>
                          <div className="font-medium text-primary">Private</div>
                          <div className="text-xs text-secondary">Invite only</div>
                        </div>
                      </label>
                    </div>
                  </div>
                </div>

                <div className="flex space-x-4 mt-6">
                  <Button
                    onClick={() => setShowCreateModal(false)}
                    variant="secondary"
                    className="flex-1"
                  >
                    Cancel
                  </Button>
                  <Button
                    onClick={handleCreateChannel}
                    variant="premium"
                    className="flex-1"
                    disabled={!newChannel.name.trim()}
                  >
                    Create
                  </Button>
                </div>
              </GlassCard>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </>
  );
};

export default ChannelList;