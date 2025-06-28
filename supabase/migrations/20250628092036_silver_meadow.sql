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
  ON CONFLICT (username) DO NOTHING
  RETURNING id INTO ceo_id;
  
  -- If the user already exists, get their ID
  IF ceo_id IS NULL THEN
    SELECT id INTO ceo_id FROM user_accounts WHERE username = 'ceo';
  END IF;
  
  INSERT INTO profiles (id, full_name, username, status)
  VALUES (ceo_id, 'Alex Johnson', 'ceo', 'online')
  ON CONFLICT (id) DO NOTHING;
  
  -- Create Engineer account
  INSERT INTO user_accounts (username, password_hash, full_name, status)
  VALUES ('engineer', '$2a$10$XvOz0TQbUZT5.TUz5qxRzOGwzXLlDhE/ASaYJMrKV6jNyzDJg7vyW', 'Sam Chen', 'online')
  ON CONFLICT (username) DO NOTHING
  RETURNING id INTO engineer_id;
  
  -- If the user already exists, get their ID
  IF engineer_id IS NULL THEN
    SELECT id INTO engineer_id FROM user_accounts WHERE username = 'engineer';
  END IF;
  
  INSERT INTO profiles (id, full_name, username, status)
  VALUES (engineer_id, 'Sam Chen', 'engineer', 'online')
  ON CONFLICT (id) DO NOTHING;
  
  -- Create Designer account
  INSERT INTO user_accounts (username, password_hash, full_name, status)
  VALUES ('designer', '$2a$10$XvOz0TQbUZT5.TUz5qxRzOGwzXLlDhE/ASaYJMrKV6jNyzDJg7vyW', 'Maya Rodriguez', 'online')
  ON CONFLICT (username) DO NOTHING
  RETURNING id INTO designer_id;
  
  -- If the user already exists, get their ID
  IF designer_id IS NULL THEN
    SELECT id INTO designer_id FROM user_accounts WHERE username = 'designer';
  END IF;
  
  INSERT INTO profiles (id, full_name, username, status)
  VALUES (designer_id, 'Maya Rodriguez', 'designer', 'online')
  ON CONFLICT (id) DO NOTHING;
  
  -- Create Marketing account
  INSERT INTO user_accounts (username, password_hash, full_name, status)
  VALUES ('marketing', '$2a$10$XvOz0TQbUZT5.TUz5qxRzOGwzXLlDhE/ASaYJMrKV6jNyzDJg7vyW', 'Jordan Smith', 'online')
  ON CONFLICT (username) DO NOTHING
  RETURNING id INTO marketing_id;
  
  -- If the user already exists, get their ID
  IF marketing_id IS NULL THEN
    SELECT id INTO marketing_id FROM user_accounts WHERE username = 'marketing';
  END IF;
  
  INSERT INTO profiles (id, full_name, username, status)
  VALUES (marketing_id, 'Jordan Smith', 'marketing', 'online')
  ON CONFLICT (id) DO NOTHING;
  
  -- Create Project Manager account
  INSERT INTO user_accounts (username, password_hash, full_name, status)
  VALUES ('pm', '$2a$10$XvOz0TQbUZT5.TUz5qxRzOGwzXLlDhE/ASaYJMrKV6jNyzDJg7vyW', 'Taylor Wilson', 'online')
  ON CONFLICT (username) DO NOTHING
  RETURNING id INTO project_manager_id;
  
  -- If the user already exists, get their ID
  IF project_manager_id IS NULL THEN
    SELECT id INTO project_manager_id FROM user_accounts WHERE username = 'pm';
  END IF;
  
  INSERT INTO profiles (id, full_name, username, status)
  VALUES (project_manager_id, 'Taylor Wilson', 'pm', 'online')
  ON CONFLICT (id) DO NOTHING;
  
  -- Create Department - Check if it exists first
  SELECT id INTO department_id FROM departments WHERE name = 'Technology' AND head_id = ceo_id;
  
  IF department_id IS NULL THEN
    INSERT INTO departments (name, description, head_id)
    VALUES ('Technology', 'Engineering and Product Development', ceo_id)
    RETURNING id INTO department_id;
  END IF;
  
  -- Create Channels with valid hexadecimal UUIDs
  -- Check if channels already exist
  SELECT id INTO general_channel_id FROM channels WHERE name = 'general';
  IF general_channel_id IS NULL THEN
    INSERT INTO channels (id, name, description, type, created_by)
    VALUES ('aaaaaaaa-1111-1111-1111-111111111111', 'general', 'General company discussions', 'public', ceo_id)
    RETURNING id INTO general_channel_id;
  END IF;
  
  SELECT id INTO engineering_channel_id FROM channels WHERE name = 'engineering';
  IF engineering_channel_id IS NULL THEN
    INSERT INTO channels (id, name, description, type, created_by)
    VALUES ('bbbbbbbb-2222-2222-2222-222222222222', 'engineering', 'Engineering team discussions', 'public', engineer_id)
    RETURNING id INTO engineering_channel_id;
  END IF;
  
  SELECT id INTO design_channel_id FROM channels WHERE name = 'design';
  IF design_channel_id IS NULL THEN
    INSERT INTO channels (id, name, description, type, created_by)
    VALUES ('cccccccc-3333-3333-3333-333333333333', 'design', 'Design team discussions', 'public', designer_id)
    RETURNING id INTO design_channel_id;
  END IF;
  
  SELECT id INTO marketing_channel_id FROM channels WHERE name = 'marketing';
  IF marketing_channel_id IS NULL THEN
    INSERT INTO channels (id, name, description, type, created_by)
    VALUES ('dddddddd-4444-4444-4444-444444444444', 'marketing', 'Marketing team discussions', 'public', marketing_id)
    RETURNING id INTO marketing_channel_id;
  END IF;
  
  SELECT id INTO mobile_app_channel_id FROM channels WHERE name = 'mobile-app';
  IF mobile_app_channel_id IS NULL THEN
    INSERT INTO channels (id, name, description, type, created_by)
    VALUES ('eeeeeeee-5555-5555-5555-555555555555', 'mobile-app', 'SimAlly Mobile App project discussions', 'public', engineer_id)
    RETURNING id INTO mobile_app_channel_id;
  END IF;
  
  SELECT id INTO enterprise_dashboard_channel_id FROM channels WHERE name = 'enterprise-dashboard';
  IF enterprise_dashboard_channel_id IS NULL THEN
    INSERT INTO channels (id, name, description, type, created_by)
    VALUES ('ffffffff-6666-6666-6666-666666666666', 'enterprise-dashboard', 'Enterprise Dashboard project discussions', 'public', engineer_id)
    RETURNING id INTO enterprise_dashboard_channel_id;
  END IF;
  
  SELECT id INTO brand_redesign_channel_id FROM channels WHERE name = 'brand-redesign';
  IF brand_redesign_channel_id IS NULL THEN
    INSERT INTO channels (id, name, description, type, created_by)
    VALUES ('a0000000-7777-7777-7777-777777777777', 'brand-redesign', 'Brand Redesign project discussions', 'public', designer_id)
    RETURNING id INTO brand_redesign_channel_id;
  END IF;
  
  SELECT id INTO executive_channel_id FROM channels WHERE name = 'executive';
  IF executive_channel_id IS NULL THEN
    INSERT INTO channels (id, name, description, type, created_by)
    VALUES ('b0000000-8888-8888-8888-888888888888', 'executive', 'Executive team discussions', 'private', ceo_id)
    RETURNING id INTO executive_channel_id;
  END IF;
  
  -- Add channel members with conflict handling
  -- General channel - everyone
  INSERT INTO channel_members (channel_id, user_id, role)
  VALUES (general_channel_id, ceo_id, 'admin')
  ON CONFLICT (channel_id, user_id) DO NOTHING;
  
  INSERT INTO channel_members (channel_id, user_id, role)
  VALUES (general_channel_id, engineer_id, 'member')
  ON CONFLICT (channel_id, user_id) DO NOTHING;
  
  INSERT INTO channel_members (channel_id, user_id, role)
  VALUES (general_channel_id, designer_id, 'member')
  ON CONFLICT (channel_id, user_id) DO NOTHING;
  
  INSERT INTO channel_members (channel_id, user_id, role)
  VALUES (general_channel_id, marketing_id, 'member')
  ON CONFLICT (channel_id, user_id) DO NOTHING;
  
  INSERT INTO channel_members (channel_id, user_id, role)
  VALUES (general_channel_id, project_manager_id, 'member')
  ON CONFLICT (channel_id, user_id) DO NOTHING;
  
  -- Engineering channel
  INSERT INTO channel_members (channel_id, user_id, role)
  VALUES (engineering_channel_id, engineer_id, 'admin')
  ON CONFLICT (channel_id, user_id) DO NOTHING;
  
  INSERT INTO channel_members (channel_id, user_id, role)
  VALUES (engineering_channel_id, ceo_id, 'member')
  ON CONFLICT (channel_id, user_id) DO NOTHING;
  
  INSERT INTO channel_members (channel_id, user_id, role)
  VALUES (engineering_channel_id, project_manager_id, 'member')
  ON CONFLICT (channel_id, user_id) DO NOTHING;
  
  -- Design channel
  INSERT INTO channel_members (channel_id, user_id, role)
  VALUES (design_channel_id, designer_id, 'admin')
  ON CONFLICT (channel_id, user_id) DO NOTHING;
  
  INSERT INTO channel_members (channel_id, user_id, role)
  VALUES (design_channel_id, ceo_id, 'member')
  ON CONFLICT (channel_id, user_id) DO NOTHING;
  
  INSERT INTO channel_members (channel_id, user_id, role)
  VALUES (design_channel_id, project_manager_id, 'member')
  ON CONFLICT (channel_id, user_id) DO NOTHING;
  
  -- Marketing channel
  INSERT INTO channel_members (channel_id, user_id, role)
  VALUES (marketing_channel_id, marketing_id, 'admin')
  ON CONFLICT (channel_id, user_id) DO NOTHING;
  
  INSERT INTO channel_members (channel_id, user_id, role)
  VALUES (marketing_channel_id, ceo_id, 'member')
  ON CONFLICT (channel_id, user_id) DO NOTHING;
  
  INSERT INTO channel_members (channel_id, user_id, role)
  VALUES (marketing_channel_id, designer_id, 'member')
  ON CONFLICT (channel_id, user_id) DO NOTHING;
  
  -- Mobile App channel
  INSERT INTO channel_members (channel_id, user_id, role)
  VALUES (mobile_app_channel_id, engineer_id, 'admin')
  ON CONFLICT (channel_id, user_id) DO NOTHING;
  
  INSERT INTO channel_members (channel_id, user_id, role)
  VALUES (mobile_app_channel_id, designer_id, 'member')
  ON CONFLICT (channel_id, user_id) DO NOTHING;
  
  INSERT INTO channel_members (channel_id, user_id, role)
  VALUES (mobile_app_channel_id, project_manager_id, 'member')
  ON CONFLICT (channel_id, user_id) DO NOTHING;
  
  -- Enterprise Dashboard channel
  INSERT INTO channel_members (channel_id, user_id, role)
  VALUES (enterprise_dashboard_channel_id, engineer_id, 'admin')
  ON CONFLICT (channel_id, user_id) DO NOTHING;
  
  INSERT INTO channel_members (channel_id, user_id, role)
  VALUES (enterprise_dashboard_channel_id, designer_id, 'member')
  ON CONFLICT (channel_id, user_id) DO NOTHING;
  
  INSERT INTO channel_members (channel_id, user_id, role)
  VALUES (enterprise_dashboard_channel_id, project_manager_id, 'member')
  ON CONFLICT (channel_id, user_id) DO NOTHING;
  
  -- Brand Redesign channel
  INSERT INTO channel_members (channel_id, user_id, role)
  VALUES (brand_redesign_channel_id, designer_id, 'admin')
  ON CONFLICT (channel_id, user_id) DO NOTHING;
  
  INSERT INTO channel_members (channel_id, user_id, role)
  VALUES (brand_redesign_channel_id, marketing_id, 'member')
  ON CONFLICT (channel_id, user_id) DO NOTHING;
  
  INSERT INTO channel_members (channel_id, user_id, role)
  VALUES (brand_redesign_channel_id, project_manager_id, 'member')
  ON CONFLICT (channel_id, user_id) DO NOTHING;
  
  -- Executive channel
  INSERT INTO channel_members (channel_id, user_id, role)
  VALUES (executive_channel_id, ceo_id, 'admin')
  ON CONFLICT (channel_id, user_id) DO NOTHING;
  
  INSERT INTO channel_members (channel_id, user_id, role)
  VALUES (executive_channel_id, project_manager_id, 'member')
  ON CONFLICT (channel_id, user_id) DO NOTHING;
  
  -- Create Projects
  -- Check if projects already exist
  SELECT id INTO mobile_app_project_id FROM projects WHERE name = 'SimAlly Mobile App';
  IF mobile_app_project_id IS NULL THEN
    INSERT INTO projects (name, description, status, priority, start_date, end_date, budget, spent_budget, progress_percentage, project_manager_id, department_id, client_name)
    VALUES ('SimAlly Mobile App', 'Develop a mobile application version of SimAlly', 'active', 'high', CURRENT_DATE - INTERVAL '30 days', CURRENT_DATE + INTERVAL '90 days', 150000, 45000, 30, project_manager_id, department_id, 'Internal')
    RETURNING id INTO mobile_app_project_id;
  END IF;
  
  SELECT id INTO enterprise_dashboard_project_id FROM projects WHERE name = 'Enterprise Dashboard';
  IF enterprise_dashboard_project_id IS NULL THEN
    INSERT INTO projects (name, description, status, priority, start_date, end_date, budget, spent_budget, progress_percentage, project_manager_id, department_id, client_name)
    VALUES ('Enterprise Dashboard', 'Create an enterprise analytics dashboard for SimAlly', 'planning', 'medium', CURRENT_DATE + INTERVAL '15 days', CURRENT_DATE + INTERVAL '120 days', 200000, 10000, 5, project_manager_id, department_id, 'Acme Corp')
    RETURNING id INTO enterprise_dashboard_project_id;
  END IF;
  
  SELECT id INTO brand_redesign_project_id FROM projects WHERE name = 'Brand Redesign';
  IF brand_redesign_project_id IS NULL THEN
    INSERT INTO projects (name, description, status, priority, start_date, end_date, budget, spent_budget, progress_percentage, project_manager_id, department_id, client_name)
    VALUES ('Brand Redesign', 'Refresh the SimAlly brand identity and website', 'active', 'high', CURRENT_DATE - INTERVAL '45 days', CURRENT_DATE + INTERVAL '15 days', 75000, 60000, 80, project_manager_id, department_id, 'Internal')
    RETURNING id INTO brand_redesign_project_id;
  END IF;
  
  -- Add project members with conflict handling
  -- Mobile App Project
  INSERT INTO project_members (project_id, user_id, role, hourly_rate)
  VALUES (mobile_app_project_id, project_manager_id, 'manager', 150)
  ON CONFLICT (project_id, user_id) DO NOTHING;
  
  INSERT INTO project_members (project_id, user_id, role, hourly_rate)
  VALUES (mobile_app_project_id, engineer_id, 'lead', 125)
  ON CONFLICT (project_id, user_id) DO NOTHING;
  
  INSERT INTO project_members (project_id, user_id, role, hourly_rate)
  VALUES (mobile_app_project_id, designer_id, 'member', 100)
  ON CONFLICT (project_id, user_id) DO NOTHING;
  
  -- Enterprise Dashboard Project
  INSERT INTO project_members (project_id, user_id, role, hourly_rate)
  VALUES (enterprise_dashboard_project_id, project_manager_id, 'manager', 150)
  ON CONFLICT (project_id, user_id) DO NOTHING;
  
  INSERT INTO project_members (project_id, user_id, role, hourly_rate)
  VALUES (enterprise_dashboard_project_id, engineer_id, 'lead', 125)
  ON CONFLICT (project_id, user_id) DO NOTHING;
  
  INSERT INTO project_members (project_id, user_id, role, hourly_rate)
  VALUES (enterprise_dashboard_project_id, designer_id, 'member', 100)
  ON CONFLICT (project_id, user_id) DO NOTHING;
  
  -- Brand Redesign Project
  INSERT INTO project_members (project_id, user_id, role, hourly_rate)
  VALUES (brand_redesign_project_id, project_manager_id, 'manager', 150)
  ON CONFLICT (project_id, user_id) DO NOTHING;
  
  INSERT INTO project_members (project_id, user_id, role, hourly_rate)
  VALUES (brand_redesign_project_id, designer_id, 'lead', 125)
  ON CONFLICT (project_id, user_id) DO NOTHING;
  
  INSERT INTO project_members (project_id, user_id, role, hourly_rate)
  VALUES (brand_redesign_project_id, marketing_id, 'member', 100)
  ON CONFLICT (project_id, user_id) DO NOTHING;
  
  -- Add sample messages (only if they don't exist yet)
  -- We'll check if there are already messages in the channel
  IF NOT EXISTS (SELECT 1 FROM messages WHERE channel_id = general_channel_id LIMIT 1) THEN
    -- General channel
    INSERT INTO messages (channel_id, sender_id, content, type)
    VALUES
      (general_channel_id, ceo_id, 'Welcome everyone to our new SimAlly workspace!', 'text'),
      (general_channel_id, engineer_id, 'Thanks for setting this up, excited to collaborate here!', 'text'),
      (general_channel_id, designer_id, 'The interface looks great, very intuitive.', 'text'),
      (general_channel_id, marketing_id, 'Looking forward to coordinating our campaigns here.', 'text'),
      (general_channel_id, project_manager_id, 'This will definitely help us stay organized across projects.', 'text');
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM messages WHERE channel_id = engineering_channel_id LIMIT 1) THEN
    -- Engineering channel
    INSERT INTO messages (channel_id, sender_id, content, type)
    VALUES
      (engineering_channel_id, engineer_id, 'Let''s use this channel to discuss technical challenges and solutions.', 'text'),
      (engineering_channel_id, ceo_id, 'Great idea. What''s the status on the mobile app development?', 'text'),
      (engineering_channel_id, engineer_id, 'We''re making good progress. Frontend is about 40% complete, and backend APIs are 60% done.', 'text'),
      (engineering_channel_id, project_manager_id, 'Do we need to adjust the timeline for the beta release?', 'text'),
      (engineering_channel_id, engineer_id, 'I think we''re still on track for the planned release next month.', 'text');
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM messages WHERE channel_id = design_channel_id LIMIT 1) THEN
    -- Design channel
    INSERT INTO messages (channel_id, sender_id, content, type)
    VALUES
      (design_channel_id, designer_id, 'I''ve uploaded the latest mockups for the mobile app UI.', 'text'),
      (design_channel_id, project_manager_id, 'These look fantastic! Have you shared them with the engineering team?', 'text'),
      (design_channel_id, designer_id, 'Yes, Sam has them and we''re meeting tomorrow to discuss implementation details.', 'text');
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM messages WHERE channel_id = marketing_channel_id LIMIT 1) THEN
    -- Marketing channel
    INSERT INTO messages (channel_id, sender_id, content, type)
    VALUES
      (marketing_channel_id, marketing_id, 'The Q3 marketing plan is ready for review.', 'text'),
      (marketing_channel_id, ceo_id, 'Great, let''s discuss it in our meeting tomorrow.', 'text');
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM messages WHERE channel_id = mobile_app_channel_id LIMIT 1) THEN
    -- Mobile App channel
    INSERT INTO messages (channel_id, sender_id, content, type)
    VALUES
      (mobile_app_channel_id, engineer_id, 'I''ve pushed the latest code for the user authentication module.', 'text'),
      (mobile_app_channel_id, designer_id, 'The animation transitions look smooth now, great work!', 'text'),
      (mobile_app_channel_id, project_manager_id, 'We need to schedule a demo with the stakeholders next week.', 'text');
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM messages WHERE channel_id = enterprise_dashboard_channel_id LIMIT 1) THEN
    -- Enterprise Dashboard channel
    INSERT INTO messages (channel_id, sender_id, content, type)
    VALUES
      (enterprise_dashboard_channel_id, engineer_id, 'Starting work on the data visualization components today.', 'text'),
      (enterprise_dashboard_channel_id, designer_id, 'I''ll send over the dashboard wireframes by end of day.', 'text');
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM messages WHERE channel_id = brand_redesign_channel_id LIMIT 1) THEN
    -- Brand Redesign channel
    INSERT INTO messages (channel_id, sender_id, content, type)
    VALUES
      (brand_redesign_channel_id, designer_id, 'The new logo concepts are ready for review.', 'text'),
      (brand_redesign_channel_id, marketing_id, 'These look great! I especially like option #3.', 'text');
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM messages WHERE channel_id = executive_channel_id LIMIT 1) THEN
    -- Executive channel
    INSERT INTO messages (channel_id, sender_id, content, type)
    VALUES
      (executive_channel_id, ceo_id, 'Let''s discuss the Q4 strategic initiatives in our next meeting.', 'text'),
      (executive_channel_id, project_manager_id, 'I''ll prepare a summary of all ongoing projects for that discussion.', 'text');
  END IF;
  
  -- Add sample tasks (only if they don't exist yet)
  IF NOT EXISTS (SELECT 1 FROM tasks WHERE title = 'Implement user authentication' AND project_id = mobile_app_project_id) THEN
    -- Mobile App Tasks
    INSERT INTO tasks (title, description, status, priority, due_date, created_by, project_id)
    VALUES ('Implement user authentication', 'Create secure login and registration flows with JWT', 'in_progress', 'high', CURRENT_DATE + INTERVAL '7 days', engineer_id, mobile_app_project_id);
    
    -- Add task assignment
    INSERT INTO task_assignments (task_id, user_id)
    SELECT id, engineer_id FROM tasks WHERE title = 'Implement user authentication' AND project_id = mobile_app_project_id;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM tasks WHERE title = 'Design onboarding screens' AND project_id = mobile_app_project_id) THEN
    INSERT INTO tasks (title, description, status, priority, due_date, created_by, project_id)
    VALUES ('Design onboarding screens', 'Create engaging onboarding experience for new users', 'todo', 'medium', CURRENT_DATE + INTERVAL '14 days', designer_id, mobile_app_project_id);
    
    -- Add task assignment
    INSERT INTO task_assignments (task_id, user_id)
    SELECT id, designer_id FROM tasks WHERE title = 'Design onboarding screens' AND project_id = mobile_app_project_id;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM tasks WHERE title = 'Implement push notifications' AND project_id = mobile_app_project_id) THEN
    INSERT INTO tasks (title, description, status, priority, due_date, created_by, project_id)
    VALUES ('Implement push notifications', 'Set up Firebase Cloud Messaging for real-time alerts', 'todo', 'medium', CURRENT_DATE + INTERVAL '21 days', engineer_id, mobile_app_project_id);
    
    -- Add task assignment
    INSERT INTO task_assignments (task_id, user_id)
    SELECT id, engineer_id FROM tasks WHERE title = 'Implement push notifications' AND project_id = mobile_app_project_id;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM tasks WHERE title = 'Beta testing plan' AND project_id = mobile_app_project_id) THEN
    INSERT INTO tasks (title, description, status, priority, due_date, created_by, project_id)
    VALUES ('Beta testing plan', 'Develop strategy for beta testing with select users', 'todo', 'high', CURRENT_DATE + INTERVAL '30 days', project_manager_id, mobile_app_project_id);
    
    -- Add task assignment
    INSERT INTO task_assignments (task_id, user_id)
    SELECT id, project_manager_id FROM tasks WHERE title = 'Beta testing plan' AND project_id = mobile_app_project_id;
  END IF;
  
  -- Enterprise Dashboard Tasks
  IF NOT EXISTS (SELECT 1 FROM tasks WHERE title = 'Define dashboard requirements' AND project_id = enterprise_dashboard_project_id) THEN
    INSERT INTO tasks (title, description, status, priority, due_date, created_by, project_id)
    VALUES ('Define dashboard requirements', 'Document all required metrics and visualizations', 'in_progress', 'high', CURRENT_DATE + INTERVAL '10 days', project_manager_id, enterprise_dashboard_project_id);
    
    -- Add task assignment
    INSERT INTO task_assignments (task_id, user_id)
    SELECT id, project_manager_id FROM tasks WHERE title = 'Define dashboard requirements' AND project_id = enterprise_dashboard_project_id;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM tasks WHERE title = 'Design dashboard wireframes' AND project_id = enterprise_dashboard_project_id) THEN
    INSERT INTO tasks (title, description, status, priority, due_date, created_by, project_id)
    VALUES ('Design dashboard wireframes', 'Create wireframes for all dashboard views', 'todo', 'high', CURRENT_DATE + INTERVAL '20 days', designer_id, enterprise_dashboard_project_id);
    
    -- Add task assignment
    INSERT INTO task_assignments (task_id, user_id)
    SELECT id, designer_id FROM tasks WHERE title = 'Design dashboard wireframes' AND project_id = enterprise_dashboard_project_id;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM tasks WHERE title = 'Set up data pipeline' AND project_id = enterprise_dashboard_project_id) THEN
    INSERT INTO tasks (title, description, status, priority, due_date, created_by, project_id)
    VALUES ('Set up data pipeline', 'Create ETL processes for dashboard data', 'todo', 'medium', CURRENT_DATE + INTERVAL '25 days', engineer_id, enterprise_dashboard_project_id);
    
    -- Add task assignment
    INSERT INTO task_assignments (task_id, user_id)
    SELECT id, engineer_id FROM tasks WHERE title = 'Set up data pipeline' AND project_id = enterprise_dashboard_project_id;
  END IF;
  
  -- Brand Redesign Tasks
  IF NOT EXISTS (SELECT 1 FROM tasks WHERE title = 'Finalize logo selection' AND project_id = brand_redesign_project_id) THEN
    INSERT INTO tasks (title, description, status, priority, due_date, created_by, project_id)
    VALUES ('Finalize logo selection', 'Choose final logo design from concepts', 'in_progress', 'high', CURRENT_DATE + INTERVAL '5 days', designer_id, brand_redesign_project_id);
    
    -- Add task assignment
    INSERT INTO task_assignments (task_id, user_id)
    SELECT id, designer_id FROM tasks WHERE title = 'Finalize logo selection' AND project_id = brand_redesign_project_id;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM tasks WHERE title = 'Update website with new branding' AND project_id = brand_redesign_project_id) THEN
    INSERT INTO tasks (title, description, status, priority, due_date, created_by, project_id)
    VALUES ('Update website with new branding', 'Implement new visual identity on website', 'todo', 'high', CURRENT_DATE + INTERVAL '12 days', designer_id, brand_redesign_project_id);
    
    -- Add task assignment
    INSERT INTO task_assignments (task_id, user_id)
    SELECT id, designer_id FROM tasks WHERE title = 'Update website with new branding' AND project_id = brand_redesign_project_id;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM tasks WHERE title = 'Create brand guidelines document' AND project_id = brand_redesign_project_id) THEN
    INSERT INTO tasks (title, description, status, priority, due_date, created_by, project_id)
    VALUES ('Create brand guidelines document', 'Develop comprehensive brand usage guidelines', 'todo', 'medium', CURRENT_DATE + INTERVAL '15 days', designer_id, brand_redesign_project_id);
    
    -- Add task assignment
    INSERT INTO task_assignments (task_id, user_id)
    SELECT id, designer_id FROM tasks WHERE title = 'Create brand guidelines document' AND project_id = brand_redesign_project_id;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM tasks WHERE title = 'Prepare press release' AND project_id = brand_redesign_project_id) THEN
    INSERT INTO tasks (title, description, status, priority, due_date, created_by, project_id)
    VALUES ('Prepare press release', 'Draft announcement for brand refresh', 'todo', 'medium', CURRENT_DATE + INTERVAL '10 days', marketing_id, brand_redesign_project_id);
    
    -- Add task assignment
    INSERT INTO task_assignments (task_id, user_id)
    SELECT id, marketing_id FROM tasks WHERE title = 'Prepare press release' AND project_id = brand_redesign_project_id;
  END IF;
  
  -- Add analytics data (only if they don't exist yet)
  IF NOT EXISTS (SELECT 1 FROM workspace_analytics WHERE metric_name = 'active_projects' AND date_recorded = CURRENT_DATE) THEN
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
  END IF;
  
  -- Add time tracking entries (only if they don't exist yet)
  IF NOT EXISTS (SELECT 1 FROM time_tracking WHERE user_id = engineer_id AND description = 'Working on authentication flow') THEN
    -- Engineer time entries
    INSERT INTO time_tracking (user_id, task_id, project_id, description, start_time, end_time, duration_minutes, billable, hourly_rate)
    VALUES (engineer_id, 
           (SELECT id FROM tasks WHERE title = 'Implement user authentication' AND project_id = mobile_app_project_id LIMIT 1), 
           mobile_app_project_id, 
           'Working on authentication flow', 
           CURRENT_DATE - INTERVAL '2 days' + INTERVAL '9 hours', 
           CURRENT_DATE - INTERVAL '2 days' + INTERVAL '13 hours', 
           240, true, 125);
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM time_tracking WHERE user_id = engineer_id AND description = 'Debugging JWT issues') THEN
    INSERT INTO time_tracking (user_id, task_id, project_id, description, start_time, end_time, duration_minutes, billable, hourly_rate)
    VALUES (engineer_id, 
           (SELECT id FROM tasks WHERE title = 'Implement user authentication' AND project_id = mobile_app_project_id LIMIT 1), 
           mobile_app_project_id, 
           'Debugging JWT issues', 
           CURRENT_DATE - INTERVAL '1 day' + INTERVAL '10 hours', 
           CURRENT_DATE - INTERVAL '1 day' + INTERVAL '15 hours', 
           300, true, 125);
  END IF;
  
  -- Designer time entries
  IF NOT EXISTS (SELECT 1 FROM time_tracking WHERE user_id = designer_id AND description = 'Creating onboarding mockups') THEN
    INSERT INTO time_tracking (user_id, task_id, project_id, description, start_time, end_time, duration_minutes, billable, hourly_rate)
    VALUES (designer_id, 
           (SELECT id FROM tasks WHERE title = 'Design onboarding screens' AND project_id = mobile_app_project_id LIMIT 1), 
           mobile_app_project_id, 
           'Creating onboarding mockups', 
           CURRENT_DATE - INTERVAL '3 days' + INTERVAL '9 hours', 
           CURRENT_DATE - INTERVAL '3 days' + INTERVAL '17 hours', 
           480, true, 100);
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM time_tracking WHERE user_id = designer_id AND description = 'Refining logo concepts') THEN
    INSERT INTO time_tracking (user_id, task_id, project_id, description, start_time, end_time, duration_minutes, billable, hourly_rate)
    VALUES (designer_id, 
           (SELECT id FROM tasks WHERE title = 'Finalize logo selection' AND project_id = brand_redesign_project_id LIMIT 1), 
           brand_redesign_project_id, 
           'Refining logo concepts', 
           CURRENT_DATE - INTERVAL '1 day' + INTERVAL '13 hours', 
           CURRENT_DATE - INTERVAL '1 day' + INTERVAL '18 hours', 
           300, true, 125);
  END IF;
  
  -- Project Manager time entries
  IF NOT EXISTS (SELECT 1 FROM time_tracking WHERE user_id = project_manager_id AND description = 'Requirements gathering meeting') THEN
    INSERT INTO time_tracking (user_id, task_id, project_id, description, start_time, end_time, duration_minutes, billable, hourly_rate)
    VALUES (project_manager_id, 
           (SELECT id FROM tasks WHERE title = 'Define dashboard requirements' AND project_id = enterprise_dashboard_project_id LIMIT 1), 
           enterprise_dashboard_project_id, 
           'Requirements gathering meeting', 
           CURRENT_DATE - INTERVAL '2 days' + INTERVAL '11 hours', 
           CURRENT_DATE - INTERVAL '2 days' + INTERVAL '13 hours', 
           120, true, 150);
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM time_tracking WHERE user_id = project_manager_id AND description = 'Drafting beta test plan') THEN
    INSERT INTO time_tracking (user_id, task_id, project_id, description, start_time, end_time, duration_minutes, billable, hourly_rate)
    VALUES (project_manager_id, 
           (SELECT id FROM tasks WHERE title = 'Beta testing plan' AND project_id = mobile_app_project_id LIMIT 1), 
           mobile_app_project_id, 
           'Drafting beta test plan', 
           CURRENT_DATE - INTERVAL '1 day' + INTERVAL '9 hours', 
           CURRENT_DATE - INTERVAL '1 day' + INTERVAL '12 hours', 
           180, true, 150);
  END IF;
  
  -- Add calendar events (only if they don't exist yet)
  IF NOT EXISTS (SELECT 1 FROM calendar_events WHERE title = 'Weekly Team Meeting' AND user_id = ceo_id) THEN
    INSERT INTO calendar_events (title, description, start_time, end_time, user_id)
    VALUES ('Weekly Team Meeting', 'Regular team sync-up', CURRENT_DATE + INTERVAL '1 day' + INTERVAL '10 hours', CURRENT_DATE + INTERVAL '1 day' + INTERVAL '11 hours', ceo_id);
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM calendar_events WHERE title = 'Mobile App Design Review' AND user_id = designer_id) THEN
    INSERT INTO calendar_events (title, description, start_time, end_time, user_id)
    VALUES ('Mobile App Design Review', 'Review latest UI designs for the mobile app', CURRENT_DATE + INTERVAL '2 days' + INTERVAL '14 hours', CURRENT_DATE + INTERVAL '2 days' + INTERVAL '15 hours', designer_id);
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM calendar_events WHERE title = 'Client Presentation' AND user_id = project_manager_id) THEN
    INSERT INTO calendar_events (title, description, start_time, end_time, user_id)
    VALUES ('Client Presentation', 'Present Enterprise Dashboard progress to Acme Corp', CURRENT_DATE + INTERVAL '5 days' + INTERVAL '13 hours', CURRENT_DATE + INTERVAL '5 days' + INTERVAL '14 hours 30 minutes', project_manager_id);
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM calendar_events WHERE title = 'Brand Launch Planning' AND user_id = marketing_id) THEN
    INSERT INTO calendar_events (title, description, start_time, end_time, user_id)
    VALUES ('Brand Launch Planning', 'Prepare for the brand refresh launch', CURRENT_DATE + INTERVAL '7 days' + INTERVAL '11 hours', CURRENT_DATE + INTERVAL '7 days' + INTERVAL '12 hours 30 minutes', marketing_id);
  END IF;
  
  -- Add notifications (only if they don't exist yet)
  IF NOT EXISTS (SELECT 1 FROM notifications WHERE title = 'Task Assigned' AND user_id = engineer_id) THEN
    INSERT INTO notifications (user_id, title, message, type, category, read, action_url)
    VALUES (engineer_id, 'Task Assigned', 'You have been assigned to implement user authentication', 'info', 'task', false, '/workspace?task=1');
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM notifications WHERE title = 'Task Due Soon' AND user_id = designer_id) THEN
    INSERT INTO notifications (user_id, title, message, type, category, read, action_url)
    VALUES (designer_id, 'Task Due Soon', 'Design onboarding screens task is due in 14 days', 'warning', 'task', false, '/workspace?task=2');
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM notifications WHERE title = 'New Project' AND user_id = project_manager_id) THEN
    INSERT INTO notifications (user_id, title, message, type, category, read, action_url)
    VALUES (project_manager_id, 'New Project', 'You have been assigned as manager for Enterprise Dashboard', 'info', 'project', false, '/workspace?project=2');
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM notifications WHERE title = 'Meeting Scheduled' AND user_id = marketing_id) THEN
    INSERT INTO notifications (user_id, title, message, type, category, read, action_url)
    VALUES (marketing_id, 'Meeting Scheduled', 'Brand Launch Planning meeting scheduled for next week', 'info', 'meeting', false, '/meetings');
  END IF;
  
  -- Add user roles (only if they don't exist yet)
  IF NOT EXISTS (SELECT 1 FROM user_roles WHERE user_id = ceo_id AND role_name = 'admin') THEN
    INSERT INTO user_roles (user_id, role_name, permissions)
    VALUES (ceo_id, 'admin', '{"can_manage_users": true, "can_manage_projects": true, "can_manage_departments": true}');
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM user_roles WHERE user_id = project_manager_id AND role_name = 'project_manager') THEN
    INSERT INTO user_roles (user_id, role_name, permissions)
    VALUES (project_manager_id, 'project_manager', '{"can_manage_projects": true, "can_manage_tasks": true}');
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM user_roles WHERE user_id = engineer_id AND role_name = 'member') THEN
    INSERT INTO user_roles (user_id, role_name, permissions)
    VALUES (engineer_id, 'member', '{"can_manage_tasks": true}');
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM user_roles WHERE user_id = designer_id AND role_name = 'member') THEN
    INSERT INTO user_roles (user_id, role_name, permissions)
    VALUES (designer_id, 'member', '{"can_manage_tasks": true}');
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM user_roles WHERE user_id = marketing_id AND role_name = 'member') THEN
    INSERT INTO user_roles (user_id, role_name, permissions)
    VALUES (marketing_id, 'member', '{"can_manage_tasks": true}');
  END IF;
  
END $$;