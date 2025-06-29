import React from 'react';
import { useDroppable } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { type Task } from '../lib/supabase';
import KanbanTask from './KanbanTask';
import GlassCard from './ui/GlassCard';

interface KanbanColumnProps {
  id: string;
  title: string;
  icon: React.ElementType;
  color: string;
  tasks: Task[];
}

const KanbanColumn: React.FC<KanbanColumnProps> = ({ id, title, icon: Icon, color, tasks }) => {
  const { setNodeRef, isOver } = useDroppable({
    id,
  });
  
  return (
    <div 
      ref={setNodeRef}
      className={`flex-1 min-w-[280px] flex flex-col glass-panel rounded-lg ${
        isOver ? 'border-gold-border bg-gradient-gold-silver/5' : ''
      }`}
    >
      <div className="p-4 border-b silver-border">
        <div className="flex items-center space-x-2">
          <Icon className={`w-5 h-5 ${color}`} />
          <h3 className="font-bold text-primary">{title}</h3>
          <span className="text-secondary text-sm ml-auto">{tasks.length}</span>
        </div>
      </div>
      
      <div className="flex-1 p-3 overflow-y-auto space-y-3 min-h-[400px]">
        <SortableContext items={tasks.map(task => task.id)} strategy={verticalListSortingStrategy}>
          {tasks.map(task => (
            <KanbanTask key={task.id} task={task} />
          ))}
        </SortableContext>
        
        {tasks.length === 0 && (
          <div className="h-full flex items-center justify-center">
            <p className="text-secondary text-sm">No tasks</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default KanbanColumn;