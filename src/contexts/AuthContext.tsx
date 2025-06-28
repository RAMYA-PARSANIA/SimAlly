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
    try {
      const response = await axios.get(`${import.meta.env.VITE_API_URL}/api/google/status`, {
        withCredentials: true
      });
      
      if (response.data.success) {
        setIsGoogleConnected(response.data.connected);
        if (response.data.token) {
          setGoogleToken(response.data.token);
        }
      }
    } catch (error) {
      console.error('Failed to check Google connection status:', error);
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
      const response = await axios.get(`${import.meta.env.VITE_API_URL}/api/google/auth-url`, {
        withCredentials: true
      });
      
      if (response.data.success) {
        window.location.href = response.data.authUrl;
      } else {
        throw new Error(response.data.error || 'Failed to get Google auth URL');
      }
    } catch (error) {
      console.error('Failed to connect Google:', error);
      throw error;
    }
  };

  const disconnectGoogle = async () => {
    try {
      const response = await axios.post(`${import.meta.env.VITE_API_URL}/api/google/disconnect`, {}, {
        withCredentials: true
      });
      
      if (response.data.success) {
        setIsGoogleConnected(false);
        setGoogleToken(null);
      } else {
        throw new Error(response.data.error || 'Failed to disconnect Google');
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