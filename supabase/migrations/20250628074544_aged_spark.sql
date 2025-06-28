/*
  # Enhanced Workspace Schema for Company-Grade Features

  1. New Tables
    - `departments` - Company departments/teams
    - `projects` - Project management
    - `project_members` - Project team assignments
    - `task_dependencies` - Task dependency tracking
    - `task_comments` - Task discussion threads
    - `time_tracking` - Work time logging
    - `notifications` - System notifications
    - `file_attachments` - File management
    - `workspace_analytics` - Analytics data
    - `meeting_recordings` - Meeting records
    - `project_milestones` - Project milestone tracking
    - `user_roles` - Enhanced role management
    - `activity_logs` - Comprehensive activity tracking
    - `reports` - Generated reports
    - `integrations` - Third-party integrations

  2. Enhanced Features
    - Project management with Gantt charts
    - Time tracking and reporting
    - Advanced analytics and insights
    - File management system
    - Notification system
    - Meeting recordings and transcripts
    - Advanced role-based permissions
    - Activity monitoring
    - Automated reporting
    - Integration management

  3. Security & Compliance
    - Audit trails
    - Data retention policies
    - Access control
    - Compliance reporting
*/

-- Departments/Teams
CREATE TABLE IF NOT EXISTS departments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text,
  head_id uuid REFERENCES profiles(id) ON DELETE SET NULL,
  parent_department_id uuid REFERENCES departments(id) ON DELETE SET NULL,
  budget decimal(12,2),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Projects
CREATE TABLE IF NOT EXISTS projects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text,
  status text DEFAULT 'planning' CHECK (status IN ('planning', 'active', 'on_hold', 'completed', 'cancelled')),
  priority text DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high', 'critical')),
  start_date date,
  end_date date,
  budget decimal(12,2),
  spent_budget decimal(12,2) DEFAULT 0,
  progress_percentage integer DEFAULT 0 CHECK (progress_percentage >= 0 AND progress_percentage <= 100),
  project_manager_id uuid REFERENCES profiles(id) ON DELETE SET NULL,
  department_id uuid REFERENCES departments(id) ON DELETE SET NULL,
  client_name text,
  metadata jsonb DEFAULT '{}',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Project Members
CREATE TABLE IF NOT EXISTS project_members (
  project_id uuid REFERENCES projects(id) ON DELETE CASCADE,
  user_id uuid REFERENCES profiles(id) ON DELETE CASCADE,
  role text DEFAULT 'member' CHECK (role IN ('manager', 'lead', 'member', 'observer')),
  hourly_rate decimal(8,2),
  joined_at timestamptz DEFAULT now(),
  PRIMARY KEY (project_id, user_id)
);

-- Enhanced Tasks with Project Integration
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS project_id uuid REFERENCES projects(id) ON DELETE SET NULL;
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS estimated_hours decimal(6,2);
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS actual_hours decimal(6,2) DEFAULT 0;
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS story_points integer;
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS tags text[];
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS blocked_reason text;
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS parent_task_id uuid REFERENCES tasks(id) ON DELETE SET NULL;

-- Task Dependencies
CREATE TABLE IF NOT EXISTS task_dependencies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id uuid REFERENCES tasks(id) ON DELETE CASCADE,
  depends_on_task_id uuid REFERENCES tasks(id) ON DELETE CASCADE,
  dependency_type text DEFAULT 'finish_to_start' CHECK (dependency_type IN ('finish_to_start', 'start_to_start', 'finish_to_finish', 'start_to_finish')),
  created_at timestamptz DEFAULT now(),
  UNIQUE(task_id, depends_on_task_id)
);

