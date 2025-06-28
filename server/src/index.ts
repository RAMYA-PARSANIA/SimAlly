export interface User {
  id: string;
  email: string;
  name: string;
  picture: string;
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
  login: () => Promise<void>;
  logout: () => void;
  isLoading: boolean;
}