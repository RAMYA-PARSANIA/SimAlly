import axios from 'axios';
import { Meeting } from '../types';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

export const meetingService = {
  async createMeeting(meetingData: {
    title?: string;
    description?: string;
    startTime?: string;
    duration?: number;
  }): Promise<{ success: boolean; meeting: Meeting }> {
    const response = await axios.post(`${API_BASE_URL}/api/google/meetings/create`, meetingData, {
      withCredentials: true
    });
    return response.data;
  },

  async getMeeting(eventId: string): Promise<{ success: boolean; meeting: Meeting }> {
    const response = await axios.get(`${API_BASE_URL}/api/google/meetings/${eventId}`, {
      withCredentials: true
    });
    return response.data;
  },

  async listMeetings(): Promise<{ success: boolean; meetings: Meeting[] }> {
    const response = await axios.get(`${API_BASE_URL}/api/google/meetings`, {
      withCredentials: true
    });
    return response.data;
  },

  async deleteMeeting(eventId: string): Promise<{ success: boolean }> {
    const response = await axios.delete(`${API_BASE_URL}/api/google/meetings/${eventId}`, {
      withCredentials: true
    });
    return response.data;
  }
};