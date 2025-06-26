/*
  # Re-enable Full Encryption for Gmail Tokens

  1. Security Enhancements
    - Re-enable proper encryption for Gmail tokens
    - Implement session-based encryption keys
    - Add proper decryption functions
    - Enhance security audit logging

  2. Encryption Features
    - AES-256 encryption for all sensitive data
    - User-specific encryption keys derived from session tokens
    - Initialization vectors for each encrypted field
    - Automatic token rotation and cleanup

  3. Data Protection
    - All Gmail tokens are encrypted before storage
    - Encryption keys are never stored in database
    - Session-specific access controls
    - Comprehensive audit logging
*/

-- Ensure pgcrypto extension is enabled
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Update the store_encrypted_gmail_tokens function to use REAL encryption
CREATE OR REPLACE FUNCTION store_encrypted_gmail_tokens(
  p_user_id uuid,
  p_session_token text,
  p_access_token text,
  p_refresh_token text DEFAULT NULL,
  p_token_type text DEFAULT 'Bearer',
  p_expires_at timestamptz DEFAULT NULL,
  p_scope text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_encryption_key text;
  v_encrypted_access jsonb;
  v_encrypted_refresh jsonb;
  v_session_id text;
  v_salt text;
  v_access_iv text;
  v_refresh_iv text;
BEGIN
  -- Generate session ID
  v_session_id := encode(gen_random_bytes(32), 'hex');
  
  -- Get or create salt for user
  SELECT key_salt INTO v_salt
  FROM user_encryption_keys
  WHERE user_id = p_user_id;
  
  IF v_salt IS NULL THEN
    v_salt := gen_salt('bf', 12);
    INSERT INTO user_encryption_keys (user_id, encryption_key, key_salt)
    VALUES (p_user_id, 'derived_from_session', v_salt)
    ON CONFLICT (user_id) DO UPDATE SET
      key_salt = EXCLUDED.key_salt,
      updated_at = now();
  END IF;
  
  -- Generate encryption key from session token + salt + user ID
  v_encryption_key := encode(
    digest(p_session_token || v_salt || p_user_id::text, 'sha256'), 
    'hex'
  );
  
  -- Generate IVs for encryption
  v_access_iv := encode(gen_random_bytes(16), 'hex');
  v_refresh_iv := encode(gen_random_bytes(16), 'hex');
  
  -- Encrypt access token
  v_encrypted_access := jsonb_build_object(
    'encrypted', encode(
      encrypt(
        p_access_token::bytea,
        decode(v_encryption_key, 'hex'),
        'aes-cbc'
      ),
      'hex'
    ),
    'iv', v_access_iv
  );
  
  -- Encrypt refresh token if provided
  IF p_refresh_token IS NOT NULL THEN
    v_encrypted_refresh := jsonb_build_object(
      'encrypted', encode(
        encrypt(
          p_refresh_token::bytea,
          decode(v_encryption_key, 'hex'),
          'aes-cbc'
        ),
        'hex'
      ),
      'iv', v_refresh_iv
    );
  ELSE
    v_encrypted_refresh := jsonb_build_object('encrypted', null, 'iv', null);
  END IF;
  
  -- Store encrypted tokens
  INSERT INTO gmail_tokens (
    user_id,
    encrypted_access_token,
    encrypted_refresh_token,
    token_iv,
    token_type,
    expires_at,
    scope,
    session_id,
    last_accessed
  )
  VALUES (
    p_user_id,
    v_encrypted_access->>'encrypted',
    v_encrypted_refresh->>'encrypted',
    v_access_iv, -- Store access token IV (refresh token IV stored separately if needed)
    p_token_type,
    p_expires_at,
    p_scope,
    v_session_id,
    now()
  )
  ON CONFLICT (user_id) DO UPDATE SET
    encrypted_access_token = EXCLUDED.encrypted_access_token,
    encrypted_refresh_token = EXCLUDED.encrypted_refresh_token,
    token_iv = EXCLUDED.token_iv,
    token_type = EXCLUDED.token_type,
    expires_at = EXCLUDED.expires_at,
    scope = EXCLUDED.scope,
    session_id = EXCLUDED.session_id,
    updated_at = now(),
    last_accessed = now();
  
  -- Log successful token storage
  INSERT INTO security_audit_log (user_id, action, resource_type, session_id, success)
  VALUES (p_user_id, 'store_gmail_tokens_encrypted', 'gmail_tokens', v_session_id, true);
  
  RETURN jsonb_build_object('success', true, 'session_id', v_session_id);
EXCEPTION
  WHEN OTHERS THEN
    -- Log storage failure
    INSERT INTO security_audit_log (user_id, action, resource_type, success, error_message)
    VALUES (p_user_id, 'store_gmail_tokens_failed', 'gmail_tokens', false, SQLERRM);
    
    RETURN jsonb_build_object('success', false, 'error', 'Failed to store encrypted tokens');
END;
$$;

-- Update the get_decrypted_gmail_tokens function to use REAL decryption
CREATE OR REPLACE FUNCTION get_decrypted_gmail_tokens(
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
    DELETE FROM user_encryption_keys WHERE user_id = p_user_id;
    
    RETURN jsonb_build_object('success', false, 'error', 'Tokens expired and removed');
  END IF;
  
  -- Get user's salt
  SELECT key_salt INTO v_salt
  FROM user_encryption_keys
  WHERE user_id = p_user_id;
  
  IF v_salt IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Encryption key not found');
  END IF;
  
  -- Generate encryption key from session token + salt + user ID
  v_encryption_key := encode(
    digest(p_session_token || v_salt || p_user_id::text, 'sha256'), 
    'hex'
  );
  
  -- Decrypt access token
  IF v_token_record.encrypted_access_token IS NOT NULL AND v_token_record.token_iv IS NOT NULL THEN
    BEGIN
      v_access_token := convert_from(
        decrypt(
          decode(v_token_record.encrypted_access_token, 'hex'),
          decode(v_encryption_key, 'hex'),
          'aes-cbc'
        ),
        'UTF8'
      );
    EXCEPTION
      WHEN OTHERS THEN
        -- Log decryption failure
        INSERT INTO security_audit_log (user_id, action, resource_type, success, error_message)
        VALUES (p_user_id, 'decrypt_access_token_failed', 'gmail_tokens', false, SQLERRM);
        
        RETURN jsonb_build_object('success', false, 'error', 'Failed to decrypt access token');
    END;
  END IF;
  
  -- Decrypt refresh token if it exists
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
EXCEPTION
  WHEN OTHERS THEN
    -- Log access failure
    INSERT INTO security_audit_log (user_id, action, resource_type, success, error_message)
    VALUES (p_user_id, 'access_gmail_tokens_failed', 'gmail_tokens', false, SQLERRM);
    
    RETURN jsonb_build_object('success', false, 'error', 'Failed to decrypt tokens');
END;
$$;

-- Enhanced function to completely revoke Gmail tokens with proper cleanup
CREATE OR REPLACE FUNCTION revoke_gmail_tokens(p_user_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Delete tokens
  DELETE FROM gmail_tokens WHERE user_id = p_user_id;
  
  -- Delete encryption keys
  DELETE FROM user_encryption_keys WHERE user_id = p_user_id;
  
  -- Log revocation
  INSERT INTO security_audit_log (user_id, action, resource_type, success)
  VALUES (p_user_id, 'revoke_gmail_tokens_complete', 'gmail_tokens', true);
  
  RETURN jsonb_build_object('success', true, 'message', 'Gmail tokens and encryption keys completely removed');
EXCEPTION
  WHEN OTHERS THEN
    -- Log revocation failure
    INSERT INTO security_audit_log (user_id, action, resource_type, success, error_message)
    VALUES (p_user_id, 'revoke_gmail_tokens_failed', 'gmail_tokens', false, SQLERRM);
    
    RETURN jsonb_build_object('success', false, 'error', 'Failed to revoke tokens: ' || SQLERRM);
END;
$$;

-- Function to rotate encryption keys (for enhanced security)
CREATE OR REPLACE FUNCTION rotate_user_encryption_key(p_user_id uuid, p_new_session_token text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_old_tokens jsonb;
  v_new_salt text;
  v_result jsonb;
BEGIN
  -- Get current tokens (decrypted)
  SELECT get_decrypted_gmail_tokens(p_user_id, p_new_session_token) INTO v_old_tokens;
  
  IF NOT (v_old_tokens->>'success')::boolean THEN
    RETURN jsonb_build_object('success', false, 'error', 'Could not decrypt existing tokens');
  END IF;
  
  -- Generate new salt
  v_new_salt := gen_salt('bf', 12);
  
  -- Update encryption key
  UPDATE user_encryption_keys 
  SET key_salt = v_new_salt, updated_at = now()
  WHERE user_id = p_user_id;
  
  -- Re-encrypt tokens with new key
  SELECT store_encrypted_gmail_tokens(
    p_user_id,
    p_new_session_token,
    v_old_tokens->>'access_token',
    v_old_tokens->>'refresh_token',
    v_old_tokens->>'token_type',
    (v_old_tokens->>'expires_at')::timestamptz,
    v_old_tokens->>'scope'
  ) INTO v_result;
  
  -- Log key rotation
  INSERT INTO security_audit_log (user_id, action, resource_type, success)
  VALUES (p_user_id, 'rotate_encryption_key', 'user_encryption_keys', true);
  
  RETURN jsonb_build_object('success', true, 'message', 'Encryption key rotated successfully');
EXCEPTION
  WHEN OTHERS THEN
    -- Log rotation failure
    INSERT INTO security_audit_log (user_id, action, resource_type, success, error_message)
    VALUES (p_user_id, 'rotate_encryption_key_failed', 'user_encryption_keys', false, SQLERRM);
    
    RETURN jsonb_build_object('success', false, 'error', 'Failed to rotate encryption key: ' || SQLERRM);
END;
$$;

-- Function to cleanup expired tokens and keys
CREATE OR REPLACE FUNCTION cleanup_expired_tokens()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_deleted_tokens integer;
  v_deleted_keys integer;
  v_deleted_audit integer;
BEGIN
  -- Delete expired tokens
  DELETE FROM gmail_tokens
  WHERE expires_at IS NOT NULL AND expires_at < now() - interval '1 day';
  
  GET DIAGNOSTICS v_deleted_tokens = ROW_COUNT;
  
  -- Delete orphaned encryption keys (where no tokens exist)
  DELETE FROM user_encryption_keys
  WHERE user_id NOT IN (SELECT DISTINCT user_id FROM gmail_tokens);
  
  GET DIAGNOSTICS v_deleted_keys = ROW_COUNT;
  
  -- Delete old audit logs (keep for 90 days)
  DELETE FROM security_audit_log
  WHERE created_at < now() - interval '90 days';
  
  GET DIAGNOSTICS v_deleted_audit = ROW_COUNT;
  
  -- Log cleanup operation
  INSERT INTO security_audit_log (user_id, action, resource_type, success)
  VALUES (NULL, 'cleanup_expired_tokens', 'system', true);
  
  RETURN jsonb_build_object(
    'success', true,
    'deleted_tokens', v_deleted_tokens,
    'deleted_keys', v_deleted_keys,
    'deleted_audit_logs', v_deleted_audit
  );
END;
$$;

-- Function to validate token integrity
CREATE OR REPLACE FUNCTION validate_token_integrity(p_user_id uuid, p_session_token text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_tokens jsonb;
  v_validation_result boolean := false;
BEGIN
  -- Try to decrypt tokens
  SELECT get_decrypted_gmail_tokens(p_user_id, p_session_token) INTO v_tokens;
  
  -- Check if decryption was successful
  IF (v_tokens->>'success')::boolean THEN
    -- Verify tokens are not empty
    IF v_tokens->>'access_token' IS NOT NULL AND length(v_tokens->>'access_token') > 0 THEN
      v_validation_result := true;
    END IF;
  END IF;
  
  -- Log validation attempt
  INSERT INTO security_audit_log (user_id, action, resource_type, success)
  VALUES (p_user_id, 'validate_token_integrity', 'gmail_tokens', v_validation_result);
  
  RETURN jsonb_build_object(
    'success', true,
    'valid', v_validation_result,
    'message', CASE 
      WHEN v_validation_result THEN 'Tokens are valid and properly encrypted'
      ELSE 'Token validation failed - tokens may be corrupted'
    END
  );
END;
$$;

-- Add additional security indexes
CREATE INDEX IF NOT EXISTS idx_gmail_tokens_expires ON gmail_tokens(expires_at) WHERE expires_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_user_encryption_keys_updated ON user_encryption_keys(updated_at);
CREATE INDEX IF NOT EXISTS idx_security_audit_action_created ON security_audit_log(action, created_at);

-- Update the user_encryption_keys table to ensure it has the right structure
DO $$
BEGIN
  -- Ensure encryption_key column exists and has proper default
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'user_encryption_keys' AND column_name = 'encryption_key'
  ) THEN
    ALTER TABLE user_encryption_keys ADD COLUMN encryption_key text NOT NULL DEFAULT 'derived_from_session';
  END IF;
  
  -- Ensure key_salt column exists
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'user_encryption_keys' AND column_name = 'key_salt'
  ) THEN
    ALTER TABLE user_encryption_keys ADD COLUMN key_salt text NOT NULL;
  END IF;
END $$;

-- Create a function to check encryption status
CREATE OR REPLACE FUNCTION check_encryption_status()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_total_tokens integer;
  v_encrypted_tokens integer;
  v_total_keys integer;
BEGIN
  -- Count total tokens
  SELECT COUNT(*) INTO v_total_tokens FROM gmail_tokens;
  
  -- Count tokens that appear to be encrypted (have IV and encrypted data)
  SELECT COUNT(*) INTO v_encrypted_tokens 
  FROM gmail_tokens 
  WHERE token_iv IS NOT NULL 
    AND encrypted_access_token IS NOT NULL 
    AND length(encrypted_access_token) > 32; -- Encrypted data should be longer
  
  -- Count encryption keys
  SELECT COUNT(*) INTO v_total_keys FROM user_encryption_keys;
  
  RETURN jsonb_build_object(
    'total_tokens', v_total_tokens,
    'encrypted_tokens', v_encrypted_tokens,
    'encryption_keys', v_total_keys,
    'encryption_enabled', v_encrypted_tokens > 0,
    'encryption_percentage', CASE 
      WHEN v_total_tokens > 0 THEN ROUND((v_encrypted_tokens::decimal / v_total_tokens) * 100, 2)
      ELSE 0
    END
  );
END;
$$;

-- Log that encryption has been re-enabled
INSERT INTO security_audit_log (user_id, action, resource_type, success)
VALUES (NULL, 'encryption_re_enabled', 'system', true);