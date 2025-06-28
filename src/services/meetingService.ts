import axios from 'axios';
import { Meeting } from '../types';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

export const meetingService = {
  async createMeeting(userId: string, meetingData: {
    title: string;
    description?: string;
    startTime: string;
    duration: number;
    attendees?: string[];
  }): Promise<{ success: boolean; meeting: Meeting }> {
    try {
      const response = await axios.post(`${API_URL}/api/google/meetings/create`, {
        userId,
        ...meetingData
      });
      return response.data;
    } catch (error) {
      console.error('Failed to create meeting:', error);
      throw new Error('Failed to create meeting. Please ensure you have connected your Google account.');
    }
  },

  async listMeetings(userId: string): Promise<{ success: boolean; meetings: Meeting[] }> {
    try {
      const response = await axios.get(`${API_URL}/api/google/meetings`, {
        params: { userId }
      });
      return response.data;
    } catch (error) {
      console.error('Failed to list meetings:', error);
      throw new Error('Failed to load meetings. Please try again later.');
    }
  },

  async getMeeting(userId: string, meetingId: string): Promise<{ success: boolean; meeting: Meeting }> {
    try {
      const response = await axios.get(`${API_URL}/api/google/meetings/${meetingId}`, {
        params: { userId }
      });
      return response.data;
    } catch (error) {
      console.error('Failed to get meeting details:', error);
      throw new Error('Failed to load meeting details. Please try again later.');
    }
  },

  async deleteMeeting(userId: string, meetingId: string): Promise<{ success: boolean }> {
    try {
      const response = await axios.delete(`${API_URL}/api/google/meetings/${meetingId}`, {
        params: { userId }
      });
      return response.data;
    } catch (error) {
      console.error('Failed to delete meeting:', error);
      throw new Error('Failed to delete meeting. Please try again later.');
    }
  }
};