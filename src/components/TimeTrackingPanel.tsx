import React, { useState, useEffect, useRef } from 'react';
import { Play, Pause, Square, Clock, Calendar, DollarSign, Plus, Filter, Download, Trash2 } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import GlassCard from './ui/GlassCard';
import Button from './ui/Button';

interface TimeEntry {
  id: string;
  user_id: string;
  task_name: string;
  description: string;
  start_time: string;
  end_time: string | null;
  duration_minutes: number | null;
  billable: boolean;
  hourly_rate: number;
  created_at: string;
}

const TimeTrackingPanel: React.FC = () => {
  const { user } = useAuth();
  const [timeEntries, setTimeEntries] = useState<TimeEntry[]>([]);
  const [activeTimer, setActiveTimer] = useState<TimeEntry | null>(null);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [taskName, setTaskName] = useState('');
  const [description, setDescription] = useState('');
  const [hourlyRate, setHourlyRate] = useState<number>(75);
  const [billable, setBillable] = useState(true);
  const [filter, setFilter] = useState<'all' | 'today' | 'week' | 'month'>('today');
  const [elapsedTime, setElapsedTime] = useState<number>(0);
  const [error, setError] = useState<string | null>(null);
  const timerIntervalRef = useRef<number | null>(null);

  useEffect(() => {
    if (user) {
      loadTimeEntries();
      checkActiveTimer();
    }
  }, [user, filter]);

  useEffect(() => {
    // Cleanup timer interval on unmount
    return () => {
      if (timerIntervalRef.current) {
        clearInterval(timerIntervalRef.current);
      }
    };
  }, []);

  const loadTimeEntries = async () => {
    if (!user) return;
    setError(null);

    try {
      let query = supabase
        .from('time_entries')
        .select('*')
        .eq('user_id', user.id)
        .order('start_time', { ascending: false });

      // Apply date filter
      const now = new Date();
      switch (filter) {
        case 'today':
          const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
          query = query.gte('start_time', today.toISOString());
          break;
        case 'week':
          const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
          query = query.gte('start_time', weekAgo.toISOString());
          break;
        case 'month':
          const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
          query = query.gte('start_time', monthAgo.toISOString());
          break;
      }

      const { data, error } = await query;

      if (error) {
        console.error('Error loading time entries:', error);
        setError('Failed to load time entries');
        return;
      }

      setTimeEntries(data || []);
    } catch (error) {
      console.error('Error loading time entries:', error);
      setError('Failed to load time entries');
    } finally {
      setLoading(false);
    }
  };

  const checkActiveTimer = async () => {
    if (!user) return;
    setError(null);

    try {
      const { data, error } = await supabase
        .from('time_entries')
        .select('*')
        .eq('user_id', user.id)
        .is('end_time', null)
        .single();

      if (error && error.code !== 'PGRST116') {
        console.error('Error checking active timer:', error);
        return;
      }

      if (data) {
        setActiveTimer(data);
        
        // Calculate elapsed time
        const startTime = new Date(data.start_time).getTime();
        const now = new Date().getTime();
        const elapsed = Math.floor((now - startTime) / 1000);
        setElapsedTime(elapsed);
        
        // Start timer to update elapsed time
        const interval = window.setInterval(() => {
          setElapsedTime(prev => prev + 1);
        }, 1000);
        
        timerIntervalRef.current = interval;
      }
    } catch (error) {
      console.error('Error checking active timer:', error);
    }
  };

  const startTimer = async () => {
    if (!user || !description.trim() || !taskName.trim()) return;
    setError(null);

    try {
      // Create the time entry with auth.uid() in RLS policy
      const { data, error } = await supabase
        .from('time_entries')
        .insert({
          user_id: user.id,
          task_name: taskName.trim(),
          description: description.trim(),
          start_time: new Date().toISOString(),
          billable,
          hourly_rate: hourlyRate
        })
        .select()
        .single();

      if (error) {
        console.error('Error starting timer:', error);
        setError(`Failed to start timer: ${error.message}`);
        return;
      }

      setActiveTimer(data);
      setShowCreateModal(false);
      setDescription('');
      setTaskName('');
      
      // Start timer to update elapsed time
      setElapsedTime(0);
      const interval = window.setInterval(() => {
        setElapsedTime(prev => prev + 1);
      }, 1000);
      
      timerIntervalRef.current = interval;
      
      // Reload time entries
      loadTimeEntries();
    } catch (error: any) {
      console.error('Error starting timer:', error);
      setError(`Failed to start timer: ${error.message}`);
    }
  };

  const stopTimer = async () => {
    if (!activeTimer) return;
    setError(null);

    try {
      const endTime = new Date();
      const startTime = new Date(activeTimer.start_time);
      const durationMinutes = Math.round((endTime.getTime() - startTime.getTime()) / (1000 * 60));

      const { error } = await supabase
        .from('time_entries')
        .update({
          end_time: endTime.toISOString(),
          duration_minutes: durationMinutes
        })
        .eq('id', activeTimer.id)
        .eq('user_id', user?.id); // Add user_id check for extra security

      if (error) {
        console.error('Error stopping timer:', error);
        setError(`Failed to stop timer: ${error.message}`);
        return;
      }

      setActiveTimer(null);
      
      // Clear timer interval
      if (timerIntervalRef.current) {
        clearInterval(timerIntervalRef.current);
        timerIntervalRef.current = null;
      }
      
      loadTimeEntries();
    } catch (error: any) {
      console.error('Error stopping timer:', error);
      setError(`Failed to stop timer: ${error.message}`);
    }
  };

  const deleteTimeEntry = async (entryId: string) => {
    if (!confirm('Are you sure you want to delete this time entry?')) return;
    setError(null);

    try {
      const { error } = await supabase
        .from('time_entries')
        .delete()
        .eq('id', entryId)
        .eq('user_id', user?.id); // Add user_id check for extra security

      if (error) {
        console.error('Error deleting time entry:', error);
        setError(`Failed to delete time entry: ${error.message}`);
        return;
      }

      loadTimeEntries();
    } catch (error: any) {
      console.error('Error deleting time entry:', error);
      setError(`Failed to delete time entry: ${error.message}`);
    }
  };

  const formatDuration = (minutes: number | null) => {
    if (!minutes) return '0:00';
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return `${hours}:${mins.toString().padStart(2, '0')}`;
  };

  const formatElapsedTime = (seconds: number) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
    }).format(amount);
  };

  const calculateTotalHours = () => {
    return timeEntries.reduce((total, entry) => total + (entry.duration_minutes || 0), 0) / 60;
  };

  const calculateTotalRevenue = () => {
    return timeEntries
      .filter(entry => entry.billable)
      .reduce((total, entry) => {
        const hours = (entry.duration_minutes || 0) / 60;
        return total + (hours * entry.hourly_rate);
      }, 0);
  };

  const exportTimesheet = () => {
    const csvContent = [
      ['Date', 'Task', 'Description', 'Duration', 'Billable', 'Rate', 'Amount'].join(','),
      ...timeEntries.map(entry => [
        new Date(entry.start_time).toLocaleDateString(),
        entry.task_name,
        entry.description,
        formatDuration(entry.duration_minutes),
        entry.billable ? 'Yes' : 'No',
        `$${entry.hourly_rate}`,
        entry.billable ? formatCurrency((entry.duration_minutes || 0) / 60 * entry.hourly_rate) : '$0.00'
      ].join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `timesheet-${filter}-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="animate-spin w-8 h-8 border-2 border-gold-text border-t-transparent rounded-full"></div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col h-full">
      {/* Header */}
      <div className="glass-panel border-b silver-border p-4 flex-shrink-0">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-bold gradient-gold-silver">Time Tracking</h2>
          <div className="flex items-center space-x-3">
            <select
              value={filter}
              onChange={(e) => setFilter(e.target.value as any)}
              className="glass-panel rounded-lg px-3 py-2 text-sm text-primary focus:outline-none focus:ring-2 focus:ring-yellow-500"
            >
              <option value="today">Today</option>
              <option value="week">This Week</option>
              <option value="month">This Month</option>
              <option value="all">All Time</option>
            </select>
            
            <Button
              onClick={exportTimesheet}
              variant="ghost"
              size="sm"
              className="flex items-center space-x-2"
            >
              <Download className="w-4 h-4" />
              <span>Export</span>
            </Button>
            
            <Button
              onClick={() => setShowCreateModal(true)}
              variant="premium"
              size="sm"
              className="flex items-center space-x-2"
              disabled={!!activeTimer}
            >
              <Plus className="w-4 h-4" />
              <span>Start Timer</span>
            </Button>
          </div>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <GlassCard className="p-4" hover>
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 rounded-lg bg-gradient-to-r from-blue-500 to-cyan-500 flex items-center justify-center">
                <Clock className="w-5 h-5 text-white" />
              </div>
              <div>
                <p className="text-sm text-secondary">Total Hours</p>
                <p className="text-xl font-bold text-primary">{calculateTotalHours().toFixed(1)}h</p>
              </div>
            </div>
          </GlassCard>

          <GlassCard className="p-4" hover>
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 rounded-lg bg-gradient-to-r from-green-500 to-emerald-500 flex items-center justify-center">
                <DollarSign className="w-5 h-5 text-white" />
              </div>
              <div>
                <p className="text-sm text-secondary">Total Revenue</p>
                <p className="text-xl font-bold text-primary">{formatCurrency(calculateTotalRevenue())}</p>
              </div>
            </div>
          </GlassCard>

          <GlassCard className="p-4" hover>
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 rounded-lg bg-gradient-to-r from-purple-500 to-pink-500 flex items-center justify-center">
                <DollarSign className="w-5 h-5 text-white" />
              </div>
              <div>
                <p className="text-sm text-secondary">Avg. Rate</p>
                <p className="text-xl font-bold text-primary">
                  {timeEntries.length > 0 
                    ? formatCurrency(timeEntries.reduce((sum, e) => sum + e.hourly_rate, 0) / timeEntries.length)
                    : '$0.00'
                  }
                </p>
              </div>
            </div>
          </GlassCard>
        </div>
        
        {/* Error message */}
        {error && (
          <div className="mt-4 p-3 glass-panel rounded-lg bg-red-500/10 border-red-500/30">
            <p className="text-red-400 text-sm">{error}</p>
          </div>
        )}
      </div>

      {/* Active Timer */}
      {activeTimer && (
        <div className="glass-panel border-b silver-border p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <div className="w-3 h-3 bg-green-500 rounded-full animate-pulse"></div>
              <div>
                <p className="font-medium text-primary">{activeTimer.description}</p>
                <div className="flex items-center space-x-4">
                  <p className="text-sm text-secondary">
                    Task: {activeTimer.task_name}
                  </p>
                  <p className="text-sm text-secondary">
                    Started at {new Date(activeTimer.start_time).toLocaleTimeString()}
                  </p>
                  <p className="text-sm font-bold text-primary">
                    {formatElapsedTime(elapsedTime)}
                  </p>
                </div>
              </div>
            </div>
            <Button
              onClick={stopTimer}
              variant="secondary"
              size="sm"
              className="flex items-center space-x-2 bg-red-500/20 border-red-500/50 hover:bg-red-500/30"
            >
              <Square className="w-4 h-4 text-red-400" />
              <span className="text-red-400">Stop</span>
            </Button>
          </div>
        </div>
      )}

      {/* Time Entries */}
      <div className="flex-1 overflow-y-auto p-4">
        <div className="space-y-4">
          <AnimatePresence>
            {timeEntries.map((entry) => (
              <motion.div
                key={entry.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
              >
                <GlassCard className="p-4 group" hover>
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <div className="flex items-center space-x-3 mb-2">
                        <h3 className="font-medium text-primary">{entry.description}</h3>
                        {entry.billable && (
                          <span className="px-2 py-1 bg-green-500/20 text-green-500 rounded-full text-xs font-medium">
                            Billable
                          </span>
                        )}
                      </div>
                      
                      <div className="flex items-center space-x-4 text-sm text-secondary">
                        <span>Task: {entry.task_name}</span>
                        <span>
                          {new Date(entry.start_time).toLocaleDateString()} • 
                          {new Date(entry.start_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          {entry.end_time && (
                            <> - {new Date(entry.end_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</>
                          )}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center space-x-4">
                      <div className="text-right">
                        <p className="font-bold text-primary">
                          {formatDuration(entry.duration_minutes)}
                        </p>
                        {entry.billable && (
                          <p className="text-sm text-green-500">
                            {formatCurrency((entry.duration_minutes || 0) / 60 * entry.hourly_rate)}
                          </p>
                        )}
                      </div>
                      
                      <div className="opacity-0 group-hover:opacity-100 transition-opacity">
                        <Button
                          onClick={() => deleteTimeEntry(entry.id)}
                          variant="ghost"
                          size="sm"
                          className="text-red-400 hover:text-red-300"
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  </div>
                </GlassCard>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>

        {timeEntries.length === 0 && (
          <div className="text-center py-12">
            <Clock className="w-12 h-12 text-secondary mx-auto mb-4 opacity-50" />
            <h3 className="text-lg font-bold text-primary mb-2">No time entries found</h3>
            <p className="text-secondary mb-4">Start tracking your time to see entries here</p>
            <Button
              onClick={() => setShowCreateModal(true)}
              variant="secondary"
              size="sm"
              disabled={!!activeTimer}
            >
              Start Timer
            </Button>
          </div>
        )}
      </div>

      {/* Create Timer Modal */}
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
                <h3 className="text-xl font-bold gradient-gold-silver mb-6">Start Time Tracking</h3>
                
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-primary mb-2">
                      Task Name <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={taskName}
                      onChange={(e) => setTaskName(e.target.value)}
                      placeholder="What task are you working on?"
                      className="w-full glass-panel rounded-lg px-4 py-3 text-primary placeholder-secondary focus:outline-none focus:ring-2 focus:ring-yellow-500"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-primary mb-2">
                      Description <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                      placeholder="What are you working on specifically?"
                      className="w-full glass-panel rounded-lg px-4 py-3 text-primary placeholder-secondary focus:outline-none focus:ring-2 focus:ring-yellow-500"
                      autoFocus
                      required
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-primary mb-2">
                        Hourly Rate
                      </label>
                      <input
                        type="number"
                        value={hourlyRate}
                        onChange={(e) => setHourlyRate(Number(e.target.value))}
                        className="w-full glass-panel rounded-lg px-4 py-3 text-primary focus:outline-none focus:ring-2 focus:ring-yellow-500"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-primary mb-2">
                        Billable
                      </label>
                      <label className="flex items-center space-x-2 cursor-pointer p-3 glass-panel rounded-lg">
                        <input
                          type="checkbox"
                          checked={billable}
                          onChange={(e) => setBillable(e.target.checked)}
                          className="text-yellow-500 focus:ring-yellow-500"
                        />
                        <span className="text-primary">Billable time</span>
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
                    onClick={startTimer}
                    variant="premium"
                    className="flex-1 flex items-center justify-center space-x-2"
                    disabled={!description.trim() || !taskName.trim()}
                  >
                    <Play className="w-4 h-4" />
                    <span>Start Timer</span>
                  </Button>
                </div>
              </GlassCard>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default TimeTrackingPanel;