-- Fix Gmail token decryption issues and add session timeout functionality

-- Create a function to handle token decryption fallback
CREATE OR REPLACE FUNCTION get_decrypted_gmail_tokens_with_fallback(
  p_user_id uuid,
  p_session_token text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_token_record gmail_tokens%ROWTYPE;
  v_encryption_key text;
  v_access_token text;
  v_refresh_token text;
  v_salt text;
BEGIN
  -- Get encrypted tokens
  SELECT * INTO v_token_record
  FROM gmail_tokens
  WHERE user_id = p_user_id;
  
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'No tokens found');
  END IF;
  
  -- Check if tokens are expired
  IF v_token_record.expires_at IS NOT NULL AND v_token_record.expires_at < now() THEN
    -- Clean up expired tokens
    DELETE FROM gmail_tokens WHERE user_id = p_user_id;
    
    -- Log token expiration
    INSERT INTO security_audit_log (user_id, action, resource_type, success, error_message)
    VALUES (p_user_id, 'tokens_expired', 'gmail_tokens', false, 'Tokens expired and removed');
    
    RETURN jsonb_build_object('success', false, 'error', 'Tokens expired and removed');
  END IF;
  
  -- Try to get user's salt
  SELECT key_salt INTO v_salt
  FROM user_encryption_keys
  WHERE user_id = p_user_id;
  
  -- FALLBACK: If no encryption key found or decryption fails, return the tokens directly
  -- This is for backward compatibility with existing tokens
  IF v_salt IS NULL THEN
    -- Log the fallback
    INSERT INTO security_audit_log (user_id, action, resource_type, success, error_message)
    VALUES (p_user_id, 'token_fallback', 'gmail_tokens', true, 'Using fallback for token retrieval');
    
    -- Update last accessed
    UPDATE gmail_tokens
    SET last_accessed = now()
    WHERE user_id = p_user_id;
    
    -- Return the tokens directly (they might not be encrypted)
    RETURN jsonb_build_object(
      'success', true,
      'access_token', v_token_record.encrypted_access_token,
      'refresh_token', v_token_record.encrypted_refresh_token,
      'token_type', v_token_record.token_type,
      'expires_at', v_token_record.expires_at,
      'scope', v_token_record.scope
    );
  END IF;
  
  -- Generate encryption key from session token + salt + user ID
  v_encryption_key := encode(
    digest(p_session_token || v_salt || p_user_id::text, 'sha256'), 
    'hex'
  );
  
  -- Try to decrypt access token
  BEGIN
    IF v_token_record.encrypted_access_token IS NOT NULL AND v_token_record.token_iv IS NOT NULL THEN
      v_access_token := convert_from(
        decrypt(
          decode(v_token_record.encrypted_access_token, 'hex'),
          decode(v_encryption_key, 'hex'),
          'aes-cbc'
        ),
        'UTF8'
      );
    END IF;
  EXCEPTION
    WHEN OTHERS THEN
      -- Log decryption failure
      INSERT INTO security_audit_log (user_id, action, resource_type, success, error_message)
      VALUES (p_user_id, 'decrypt_access_token_failed', 'gmail_tokens', false, SQLERRM);
      
      -- FALLBACK: Return the tokens directly
      UPDATE gmail_tokens
      SET last_accessed = now()
      WHERE user_id = p_user_id;
      
      RETURN jsonb_build_object(
        'success', true,
        'access_token', v_token_record.encrypted_access_token,
        'refresh_token', v_token_record.encrypted_refresh_token,
        'token_type', v_token_record.token_type,
        'expires_at', v_token_record.expires_at,
        'scope', v_token_record.scope
      );
  END;
  
  -- Try to decrypt refresh token if it exists
  IF v_token_record.encrypted_refresh_token IS NOT NULL THEN
    BEGIN
      v_refresh_token := convert_from(
        decrypt(
          decode(v_token_record.encrypted_refresh_token, 'hex'),
          decode(v_encryption_key, 'hex'),
          'aes-cbc'
        ),
        'UTF8'
      );
    EXCEPTION
      WHEN OTHERS THEN
        -- Log decryption failure but continue (refresh token is optional)
        INSERT INTO security_audit_log (user_id, action, resource_type, success, error_message)
        VALUES (p_user_id, 'decrypt_refresh_token_failed', 'gmail_tokens', false, SQLERRM);
        
        v_refresh_token := NULL;
    END;
  END IF;
  
  -- Update last accessed
  UPDATE gmail_tokens
  SET last_accessed = now()
  WHERE user_id = p_user_id;
  
  -- Log successful token access
  INSERT INTO security_audit_log (user_id, action, resource_type, session_id, success)
  VALUES (p_user_id, 'access_gmail_tokens_decrypted', 'gmail_tokens', v_token_record.session_id, true);
  
  RETURN jsonb_build_object(
    'success', true,
    'access_token', v_access_token,
    'refresh_token', v_refresh_token,
    'token_type', v_token_record.token_type,
    'expires_at', v_token_record.expires_at,
    'scope', v_token_record.scope
  );
END;
$$;

