import React, { useState, useEffect } from 'react';
import { Calendar, ChevronLeft, ChevronRight, Clock, CheckSquare } from 'lucide-react';
import { motion } from 'framer-motion';
import { useAuth } from '../contexts/AuthContext';
import { supabase, type Task, type CalendarEvent } from '../lib/supabase';
import GlassCard from './ui/GlassCard';
import Button from './ui/Button';
const VITE_AI_API_URL = import.meta.env.VITE_AI_API_URL;
const VITE_API_URL = import.meta.env.VITE_API_URL;
const VITE_MEDIA_API_URL = import.meta.env.VITE_MEDIA_API_URL;
const VITE_WORKSPACE_API_URL = import.meta.env.VITE_WORKSPACE_API_URL;
const VITE_APP_URL = import.meta.env.VITE_APP_URL;
const FRONTEND_URL = import.meta.env.VITE_FRONTEND_URL;

interface CalendarPanelProps {
  tasks: Task[];
}

const CalendarPanel: React.FC<CalendarPanelProps> = ({ tasks }) => {
  const { user } = useAuth();
  const [currentDate, setCurrentDate] = useState(new Date());
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [showDateModal, setShowDateModal] = useState(false);

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
    // Fix: Use local date comparison to avoid timezone issues
    const localDateString = date.getFullYear() + '-' + 
      String(date.getMonth() + 1).padStart(2, '0') + '-' + 
      String(date.getDate()).padStart(2, '0');
    
    return tasks.filter(task => {
      if (!task.due_date) return false;
      
      // Extract date part from due_date (YYYY-MM-DD)
      const taskDateString = task.due_date.split('T')[0];
      return taskDateString === localDateString;
    });
  };

  const getEventsForDate = (date: Date) => {
    // Fix: Use local date comparison to avoid timezone issues
    const localDateString = date.getFullYear() + '-' + 
      String(date.getMonth() + 1).padStart(2, '0') + '-' + 
      String(date.getDate()).padStart(2, '0');
    
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

  const getUpcomingTasks = () => {
    const today = new Date();
    const twoDaysFromNow = new Date(today);
    twoDaysFromNow.setDate(today.getDate() + 2);
    
    return tasks.filter(task => {
      if (!task.due_date || task.status === 'completed') return false;
      
      const dueDate = new Date(task.due_date);
      return dueDate >= today && dueDate <= twoDaysFromNow;
    }).sort((a, b) => new Date(a.due_date!).getTime() - new Date(b.due_date!).getTime());
  };

  const days = getDaysInMonth(currentDate);
  const weekDays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const upcomingTasks = getUpcomingTasks();

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
              return <div key={index} className="p-2" />;
            }

            const dayTasks = getTasksForDate(date);
            const dayEvents = getEventsForDate(date);
            const isCurrentDay = isToday(date);

            return (
              <motion.div
                key={date.toISOString()}
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
                      key={task.id}
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
                      key={event.id}
                      className="p-1 rounded text-xs bg-green-500/20 text-green-400 border border-green-500/30 truncate"
                      title={`Event: ${event.title}`}
                    >
                      <Clock className="w-3 h-3 inline mr-1" />
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

      {/* Upcoming Tasks Sidebar */}
      <div className="w-80 glass-panel border-l silver-border p-4">
        <h3 className="font-bold text-primary mb-4 flex items-center justify-between">
          <span>Upcoming Tasks (Next 2 Days)</span>
          <span className="text-sm text-secondary">{upcomingTasks.length} tasks</span>
        </h3>
        
        <div className="space-y-3">
          {upcomingTasks.map((task) => (
            <GlassCard key={task.id} className="p-3" hover>
              <div className="flex items-start space-x-3">
                <CheckSquare className="w-4 h-4 text-blue-500 mt-0.5 flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <h4 className="font-medium text-primary truncate">{task.title}</h4>
                  <p className="text-xs text-secondary">
                    Due: {formatDateForDisplay(task.due_date!)}
                  </p>
                </div>
              </div>
            </GlassCard>
          ))}

          {upcomingTasks.length === 0 && (
            <div className="text-center py-8">
              <CheckSquare className="w-8 h-8 text-secondary mx-auto mb-2 opacity-50" />
              <p className="text-secondary text-sm">No upcoming tasks in the next 2 days</p>
            </div>
          )}
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
              
              {/* Tasks for this date */}
              <div className="mb-6">
                <h4 className="font-medium text-primary mb-3 flex items-center">
                  <CheckSquare className="w-4 h-4 mr-2" />
                  Tasks
                </h4>
                <div className="space-y-2">
                  {getTasksForDate(selectedDate).length > 0 ? (
                    getTasksForDate(selectedDate).map(task => (
                      <GlassCard key={task.id} className="p-3" hover>
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
                  Events
                </h4>
                <div className="space-y-2">
                  {getEventsForDate(selectedDate).length > 0 ? (
                    getEventsForDate(selectedDate).map(event => (
                      <GlassCard key={event.id} className="p-3" hover>
                        <h5 className="font-medium text-primary">{event.title}</h5>
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
    </div>
  );
};

export default CalendarPanel;