-- Task Comments
CREATE TABLE IF NOT EXISTS task_comments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id uuid REFERENCES tasks(id) ON DELETE CASCADE,
  user_id uuid REFERENCES profiles(id) ON DELETE CASCADE,
  content text NOT NULL,
  parent_comment_id uuid REFERENCES task_comments(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Time Tracking
CREATE TABLE IF NOT EXISTS time_tracking (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES profiles(id) ON DELETE CASCADE,
  task_id uuid REFERENCES tasks(id) ON DELETE SET NULL,
  project_id uuid REFERENCES projects(id) ON DELETE SET NULL,
  description text,
  start_time timestamptz NOT NULL,
  end_time timestamptz,
  duration_minutes integer,
  billable boolean DEFAULT true,
  hourly_rate decimal(8,2),
  created_at timestamptz DEFAULT now()
);

-- Notifications
CREATE TABLE IF NOT EXISTS notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES profiles(id) ON DELETE CASCADE,
  title text NOT NULL,
  message text NOT NULL,
  type text DEFAULT 'info' CHECK (type IN ('info', 'warning', 'error', 'success')),
  category text DEFAULT 'general' CHECK (category IN ('general', 'task', 'project', 'meeting', 'system')),
  read boolean DEFAULT false,
  action_url text,
  metadata jsonb DEFAULT '{}',
  created_at timestamptz DEFAULT now()
);

-- File Attachments
CREATE TABLE IF NOT EXISTS file_attachments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  filename text NOT NULL,
  original_filename text NOT NULL,
  file_size bigint NOT NULL,
  mime_type text NOT NULL,
  file_path text NOT NULL,
  uploaded_by uuid REFERENCES profiles(id) ON DELETE SET NULL,
  task_id uuid REFERENCES tasks(id) ON DELETE CASCADE,
  project_id uuid REFERENCES projects(id) ON DELETE CASCADE,
  message_id uuid REFERENCES messages(id) ON DELETE CASCADE,
  is_public boolean DEFAULT false,
  download_count integer DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

-- Project Milestones
CREATE TABLE IF NOT EXISTS project_milestones (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid REFERENCES projects(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text,
  due_date date NOT NULL,
  completed_date date,
  status text DEFAULT 'pending' CHECK (status IN ('pending', 'completed', 'overdue')),
  created_by uuid REFERENCES profiles(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now()
);

-- User Roles (Enhanced)
CREATE TABLE IF NOT EXISTS user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES profiles(id) ON DELETE CASCADE,
  role_name text NOT NULL,
  permissions jsonb DEFAULT '{}',
  department_id uuid REFERENCES departments(id) ON DELETE SET NULL,
  project_id uuid REFERENCES projects(id) ON DELETE CASCADE,
  granted_by uuid REFERENCES profiles(id) ON DELETE SET NULL,
  granted_at timestamptz DEFAULT now(),
  expires_at timestamptz
);

-- Activity Logs
CREATE TABLE IF NOT EXISTS activity_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES profiles(id) ON DELETE SET NULL,
  action text NOT NULL,
  resource_type text NOT NULL,
  resource_id uuid,
  old_values jsonb,
  new_values jsonb,
  ip_address inet,
  user_agent text,
  created_at timestamptz DEFAULT now()
);

-- Workspace Analytics
CREATE TABLE IF NOT EXISTS workspace_analytics (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  metric_name text NOT NULL,
  metric_value decimal(12,2) NOT NULL,
  dimensions jsonb DEFAULT '{}',
  date_recorded date DEFAULT CURRENT_DATE,
  created_at timestamptz DEFAULT now()
);

-- Meeting Recordings
CREATE TABLE IF NOT EXISTS meeting_recordings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  meeting_room text NOT NULL,
  title text,
  recording_url text,
  transcript text,
  duration_minutes integer,
  participants text[],
  host_id uuid REFERENCES profiles(id) ON DELETE SET NULL,
  summary text,
  action_items text[],
  created_at timestamptz DEFAULT now()
);

-- Reports
CREATE TABLE IF NOT EXISTS reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  type text NOT NULL CHECK (type IN ('project', 'time', 'productivity', 'financial', 'custom')),
  parameters jsonb DEFAULT '{}',
  generated_by uuid REFERENCES profiles(id) ON DELETE SET NULL,
  file_path text,
  status text DEFAULT 'pending' CHECK (status IN ('pending', 'generating', 'completed', 'failed')),
  created_at timestamptz DEFAULT now(),
  completed_at timestamptz
);

