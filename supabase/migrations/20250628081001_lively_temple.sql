-- Insert demo departments
INSERT INTO departments (id, name, description, budget) VALUES
  ('11111111-1111-1111-1111-111111111111', 'Engineering', 'Software development and technical operations', 500000.00),
  ('22222222-2222-2222-2222-222222222222', 'Product Management', 'Product strategy and roadmap planning', 200000.00),
  ('33333333-3333-3333-3333-333333333333', 'Design', 'User experience and visual design', 150000.00),
  ('44444444-4444-4444-4444-444444444444', 'Marketing', 'Brand promotion and customer acquisition', 300000.00),
  ('55555555-5555-5555-5555-555555555555', 'Sales', 'Revenue generation and client relations', 250000.00);

-- Insert demo projects
INSERT INTO projects (id, name, description, status, priority, start_date, end_date, budget, progress_percentage, department_id, client_name) VALUES
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'SimAlly Mobile App', 'Native mobile application for iOS and Android', 'active', 'high', '2024-01-15', '2024-06-30', 150000.00, 65, '11111111-1111-1111-1111-111111111111', 'Internal'),
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'Enterprise Dashboard', 'Advanced analytics dashboard for enterprise clients', 'active', 'critical', '2024-02-01', '2024-05-15', 200000.00, 80, '11111111-1111-1111-1111-111111111111', 'TechCorp Inc'),
  ('cccccccc-cccc-cccc-cccc-cccccccccccc', 'AI Integration Platform', 'Machine learning integration and automation tools', 'planning', 'high', '2024-03-01', '2024-08-30', 300000.00, 15, '11111111-1111-1111-1111-111111111111', 'AI Solutions Ltd'),
  ('dddddddd-dddd-dddd-dddd-dddddddddddd', 'Brand Redesign Campaign', 'Complete brand identity and marketing material redesign', 'active', 'medium', '2024-01-20', '2024-04-20', 75000.00, 45, '33333333-3333-3333-3333-333333333333', 'Internal'),
  ('eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee', 'Customer Onboarding Flow', 'Streamlined user onboarding experience', 'completed', 'high', '2023-11-01', '2024-01-31', 50000.00, 100, '22222222-2222-2222-2222-222222222222', 'Internal');

-- Insert demo project milestones
INSERT INTO project_milestones (project_id, name, description, due_date, status) VALUES
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'MVP Release', 'Minimum viable product for beta testing', '2024-04-15', 'completed'),
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'App Store Submission', 'Submit to iOS and Android app stores', '2024-06-01', 'pending'),
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'Alpha Version', 'Internal testing version', '2024-03-15', 'completed'),
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'Client Demo', 'Live demonstration to client', '2024-04-30', 'pending'),
  ('cccccccc-cccc-cccc-cccc-cccccccccccc', 'Technical Specification', 'Complete technical documentation', '2024-03-15', 'pending');

-- Get a user ID to use as created_by for tasks
DO $$
DECLARE
  user_id uuid;
