import { Task, DailyPlanTask, db } from '../db/database';
import { scoreTask } from './taskRecommender';
import { isTaskEligibleForDate } from './taskEligibility';

interface DailyPlanResult {
  plannedTasks: DailyPlanTask[];
  totalMinutes: number;
  message: string;
}

/**
 * Generates a daily plan by selecting and scheduling tasks for today
 * based on priority, deadline, energy requirements, and available time
 * ONLY schedules tasks that are eligible for today based on recurrence rules
 */
export const generateDailyPlan = async (): Promise<DailyPlanResult> => {
  const today = new Date();
  const todayDateString = today.toISOString().split('T')[0]; // YYYY-MM-DD

  // Get user preferences
  const prefs = await db.userPrefs.get(1);
  if (!prefs) {
    throw new Error('User preferences not found');
  }

  const { dailyPlanStartTime, dailyPlanEndTime, maxWorkBlocksPerDay } = prefs;

  // Calculate available minutes for the day
  const [startHour, startMin] = dailyPlanStartTime.split(':').map(Number);
  const [endHour, endMin] = dailyPlanEndTime.split(':').map(Number);
  const totalAvailableMinutes = (endHour * 60 + endMin) - (startHour * 60 + startMin);

  // Clear existing plan for today
  await db.dailyPlanTasks
    .where('planDate')
    .equals(todayDateString)
    .delete();

  // Get all tasks with status 'todo'
  const allTodoTasks = await db.tasks
    .where('status')
    .equals('todo')
    .toArray();

  // Filter to ONLY tasks eligible for TODAY
  const eligibleTasks = allTodoTasks.filter(task =>
    isTaskEligibleForDate(task, today)
  );

  if (eligibleTasks.length === 0) {
    return {
      plannedTasks: [],
      totalMinutes: 0,
      message: 'No tasks available to plan. Add some tasks first!'
    };
  }

  // Score and sort tasks by multiple criteria
  const scoredTasks = eligibleTasks.map(task => {
    // Calculate urgency score
    let urgencyScore = 0;
    if (task.deadline) {
      const daysUntilDeadline = (new Date(task.deadline).getTime() - today.getTime()) / (1000 * 60 * 60 * 24);
      if (daysUntilDeadline < 1) urgencyScore = 10;
      else if (daysUntilDeadline < 3) urgencyScore = 8;
      else if (daysUntilDeadline < 7) urgencyScore = 6;
      else urgencyScore = 3;
    }

    // Calculate priority score
    const priorityScore = task.priority === 'High' ? 10 : task.priority === 'Medium' ? 6 : 3;

    // Dread penalty
    const dreadPenalty = task.dread * 1;

    // Combined score (higher is better)
    const totalScore = urgencyScore + priorityScore - dreadPenalty;

    return { task, totalScore };
  });

  // Sort by score (highest first)
  scoredTasks.sort((a, b) => b.totalScore - a.totalScore);

  // Select tasks to fill the day
  const selectedTasks: Task[] = [];
  let accumulatedMinutes = 0;
  let workBlockCount = 0;

  for (const { task } of scoredTasks) {
    // Check if adding this task would exceed time limit
    if (accumulatedMinutes + task.estimateMins > totalAvailableMinutes) {
      continue; // Skip this task, it doesn't fit
    }

    // Check work block limits
    if (task.domain === 'Work') {
      if (workBlockCount >= maxWorkBlocksPerDay) {
        continue; // Skip, hit work block limit
      }
      workBlockCount++;
    }

    selectedTasks.push(task);
    accumulatedMinutes += task.estimateMins;

    // Stop if we've filled most of the day (leave some buffer)
    if (accumulatedMinutes >= totalAvailableMinutes * 0.8) {
      break;
    }
  }

  // Create scheduled time slots for selected tasks
  const plannedTasks: DailyPlanTask[] = [];
  let currentTime = new Date(today);
  currentTime.setHours(startHour, startMin, 0, 0);

  // Group tasks by domain for better organization
  const tasksByDomain = selectedTasks.reduce((acc, task) => {
    if (!acc[task.domain]) acc[task.domain] = [];
    acc[task.domain].push(task);
    return acc;
  }, {} as Record<string, Task[]>);

  // Interleave domains to avoid monotony
  const orderedTasks: Task[] = [];
  const domains = Object.keys(tasksByDomain);
  let domainIndex = 0;

  while (orderedTasks.length < selectedTasks.length) {
    const domain = domains[domainIndex % domains.length];
    if (tasksByDomain[domain] && tasksByDomain[domain].length > 0) {
      orderedTasks.push(tasksByDomain[domain].shift()!);
    }
    domainIndex++;
  }

  // Schedule tasks with time slots
  for (let i = 0; i < orderedTasks.length; i++) {
    const task = orderedTasks[i];
    const startTime = new Date(currentTime);
    const endTime = new Date(currentTime.getTime() + task.estimateMins * 60 * 1000);

    const plannedTask: DailyPlanTask = {
      id: crypto.randomUUID(),
      taskId: task.id!,
      planDate: todayDateString,
      scheduledStartTime: startTime.toISOString(),
      scheduledEndTime: endTime.toISOString(),
      completed: false,
      order: i
    };

    plannedTasks.push(plannedTask);

    // Update task with assigned date
    await db.tasks.update(task.id!, { assignedDate: todayDateString });

    // Move current time forward (add task duration + small break)
    currentTime = new Date(endTime.getTime() + 5 * 60 * 1000); // 5 min break
  }

  // Save planned tasks to database
  if (plannedTasks.length > 0) {
    await db.dailyPlanTasks.bulkAdd(plannedTasks);
  }

  return {
    plannedTasks,
    totalMinutes: accumulatedMinutes,
    message: `Created plan with ${plannedTasks.length} tasks (${Math.round(accumulatedMinutes / 60 * 10) / 10}h)`
  };
};

/**
 * Get today's planned tasks with full task details
 * ONLY returns tasks where assignedDate === today
 */
export const getTodaysPlan = async () => {
  const today = new Date().toISOString().split('T')[0];

  const plannedTasks = await db.dailyPlanTasks
    .where('planDate')
    .equals(today)
    .sortBy('order');

  // Fetch full task details for each planned task
  const tasksWithDetails = await Promise.all(
    plannedTasks.map(async (plannedTask) => {
      const task = await db.tasks.get(plannedTask.taskId);
      return { plannedTask, task };
    })
  );

  // Filter to ONLY tasks that still have assignedDate === today
  // (tasks may have been completed and assignedDate cleared)
  return tasksWithDetails.filter(item =>
    item.task !== undefined &&
    item.task.assignedDate === today
  );
};

/**
 * Mark a daily plan task as completed
 */
export const completeDailyPlanTask = async (dailyPlanTaskId: string) => {
  await db.dailyPlanTasks.update(dailyPlanTaskId, { completed: true });
};

/**
 * Remove a task from today's plan
 */
export const removeFromDailyPlan = async (dailyPlanTaskId: string) => {
  const plannedTask = await db.dailyPlanTasks.get(dailyPlanTaskId);
  if (plannedTask) {
    // Clear assignedDate from the task
    await db.tasks.update(plannedTask.taskId, { assignedDate: null });
    // Delete from daily plan
    await db.dailyPlanTasks.delete(dailyPlanTaskId);
  }
};
