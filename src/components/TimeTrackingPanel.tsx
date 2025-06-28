import React, { useState, useEffect } from 'react';
import { Play, Pause, Square, Clock, Calendar, DollarSign, BarChart3, Plus, Filter, Download } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import GlassCard from './ui/GlassCard';
import Button from './ui/Button';

interface TimeEntry {
  id: string;
  task_id: string;
  project_id: string;
  description: string;
  start_time: string;
  end_time: string | null;
  duration_minutes: number | null;
  billable: boolean;
  hourly_rate: number;
  task?: { title: string };
  project?: { name: string };
}

interface Project {
  id: string;
  name: string;
}

interface Task {
  id: string;
  title: string;
  project_id: string;
}

const TimeTrackingPanel: React.FC = () => {
  const { user } = useAuth();
  const [timeEntries, setTimeEntries] = useState<TimeEntry[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [activeTimer, setActiveTimer] = useState<TimeEntry | null>(null);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [selectedProject, setSelectedProject] = useState<string>('');
  const [selectedTask, setSelectedTask] = useState<string>('');
  const [description, setDescription] = useState('');
  const [hourlyRate, setHourlyRate] = useState<number>(75);
  const [billable, setBillable] = useState(true);
  const [filter, setFilter] = useState<'all' | 'today' | 'week' | 'month'>('today');

  useEffect(() => {
    if (user) {
      loadTimeEntries();
      loadProjects();
      loadTasks();
      checkActiveTimer();
    }
  }, [user, filter]);

  const loadTimeEntries = async () => {
    if (!user) return;

    try {
      let query = supabase
        .from('time_tracking')
        .select(`
          *,
          task:tasks(title),
          project:projects(name)
        `)
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
        return;
      }

      setTimeEntries(data || []);
    } catch (error) {
      console.error('Error loading time entries:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadProjects = async () => {
    try {
      const { data, error } = await supabase
        .from('projects')
        .select('id, name')
        .eq('status', 'active')
        .order('name');

      if (error) {
        console.error('Error loading projects:', error);
        return;
      }

      setProjects(data || []);
    } catch (error) {
      console.error('Error loading projects:', error);
    }
  };

  const loadTasks = async () => {
    try {
      const { data, error } = await supabase
        .from('tasks')
        .select('id, title, project_id')
        .in('status', ['todo', 'in_progress'])
        .order('title');

      if (error) {
        console.error('Error loading tasks:', error);
        return;
      }

      setTasks(data || []);
    } catch (error) {
      console.error('Error loading tasks:', error);
    }
  };

  const checkActiveTimer = async () => {
    if (!user) return;

    try {
      const { data, error } = await supabase
        .from('time_tracking')
        .select('*')
        .eq('user_id', user.id)
        .is('end_time', null)
        .single();

      if (error && error.code !== 'PGRST116') {
        console.error('Error checking active timer:', error);
        return;
      }

      setActiveTimer(data || null);
    } catch (error) {
      console.error('Error checking active timer:', error);
    }
  };

  const startTimer = async () => {
    if (!user || !description.trim()) return;

    try {
      const { data, error } = await supabase
        .from('time_tracking')
        .insert({
          user_id: user.id,
          task_id: selectedTask || null,
          project_id: selectedProject || null,
          description: description.trim(),
          start_time: new Date().toISOString(),
          billable,
          hourly_rate: hourlyRate
        })
        .select()
        .single();

      if (error) {
        console.error('Error starting timer:', error);
        return;
      }

      setActiveTimer(data);
      setShowCreateModal(false);
      setDescription('');
      setSelectedTask('');
      setSelectedProject('');
    } catch (error) {
      console.error('Error starting timer:', error);
    }
  };

  const stopTimer = async () => {
    if (!activeTimer) return;

    try {
      const endTime = new Date();
      const startTime = new Date(activeTimer.start_time);
      const durationMinutes = Math.round((endTime.getTime() - startTime.getTime()) / (1000 * 60));

      const { error } = await supabase
        .from('time_tracking')
        .update({
          end_time: endTime.toISOString(),
          duration_minutes: durationMinutes
        })
        .eq('id', activeTimer.id);

      if (error) {
        console.error('Error stopping timer:', error);
        return;
      }

      setActiveTimer(null);
      loadTimeEntries();
    } catch (error) {
      console.error('Error stopping timer:', error);
    }
  };

  const deleteTimeEntry = async (entryId: string) => {
    if (!confirm('Are you sure you want to delete this time entry?')) return;

    try {
      const { error } = await supabase
        .from('time_tracking')
        .delete()
        .eq('id', entryId);

      if (error) {
        console.error('Error deleting time entry:', error);
        return;
      }

      loadTimeEntries();
    } catch (error) {
      console.error('Error deleting time entry:', error);
    }
  };

  const formatDuration = (minutes: number | null) => {
    if (!minutes) return '0:00';
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return `${hours}:${mins.toString().padStart(2, '0')}`;
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
      ['Date', 'Project', 'Task', 'Description', 'Duration', 'Billable', 'Rate', 'Amount'].join(','),
      ...timeEntries.map(entry => [
        new Date(entry.start_time).toLocaleDateString(),
        entry.project?.name || 'No Project',
        entry.task?.title || 'No Task',
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

  const filteredTasks = tasks.filter(task => 
    !selectedProject || task.project_id === selectedProject
  );

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
                <BarChart3 className="w-5 h-5 text-white" />
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
      </div>

      {/* Active Timer */}
      {activeTimer && (
        <div className="glass-panel border-b silver-border p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <div className="w-3 h-3 bg-green-500 rounded-full animate-pulse"></div>
              <div>
                <p className="font-medium text-primary">{activeTimer.description}</p>
                <p className="text-sm text-secondary">
                  Started at {new Date(activeTimer.start_time).toLocaleTimeString()}
                </p>
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
                        {entry.project && (
                          <span>Project: {entry.project.name}</span>
                        )}
                        {entry.task && (
                          <span>Task: {entry.task.title}</span>
                        )}
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
                          Delete
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
                      Description
                    </label>
                    <input
                      type="text"
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                      placeholder="What are you working on?"
                      className="w-full glass-panel rounded-lg px-4 py-3 text-primary placeholder-secondary focus:outline-none focus:ring-2 focus:ring-yellow-500"
                      autoFocus
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-primary mb-2">
                      Project (Optional)
                    </label>
                    <select
                      value={selectedProject}
                      onChange={(e) => setSelectedProject(e.target.value)}
                      className="w-full glass-panel rounded-lg px-4 py-3 text-primary focus:outline-none focus:ring-2 focus:ring-yellow-500"
                    >
                      <option value="">Select a project</option>
                      {projects.map((project) => (
                        <option key={project.id} value={project.id}>
                          {project.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-primary mb-2">
                      Task (Optional)
                    </label>
                    <select
                      value={selectedTask}
                      onChange={(e) => setSelectedTask(e.target.value)}
                      className="w-full glass-panel rounded-lg px-4 py-3 text-primary focus:outline-none focus:ring-2 focus:ring-yellow-500"
                      disabled={!selectedProject}
                    >
                      <option value="">Select a task</option>
                      {filteredTasks.map((task) => (
                        <option key={task.id} value={task.id}>
                          {task.title}
                        </option>
                      ))}
                    </select>
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
                    disabled={!description.trim()}
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