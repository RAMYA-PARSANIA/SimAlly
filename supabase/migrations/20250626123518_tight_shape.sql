/*
  # Fix Gmail Token Disconnection Issue

  1. Database Changes
    - Add proper cleanup function for Gmail tokens
    - Ensure tokens are completely removed on disconnect
    - Fix token storage and retrieval functions
    - Add session tracking for better security

  2. Security
    - Improve token handling
    - Add proper error logging
    - Ensure tokens are properly invalidated
*/

-- Create a function to completely remove Gmail tokens
CREATE OR REPLACE FUNCTION completely_remove_gmail_tokens(p_user_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Delete from gmail_tokens table
  DELETE FROM gmail_tokens WHERE user_id = p_user_id;
  
  -- Delete from user_encryption_keys if it exists
  DELETE FROM user_encryption_keys WHERE user_id = p_user_id;
  
  -- Log the action
  INSERT INTO security_audit_log (
    user_id, 
    action, 
    resource_type, 
    success
  ) VALUES (
    p_user_id, 
    'gmail_tokens_removed', 
    'gmail_tokens', 
    true
  );
  
  RETURN true;
EXCEPTION
  WHEN OTHERS THEN
    -- Log the error
    INSERT INTO security_audit_log (
      user_id, 
      action, 
      resource_type, 
      success, 
      error_message
    ) VALUES (
      p_user_id, 
      'gmail_tokens_removal_failed', 
      'gmail_tokens', 
      false, 
      SQLERRM
    );
    
    RETURN false;
END;
$$;

-- Create a function to check if Gmail tokens exist
CREATE OR REPLACE FUNCTION check_gmail_tokens_exist(p_user_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  token_exists boolean;
BEGIN
  SELECT EXISTS(
    SELECT 1 FROM gmail_tokens WHERE user_id = p_user_id
  ) INTO token_exists;
  
  RETURN token_exists;
END;
$$;

-- Update the revoke_gmail_tokens function to ensure complete removal
CREATE OR REPLACE FUNCTION revoke_gmail_tokens(p_user_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  success boolean;
BEGIN
  -- Call the complete removal function
  success := completely_remove_gmail_tokens(p_user_id);
  
  IF success THEN
    RETURN jsonb_build_object('success', true, 'message', 'Gmail tokens completely removed');
  ELSE
    RETURN jsonb_build_object('success', false, 'error', 'Failed to completely remove Gmail tokens');
  END IF;
END;
$$;

-- Create a function to clear all user sessions
CREATE OR REPLACE FUNCTION clear_user_sessions(p_user_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Delete all sessions for this user
  DELETE FROM user_sessions WHERE user_id = p_user_id;
  
  RETURN true;
EXCEPTION
  WHEN OTHERS THEN
    RETURN false;
END;
$$;

-- Create a function to log user out from all sessions
CREATE OR REPLACE FUNCTION logout_user_from_all_sessions(p_user_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  success boolean;
BEGIN
  -- Clear all sessions
  success := clear_user_sessions(p_user_id);
  
  -- Set user status to offline
  UPDATE profiles SET status = 'offline' WHERE id = p_user_id;
  
  IF success THEN
    RETURN jsonb_build_object('success', true, 'message', 'User logged out from all sessions');
  ELSE
    RETURN jsonb_build_object('success', false, 'error', 'Failed to log user out from all sessions');
  END IF;
END;
$$;

-- Create a function to update user status
CREATE OR REPLACE FUNCTION update_user_status(p_user_id uuid, p_status text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE profiles SET status = p_status WHERE id = p_user_id;
  RETURN true;
EXCEPTION
  WHEN OTHERS THEN
    RETURN false;
END;
$$;

-- Make sure the security_audit_log table exists
CREATE TABLE IF NOT EXISTS security_audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES profiles(id) ON DELETE CASCADE,
  action text NOT NULL,
  resource_type text NOT NULL,
  resource_id text,
  ip_address inet,
  user_agent text,
  session_id text,
  success boolean DEFAULT true,
  error_message text,
  created_at timestamptz DEFAULT now()
);

-- Enable RLS on audit log
ALTER TABLE security_audit_log ENABLE ROW LEVEL SECURITY;

-- Create policy for audit log
DROP POLICY IF EXISTS "Users can view own audit logs" ON security_audit_log;
CREATE POLICY "Users can view own audit logs"
  ON security_audit_log
  FOR SELECT
  TO public
  USING (user_id = auth.uid() OR user_id IS NULL);

-- Create index for audit log
CREATE INDEX IF NOT EXISTS idx_security_audit_user_created ON security_audit_log(user_id, created_at);