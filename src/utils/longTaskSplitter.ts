import { Task, DailyPlanTask } from '../db/database';

/**
 * Split a long task into segments with breaks based on max focus block setting
 */
export const splitLongTask = (
  task: Task,
  maxFocusBlock: number,
  breakDuration: number,
  scheduledStartTime: string,
  planDate: string,
  order: number
): DailyPlanTask[] => {
  const taskDuration = task.estimateMins;

  // If task fits within max focus block, don't split
  if (taskDuration <= maxFocusBlock) {
    return [
      {
        taskId: task.id!,
        planDate,
        scheduledStartTime,
        scheduledEndTime: addMinutes(scheduledStartTime, taskDuration),
        completed: false,
        order,
        blockType: 'task'
      }
    ];
  }

  // Calculate number of segments needed
  const numSegments = Math.ceil(taskDuration / maxFocusBlock);
  const segments: DailyPlanTask[] = [];
  let currentStartTime = scheduledStartTime;
  let currentOrder = order;

  console.log(`LONG_TASK_SPLIT ${task.title} → ${numSegments} segments of ${maxFocusBlock}/${breakDuration}`);

  for (let i = 0; i < numSegments; i++) {
    const isLastSegment = i === numSegments - 1;
    const segmentDuration = isLastSegment
      ? taskDuration - (i * maxFocusBlock) // Remaining time for last segment
      : maxFocusBlock;

    // Create task segment
    segments.push({
      taskId: task.id!,
      planDate,
      scheduledStartTime: currentStartTime,
      scheduledEndTime: addMinutes(currentStartTime, segmentDuration),
      completed: false,
      order: currentOrder++,
      blockType: 'task',
      sliceNumber: i + 1,
      sliceDuration: segmentDuration
    });

    // Move time forward by segment duration
    currentStartTime = addMinutes(currentStartTime, segmentDuration);

    // Add break after this segment (except after the last segment)
    if (!isLastSegment) {
      segments.push({
        taskId: task.id!, // Link break to the task it's breaking from
        planDate,
        scheduledStartTime: currentStartTime,
        scheduledEndTime: addMinutes(currentStartTime, breakDuration),
        completed: false,
        order: currentOrder++,
        blockType: 'rest',
        freeType: 'Recharge'
      });

      // Move time forward by break duration
      currentStartTime = addMinutes(currentStartTime, breakDuration);
    }
  }

  return segments;
};

/**
 * Add minutes to an ISO datetime string
 */
const addMinutes = (isoDatetime: string, minutes: number): string => {
  const date = new Date(isoDatetime);
  date.setMinutes(date.getMinutes() + minutes);
  return date.toISOString();
};

/**
 * Calculate total duration including breaks for a long task
 */
export const calculateTotalDurationWithBreaks = (
  taskDuration: number,
  maxFocusBlock: number,
  breakDuration: number
): number => {
  if (taskDuration <= maxFocusBlock) {
    return taskDuration;
  }

  const numSegments = Math.ceil(taskDuration / maxFocusBlock);
  const numBreaks = numSegments - 1;

  return taskDuration + (numBreaks * breakDuration);
};
