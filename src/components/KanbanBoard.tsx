import React, { useState, useEffect } from 'react';
import { DndContext, DragEndEvent, DragOverlay, DragStartEvent, PointerSensor, useSensor, useSensors } from '@dnd-kit/core';
import { SortableContext, arrayMove, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { CheckSquare, Clock, AlertTriangle, Loader2 } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { supabase, type Task } from '../lib/supabase';
import KanbanColumn from './KanbanColumn';
import KanbanTask from './KanbanTask';
import GlassCard from './ui/GlassCard';
import Button from './ui/Button';

interface KanbanBoardProps {
  tasks: Task[];
  onTaskUpdate: () => void;
}

type KanbanStatus = 'backlog' | 'todo' | 'in_progress' | 'completed';

interface KanbanColumn {
  id: KanbanStatus;
  title: string;
  icon: React.ElementType;
  color: string;
}

const KanbanBoard: React.FC<KanbanBoardProps> = ({ tasks, onTaskUpdate }) => {
  const { user } = useAuth();
  const [columns, setColumns] = useState<KanbanColumn[]>([
    { id: 'backlog', title: 'Backlog', icon: AlertTriangle, color: 'text-red-500' },
    { id: 'todo', title: 'To Do', icon: CheckSquare, color: 'text-blue-500' },
    { id: 'in_progress', title: 'In Progress', icon: Clock, color: 'text-yellow-500' },
    { id: 'completed', title: 'Done', icon: CheckSquare, color: 'text-green-500' }
  ]);
  
  const [tasksByColumn, setTasksByColumn] = useState<Record<KanbanStatus, Task[]>>({
    backlog: [],
    todo: [],
    in_progress: [],
    completed: []
  });
  
  const [activeTask, setActiveTask] = useState<Task | null>(null);
  const [isUpdating, setIsUpdating] = useState(false);
  
  // Configure DnD sensors
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    })
  );

  // Organize tasks into columns
  useEffect(() => {
    const now = new Date();
    
    const backlogTasks = tasks.filter(task => {
      if (task.status === 'completed' || task.status === 'cancelled') return false;
      if (!task.due_date) return false;
      const dueDate = new Date(task.due_date);
      return dueDate < now;
    });
    
    const todoTasks = tasks.filter(task => 
      task.status === 'todo' && (!task.due_date || new Date(task.due_date) >= now)
    );
    
    const inProgressTasks = tasks.filter(task => 
      task.status === 'in_progress'
    );
    
    const completedTasks = tasks.filter(task => 
      task.status === 'completed'
    );
    
    setTasksByColumn({
      backlog: backlogTasks,
      todo: todoTasks,
      in_progress: inProgressTasks,
      completed: completedTasks
    });
  }, [tasks]);

  const handleDragStart = (event: DragStartEvent) => {
    const { active } = event;
    const taskId = active.id as string;
    
    // Find the task that is being dragged
    const draggedTask = tasks.find(task => task.id === taskId);
    if (draggedTask) {
      setActiveTask(draggedTask);
    }
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    
    if (!over) return;
    
    const taskId = active.id as string;
    const targetColumnId = over.id as KanbanStatus;
    
    // Find the task that was dragged
    const draggedTask = tasks.find(task => task.id === taskId);
    if (!draggedTask) return;
    
    // Map column IDs to task statuses
    const columnToStatus: Record<KanbanStatus, Task['status']> = {
      backlog: 'todo', // We keep backlog items as 'todo' in the database
      todo: 'todo',
      in_progress: 'in_progress',
      completed: 'completed'
    };
    
    // If the task is already in the target column, do nothing
    if (draggedTask.status === columnToStatus[targetColumnId]) return;
    
    // Update the task status in the database
    setIsUpdating(true);
    try {
      const { error } = await supabase
        .from('tasks')
        .update({ 
          status: columnToStatus[targetColumnId],
          updated_at: new Date().toISOString()
        })
        .eq('id', taskId);
      
      if (error) {
        console.error('Error updating task status:', error);
        return;
      }
      
      // Refresh tasks
      onTaskUpdate();
    } catch (error) {
      console.error('Error updating task status:', error);
    } finally {
      setIsUpdating(false);
      setActiveTask(null);
    }
  };

  const getColumnTasks = (columnId: KanbanStatus) => {
    return tasksByColumn[columnId] || [];
  };

  return (
    <div className="flex-1 flex flex-col h-full">
      {/* Header */}
      <div className="glass-panel border-b silver-border p-4 flex-shrink-0">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-bold gradient-gold-silver">Kanban Board</h2>
          <Button
            onClick={onTaskUpdate}
            variant="secondary"
            size="sm"
            className="flex items-center space-x-2"
          >
            <span>Refresh</span>
          </Button>
        </div>
      </div>

      {/* Kanban Board */}
      <div className="flex-1 overflow-x-auto p-4">
        <DndContext 
          sensors={sensors}
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
        >
          <div className="flex space-x-4 min-h-[500px]">
            {columns.map(column => (
              <KanbanColumn
                key={column.id}
                id={column.id}
                title={column.title}
                icon={column.icon}
                color={column.color}
                tasks={getColumnTasks(column.id)}
              />
            ))}
          </div>
          
          <DragOverlay>
            {activeTask ? <KanbanTask task={activeTask} /> : null}
          </DragOverlay>
        </DndContext>
      </div>
      
      {/* Loading Overlay */}
      {isUpdating && (
        <div className="fixed inset-0 bg-black/20 backdrop-blur-sm flex items-center justify-center z-50">
          <GlassCard className="p-4">
            <div className="flex items-center space-x-3">
              <Loader2 className="w-5 h-5 animate-spin text-secondary" />
              <span className="text-primary">Updating task...</span>
            </div>
          </GlassCard>
        </div>
      )}
    </div>
  );
};

export default KanbanBoard;