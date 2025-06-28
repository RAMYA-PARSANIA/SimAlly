import axios from 'axios';
import { Meeting } from '../types';

const API_BASE_URL = 'http://localhost:3001/api';

export const meetingService = {
  async createMeeting(sessionId: string, meetingData: {
    title?: string;
    description?: string;
    startTime?: string;
    duration?: number;
  }) {
    const response = await axios.post(`${API_BASE_URL}/meetings/create`, {
      sessionId,
      ...meetingData
    });
    return response.data;
  },

  async getMeeting(sessionId: string, eventId: string): Promise<{ success: boolean; meeting: Meeting }> {
    const response = await axios.get(`${API_BASE_URL}/meetings/${eventId}`, {
      params: { sessionId }
    });
    return response.data;
  },

  async listMeetings(sessionId: string): Promise<{ success: boolean; meetings: Meeting[] }> {
    const response = await axios.get(`${API_BASE_URL}/meetings`, {
      params: { sessionId }
    });
    return response.data;
  },

  async deleteMeeting(sessionId: string, eventId: string) {
    const response = await axios.delete(`${API_BASE_URL}/meetings/${eventId}`, {
      params: { sessionId }
    });
    return response.data;
  }
};