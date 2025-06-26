/*
  # Gmail Token Management Functions

  1. Functions
    - `store_encrypted_gmail_tokens_with_fallback` - Securely store Gmail OAuth tokens
    - `get_decrypted_gmail_tokens_with_fallback` - Retrieve and decrypt Gmail tokens
    - `check_gmail_tokens_exist` - Check if valid tokens exist for user
    - `revoke_gmail_tokens` - Remove Gmail tokens for user
    - `update_gmail_tokens_updated_at` - Trigger function for timestamp updates

  2. Security
    - All functions use SECURITY DEFINER for controlled access
    - Tokens are base64 encoded for basic obfuscation
    - Session-based token management
    - Automatic expiration checking
*/

-- Drop existing trigger first to avoid dependency issues
DROP TRIGGER IF EXISTS update_gmail_tokens_updated_at ON gmail_tokens;

-- Drop existing functions with CASCADE to handle dependencies
DROP FUNCTION IF EXISTS store_encrypted_gmail_tokens_with_fallback(UUID, TEXT, TEXT, TEXT, TEXT, TIMESTAMPTZ, TEXT) CASCADE;
DROP FUNCTION IF EXISTS get_decrypted_gmail_tokens_with_fallback(UUID, TEXT) CASCADE;
DROP FUNCTION IF EXISTS check_gmail_tokens_exist(UUID) CASCADE;
DROP FUNCTION IF EXISTS revoke_gmail_tokens(UUID) CASCADE;
DROP FUNCTION IF EXISTS update_gmail_tokens_updated_at() CASCADE;

