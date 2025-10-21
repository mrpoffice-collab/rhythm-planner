import { Task, DailyPlanTask, db, Domain } from '../db/database';
import { isTaskEligibleForDate } from './taskEligibility';
import { getTodaysSlice } from './projectChunking';

interface DailyPlanResult {
  plannedTasks: DailyPlanTask[];
  totalMinutes: number;
  message: string;
}

interface DomainAllocation {
  domain: Domain;
  minutesUsed: number;
  maxMinutes: number;
}

/**
 * Get domain cap for today (in minutes)
 */
const getDomainCap = async (domain: Domain, prefs: any, today: Date): Promise<number> => {
  const dayOfWeek = today.getDay() === 0 ? 7 : today.getDay();

  switch (domain) {
    case 'Work':
      return (prefs.maxWorkHoursPerDay || 4) * 60;
    case 'SideHustle':
      return (prefs.maxSideHustleHoursPerDay || 2) * 60;
    case 'Errand':
      // Only allow errands on in-town days
      if (!prefs.inTownDays || !prefs.inTownDays.includes(dayOfWeek)) {
        return 0;
      }
      return Infinity; // No specific cap, just time available
    default:
      return Infinity; // No caps for other domains
  }
};

/**
 * Calculate urgency/priority score for a task
 */
const scoreTask = (task: Task, today: Date): number => {
  let score = 0;

  // Urgency from deadline/dueDate
  const deadline = task.dueDate || task.deadline;
  if (deadline) {
    const daysUntil = (new Date(deadline).getTime() - today.getTime()) / (1000 * 60 * 60 * 24);
    if (daysUntil < 1) score += 20;
    else if (daysUntil < 3) score += 15;
    else if (daysUntil < 7) score += 10;
    else score += 5;
  }

  // Priority
  if (task.priority === 'High') score += 15;
  else if (task.priority === 'Medium') score += 10;
  else score += 5;

  // Project progress (prioritize projects closer to completion)
  if (task.isProject && task.totalEstimateMins > 0) {
    const progress = (task.totalEstimateMins - task.remainingMins) / task.totalEstimateMins;
    score += progress * 10; // Up to 10 bonus points for nearly complete projects
  }

  // Dread penalty
  score -= task.dread * 2;

  return score;
};

/**
 * Domain priority order for filling the day
 */
const DOMAIN_PRIORITY: Domain[] = ['Work', 'SideHustle', 'Chore', 'Errand', 'Personal', 'Creative'];

/**
 * Generates a daily plan by selecting and scheduling tasks for today
 * with strict domain caps and complete time window filling
 */
