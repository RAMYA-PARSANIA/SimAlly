-- Create encryption_keys table for secure key storage
CREATE TABLE IF NOT EXISTS user_encryption_keys (
  user_id uuid PRIMARY KEY REFERENCES profiles(id) ON DELETE CASCADE,
  encryption_key text NOT NULL, -- Encrypted with a server-side key
  key_salt text NOT NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Enable RLS on encryption keys
ALTER TABLE user_encryption_keys ENABLE ROW LEVEL SECURITY;

-- Create policy for encryption keys (only if it doesn't exist)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'user_encryption_keys' 
    AND policyname = 'Users can access own encryption keys'
  ) THEN
    CREATE POLICY "Users can access own encryption keys"
      ON user_encryption_keys
      FOR ALL
      TO public
      USING (user_id = auth.uid());
  END IF;
END $$;

-- Create index for performance
CREATE INDEX IF NOT EXISTS idx_user_encryption_keys_updated ON user_encryption_keys(updated_at);

-- Drop existing gmail_tokens table if it exists
DROP TABLE IF EXISTS gmail_tokens CASCADE;

-- Create new gmail_tokens table with encrypted fields
CREATE TABLE IF NOT EXISTS gmail_tokens (
  user_id uuid PRIMARY KEY REFERENCES profiles(id) ON DELETE CASCADE,
  encrypted_access_token text NOT NULL,
  encrypted_refresh_token text,
  token_iv text NOT NULL, -- Initialization vector for encryption
  token_type text DEFAULT 'Bearer',
  expires_at timestamptz NOT NULL,
  scope text,
  session_id text, -- Link to specific session
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  last_accessed timestamptz DEFAULT now()
);

-- Enable RLS on gmail_tokens
ALTER TABLE gmail_tokens ENABLE ROW LEVEL SECURITY;

-- Create policy for gmail_tokens (only if it doesn't exist)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'gmail_tokens' 
    AND policyname = 'Users can manage their own Gmail tokens'
  ) THEN
    CREATE POLICY "Users can manage their own Gmail tokens"
      ON gmail_tokens
      FOR ALL
      TO public
      USING (user_id = auth.uid())
      WITH CHECK (user_id = auth.uid());
  END IF;
END $$;

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_gmail_tokens_user_id ON gmail_tokens(user_id);
CREATE INDEX IF NOT EXISTS idx_gmail_tokens_expires_at ON gmail_tokens(expires_at);
CREATE INDEX IF NOT EXISTS idx_gmail_tokens_user_session ON gmail_tokens(user_id, session_id);

-- Create security audit log table
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

-- Create policy for audit log (only if it doesn't exist)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'security_audit_log' 
    AND policyname = 'Users can view own audit logs'
  ) THEN
    CREATE POLICY "Users can view own audit logs"
      ON security_audit_log
      FOR SELECT
      TO public
      USING ((user_id = auth.uid()) OR (user_id IS NULL));
  END IF;
END $$;

-- Create index for audit log
CREATE INDEX IF NOT EXISTS idx_security_audit_user_created ON security_audit_log(user_id, created_at);
CREATE INDEX IF NOT EXISTS idx_security_audit_action_created ON security_audit_log(action, created_at);

-- Function to generate encryption key
CREATE OR REPLACE FUNCTION generate_encryption_key(p_user_id uuid)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_key text;
  v_salt text;
BEGIN
  -- Generate a secure random key
  v_key := encode(gen_random_bytes(32), 'hex');
  v_salt := gen_salt('bf', 12);
  
  -- Store the key
  INSERT INTO user_encryption_keys (user_id, encryption_key, key_salt)
  VALUES (p_user_id, v_key, v_salt)
  ON CONFLICT (user_id) DO UPDATE SET
    encryption_key = v_key,
    key_salt = v_salt,
    updated_at = now();
  
  RETURN v_key;
END;
$$;

-- Function to encrypt sensitive data
CREATE OR REPLACE FUNCTION encrypt_data(p_data text, p_key text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_iv text;
  v_encrypted text;
BEGIN
  -- Generate random IV
  v_iv := encode(gen_random_bytes(16), 'hex');
  
  -- Encrypt data using AES
  v_encrypted := encode(
    encrypt(
      p_data::bytea,
      decode(p_key, 'hex'),
      'aes-cbc'
    ),
    'hex'
  );
  
  RETURN jsonb_build_object('encrypted', v_encrypted, 'iv', v_iv);
END;
$$;

-- Function to decrypt sensitive data
CREATE OR REPLACE FUNCTION decrypt_data(p_encrypted text, p_iv text, p_key text)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_decrypted text;
BEGIN
  -- Decrypt data
  v_decrypted := convert_from(
    decrypt(
      decode(p_encrypted, 'hex'),
      decode(p_key, 'hex'),
      'aes-cbc'
    ),
    'UTF8'
  );
  
  RETURN v_decrypted;
EXCEPTION
  WHEN OTHERS THEN
    -- Log decryption failure
    INSERT INTO security_audit_log (
      user_id,
      action,
      resource_type,
      success,
      error_message
    ) VALUES (
      auth.uid(),
      'decrypt_failure',
      'sensitive_data',
      false,
      SQLERRM
    );
    
    RETURN NULL;
END;
$$;

-- Function to store Gmail tokens securely
CREATE OR REPLACE FUNCTION store_gmail_tokens(
  p_user_id uuid,
  p_access_token text,
  p_refresh_token text,
  p_token_type text,
  p_expires_at timestamptz,
  p_scope text,
  p_session_id text
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_encryption_key text;
  v_encrypted_access jsonb;
  v_encrypted_refresh jsonb;
BEGIN
  -- Get or generate encryption key
  SELECT encryption_key INTO v_encryption_key
  FROM user_encryption_keys
  WHERE user_id = p_user_id;
  
  IF v_encryption_key IS NULL THEN
    v_encryption_key := generate_encryption_key(p_user_id);
  END IF;
  
  -- Encrypt tokens
  v_encrypted_access := encrypt_data(p_access_token, v_encryption_key);
  
  IF p_refresh_token IS NOT NULL THEN
    v_encrypted_refresh := encrypt_data(p_refresh_token, v_encryption_key);
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
    created_at,
    updated_at,
    last_accessed
  )
  VALUES (
    p_user_id,
    v_encrypted_access->>'encrypted',
    CASE WHEN p_refresh_token IS NOT NULL THEN v_encrypted_refresh->>'encrypted' ELSE NULL END,
    v_encrypted_access->>'iv',
    p_token_type,
    p_expires_at,
    p_scope,
    p_session_id,
    now(),
    now(),
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
  
  -- Log token storage
  INSERT INTO security_audit_log (
    user_id,
    action,
    resource_type,
    session_id,
    success
  ) VALUES (
    p_user_id,
    'store_gmail_tokens',
    'gmail_tokens',
    p_session_id,
    true
  );
  
  RETURN true;
EXCEPTION
  WHEN OTHERS THEN
    -- Log failure
    INSERT INTO security_audit_log (
      user_id,
      action,
      resource_type,
      session_id,
      success,
      error_message
    ) VALUES (
      p_user_id,
      'store_gmail_tokens',
      'gmail_tokens',
      p_session_id,
      false,
      SQLERRM
    );
    
    RETURN false;
END;
$$;

-- Function to get Gmail tokens
CREATE OR REPLACE FUNCTION get_gmail_tokens(p_user_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_token_record record;
  v_encryption_key text;
  v_access_token text;
  v_refresh_token text;
  v_result jsonb;
BEGIN
  -- Get token record
  SELECT * INTO v_token_record
  FROM gmail_tokens
  WHERE user_id = p_user_id;
  
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'No tokens found');
  END IF;
  
  -- Check if tokens are expired
  IF v_token_record.expires_at < now() THEN
    RETURN jsonb_build_object('success', false, 'error', 'Tokens expired');
  END IF;
  
  -- Get encryption key
  SELECT encryption_key INTO v_encryption_key
  FROM user_encryption_keys
  WHERE user_id = p_user_id;
  
  IF v_encryption_key IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Encryption key not found');
  END IF;
  
  -- Decrypt tokens
  v_access_token := decrypt_data(
    v_token_record.encrypted_access_token,
    v_token_record.token_iv,
    v_encryption_key
  );
  
  IF v_token_record.encrypted_refresh_token IS NOT NULL THEN
    v_refresh_token := decrypt_data(
      v_token_record.encrypted_refresh_token,
      v_token_record.token_iv,
      v_encryption_key
    );
  END IF;
  
  -- Update last accessed
  UPDATE gmail_tokens
  SET last_accessed = now()
  WHERE user_id = p_user_id;
  
  -- Log access
  INSERT INTO security_audit_log (
    user_id,
    action,
    resource_type,
    session_id,
    success
  ) VALUES (
    p_user_id,
    'get_gmail_tokens',
    'gmail_tokens',
    v_token_record.session_id,
    true
  );
  
  -- Return tokens
  v_result := jsonb_build_object(
    'success', true,
    'access_token', v_access_token,
    'refresh_token', v_refresh_token,
    'token_type', v_token_record.token_type,
    'expires_at', v_token_record.expires_at,
    'scope', v_token_record.scope,
    'session_id', v_token_record.session_id
  );
  
  RETURN v_result;
EXCEPTION
  WHEN OTHERS THEN
    -- Log failure
    INSERT INTO security_audit_log (
      user_id,
      action,
      resource_type,
      success,
      error_message
    ) VALUES (
      p_user_id,
      'get_gmail_tokens',
      'gmail_tokens',
      false,
      SQLERRM
    );
    
    RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END;
$$;

-- Drop existing revoke_gmail_tokens function first
DROP FUNCTION IF EXISTS revoke_gmail_tokens(uuid);

-- Function to revoke Gmail tokens
CREATE OR REPLACE FUNCTION revoke_gmail_tokens(p_user_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Delete tokens
  DELETE FROM gmail_tokens WHERE user_id = p_user_id;
  
  -- Delete encryption key
  DELETE FROM user_encryption_keys WHERE user_id = p_user_id;
  
  -- Log revocation
  INSERT INTO security_audit_log (
    user_id,
    action,
    resource_type,
    success
  ) VALUES (
    p_user_id,
    'revoke_gmail_tokens',
    'gmail_tokens',
    true
  );
  
  RETURN true;
EXCEPTION
  WHEN OTHERS THEN
    -- Log failure
    INSERT INTO security_audit_log (
      user_id,
      action,
      resource_type,
      success,
      error_message
    ) VALUES (
      p_user_id,
      'revoke_gmail_tokens',
      'gmail_tokens',
      false,
      SQLERRM
    );
    
    RETURN false;
END;
$$;

-- Function to check if Gmail tokens exist
CREATE OR REPLACE FUNCTION has_gmail_tokens(p_user_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_exists boolean;
BEGIN
  SELECT EXISTS(
    SELECT 1 FROM gmail_tokens
    WHERE user_id = p_user_id
    AND expires_at > now()
  ) INTO v_exists;
  
  RETURN v_exists;
END;
$$;

-- Function to update gmail_tokens updated_at
CREATE OR REPLACE FUNCTION update_gmail_tokens_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- Create trigger for automatic timestamp updates (only if it doesn't exist)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger 
    WHERE tgname = 'update_gmail_tokens_updated_at'
  ) THEN
    CREATE TRIGGER update_gmail_tokens_updated_at
      BEFORE UPDATE ON gmail_tokens
      FOR EACH ROW
      EXECUTE FUNCTION update_gmail_tokens_updated_at();
  END IF;
END $$;

-- Function to cleanup expired tokens
CREATE OR REPLACE FUNCTION cleanup_expired_tokens()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Delete expired tokens
  DELETE FROM gmail_tokens
  WHERE expires_at < now();
  
  -- Delete orphaned encryption keys
  DELETE FROM user_encryption_keys
  WHERE user_id NOT IN (SELECT user_id FROM gmail_tokens);
  
  -- Log cleanup
  INSERT INTO security_audit_log (
    action,
    resource_type,
    success
  ) VALUES (
    'cleanup_expired_tokens',
    'gmail_tokens',
    true
  );
END;
$$;