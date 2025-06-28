import React, { useState, useEffect } from 'react';
import { Calendar, Users, DollarSign, TrendingUp, Clock, Target, AlertTriangle, CheckCircle, BarChart3, PieChart, Activity, FileText, Plus, Filter, Search } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import GlassCard from './ui/GlassCard';
import Button from './ui/Button';

interface Project {
  id: string;
  name: string;
  description: string;
  status: 'planning' | 'active' | 'on_hold' | 'completed' | 'cancelled';
  priority: 'low' | 'medium' | 'high' | 'critical';
  start_date: string;
  end_date: string;
  budget: number;
  spent_budget: number;
  progress_percentage: number;
  project_manager_id: string;
  department_id: string;
  client_name: string;
  created_at: string;
  department?: { name: string };
  project_manager?: { full_name: string };
  tasks?: any[];
  milestones?: any[];
}

interface ProjectPanelProps {
  onProjectUpdate: () => void;
}

const ProjectPanel: React.FC<ProjectPanelProps> = ({ onProjectUpdate }) => {
  const { user } = useAuth();
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'active' | 'planning' | 'completed'>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [analytics, setAnalytics] = useState<any>({});

  useEffect(() => {
    loadProjects();
    loadAnalytics();
  }, [user]);

  const loadProjects = async () => {
    if (!user) return;
    
    try {
      const { data, error } = await supabase
        .from('projects')
        .select(`
          *,
          department:departments(name),
          project_manager:profiles!project_manager_id(full_name),
          tasks(id, status),
          milestones:project_milestones(id, status)
        `)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error loading projects:', error);
        return;
      }

      setProjects(data || []);
    } catch (error) {
      console.error('Error loading projects:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadAnalytics = async () => {
    try {
      const { data, error } = await supabase
        .from('workspace_analytics')
        .select('*')
        .in('metric_name', ['active_projects', 'team_productivity', 'budget_utilization', 'project_velocity']);

      if (error) {
        console.error('Error loading analytics:', error);
        return;
      }

      const analyticsMap = data?.reduce((acc, item) => {
        acc[item.metric_name] = item.metric_value;
        return acc;
      }, {}) || {};

      setAnalytics(analyticsMap);
    } catch (error) {
      console.error('Error loading analytics:', error);
    }
  };

  const filteredProjects = projects.filter(project => {
    const matchesFilter = filter === 'all' || project.status === filter;
    const matchesSearch = project.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         project.client_name?.toLowerCase().includes(searchTerm.toLowerCase());
    return matchesFilter && matchesSearch;
  });

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active': return 'text-green-500 bg-green-500/10 border-green-500/30';
      case 'planning': return 'text-blue-500 bg-blue-500/10 border-blue-500/30';
      case 'on_hold': return 'text-yellow-500 bg-yellow-500/10 border-yellow-500/30';
      case 'completed': return 'text-purple-500 bg-purple-500/10 border-purple-500/30';
      case 'cancelled': return 'text-red-500 bg-red-500/10 border-red-500/30';
      default: return 'text-gray-500 bg-gray-500/10 border-gray-500/30';
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'critical': return 'text-red-500';
      case 'high': return 'text-orange-500';
      case 'medium': return 'text-yellow-500';
      case 'low': return 'text-green-500';
      default: return 'text-gray-500';
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString([], {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  };

  const calculateProjectHealth = (project: Project) => {
    const budgetHealth = project.budget > 0 ? (project.spent_budget / project.budget) * 100 : 0;
    const timeHealth = project.end_date ? 
      ((new Date().getTime() - new Date(project.start_date).getTime()) / 
       (new Date(project.end_date).getTime() - new Date(project.start_date).getTime())) * 100 : 0;
    
    const progressHealth = project.progress_percentage;
    
    if (budgetHealth > 90 || timeHealth > 90) return 'critical';
    if (budgetHealth > 75 || timeHealth > 75) return 'warning';
    return 'good';
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
          <h2 className="text-xl font-bold gradient-gold-silver">Project Management</h2>
          <Button
            onClick={() => setShowCreateModal(true)}
            variant="premium"
            size="sm"
            className="flex items-center space-x-2"
          >
            <Plus className="w-4 h-4" />
            <span>New Project</span>
          </Button>
        </div>

        {/* Analytics Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <GlassCard className="p-4" hover>
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 rounded-lg bg-gradient-to-r from-blue-500 to-cyan-500 flex items-center justify-center">
                <Target className="w-5 h-5 text-white" />
              </div>
              <div>
                <p className="text-sm text-secondary">Active Projects</p>
                <p className="text-xl font-bold text-primary">{analytics.active_projects || projects.filter(p => p.status === 'active').length}</p>
              </div>
            </div>
          </GlassCard>

          <GlassCard className="p-4" hover>
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 rounded-lg bg-gradient-to-r from-green-500 to-emerald-500 flex items-center justify-center">
                <TrendingUp className="w-5 h-5 text-white" />
              </div>
              <div>
                <p className="text-sm text-secondary">Team Productivity</p>
                <p className="text-xl font-bold text-primary">{analytics.team_productivity || 87.5}%</p>
              </div>
            </div>
          </GlassCard>

          <GlassCard className="p-4" hover>
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 rounded-lg bg-gradient-to-r from-purple-500 to-pink-500 flex items-center justify-center">
                <DollarSign className="w-5 h-5 text-white" />
              </div>
              <div>
                <p className="text-sm text-secondary">Budget Utilization</p>
                <p className="text-xl font-bold text-primary">{analytics.budget_utilization || 65.2}%</p>
              </div>
            </div>
          </GlassCard>

          <GlassCard className="p-4" hover>
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 rounded-lg bg-gradient-to-r from-orange-500 to-red-500 flex items-center justify-center">
                <Activity className="w-5 h-5 text-white" />
              </div>
              <div>
                <p className="text-sm text-secondary">Project Velocity</p>
                <p className="text-xl font-bold text-primary">{analytics.project_velocity || 23.5} SP</p>
              </div>
            </div>
          </GlassCard>
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
              <option value="all">All Projects</option>
              <option value="active">Active</option>
              <option value="planning">Planning</option>
              <option value="completed">Completed</option>
            </select>
          </div>

          <div className="flex-1 max-w-md relative">
            <Search className="absolute left-3 top-3 w-4 h-4 text-secondary" />
            <input
              type="text"
              placeholder="Search projects..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-4 py-2 glass-panel rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-yellow-500 text-primary placeholder-secondary"
            />
          </div>
        </div>
      </div>

      {/* Projects Grid */}
      <div className="flex-1 overflow-y-auto p-4">
        <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
          <AnimatePresence>
            {filteredProjects.map((project) => {
              const health = calculateProjectHealth(project);
              const completedTasks = project.tasks?.filter(t => t.status === 'completed').length || 0;
              const totalTasks = project.tasks?.length || 0;
              const completedMilestones = project.milestones?.filter(m => m.status === 'completed').length || 0;
              const totalMilestones = project.milestones?.length || 0;

              return (
                <motion.div
                  key={project.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -20 }}
                  className="group"
                >
                  <GlassCard 
                    className="p-6 h-full cursor-pointer" 
                    hover 
                    onClick={() => setSelectedProject(project)}
                  >
                    {/* Project Header */}
                    <div className="flex items-start justify-between mb-4">
                      <div className="flex-1">
                        <h3 className="font-bold text-primary mb-1 group-hover:gold-text transition-colors">
                          {project.name}
                        </h3>
                        <p className="text-sm text-secondary line-clamp-2 mb-2">
                          {project.description}
                        </p>
                        <div className="flex items-center space-x-2">
                          <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(project.status)}`}>
                            {project.status.replace('_', ' ')}
                          </span>
                          <span className={`text-xs font-medium ${getPriorityColor(project.priority)}`}>
                            {project.priority} priority
                          </span>
                        </div>
                      </div>
                      
                      {health === 'critical' && (
                        <AlertTriangle className="w-5 h-5 text-red-500" />
                      )}
                      {health === 'warning' && (
                        <Clock className="w-5 h-5 text-yellow-500" />
                      )}
                      {health === 'good' && (
                        <CheckCircle className="w-5 h-5 text-green-500" />
                      )}
                    </div>

                    {/* Progress Bar */}
                    <div className="mb-4">
                      <div className="flex justify-between items-center mb-2">
                        <span className="text-sm text-secondary">Progress</span>
                        <span className="text-sm font-medium text-primary">{project.progress_percentage}%</span>
                      </div>
                      <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                        <div 
                          className="bg-gradient-gold-silver h-2 rounded-full transition-all duration-300"
                          style={{ width: `${project.progress_percentage}%` }}
                        />
                      </div>
                    </div>

                    {/* Project Stats */}
                    <div className="grid grid-cols-2 gap-4 mb-4">
                      <div>
                        <div className="flex items-center space-x-2 mb-1">
                          <CheckCircle className="w-4 h-4 text-secondary" />
                          <span className="text-sm text-secondary">Tasks</span>
                        </div>
                        <p className="text-sm font-medium text-primary">
                          {completedTasks}/{totalTasks} completed
                        </p>
                      </div>
                      
                      <div>
                        <div className="flex items-center space-x-2 mb-1">
                          <Target className="w-4 h-4 text-secondary" />
                          <span className="text-sm text-secondary">Milestones</span>
                        </div>
                        <p className="text-sm font-medium text-primary">
                          {completedMilestones}/{totalMilestones} completed
                        </p>
                      </div>
                    </div>

                    {/* Budget Info */}
                    <div className="mb-4">
                      <div className="flex justify-between items-center mb-1">
                        <span className="text-sm text-secondary">Budget</span>
                        <span className="text-sm font-medium text-primary">
                          {formatCurrency(project.spent_budget)} / {formatCurrency(project.budget)}
                        </span>
                      </div>
                      <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-1">
                        <div 
                          className={`h-1 rounded-full transition-all duration-300 ${
                            (project.spent_budget / project.budget) > 0.9 ? 'bg-red-500' :
                            (project.spent_budget / project.budget) > 0.75 ? 'bg-yellow-500' : 'bg-green-500'
                          }`}
                          style={{ width: `${Math.min((project.spent_budget / project.budget) * 100, 100)}%` }}
                        />
                      </div>
                    </div>

                    {/* Project Details */}
                    <div className="space-y-2 text-xs text-secondary">
                      <div className="flex items-center space-x-2">
                        <Users className="w-3 h-3" />
                        <span>PM: {project.project_manager?.full_name || 'Unassigned'}</span>
                      </div>
                      <div className="flex items-center space-x-2">
                        <Calendar className="w-3 h-3" />
                        <span>{formatDate(project.start_date)} - {formatDate(project.end_date)}</span>
                      </div>
                      {project.client_name && (
                        <div className="flex items-center space-x-2">
                          <FileText className="w-3 h-3" />
                          <span>Client: {project.client_name}</span>
                        </div>
                      )}
                    </div>
                  </GlassCard>
                </motion.div>
              );
            })}
          </AnimatePresence>
        </div>

        {filteredProjects.length === 0 && (
          <div className="text-center py-12">
            <Target className="w-12 h-12 text-secondary mx-auto mb-4 opacity-50" />
            <h3 className="text-lg font-bold text-primary mb-2">No projects found</h3>
            <p className="text-secondary mb-4">
              {searchTerm ? 'No projects match your search criteria' : 'Create your first project to get started'}
            </p>
            <Button
              onClick={() => setShowCreateModal(true)}
              variant="secondary"
              size="sm"
            >
              Create Project
            </Button>
          </div>
        )}
      </div>

      {/* Project Detail Modal */}
      <AnimatePresence>
        {selectedProject && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="w-full max-w-4xl max-h-[90vh] overflow-y-auto"
            >
              <GlassCard className="p-8" goldBorder>
                <div className="flex justify-between items-start mb-6">
                  <div>
                    <h2 className="text-2xl font-bold gradient-gold-silver mb-2">
                      {selectedProject.name}
                    </h2>
                    <p className="text-secondary">{selectedProject.description}</p>
                  </div>
                  <button
                    onClick={() => setSelectedProject(null)}
                    className="text-secondary hover:text-primary p-2 rounded-lg glass-panel glass-panel-hover"
                  >
                    ×
                  </button>
                </div>

                {/* Project metrics and details would go here */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <div className="md:col-span-2">
                    <h3 className="font-bold text-primary mb-4">Project Overview</h3>
                    {/* Add project timeline, tasks, milestones, etc. */}
                  </div>
                  <div>
                    <h3 className="font-bold text-primary mb-4">Quick Stats</h3>
                    {/* Add quick stats and actions */}
                  </div>
                </div>
              </GlassCard>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default ProjectPanel;