export const generateDailyPlan = async (): Promise<DailyPlanResult> => {
  const today = new Date();
  const todayDateString = today.toISOString().split('T')[0];

  // Get user preferences
  const prefs = await db.userPrefs.get(1);
  if (!prefs) {
    throw new Error('User preferences not found');
  }

  const { dailyPlanStartTime, dailyPlanEndTime } = prefs;

  // Calculate total available minutes for the day
  const [startHour, startMin] = dailyPlanStartTime.split(':').map(Number);
  const [endHour, endMin] = dailyPlanEndTime.split(':').map(Number);
  const totalAvailableMinutes = (endHour * 60 + endMin) - (startHour * 60 + startMin);

  // Clear existing plan for today
  await db.dailyPlanTasks.where('planDate').equals(todayDateString).delete();

  // Get all todo tasks (exclude archived)
  const allTodoTasks = await db.tasks
    .where('status')
    .equals('todo')
    .and(task => !task.archived)
    .toArray();

  // Filter to eligible tasks for today
  let eligibleTasks = allTodoTasks.filter(task => isTaskEligibleForDate(task, today));

  // Initialize domain allocations
  const domainAllocations: Record<Domain, DomainAllocation> = {
    Work: { domain: 'Work', minutesUsed: 0, maxMinutes: await getDomainCap('Work', prefs, today) },
    SideHustle: { domain: 'SideHustle', minutesUsed: 0, maxMinutes: await getDomainCap('SideHustle', prefs, today) },
    Chore: { domain: 'Chore', minutesUsed: 0, maxMinutes: Infinity },
    Errand: { domain: 'Errand', minutesUsed: 0, maxMinutes: await getDomainCap('Errand', prefs, today) },
    Personal: { domain: 'Personal', minutesUsed: 0, maxMinutes: Infinity },
    Creative: { domain: 'Creative', minutesUsed: 0, maxMinutes: Infinity }
  };

  // Score all eligible tasks
  const scoredTasks = eligibleTasks.map(task => ({
    task,
    score: scoreTask(task, today)
  })).sort((a, b) => b.score - a.score);

  // Selected items to schedule (tasks or slices)
  interface ScheduleItem {
    task: Task;
    duration: number;
    sliceNumber?: number;
  }

  const selectedItems: ScheduleItem[] = [];
  let scheduledMinutes = 0;

  // Fill the day according to domain priority
  for (const domain of DOMAIN_PRIORITY) {
    const domainAlloc = domainAllocations[domain];

    // Get tasks for this domain, sorted by score
    const domainTasks = scoredTasks
      .filter(st => st.task.domain === domain)
      .map(st => st.task);

    for (const task of domainTasks) {
      // Check if we've filled the day
      if (scheduledMinutes >= totalAvailableMinutes) {
        break;
      }

      // Check domain cap
      if (domainAlloc.minutesUsed >= domainAlloc.maxMinutes) {
        continue; // Domain is at capacity
      }

      // Determine duration for this task/slice
      let duration: number;
      let sliceNumber: number | undefined;

      if (task.isProject && task.remainingMins > 0) {
        // For projects, schedule today's slice
        const slice = getTodaysSlice(task);
        if (!slice) continue; // Project complete

        duration = slice.sliceSize;
        sliceNumber = slice.sliceNumber;
      } else {
        // Regular task
        duration = task.estimateMins;
      }

      // Check if task fits in remaining time
      const remainingDayTime = totalAvailableMinutes - scheduledMinutes;
      const remainingDomainTime = domainAlloc.maxMinutes - domainAlloc.minutesUsed;

      if (duration > remainingDayTime || duration > remainingDomainTime) {
        continue; // Doesn't fit
      }

      // Schedule this item
      selectedItems.push({ task, duration, sliceNumber });
      scheduledMinutes += duration;
      domainAlloc.minutesUsed += duration;

      // Update task's assignedDate
      await db.tasks.update(task.id!, { assignedDate: todayDateString });
    }
  }

  // Fill remaining time with Free/Rest blocks
  const remainingMinutes = totalAvailableMinutes - scheduledMinutes;

  // Create scheduled time slots
  const plannedTasks: DailyPlanTask[] = [];
  let currentTime = new Date(today);
  currentTime.setHours(startHour, startMin, 0, 0);
  let order = 0;

  // Schedule selected items
  for (const item of selectedItems) {
    const startTime = new Date(currentTime);
    const endTime = new Date(currentTime.getTime() + item.duration * 60 * 1000);

    const plannedTask: DailyPlanTask = {
      id: crypto.randomUUID(),
      taskId: item.task.id!,
      planDate: todayDateString,
      scheduledStartTime: startTime.toISOString(),
      scheduledEndTime: endTime.toISOString(),
      completed: false,
      order: order++,
      blockType: 'task',
      sliceNumber: item.sliceNumber,
      sliceDuration: item.duration
    };

    plannedTasks.push(plannedTask);
    currentTime = new Date(endTime.getTime() + 5 * 60 * 1000); // 5 min break
  }

  // Add Free/Rest blocks to fill the remaining day
  if (remainingMinutes > 15) {
    // Distribute remaining time as Free blocks
    const numFreeBlocks = Math.floor(remainingMinutes / 60); // 60-min free blocks
    const finalRestMinutes = remainingMinutes % 60;

    for (let i = 0; i < numFreeBlocks; i++) {
      const startTime = new Date(currentTime);
      const endTime = new Date(currentTime.getTime() + 60 * 60 * 1000);

      plannedTasks.push({
        id: crypto.randomUUID(),
        taskId: null,
        planDate: todayDateString,
        scheduledStartTime: startTime.toISOString(),
        scheduledEndTime: endTime.toISOString(),
        completed: false,
        order: order++,
        blockType: 'free',
        sliceNumber: undefined,
        sliceDuration: 60
      });

      currentTime = new Date(endTime.getTime());
    }

    // Final rest block if any time remains
    if (finalRestMinutes >= 15) {
      const startTime = new Date(currentTime);
      const endTime = new Date(currentTime.getTime() + finalRestMinutes * 60 * 1000);

      plannedTasks.push({
        id: crypto.randomUUID(),
        taskId: null,
        planDate: todayDateString,
        scheduledStartTime: startTime.toISOString(),
        scheduledEndTime: endTime.toISOString(),
        completed: false,
        order: order++,
        blockType: 'rest',
        sliceNumber: undefined,
        sliceDuration: finalRestMinutes
      });
    }
  }

  // Save all planned tasks to database
  if (plannedTasks.length > 0) {
    await db.dailyPlanTasks.bulkAdd(plannedTasks);
  }

  const taskCount = selectedItems.length;
  const taskMinutes = scheduledMinutes;

  return {
    plannedTasks,
    totalMinutes: totalAvailableMinutes,
    message: `Created plan with ${taskCount} tasks (${Math.round(taskMinutes / 60 * 10) / 10}h) + ${Math.round(remainingMinutes / 60 * 10) / 10}h available time`
  };
};

/**
 * Get today's planned tasks with full task details
 * ONLY returns tasks where assignedDate === today OR blockType is free/rest
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
      if (plannedTask.taskId === null) {
        // Free/Rest block - no task to fetch
        return { plannedTask, task: null };
      }
      const task = await db.tasks.get(plannedTask.taskId);
      return { plannedTask, task };
    })
  );

  // Filter to valid entries (free blocks or tasks with assignedDate === today)
  return tasksWithDetails.filter(item =>
    item.task === null || // Free/Rest blocks
    (item.task !== undefined && item.task.assignedDate === today)
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
  if (plannedTask && plannedTask.taskId) {
    // Clear assignedDate from the task
    await db.tasks.update(plannedTask.taskId, { assignedDate: null });
    // Delete from daily plan
    await db.dailyPlanTasks.delete(dailyPlanTaskId);
  }
};

/**
 * Get domain time summary for today's plan
 */
export const getTodayDomainSummary = async () => {
  const plan = await getTodaysPlan();

  const summary: Record<Domain | 'Free' | 'Rest', number> = {
    Work: 0,
    SideHustle: 0,
    Chore: 0,
    Errand: 0,
    Personal: 0,
    Creative: 0,
    Free: 0,
    Rest: 0
  };

  for (const item of plan) {
    const duration = item.plannedTask.sliceDuration || 30;

    if (item.plannedTask.blockType === 'free') {
      summary.Free += duration;
    } else if (item.plannedTask.blockType === 'rest') {
      summary.Rest += duration;
    } else if (item.task) {
      summary[item.task.domain] += duration;
    }
  }

  return summary;
};
