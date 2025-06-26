// Custom authentication service for username/password login with enhanced security
import { supabase } from './supabase';

export interface User {
  id: string;
  username: string;
  full_name: string;
}

export interface Session {
  token: string;
  expires_at: string;
  user: User;
}

class AuthService {
  private currentSession: Session | null = null;
  private listeners: ((session: Session | null) => void)[] = [];
  private sessionKey: string | null = null;

  constructor() {
    // Load session from localStorage on init
    this.loadSession();
    // Initialize AI session when auth service starts
    this.initializeAISession();
  }

  private async initializeAISession() {
    if (this.currentSession?.user?.id) {
      try {
        // Initialize secure session with AI assistant
        const response = await fetch(`${import.meta.env.VITE_AI_API_URL}/api/init-session`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ userId: this.currentSession.user.id })
        });
        
        const data = await response.json();
        if (data.success) {
          this.sessionKey = data.sessionId;
          console.log('AI session initialized securely');
        }
      } catch (error) {
        console.warn('Failed to initialize AI session:', error);
      }
    }
  }

  private loadSession() {
    const sessionData = localStorage.getItem('simally_session');
    if (sessionData) {
      try {
        const session = JSON.parse(sessionData);
        if (new Date(session.expires_at) > new Date()) {
          this.currentSession = session;
          this.setSupabaseContext(session.token);
          this.initializeAISession(); // Initialize AI session for existing session
        } else {
          localStorage.removeItem('simally_session');
        }
      } catch (error) {
        localStorage.removeItem('simally_session');
      }
    }
  }

  private saveSession(session: Session) {
    this.currentSession = session;
    localStorage.setItem('simally_session', JSON.stringify(session));
    this.setSupabaseContext(session.token);
    this.initializeAISession(); // Initialize AI session for new session
    this.notifyListeners();
  }

  private clearSession() {
    this.currentSession = null;
    this.sessionKey = null;
    localStorage.removeItem('simally_session');
    this.clearSupabaseContext();
    this.notifyListeners();
  }

  private async setSupabaseContext(token: string) {
    try {
      // Set the token in Supabase context for RLS
      await supabase.rpc('set_config', {
        setting_name: 'app.current_user_token',
        setting_value: token,
        is_local: true
      });
    } catch (error) {
      // Ignore errors for this context setting as it's not critical
      console.warn('Failed to set Supabase context:', error);
    }
  }

  private async clearSupabaseContext() {
    try {
      await supabase.rpc('set_config', {
        setting_name: 'app.current_user_token',
        setting_value: '',
        is_local: true
      });
    } catch (error) {
      // Ignore errors for this context setting as it's not critical
      console.warn('Failed to clear Supabase context:', error);
    }
  }

  private notifyListeners() {
    this.listeners.forEach(listener => listener(this.currentSession));
  }

  onAuthStateChange(callback: (session: Session | null) => void) {
    this.listeners.push(callback);
    // Immediately call with current session
    callback(this.currentSession);
    
    // Return unsubscribe function
    return () => {
      this.listeners = this.listeners.filter(listener => listener !== callback);
    };
  }

  async signUp(username: string, password: string, fullName: string): Promise<{ error?: string }> {
    try {
      console.log('Attempting to register user:', username);
      
      const { data, error } = await supabase.rpc('register_user', {
        p_username: username,
        p_password: password,
        p_full_name: fullName
      });

      console.log('Registration response:', { data, error });

      if (error) {
        console.error('Registration error:', error);
        return { error: error.message };
      }

      if (!data || !data.success) {
        console.error('Registration failed:', data);
        return { error: data?.error || 'Registration failed' };
      }

      // Save session
      const session: Session = {
        token: data.session.token,
        expires_at: data.session.expires_at,
        user: data.user
      };

      console.log('Registration successful, saving session:', session);
      this.saveSession(session);
      return {};
    } catch (error) {
      console.error('Registration exception:', error);
      return { error: 'Registration failed. Please try again.' };
    }
  }

  async signIn(username: string, password: string): Promise<{ error?: string }> {
    try {
      const { data, error } = await supabase.rpc('login_user', {
        p_username: username,
        p_password: password
      });

      if (error) {
        return { error: error.message };
      }

      if (!data.success) {
        return { error: data.error };
      }

      // Save session
      const session: Session = {
        token: data.session.token,
        expires_at: data.session.expires_at,
        user: data.user
      };

      this.saveSession(session);
      return {};
    } catch (error) {
      return { error: 'Login failed. Please try again.' };
    }
  }

  async signOut(): Promise<void> {
    if (this.currentSession) {
      try {
        // Disconnect Gmail if connected
        if (this.currentSession.user?.id) {
          try {
            await fetch(`${import.meta.env.VITE_AI_API_URL}/api/gmail/disconnect`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              credentials: 'include',
              body: JSON.stringify({ userId: this.currentSession.user.id })
            });
          } catch (error) {
            console.warn('Failed to disconnect Gmail on logout:', error);
          }
        }

        // Logout from main session
        await supabase.rpc('logout_user', {
          p_token: this.currentSession.token
        });
      } catch (error) {
        console.error('Logout error:', error);
      }
    }
    this.clearSession();
  }

  async verifySession(): Promise<boolean> {
    if (!this.currentSession) return false;

    try {
      const { data, error } = await supabase.rpc('verify_session', {
        p_token: this.currentSession.token
      });

      if (error || !data.success) {
        this.clearSession();
        return false;
      }

      return true;
    } catch (error) {
      this.clearSession();
      return false;
    }
  }

  getCurrentSession(): Session | null {
    return this.currentSession;
  }

  getCurrentUser(): User | null {
    return this.currentSession?.user || null;
  }

  getSessionKey(): string | null {
    return this.sessionKey;
  }

  isAuthenticated(): boolean {
    return !!this.currentSession;
  }
}

export const authService = new AuthService();