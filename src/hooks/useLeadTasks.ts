// ─────────────────────────────────────────────────────────────
// useLeadTasks – Tasks for a specific lead
// ─────────────────────────────────────────────────────────────
import { useEffect, useState, useCallback } from 'react';
import { useAuth } from './useAuth';
import type { Task, TaskStatus, TaskPriority } from '../types/crm';
import { taskService } from '../services/taskService';

interface UseLeadTasksResult {
  tasks: Task[];
  loading: boolean;
  error: Error | null;
  createTask: (data: {
    title: string;
    description?: string;
    assignedTo: string;
    priority: TaskPriority;
    dueDate?: Date | null;
  }) => Promise<string>;
  completeTask: (taskId: string) => Promise<void>;
  updateTaskStatus: (taskId: string, status: TaskStatus) => Promise<void>;
}

export function useLeadTasks(leadId?: string): UseLeadTasksResult {
  const { user } = useAuth();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    if (!leadId) {
      setTasks([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    const unsubscribe = taskService.subscribeLeadTasks(
      leadId,
      (docs) => {
        setTasks(docs as Task[]);
        setLoading(false);
        setError(null);
      },
      (err) => {
        setError(err);
        setLoading(false);
      }
    );

    return unsubscribe;
  }, [leadId]);

  const createTask = useCallback(
    async (data: {
      title: string;
      description?: string;
      assignedTo: string;
      priority: TaskPriority;
      dueDate?: Date | null;
    }): Promise<string> => {
      if (!leadId) throw new Error('Lead ID required');
      if (!user) throw new Error('Must be authenticated');
      return taskService.createTask({
        ...data,
        leadId,
        assignedBy: user.uid,
      });
    },
    [leadId, user]
  );

  const completeTask = useCallback(async (taskId: string) => {
    await taskService.completeTask(taskId);
  }, []);

  const updateTaskStatus = useCallback(async (taskId: string, status: TaskStatus) => {
    await taskService.updateTaskStatus(taskId, status);
  }, []);

  return { tasks, loading, error, createTask, completeTask, updateTaskStatus };
}
