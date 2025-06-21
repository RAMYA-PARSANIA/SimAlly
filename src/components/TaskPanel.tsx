import React, { useState } from 'react';
import { CheckSquare, Clock, User, Plus, Filter, Calendar } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '../contexts/AuthContext';
import { supabase, type Task } from '../lib/supabase';
import GlassCard from './ui/GlassCard';
import Button from './ui/Button';

interface TaskPanelProps {
  tasks: Task[];
  onTaskUpdate: () => void;
}

const TaskPanel: React.FC<TaskPanelProps> = ({ tasks, onTaskUpdate }) => {
  const { user } = useAuth();
  const [filter, setFilter] = useState<'all' | 'assigned' | 'created'>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | 'todo' | 'in_progress' | 'completed'>('all');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newTask, setNewTask] = useState({
    title: '',
    description: '',
    priority: 'medium' as 'low' | 'medium' | 'high' | 'urgent',
    due_date: ''
  });

  const filteredTasks = tasks.filter(task => {
    // Filter by ownership
    if (filter === 'assigned') {
      const isAssigned = task.assignments?.some(a => a.user_id === user?.id);
      if (!isAssigned) return false;
    } else if (filter === 'created') {
      if (task.created_by !== user?.id) return false;
    }

    // Filter by status
    if (statusFilter !== 'all' && task.status !== statusFilter) {
      return false;
    }

    return true;
  });

  const handleCreateTask = async () => {
    if (!newTask.title.trim() || !user) return;

    try {
      const { error } = await supabase
        .from('tasks')
        .insert({
          title: newTask.title,
          description: newTask.description || null,
          priority: newTask.priority,
          due_date: newTask.due_date || null,
          created_by: user.id
        });

      if (error) {
        console.error('Error creating task:', error);
        return;
      }

      setNewTask({ title: '', description: '', priority: 'medium', due_date: '' });
      setShowCreateModal(false);
      onTaskUpdate();
    } catch (error) {
      console.error('Error creating task:', error);
    }
  };

  const handleUpdateTaskStatus = async (taskId: string, status: Task['status']) => {
    try {
      const { error } = await supabase
        .from('tasks')
        .update({ status })
        .eq('id', taskId);

      if (error) {
        console.error('Error updating task:', error);
        return;
      }

      onTaskUpdate();
    } catch (error) {
      console.error('Error updating task:', error);
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'urgent': return 'text-red-500 bg-red-500/10 border-red-500/30';
      case 'high': return 'text-orange-500 bg-orange-500/10 border-orange-500/30';
      case 'medium': return 'text-yellow-500 bg-yellow-500/10 border-yellow-500/30';
      case 'low': return 'text-green-500 bg-green-500/10 border-green-500/30';
      default: return 'text-gray-500 bg-gray-500/10 border-gray-500/30';
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed': return 'text-green-500';
      case 'in_progress': return 'text-blue-500';
      case 'cancelled': return 'text-red-500';
      default: return 'text-gray-500';
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString([], {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  };

  return (
    <>
      <div className="flex-1 flex flex-col">
        {/* Header */}
        <div className="glass-panel border-b silver-border p-4">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-bold gradient-gold-silver">Tasks</h2>
            <Button
              onClick={() => setShowCreateModal(true)}
              variant="premium"
              size="sm"
              className="flex items-center space-x-2"
            >
              <Plus className="w-4 h-4" />
              <span>New Task</span>
            </Button>
          </div>

          {/* Filters */}
          <div className="flex items-center space-x-4">
            <div className="flex items-center space-x-2">
              <Filter className="w-4 h-4 text-secondary" />
              <select
                value={filter}
                onChange={(e) => setFilter(e.target.value as any)}
                className="glass-panel rounded-lg px-3 py-2 text-sm text-primary focus:outline-none focus:ring-2 focus:ring-yellow-500"
              >
                <option value="all">All Tasks</option>
                <option value="assigned">Assigned to Me</option>
                <option value="created">Created by Me</option>
              </select>
            </div>

            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as any)}
              className="glass-panel rounded-lg px-3 py-2 text-sm text-primary focus:outline-none focus:ring-2 focus:ring-yellow-500"
            >
              <option value="all">All Status</option>
              <option value="todo">To Do</option>
              <option value="in_progress">In Progress</option>
              <option value="completed">Completed</option>
            </select>
          </div>
        </div>

        {/* Tasks List */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          <AnimatePresence>
            {filteredTasks.map((task) => (
              <motion.div
                key={task.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
              >
                <GlassCard className="p-4" hover>
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center space-x-3 mb-2">
                        <button
                          onClick={() => handleUpdateTaskStatus(
                            task.id, 
                            task.status === 'completed' ? 'todo' : 'completed'
                          )}
                          className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-all ${
                            task.status === 'completed'
                              ? 'bg-green-500 border-green-500'
                              : 'border-gray-400 hover:border-green-500'
                          }`}
                        >
                          {task.status === 'completed' && (
                            <CheckSquare className="w-3 h-3 text-white" />
                          )}
                        </button>
                        
                        <h3 className={`font-semibold ${
                          task.status === 'completed' 
                            ? 'text-secondary line-through' 
                            : 'text-primary'
                        }`}>
                          {task.title}
                        </h3>

                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${getPriorityColor(task.priority)}`}>
                          {task.priority}
                        </span>
                      </div>

                      {task.description && (
                        <p className="text-secondary text-sm mb-3">{task.description}</p>
                      )}

                      <div className="flex items-center space-x-4 text-xs text-secondary">
                        <div className="flex items-center space-x-1">
                          <span className={`w-2 h-2 rounded-full ${getStatusColor(task.status)}`} />
                          <span className="capitalize">{task.status.replace('_', ' ')}</span>
                        </div>

                        {task.due_date && (
                          <div className="flex items-center space-x-1">
                            <Calendar className="w-3 h-3" />
                            <span>{formatDate(task.due_date)}</span>
                          </div>
                        )}

                        {task.assignments && task.assignments.length > 0 && (
                          <div className="flex items-center space-x-1">
                            <User className="w-3 h-3" />
                            <span>{task.assignments.length} assigned</span>
                          </div>
                        )}

                        <div className="flex items-center space-x-1">
                          <Clock className="w-3 h-3" />
                          <span>{formatDate(task.created_at)}</span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center space-x-2">
                      <select
                        value={task.status}
                        onChange={(e) => handleUpdateTaskStatus(task.id, e.target.value as Task['status'])}
                        className="glass-panel rounded-lg px-2 py-1 text-xs text-primary focus:outline-none focus:ring-1 focus:ring-yellow-500"
                      >
                        <option value="todo">To Do</option>
                        <option value="in_progress">In Progress</option>
                        <option value="completed">Completed</option>
                        <option value="cancelled">Cancelled</option>
                      </select>
                    </div>
                  </div>
                </GlassCard>
              </motion.div>
            ))}
          </AnimatePresence>

          {filteredTasks.length === 0 && (
            <div className="text-center py-12">
              <CheckSquare className="w-12 h-12 text-secondary mx-auto mb-4 opacity-50" />
              <h3 className="text-lg font-bold text-primary mb-2">No tasks found</h3>
              <p className="text-secondary mb-4">
                {filter === 'all' 
                  ? 'Create your first task or mention someone in chat to auto-create tasks'
                  : `No tasks ${filter === 'assigned' ? 'assigned to you' : 'created by you'}`
                }
              </p>
              <Button
                onClick={() => setShowCreateModal(true)}
                variant="secondary"
                size="sm"
              >
                Create Task
              </Button>
            </div>
          )}
        </div>
      </div>

      {/* Create Task Modal */}
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
                  Create New Task
                </h3>
                
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-primary mb-2">
                      Task Title
                    </label>
                    <input
                      type="text"
                      value={newTask.title}
                      onChange={(e) => setNewTask(prev => ({ ...prev, title: e.target.value }))}
                      placeholder="What needs to be done?"
                      className="w-full glass-panel rounded-lg px-4 py-3 text-primary placeholder-secondary focus:outline-none focus:ring-2 focus:ring-yellow-500"
                      autoFocus
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-primary mb-2">
                      Description (Optional)
                    </label>
                    <textarea
                      value={newTask.description}
                      onChange={(e) => setNewTask(prev => ({ ...prev, description: e.target.value }))}
                      placeholder="Add more details..."
                      className="w-full glass-panel rounded-lg px-4 py-3 text-primary placeholder-secondary focus:outline-none focus:ring-2 focus:ring-yellow-500 resize-none"
                      rows={3}
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-primary mb-2">
                        Priority
                      </label>
                      <select
                        value={newTask.priority}
                        onChange={(e) => setNewTask(prev => ({ ...prev, priority: e.target.value as any }))}
                        className="w-full glass-panel rounded-lg px-4 py-3 text-primary focus:outline-none focus:ring-2 focus:ring-yellow-500"
                      >
                        <option value="low">Low</option>
                        <option value="medium">Medium</option>
                        <option value="high">High</option>
                        <option value="urgent">Urgent</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-primary mb-2">
                        Due Date (Optional)
                      </label>
                      <input
                        type="date"
                        value={newTask.due_date}
                        onChange={(e) => setNewTask(prev => ({ ...prev, due_date: e.target.value }))}
                        className="w-full glass-panel rounded-lg px-4 py-3 text-primary focus:outline-none focus:ring-2 focus:ring-yellow-500"
                      />
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
                    onClick={handleCreateTask}
                    variant="premium"
                    className="flex-1"
                    disabled={!newTask.title.trim()}
                  >
                    Create Task
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

export default TaskPanel;