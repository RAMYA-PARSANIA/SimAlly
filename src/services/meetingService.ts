import axios from 'axios';
import { Meeting } from '../types';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000/api';

export const meetingService = {
  async createMeeting(meetingData: {
    userId?: string;
    title?: string;
    description?: string;
    startTime?: string;
    duration?: number;
    attendees?: string[];
  }): Promise<{ success: boolean; meeting: Meeting; error?: string }> {
    try {
      const response = await axios.post(`${API_BASE_URL}/google/meetings/create`, {
        userId: meetingData.userId,
        title: meetingData.title,
        description: meetingData.description,
        startTime: meetingData.startTime,
        duration: meetingData.duration,
        attendees: meetingData.attendees
      }, {
        withCredentials: true,
        headers: {
          'Origin': window.location.origin
        }
      });
      return response.data;
    } catch (error: any) {
      console.error('Failed to create meeting:', error);
      return {
        success: false,
        meeting: {} as Meeting,
        error: error.response?.data?.error || 'Failed to create meeting. Please ensure you have connected your Google account.'
      };
    }
  },

  async getMeeting(eventId: string, userId?: string): Promise<{ success: boolean; meeting: Meeting; error?: string }> {
    try {
      const response = await axios.get(`${API_BASE_URL}/google/meetings/${eventId}`, {
        params: { userId },
        withCredentials: true,
        headers: {
          'Origin': window.location.origin
        }
      });
      return response.data;
    } catch (error: any) {
      console.error('Failed to get meeting:', error);
      return {
        success: false,
        meeting: {} as Meeting,
        error: error.response?.data?.error || 'Failed to get meeting details.'
      };
    }
  },

  async listMeetings(userId?: string): Promise<{ success: boolean; meetings: Meeting[]; error?: string }> {
    try {
      const response = await axios.get(`${API_BASE_URL}/google/meetings`, {
        params: { userId },
        withCredentials: true,
        headers: {
          'Origin': window.location.origin
        }
      });
      return response.data;
    } catch (error: any) {
      console.error('Failed to list meetings:', error);
      return {
        success: false,
        meetings: [],
        error: error.response?.data?.error || 'Failed to load meetings. Please try again later.'
      };
    }
  },

  async deleteMeeting(eventId: string, userId?: string): Promise<{ success: boolean; error?: string }> {
    try {
      const response = await axios.delete(`${API_BASE_URL}/google/meetings/${eventId}`, {
        params: { userId },
        withCredentials: true,
        headers: {
          'Origin': window.location.origin
        }
      });
      return response.data;
    } catch (error: any) {
      console.error('Failed to delete meeting:', error);
      return {
        success: false,
        error: error.response?.data?.error || 'Failed to delete meeting.'
      };
    }
  }
};