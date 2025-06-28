import React, { useState, useEffect } from 'react';
import { BarChart3, PieChart, TrendingUp, Users, Clock, DollarSign, Target, Activity, Calendar, FileText, Download, RefreshCw } from 'lucide-react';
import { motion } from 'framer-motion';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import GlassCard from './ui/GlassCard';
import Button from './ui/Button';

interface AnalyticsData {
  active_projects: number;
  completed_tasks: number;
  team_productivity: number;
  budget_utilization: number;
  user_engagement: number;
  project_velocity: number;
  bug_resolution_time: number;
  client_satisfaction: number;
}

interface TimeTrackingData {
  total_hours: number;
  billable_hours: number;
  projects: Array<{
    name: string;
    hours: number;
    revenue: number;
  }>;
}

const AnalyticsPanel: React.FC = () => {
  const { user } = useAuth();
  const [analytics, setAnalytics] = useState<AnalyticsData>({} as AnalyticsData);
  const [timeTracking, setTimeTracking] = useState<TimeTrackingData>({} as TimeTrackingData);
  const [loading, setLoading] = useState(true);
  const [selectedPeriod, setSelectedPeriod] = useState<'week' | 'month' | 'quarter'>('month');
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    loadAnalytics();
    loadTimeTracking();
  }, [user, selectedPeriod]);

  const loadAnalytics = async () => {
    try {
      const { data, error } = await supabase
        .from('workspace_analytics')
        .select('*')
        .order('date_recorded', { ascending: false });

      if (error) {
        console.error('Error loading analytics:', error);
        return;
      }

      const analyticsMap = data?.reduce((acc, item) => {
        acc[item.metric_name] = item.metric_value;
        return acc;
      }, {}) || {};

      setAnalytics(analyticsMap as AnalyticsData);
    } catch (error) {
      console.error('Error loading analytics:', error);
    }
  };

  const loadTimeTracking = async () => {
    try {
      // Get time tracking data
      const { data: timeData, error: timeError } = await supabase
        .from('time_tracking')
        .select(`
          duration_minutes,
          billable,
          hourly_rate,
          project:projects(name)
        `)
        .gte('start_time', getDateRange(selectedPeriod));

      if (timeError) {
        console.error('Error loading time tracking:', timeError);
        return;
      }

      const totalMinutes = timeData?.reduce((sum, entry) => sum + (entry.duration_minutes || 0), 0) || 0;
      const billableMinutes = timeData?.filter(entry => entry.billable)
        .reduce((sum, entry) => sum + (entry.duration_minutes || 0), 0) || 0;

      const projectHours = timeData?.reduce((acc, entry) => {
        const projectName = entry.project?.name || 'Unassigned';
        const hours = (entry.duration_minutes || 0) / 60;
        const revenue = entry.billable ? hours * (entry.hourly_rate || 0) : 0;

        if (!acc[projectName]) {
          acc[projectName] = { name: projectName, hours: 0, revenue: 0 };
        }
        acc[projectName].hours += hours;
        acc[projectName].revenue += revenue;
        return acc;
      }, {} as Record<string, any>) || {};

      setTimeTracking({
        total_hours: totalMinutes / 60,
        billable_hours: billableMinutes / 60,
        projects: Object.values(projectHours)
      });
    } catch (error) {
      console.error('Error loading time tracking:', error);
    } finally {
      setLoading(false);
    }
  };

  const getDateRange = (period: string) => {
    const now = new Date();
    switch (period) {
      case 'week':
        return new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();
      case 'month':
        return new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString();
      case 'quarter':
        return new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000).toISOString();
      default:
        return new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString();
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    await Promise.all([loadAnalytics(), loadTimeTracking()]);
    setRefreshing(false);
  };

  const exportReport = () => {
    const reportData = {
      period: selectedPeriod,
      generated_at: new Date().toISOString(),
      analytics,
      time_tracking: timeTracking
    };

    const blob = new Blob([JSON.stringify(reportData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `analytics-report-${selectedPeriod}-${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  const formatHours = (hours: number) => {
    return `${hours.toFixed(1)}h`;
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
          <h2 className="text-xl font-bold gradient-gold-silver">Analytics & Insights</h2>
          <div className="flex items-center space-x-3">
            <select
              value={selectedPeriod}
              onChange={(e) => setSelectedPeriod(e.target.value as any)}
              className="glass-panel rounded-lg px-3 py-2 text-sm text-primary focus:outline-none focus:ring-2 focus:ring-yellow-500"
            >
              <option value="week">Last Week</option>
              <option value="month">Last Month</option>
              <option value="quarter">Last Quarter</option>
            </select>
            
            <Button
              onClick={handleRefresh}
              variant="ghost"
              size="sm"
              className="p-2"
              disabled={refreshing}
            >
              <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
            </Button>
            
            <Button
              onClick={exportReport}
              variant="secondary"
              size="sm"
              className="flex items-center space-x-2"
            >
              <Download className="w-4 h-4" />
              <span>Export</span>
            </Button>
          </div>
        </div>
      </div>

      {/* Analytics Content */}
      <div className="flex-1 overflow-y-auto p-4 space-y-6">
        {/* Key Metrics */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
            <GlassCard className="p-6" hover>
              <div className="flex items-center space-x-4">
                <div className="w-12 h-12 rounded-lg bg-gradient-to-r from-blue-500 to-cyan-500 flex items-center justify-center">
                  <Target className="w-6 h-6 text-white" />
                </div>
                <div>
                  <p className="text-sm text-secondary">Active Projects</p>
                  <p className="text-2xl font-bold text-primary">{analytics.active_projects || 0}</p>
                  <p className="text-xs text-green-500">+12% from last period</p>
                </div>
              </div>
            </GlassCard>
          </motion.div>

          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
            <GlassCard className="p-6" hover>
              <div className="flex items-center space-x-4">
                <div className="w-12 h-12 rounded-lg bg-gradient-to-r from-green-500 to-emerald-500 flex items-center justify-center">
                  <TrendingUp className="w-6 h-6 text-white" />
                </div>
                <div>
                  <p className="text-sm text-secondary">Team Productivity</p>
                  <p className="text-2xl font-bold text-primary">{analytics.team_productivity || 0}%</p>
                  <p className="text-xs text-green-500">+5% from last period</p>
                </div>
              </div>
            </GlassCard>
          </motion.div>

          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
            <GlassCard className="p-6" hover>
              <div className="flex items-center space-x-4">
                <div className="w-12 h-12 rounded-lg bg-gradient-to-r from-purple-500 to-pink-500 flex items-center justify-center">
                  <DollarSign className="w-6 h-6 text-white" />
                </div>
                <div>
                  <p className="text-sm text-secondary">Budget Utilization</p>
                  <p className="text-2xl font-bold text-primary">{analytics.budget_utilization || 0}%</p>
                  <p className="text-xs text-yellow-500">-2% from last period</p>
                </div>
              </div>
            </GlassCard>
          </motion.div>

          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}>
            <GlassCard className="p-6" hover>
              <div className="flex items-center space-x-4">
                <div className="w-12 h-12 rounded-lg bg-gradient-to-r from-orange-500 to-red-500 flex items-center justify-center">
                  <Activity className="w-6 h-6 text-white" />
                </div>
                <div>
                  <p className="text-sm text-secondary">Project Velocity</p>
                  <p className="text-2xl font-bold text-primary">{analytics.project_velocity || 0} SP</p>
                  <p className="text-xs text-green-500">+8% from last period</p>
                </div>
              </div>
            </GlassCard>
          </motion.div>
        </div>

        {/* Charts and Detailed Analytics */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Time Tracking Summary */}
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }}>
            <GlassCard className="p-6" goldBorder>
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-bold text-primary">Time Tracking</h3>
                <Clock className="w-5 h-5 text-secondary" />
              </div>
              
              <div className="space-y-4">
                <div className="flex justify-between items-center">
                  <span className="text-secondary">Total Hours</span>
                  <span className="font-bold text-primary">{formatHours(timeTracking.total_hours || 0)}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-secondary">Billable Hours</span>
                  <span className="font-bold text-green-500">{formatHours(timeTracking.billable_hours || 0)}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-secondary">Billable Rate</span>
                  <span className="font-bold text-primary">
                    {timeTracking.total_hours ? Math.round((timeTracking.billable_hours / timeTracking.total_hours) * 100) : 0}%
                  </span>
                </div>
                
                {/* Project breakdown */}
                <div className="mt-6">
                  <h4 className="font-medium text-primary mb-3">Top Projects</h4>
                  <div className="space-y-2">
                    {timeTracking.projects?.slice(0, 3).map((project, index) => (
                      <div key={index} className="flex justify-between items-center text-sm">
                        <span className="text-secondary">{project.name}</span>
                        <div className="text-right">
                          <div className="font-medium text-primary">{formatHours(project.hours)}</div>
                          <div className="text-xs text-green-500">{formatCurrency(project.revenue)}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </GlassCard>
          </motion.div>

          {/* Performance Metrics */}
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.5 }}>
            <GlassCard className="p-6" goldBorder>
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-bold text-primary">Performance Metrics</h3>
                <BarChart3 className="w-5 h-5 text-secondary" />
              </div>
              
              <div className="space-y-4">
                <div>
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-secondary">User Engagement</span>
                    <span className="font-bold text-primary">{analytics.user_engagement || 0}%</span>
                  </div>
                  <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                    <div 
                      className="bg-gradient-to-r from-blue-500 to-cyan-500 h-2 rounded-full"
                      style={{ width: `${analytics.user_engagement || 0}%` }}
                    />
                  </div>
                </div>

                <div>
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-secondary">Bug Resolution Time</span>
                    <span className="font-bold text-primary">{analytics.bug_resolution_time || 0} days</span>
                  </div>
                  <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                    <div 
                      className="bg-gradient-to-r from-green-500 to-emerald-500 h-2 rounded-full"
                      style={{ width: `${Math.max(0, 100 - (analytics.bug_resolution_time || 0) * 10)}%` }}
                    />
                  </div>
                </div>

                <div>
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-secondary">Client Satisfaction</span>
                    <span className="font-bold text-primary">{analytics.client_satisfaction || 0}/5</span>
                  </div>
                  <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                    <div 
                      className="bg-gradient-to-r from-purple-500 to-pink-500 h-2 rounded-full"
                      style={{ width: `${((analytics.client_satisfaction || 0) / 5) * 100}%` }}
                    />
                  </div>
                </div>

                <div>
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-secondary">Task Completion Rate</span>
                    <span className="font-bold text-primary">89%</span>
                  </div>
                  <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                    <div 
                      className="bg-gradient-to-r from-orange-500 to-red-500 h-2 rounded-full"
                      style={{ width: '89%' }}
                    />
                  </div>
                </div>
              </div>
            </GlassCard>
          </motion.div>
        </div>

        {/* Additional Analytics Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.6 }}>
            <GlassCard className="p-6" hover>
              <div className="flex items-center space-x-3 mb-4">
                <Users className="w-6 h-6 text-blue-500" />
                <h3 className="font-bold text-primary">Team Overview</h3>
              </div>
              <div className="space-y-3">
                <div className="flex justify-between">
                  <span className="text-secondary">Active Members</span>
                  <span className="font-medium text-primary">12</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-secondary">Avg. Hours/Week</span>
                  <span className="font-medium text-primary">38.5h</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-secondary">Utilization Rate</span>
                  <span className="font-medium text-green-500">94%</span>
                </div>
              </div>
            </GlassCard>
          </motion.div>

          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.7 }}>
            <GlassCard className="p-6" hover>
              <div className="flex items-center space-x-3 mb-4">
                <Calendar className="w-6 h-6 text-green-500" />
                <h3 className="font-bold text-primary">Deadlines</h3>
              </div>
              <div className="space-y-3">
                <div className="flex justify-between">
                  <span className="text-secondary">On Time</span>
                  <span className="font-medium text-green-500">87%</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-secondary">Overdue</span>
                  <span className="font-medium text-red-500">8%</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-secondary">Upcoming (7d)</span>
                  <span className="font-medium text-yellow-500">15</span>
                </div>
              </div>
            </GlassCard>
          </motion.div>

          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.8 }}>
            <GlassCard className="p-6" hover>
              <div className="flex items-center space-x-3 mb-4">
                <FileText className="w-6 h-6 text-purple-500" />
                <h3 className="font-bold text-primary">Reports</h3>
              </div>
              <div className="space-y-3">
                <div className="flex justify-between">
                  <span className="text-secondary">Generated</span>
                  <span className="font-medium text-primary">24</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-secondary">Automated</span>
                  <span className="font-medium text-green-500">18</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-secondary">Scheduled</span>
                  <span className="font-medium text-blue-500">6</span>
                </div>
              </div>
            </GlassCard>
          </motion.div>
        </div>
      </div>
    </div>
  );
};

export default AnalyticsPanel;