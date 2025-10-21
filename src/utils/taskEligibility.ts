import { Task } from '../db/database';

/**
 * Check if a task is eligible to be scheduled on a specific date
 *
 * A task is eligible for a date if:
 * - The date is not before the task's startDate
 * - The date is not before snoozedUntil
 * - The recurrence pattern permits this date
 * - For Once tasks: only on the dueDate (or any day if no dueDate)
 * - For Daily tasks: every day
 * - For Weekly tasks: only on the specified weekday
 * - For Monthly tasks: same day of month as startDate or dueDate
 * - For CustomDays: only on specified days of week
 */
export const isTaskEligibleForDate = (task: Task, targetDate: Date): boolean => {
  const targetDateString = targetDate.toISOString().split('T')[0]; // YYYY-MM-DD

  // Check if date is before startDate
  if (task.startDate && targetDateString < task.startDate.split('T')[0]) {
    return false;
  }

  // Check if task is snoozed until after this date
  if (task.snoozedUntil) {
    const snoozedUntilDate = task.snoozedUntil.split('T')[0];
    if (targetDateString < snoozedUntilDate) {
      return false;
    }
  }

  // Check recurrence pattern
  switch (task.recurrence) {
    case 'Once':
      // For one-time tasks, only schedule on the dueDate if provided
      if (task.dueDate) {
        const dueDateString = task.dueDate.split('T')[0];
        return targetDateString === dueDateString;
      }
      // If no dueDate, can be scheduled any day after startDate
      return true;

    case 'Daily':
      // Can be scheduled every day
      return true;

    case 'Weekly':
      // Check if this is the correct day of week
      if (task.weeklyDay === null) {
        return false; // Weekly task must specify a day
      }
      const dayOfWeek = targetDate.getDay(); // 0=Sun, 1=Mon, ..., 6=Sat
      // Convert to our format: 1=Mon, 7=Sun
      const ourDayFormat = dayOfWeek === 0 ? 7 : dayOfWeek;
      return ourDayFormat === task.weeklyDay;

    case 'Monthly':
      // Schedule on same day of month as startDate or dueDate
      const referenceDate = task.startDate || task.dueDate;
      if (!referenceDate) {
        return false; // Monthly task needs a reference date
      }
      const referenceDayOfMonth = new Date(referenceDate).getDate();
      return targetDate.getDate() === referenceDayOfMonth;

    case 'CustomDays':
      // Check if this day of week is in the allowed days
      if (!task.daysOfWeek || task.daysOfWeek.length === 0) {
        return false; // CustomDays task must specify days
      }
      const currentDayOfWeek = targetDate.getDay();
      const currentOurFormat = currentDayOfWeek === 0 ? 7 : currentDayOfWeek;
      return task.daysOfWeek.includes(currentOurFormat);

    default:
      return true;
  }
};

/**
 * Get the next eligible date for a task after a given date
 */
export const getNextEligibleDate = (task: Task, afterDate: Date): Date | null => {
  const maxDaysToCheck = 365; // Don't check more than a year ahead
  const startDate = new Date(afterDate);
  startDate.setDate(startDate.getDate() + 1); // Start from next day

  for (let i = 0; i < maxDaysToCheck; i++) {
    const checkDate = new Date(startDate);
    checkDate.setDate(checkDate.getDate() + i);

    if (isTaskEligibleForDate(task, checkDate)) {
      return checkDate;
    }
  }

  return null;
};

/**
 * Get all tasks that are eligible for a specific date
 */
export const getEligibleTasksForDate = (tasks: Task[], targetDate: Date): Task[] => {
  return tasks.filter(task => isTaskEligibleForDate(task, targetDate));
};

/**
 * Helper to get day of week from date in our format (1=Mon, 7=Sun)
 */
export const getDayOfWeekNumber = (date: Date): number => {
  const dayOfWeek = date.getDay(); // 0=Sun, 1=Mon, ..., 6=Sat
  return dayOfWeek === 0 ? 7 : dayOfWeek;
};

/**
 * Helper to get day name from number
 */
export const getDayName = (dayNumber: number): string => {
  const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
  return days[dayNumber - 1] || '';
};

/**
 * Common recurrence presets
 */
export const RECURRENCE_PRESETS = {
  WEEKDAYS: [1, 2, 3, 4, 5], // Mon-Fri
  WEEKENDS: [6, 7], // Sat-Sun
  MWF: [1, 3, 5], // Mon, Wed, Fri
  TTH: [2, 4], // Tue, Thu
  EVERY_OTHER_DAY: [] as number[], // Need to handle differently
};
