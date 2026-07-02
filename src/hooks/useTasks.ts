// ─────────────────────────────────────────────────────────────
// useTasks – Real-time tasks hook with filtering & mutations
// ─────────────────────────────────────────────────────────────
import { useEffect, useState, useCallback } from 'react';
import { useAuth } from './useAuth';
import type { Task, TaskStatus, TaskPriority } from '../types/crm';
import { taskService } from '../services/taskService';

interface TaskFilters {
  status?: TaskStatus;
  priority?: TaskPriority;
  assignedTo?: string;
  leadId?: string;
}

interface UseTasksResult {
  tasks: Task[];
  loading: boolean;
  error: Error | null;
  createTask: (data: {
    title: string;
    description?: string;
    leadId?: string;
    assignedTo: string;
    priority: TaskPriority;
    dueDate?: Date | null;
  }) => Promise<string>;
  updateTask: (taskId: string, data: Partial<Task>) => Promise<void>;
  completeTask: (taskId: string) => Promise<void>;
  updateTaskStatus: (taskId: string, status: TaskStatus) => Promise<void>;
}

export function useTasks(filters?: TaskFilters): UseTasksResult {
  const { user } = useAuth();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    setLoading(true);

    const unsubscribe = taskService.subscribeTasks(
      (docs) => {
        setTasks(docs as Task[]);
        setLoading(false);
        setError(null);
      },
      (err) => {
        setError(err);
        setLoading(false);
      },
      filters
    );

    return unsubscribe;
  }, [filters?.status, filters?.priority, filters?.assignedTo, filters?.leadId]);

  const createTask = useCallback(
    async (data: {
      title: string;
      description?: string;
      leadId?: string;
      assignedTo: string;
      priority: TaskPriority;
      dueDate?: Date | null;
    }): Promise<string> => {
      if (!user) throw new Error('Must be authenticated');
      return taskService.createTask({
        ...data,
        assignedBy: user.uid,
      });
    },
    [user]
  );

  const updateTask = useCallback(
    async (taskId: string, data: Partial<Task>) => {
      await taskService.safeUpdate(taskId, data);
    },
    []
  );

  const completeTask = useCallback(
    async (taskId: string) => {
      await taskService.completeTask(taskId);
    },
    []
  );

  const updateTaskStatus = useCallback(
    async (taskId: string, status: TaskStatus) => {
      await taskService.updateTaskStatus(taskId, status);
    },
    []
  );

  return { tasks, loading, error, createTask, updateTask, completeTask, updateTaskStatus };
}
