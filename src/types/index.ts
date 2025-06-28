export interface User {
  id: string;
  email?: string;
  name?: string;
  picture?: string;
  username?: string;
  full_name?: string;
}

export interface Meeting {
  id: string;
  meetingId?: string;
  url: string;
  title: string;
  description?: string;
  startTime: string;
  endTime: string;
  status: string;
  attendees?: Array<{
    email: string;
    displayName?: string;
    responseStatus?: string;
  }>;
}

export interface AuthContextType {
  user: User | null;
  sessionId: string | null;
  googleToken: string | null;
  isAuthenticated: boolean;
  loading: boolean;
  signUp: (username: string, password: string, fullName: string) => Promise<{ error?: string }>;
  signIn: (username: string, password: string) => Promise<{ error?: string }>;
  signOut: () => Promise<void>;
  connectGoogle: () => Promise<void>;
  disconnectGoogle: () => Promise<void>;
  isGoogleConnected: boolean;
}