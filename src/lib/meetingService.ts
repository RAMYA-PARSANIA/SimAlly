import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL;

export interface Meeting {
  id: string;
  spaceId: string;
  meetingCode: string;
  meetingUri: string;
  title: string;
  description?: string;
  startTime?: string;
  endTime?: string;
  status: 'active' | 'ended' | 'cancelled';
  created_at: string;
  participants?: any[];
  recordings?: any[];
}

export interface CreateMeetingParams {
  userId: string;
  title: string;
  description?: string;
  startTime?: string;
  endTime?: string;
  participants?: string[];
}

export const meetingService = {
  async createMeeting(params: CreateMeetingParams): Promise<Meeting> {
    try {
      const response = await axios.post(`${API_URL}/api/google/meet/spaces/create`, params, {
        withCredentials: true
      });
      
      if (response.data.success) {
        return response.data.meeting;
      } else {
        throw new Error(response.data.error || 'Failed to create meeting');
      }
    } catch (error) {
      console.error('Failed to create meeting:', error);
      throw new Error('Failed to create meeting. Please ensure you have connected your Google account.');
    }
  },
  
  async listMeetings(userId: string): Promise<Meeting[]> {
    try {
      const response = await axios.get(`${API_URL}/api/google/meet/spaces`, {
        params: { userId },
        withCredentials: true
      });
      
      if (response.data.success) {
        return response.data.meetings;
      } else {
        throw new Error(response.data.error || 'Failed to list meetings');
      }
    } catch (error) {
      console.error('Failed to list meetings:', error);
      throw new Error('Failed to list meetings. Please ensure you have connected your Google account.');
    }
  },
  
  async getMeeting(spaceId: string, userId: string): Promise<Meeting> {
    try {
      const response = await axios.get(`${API_URL}/api/google/meet/spaces/${spaceId}`, {
        params: { userId },
        withCredentials: true
      });
      
      if (response.data.success) {
        return response.data.meeting;
      } else {
        throw new Error(response.data.error || 'Failed to get meeting details');
      }
    } catch (error) {
      console.error('Failed to get meeting details:', error);
      throw new Error('Failed to get meeting details. Please try again.');
    }
  },
  
  async endMeeting(spaceId: string, userId: string): Promise<void> {
    try {
      const response = await axios.post(`${API_URL}/api/google/meet/spaces/${spaceId}/end`, 
        { userId },
        { withCredentials: true }
      );
      
      if (!response.data.success) {
        throw new Error(response.data.error || 'Failed to end meeting');
      }
    } catch (error) {
      console.error('Failed to end meeting:', error);
      throw new Error('Failed to end meeting. Please try again.');
    }
  },
  
  async deleteMeeting(spaceId: string, userId: string): Promise<void> {
    try {
      const response = await axios.delete(`${API_URL}/api/google/meet/spaces/${spaceId}`, {
        data: { userId },
        withCredentials: true
      });
      
      if (!response.data.success) {
        throw new Error(response.data.error || 'Failed to delete meeting');
      }
    } catch (error) {
      console.error('Failed to delete meeting:', error);
      throw new Error('Failed to delete meeting. Please try again.');
    }
  },
  
  async getRecordings(conferenceId: string, userId: string): Promise<any[]> {
    try {
      const response = await axios.get(`${API_URL}/api/google/meet/conferences/${conferenceId}/recordings`, {
        params: { userId },
        withCredentials: true
      });
      
      if (response.data.success) {
        return response.data.recordings;
      } else {
        throw new Error(response.data.error || 'Failed to get recordings');
      }
    } catch (error) {
      console.error('Failed to get recordings:', error);
      throw new Error('Failed to get recordings. Please try again.');
    }
  },
  
  async getTranscripts(conferenceId: string, userId: string): Promise<any[]> {
    try {
      const response = await axios.get(`${API_URL}/api/google/meet/conferences/${conferenceId}/transcripts`, {
        params: { userId },
        withCredentials: true
      });
      
      if (response.data.success) {
        return response.data.transcripts;
      } else {
        throw new Error(response.data.error || 'Failed to get transcripts');
      }
    } catch (error) {
      console.error('Failed to get transcripts:', error);
      throw new Error('Failed to get transcripts. Please try again.');
    }
  }
};