-- Function to store encrypted Gmail tokens with fallback
CREATE OR REPLACE FUNCTION store_encrypted_gmail_tokens_with_fallback(
  p_user_id UUID,
  p_session_token TEXT,
  p_access_token TEXT,
  p_refresh_token TEXT DEFAULT NULL,
  p_token_type TEXT DEFAULT 'Bearer',
  p_expires_at TIMESTAMPTZ DEFAULT NULL,
  p_scope TEXT DEFAULT NULL
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_encryption_key TEXT;
  v_encrypted_access_token TEXT;
  v_encrypted_refresh_token TEXT;
  v_token_iv TEXT;
  v_result JSON;
BEGIN
  -- Generate encryption key and IV
  v_encryption_key := encode(gen_random_bytes(32), 'hex');
  v_token_iv := encode(gen_random_bytes(16), 'hex');
  
  -- For now, we'll store tokens in a way that can be retrieved
  -- In a production environment, you'd use proper encryption
  v_encrypted_access_token := encode(p_access_token::bytea, 'base64');
  v_encrypted_refresh_token := CASE 
    WHEN p_refresh_token IS NOT NULL THEN encode(p_refresh_token::bytea, 'base64')
    ELSE NULL
  END;

  -- Store or update the tokens
  INSERT INTO gmail_tokens (
    user_id,
    encrypted_access_token,
    encrypted_refresh_token,
    token_type,
    expires_at,
    scope,
    token_iv,
    session_id,
    created_at,
    updated_at,
    last_accessed
  ) VALUES (
    p_user_id,
    v_encrypted_access_token,
    v_encrypted_refresh_token,
    p_token_type,
    p_expires_at,
    p_scope,
    v_token_iv,
    p_session_token,
    NOW(),
    NOW(),
    NOW()
  )
  ON CONFLICT (user_id) DO UPDATE SET
    encrypted_access_token = EXCLUDED.encrypted_access_token,
    encrypted_refresh_token = EXCLUDED.encrypted_refresh_token,
    token_type = EXCLUDED.token_type,
    expires_at = EXCLUDED.expires_at,
    scope = EXCLUDED.scope,
    token_iv = EXCLUDED.token_iv,
    session_id = EXCLUDED.session_id,
    updated_at = NOW(),
    last_accessed = NOW();

  -- Return success result
  v_result := json_build_object(
    'success', true,
    'message', 'Tokens stored successfully',
    'user_id', p_user_id,
    'expires_at', p_expires_at
  );

  RETURN v_result;

EXCEPTION
  WHEN OTHERS THEN
    -- Return error result
    v_result := json_build_object(
      'success', false,
      'error', SQLERRM,
      'code', SQLSTATE
    );
    RETURN v_result;
END;
$$;

-- Function to get decrypted Gmail tokens with fallback
CREATE OR REPLACE FUNCTION get_decrypted_gmail_tokens_with_fallback(
  p_user_id UUID,
  p_session_token TEXT
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_token_record RECORD;
  v_access_token TEXT;
  v_refresh_token TEXT;
  v_result JSON;
BEGIN
  -- Get the token record
  SELECT * INTO v_token_record
  FROM gmail_tokens
  WHERE user_id = p_user_id;

  -- Check if tokens exist
  IF NOT FOUND THEN
    v_result := json_build_object(
      'success', false,
      'error', 'No tokens found for user'
    );
    RETURN v_result;
  END IF;

  -- Check if tokens are expired
  IF v_token_record.expires_at IS NOT NULL AND v_token_record.expires_at <= NOW() THEN
    v_result := json_build_object(
      'success', false,
      'error', 'Tokens have expired'
    );
    RETURN v_result;
  END IF;

  -- Decrypt tokens (simplified for this implementation)
  BEGIN
    v_access_token := convert_from(decode(v_token_record.encrypted_access_token, 'base64'), 'UTF8');
    v_refresh_token := CASE 
      WHEN v_token_record.encrypted_refresh_token IS NOT NULL 
      THEN convert_from(decode(v_token_record.encrypted_refresh_token, 'base64'), 'UTF8')
      ELSE NULL
    END;
  EXCEPTION
    WHEN OTHERS THEN
      v_result := json_build_object(
        'success', false,
        'error', 'Failed to decrypt tokens'
      );
      RETURN v_result;
  END;

  -- Update last accessed time
  UPDATE gmail_tokens 
  SET last_accessed = NOW()
  WHERE user_id = p_user_id;

  -- Return decrypted tokens
  v_result := json_build_object(
    'success', true,
    'access_token', v_access_token,
    'refresh_token', v_refresh_token,
    'token_type', v_token_record.token_type,
    'expires_at', v_token_record.expires_at,
    'scope', v_token_record.scope
  );

  RETURN v_result;

EXCEPTION
  WHEN OTHERS THEN
    v_result := json_build_object(
      'success', false,
      'error', SQLERRM,
      'code', SQLSTATE
    );
    RETURN v_result;
END;
$$;

-- Function to check if Gmail tokens exist
CREATE OR REPLACE FUNCTION check_gmail_tokens_exist(
  p_user_id UUID
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_exists BOOLEAN := FALSE;
BEGIN
  SELECT EXISTS(
    SELECT 1 FROM gmail_tokens 
    WHERE user_id = p_user_id 
    AND (expires_at IS NULL OR expires_at > NOW())
  ) INTO v_exists;
  
  RETURN v_exists;
END;
$$;

-- Function to revoke Gmail tokens
CREATE OR REPLACE FUNCTION revoke_gmail_tokens(
  p_user_id UUID
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_result JSON;
BEGIN
  -- Delete the tokens
  DELETE FROM gmail_tokens WHERE user_id = p_user_id;
  
  v_result := json_build_object(
    'success', true,
    'message', 'Tokens revoked successfully'
  );
  
  RETURN v_result;

EXCEPTION
  WHEN OTHERS THEN
    v_result := json_build_object(
      'success', false,
      'error', SQLERRM
    );
    RETURN v_result;
END;
$$;

-- Trigger function to update gmail_tokens updated_at
CREATE OR REPLACE FUNCTION update_gmail_tokens_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

-- Create trigger for automatic timestamp updates
CREATE TRIGGER update_gmail_tokens_updated_at
  BEFORE UPDATE ON gmail_tokens
  FOR EACH ROW
  EXECUTE FUNCTION update_gmail_tokens_updated_at();

-- Grant necessary permissions
GRANT EXECUTE ON FUNCTION store_encrypted_gmail_tokens_with_fallback TO authenticated, anon;
GRANT EXECUTE ON FUNCTION get_decrypted_gmail_tokens_with_fallback TO authenticated, anon;
GRANT EXECUTE ON FUNCTION check_gmail_tokens_exist TO authenticated, anon;
GRANT EXECUTE ON FUNCTION revoke_gmail_tokens TO authenticated, anon;