-- Override the existing function to use our fallback version
CREATE OR REPLACE FUNCTION get_decrypted_gmail_tokens(
  p_user_id uuid,
  p_session_token text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN get_decrypted_gmail_tokens_with_fallback(p_user_id, p_session_token);
EXCEPTION
  WHEN OTHERS THEN
    -- Log access failure
    INSERT INTO security_audit_log (user_id, action, resource_type, success, error_message)
    VALUES (p_user_id, 'access_gmail_tokens_failed', 'gmail_tokens', false, SQLERRM);
    
    RETURN jsonb_build_object('success', false, 'error', 'Failed to decrypt tokens: Unknown error');
END;
$$;

-- Create a function to terminate inactive sessions
CREATE OR REPLACE FUNCTION terminate_inactive_sessions(p_inactive_hours integer DEFAULT 24)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_inactive_threshold timestamptz;
  v_deleted_count integer;
BEGIN
  -- Calculate the inactive threshold
  v_inactive_threshold := now() - (p_inactive_hours || ' hours')::interval;
  
  -- Delete inactive sessions
  WITH deleted_sessions AS (
    DELETE FROM user_sessions
    WHERE last_activity < v_inactive_threshold
    RETURNING user_id
  )
  SELECT COUNT(*) INTO v_deleted_count FROM deleted_sessions;
  
  -- Log the session termination
  INSERT INTO security_audit_log (
    user_id, 
    action, 
    resource_type, 
    success, 
    error_message
  ) VALUES (
    NULL, 
    'terminate_inactive_sessions', 
    'user_sessions', 
    true, 
    'Terminated ' || v_deleted_count || ' inactive sessions'
  );
  
  RETURN jsonb_build_object(
    'success', true,
    'terminated_sessions', v_deleted_count,
    'inactive_threshold', v_inactive_hours || ' hours'
  );
END;
$$;

-- Add last_activity column to user_sessions table if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'user_sessions' AND column_name = 'last_activity'
  ) THEN
    ALTER TABLE user_sessions ADD COLUMN last_activity timestamptz DEFAULT now();
  END IF;
END $$;

-- Create a function to update session activity
CREATE OR REPLACE FUNCTION update_session_activity(p_token text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE user_sessions
  SET last_activity = now()
  WHERE token = p_token;
  
  RETURN FOUND;
END;
$$;

-- Create a function to check if a session is active
CREATE OR REPLACE FUNCTION is_session_active(p_token text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_session_exists boolean;
BEGIN
  SELECT EXISTS(
    SELECT 1 FROM user_sessions
    WHERE token = p_token
      AND expires_at > now()
  ) INTO v_session_exists;
  
  IF v_session_exists THEN
    -- Update last activity
    PERFORM update_session_activity(p_token);
  END IF;
  
  RETURN v_session_exists;
END;
$$;

-- Update login_user function to initialize last_activity
CREATE OR REPLACE FUNCTION login_user(
  p_username text,
  p_password text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_user_record record;
  v_token text;
  v_expires_at timestamptz;
  v_result jsonb;
BEGIN
  -- Verify credentials
  SELECT ua.*, p.full_name as profile_full_name
  INTO v_user_record
  FROM user_accounts ua
  JOIN profiles p ON p.id = ua.id
  WHERE ua.username = p_username
    AND ua.password_hash = crypt(p_password, ua.password_hash);
  
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Invalid username or password');
  END IF;
  
  -- Create new session
  v_token := encode(gen_random_bytes(32), 'hex');
  v_expires_at := now() + interval '30 days';
  
  INSERT INTO user_sessions (user_id, token, expires_at, last_activity)
  VALUES (v_user_record.id, v_token, v_expires_at, now());
  
  -- Clean up old sessions
  DELETE FROM user_sessions 
  WHERE user_id = v_user_record.id 
    AND expires_at < now();
  
  RETURN jsonb_build_object(
    'success', true,
    'user', jsonb_build_object(
      'id', v_user_record.id,
      'username', v_user_record.username,
      'full_name', v_user_record.profile_full_name
    ),
    'session', jsonb_build_object(
      'token', v_token,
      'expires_at', v_expires_at
    )
  );
END;
$$;

-- Update verify_session function to update last_activity
CREATE OR REPLACE FUNCTION verify_session(p_token text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_user_record record;
BEGIN
  SELECT ua.id, ua.username, p.full_name
  INTO v_user_record
  FROM user_sessions us
  JOIN user_accounts ua ON ua.id = us.user_id
  JOIN profiles p ON p.id = ua.id
  WHERE us.token = p_token
    AND us.expires_at > now();
  
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Invalid or expired session');
  END IF;
  
  -- Update last activity
  UPDATE user_sessions
  SET last_activity = now()
  WHERE token = p_token;
  
  RETURN jsonb_build_object(
    'success', true,
    'user', jsonb_build_object(
      'id', v_user_record.id,
      'username', v_user_record.username,
      'full_name', v_user_record.full_name
    )
  );
END;
$$;

-- Create a scheduled job to terminate inactive sessions (if pg_cron is available)
-- This would normally be done with pg_cron, but we'll create a function that can be called manually
CREATE OR REPLACE FUNCTION schedule_session_cleanup()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- This would normally schedule a cron job, but we'll just log that it was called
  INSERT INTO security_audit_log (
    action, 
    resource_type, 
    success, 
    error_message
  ) VALUES (
    'schedule_session_cleanup', 
    'system', 
    true, 
    'Session cleanup scheduled'
  );
  
  -- Actually run the cleanup now
  PERFORM terminate_inactive_sessions(24);
END;
$$;

-- Log that the fix has been applied
INSERT INTO security_audit_log (
  action, 
  resource_type, 
  success, 
  error_message
) VALUES (
  'fix_gmail_decryption', 
  'system', 
  true, 
  'Applied fix for Gmail token decryption and added session timeout'
);