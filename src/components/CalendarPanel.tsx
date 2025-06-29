import React, { useState, useEffect } from 'react';
import { Calendar, ChevronLeft, ChevronRight, Clock, CheckSquare, Plus, Bell, X, Info, AlertCircle } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import GlassCard from './ui/GlassCard';
import Button from './ui/Button';

interface CalendarPanelProps {
  tasks: Task[];
}

interface Task {
  id: string;
  title: string;
  description?: string;
  status: string;
  priority: string;
  due_date?: string;
  created_by: string;
  created_at: string;
}

interface CalendarEvent {
  id: string;
  title: string;
  description?: string;
  start_time: string;
  end_time: string;
  user_id: string;
  task_id?: string;
  created_at: string;
  is_reminder?: boolean;
}

const CalendarPanel: React.FC<CalendarPanelProps> = ({ tasks }) => {
  const { user } = useAuth();
  const [currentDate, setCurrentDate] = useState(new Date());
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [showDateModal, setShowDateModal] = useState(false);
  const [showAddEventModal, setShowAddEventModal] = useState(false);
  const [showAddReminderModal, setShowAddReminderModal] = useState(false);
  const [newEvent, setNewEvent] = useState({
    title: '',
    description: '',
    startTime: '',
    endTime: '',
  });
  const [newReminder, setNewReminder] = useState({
    title: '',
    description: '',
    startTime: '',
    endTime: '',
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadEvents();
  }, [user, currentDate]);

  const loadEvents = async () => {
    if (!user) return;

    try {
      const startOfMonth = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);
      const endOfMonth = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0);

      const { data, error } = await supabase
        .from('calendar_events')
        .select('*')
        .eq('user_id', user.id)
        .gte('start_time', startOfMonth.toISOString())
        .lte('start_time', endOfMonth.toISOString())
        .order('start_time');

      if (error) {
        console.error('Error loading events:', error);
        return;
      }

      setEvents(data || []);
    } catch (error) {
      console.error('Error loading events:', error);
    }
  };

  const getDaysInMonth = (date: Date) => {
    const year = date.getFullYear();
    const month = date.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const daysInMonth = lastDay.getDate();
    const startingDayOfWeek = firstDay.getDay();

    const days = [];
    
    // Add empty cells for days before the first day of the month
    for (let i = 0; i < startingDayOfWeek; i++) {
      days.push(null);
    }
    
    // Add all days of the month
    for (let day = 1; day <= daysInMonth; day++) {
      days.push(new Date(year, month, day));
    }
    
    return days;
  };

  const getTasksForDate = (date: Date) => {
    if (!date) return [];
    
    // Create a date string in YYYY-MM-DD format for comparison
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const localDateString = `${year}-${month}-${day}`;
    
    return tasks.filter(task => {
      if (!task.due_date) return false;
      
      // Extract date part from due_date (YYYY-MM-DD)
      const taskDateString = task.due_date.split('T')[0];
      return taskDateString === localDateString;
    });
  };

  const getEventsForDate = (date: Date) => {
    if (!date) return [];
    
    // Create a date string in YYYY-MM-DD format for comparison
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const localDateString = `${year}-${month}-${day}`;
    
    return events.filter(event => {
      // Extract date part from start_time (YYYY-MM-DD)
      const eventDateString = event.start_time.split('T')[0];
      return eventDateString === localDateString;
    });
  };

  const navigateMonth = (direction: 'prev' | 'next') => {
    setCurrentDate(prev => {
      const newDate = new Date(prev);
      if (direction === 'prev') {
        newDate.setMonth(prev.getMonth() - 1);
      } else {
        newDate.setMonth(prev.getMonth() + 1);
      }
      return newDate;
    });
  };

  const isToday = (date: Date) => {
    const today = new Date();
    return date.toDateString() === today.toDateString();
  };

  const formatMonthYear = (date: Date) => {
    return date.toLocaleDateString([], { month: 'long', year: 'numeric' });
  };

  const formatDateForDisplay = (dateString: string) => {
    // Parse the date string and format for display
    const date = new Date(dateString);
    return date.toLocaleDateString([], { 
      month: 'short', 
      day: 'numeric',
      year: 'numeric'
    });
  };

  const handleDateClick = (date: Date) => {
    setSelectedDate(date);
    setShowDateModal(true);
  };

  const handleAddEvent = () => {
    if (!selectedDate) return;
    
    // Set default times for the new event
    const defaultStartTime = new Date(selectedDate);
    defaultStartTime.setHours(9, 0, 0, 0);
    
    const defaultEndTime = new Date(selectedDate);
    defaultEndTime.setHours(10, 0, 0, 0);
    
    // Format the date part in YYYY-MM-DD format
    const year = selectedDate.getFullYear();
    const month = String(selectedDate.getMonth() + 1).padStart(2, '0');
    const day = String(selectedDate.getDate()).padStart(2, '0');
    const datePart = `${year}-${month}-${day}`;
    
    setNewEvent({
      title: '',
      description: '',
      startTime: `${datePart}T09:00`,
      endTime: `${datePart}T10:00`,
    });
    
    setShowAddEventModal(true);
  };

  const handleAddReminder = () => {
    if (!selectedDate) return;
    
    // Format the date part in YYYY-MM-DD format
    const year = selectedDate.getFullYear();
    const month = String(selectedDate.getMonth() + 1).padStart(2, '0');
    const day = String(selectedDate.getDate()).padStart(2, '0');
    const datePart = `${year}-${month}-${day}`;
    
    setNewReminder({
      title: '',
      description: '',
      startTime: `${datePart}T09:00`,
      endTime: `${datePart}T09:30`,
    });
    
    setShowAddReminderModal(true);
  };

  const handleCreateEvent = async () => {
    if (!user || !newEvent.title || !selectedDate) {
      setError('Please fill in all required fields');
      return;
    }
    
    setLoading(true);
    setError(null);
    
    try {
      // Format the date part in YYYY-MM-DD format
      const year = selectedDate.getFullYear();
      const month = String(selectedDate.getMonth() + 1).padStart(2, '0');
      const day = String(selectedDate.getDate()).padStart(2, '0');
      const datePart = `${year}-${month}-${day}`;
      
      // Get time parts from inputs
      const startTimePart = newEvent.startTime.split('T')[1] || '09:00';
      const endTimePart = newEvent.endTime.split('T')[1] || '10:00';
      
      // Combine date and time
      const startTimeIso = `${datePart}T${startTimePart}:00`;
      const endTimeIso = `${datePart}T${endTimePart}:00`;
      
      const { data, error } = await supabase
        .from('calendar_events')
        .insert({
          title: newEvent.title,
          description: newEvent.description || null,
          start_time: startTimeIso,
          end_time: endTimeIso,
          user_id: user.id,
          is_reminder: false
        })
        .select()
        .single();
      
      if (error) {
        throw error;
      }
      
      // Reload events
      await loadEvents();
      
      // Close modals
      setShowAddEventModal(false);
      
      // Reset form
      setNewEvent({
        title: '',
        description: '',
        startTime: '',
        endTime: '',
      });
    } catch (error: any) {
      console.error('Error creating event:', error);
      setError(error.message || 'Failed to create event');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateReminder = async () => {
    if (!user || !newReminder.title || !selectedDate) {
      setError('Please fill in all required fields');
      return;
    }
    
    setLoading(true);
    setError(null);
    
    try {
      // Format the date part in YYYY-MM-DD format
      const year = selectedDate.getFullYear();
      const month = String(selectedDate.getMonth() + 1).padStart(2, '0');
      const day = String(selectedDate.getDate()).padStart(2, '0');
      const datePart = `${year}-${month}-${day}`;
      
      // Get time parts from inputs
      const startTimePart = newReminder.startTime.split('T')[1] || '09:00';
      const endTimePart = newReminder.endTime.split('T')[1] || '09:30';
      
      // Combine date and time
      const startTimeIso = `${datePart}T${startTimePart}:00`;
      const endTimeIso = `${datePart}T${endTimePart}:00`;
      
      const { data, error } = await supabase
        .from('calendar_events')
        .insert({
          title: newReminder.title,
          description: newReminder.description || null,
          start_time: startTimeIso,
          end_time: endTimeIso,
          user_id: user.id,
          is_reminder: true
        })
        .select()
        .single();
      
      if (error) {
        throw error;
      }
      
      // Reload events
      await loadEvents();
      
      // Close modals
      setShowAddReminderModal(false);
      
      // Reset form
      setNewReminder({
        title: '',
        description: '',
        startTime: '',
        endTime: '',
      });
    } catch (error: any) {
      console.error('Error creating reminder:', error);
      setError(error.message || 'Failed to create reminder');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteEvent = async (eventId: string) => {
    if (!confirm('Are you sure you want to delete this event?')) return;
    
    try {
      const { error } = await supabase
        .from('calendar_events')
        .delete()
        .eq('id', eventId);
      
      if (error) {
        throw error;
      }
      
      // Reload events
      await loadEvents();
    } catch (error: any) {
      console.error('Error deleting event:', error);
      alert('Failed to delete event: ' + error.message);
    }
  };

  const days = getDaysInMonth(currentDate);
  const weekDays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  return (
    <div className="flex-1 flex flex-col h-full">
      {/* Header - Fixed */}
      <div className="glass-panel border-b silver-border p-4 flex-shrink-0">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-bold gradient-gold-silver">Calendar</h2>
          
          <div className="flex items-center space-x-4">
            {/* Navigation */}
            <div className="flex items-center space-x-2">
              <Button
                onClick={() => navigateMonth('prev')}
                variant="ghost"
                size="sm"
                className="p-2"
              >
                <ChevronLeft className="w-4 h-4" />
              </Button>
              
              <h3 className="text-lg font-semibold text-primary min-w-[200px] text-center">
                {formatMonthYear(currentDate)}
              </h3>
              
              <Button
                onClick={() => navigateMonth('next')}
                variant="ghost"
                size="sm"
                className="p-2"
              >
                <ChevronRight className="w-4 h-4" />
              </Button>
            </div>

            <Button
              onClick={() => setCurrentDate(new Date())}
              variant="secondary"
              size="sm"
            >
              Today
            </Button>
          </div>
        </div>
      </div>

      {/* Calendar Grid */}
      <div className="flex-1 overflow-y-auto p-4">
        <div className="grid grid-cols-7 gap-1 h-full">
          {/* Week day headers */}
          {weekDays.map((day) => (
            <div
              key={day}
              className="p-3 text-center text-sm font-semibold text-secondary border-b silver-border"
            >
              {day}
            </div>
          ))}

          {/* Calendar days */}
          {days.map((date, index) => {
            if (!date) {
              return <div key={`empty-${index}`} className="p-2" />;
            }

            const dayTasks = getTasksForDate(date);
            const dayEvents = getEventsForDate(date);
            const isCurrentDay = isToday(date);

            return (
              <motion.div
                key={`day-${date.getTime()}`}
                className={`p-2 min-h-[120px] glass-panel rounded-lg border transition-all hover:border-gold-border cursor-pointer ${
                  isCurrentDay ? 'border-gold-border bg-gradient-gold-silver/10' : ''
                }`}
                whileHover={{ scale: 1.02 }}
                onClick={() => handleDateClick(date)}
              >
                <div className={`text-sm font-semibold mb-2 ${
                  isCurrentDay ? 'text-primary' : 'text-secondary'
                }`}>
                  {date.getDate()}
                </div>

                <div className="space-y-1">
                  {/* Tasks */}
                  {dayTasks.slice(0, 2).map((task) => (
                    <div
                      key={`task-${task.id}`}
                      className="p-1 rounded text-xs bg-blue-500/20 text-blue-400 border border-blue-500/30 truncate"
                      title={`Task: ${task.title} (Due: ${formatDateForDisplay(task.due_date!)})`}
                    >
                      <CheckSquare className="w-3 h-3 inline mr-1" />
                      {task.title}
                    </div>
                  ))}

                  {/* Events */}
                  {dayEvents.slice(0, 2).map((event) => (
                    <div
                      key={`event-${event.id}`}
                      className={`p-1 rounded text-xs ${
                        event.is_reminder 
                          ? 'bg-yellow-500/20 text-yellow-400 border border-yellow-500/30' 
                          : 'bg-green-500/20 text-green-400 border border-green-500/30'
                      } truncate`}
                      title={`${event.is_reminder ? 'Reminder' : 'Event'}: ${event.title}`}
                    >
                      {event.is_reminder ? (
                        <Bell className="w-3 h-3 inline mr-1" />
                      ) : (
                        <Clock className="w-3 h-3 inline mr-1" />
                      )}
                      {event.title}
                    </div>
                  ))}

                  {/* Show more indicator */}
                  {(dayTasks.length + dayEvents.length) > 2 && (
                    <div className="text-xs text-secondary">
                      +{(dayTasks.length + dayEvents.length) - 2} more
                    </div>
                  )}
                </div>
              </motion.div>
            );
          })}
        </div>
      </div>

      {/* Date Detail Modal */}
      {showDateModal && selectedDate && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.9, opacity: 0 }}
            className="w-full max-w-md"
          >
            <GlassCard className="p-6" goldBorder>
              <div className="flex justify-between items-center mb-6">
                <h3 className="text-xl font-bold gradient-gold-silver">
                  {selectedDate.toLocaleDateString([], { 
                    weekday: 'long', 
                    month: 'long', 
                    day: 'numeric',
                    year: 'numeric'
                  })}
                </h3>
                <button
                  onClick={() => setShowDateModal(false)}
                  className="text-secondary hover:text-primary"
                >
                  ×
                </button>
              </div>
              
              <div className="flex justify-end mb-4 space-x-2">
                <Button
                  onClick={handleAddEvent}
                  variant="secondary"
                  size="sm"
                  className="flex items-center space-x-2"
                >
                  <Calendar className="w-4 h-4" />
                  <span>Add Event</span>
                </Button>
                
                <Button
                  onClick={handleAddReminder}
                  variant="secondary"
                  size="sm"
                  className="flex items-center space-x-2"
                >
                  <Bell className="w-4 h-4" />
                  <span>Add Reminder</span>
                </Button>
              </div>
              
              {/* Tasks for this date */}
              <div className="mb-6">
                <h4 className="font-medium text-primary mb-3 flex items-center">
                  <CheckSquare className="w-4 h-4 mr-2" />
                  Tasks
                </h4>
                <div className="space-y-2">
                  {getTasksForDate(selectedDate).length > 0 ? (
                    getTasksForDate(selectedDate).map(task => (
                      <GlassCard key={`task-detail-${task.id}`} className="p-3" hover>
                        <div className="flex items-start space-x-3">
                          <div className={`w-4 h-4 rounded-full mt-0.5 flex-shrink-0 ${
                            task.status === 'completed' ? 'bg-green-500' : 'bg-blue-500'
                          }`} />
                          <div className="flex-1">
                            <h5 className={`font-medium ${
                              task.status === 'completed' ? 'text-secondary line-through' : 'text-primary'
                            }`}>
                              {task.title}
                            </h5>
                            {task.description && (
                              <p className="text-xs text-secondary mt-1">{task.description}</p>
                            )}
                            <div className="flex items-center space-x-2 mt-1 text-xs text-secondary">
                              <span className="capitalize">{task.priority} priority</span>
                              <span className="capitalize">{task.status.replace('_', ' ')}</span>
                            </div>
                          </div>
                        </div>
                      </GlassCard>
                    ))
                  ) : (
                    <p className="text-secondary text-sm">No tasks due on this date</p>
                  )}
                </div>
              </div>
              
              {/* Events for this date */}
              <div>
                <h4 className="font-medium text-primary mb-3 flex items-center">
                  <Clock className="w-4 h-4 mr-2" />
                  Events & Reminders
                </h4>
                <div className="space-y-2">
                  {getEventsForDate(selectedDate).length > 0 ? (
                    getEventsForDate(selectedDate).map(event => (
                      <GlassCard key={`event-detail-${event.id}`} className="p-3 group" hover>
                        <div className="flex items-start justify-between">
                          <div className="flex items-start space-x-3">
                            <div className={`w-4 h-4 rounded-full mt-0.5 flex-shrink-0 ${
                              event.is_reminder ? 'bg-yellow-500' : 'bg-green-500'
                            }`} />
                            <div className="flex-1">
                              <h5 className="font-medium text-primary flex items-center">
                                {event.title}
                                {event.is_reminder && (
                                  <span className="ml-2 text-xs bg-yellow-500/20 text-yellow-500 px-2 py-0.5 rounded-full">
                                    Reminder
                                  </span>
                                )}
                              </h5>
                              {event.description && (
                                <p className="text-xs text-secondary mt-1">{event.description}</p>
                              )}
                              <div className="flex items-center space-x-2 mt-1 text-xs text-secondary">
                                <span>
                                  {new Date(event.start_time).toLocaleTimeString([], { 
                                    hour: '2-digit', 
                                    minute: '2-digit' 
                                  })} - {new Date(event.end_time).toLocaleTimeString([], { 
                                    hour: '2-digit', 
                                    minute: '2-digit' 
                                  })}
                                </span>
                              </div>
                            </div>
                          </div>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDeleteEvent(event.id);
                            }}
                            className="opacity-0 group-hover:opacity-100 transition-opacity text-red-400 hover:text-red-500"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </div>
                      </GlassCard>
                    ))
                  ) : (
                    <p className="text-secondary text-sm">No events scheduled for this date</p>
                  )}
                </div>
              </div>
              
              <div className="flex justify-end mt-6">
                <Button
                  onClick={() => setShowDateModal(false)}
                  variant="secondary"
                >
                  Close
                </Button>
              </div>
            </GlassCard>
          </motion.div>
        </div>
      )}

      {/* Add Event Modal */}
      {showAddEventModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.9, opacity: 0 }}
            className="w-full max-w-md"
          >
            <GlassCard className="p-6" goldBorder>
              <div className="flex justify-between items-center mb-6">
                <h3 className="text-xl font-bold gradient-gold-silver flex items-center">
                  <Calendar className="w-5 h-5 mr-2" />
                  Add Event
                </h3>
                <button
                  onClick={() => setShowAddEventModal(false)}
                  className="text-secondary hover:text-primary"
                >
                  ×
                </button>
              </div>
              
              {error && (
                <div className="mb-4 p-3 glass-panel rounded-lg bg-red-500/10 border-red-500/30">
                  <p className="text-red-400 text-sm flex items-center">
                    <AlertCircle className="w-4 h-4 mr-2" />
                    {error}
                  </p>
                </div>
              )}
              
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-primary mb-2">
                    Event Title <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={newEvent.title}
                    onChange={(e) => setNewEvent({...newEvent, title: e.target.value})}
                    className="w-full glass-panel rounded-lg px-4 py-3 text-primary placeholder-secondary focus:outline-none focus:ring-2 focus:ring-yellow-500"
                    placeholder="Enter event title"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-primary mb-2">
                    Description
                  </label>
                  <textarea
                    value={newEvent.description}
                    onChange={(e) => setNewEvent({...newEvent, description: e.target.value})}
                    className="w-full glass-panel rounded-lg px-4 py-3 text-primary placeholder-secondary focus:outline-none focus:ring-2 focus:ring-yellow-500 resize-none"
                    placeholder="Enter event description"
                    rows={3}
                  />
                </div>
                
                <div className="flex items-center space-x-4">
                  <div className="flex-1">
                    <label className="block text-sm font-medium text-primary mb-2">
                      Start Time <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="time"
                      value={newEvent.startTime.split('T')[1] || '09:00'}
                      onChange={(e) => {
                        if (selectedDate) {
                          // Format the date part in YYYY-MM-DD format
                          const year = selectedDate.getFullYear();
                          const month = String(selectedDate.getMonth() + 1).padStart(2, '0');
                          const day = String(selectedDate.getDate()).padStart(2, '0');
                          const datePart = `${year}-${month}-${day}`;
                          
                          setNewEvent({...newEvent, startTime: `${datePart}T${e.target.value}`});
                        }
                      }}
                      className="w-full glass-panel rounded-lg px-4 py-3 text-primary focus:outline-none focus:ring-2 focus:ring-yellow-500"
                    />
                  </div>
                  
                  <div className="flex-1">
                    <label className="block text-sm font-medium text-primary mb-2">
                      End Time <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="time"
                      value={newEvent.endTime.split('T')[1] || '10:00'}
                      onChange={(e) => {
                        if (selectedDate) {
                          // Format the date part in YYYY-MM-DD format
                          const year = selectedDate.getFullYear();
                          const month = String(selectedDate.getMonth() + 1).padStart(2, '0');
                          const day = String(selectedDate.getDate()).padStart(2, '0');
                          const datePart = `${year}-${month}-${day}`;
                          
                          setNewEvent({...newEvent, endTime: `${datePart}T${e.target.value}`});
                        }
                      }}
                      className="w-full glass-panel rounded-lg px-4 py-3 text-primary focus:outline-none focus:ring-2 focus:ring-yellow-500"
                    />
                  </div>
                </div>
              </div>
              
              <div className="flex justify-end space-x-3 mt-6">
                <Button
                  onClick={() => setShowAddEventModal(false)}
                  variant="secondary"
                  disabled={loading}
                >
                  Cancel
                </Button>
                <Button
                  onClick={handleCreateEvent}
                  variant="premium"
                  disabled={loading || !newEvent.title}
                >
                  {loading ? (
                    <div className="flex items-center space-x-2">
                      <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      <span>Creating...</span>
                    </div>
                  ) : (
                    'Create Event'
                  )}
                </Button>
              </div>
            </GlassCard>
          </motion.div>
        </div>
      )}

      {/* Add Reminder Modal */}
      {showAddReminderModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.9, opacity: 0 }}
            className="w-full max-w-md"
          >
            <GlassCard className="p-6" goldBorder>
              <div className="flex justify-between items-center mb-6">
                <h3 className="text-xl font-bold gradient-gold-silver flex items-center">
                  <Bell className="w-5 h-5 mr-2" />
                  Add Reminder
                </h3>
                <button
                  onClick={() => setShowAddReminderModal(false)}
                  className="text-secondary hover:text-primary"
                >
                  ×
                </button>
              </div>
              
              {error && (
                <div className="mb-4 p-3 glass-panel rounded-lg bg-red-500/10 border-red-500/30">
                  <p className="text-red-400 text-sm flex items-center">
                    <AlertCircle className="w-4 h-4 mr-2" />
                    {error}
                  </p>
                </div>
              )}
              
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-primary mb-2">
                    Reminder Title <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={newReminder.title}
                    onChange={(e) => setNewReminder({...newReminder, title: e.target.value})}
                    className="w-full glass-panel rounded-lg px-4 py-3 text-primary placeholder-secondary focus:outline-none focus:ring-2 focus:ring-yellow-500"
                    placeholder="Enter reminder title"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-primary mb-2">
                    Description
                  </label>
                  <textarea
                    value={newReminder.description}
                    onChange={(e) => setNewReminder({...newReminder, description: e.target.value})}
                    className="w-full glass-panel rounded-lg px-4 py-3 text-primary placeholder-secondary focus:outline-none focus:ring-2 focus:ring-yellow-500 resize-none"
                    placeholder="Enter reminder description"
                    rows={3}
                  />
                </div>
                
                <div className="flex items-center space-x-4">
                  <div className="flex-1">
                    <label className="block text-sm font-medium text-primary mb-2">
                      Reminder Time <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="time"
                      value={newReminder.startTime.split('T')[1] || '09:00'}
                      onChange={(e) => {
                        if (selectedDate) {
                          // Format the date part in YYYY-MM-DD format
                          const year = selectedDate.getFullYear();
                          const month = String(selectedDate.getMonth() + 1).padStart(2, '0');
                          const day = String(selectedDate.getDate()).padStart(2, '0');
                          const datePart = `${year}-${month}-${day}`;
                          
                          const newStartTime = `${datePart}T${e.target.value}`;
                          
                          // Also update end time to be 30 minutes after start time
                          const [hours, minutes] = e.target.value.split(':').map(Number);
                          let newMinutes = minutes + 30;
                          let newHours = hours;
                          
                          if (newMinutes >= 60) {
                            newMinutes -= 60;
                            newHours = (newHours + 1) % 24;
                          }
                          
                          const endTimePart = `${String(newHours).padStart(2, '0')}:${String(newMinutes).padStart(2, '0')}`;
                          const newEndTime = `${datePart}T${endTimePart}`;
                          
                          setNewReminder({
                            ...newReminder, 
                            startTime: newStartTime,
                            endTime: newEndTime
                          });
                        }
                      }}
                      className="w-full glass-panel rounded-lg px-4 py-3 text-primary focus:outline-none focus:ring-2 focus:ring-yellow-500"
                    />
                  </div>
                </div>
              </div>
              
              <div className="flex justify-end space-x-3 mt-6">
                <Button
                  onClick={() => setShowAddReminderModal(false)}
                  variant="secondary"
                  disabled={loading}
                >
                  Cancel
                </Button>
                <Button
                  onClick={handleCreateReminder}
                  variant="premium"
                  disabled={loading || !newReminder.title}
                >
                  {loading ? (
                    <div className="flex items-center space-x-2">
                      <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      <span>Creating...</span>
                    </div>
                  ) : (
                    'Create Reminder'
                  )}
                </Button>
              </div>
            </GlassCard>
          </motion.div>
        </div>
      )}
    </div>
  );
};

export default CalendarPanel;