-- Integrations
CREATE TABLE IF NOT EXISTS integrations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  type text NOT NULL,
  config jsonb DEFAULT '{}',
  enabled boolean DEFAULT true,
  last_sync timestamptz,
  created_by uuid REFERENCES profiles(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now()
);

-- Enable RLS on all new tables
ALTER TABLE departments ENABLE ROW LEVEL SECURITY;
ALTER TABLE projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE project_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE task_dependencies ENABLE ROW LEVEL SECURITY;
ALTER TABLE task_comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE time_tracking ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE file_attachments ENABLE ROW LEVEL SECURITY;
ALTER TABLE project_milestones ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE activity_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE workspace_analytics ENABLE ROW LEVEL SECURITY;
ALTER TABLE meeting_recordings ENABLE ROW LEVEL SECURITY;
ALTER TABLE reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE integrations ENABLE ROW LEVEL SECURITY;

-- RLS Policies

-- Departments
CREATE POLICY "Users can view departments" ON departments FOR SELECT TO authenticated USING (true);
CREATE POLICY "Department heads can manage departments" ON departments FOR ALL TO authenticated 
  USING (head_id = auth.uid() OR EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role_name = 'admin'));

-- Projects
CREATE POLICY "Users can view projects they're members of" ON projects FOR SELECT TO authenticated 
  USING (EXISTS (SELECT 1 FROM project_members WHERE project_id = projects.id AND user_id = auth.uid()));
CREATE POLICY "Project managers can manage projects" ON projects FOR ALL TO authenticated 
  USING (project_manager_id = auth.uid() OR EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role_name = 'admin'));

-- Project Members
CREATE POLICY "Users can view project members" ON project_members FOR SELECT TO authenticated 
  USING (EXISTS (SELECT 1 FROM project_members pm WHERE pm.project_id = project_members.project_id AND pm.user_id = auth.uid()));
CREATE POLICY "Project managers can manage members" ON project_members FOR ALL TO authenticated 
  USING (EXISTS (SELECT 1 FROM projects WHERE id = project_members.project_id AND project_manager_id = auth.uid()));

-- Task Dependencies
CREATE POLICY "Users can view task dependencies" ON task_dependencies FOR SELECT TO authenticated USING (true);
CREATE POLICY "Users can manage task dependencies" ON task_dependencies FOR ALL TO authenticated 
  USING (EXISTS (SELECT 1 FROM tasks WHERE id = task_dependencies.task_id AND created_by = auth.uid()));

-- Task Comments
CREATE POLICY "Users can view task comments" ON task_comments FOR SELECT TO authenticated USING (true);
CREATE POLICY "Users can create comments" ON task_comments FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "Users can update own comments" ON task_comments FOR UPDATE TO authenticated USING (user_id = auth.uid());

-- Time Tracking
CREATE POLICY "Users can view own time tracking" ON time_tracking FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "Users can manage own time tracking" ON time_tracking FOR ALL TO authenticated USING (user_id = auth.uid());

-- Notifications
CREATE POLICY "Users can view own notifications" ON notifications FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "Users can update own notifications" ON notifications FOR UPDATE TO authenticated USING (user_id = auth.uid());

-- File Attachments
CREATE POLICY "Users can view file attachments" ON file_attachments FOR SELECT TO authenticated USING (true);
CREATE POLICY "Users can upload files" ON file_attachments FOR INSERT TO authenticated WITH CHECK (uploaded_by = auth.uid());

-- Project Milestones
CREATE POLICY "Users can view project milestones" ON project_milestones FOR SELECT TO authenticated 
  USING (EXISTS (SELECT 1 FROM project_members WHERE project_id = project_milestones.project_id AND user_id = auth.uid()));
CREATE POLICY "Project managers can manage milestones" ON project_milestones FOR ALL TO authenticated 
  USING (EXISTS (SELECT 1 FROM projects WHERE id = project_milestones.project_id AND project_manager_id = auth.uid()));

