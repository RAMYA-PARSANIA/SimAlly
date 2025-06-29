import React from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Calendar, CheckSquare, Clock, User } from 'lucide-react';
import { type Task } from '../lib/supabase';
import GlassCard from './ui/GlassCard';

interface KanbanTaskProps {
  task: Task;
}

const KanbanTask: React.FC<KanbanTaskProps> = ({ task }) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging
  } = useSortable({
    id: task.id,
  });
  
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    zIndex: isDragging ? 10 : 1,
  };
  
  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'urgent': return 'text-red-500 bg-red-500/10 border-red-500/30';
      case 'high': return 'text-orange-500 bg-orange-500/10 border-orange-500/30';
      case 'medium': return 'text-yellow-500 bg-yellow-500/10 border-yellow-500/30';
      case 'low': return 'text-green-500 bg-green-500/10 border-green-500/30';
      default: return 'text-gray-500 bg-gray-500/10 border-gray-500/30';
    }
  };
  
  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString([], {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  };
  
  const isOverdue = (dateString?: string) => {
    if (!dateString) return false;
    const dueDate = new Date(dateString);
    const now = new Date();
    return dueDate < now && task.status !== 'completed';
  };
  
  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      className="touch-manipulation"
    >
      <GlassCard 
        className={`p-3 cursor-grab active:cursor-grabbing ${
          isOverdue(task.due_date) ? 'border-red-500/50' : ''
        }`}
        hover
      >
        <div className="flex items-start space-x-2">
          <div className={`w-4 h-4 rounded-full mt-0.5 flex-shrink-0 ${
            task.status === 'completed' ? 'bg-green-500' : 'bg-blue-500'
          }`} />
          <div className="flex-1 min-w-0">
            <h3 className={`font-medium text-sm ${
              task.status === 'completed' ? 'text-secondary line-through' : 'text-primary'
            } truncate`}>
              {task.title}
            </h3>
            
            {task.description && (
              <p className="text-xs text-secondary mt-1 line-clamp-2">{task.description}</p>
            )}
            
            <div className="flex flex-wrap items-center gap-2 mt-2">
              <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${getPriorityColor(task.priority)}`}>
                {task.priority}
              </span>
              
              {task.due_date && (
                <span className={`flex items-center text-xs ${
                  isOverdue(task.due_date) ? 'text-red-500' : 'text-secondary'
                }`}>
                  <Calendar className="w-3 h-3 mr-1" />
                  {formatDate(task.due_date)}
                </span>
              )}
              
              {task.assignments && task.assignments.length > 0 && (
                <span className="flex items-center text-xs text-secondary">
                  <User className="w-3 h-3 mr-1" />
                  {task.assignments.length}
                </span>
              )}
            </div>
          </div>
        </div>
      </GlassCard>
    </div>
  );
};

export default KanbanTask;