BEGIN
  -- Get the first user ID from profiles table
  SELECT id INTO user_id FROM profiles LIMIT 1;
  
  -- If no user exists, insert a demo user
  IF user_id IS NULL THEN
    INSERT INTO profiles (id, full_name, username, status)
    VALUES (gen_random_uuid(), 'Demo User', 'demouser', 'online')
    RETURNING id INTO user_id;
  END IF;

  -- Insert enhanced demo tasks with project assignments and created_by
  -- Note: Using 'urgent' instead of 'critical' for priority to match the check constraint
  INSERT INTO tasks (id, title, description, status, priority, due_date, project_id, estimated_hours, story_points, tags, created_by) VALUES
    ('11111111-aaaa-bbbb-cccc-dddddddddddd', 'Implement user authentication', 'Build secure login and registration system with OAuth support', 'completed', 'high', '2024-02-15', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 40.0, 8, ARRAY['backend', 'security'], user_id),
    ('22222222-aaaa-bbbb-cccc-dddddddddddd', 'Design mobile UI components', 'Create reusable UI component library for mobile app', 'in_progress', 'medium', '2024-03-20', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 60.0, 13, ARRAY['frontend', 'design'], user_id),
    ('33333333-aaaa-bbbb-cccc-dddddddddddd', 'Set up CI/CD pipeline', 'Automated testing and deployment pipeline', 'todo', 'high', '2024-03-30', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 24.0, 5, ARRAY['devops', 'automation'], user_id),
    ('44444444-aaaa-bbbb-cccc-dddddddddddd', 'Build analytics dashboard', 'Real-time data visualization and reporting', 'in_progress', 'urgent', '2024-04-10', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 80.0, 21, ARRAY['frontend', 'analytics'], user_id),
    ('55555555-aaaa-bbbb-cccc-dddddddddddd', 'API performance optimization', 'Optimize database queries and API response times', 'todo', 'high', '2024-04-05', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 32.0, 8, ARRAY['backend', 'performance'], user_id),
    ('66666666-aaaa-bbbb-cccc-dddddddddddd', 'User research and testing', 'Conduct user interviews and usability testing', 'completed', 'medium', '2024-02-28', 'dddddddd-dddd-dddd-dddd-dddddddddddd', 20.0, 3, ARRAY['research', 'ux'], user_id),
    ('77777777-aaaa-bbbb-cccc-dddddddddddd', 'Brand guidelines documentation', 'Create comprehensive brand style guide', 'in_progress', 'medium', '2024-03-25', 'dddddddd-dddd-dddd-dddd-dddddddddddd', 16.0, 2, ARRAY['documentation', 'branding'], user_id),
    ('88888888-aaaa-bbbb-cccc-dddddddddddd', 'Machine learning model training', 'Train and validate AI models for recommendation engine', 'todo', 'high', '2024-05-15', 'cccccccc-cccc-cccc-cccc-cccccccccccc', 120.0, 34, ARRAY['ai', 'ml', 'backend'], user_id);

  -- Insert task comments with user_id
  INSERT INTO task_comments (task_id, user_id, content) VALUES
    ('11111111-aaaa-bbbb-cccc-dddddddddddd', user_id, 'Authentication system is working well. Added support for Google and GitHub OAuth.'),
    ('22222222-aaaa-bbbb-cccc-dddddddddddd', user_id, 'Making good progress on the component library. Need feedback on the color scheme.'),
    ('44444444-aaaa-bbbb-cccc-dddddddddddd', user_id, 'Dashboard is looking great! Client will love the real-time updates feature.'),
    ('77777777-aaaa-bbbb-cccc-dddddddddddd', user_id, 'Brand guidelines are almost complete. Just need final approval from marketing team.');

  -- Insert time tracking entries
  INSERT INTO time_tracking (user_id, task_id, project_id, description, start_time, end_time, duration_minutes, billable, hourly_rate) VALUES
    (user_id, '11111111-aaaa-bbbb-cccc-dddddddddddd', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'Implementing OAuth integration', '2024-02-10 09:00:00', '2024-02-10 17:00:00', 480, true, 85.00),
    (user_id, '22222222-aaaa-bbbb-cccc-dddddddddddd', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'Designing button components', '2024-03-15 10:00:00', '2024-03-15 14:30:00', 270, true, 75.00),
    (user_id, '44444444-aaaa-bbbb-cccc-dddddddddddd', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'Building chart components', '2024-03-20 09:30:00', '2024-03-20 18:00:00', 510, true, 90.00);

  -- Insert notifications for this user
  INSERT INTO notifications (user_id, title, message, type, category, action_url) VALUES
    (user_id, 'New Project Assignment', 'You have been assigned to the SimAlly Mobile App project', 'info', 'project', '/workspace?project=aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'),
    (user_id, 'Task Due Soon', 'Task "Design mobile UI components" is due in 2 days', 'warning', 'task', '/workspace?task=22222222-aaaa-bbbb-cccc-dddddddddddd'),
    (user_id, 'Milestone Completed', 'MVP Release milestone has been completed!', 'success', 'project', '/workspace?project=aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'),
    (user_id, 'Meeting Reminder', 'Daily standup meeting starts in 15 minutes', 'info', 'meeting', '/meetings'),
    (user_id, 'Budget Alert', 'Project "Enterprise Dashboard" is at 80% budget utilization', 'warning', 'project', '/workspace?project=bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb');

  -- Insert meeting recordings with host_id
  INSERT INTO meeting_recordings (meeting_room, title, duration_minutes, participants, host_id, summary, action_items) VALUES
    ('daily-standup-eng', 'Engineering Daily Standup - March 20', 15, ARRAY['Alice Johnson', 'Bob Smith', 'Carol Davis'], user_id,
     'Team discussed progress on mobile app development. Authentication system completed, UI components in progress. Identified blocker with API integration.',
     ARRAY['Bob to resolve API integration issue by Friday', 'Carol to review UI component designs', 'Schedule architecture review meeting']),
    ('project-kickoff-ai', 'AI Integration Platform Kickoff', 60, ARRAY['David Wilson', 'Eve Brown', 'Frank Miller'], user_id,
     'Kicked off new AI integration project. Discussed technical requirements, timeline, and resource allocation. Team excited about ML opportunities.',
     ARRAY['David to create technical specification document', 'Eve to set up development environment', 'Frank to research ML frameworks']),
    ('client-demo-dashboard', 'Enterprise Dashboard Client Demo', 45, ARRAY['Alice Johnson', 'TechCorp Team'], user_id,
     'Successful demo of analytics dashboard to TechCorp. Client impressed with real-time features and customization options. Discussed additional requirements.',
     ARRAY['Implement custom reporting features', 'Add role-based access controls', 'Schedule follow-up meeting for next week']);
     
  -- Insert reports with generated_by
  INSERT INTO reports (name, type, status, parameters, generated_by) VALUES
    ('Q1 2024 Project Performance', 'project', 'completed', '{"quarter": "Q1", "year": 2024, "include_budget": true}', user_id),
    ('Team Productivity Analysis', 'productivity', 'completed', '{"period": "monthly", "teams": ["engineering", "design"]}', user_id),
    ('Time Tracking Summary', 'time', 'completed', '{"start_date": "2024-03-01", "end_date": "2024-03-31"}', user_id),
    ('Budget Utilization Report', 'financial', 'generating', '{"projects": ["all"], "include_forecasts": true}', user_id);
    
  -- Insert integrations with created_by
  INSERT INTO integrations (name, type, config, enabled, last_sync, created_by) VALUES
    ('Slack Notifications', 'messaging', '{"webhook_url": "https://hooks.slack.com/...", "channels": ["#general", "#dev"]}', true, NOW() - INTERVAL '2 hours', user_id),
    ('GitHub Integration', 'version_control', '{"repository": "simally/webapp", "sync_commits": true}', true, NOW() - INTERVAL '30 minutes', user_id),
    ('Jira Sync', 'project_management', '{"project_key": "SIM", "sync_issues": true}', false, NOW() - INTERVAL '1 day', user_id),
    ('Google Calendar', 'calendar', '{"calendar_id": "team@simally.com", "sync_meetings": true}', true, NOW() - INTERVAL '1 hour', user_id);
    
  -- Add activity logs
  INSERT INTO activity_logs (user_id, action, resource_type, resource_id, new_values) VALUES
    (user_id, 'INSERT', 'projects', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '{"name": "SimAlly Mobile App", "status": "active"}'),
    (user_id, 'UPDATE', 'tasks', '11111111-aaaa-bbbb-cccc-dddddddddddd', '{"status": "completed"}'),
    (user_id, 'INSERT', 'time_tracking', gen_random_uuid(), '{"duration_minutes": 480, "billable": true}');
