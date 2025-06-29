import React, { useState, useEffect, useRef } from 'react';
import { Bell, CheckSquare, Calendar, X, Clock } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import GlassCard from './ui/GlassCard';

interface Notification {
  id: string;
  title: string;
  message: string;
  type: 'task' | 'reminder' | 'event';
  itemId: string;
}

const NotificationManager: React.FC = () => {
  const { user } = useAuth();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [notifiedItems, setNotifiedItems] = useState<Set<string>>(new Set());
  const checkIntervalRef = useRef<number | null>(null);

  useEffect(() => {
    if (user) {
      // Initial check
      checkForNotifications();
      
      // Set up interval to check every minute
      checkIntervalRef.current = window.setInterval(checkForNotifications, 60000);
    }
    
    return () => {
      if (checkIntervalRef.current) {
        window.clearInterval(checkIntervalRef.current);
      }
    };
  }, [user]);

  const checkForNotifications = async () => {
    if (!user) return;
    
    try {
      // Check for tasks due in 1 day
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      tomorrow.setHours(0, 0, 0, 0);
      
      const dayAfterTomorrow = new Date(tomorrow);
      dayAfterTomorrow.setDate(dayAfterTomorrow.getDate() + 1);
      
      // Format dates as ISO strings for comparison
      const tomorrowStr = tomorrow.toISOString();
      const dayAfterTomorrowStr = dayAfterTomorrow.toISOString();
      
      // Get tasks due tomorrow
      const { data: dueTasks, error: taskError } = await supabase
        .from('tasks')
        .select('*')
        .gte('due_date', tomorrowStr)
        .lt('due_date', dayAfterTomorrowStr)
        .not('status', 'eq', 'completed')
        .not('status', 'eq', 'cancelled');
      
      if (taskError) {
        console.error('Error checking for due tasks:', taskError);
      } else if (dueTasks && dueTasks.length > 0) {
        // Create notifications for tasks due tomorrow
        const taskNotifications = dueTasks
          .filter(task => !notifiedItems.has(`task-${task.id}-tomorrow`))
          .map(task => ({
            id: `task-${task.id}-${Date.now()}`,
            title: 'Task Due Tomorrow',
            message: `"${task.title}" is due tomorrow`,
            type: 'task' as const,
            itemId: task.id
          }));
        
        // Add to notified items
        const newNotifiedItems = new Set(notifiedItems);
        dueTasks.forEach(task => {
          newNotifiedItems.add(`task-${task.id}-tomorrow`);
        });
        
        if (taskNotifications.length > 0) {
          setNotifications(prev => [...prev, ...taskNotifications]);
          setNotifiedItems(newNotifiedItems);
        }
      }
      
      // Check for reminders due within the next hour
      const now = new Date();
      const oneHourLater = new Date(now);
      oneHourLater.setHours(oneHourLater.getHours() + 1);
      
      const nowIso = now.toISOString();
      const oneHourLaterIso = oneHourLater.toISOString();
      
      const { data: upcomingReminders, error: reminderError } = await supabase
        .from('calendar_events')
        .select('*')
        .eq('is_reminder', true)
        .eq('user_id', user.id)
        .gte('start_time', nowIso)
        .lt('start_time', oneHourLaterIso);
      
      if (reminderError) {
        console.error('Error checking for upcoming reminders:', reminderError);
      } else if (upcomingReminders && upcomingReminders.length > 0) {
        // Create notifications for upcoming reminders
        const reminderNotifications = upcomingReminders
          .filter(reminder => !notifiedItems.has(`reminder-${reminder.id}`))
          .map(reminder => {
            const reminderTime = new Date(reminder.start_time);
            const minutesUntil = Math.round((reminderTime.getTime() - now.getTime()) / 60000);
            
            return {
              id: `reminder-${reminder.id}-${Date.now()}`,
              title: 'Upcoming Reminder',
              message: minutesUntil <= 5 
                ? `"${reminder.title}" is happening now!` 
                : `"${reminder.title}" is coming up in ${minutesUntil} minutes`,
              type: 'reminder' as const,
              itemId: reminder.id
            };
          });
        
        // Add to notified items
        const newNotifiedItems = new Set(notifiedItems);
        upcomingReminders.forEach(reminder => {
          newNotifiedItems.add(`reminder-${reminder.id}`);
        });
        
        if (reminderNotifications.length > 0) {
          setNotifications(prev => [...prev, ...reminderNotifications]);
          setNotifiedItems(newNotifiedItems);
        }
      }
      
      // Check for events starting within the next hour
      const { data: upcomingEvents, error: eventError } = await supabase
        .from('calendar_events')
        .select('*')
        .eq('is_reminder', false)
        .eq('user_id', user.id)
        .gte('start_time', nowIso)
        .lt('start_time', oneHourLaterIso);
      
      if (eventError) {
        console.error('Error checking for upcoming events:', eventError);
      } else if (upcomingEvents && upcomingEvents.length > 0) {
        // Create notifications for upcoming events
        const eventNotifications = upcomingEvents
          .filter(event => !notifiedItems.has(`event-${event.id}`))
          .map(event => {
            const eventTime = new Date(event.start_time);
            const minutesUntil = Math.round((eventTime.getTime() - now.getTime()) / 60000);
            
            return {
              id: `event-${event.id}-${Date.now()}`,
              title: 'Upcoming Event',
              message: minutesUntil <= 5 
                ? `"${event.title}" is starting now!` 
                : `"${event.title}" is starting in ${minutesUntil} minutes`,
              type: 'event' as const,
              itemId: event.id
            };
          });
        
        // Add to notified items
        const newNotifiedItems = new Set(notifiedItems);
        upcomingEvents.forEach(event => {
          newNotifiedItems.add(`event-${event.id}`);
        });
        
        if (eventNotifications.length > 0) {
          setNotifications(prev => [...prev, ...eventNotifications]);
          setNotifiedItems(newNotifiedItems);
        }
      }
    } catch (error) {
      console.error('Error checking for notifications:', error);
    }
  };

  const dismissNotification = (id: string) => {
    setNotifications(prev => prev.filter(notification => notification.id !== id));
  };

  const getNotificationIcon = (type: string) => {
    switch (type) {
      case 'task':
        return <CheckSquare className="w-5 h-5 text-blue-400" />;
      case 'reminder':
        return <Bell className="w-5 h-5 text-yellow-400" />;
      case 'event':
        return <Calendar className="w-5 h-5 text-green-400" />;
      default:
        return <Bell className="w-5 h-5 text-secondary" />;
    }
  };

  const getNotificationColor = (type: string) => {
    switch (type) {
      case 'task':
        return 'bg-blue-500/10 border-blue-500/30';
      case 'reminder':
        return 'bg-yellow-500/10 border-yellow-500/30';
      case 'event':
        return 'bg-green-500/10 border-green-500/30';
      default:
        return 'bg-gray-500/10 border-gray-500/30';
    }
  };

  return (
    <div className="fixed bottom-4 right-4 z-50 space-y-2 max-w-sm">
      <AnimatePresence>
        {notifications.map((notification) => (
          <motion.div
            key={notification.id}
            initial={{ opacity: 0, y: 50, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9, y: 20 }}
            className="pointer-events-auto"
          >
            <GlassCard className={`p-4 shadow-lg ${getNotificationColor(notification.type)}`}>
              <div className="flex items-start space-x-3">
                <div className="flex-shrink-0">
                  {getNotificationIcon(notification.type)}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-primary">{notification.title}</p>
                  <p className="text-sm text-secondary mt-1">{notification.message}</p>
                  <div className="flex items-center space-x-1 mt-2 text-xs text-secondary">
                    <Clock className="w-3 h-3" />
                    <span>Just now</span>
                  </div>
                </div>
                <button
                  onClick={() => dismissNotification(notification.id)}
                  className="flex-shrink-0 text-secondary hover:text-primary"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </GlassCard>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
};

export default NotificationManager;