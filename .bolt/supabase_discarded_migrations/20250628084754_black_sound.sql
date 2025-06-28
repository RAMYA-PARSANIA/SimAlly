/*
  # Demo Data for SimAlly Workspace
  
  1. New Data
    - Creates demo departments, projects, tasks, and other workspace entities
    - Sets up relationships between users, projects, and tasks
    - Populates channels with messages and activity
    - Creates realistic workspace analytics data
  
  2. Security
    - Uses existing user accounts for data relationships
    - Maintains all RLS policies
*/

-- Find the user IDs for our demo accounts
DO $$
DECLARE
  ceo_id uuid;
  engineer_id uuid;
  designer_id uuid;
  marketing_id uuid;
BEGIN
  -- Get user IDs by username
  SELECT id INTO ceo_id FROM profiles WHERE username = 'ceo_user';
  SELECT id INTO engineer_id FROM profiles WHERE username = 'eng_user';
  SELECT id INTO designer_id FROM profiles WHERE username = 'des_user';
  SELECT id INTO marketing_id FROM profiles WHERE username = 'mkt_user';
  
  -- Create departments
  INSERT INTO departments (id, name, description, budget, head_id) VALUES
    ('d0001111-1111-1111-1111-111111111111', 'Executive', 'Company leadership and strategic direction', 1000000.00, ceo_id),
    ('d0002222-2222-2222-2222-222222222222', 'Engineering', 'Software development and technical operations', 500000.00, engineer_id),
    ('d0003333-3333-3333-3333-333333333333', 'Design', 'User experience and visual design', 250000.00, designer_id),
    ('d0004444-4444-4444-4444-444444444444', 'Marketing', 'Brand promotion and customer acquisition', 350000.00, marketing_id);

  -- Create projects
  INSERT INTO projects (id, name, description, status, priority, start_date, end_date, budget, spent_budget, progress_percentage, project_manager_id, department_id, client_name) VALUES
    ('p0001111-1111-1111-1111-111111111111', 'SimAlly Mobile App', 'Native mobile application for iOS and Android', 'active', 'high', '2024-01-15', '2024-06-30', 150000.00, 97500.00, 65, engineer_id, 'd0002222-2222-2222-2222-222222222222', 'Internal'),
    ('p0002222-2222-2222-2222-222222222222', 'Enterprise Dashboard', 'Advanced analytics dashboard for enterprise clients', 'active', 'high', '2024-02-01', '2024-05-15', 200000.00, 160000.00, 80, engineer_id, 'd0002222-2222-2222-2222-222222222222', 'TechCorp Inc'),
    ('p0003333-3333-3333-3333-333333333333', 'Brand Redesign', 'Complete brand identity and marketing material redesign', 'active', 'medium', '2024-01-20', '2024-04-20', 75000.00, 33750.00, 45, designer_id, 'd0003333-3333-3333-3333-333333333333', 'Internal'),
    ('p0004444-4444-4444-4444-444444444444', 'Q2 Marketing Campaign', 'Comprehensive marketing campaign for Q2 product launch', 'planning', 'high', '2024-04-01', '2024-06-30', 120000.00, 12000.00, 10, marketing_id, 'd0004444-4444-4444-4444-444444444444', 'Internal'),
    ('p0005555-5555-5555-5555-555555555555', 'AI Integration Platform', 'Machine learning integration and automation tools', 'planning', 'high', '2024-03-01', '2024-08-30', 300000.00, 45000.00, 15, engineer_id, 'd0002222-2222-2222-2222-222222222222', 'AI Solutions Ltd');

  -- Add project members
  INSERT INTO project_members (project_id, user_id, role, hourly_rate) VALUES
    -- SimAlly Mobile App
    ('p0001111-1111-1111-1111-111111111111', ceo_id, 'observer', 150.00),
    ('p0001111-1111-1111-1111-111111111111', engineer_id, 'manager', 100.00),
    ('p0001111-1111-1111-1111-111111111111', designer_id, 'member', 85.00),
    -- Enterprise Dashboard
    ('p0002222-2222-2222-2222-222222222222', engineer_id, 'manager', 100.00),
    ('p0002222-2222-2222-2222-222222222222', designer_id, 'member', 85.00),
    ('p0002222-2222-2222-2222-222222222222', marketing_id, 'observer', 90.00),
    -- Brand Redesign
    ('p0003333-3333-3333-3333-333333333333', ceo_id, 'observer', 150.00),
    ('p0003333-3333-3333-3333-333333333333', designer_id, 'manager', 85.00),
    ('p0003333-3333-3333-3333-333333333333', marketing_id, 'member', 90.00),
    -- Q2 Marketing Campaign
    ('p0004444-4444-4444-4444-444444444444', ceo_id, 'observer', 150.00),
    ('p0004444-4444-4444-4444-444444444444', marketing_id, 'manager', 90.00),
    ('p0004444-4444-4444-4444-444444444444', designer_id, 'member', 85.00),
    -- AI Integration Platform
    ('p0005555-5555-5555-5555-555555555555', ceo_id, 'observer', 150.00),
    ('p0005555-5555-5555-5555-555555555555', engineer_id, 'manager', 100.00);

  -- Create project milestones
  INSERT INTO project_milestones (project_id, name, description, due_date, status, created_by) VALUES
    -- SimAlly Mobile App
    ('p0001111-1111-1111-1111-111111111111', 'MVP Release', 'Minimum viable product for beta testing', '2024-04-15', 'completed', engineer_id),
    ('p0001111-1111-1111-1111-111111111111', 'App Store Submission', 'Submit to iOS and Android app stores', '2024-06-01', 'pending', engineer_id),
    -- Enterprise Dashboard
    ('p0002222-2222-2222-2222-222222222222', 'Alpha Version', 'Internal testing version', '2024-03-15', 'completed', engineer_id),
    ('p0002222-2222-2222-2222-222222222222', 'Client Demo', 'Live demonstration to client', '2024-04-30', 'pending', engineer_id),
    -- Brand Redesign
    ('p0003333-3333-3333-3333-333333333333', 'Logo Concepts', 'Initial logo design concepts', '2024-02-15', 'completed', designer_id),
    ('p0003333-3333-3333-3333-333333333333', 'Style Guide', 'Complete brand style guide', '2024-03-30', 'pending', designer_id),
    -- Q2 Marketing Campaign
    ('p0004444-4444-4444-4444-444444444444', 'Campaign Strategy', 'Finalize marketing strategy and channels', '2024-04-15', 'pending', marketing_id),
    ('p0004444-4444-4444-4444-444444444444', 'Content Creation', 'Develop all campaign content', '2024-05-15', 'pending', marketing_id),
    -- AI Integration Platform
    ('p0005555-5555-5555-5555-555555555555', 'Technical Specification', 'Complete technical documentation', '2024-03-15', 'pending', engineer_id);

  -- Create tasks for SimAlly Mobile App
  INSERT INTO tasks (id, title, description, status, priority, due_date, project_id, estimated_hours, story_points, tags, created_by) VALUES
    ('t0001111-1111-1111-1111-111111111111', 'Implement user authentication', 'Build secure login and registration system with OAuth support', 'completed', 'high', '2024-02-15', 'p0001111-1111-1111-1111-111111111111', 40.0, 8, ARRAY['backend', 'security'], engineer_id),
    ('t0001112-1111-1111-1111-111111111111', 'Design mobile UI components', 'Create reusable UI component library for mobile app', 'in_progress', 'medium', '2024-03-20', 'p0001111-1111-1111-1111-111111111111', 60.0, 13, ARRAY['frontend', 'design'], designer_id),
    ('t0001113-1111-1111-1111-111111111111', 'Set up CI/CD pipeline', 'Automated testing and deployment pipeline', 'todo', 'high', '2024-03-30', 'p0001111-1111-1111-1111-111111111111', 24.0, 5, ARRAY['devops', 'automation'], engineer_id),
    ('t0001114-1111-1111-1111-111111111111', 'Implement push notifications', 'Add support for push notifications on iOS and Android', 'todo', 'medium', '2024-04-10', 'p0001111-1111-1111-1111-111111111111', 16.0, 5, ARRAY['mobile', 'backend'], engineer_id),
    ('t0001115-1111-1111-1111-111111111111', 'Create onboarding screens', 'Design and implement user onboarding flow', 'in_progress', 'high', '2024-03-25', 'p0001111-1111-1111-1111-111111111111', 20.0, 8, ARRAY['frontend', 'ux'], designer_id);

  -- Create tasks for Enterprise Dashboard
  INSERT INTO tasks (id, title, description, status, priority, due_date, project_id, estimated_hours, story_points, tags, created_by) VALUES
    ('t0002111-2222-2222-2222-222222222222', 'Build analytics dashboard', 'Real-time data visualization and reporting', 'in_progress', 'high', '2024-04-10', 'p0002222-2222-2222-2222-222222222222', 80.0, 21, ARRAY['frontend', 'analytics'], engineer_id),
    ('t0002112-2222-2222-2222-222222222222', 'API performance optimization', 'Optimize database queries and API response times', 'todo', 'high', '2024-04-05', 'p0002222-2222-2222-2222-222222222222', 32.0, 8, ARRAY['backend', 'performance'], engineer_id),
    ('t0002113-2222-2222-2222-222222222222', 'Implement data export', 'Add CSV and PDF export functionality', 'completed', 'medium', '2024-03-01', 'p0002222-2222-2222-2222-222222222222', 16.0, 5, ARRAY['frontend', 'backend'], engineer_id),
    ('t0002114-2222-2222-2222-222222222222', 'Design dashboard UI', 'Create modern, intuitive dashboard interface', 'completed', 'high', '2024-02-20', 'p0002222-2222-2222-2222-222222222222', 40.0, 13, ARRAY['design', 'frontend'], designer_id);

  -- Create tasks for Brand Redesign
  INSERT INTO tasks (id, title, description, status, priority, due_date, project_id, estimated_hours, story_points, tags, created_by) VALUES
    ('t0003111-3333-3333-3333-333333333333', 'Logo design exploration', 'Create multiple logo concepts based on brand values', 'completed', 'high', '2024-02-10', 'p0003333-3333-3333-3333-333333333333', 30.0, 8, ARRAY['design', 'branding'], designer_id),
    ('t0003112-3333-3333-3333-333333333333', 'Color palette selection', 'Define primary and secondary color palettes', 'completed', 'medium', '2024-02-15', 'p0003333-3333-3333-3333-333333333333', 16.0, 5, ARRAY['design', 'branding'], designer_id),
    ('t0003113-3333-3333-3333-333333333333', 'Typography system', 'Select and document typography hierarchy', 'in_progress', 'medium', '2024-03-01', 'p0003333-3333-3333-3333-333333333333', 16.0, 5, ARRAY['design', 'typography'], designer_id),
    ('t0003114-3333-3333-3333-333333333333', 'Brand guidelines documentation', 'Create comprehensive brand style guide', 'in_progress', 'medium', '2024-03-25', 'p0003333-3333-3333-3333-333333333333', 40.0, 8, ARRAY['documentation', 'branding'], designer_id),
    ('t0003115-3333-3333-3333-333333333333', 'Marketing materials redesign', 'Update all marketing materials with new branding', 'todo', 'high', '2024-04-10', 'p0003333-3333-3333-3333-333333333333', 60.0, 13, ARRAY['design', 'marketing'], marketing_id);

  -- Create tasks for Q2 Marketing Campaign
  INSERT INTO tasks (id, title, description, status, priority, due_date, project_id, estimated_hours, story_points, tags, created_by) VALUES
    ('t0004111-4444-4444-4444-444444444444', 'Campaign strategy development', 'Define target audience, channels, and messaging', 'in_progress', 'high', '2024-04-10', 'p0004444-4444-4444-4444-444444444444', 24.0, 8, ARRAY['marketing', 'strategy'], marketing_id),
    ('t0004112-4444-4444-4444-444444444444', 'Content calendar creation', 'Plan content schedule for campaign duration', 'todo', 'medium', '2024-04-15', 'p0004444-4444-4444-4444-444444444444', 16.0, 5, ARRAY['marketing', 'content'], marketing_id),
    ('t0004113-4444-4444-4444-444444444444', 'Social media assets', 'Design social media graphics and videos', 'todo', 'medium', '2024-04-20', 'p0004444-4444-4444-4444-444444444444', 40.0, 8, ARRAY['design', 'social'], designer_id);

  -- Create tasks for AI Integration Platform
  INSERT INTO tasks (id, title, description, status, priority, due_date, project_id, estimated_hours, story_points, tags, created_by) VALUES
    ('t0005111-5555-5555-5555-555555555555', 'Technical requirements gathering', 'Document all technical requirements and constraints', 'in_progress', 'high', '2024-03-10', 'p0005555-5555-5555-5555-555555555555', 40.0, 13, ARRAY['documentation', 'requirements'], engineer_id),
    ('t0005112-5555-5555-5555-555555555555', 'Architecture design', 'Design system architecture and component interactions', 'todo', 'high', '2024-03-25', 'p0005555-5555-5555-5555-555555555555', 60.0, 21, ARRAY['architecture', 'design'], engineer_id),
    ('t0005113-5555-5555-5555-555555555555', 'ML model selection', 'Research and select appropriate machine learning models', 'todo', 'medium', '2024-04-05', 'p0005555-5555-5555-5555-555555555555', 40.0, 13, ARRAY['ai', 'ml', 'research'], engineer_id);

  -- Create task dependencies
  INSERT INTO task_dependencies (task_id, depends_on_task_id, dependency_type) VALUES
    -- SimAlly Mobile App dependencies
    ('t0001112-1111-1111-1111-111111111111', 't0001111-1111-1111-1111-111111111111', 'finish_to_start'),
    ('t0001113-1111-1111-1111-111111111111', 't0001111-1111-1111-1111-111111111111', 'finish_to_start'),
    ('t0001115-1111-1111-1111-111111111111', 't0001112-1111-1111-1111-111111111111', 'start_to_start'),
    -- Enterprise Dashboard dependencies
    ('t0002112-2222-2222-2222-222222222222', 't0002111-2222-2222-2222-222222222222', 'start_to_start'),
    -- Brand Redesign dependencies
    ('t0003112-3333-3333-3333-333333333333', 't0003111-3333-3333-3333-333333333333', 'finish_to_start'),
    ('t0003113-3333-3333-3333-333333333333', 't0003112-3333-3333-3333-333333333333', 'finish_to_start'),
    ('t0003114-3333-3333-3333-333333333333', 't0003113-3333-3333-3333-333333333333', 'start_to_start'),
    -- AI Integration Platform dependencies
    ('t0005112-5555-5555-5555-555555555555', 't0005111-5555-5555-5555-555555555555', 'finish_to_start'),
    ('t0005113-5555-5555-5555-555555555555', 't0005111-5555-5555-5555-555555555555', 'finish_to_start');

  -- Create task assignments
  INSERT INTO task_assignments (task_id, user_id) VALUES
    -- SimAlly Mobile App assignments
    ('t0001111-1111-1111-1111-111111111111', engineer_id),
    ('t0001112-1111-1111-1111-111111111111', designer_id),
    ('t0001113-1111-1111-1111-111111111111', engineer_id),
    ('t0001114-1111-1111-1111-111111111111', engineer_id),
    ('t0001115-1111-1111-1111-111111111111', designer_id),
    -- Enterprise Dashboard assignments
    ('t0002111-2222-2222-2222-222222222222', engineer_id),
    ('t0002112-2222-2222-2222-222222222222', engineer_id),
    ('t0002113-2222-2222-2222-222222222222', engineer_id),
    ('t0002114-2222-2222-2222-222222222222', designer_id),
    -- Brand Redesign assignments
    ('t0003111-3333-3333-3333-333333333333', designer_id),
    ('t0003112-3333-3333-3333-333333333333', designer_id),
    ('t0003113-3333-3333-3333-333333333333', designer_id),
    ('t0003114-3333-3333-3333-333333333333', designer_id),
    ('t0003115-3333-3333-3333-333333333333', marketing_id),
    -- Q2 Marketing Campaign assignments
    ('t0004111-4444-4444-4444-444444444444', marketing_id),
    ('t0004112-4444-4444-4444-444444444444', marketing_id),
    ('t0004113-4444-4444-4444-444444444444', designer_id),
    -- AI Integration Platform assignments
    ('t0005111-5555-5555-5555-555555555555', engineer_id),
    ('t0005112-5555-5555-5555-555555555555', engineer_id),
    ('t0005113-5555-5555-5555-555555555555', engineer_id);

  -- Create task comments
  INSERT INTO task_comments (task_id, user_id, content) VALUES
    -- SimAlly Mobile App comments
    ('t0001111-1111-1111-1111-111111111111', engineer_id, 'Authentication system is working well. Added support for Google and GitHub OAuth.'),
    ('t0001111-1111-1111-1111-111111111111', ceo_id, 'Great work! Make sure we have proper security testing.'),
    ('t0001112-1111-1111-1111-111111111111', designer_id, 'Making good progress on the component library. Need feedback on the color scheme.'),
    ('t0001112-1111-1111-1111-111111111111', engineer_id, 'The components look great! Can we make sure they work well on both iOS and Android?'),
    -- Enterprise Dashboard comments
    ('t0002111-2222-2222-2222-222222222222', engineer_id, 'Dashboard is looking great! Client will love the real-time updates feature.'),
    ('t0002114-2222-2222-2222-222222222222', designer_id, 'Completed the dashboard UI design. Incorporated client feedback from last meeting.'),
    ('t0002114-2222-2222-2222-222222222222', engineer_id, 'Looks fantastic! I will start implementing it right away.'),
    -- Brand Redesign comments
    ('t0003111-3333-3333-3333-333333333333', designer_id, 'Completed initial logo concepts. Option 3 is my personal favorite.'),
    ('t0003111-3333-3333-3333-333333333333', ceo_id, 'I like option 2 and 3. Let us refine those further.'),
    ('t0003114-3333-3333-3333-333333333333', designer_id, 'Brand guidelines are almost complete. Just need final approval from marketing team.'),
    ('t0003114-3333-3333-3333-333333333333', marketing_id, 'Looking good! Can we add more examples of social media applications?');

  -- Create time tracking entries
  INSERT INTO time_tracking (user_id, task_id, project_id, description, start_time, end_time, duration_minutes, billable, hourly_rate) VALUES
    -- Engineer time entries
    (engineer_id, 't0001111-1111-1111-1111-111111111111', 'p0001111-1111-1111-1111-111111111111', 'Implementing OAuth integration', '2024-02-10 09:00:00', '2024-02-10 17:00:00', 480, true, 100.00),
    (engineer_id, 't0001111-1111-1111-1111-111111111111', 'p0001111-1111-1111-1111-111111111111', 'Fixing authentication edge cases', '2024-02-11 10:00:00', '2024-02-11 15:30:00', 330, true, 100.00),
    (engineer_id, 't0002111-2222-2222-2222-222222222222', 'p0002222-2222-2222-2222-222222222222', 'Building chart components', '2024-03-20 09:30:00', '2024-03-20 18:00:00', 510, true, 100.00),
    (engineer_id, 't0005111-5555-5555-5555-555555555555', 'p0005555-5555-5555-5555-555555555555', 'Documenting technical requirements', '2024-03-05 13:00:00', '2024-03-05 17:00:00', 240, true, 100.00),
    -- Designer time entries
    (designer_id, 't0001112-1111-1111-1111-111111111111', 'p0001111-1111-1111-1111-111111111111', 'Designing button components', '2024-03-15 10:00:00', '2024-03-15 14:30:00', 270, true, 85.00),
    (designer_id, 't0002114-2222-2222-2222-222222222222', 'p0002222-2222-2222-2222-222222222222', 'Creating dashboard wireframes', '2024-02-15 09:00:00', '2024-02-15 17:00:00', 480, true, 85.00),
    (designer_id, 't0003111-3333-3333-3333-333333333333', 'p0003333-3333-3333-3333-333333333333', 'Logo design exploration', '2024-02-05 10:00:00', '2024-02-05 18:00:00', 480, true, 85.00),
    (designer_id, 't0003112-3333-3333-3333-333333333333', 'p0003333-3333-3333-3333-333333333333', 'Color palette refinement', '2024-02-12 13:00:00', '2024-02-12 17:00:00', 240, true, 85.00),
    -- Marketing time entries
    (marketing_id, 't0003115-3333-3333-3333-333333333333', 'p0003333-3333-3333-3333-333333333333', 'Marketing materials planning', '2024-03-25 09:00:00', '2024-03-25 12:00:00', 180, true, 90.00),
    (marketing_id, 't0004111-4444-4444-4444-444444444444', 'p0004444-4444-4444-4444-444444444444', 'Campaign strategy session', '2024-04-01 14:00:00', '2024-04-01 17:00:00', 180, true, 90.00),
    -- CEO time entries
    (ceo_id, NULL, 'p0001111-1111-1111-1111-111111111111', 'Project review meeting', '2024-03-01 10:00:00', '2024-03-01 11:30:00', 90, true, 150.00),
    (ceo_id, NULL, 'p0003333-3333-3333-3333-333333333333', 'Brand strategy discussion', '2024-02-20 14:00:00', '2024-02-20 15:30:00', 90, true, 150.00);

  -- Create channels
  INSERT INTO channels (id, name, description, type, created_by) VALUES
    ('c0001111-1111-1111-1111-111111111111', 'general', 'General company discussions', 'public', ceo_id),
    ('c0002222-2222-2222-2222-222222222222', 'engineering', 'Engineering team discussions', 'public', engineer_id),
    ('c0003333-3333-3333-3333-333333333333', 'design', 'Design team discussions', 'public', designer_id),
    ('c0004444-4444-4444-4444-444444444444', 'marketing', 'Marketing team discussions', 'public', marketing_id),
    ('c0005555-5555-5555-5555-555555555555', 'mobile-app', 'SimAlly Mobile App project discussions', 'public', engineer_id),
    ('c0006666-6666-6666-6666-666666666666', 'enterprise-dashboard', 'Enterprise Dashboard project discussions', 'public', engineer_id),
    ('c0007777-7777-7777-7777-777777777777', 'brand-redesign', 'Brand Redesign project discussions', 'public', designer_id),
    ('c0008888-8888-8888-8888-888888888888', 'executive', 'Executive team discussions', 'private', ceo_id);

  -- Add channel members
  INSERT INTO channel_members (channel_id, user_id, role) VALUES
    -- General channel - everyone
    ('c0001111-1111-1111-1111-111111111111', ceo_id, 'admin'),
    ('c0001111-1111-1111-1111-111111111111', engineer_id, 'member'),
    ('c0001111-1111-1111-1111-111111111111', designer_id, 'member'),
    ('c0001111-1111-1111-1111-111111111111', marketing_id, 'member'),
    -- Engineering channel
    ('c0002222-2222-2222-2222-222222222222', engineer_id, 'admin'),
    ('c0002222-2222-2222-2222-222222222222', ceo_id, 'member'),
    -- Design channel
    ('c0003333-3333-3333-3333-333333333333', designer_id, 'admin'),
    ('c0003333-3333-3333-3333-333333333333', ceo_id, 'member'),
    ('c0003333-3333-3333-3333-333333333333', engineer_id, 'member'),
    -- Marketing channel
    ('c0004444-4444-4444-4444-444444444444', marketing_id, 'admin'),
    ('c0004444-4444-4444-4444-444444444444', ceo_id, 'member'),
    ('c0004444-4444-4444-4444-444444444444', designer_id, 'member'),
    -- Mobile App channel
    ('c0005555-5555-5555-5555-555555555555', engineer_id, 'admin'),
    ('c0005555-5555-5555-5555-555555555555', designer_id, 'member'),
    ('c0005555-5555-5555-5555-555555555555', ceo_id, 'member'),
    -- Enterprise Dashboard channel
    ('c0006666-6666-6666-6666-666666666666', engineer_id, 'admin'),
    ('c0006666-6666-6666-6666-666666666666', designer_id, 'member'),
    ('c0006666-6666-6666-6666-666666666666', marketing_id, 'member'),
    -- Brand Redesign channel
    ('c0007777-7777-7777-7777-777777777777', designer_id, 'admin'),
    ('c0007777-7777-7777-7777-777777777777', marketing_id, 'member'),
    ('c0007777-7777-7777-7777-777777777777', ceo_id, 'member'),
    -- Executive channel
    ('c0008888-8888-8888-8888-888888888888', ceo_id, 'admin');

  -- Create messages for General channel
  INSERT INTO messages (channel_id, sender_id, content, type, created_at) VALUES
    ('c0001111-1111-1111-1111-111111111111', ceo_id, 'Welcome to SimAlly! This is our general channel for company-wide discussions.', 'text', NOW() - INTERVAL '30 days'),
    ('c0001111-1111-1111-1111-111111111111', engineer_id, 'Thanks for setting this up! Looking forward to collaborating with everyone.', 'text', NOW() - INTERVAL '30 days' + INTERVAL '10 minutes'),
    ('c0001111-1111-1111-1111-111111111111', designer_id, 'Excited to be part of the team! The workspace looks great.', 'text', NOW() - INTERVAL '30 days' + INTERVAL '15 minutes'),
    ('c0001111-1111-1111-1111-111111111111', marketing_id, 'Hello everyone! Can''t wait to start working together.', 'text', NOW() - INTERVAL '30 days' + INTERVAL '20 minutes'),
    ('c0001111-1111-1111-1111-111111111111', ceo_id, 'Our company all-hands meeting is scheduled for next Friday at 10am. Please make sure to attend.', 'text', NOW() - INTERVAL '15 days'),
    ('c0001111-1111-1111-1111-111111111111', engineer_id, 'Will the meeting be recorded for those who can''t attend live?', 'text', NOW() - INTERVAL '15 days' + INTERVAL '5 minutes'),
    ('c0001111-1111-1111-1111-111111111111', ceo_id, 'Yes, we''ll record it and share the link afterward.', 'text', NOW() - INTERVAL '15 days' + INTERVAL '10 minutes'),
    ('c0001111-1111-1111-1111-111111111111', ceo_id, 'Great progress on all projects this month, team! The mobile app is coming along nicely, and the client is very happy with the enterprise dashboard progress.', 'text', NOW() - INTERVAL '5 days'),
    ('c0001111-1111-1111-1111-111111111111', designer_id, 'Thanks! The brand redesign is also on track. We should have the final style guide ready next week.', 'text', NOW() - INTERVAL '5 days' + INTERVAL '15 minutes'),
    ('c0001111-1111-1111-1111-111111111111', marketing_id, 'Looking forward to implementing the new brand in our Q2 campaign!', 'text', NOW() - INTERVAL '5 days' + INTERVAL '20 minutes');

  -- Create messages for Mobile App channel
  INSERT INTO messages (channel_id, sender_id, content, type, created_at) VALUES
    ('c0005555-5555-5555-5555-555555555555', engineer_id, 'Welcome to the Mobile App project channel! We''ll use this space to discuss all aspects of the SimAlly mobile app development.', 'text', NOW() - INTERVAL '25 days'),
    ('c0005555-5555-5555-5555-555555555555', designer_id, 'I''ve started working on the UI component designs. Will share some mockups tomorrow.', 'text', NOW() - INTERVAL '25 days' + INTERVAL '30 minutes'),
    ('c0005555-5555-5555-5555-555555555555', engineer_id, 'Great! I''ve completed the authentication system. We can now register users and handle login with OAuth.', 'text', NOW() - INTERVAL '20 days'),
    ('c0005555-5555-5555-5555-555555555555', ceo_id, 'Excellent progress! When do you think we''ll have something we can demo?', 'text', NOW() - INTERVAL '20 days' + INTERVAL '1 hour'),
    ('c0005555-5555-5555-5555-555555555555', engineer_id, 'We should have a basic working prototype by the end of next week.', 'text', NOW() - INTERVAL '20 days' + INTERVAL '1 hour 15 minutes'),
    ('c0005555-5555-5555-5555-555555555555', designer_id, 'Here are the UI component designs as promised. Let me know what you think!', 'text', NOW() - INTERVAL '19 days'),
    ('c0005555-5555-5555-5555-555555555555', engineer_id, 'These look fantastic! I will start implementing them right away.', 'text', NOW() - INTERVAL '19 days' + INTERVAL '2 hours'),
    ('c0005555-5555-5555-5555-555555555555', engineer_id, 'We need to set up the CI/CD pipeline soon. I''ll create a task for that.', 'text', NOW() - INTERVAL '10 days'),
    ('c0005555-5555-5555-5555-555555555555', engineer_id, 'We need to implement push notifications for the app by next week.', 'text', NOW() - INTERVAL '5 days'),
    ('c0005555-5555-5555-5555-555555555555', designer_id, 'I''m working on the onboarding screens now. Should have them ready for review by tomorrow.', 'text', NOW() - INTERVAL '2 days');

  -- Create messages for Brand Redesign channel
  INSERT INTO messages (channel_id, sender_id, content, type, created_at) VALUES
    ('c0007777-7777-7777-7777-777777777777', designer_id, 'Welcome to the Brand Redesign project channel! We''ll be working on a complete refresh of our brand identity.', 'text', NOW() - INTERVAL '28 days'),
    ('c0007777-7777-7777-7777-777777777777', marketing_id, 'Excited to see what we come up with! Do we have any initial direction from leadership?', 'text', NOW() - INTERVAL '28 days' + INTERVAL '15 minutes'),
    ('c0007777-7777-7777-7777-777777777777', ceo_id, 'We want to maintain our professional image but make it more modern and approachable. The current brand feels a bit outdated.', 'text', NOW() - INTERVAL '28 days' + INTERVAL '30 minutes'),
    ('c0007777-7777-7777-7777-777777777777', designer_id, 'I''ve been working on some initial logo concepts. Here are three directions we could explore.', 'text', NOW() - INTERVAL '25 days'),
    ('c0007777-7777-7777-7777-777777777777', ceo_id, 'I like options 2 and 3. Let''s refine those further.', 'text', NOW() - INTERVAL '25 days' + INTERVAL '2 hours'),
    ('c0007777-7777-7777-7777-777777777777', designer_id, 'I''ve refined the logo concepts based on feedback. Option 3 is now my recommendation.', 'text', NOW() - INTERVAL '20 days'),
    ('c0007777-7777-7777-7777-777777777777', marketing_id, 'Option 3 works well with our marketing strategy. I support that direction.', 'text', NOW() - INTERVAL '20 days' + INTERVAL '1 hour'),
    ('c0007777-7777-7777-7777-777777777777', ceo_id, 'Agreed. Let''s proceed with option 3 and develop the full brand system around it.', 'text', NOW() - INTERVAL '20 days' + INTERVAL '3 hours'),
    ('c0007777-7777-7777-7777-777777777777', designer_id, 'I''ve completed the color palette selection. Here''s the primary and secondary colors we''ll be using.', 'text', NOW() - INTERVAL '15 days'),
    ('c0007777-7777-7777-7777-777777777777', designer_id, 'Working on the typography system now. Should have that ready by end of week.', 'text', NOW() - INTERVAL '10 days'),
    ('c0007777-7777-7777-7777-777777777777', designer_id, 'The brand guidelines document is coming along well. I''ll need marketing''s input on the voice and tone section.', 'text', NOW() - INTERVAL '5 days'),
    ('c0007777-7777-7777-7777-777777777777', marketing_id, 'I''ll send you our current voice and tone guidelines as a starting point. We can refine them together.', 'text', NOW() - INTERVAL '5 days' + INTERVAL '30 minutes');

  -- Create notifications for each user
  -- CEO notifications
  INSERT INTO notifications (user_id, title, message, type, category, action_url, read) VALUES
    (ceo_id, 'Project Update', 'SimAlly Mobile App is 65% complete', 'info', 'project', '/workspace?project=p0001111-1111-1111-1111-111111111111', false),
    (ceo_id, 'Budget Alert', 'Enterprise Dashboard project is at 80% budget utilization', 'warning', 'project', '/workspace?project=p0002222-2222-2222-2222-222222222222', false),
    (ceo_id, 'Meeting Reminder', 'Executive team meeting in 30 minutes', 'info', 'meeting', '/meetings', true),
    (ceo_id, 'Brand Approval Needed', 'Final brand guidelines require your approval', 'info', 'task', '/workspace?task=t0003114-3333-3333-3333-333333333333', false);
  
  -- Engineer notifications
  INSERT INTO notifications (user_id, title, message, type, category, action_url, read) VALUES
    (engineer_id, 'Task Assigned', 'You have been assigned to implement push notifications', 'info', 'task', '/workspace?task=t0001114-1111-1111-1111-111111111111', false),
    (engineer_id, 'Task Due Soon', 'API performance optimization is due in 3 days', 'warning', 'task', '/workspace?task=t0002112-2222-2222-2222-222222222222', false),
    (engineer_id, 'CI/CD Pipeline', 'Set up CI/CD pipeline task is pending', 'info', 'task', '/workspace?task=t0001113-1111-1111-1111-111111111111', true),
    (engineer_id, 'Client Meeting', 'TechCorp client meeting scheduled for tomorrow', 'info', 'meeting', '/meetings', false);
  
  -- Designer notifications
  INSERT INTO notifications (user_id, title, message, type, category, action_url, read) VALUES
    (designer_id, 'Feedback Received', 'CEO provided feedback on logo concepts', 'info', 'task', '/workspace?task=t0003111-3333-3333-3333-333333333333', true),
    (designer_id, 'Task Due Soon', 'Onboarding screens design due in 2 days', 'warning', 'task', '/workspace?task=t0001115-1111-1111-1111-111111111111', false),
    (designer_id, 'Brand Guidelines', 'Brand guidelines documentation in progress', 'info', 'task', '/workspace?task=t0003114-3333-3333-3333-333333333333', false),
    (designer_id, 'Design Review', 'Mobile UI components review meeting tomorrow', 'info', 'meeting', '/meetings', false);
  
  -- Marketing notifications
  INSERT INTO notifications (user_id, title, message, type, category, action_url, read) VALUES
    (marketing_id, 'Campaign Planning', 'Q2 Marketing Campaign planning session today', 'info', 'project', '/workspace?project=p0004444-4444-4444-4444-444444444444', false),
    (marketing_id, 'Brand Guidelines', 'New brand guidelines will be ready next week', 'info', 'task', '/workspace?task=t0003114-3333-3333-3333-333333333333', true),
    (marketing_id, 'Task Assigned', 'You have been assigned to create marketing materials', 'info', 'task', '/workspace?task=t0003115-3333-3333-3333-333333333333', false),
    (marketing_id, 'Content Calendar', 'Content calendar creation task is pending', 'info', 'task', '/workspace?task=t0004112-4444-4444-4444-444444444444', false);

  -- Create meeting recordings
  INSERT INTO meeting_recordings (meeting_room, title, duration_minutes, participants, host_id, summary, action_items) VALUES
    ('mobile-app-standup', 'Mobile App Daily Standup - March 20', 15, ARRAY['CEO User', 'Engineer User', 'Designer User'], engineer_id,
     'Team discussed progress on mobile app development. Authentication system completed, UI components in progress. Identified blocker with API integration.',
     ARRAY['Engineer to resolve API integration issue by Friday', 'Designer to review UI component designs', 'Schedule architecture review meeting']),
    ('enterprise-dashboard-demo', 'Enterprise Dashboard Client Demo', 45, ARRAY['Engineer User', 'Designer User', 'TechCorp Team'], engineer_id,
     'Successful demo of analytics dashboard to TechCorp. Client impressed with real-time features and customization options. Discussed additional requirements.',
     ARRAY['Implement custom reporting features', 'Add role-based access controls', 'Schedule follow-up meeting for next week']),
    ('brand-review', 'Brand Redesign Review Meeting', 60, ARRAY['CEO User', 'Designer User', 'Marketing User'], designer_id,
     'Reviewed brand redesign progress. Logo and color palette approved. Typography system in progress. Discussed timeline for rollout.',
     ARRAY['Designer to finalize typography system', 'Marketing to prepare rollout plan', 'CEO to approve final brand guidelines']);

  -- Create workspace analytics
  INSERT INTO workspace_analytics (metric_name, metric_value, dimensions, date_recorded) VALUES
    ('active_projects', 4, '{"department": "all"}', CURRENT_DATE),
    ('completed_tasks', 5, '{"month": "current", "year": "2024"}', CURRENT_DATE),
    ('team_productivity', 87.5, '{"metric": "percentage", "period": "weekly"}', CURRENT_DATE),
    ('budget_utilization', 65.2, '{"metric": "percentage", "period": "quarterly"}', CURRENT_DATE),
    ('user_engagement', 92.3, '{"metric": "percentage", "period": "daily"}', CURRENT_DATE),
    ('project_velocity', 23.5, '{"metric": "story_points_per_sprint"}', CURRENT_DATE),
    ('bug_resolution_time', 2.4, '{"metric": "days_average"}', CURRENT_DATE),
    ('client_satisfaction', 4.7, '{"metric": "rating_out_of_5"}', CURRENT_DATE);

  -- Create reports
  INSERT INTO reports (name, type, status, parameters, generated_by) VALUES
    ('Q1 2024 Project Performance', 'project', 'completed', '{"quarter": "Q1", "year": 2024, "include_budget": true}', ceo_id),
    ('Team Productivity Analysis', 'productivity', 'completed', '{"period": "monthly", "teams": ["engineering", "design"]}', ceo_id),
    ('Time Tracking Summary', 'time', 'completed', '{"start_date": "2024-03-01", "end_date": "2024-03-31"}', ceo_id),
    ('Budget Utilization Report', 'financial', 'generating', '{"projects": ["all"], "include_forecasts": true}', ceo_id);

  -- Create calendar events
  INSERT INTO calendar_events (title, description, start_time, end_time, user_id) VALUES
    -- CEO calendar
    ('Executive Team Meeting', 'Weekly executive team sync', NOW() + INTERVAL '1 day' + INTERVAL '10 hours', NOW() + INTERVAL '1 day' + INTERVAL '11 hours', ceo_id),
    ('Board Presentation', 'Quarterly board update', NOW() + INTERVAL '5 days' + INTERVAL '14 hours', NOW() + INTERVAL '5 days' + INTERVAL '16 hours', ceo_id),
    ('Project Review', 'Review all active projects', NOW() + INTERVAL '2 days' + INTERVAL '13 hours', NOW() + INTERVAL '2 days' + INTERVAL '15 hours', ceo_id),
    -- Engineer calendar
    ('Mobile App Standup', 'Daily standup for mobile app team', NOW() + INTERVAL '1 day' + INTERVAL '9 hours', NOW() + INTERVAL '1 day' + INTERVAL '9 hours 30 minutes', engineer_id),
    ('Code Review', 'Review authentication implementation', NOW() + INTERVAL '2 days' + INTERVAL '11 hours', NOW() + INTERVAL '2 days' + INTERVAL '12 hours', engineer_id),
    ('Client Demo', 'Enterprise Dashboard demo for TechCorp', NOW() + INTERVAL '3 days' + INTERVAL '14 hours', NOW() + INTERVAL '3 days' + INTERVAL '15 hours', engineer_id),
    -- Designer calendar
    ('Design Review', 'Review mobile UI components', NOW() + INTERVAL '1 day' + INTERVAL '13 hours', NOW() + INTERVAL '1 day' + INTERVAL '14 hours', designer_id),
    ('Brand Guidelines Meeting', 'Finalize brand guidelines', NOW() + INTERVAL '4 days' + INTERVAL '10 hours', NOW() + INTERVAL '4 days' + INTERVAL '11 hours 30 minutes', designer_id),
    ('UI Workshop', 'Mobile app UI workshop with engineering', NOW() + INTERVAL '2 days' + INTERVAL '15 hours', NOW() + INTERVAL '2 days' + INTERVAL '17 hours', designer_id),
    -- Marketing calendar
    ('Campaign Planning', 'Q2 campaign planning session', NOW() + INTERVAL '1 day' + INTERVAL '11 hours', NOW() + INTERVAL '1 day' + INTERVAL '12 hours 30 minutes', marketing_id),
    ('Content Review', 'Review content calendar', NOW() + INTERVAL '3 days' + INTERVAL '10 hours', NOW() + INTERVAL '3 days' + INTERVAL '11 hours', marketing_id),
    ('Brand Rollout Meeting', 'Plan brand redesign rollout', NOW() + INTERVAL '5 days' + INTERVAL '13 hours', NOW() + INTERVAL '5 days' + INTERVAL '14 hours 30 minutes', marketing_id);

  -- Create activity logs
  INSERT INTO activity_logs (user_id, action, resource_type, resource_id, new_values) VALUES
    (ceo_id, 'CREATE', 'departments', 'd0001111-1111-1111-1111-111111111111', '{"name": "Executive", "budget": 1000000.00}'),
    (engineer_id, 'CREATE', 'projects', 'p0001111-1111-1111-1111-111111111111', '{"name": "SimAlly Mobile App", "status": "active"}'),
    (designer_id, 'CREATE', 'projects', 'p0003333-3333-3333-3333-333333333333', '{"name": "Brand Redesign", "status": "active"}'),
    (engineer_id, 'UPDATE', 'tasks', 't0001111-1111-1111-1111-111111111111', '{"status": "completed"}'),
    (designer_id, 'UPDATE', 'tasks', 't0003111-3333-3333-3333-333333333333', '{"status": "completed"}'),
    (marketing_id, 'CREATE', 'projects', 'p0004444-4444-4444-4444-444444444444', '{"name": "Q2 Marketing Campaign", "status": "planning"}');
END $$;