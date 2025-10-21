import { Task, db } from '../db/database';

/**
 * Generate the next occurrence of a recurring task
 * Called when a recurring task is completed
 */
export const generateNextOccurrence = async (task: Task): Promise<void> => {
  if (task.recurrence === 'Once') {
    // Not a recurring task - should not call this function
    console.warn('generateNextOccurrence called on Once task:', task.id);
    return;
  }

  const now = new Date();
  let nextDate: Date | null = null;

  switch (task.recurrence) {
    case 'Daily':
      // Next occurrence is tomorrow
      nextDate = new Date(now);
      nextDate.setDate(nextDate.getDate() + 1);
      break;

    case 'Weekly':
      // Next occurrence is next week on the same day
      if (task.weeklyDay !== null) {
        nextDate = getNextWeekday(now, task.weeklyDay);
      }
      break;

    case 'Monthly':
      // Next occurrence is same day next month
      nextDate = new Date(now);
      nextDate.setMonth(nextDate.getMonth() + 1);
      break;

    case 'CustomDays':
      // Next occurrence is the next day in daysOfWeek array
      if (task.daysOfWeek && task.daysOfWeek.length > 0) {
        nextDate = getNextCustomDay(now, task.daysOfWeek);
      }
      break;
  }

  // Update lastCompletedAt to track when this occurrence was finished
  if (task.id) {
    await db.tasks.update(task.id, {
      lastCompletedAt: now.toISOString()
    });
  }

  // Note: We don't create a new task - recurring tasks are the same task that repeats
  // The scheduler will pick them up again based on their recurrence rules
  console.log(`Recurring task "${task.title}" completed. Last completed: ${now.toISOString()}`);
};

/**
 * Get next occurrence of a specific weekday
 * weekday: 1=Mon, 2=Tue, ..., 7=Sun
 */
const getNextWeekday = (from: Date, targetWeekday: number): Date => {
  const result = new Date(from);
  const currentWeekday = result.getDay() === 0 ? 7 : result.getDay();

  let daysToAdd = targetWeekday - currentWeekday;

  // If target is today or earlier in week, go to next week
  if (daysToAdd <= 0) {
    daysToAdd += 7;
  }

  result.setDate(result.getDate() + daysToAdd);
  return result;
};

/**
 * Get next occurrence from custom days array
 * daysOfWeek: array of 1=Mon, 2=Tue, ..., 7=Sun
 */
const getNextCustomDay = (from: Date, daysOfWeek: number[]): Date => {
  const result = new Date(from);
  const currentWeekday = result.getDay() === 0 ? 7 : result.getDay();

  // Sort days to ensure proper ordering
  const sortedDays = [...daysOfWeek].sort((a, b) => a - b);

  // Find next day in the array
  const nextDay = sortedDays.find(day => day > currentWeekday);

  let daysToAdd: number;

  if (nextDay) {
    // Next occurrence is later this week
    daysToAdd = nextDay - currentWeekday;
  } else {
    // Next occurrence is first day of next week
    daysToAdd = (7 - currentWeekday) + sortedDays[0];
  }

  result.setDate(result.getDate() + daysToAdd);
  return result;
};
