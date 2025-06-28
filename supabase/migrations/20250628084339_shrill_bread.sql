/*
  # Clear existing dummy data

  1. Clean up existing demo data
    - Remove all dummy departments, projects, tasks, etc.
    - Keep user accounts and profiles intact
    - Reset analytics and other demo content

  2. Prepare for new comprehensive demo data
    - Clear workspace analytics
    - Clear meeting recordings
    - Clear reports and integrations
    - Clear notifications and activity logs
*/

-- Clear existing dummy data (keep user accounts)
DELETE FROM activity_logs WHERE resource_type IN ('projects', 'tasks', 'departments');
DELETE FROM workspace_analytics;
DELETE FROM meeting_recordings;
DELETE FROM reports;
DELETE FROM integrations;
DELETE FROM notifications WHERE category IN ('project', 'task');
DELETE FROM time_tracking;
DELETE FROM task_comments;
DELETE FROM task_dependencies;
DELETE FROM task_assignments;
DELETE FROM project_milestones;
DELETE FROM project_members;
DELETE FROM tasks;
DELETE FROM projects;
DELETE FROM departments;

-- Clear any existing demo channels and messages (keep user-created ones)
DELETE FROM messages WHERE channel_id IN (
  SELECT id FROM channels WHERE name IN ('general', 'engineering', 'design', 'marketing', 'random')
);
DELETE FROM channel_members WHERE channel_id IN (
  SELECT id FROM channels WHERE name IN ('general', 'engineering', 'design', 'marketing', 'random')
);
DELETE FROM channels WHERE name IN ('general', 'engineering', 'design', 'marketing', 'random');