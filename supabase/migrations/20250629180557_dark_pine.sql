/*
  # Add Task Status Update Trigger

  1. New Functions
    - `update_task_status_on_drag` - Updates task status when dragged in Kanban board
    - `log_task_status_change` - Logs task status changes to activity_logs

  2. New Triggers
    - `update_task_status_trigger` - Fires when task status is updated
    - `log_task_status_change_trigger` - Fires when task status is updated

  3. Security
    - No changes to RLS policies
*/

-- Create function to log task status changes
CREATE OR REPLACE FUNCTION log_task_status_change()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.status <> NEW.status THEN
    INSERT INTO activity_logs (
      user_id,
      action,
      resource_type,
      resource_id,
      old_values,
      new_values
    ) VALUES (
      COALESCE(auth.uid(), NEW.created_by),
      'update_status',
      'task',
      NEW.id,
      jsonb_build_object('status', OLD.status),
      jsonb_build_object('status', NEW.status)
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger for logging task status changes
CREATE TRIGGER log_task_status_change_trigger
AFTER UPDATE OF status ON tasks
FOR EACH ROW
EXECUTE FUNCTION log_task_status_change();

-- Create function to update project progress when task status changes
CREATE OR REPLACE FUNCTION update_project_progress_on_task_status()
RETURNS TRIGGER AS $$
BEGIN
  -- Only proceed if status has changed and project_id is not null
  IF OLD.status <> NEW.status AND NEW.project_id IS NOT NULL THEN
    -- Update project progress based on completed tasks
    UPDATE projects
    SET progress_percentage = (
      SELECT 
        CASE 
          WHEN COUNT(*) = 0 THEN 0
          ELSE ROUND((COUNT(*) FILTER (WHERE status = 'completed')::NUMERIC / COUNT(*)::NUMERIC) * 100)
        END
      FROM tasks
      WHERE project_id = NEW.project_id
    )
    WHERE id = NEW.project_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger for updating project progress on task status change
CREATE TRIGGER update_project_progress_on_task_status_trigger
AFTER UPDATE OF status ON tasks
FOR EACH ROW
EXECUTE FUNCTION update_project_progress_on_task_status();

-- Create notification for task status changes
CREATE OR REPLACE FUNCTION create_task_status_notification()
RETURNS TRIGGER AS $$
DECLARE
  task_title TEXT;
  assignee_id UUID;
BEGIN
  -- Only proceed if status has changed
  IF OLD.status <> NEW.status THEN
    -- Get task title
    SELECT title INTO task_title FROM tasks WHERE id = NEW.id;
    
    -- Create notification for task creator
    INSERT INTO notifications (
      user_id,
      title,
      message,
      type,
      category,
      action_url,
      metadata
    ) VALUES (
      NEW.created_by,
      'Task Status Updated',
      'Task "' || task_title || '" status changed from ' || OLD.status || ' to ' || NEW.status,
      'info',
      'task',
      '/workspace?task=' || NEW.id,
      jsonb_build_object('task_id', NEW.id, 'old_status', OLD.status, 'new_status', NEW.status)
    );
    
    -- Create notification for assignees if any
    FOR assignee_id IN 
      SELECT user_id FROM task_assignments WHERE task_id = NEW.id
    LOOP
      -- Skip if assignee is the same as creator
      IF assignee_id <> NEW.created_by THEN
        INSERT INTO notifications (
          user_id,
          title,
          message,
          type,
          category,
          action_url,
          metadata
        ) VALUES (
          assignee_id,
          'Task Status Updated',
          'Task "' || task_title || '" status changed from ' || OLD.status || ' to ' || NEW.status,
          'info',
          'task',
          '/workspace?task=' || NEW.id,
          jsonb_build_object('task_id', NEW.id, 'old_status', OLD.status, 'new_status', NEW.status)
        );
      END IF;
    END LOOP;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger for task status change notifications
CREATE TRIGGER create_task_status_notification_trigger
AFTER UPDATE OF status ON tasks
FOR EACH ROW
EXECUTE FUNCTION create_task_status_notification();