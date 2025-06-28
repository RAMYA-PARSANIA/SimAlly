const { createClient } = require('@supabase/supabase-js');
const { GoogleGenerativeAI } = require('@google/generative-ai');
require('dotenv').config();

// Initialize Supabase client
const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.VITE_SUPABASE_SERVICE_ROLE_KEY
);

// Initialize Gemini AI
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

class WorkspaceProcessor {
  constructor() {
    this.model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });
  }

  async processMessage(messageData) {
    const { message, messageId, channelId, senderId, mentions, userId } = messageData;
    
    try {
      // Check if message contains task indicators
      const hasTaskIndicators = this.containsTaskIndicators(message);
      const hasMentions = mentions && mentions.length > 0;
      
      if (hasTaskIndicators || hasMentions) {
        return await this.extractTaskFromMessage(messageData);
      }
      
      return { success: true, taskCreated: false };
    } catch (error) {
      console.error('Error processing message:', error);
      return { success: false, error: error.message };
    }
  }

  containsTaskIndicators(message) {
    const taskKeywords = [
      'todo', 'task', 'assign', 'deadline', 'due', 'complete', 'finish',
      'work on', 'handle', 'take care of', 'need to', 'should', 'must',
      'remember to', 'don\'t forget', 'action item', 'follow up'
    ];
    
    const lowerMessage = message.toLowerCase();
    return taskKeywords.some(keyword => lowerMessage.includes(keyword));
  }

  async extractTaskFromMessage(messageData) {
    const { message, messageId, channelId, senderId, mentions, userId } = messageData;
    
    try {
      // Use AI to extract task details
      const prompt = `
        Analyze this message and extract task information if present:
        
        Message: "${message}"
        Mentions: ${mentions ? mentions.join(', ') : 'none'}
        
        If this message contains a task or action item, respond with JSON:
        {
          "hasTask": true,
          "title": "brief task title",
          "description": "detailed description",
          "priority": "low|medium|high|urgent",
          "assignee": "username if mentioned, null otherwise",
          "dueDate": "YYYY-MM-DD if mentioned, null otherwise",
          "project": "project name if mentioned, null otherwise",
          "tags": ["tag1", "tag2"] // extract any hashtags or categories
        }
        
        If no task is found, respond with:
        {
          "hasTask": false
        }
        
        Only respond with valid JSON.
      `;

      const result = await this.model.generateContent(prompt);
      const response = result.response.text();
      
      let taskData;
      try {
        taskData = JSON.parse(response);
      } catch (parseError) {
        console.error('Failed to parse AI response:', response);
        return { success: true, taskCreated: false };
      }

      if (!taskData.hasTask) {
        return { success: true, taskCreated: false };
      }

      // Create task in database
      const task = await this.createTask({
        title: taskData.title,
        description: taskData.description,
        priority: taskData.priority || 'medium',
        createdBy: senderId,
        sourceMessageId: messageId,
        dueDate: taskData.dueDate,
        project: taskData.project,
        tags: taskData.tags
      });

      // Assign task if assignee mentioned
      if (taskData.assignee && mentions && mentions.includes(taskData.assignee)) {
        const assigneeUser = await this.findUserByUsername(taskData.assignee);
        if (assigneeUser) {
          await this.assignTask(task.id, assigneeUser.id);
        }
      }

      // Create notification for task creation
      if (task) {
        await this.createNotification({
          userId: senderId,
          title: 'Task Created',
          message: `You created a new task: ${task.title}`,
          type: 'success',
          category: 'task',
          actionUrl: `/workspace?task=${task.id}`
        });
        
        // If task is assigned to someone else, notify them
        if (taskData.assignee && mentions && mentions.includes(taskData.assignee)) {
          const assigneeUser = await this.findUserByUsername(taskData.assignee);
          if (assigneeUser) {
            await this.createNotification({
              userId: assigneeUser.id,
              title: 'Task Assigned',
              message: `You were assigned a new task: ${task.title}`,
              type: 'info',
              category: 'task',
              actionUrl: `/workspace?task=${task.id}`
            });
          }
        }
      }

      return {
        success: true,
        taskCreated: true,
        task: {
          id: task.id,
          title: task.title,
          assignee: taskData.assignee
        }
      };

    } catch (error) {
      console.error('Error extracting task from message:', error);
      return { success: false, error: error.message };
    }
  }

  async createTask(taskData) {
    const { title, description, priority, createdBy, sourceMessageId, dueDate, project, tags } = taskData;
    
    // Find project ID if project name is provided
    let projectId = null;
    if (project) {
      const { data: projectData } = await supabase
        .from('projects')
        .select('id')
        .ilike('name', `%${project}%`)
        .limit(1);
      
      if (projectData && projectData.length > 0) {
        projectId = projectData[0].id;
      }
    }
    
    const { data, error } = await supabase
      .from('tasks')
      .insert({
        title,
        description,
        priority,
        created_by: createdBy,
        source_message_id: sourceMessageId,
        due_date: dueDate,
        project_id: projectId,
        tags: tags || null
      })
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to create task: ${error.message}`);
    }

    return data;
  }

  async assignTask(taskId, userId) {
    const { error } = await supabase
      .from('task_assignments')
      .insert({
        task_id: taskId,
        user_id: userId
      });

    if (error) {
      console.error('Failed to assign task:', error);
    }
  }

  async findUserByUsername(username) {
    const { data, error } = await supabase
      .from('profiles')
      .select('id, username')
      .eq('username', username)
      .single();

    if (error) {
      console.error('Failed to find user:', error);
      return null;
    }

    return data;
  }

  async createNotification(notificationData) {
    const { userId, title, message, type, category, actionUrl } = notificationData;
    
    const { error } = await supabase
      .from('notifications')
      .insert({
        user_id: userId,
        title,
        message,
        type: type || 'info',
        category: category || 'general',
        action_url: actionUrl
      });

    if (error) {
      console.error('Failed to create notification:', error);
    }
  }

  async generateChannelSummary(channelId, timeframe = '24h') {
    try {
      // Get recent messages from channel
      const hoursAgo = timeframe === '24h' ? 24 : timeframe === '7d' ? 168 : 1;
      const since = new Date(Date.now() - hoursAgo * 60 * 60 * 1000).toISOString();

      const { data: messages, error } = await supabase
        .from('messages')
        .select(`
          content,
          type,
          created_at,
          sender:profiles(full_name, username)
        `)
        .eq('channel_id', channelId)
        .gte('created_at', since)
        .order('created_at', { ascending: true });

      if (error || !messages || messages.length === 0) {
        return { success: false, error: 'No messages found' };
      }

      // Generate summary using AI
      const messageText = messages
        .filter(m => m.type === 'text')
        .map(m => `${m.sender?.full_name || 'Unknown'}: ${m.content}`)
        .join('\n');

      const prompt = `
        Summarize this channel conversation from the last ${timeframe}:
        
        ${messageText}
        
        Provide a concise summary including:
        - Key topics discussed
        - Important decisions made
        - Action items or tasks mentioned
        - Overall sentiment and activity level
        
        Keep it under 200 words.
        Respond only in markdown format.
      `;

      const result = await this.model.generateContent(prompt);
      const summary = result.response.text();

      return {
        success: true,
        summary,
        messageCount: messages.length,
        timeframe
      };

    } catch (error) {
      console.error('Error generating channel summary:', error);
      return { success: false, error: error.message };
    }
  }

  async extractMeetingNotes(transcript, participants, duration) {
    try {
      const prompt = `
        Extract meeting notes from this transcript:
        
        Participants: ${participants.join(', ')}
        Duration: ${duration} minutes
        
        Transcript:
        ${transcript}
        
        Generate structured meeting notes with:
        1. Meeting Summary (2-3 sentences)
        2. Key Discussion Points (bullet points)
        3. Decisions Made (bullet points)
        4. Action Items (with assignees if mentioned)
        5. Next Steps
        
        Format as markdown.
      `;

      const result = await this.model.generateContent(prompt);
      const notes = result.response.text();

      return {
        success: true,
        notes,
        participants,
        duration
      };

    } catch (error) {
      console.error('Error extracting meeting notes:', error);
      return { success: false, error: error.message };
    }
  }
  
  async generateProjectAnalytics(projectId) {
    try {
      // Get project details
      const { data: project, error: projectError } = await supabase
        .from('projects')
        .select(`
          *,
          tasks(id, status, priority, estimated_hours, actual_hours),
          milestones:project_milestones(id, status, due_date)
        `)
        .eq('id', projectId)
        .single();
      
      if (projectError || !project) {
        return { success: false, error: 'Project not found' };
      }
      
      // Calculate metrics
      const tasks = project.tasks || [];
      const milestones = project.milestones || [];
      
      const totalTasks = tasks.length;
      const completedTasks = tasks.filter(t => t.status === 'completed').length;
      const inProgressTasks = tasks.filter(t => t.status === 'in_progress').length;
      const todoTasks = tasks.filter(t => t.status === 'todo').length;
      
      const totalMilestones = milestones.length;
      const completedMilestones = milestones.filter(m => m.status === 'completed').length;
      
      const estimatedHours = tasks.reduce((sum, task) => sum + (task.estimated_hours || 0), 0);
      const actualHours = tasks.reduce((sum, task) => sum + (task.actual_hours || 0), 0);
      
      const highPriorityTasks = tasks.filter(t => t.priority === 'high' || t.priority === 'critical').length;
      
      // Calculate budget metrics
      const budgetUtilization = project.budget > 0 ? (project.spent_budget / project.budget) * 100 : 0;
      
      // Calculate timeline metrics
      const now = new Date();
      const startDate = new Date(project.start_date);
      const endDate = new Date(project.end_date);
      const totalDuration = endDate.getTime() - startDate.getTime();
      const elapsedDuration = now.getTime() - startDate.getTime();
      const timelineProgress = totalDuration > 0 ? (elapsedDuration / totalDuration) * 100 : 0;
      
      // Calculate if project is on track
      const isOnTrack = project.progress_percentage >= timelineProgress;
      
      return {
        success: true,
        analytics: {
          taskMetrics: {
            total: totalTasks,
            completed: completedTasks,
            inProgress: inProgressTasks,
            todo: todoTasks,
            completionRate: totalTasks > 0 ? (completedTasks / totalTasks) * 100 : 0,
            highPriority: highPriorityTasks
          },
          milestoneMetrics: {
            total: totalMilestones,
            completed: completedMilestones,
            completionRate: totalMilestones > 0 ? (completedMilestones / totalMilestones) * 100 : 0
          },
          timeMetrics: {
            estimatedHours,
            actualHours,
            efficiency: estimatedHours > 0 ? (estimatedHours / actualHours) * 100 : 0
          },
          budgetMetrics: {
            budget: project.budget,
            spent: project.spent_budget,
            remaining: project.budget - project.spent_budget,
            utilization: budgetUtilization
          },
          timelineMetrics: {
            progress: project.progress_percentage,
            timelineProgress,
            isOnTrack,
            daysRemaining: Math.max(0, Math.ceil((endDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)))
          }
        }
      };
    } catch (error) {
      console.error('Error generating project analytics:', error);
      return { success: false, error: error.message };
    }
  }
  
  async generateWorkspaceReport(reportType, parameters = {}) {
    try {
      // Get data based on report type
      let reportData = {};
      
      switch (reportType) {
        case 'project':
          // Project performance report
          const { data: projects } = await supabase
            .from('projects')
            .select('*')
            .order('created_at', { ascending: false });
          
          reportData.projects = projects || [];
          break;
          
        case 'time':
          // Time tracking report
          const { startDate, endDate, userId } = parameters;
          let timeQuery = supabase
            .from('time_tracking')
            .select(`
              *,
              task:tasks(title),
              project:projects(name)
            `)
            .order('start_time', { ascending: false });
          
          if (startDate) {
            timeQuery = timeQuery.gte('start_time', startDate);
          }
          
          if (endDate) {
            timeQuery = timeQuery.lte('start_time', endDate);
          }
          
          if (userId) {
            timeQuery = timeQuery.eq('user_id', userId);
          }
          
          const { data: timeEntries } = await timeQuery;
          reportData.timeEntries = timeEntries || [];
          break;
          
        case 'productivity':
          // Productivity report
          const { data: analytics } = await supabase
            .from('workspace_analytics')
            .select('*')
            .order('date_recorded', { ascending: false });
          
          reportData.analytics = analytics || [];
          break;
          
        default:
          return { success: false, error: 'Invalid report type' };
      }
      
      // Generate report using AI
      const prompt = `
        Generate a professional ${reportType} report based on this data:
        
        ${JSON.stringify(reportData)}
        
        Include:
        - Executive summary
        - Key metrics and KPIs
        - Detailed analysis
        - Recommendations
        - Next steps
        
        Format as markdown with proper headings, lists, and emphasis.
      `;
      
      const result = await this.model.generateContent(prompt);
      const report = result.response.text();
      
      // Create report record in database
      const { data: reportRecord, error } = await supabase
        .from('reports')
        .insert({
          name: `${reportType.charAt(0).toUpperCase() + reportType.slice(1)} Report`,
          type: reportType,
          parameters: parameters,
          status: 'completed',
          completed_at: new Date().toISOString()
        })
        .select()
        .single();
      
      if (error) {
        console.error('Error creating report record:', error);
      }
      
      return {
        success: true,
        report,
        reportData,
        reportRecord: reportRecord || null
      };
    } catch (error) {
      console.error('Error generating workspace report:', error);
      return { success: false, error: error.message };
    }
  }
}

module.exports = WorkspaceProcessor;