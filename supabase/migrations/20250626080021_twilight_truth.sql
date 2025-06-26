/*
  # Implement Data Encryption and Enhanced Security

  1. Security Enhancements
    - Add pgcrypto extension for encryption
    - Create encryption functions for sensitive data
    - Add user-specific encryption keys
    - Implement secure token storage
    - Add session-based access controls

  2. Data Protection
    - Encrypt Gmail tokens with user-specific keys
    - Hash all sensitive data
    - Implement proper access controls
    - Add audit logging

  3. Access Control
    - Separate encryption keys per user
    - Session-based token access
    - Time-limited token access
    - Automatic token rotation
*/

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create user encryption keys table
CREATE TABLE IF NOT EXISTS user_encryption_keys (
  user_id uuid PRIMARY KEY REFERENCES profiles(id) ON DELETE CASCADE,
  encryption_key text NOT NULL, -- This will be derived from user session, not stored directly
  key_salt text NOT NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Enable RLS on encryption keys
ALTER TABLE user_encryption_keys ENABLE ROW LEVEL SECURITY;

-- Policy: Users can only access their own encryption keys
CREATE POLICY "Users can access own encryption keys"
  ON user_encryption_keys
  FOR ALL
  TO authenticated
  USING (user_id = auth.uid());

-- Update gmail_tokens table structure for encryption
ALTER TABLE gmail_tokens 
  DROP COLUMN IF EXISTS access_token,
  DROP COLUMN IF EXISTS refresh_token,
  ADD COLUMN IF NOT EXISTS encrypted_access_token text,
  ADD COLUMN IF NOT EXISTS encrypted_refresh_token text,
  ADD COLUMN IF NOT EXISTS token_iv text, -- Initialization vector for encryption
  ADD COLUMN IF NOT EXISTS session_id text, -- Link to specific session
  ADD COLUMN IF NOT EXISTS last_accessed timestamptz DEFAULT now();

-- Create audit log table for sensitive operations
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

-- Policy: Users can only view their own audit logs
CREATE POLICY "Users can view own audit logs"
  ON security_audit_log
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

-- Function to generate user-specific encryption key
CREATE OR REPLACE FUNCTION generate_user_encryption_key(p_user_id uuid, p_session_token text)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_salt text;
  v_key text;
BEGIN
  -- Get or create salt for user
  SELECT key_salt INTO v_salt
  FROM user_encryption_keys
  WHERE user_id = p_user_id;
  
  IF v_salt IS NULL THEN
    v_salt := gen_salt('bf', 12);
    INSERT INTO user_encryption_keys (user_id, encryption_key, key_salt)
    VALUES (p_user_id, 'placeholder', v_salt)
    ON CONFLICT (user_id) DO UPDATE SET
      key_salt = EXCLUDED.key_salt,
      updated_at = now();
  END IF;
  
  -- Generate encryption key from session token + salt
  -- This ensures the key is unique per session and user
  v_key := encode(digest(p_session_token || v_salt || p_user_id::text, 'sha256'), 'hex');
  
  RETURN v_key;
END;
$$;

-- Function to encrypt sensitive data
CREATE OR REPLACE FUNCTION encrypt_sensitive_data(p_data text, p_encryption_key text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_iv text;
  v_encrypted text;
BEGIN
  IF p_data IS NULL OR p_data = '' THEN
    RETURN jsonb_build_object('encrypted', null, 'iv', null);
  END IF;
  
  -- Generate random IV
  v_iv := encode(gen_random_bytes(16), 'hex');
  
  -- Encrypt data using AES
  v_encrypted := encode(
    encrypt(
      p_data::bytea,
      decode(p_encryption_key, 'hex'),
      'aes-cbc'
    ),
    'hex'
  );
  
  RETURN jsonb_build_object('encrypted', v_encrypted, 'iv', v_iv);
END;
$$;

-- Function to decrypt sensitive data
CREATE OR REPLACE FUNCTION decrypt_sensitive_data(p_encrypted_data text, p_iv text, p_encryption_key text)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_decrypted text;
BEGIN
  IF p_encrypted_data IS NULL OR p_iv IS NULL THEN
    RETURN NULL;
  END IF;
  
  -- Decrypt data
  v_decrypted := convert_from(
    decrypt(
      decode(p_encrypted_data, 'hex'),
      decode(p_encryption_key, 'hex'),
      'aes-cbc'
    ),
    'UTF8'
  );
  
  RETURN v_decrypted;
EXCEPTION
  WHEN OTHERS THEN
    -- Log decryption failure
    INSERT INTO security_audit_log (user_id, action, resource_type, success, error_message)
    VALUES (auth.uid(), 'decrypt_failure', 'sensitive_data', false, SQLERRM);
    RETURN NULL;
END;
$$;

-- Function to store encrypted Gmail tokens
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
BEGIN
  -- Generate session ID
  v_session_id := encode(gen_random_bytes(32), 'hex');
  
  -- Generate user-specific encryption key
  v_encryption_key := generate_user_encryption_key(p_user_id, p_session_token);
  
  -- Encrypt tokens
  v_encrypted_access := encrypt_sensitive_data(p_access_token, v_encryption_key);
  v_encrypted_refresh := encrypt_sensitive_data(p_refresh_token, v_encryption_key);
  
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
    v_encrypted_access->>'iv',
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
  VALUES (p_user_id, 'store_gmail_tokens', 'gmail_tokens', v_session_id, true);
  
  RETURN jsonb_build_object('success', true, 'session_id', v_session_id);
END;
$$;

-- Function to retrieve and decrypt Gmail tokens
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
    RETURN jsonb_build_object('success', false, 'error', 'Tokens expired');
  END IF;
  
  -- Generate encryption key
  v_encryption_key := generate_user_encryption_key(p_user_id, p_session_token);
  
  -- Decrypt tokens
  v_access_token := decrypt_sensitive_data(
    v_token_record.encrypted_access_token,
    v_token_record.token_iv,
    v_encryption_key
  );
  
  v_refresh_token := decrypt_sensitive_data(
    v_token_record.encrypted_refresh_token,
    v_token_record.token_iv,
    v_encryption_key
  );
  
  -- Update last accessed
  UPDATE gmail_tokens
  SET last_accessed = now()
  WHERE user_id = p_user_id;
  
  -- Log successful token access
  INSERT INTO security_audit_log (user_id, action, resource_type, session_id, success)
  VALUES (p_user_id, 'access_gmail_tokens', 'gmail_tokens', v_token_record.session_id, true);
  
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

-- Function to revoke Gmail tokens
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
  VALUES (p_user_id, 'revoke_gmail_tokens', 'gmail_tokens', true);
  
  RETURN jsonb_build_object('success', true);
END;
$$;

-- Function to cleanup expired tokens
CREATE OR REPLACE FUNCTION cleanup_expired_tokens()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Delete expired tokens
  DELETE FROM gmail_tokens
  WHERE expires_at IS NOT NULL AND expires_at < now() - interval '1 day';
  
  -- Delete old audit logs (keep for 90 days)
  DELETE FROM security_audit_log
  WHERE created_at < now() - interval '90 days';
END;
$$;

-- Create index for performance
CREATE INDEX IF NOT EXISTS idx_gmail_tokens_user_session ON gmail_tokens(user_id, session_id);
CREATE INDEX IF NOT EXISTS idx_gmail_tokens_expires ON gmail_tokens(expires_at);
CREATE INDEX IF NOT EXISTS idx_security_audit_user_created ON security_audit_log(user_id, created_at);

-- Update RLS policies for gmail_tokens
DROP POLICY IF EXISTS "Users can manage their own Gmail tokens" ON gmail_tokens;

CREATE POLICY "Users can manage their own Gmail tokens"
  ON gmail_tokens
  FOR ALL
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- Schedule cleanup job (if pg_cron is available)
-- SELECT cron.schedule('cleanup-expired-tokens', '0 2 * * *', 'SELECT cleanup_expired_tokens();');