-- User Roles
CREATE POLICY "Users can view roles" ON user_roles FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins can manage roles" ON user_roles FOR ALL TO authenticated 
  USING (EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role_name = 'admin'));

-- Activity Logs
CREATE POLICY "Users can view activity logs" ON activity_logs FOR SELECT TO authenticated USING (true);

-- Workspace Analytics
CREATE POLICY "Users can view analytics" ON workspace_analytics FOR SELECT TO authenticated USING (true);

-- Meeting Recordings
CREATE POLICY "Users can view meeting recordings" ON meeting_recordings FOR SELECT TO authenticated USING (true);
CREATE POLICY "Hosts can manage recordings" ON meeting_recordings FOR ALL TO authenticated USING (host_id = auth.uid());

-- Reports
CREATE POLICY "Users can view reports" ON reports FOR SELECT TO authenticated USING (true);
CREATE POLICY "Users can create reports" ON reports FOR INSERT TO authenticated WITH CHECK (generated_by = auth.uid());

-- Integrations
CREATE POLICY "Users can view integrations" ON integrations FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins can manage integrations" ON integrations FOR ALL TO authenticated 
  USING (EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role_name = 'admin'));

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_projects_manager ON projects(project_manager_id);
CREATE INDEX IF NOT EXISTS idx_projects_department ON projects(department_id);
CREATE INDEX IF NOT EXISTS idx_projects_status ON projects(status);
CREATE INDEX IF NOT EXISTS idx_tasks_project ON tasks(project_id);
CREATE INDEX IF NOT EXISTS idx_tasks_parent ON tasks(parent_task_id);
CREATE INDEX IF NOT EXISTS idx_time_tracking_user ON time_tracking(user_id);
CREATE INDEX IF NOT EXISTS idx_time_tracking_project ON time_tracking(project_id);
CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_id, read);
CREATE INDEX IF NOT EXISTS idx_activity_logs_user ON activity_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_activity_logs_resource ON activity_logs(resource_type, resource_id);

-- Functions for analytics
CREATE OR REPLACE FUNCTION calculate_project_progress(project_uuid uuid)
RETURNS integer AS $$
DECLARE
  total_tasks integer;
  completed_tasks integer;
  progress integer;
BEGIN
  SELECT COUNT(*) INTO total_tasks FROM tasks WHERE project_id = project_uuid;
  SELECT COUNT(*) INTO completed_tasks FROM tasks WHERE project_id = project_uuid AND status = 'completed';
  
  IF total_tasks = 0 THEN
    RETURN 0;
  END IF;
  
  progress := (completed_tasks * 100) / total_tasks;
  RETURN progress;
END;
$$ LANGUAGE plpgsql;

-- Trigger to update project progress
CREATE OR REPLACE FUNCTION update_project_progress()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'UPDATE' AND OLD.status != NEW.status THEN
    UPDATE projects 
    SET progress_percentage = calculate_project_progress(NEW.project_id)
    WHERE id = NEW.project_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_project_progress_trigger
  AFTER UPDATE ON tasks
  FOR EACH ROW
  EXECUTE FUNCTION update_project_progress();

-- Function to log activities
CREATE OR REPLACE FUNCTION log_activity()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO activity_logs (user_id, action, resource_type, resource_id, old_values, new_values)
  VALUES (
    auth.uid(),
    TG_OP,
    TG_TABLE_NAME,
    COALESCE(NEW.id, OLD.id),
    CASE WHEN TG_OP = 'DELETE' THEN to_jsonb(OLD) ELSE NULL END,
    CASE WHEN TG_OP != 'DELETE' THEN to_jsonb(NEW) ELSE NULL END
  );
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

-- Add activity logging triggers
CREATE TRIGGER log_projects_activity AFTER INSERT OR UPDATE OR DELETE ON projects
  FOR EACH ROW EXECUTE FUNCTION log_activity();
CREATE TRIGGER log_tasks_activity AFTER INSERT OR UPDATE OR DELETE ON tasks
  FOR EACH ROW EXECUTE FUNCTION log_activity();