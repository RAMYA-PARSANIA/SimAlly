import React, { createContext, useContext, useState, useEffect } from 'react';
import { authService, type User, type Session } from '../lib/auth';
import axios from 'axios';

interface AuthContextType {
  user: User | null;
  session: Session | null;
  loading: boolean;
  isAuthenticated: boolean;
  googleToken: string | null;
  isGoogleConnected: boolean;
  signUp: (username: string, password: string, fullName: string) => Promise<{ error?: string }>;
  signIn: (username: string, password: string) => Promise<{ error?: string }>;
  signOut: () => Promise<void>;
  connectGoogle: () => Promise<void>;
  disconnectGoogle: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [googleToken, setGoogleToken] = useState<string | null>(null);
  const [isGoogleConnected, setIsGoogleConnected] = useState(false);

  useEffect(() => {
    // Listen for auth state changes
    const unsubscribe = authService.onAuthStateChange((session) => {
      setSession(session);
      setUser(session?.user || null);
      setLoading(false);
    });

    // Verify current session on mount
    authService.verifySession().finally(() => {
      setLoading(false);
    });

    // Check Google connection status
    checkGoogleConnectionStatus();

    return unsubscribe;
  }, []);

  const checkGoogleConnectionStatus = async () => {
    if (!authService.getCurrentUser()) return;
    
    try {
      const userId = authService.getCurrentUser()?.id;
      const response = await fetch(`${import.meta.env.VITE_API_URL}/api/google/status?userId=${userId}`, {
        credentials: 'include',
        headers: {
          'Origin': window.location.origin
        }
      });
      
      if (response.ok) {
        const data = await response.json();
        setIsGoogleConnected(data.connected);
        if (data.token) {
          setGoogleToken(data.token);
        }
      } else {
        console.warn(`Google status check failed: ${response.status} ${response.statusText}`);
        setIsGoogleConnected(false);
      }
    } catch (error) {
      console.error('Error checking Google connection status:', error);
      setIsGoogleConnected(false);
    }
  };

  const signUp = async (username: string, password: string, fullName: string) => {
    return authService.signUp(username, password, fullName);
  };

  const signIn = async (username: string, password: string) => {
    return authService.signIn(username, password);
  };

  const signOut = async () => {
    await authService.signOut();
  };

  const connectGoogle = async () => {
    try {
      const userId = authService.getCurrentUser()?.id;
      if (!userId) {
        throw new Error('User not authenticated');
      }
      
      const response = await fetch(`${import.meta.env.VITE_API_URL}/api/google/auth-url?userId=${userId}`, {
        credentials: 'include',
        headers: {
          'Origin': window.location.origin
        }
      });
      
      if (response.ok) {
        const data = await response.json();
        if (data.success) {
          window.location.href = data.authUrl;
        } else {
          throw new Error(data.error || 'Failed to get Google auth URL');
        }
      } else {
        throw new Error(`Failed to get Google auth URL: ${response.status} ${response.statusText}`);
      }
    } catch (error) {
      console.error('Failed to connect Google:', error);
      throw error;
    }
  };

  const disconnectGoogle = async () => {
    try {
      const userId = authService.getCurrentUser()?.id;
      if (!userId) {
        throw new Error('User not authenticated');
      }
      
      const response = await fetch(`${import.meta.env.VITE_API_URL}/api/google/disconnect`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Origin': window.location.origin
        },
        credentials: 'include',
        body: JSON.stringify({ userId })
      });
      
      if (response.ok) {
        const data = await response.json();
        if (data.success) {
          setIsGoogleConnected(false);
          setGoogleToken(null);
        } else {
          throw new Error(data.error || 'Failed to disconnect Google');
        }
      } else {
        throw new Error(`Failed to disconnect Google: ${response.status} ${response.statusText}`);
      }
    } catch (error) {
      console.error('Failed to disconnect Google:', error);
      throw error;
    }
  };

  const isAuthenticated = authService.isAuthenticated();

  return (
    <AuthContext.Provider value={{
      user,
      session,
      loading,
      isAuthenticated,
      googleToken,
      isGoogleConnected,
      signUp,
      signIn,
      signOut,
      connectGoogle,
      disconnectGoogle
    }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};