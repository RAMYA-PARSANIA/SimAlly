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
  private sessionCheckInterval: number | null = null;
  private activityTimeout: number | null = null;
  private lastActivity: number = Date.now();
  private inactivityThreshold: number = 30 * 60 * 1000; // 30 minutes in milliseconds

  constructor() {
    // Load session from localStorage on init
    this.loadSession();
    // Initialize AI session when auth service starts
    this.initializeAISession();
    // Set up tab/window close detection
    this.setupTabCloseDetection();
    // Set up session expiry check
    this.startSessionExpiryCheck();
    // Set up activity tracking
    this.setupActivityTracking();
  }

  private async initializeAISession() {
    if (this.currentSession?.user?.id) {
      try {
        // Initialize secure session with AI assistant
        const response = await fetch(`${import.meta.env.VITE_AI_API_URL}/api/init-session`, {
          method: 'POST',
          headers: { 
            'Content-Type': 'application/json',
            'Origin': window.location.origin
          },
          credentials: 'include',
          body: JSON.stringify({ userId: this.currentSession.user.id })
        });
        
        if (!response.ok) {
          console.warn(`Failed to initialize AI session: ${response.status} ${response.statusText}`);
          return;
        }
        
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
    this.initializeAISession(); // Initialize AI session for new session
    this.notifyListeners();
  }

  private clearSession() {
    this.currentSession = null;
    this.sessionKey = null;
    localStorage.removeItem('simally_session');
    this.notifyListeners();
  }

  private notifyListeners() {
    this.listeners.forEach(listener => listener(this.currentSession));
  }

  private setupTabCloseDetection() {
    // Listen for page unload events (tab close, refresh, etc.)
    window.addEventListener('beforeunload', () => {
      // We don't actually log out on tab close, just mark the user as offline
      // This is because we want to keep the session active for when they return
      if (this.currentSession) {
        this.updateUserStatus('offline');
      }
    });

    // Listen for page visibility changes
    document.addEventListener('visibilitychange', () => {
      if (this.currentSession) {
        if (document.visibilityState === 'hidden') {
          this.updateUserStatus('offline');
        } else {
          this.updateUserStatus('online');
          // Reset inactivity timer when page becomes visible
          this.resetInactivityTimer();
        }
      }
    });
  }

  private startSessionExpiryCheck() {
    // Check session expiry every minute
    this.sessionCheckInterval = window.setInterval(() => {
      if (this.currentSession) {
        const expiryTime = new Date(this.currentSession.expires_at).getTime();
        const now = new Date().getTime();
        
        // If session is expired, clear it
        if (now > expiryTime) {
          console.log('Session expired, logging out');
          this.signOut();
        }
      }
    }, 60000) as unknown as number;
  }

  private setupActivityTracking() {
    // Track user activity
    const activityEvents = ['mousedown', 'mousemove', 'keypress', 'scroll', 'touchstart'];
    
    activityEvents.forEach(event => {
      document.addEventListener(event, () => this.resetInactivityTimer());
    });
    
    // Initial setup of inactivity timer
    this.resetInactivityTimer();
  }

  private resetInactivityTimer() {
    // Update last activity time
    this.lastActivity = Date.now();
    
    // Clear existing timeout
    if (this.activityTimeout !== null) {
      window.clearTimeout(this.activityTimeout);
    }
    
    // Set new timeout
    this.activityTimeout = window.setTimeout(() => {
      this.handleInactivity();
    }, this.inactivityThreshold) as unknown as number;
    
    // Update session activity in the database if we have a session
    if (this.currentSession) {
      this.updateSessionActivity();
    }
  }

  private async updateSessionActivity() {
    if (!this.currentSession) return;
    
    try {
      await supabase.rpc('update_session_activity', {
        p_token: this.currentSession.token
      });
    } catch (error) {
      console.warn('Failed to update session activity:', error);
    }
  }

  private handleInactivity() {
    if (!this.currentSession) return;
    
    const inactiveTime = Date.now() - this.lastActivity;
    
    if (inactiveTime >= this.inactivityThreshold) {
      console.log('User inactive for too long, logging out');
      this.updateUserStatus('offline');
      this.signOut();
    }
  }

  private async updateUserStatus(status: 'online' | 'offline' | 'away' | 'busy') {
    if (!this.currentSession) return;
    
    try {
      await supabase
        .from('profiles')
        .update({ status })
        .eq('id', this.currentSession.user.id);
    } catch (error) {
      console.warn('Failed to update user status:', error);
    }
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
      
      // Update user status to online
      this.updateUserStatus('online');
      
      // Reset inactivity timer
      this.resetInactivityTimer();
      
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
      
      // Update user status to online
      this.updateUserStatus('online');
      
      // Reset inactivity timer
      this.resetInactivityTimer();
      
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
            // Check if user has Gmail tokens
            const { data: hasTokens } = await supabase.rpc('has_gmail_tokens', {
              p_user_id: this.currentSession.user.id
            });
            
            if (hasTokens) {
              // Revoke tokens
              await supabase.rpc('revoke_gmail_tokens', {
                p_user_id: this.currentSession.user.id
              });
              
              console.log('Gmail tokens revoked on logout');
            }
          } catch (error) {
            console.warn('Failed to check/revoke Gmail tokens on logout:', error);
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
    
    // Clear session interval
    if (this.sessionCheckInterval) {
      window.clearInterval(this.sessionCheckInterval);
      this.sessionCheckInterval = null;
    }
    
    // Clear activity timeout
    if (this.activityTimeout) {
      window.clearTimeout(this.activityTimeout);
      this.activityTimeout = null;
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

      // Update user status to online
      this.updateUserStatus('online');
      
      // Reset inactivity timer
      this.resetInactivityTimer();
      
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

  // Set the inactivity threshold (in minutes)
  setInactivityThreshold(minutes: number): void {
    this.inactivityThreshold = minutes * 60 * 1000;
    this.resetInactivityTimer();
  }
}

export const authService = new AuthService();