import { Task } from '../db/database';

/**
 * Calculate how many slices a project needs based on remaining time
 */
export const calculateSlicesNeeded = (remainingMins: number, sliceSize: number): number => {
  return Math.ceil(remainingMins / sliceSize);
};

/**
 * Get the slice sizes for a project, optimizing to use preferred size where possible
 * Example: 360 mins with 60min slices = [60, 60, 60, 60, 60, 60]
 * Example: 90 mins with 60min slices = [60, 30]
 */
export const getSliceSizes = (remainingMins: number, preferredSliceSize: number): number[] => {
  if (remainingMins <= 0) return [];

  const slices: number[] = [];
  let remaining = remainingMins;

  // Fill with preferred size slices as much as possible
  while (remaining >= preferredSliceSize) {
    slices.push(preferredSliceSize);
    remaining -= preferredSliceSize;
  }

  // Handle remainder
  if (remaining > 0) {
    // If remainder is very small (< 15 min), merge into last slice if possible
    if (remaining < 15 && slices.length > 0) {
      slices[slices.length - 1] += remaining;
    } else {
      // Otherwise, add as separate slice rounded to nearest 15, 30, or keep as is
      if (remaining <= 15) {
        slices.push(15);
      } else if (remaining <= 30) {
        slices.push(30);
      } else if (remaining <= 45) {
        slices.push(45);
      } else {
        slices.push(remaining);
      }
    }
  }

  return slices;
};

/**
 * Get today's slice for a project task
 * Returns the slice size that should be worked on today, or null if project is complete
 */
export const getTodaysSlice = (task: Task): { sliceSize: number; sliceNumber: number } | null => {
  if (!task.isProject || task.remainingMins <= 0) {
    return null;
  }

  const slices = getSliceSizes(task.remainingMins, task.preferredSliceSize);
  if (slices.length === 0) return null;

  // Calculate which slice number this is based on total estimate
  const completedMins = task.totalEstimateMins - task.remainingMins;
  const previousSlices = getSliceSizes(task.totalEstimateMins, task.preferredSliceSize);
  const totalSlices = previousSlices.length;
  const completedSlices = Math.floor(completedMins / task.preferredSliceSize);
  const currentSliceNumber = completedSlices + 1;

  return {
    sliceSize: slices[0], // Always work on the next slice
    sliceNumber: currentSliceNumber
  };
};

/**
 * Calculate total slices for a project
 */
export const getTotalSlices = (task: Task): number => {
  if (!task.isProject) return 1;
  const slices = getSliceSizes(task.totalEstimateMins, task.preferredSliceSize);
  return slices.length;
};

/**
 * Calculate completed slices for a project
 */
export const getCompletedSlices = (task: Task): number => {
  if (!task.isProject) return task.status === 'done' ? 1 : 0;
  const completedMins = task.totalEstimateMins - task.remainingMins;
  return Math.floor(completedMins / task.preferredSliceSize);
};

/**
 * Get progress percentage for a project
 */
export const getProjectProgress = (task: Task): number => {
  if (!task.isProject) {
    return task.status === 'done' ? 100 : 0;
  }
  if (task.totalEstimateMins === 0) return 0;
  const completedMins = task.totalEstimateMins - task.remainingMins;
  return Math.round((completedMins / task.totalEstimateMins) * 100);
};

/**
 * Format remaining time for display
 */
export const formatRemainingTime = (remainingMins: number): string => {
  if (remainingMins <= 0) return 'Complete';

  const hours = Math.floor(remainingMins / 60);
  const mins = remainingMins % 60;

  if (hours > 0 && mins > 0) {
    return `${hours}h ${mins}m left`;
  } else if (hours > 0) {
    return `${hours}h left`;
  } else {
    return `${mins}m left`;
  }
};

/**
 * Check if a project should be marked as done
 */
export const isProjectComplete = (task: Task): boolean => {
  if (!task.isProject) return task.status === 'done';
  return task.remainingMins <= 0;
};