END $$;

-- Insert task dependencies
INSERT INTO task_dependencies (task_id, depends_on_task_id, dependency_type) VALUES
  ('22222222-aaaa-bbbb-cccc-dddddddddddd', '11111111-aaaa-bbbb-cccc-dddddddddddd', 'finish_to_start'),
  ('33333333-aaaa-bbbb-cccc-dddddddddddd', '11111111-aaaa-bbbb-cccc-dddddddddddd', 'finish_to_start'),
  ('55555555-aaaa-bbbb-cccc-dddddddddddd', '44444444-aaaa-bbbb-cccc-dddddddddddd', 'start_to_start');

-- Insert workspace analytics
INSERT INTO workspace_analytics (metric_name, metric_value, dimensions, date_recorded) VALUES
  ('active_projects', 4, '{"department": "engineering"}', CURRENT_DATE),
  ('completed_tasks', 156, '{"month": "march", "year": "2024"}', CURRENT_DATE),
  ('team_productivity', 87.5, '{"metric": "percentage", "period": "weekly"}', CURRENT_DATE),
  ('budget_utilization', 65.2, '{"metric": "percentage", "period": "quarterly"}', CURRENT_DATE),
  ('user_engagement', 92.3, '{"metric": "percentage", "period": "daily"}', CURRENT_DATE),
  ('project_velocity', 23.5, '{"metric": "story_points_per_sprint"}', CURRENT_DATE),
  ('bug_resolution_time', 2.4, '{"metric": "days_average"}', CURRENT_DATE),
  ('client_satisfaction', 4.7, '{"metric": "rating_out_of_5"}', CURRENT_DATE);

-- Update projects with realistic spent budget
UPDATE projects SET spent_budget = budget * (progress_percentage / 100.0) * 0.8;