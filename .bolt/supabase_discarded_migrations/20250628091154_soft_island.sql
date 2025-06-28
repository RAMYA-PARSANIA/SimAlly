/*
  # Create demo accounts and data

  1. New Data
    - Create demo user accounts (CEO, engineers, designers, marketing)
    - Create channels for different teams and projects
    - Create projects for the company
    - Add channel members
    - Add project members
    - Add sample messages
    - Add sample tasks
    - Add analytics data
*/

-- Create demo user accounts
DO $$
DECLARE
  ceo_id UUID;
  engineer_id UUID;
  designer_id UUID;
  marketing_id UUID;
  project_manager_id UUID;
  department_id UUID;
  general_channel_id UUID;
  engineering_channel_id UUID;
  design_channel_id UUID;
  marketing_channel_id UUID;
  mobile_app_channel_id UUID;
  enterprise_dashboard_channel_id UUID;
  brand_redesign_channel_id UUID;
  executive_channel_id UUID;
  mobile_app_project_id UUID;
  enterprise_dashboard_project_id UUID;
  brand_redesign_project_id UUID;
BEGIN
  -- Create CEO account
  INSERT INTO user_accounts (username, password_hash, full_name, status)
  VALUES ('ceo', '$2a$10$XvOz0TQbUZT5.TUz5qxRzOGwzXLlDhE/ASaYJMrKV6jNyzDJg7vyW', 'Alex Johnson', 'online')
  RETURNING id INTO ceo_id;
  
  INSERT INTO profiles (id, full_name, username, status)
  VALUES (ceo_id, 'Alex Johnson', 'ceo', 'online');
  
  -- Create Engineer account
  INSERT INTO user_accounts (username, password_hash, full_name, status)
  VALUES ('engineer', '$2a$10$XvOz0TQbUZT5.TUz5qxRzOGwzXLlDhE/ASaYJMrKV6jNyzDJg7vyW', 'Sam Chen', 'online')
  RETURNING id INTO engineer_id;
  
  INSERT INTO profiles (id, full_name, username, status)
  VALUES (engineer_id, 'Sam Chen', 'engineer', 'online');
  
  -- Create Designer account
  INSERT INTO user_accounts (username, password_hash, full_name, status)
  VALUES ('designer', '$2a$10$XvOz0TQbUZT5.TUz5qxRzOGwzXLlDhE/ASaYJMrKV6jNyzDJg7vyW', 'Maya Rodriguez', 'online')
  RETURNING id INTO designer_id;
  
  INSERT INTO profiles (id, full_name, username, status)
  VALUES (designer_id, 'Maya Rodriguez', 'designer', 'online');
  
  -- Create Marketing account
  INSERT INTO user_accounts (username, password_hash, full_name, status)
  VALUES ('marketing', '$2a$10$XvOz0TQbUZT5.TUz5qxRzOGwzXLlDhE/ASaYJMrKV6jNyzDJg7vyW', 'Jordan Smith', 'online')
  RETURNING id INTO marketing_id;
  
  INSERT INTO profiles (id, full_name, username, status)
  VALUES (marketing_id, 'Jordan Smith', 'marketing', 'online');
  
  -- Create Project Manager account
  INSERT INTO user_accounts (username, password_hash, full_name, status)
  VALUES ('pm', '$2a$10$XvOz0TQbUZT5.TUz5qxRzOGwzXLlDhE/ASaYJMrKV6jNyzDJg7vyW', 'Taylor Wilson', 'online')
  RETURNING id INTO project_manager_id;
  
  INSERT INTO profiles (id, full_name, username, status)
  VALUES (project_manager_id, 'Taylor Wilson', 'pm', 'online');
  
  -- Create Department
  INSERT INTO departments (name, description, head_id)
  VALUES ('Technology', 'Engineering and Product Development', ceo_id)
  RETURNING id INTO department_id;
  
  -- Create Channels with valid hexadecimal UUIDs
  INSERT INTO channels (id, name, description, type, created_by)
  VALUES
    ('aaaaaaaa-1111-1111-1111-111111111111', 'general', 'General company discussions', 'public', ceo_id),
    ('bbbbbbbb-2222-2222-2222-222222222222', 'engineering', 'Engineering team discussions', 'public', engineer_id),
    ('cccccccc-3333-3333-3333-333333333333', 'design', 'Design team discussions', 'public', designer_id),
    ('dddddddd-4444-4444-4444-444444444444', 'marketing', 'Marketing team discussions', 'public', marketing_id),
    ('eeeeeeee-5555-5555-5555-555555555555', 'mobile-app', 'SimAlly Mobile App project discussions', 'public', engineer_id),
    ('ffffffff-6666-6666-6666-666666666666', 'enterprise-dashboard', 'Enterprise Dashboard project discussions', 'public', engineer_id),
    ('a0000000-7777-7777-7777-777777777777', 'brand-redesign', 'Brand Redesign project discussions', 'public', designer_id),
    ('b0000000-8888-8888-8888-888888888888', 'executive', 'Executive team discussions', 'private', ceo_id);
  
  -- Store channel IDs for later use
  SELECT id INTO general_channel_id FROM channels WHERE name = 'general';
  SELECT id INTO engineering_channel_id FROM channels WHERE name = 'engineering';
  SELECT id INTO design_channel_id FROM channels WHERE name = 'design';
  SELECT id INTO marketing_channel_id FROM channels WHERE name = 'marketing';
  SELECT id INTO mobile_app_channel_id FROM channels WHERE name = 'mobile-app';
  SELECT id INTO enterprise_dashboard_channel_id FROM channels WHERE name = 'enterprise-dashboard';
  SELECT id INTO brand_redesign_channel_id FROM channels WHERE name = 'brand-redesign';
  SELECT id INTO executive_channel_id FROM channels WHERE name = 'executive';
  
  -- Add channel members
  INSERT INTO channel_members (channel_id, user_id, role)
  VALUES
    -- General channel - everyone
    (general_channel_id, ceo_id, 'admin'),
    (general_channel_id, engineer_id, 'member'),
    (general_channel_id, designer_id, 'member'),
    (general_channel_id, marketing_id, 'member'),
    (general_channel_id, project_manager_id, 'member'),
    
    -- Engineering channel
    (engineering_channel_id, engineer_id, 'admin'),
    (engineering_channel_id, ceo_id, 'member'),
    (engineering_channel_id, project_manager_id, 'member'),
    
    -- Design channel
    (design_channel_id, designer_id, 'admin'),
    (design_channel_id, ceo_id, 'member'),
    (design_channel_id, project_manager_id, 'member'),
    
    -- Marketing channel
    (marketing_channel_id, marketing_id, 'admin'),
    (marketing_channel_id, ceo_id, 'member'),
    (marketing_channel_id, designer_id, 'member'),
    
    -- Mobile App channel
    (mobile_app_channel_id, engineer_id, 'admin'),
    (mobile_app_channel_id, designer_id, 'member'),
    (mobile_app_channel_id, project_manager_id, 'member'),
    
    -- Enterprise Dashboard channel
    (enterprise_dashboard_channel_id, engineer_id, 'admin'),
    (enterprise_dashboard_channel_id, designer_id, 'member'),
    (enterprise_dashboard_channel_id, project_manager_id, 'member'),
    
    -- Brand Redesign channel
    (brand_redesign_channel_id, designer_id, 'admin'),
    (brand_redesign_channel_id, marketing_id, 'member'),
    (brand_redesign_channel_id, project_manager_id, 'member'),
    
    -- Executive channel
    (executive_channel_id, ceo_id, 'admin'),
    (executive_channel_id, project_manager_id, 'member');
  
  -- Create Projects
  INSERT INTO projects (name, description, status, priority, start_date, end_date, budget, spent_budget, progress_percentage, project_manager_id, department_id, client_name)
  VALUES
    ('SimAlly Mobile App', 'Develop a mobile application version of SimAlly', 'active', 'high', CURRENT_DATE - INTERVAL '30 days', CURRENT_DATE + INTERVAL '90 days', 150000, 45000, 30, project_manager_id, department_id, 'Internal')
  RETURNING id INTO mobile_app_project_id;
  
  INSERT INTO projects (name, description, status, priority, start_date, end_date, budget, spent_budget, progress_percentage, project_manager_id, department_id, client_name)
  VALUES
    ('Enterprise Dashboard', 'Create an enterprise analytics dashboard for SimAlly', 'planning', 'medium', CURRENT_DATE + INTERVAL '15 days', CURRENT_DATE + INTERVAL '120 days', 200000, 10000, 5, project_manager_id, department_id, 'Acme Corp')
  RETURNING id INTO enterprise_dashboard_project_id;
  
  INSERT INTO projects (name, description, status, priority, start_date, end_date, budget, spent_budget, progress_percentage, project_manager_id, department_id, client_name)
  VALUES
    ('Brand Redesign', 'Refresh the SimAlly brand identity and website', 'active', 'high', CURRENT_DATE - INTERVAL '45 days', CURRENT_DATE + INTERVAL '15 days', 75000, 60000, 80, project_manager_id, department_id, 'Internal')
  RETURNING id INTO brand_redesign_project_id;
  
  -- Add project members
  INSERT INTO project_members (project_id, user_id, role, hourly_rate)
  VALUES
    -- Mobile App Project
    (mobile_app_project_id, project_manager_id, 'manager', 150),
    (mobile_app_project_id, engineer_id, 'lead', 125),
    (mobile_app_project_id, designer_id, 'member', 100),
    
    -- Enterprise Dashboard Project
    (enterprise_dashboard_project_id, project_manager_id, 'manager', 150),
    (enterprise_dashboard_project_id, engineer_id, 'lead', 125),
    (enterprise_dashboard_project_id, designer_id, 'member', 100),
    
    -- Brand Redesign Project
    (brand_redesign_project_id, project_manager_id, 'manager', 150),
    (brand_redesign_project_id, designer_id, 'lead', 125),
    (brand_redesign_project_id, marketing_id, 'member', 100);
  
  -- Add sample messages
  INSERT INTO messages (channel_id, sender_id, content, type)
  VALUES
    -- General channel
    (general_channel_id, ceo_id, 'Welcome everyone to our new SimAlly workspace!', 'text'),
    (general_channel_id, engineer_id, 'Thanks for setting this up, excited to collaborate here!', 'text'),
    (general_channel_id, designer_id, 'The interface looks great, very intuitive.', 'text'),
    (general_channel_id, marketing_id, 'Looking forward to coordinating our campaigns here.', 'text'),
    (general_channel_id, project_manager_id, 'This will definitely help us stay organized across projects.', 'text'),
    
    -- Engineering channel
    (engineering_channel_id, engineer_id, 'Let''s use this channel to discuss technical challenges and solutions.', 'text'),
    (engineering_channel_id, ceo_id, 'Great idea. What''s the status on the mobile app development?', 'text'),
    (engineering_channel_id, engineer_id, 'We''re making good progress. Frontend is about 40% complete, and backend APIs are 60% done.', 'text'),
    (engineering_channel_id, project_manager_id, 'Do we need to adjust the timeline for the beta release?', 'text'),
    (engineering_channel_id, engineer_id, 'I think we''re still on track for the planned release next month.', 'text'),
    
    -- Design channel
    (design_channel_id, designer_id, 'I''ve uploaded the latest mockups for the mobile app UI.', 'text'),
    (design_channel_id, project_manager_id, 'These look fantastic! Have you shared them with the engineering team?', 'text'),
    (design_channel_id, designer_id, 'Yes, Sam has them and we''re meeting tomorrow to discuss implementation details.', 'text'),
    
    -- Marketing channel
    (marketing_channel_id, marketing_id, 'The Q3 marketing plan is ready for review.', 'text'),
    (marketing_channel_id, ceo_id, 'Great, let''s discuss it in our meeting tomorrow.', 'text'),
    
    -- Mobile App channel
    (mobile_app_channel_id, engineer_id, 'I''ve pushed the latest code for the user authentication module.', 'text'),
    (mobile_app_channel_id, designer_id, 'The animation transitions look smooth now, great work!', 'text'),
    (mobile_app_channel_id, project_manager_id, 'We need to schedule a demo with the stakeholders next week.', 'text'),
    
    -- Enterprise Dashboard channel
    (enterprise_dashboard_channel_id, engineer_id, 'Starting work on the data visualization components today.', 'text'),
    (enterprise_dashboard_channel_id, designer_id, 'I''ll send over the dashboard wireframes by end of day.', 'text'),
    
    -- Brand Redesign channel
    (brand_redesign_channel_id, designer_id, 'The new logo concepts are ready for review.', 'text'),
    (brand_redesign_channel_id, marketing_id, 'These look great! I especially like option #3.', 'text'),
    
    -- Executive channel
    (executive_channel_id, ceo_id, 'Let''s discuss the Q4 strategic initiatives in our next meeting.', 'text'),
    (executive_channel_id, project_manager_id, 'I''ll prepare a summary of all ongoing projects for that discussion.', 'text');
  
  -- Add sample tasks
  INSERT INTO tasks (title, description, status, priority, due_date, created_by, project_id)
  VALUES
    -- Mobile App Tasks
    ('Implement user authentication', 'Create secure login and registration flows with JWT', 'in_progress', 'high', CURRENT_DATE + INTERVAL '7 days', engineer_id, mobile_app_project_id),
    ('Design onboarding screens', 'Create engaging onboarding experience for new users', 'todo', 'medium', CURRENT_DATE + INTERVAL '14 days', designer_id, mobile_app_project_id),
    ('Implement push notifications', 'Set up Firebase Cloud Messaging for real-time alerts', 'todo', 'medium', CURRENT_DATE + INTERVAL '21 days', engineer_id, mobile_app_project_id),
    ('Beta testing plan', 'Develop strategy for beta testing with select users', 'todo', 'high', CURRENT_DATE + INTERVAL '30 days', project_manager_id, mobile_app_project_id),
    
    -- Enterprise Dashboard Tasks
    ('Define dashboard requirements', 'Document all required metrics and visualizations', 'in_progress', 'high', CURRENT_DATE + INTERVAL '10 days', project_manager_id, enterprise_dashboard_project_id),
    ('Design dashboard wireframes', 'Create wireframes for all dashboard views', 'todo', 'high', CURRENT_DATE + INTERVAL '20 days', designer_id, enterprise_dashboard_project_id),
    ('Set up data pipeline', 'Create ETL processes for dashboard data', 'todo', 'medium', CURRENT_DATE + INTERVAL '25 days', engineer_id, enterprise_dashboard_project_id),
    
    -- Brand Redesign Tasks
    ('Finalize logo selection', 'Choose final logo design from concepts', 'in_progress', 'high', CURRENT_DATE + INTERVAL '5 days', designer_id, brand_redesign_project_id),
    ('Update website with new branding', 'Implement new visual identity on website', 'todo', 'high', CURRENT_DATE + INTERVAL '12 days', designer_id, brand_redesign_project_id),
    ('Create brand guidelines document', 'Develop comprehensive brand usage guidelines', 'todo', 'medium', CURRENT_DATE + INTERVAL '15 days', designer_id, brand_redesign_project_id),
    ('Prepare press release', 'Draft announcement for brand refresh', 'todo', 'medium', CURRENT_DATE + INTERVAL '10 days', marketing_id, brand_redesign_project_id);
  
  -- Add task assignments
  INSERT INTO task_assignments (task_id, user_id)
  SELECT id, created_by FROM tasks;
  
  -- Add analytics data
  INSERT INTO workspace_analytics (metric_name, metric_value, dimensions, date_recorded)
  VALUES
    ('active_projects', 3, '{"department": "Technology"}', CURRENT_DATE),
    ('completed_tasks', 12, '{"period": "last_30_days"}', CURRENT_DATE),
    ('team_productivity', 87.5, '{"period": "last_30_days"}', CURRENT_DATE),
    ('budget_utilization', 65.2, '{"period": "current_quarter"}', CURRENT_DATE),
    ('user_engagement', 92.3, '{"period": "last_30_days"}', CURRENT_DATE),
    ('project_velocity', 23.5, '{"period": "last_sprint"}', CURRENT_DATE),
    ('bug_resolution_time', 2.3, '{"period": "last_30_days"}', CURRENT_DATE),
    ('client_satisfaction', 4.7, '{"period": "last_quarter"}', CURRENT_DATE);
  
  -- Add time tracking entries
  INSERT INTO time_tracking (user_id, task_id, project_id, description, start_time, end_time, duration_minutes, billable, hourly_rate)
  VALUES
    -- Engineer time entries
    (engineer_id, (SELECT id FROM tasks WHERE title = 'Implement user authentication'), mobile_app_project_id, 'Working on authentication flow', CURRENT_DATE - INTERVAL '2 days' + INTERVAL '9 hours', CURRENT_DATE - INTERVAL '2 days' + INTERVAL '13 hours', 240, true, 125),
    (engineer_id, (SELECT id FROM tasks WHERE title = 'Implement user authentication'), mobile_app_project_id, 'Debugging JWT issues', CURRENT_DATE - INTERVAL '1 day' + INTERVAL '10 hours', CURRENT_DATE - INTERVAL '1 day' + INTERVAL '15 hours', 300, true, 125),
    
    -- Designer time entries
    (designer_id, (SELECT id FROM tasks WHERE title = 'Design onboarding screens'), mobile_app_project_id, 'Creating onboarding mockups', CURRENT_DATE - INTERVAL '3 days' + INTERVAL '9 hours', CURRENT_DATE - INTERVAL '3 days' + INTERVAL '17 hours', 480, true, 100),
    (designer_id, (SELECT id FROM tasks WHERE title = 'Finalize logo selection'), brand_redesign_project_id, 'Refining logo concepts', CURRENT_DATE - INTERVAL '1 day' + INTERVAL '13 hours', CURRENT_DATE - INTERVAL '1 day' + INTERVAL '18 hours', 300, true, 125),
    
    -- Project Manager time entries
    (project_manager_id, (SELECT id FROM tasks WHERE title = 'Define dashboard requirements'), enterprise_dashboard_project_id, 'Requirements gathering meeting', CURRENT_DATE - INTERVAL '2 days' + INTERVAL '11 hours', CURRENT_DATE - INTERVAL '2 days' + INTERVAL '13 hours', 120, true, 150),
    (project_manager_id, (SELECT id FROM tasks WHERE title = 'Beta testing plan'), mobile_app_project_id, 'Drafting beta test plan', CURRENT_DATE - INTERVAL '1 day' + INTERVAL '9 hours', CURRENT_DATE - INTERVAL '1 day' + INTERVAL '12 hours', 180, true, 150);
  
  -- Add calendar events
  INSERT INTO calendar_events (title, description, start_time, end_time, user_id)
  VALUES
    ('Weekly Team Meeting', 'Regular team sync-up', CURRENT_DATE + INTERVAL '1 day' + INTERVAL '10 hours', CURRENT_DATE + INTERVAL '1 day' + INTERVAL '11 hours', ceo_id),
    ('Mobile App Design Review', 'Review latest UI designs for the mobile app', CURRENT_DATE + INTERVAL '2 days' + INTERVAL '14 hours', CURRENT_DATE + INTERVAL '2 days' + INTERVAL '15 hours', designer_id),
    ('Client Presentation', 'Present Enterprise Dashboard progress to Acme Corp', CURRENT_DATE + INTERVAL '5 days' + INTERVAL '13 hours', CURRENT_DATE + INTERVAL '5 days' + INTERVAL '14 hours 30 minutes', project_manager_id),
    ('Brand Launch Planning', 'Prepare for the brand refresh launch', CURRENT_DATE + INTERVAL '7 days' + INTERVAL '11 hours', CURRENT_DATE + INTERVAL '7 days' + INTERVAL '12 hours 30 minutes', marketing_id);
  
  -- Add notifications
  INSERT INTO notifications (user_id, title, message, type, category, read, action_url)
  VALUES
    (engineer_id, 'Task Assigned', 'You have been assigned to implement user authentication', 'info', 'task', false, '/workspace?task=1'),
    (designer_id, 'Task Due Soon', 'Design onboarding screens task is due in 14 days', 'warning', 'task', false, '/workspace?task=2'),
    (project_manager_id, 'New Project', 'You have been assigned as manager for Enterprise Dashboard', 'info', 'project', false, '/workspace?project=2'),
    (marketing_id, 'Meeting Scheduled', 'Brand Launch Planning meeting scheduled for next week', 'info', 'meeting', false, '/meetings');
  
  -- Add user roles
  INSERT INTO user_roles (user_id, role_name, permissions)
  VALUES
    (ceo_id, 'admin', '{"can_manage_users": true, "can_manage_projects": true, "can_manage_departments": true}'),
    (project_manager_id, 'project_manager', '{"can_manage_projects": true, "can_manage_tasks": true}'),
    (engineer_id, 'member', '{"can_manage_tasks": true}'),
    (designer_id, 'member', '{"can_manage_tasks": true}'),
    (marketing_id, 'member', '{"can_manage_tasks": true}');
  
END $$;