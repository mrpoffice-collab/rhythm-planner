import { Task, DailyPlanTask, db, Domain, FreeTimeType, TaskType, Energy, cleanupArchivedTasks } from '../db/database';
import { isTaskEligibleForDate } from './taskEligibility';
import { getTodaysSlice } from './projectChunking';

// Generate UUID for browser compatibility
const generateId = () => {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
};

/**
 * Check if a task's energy requirement matches the current energy level
 * - Low energy tasks: can be done at any energy level (Low, Medium, High)
 * - Medium energy tasks: require Medium or High energy
 * - High energy tasks: require High energy only
 */
const canDoTaskAtEnergy = (taskEnergy: Energy, currentEnergy: Energy): boolean => {
  if (taskEnergy === 'Low') return true; // Low can be done anytime
  if (taskEnergy === 'Medium') return currentEnergy === 'Medium' || currentEnergy === 'High';
  if (taskEnergy === 'High') return currentEnergy === 'High';
  return false;
};

interface ScheduleResult {
  plannedTasks: DailyPlanTask[];
  totalMinutes: number;
  message: string;
}

interface DomainAllocation {
  domain: Domain;
  minutesUsed: number;
  maxMinutes: number;
}

interface ScheduleItem {
  task: Task;
  duration: number;
  sliceNumber?: number;
  fixedStartTime?: Date;
  eligibleStart?: Date;
  mustFinishBy?: Date;
}

/**
 * Get domain cap for a specific date (in minutes)
 */
const getDomainCap = async (domain: Domain, prefs: any, date: Date): Promise<number> => {
  const dayOfWeek = date.getDay() === 0 ? 7 : date.getDay();

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
      return Infinity;
    case 'Unplanned':
      return Infinity; // Interruptions don't have caps (they're already happened)
    default:
      return Infinity; // No caps for other domains
  }
};

/**
 * Calculate urgency/priority score for a task
 */
const scoreTask = (task: Task, targetDate: Date): number => {
  let score = 0;

  // Urgency from deadline/dueDate
  const deadline = task.dueDate || task.deadline;
  if (deadline) {
    const daysUntil = (new Date(deadline).getTime() - targetDate.getTime()) / (1000 * 60 * 60 * 24);
    if (daysUntil < 0) score += 30; // Overdue!
    else if (daysUntil < 1) score += 25;
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
    score += progress * 10;
  }

  // Dread penalty
  score -= task.dread * 2;

  return score;
};

/**
 * Parse time string (HH:MM) and apply to a date
 */
const parseTimeToDate = (timeStr: string, baseDate: Date): Date => {
  const [hours, minutes] = timeStr.split(':').map(Number);
  const result = new Date(baseDate);
  result.setHours(hours, minutes, 0, 0);
  return result;
};

/**
 * Check if a time window is available in the schedule
 */
const isTimeWindowAvailable = (
  startTime: Date,
  endTime: Date,
  existingBlocks: DailyPlanTask[]
): boolean => {
  for (const block of existingBlocks) {
    const blockStart = new Date(block.scheduledStartTime);
    const blockEnd = new Date(block.scheduledEndTime);

    // Check for overlap
    if (startTime < blockEnd && endTime > blockStart) {
      return false; // Overlaps with existing block
    }
  }
  return true;
};

/**
 * Find next available time slot that fits duration
 */
const findNextAvailableSlot = (
  duration: number,
  searchStart: Date,
  dayEnd: Date,
  existingBlocks: DailyPlanTask[],
  eligibleStart?: Date,
  mustFinishBy?: Date
): { start: Date; end: Date } | null => {
  // Sort existing blocks by start time
  const sortedBlocks = [...existingBlocks].sort(
    (a, b) => new Date(a.scheduledStartTime).getTime() - new Date(b.scheduledStartTime).getTime()
  );

  let currentStart = new Date(Math.max(searchStart.getTime(), eligibleStart?.getTime() || 0));

  // Check if we can fit before the first block
  if (sortedBlocks.length === 0) {
    const end = new Date(currentStart.getTime() + duration * 60 * 1000);
    if (end <= dayEnd && (!mustFinishBy || end <= mustFinishBy)) {
      return { start: currentStart, end };
    }
    return null;
  }

  // Try gaps between blocks
  for (let i = 0; i <= sortedBlocks.length; i++) {
    const gapStart = i === 0 ? currentStart : new Date(sortedBlocks[i - 1].scheduledEndTime);
    const gapEnd = i === sortedBlocks.length ? dayEnd : new Date(sortedBlocks[i].scheduledStartTime);

    const actualStart = new Date(Math.max(gapStart.getTime(), currentStart.getTime()));
    const proposedEnd = new Date(actualStart.getTime() + duration * 60 * 1000);

    if (proposedEnd <= gapEnd && proposedEnd <= dayEnd && (!mustFinishBy || proposedEnd <= mustFinishBy)) {
      return { start: actualStart, end: proposedEnd };
    }
  }

  return null; // No slot found
};

/**
 * Generate wake-day schedule with priority ordering:
 * 1. Fixed items at exact times
 * 2. Flexible items within windows (due soonest first)
 * 3. Recurring items eligible today
 * 4. Free blocks (Recharge/Buffer/Leisure)
 */
export const generateWakeDaySchedule = async (
  targetDate: Date,
  isDraft: boolean = false,
  forceStartTime?: Date
): Promise<ScheduleResult> => {
  const dateString = targetDate.toISOString().split('T')[0];

  // Get user preferences
  const prefs = await db.userPrefs.get(1);
  if (!prefs) {
    throw new Error('User preferences not found');
  }

  // Determine wake and sleep times for this day
  let wakeTime: Date;
  let sleepTime: Date;

  const todayString = new Date().toISOString().split('T')[0];
  const isToday = dateString === todayString;

  if (forceStartTime) {
    // Use forced start time (for mid-day rescheduling) - already rounded by caller
    wakeTime = forceStartTime;
  } else if (isToday && prefs.actualWakeTimeToday) {
    // User has started their day - use actual wake time OR current time (whichever is later)
    const actualWake = new Date(prefs.actualWakeTimeToday);
    const now = new Date();
    const laterTime = actualWake > now ? actualWake : now;
    // Round up to next 5-minute increment
    wakeTime = roundUpToNext5Min(laterTime);
  } else if (isToday && !prefs.actualWakeTimeToday) {
    // Today but not started - use current time or default wake time (whichever is later)
    const now = new Date();
    const defaultWake = parseTimeToDate(prefs.defaultWakeTime, targetDate);
    const laterTime = now > defaultWake ? now : defaultWake;
    // Round up to next 5-minute increment
    wakeTime = roundUpToNext5Min(laterTime);
  } else {
    // Future day - use default wake time (already aligned to time grid)
    wakeTime = parseTimeToDate(prefs.defaultWakeTime, targetDate);
  }

  sleepTime = parseTimeToDate(prefs.defaultSleepTime, targetDate);

  // Calculate total available minutes
  const totalAvailableMinutes = Math.max(0, (sleepTime.getTime() - wakeTime.getTime()) / (1000 * 60));

  if (totalAvailableMinutes <= 0) {
    return {
      plannedTasks: [],
      totalMinutes: 0,
      message: 'No time available today'
    };
  }

  // Get existing interruptions and completed blocks for today (if not draft and is today)
  let existingBlocks: DailyPlanTask[] = [];
  if (!isDraft && isToday) {
    const existing = await db.dailyPlanTasks
      .where('planDate')
      .equals(dateString)
      .and(block => block.blockType === 'interruption' || block.completed === true)
      .toArray();
    existingBlocks = existing;
  }

  // Get current energy level (default to Medium if not set)
  const currentEnergy: Energy = prefs.currentEnergy || 'Medium';

  // CRITICAL: For today's schedule, we must preserve all tasks already assigned to today
  // Get tasks in TWO categories:
  // 1. Tasks already assigned to today (MUST be scheduled, regardless of energy/eligibility)
  // 2. Other eligible tasks (can be added if time permits)

  let tasksAssignedToday: Task[] = [];
  let otherEligibleTasks: Task[] = [];

  // Fetch all todo tasks once at function scope (needed for wrongEnergy calculation later)
  // Exclude archived tasks from scheduling
  const allTodoTasks = await db.tasks
    .where('status')
    .equals('todo')
    .and(task => !task.archived)
    .toArray();

  if (isToday && !isDraft) {
    // For today's real schedule: prioritize tasks already assigned
    tasksAssignedToday = await db.tasks
      .where('assignedDate')
      .equals(dateString)
      .and(task => (task.status === 'todo' || task.status === 'doing') && task.id !== undefined && !task.archived)
      .toArray();

    console.log(`  → Found ${tasksAssignedToday.length} tasks already assigned to today`);
    console.log('  → Assigned task details:', tasksAssignedToday.map(t => ({ id: t.id, title: t.title, energy: t.energy })));

    // Get other todo tasks for backfill
    otherEligibleTasks = allTodoTasks.filter(task =>
      task.id &&
      task.assignedDate !== dateString && // Not already assigned to today
      isTaskEligibleForDate(task, targetDate) &&
      canDoTaskAtEnergy(task.energy, currentEnergy)
    );

    console.log(`  → Found ${otherEligibleTasks.length} other eligible tasks for backfill`);
  } else {
    // For drafts or future days: use standard eligibility
    otherEligibleTasks = allTodoTasks.filter(task =>
      task.id && isTaskEligibleForDate(task, targetDate) && canDoTaskAtEnergy(task.energy, currentEnergy)
    );
  }

  // Combine: today's assigned tasks FIRST, then other eligible tasks
  const eligibleTasks = [...tasksAssignedToday, ...otherEligibleTasks];
  console.log(`  → Total eligible tasks to schedule: ${eligibleTasks.length}`);

  // Initialize domain allocations
  const domainAllocations: Record<Domain, DomainAllocation> = {
    Work: { domain: 'Work', minutesUsed: 0, maxMinutes: await getDomainCap('Work', prefs, targetDate) },
    SideHustle: { domain: 'SideHustle', minutesUsed: 0, maxMinutes: await getDomainCap('SideHustle', prefs, targetDate) },
    Chore: { domain: 'Chore', minutesUsed: 0, maxMinutes: Infinity },
    Errand: { domain: 'Errand', minutesUsed: 0, maxMinutes: await getDomainCap('Errand', prefs, targetDate) },
    Personal: { domain: 'Personal', minutesUsed: 0, maxMinutes: Infinity },
    Creative: { domain: 'Creative', minutesUsed: 0, maxMinutes: Infinity },
    Unplanned: { domain: 'Unplanned', minutesUsed: 0, maxMinutes: Infinity }
  };

  // Account for existing blocks in domain caps
  for (const block of existingBlocks) {
    if (block.taskId) {
      const task = await db.tasks.get(block.taskId);
      if (task && task.domain in domainAllocations) {
        const duration = block.sliceDuration || task.estimateMins;
        domainAllocations[task.domain].minutesUsed += duration;
      }
    } else if (block.interruptionDomain && block.interruptionDomain in domainAllocations) {
      const duration = (new Date(block.scheduledEndTime).getTime() - new Date(block.scheduledStartTime).getTime()) / (1000 * 60);
      domainAllocations[block.interruptionDomain].minutesUsed += duration;
    }
  }

  // Prepare schedule items with time windows
  const scheduleItems: ScheduleItem[] = [];

  for (const task of eligibleTasks) {
    let duration: number;
    let sliceNumber: number | undefined;

    if (task.isProject && task.remainingMins > 0) {
      const slice = getTodaysSlice(task);
      if (!slice) continue;
      duration = slice.sliceSize;
      sliceNumber = slice.sliceNumber;
    } else {
      duration = task.estimateMins;
    }

    const item: ScheduleItem = { task, duration, sliceNumber };

    // Parse time windows
    if (task.taskType === 'Fixed' && task.fixedStartTime) {
      const fixedDate = new Date(task.fixedStartTime);
      // Fixed tasks MUST match the target date - enforce I1
      const fixedDateString = fixedDate.toISOString().split('T')[0];
      if (fixedDateString !== dateString) {
        continue; // Skip - fixed task is for different day
      }
      item.fixedStartTime = fixedDate;
    }

    if (task.eligibleStartTime) {
      item.eligibleStart = parseTimeToDate(task.eligibleStartTime, targetDate);
    }

    if (task.mustFinishByTime) {
      item.mustFinishBy = parseTimeToDate(task.mustFinishByTime, targetDate);
    }

    scheduleItems.push(item);
  }

  // Sort by priority (deterministic packing order per P1-A):
  // 1. Fixed tasks (by fixed time)
  // 2. Flexible tasks (by earliest due, highest energy, longest duration)
  // 3. Recurring tasks (by score)
  const fixedItems = scheduleItems
    .filter(item => item.task.taskType === 'Fixed' && item.fixedStartTime)
    .sort((a, b) => (a.fixedStartTime!.getTime() - b.fixedStartTime!.getTime()));

  const flexibleItems = scheduleItems
    .filter(item => item.task.taskType === 'Flexible')
    .sort((a, b) => {
      // Primary: earliest due date
      const aDue = a.task.dueDate || a.task.deadline;
      const bDue = b.task.dueDate || b.task.deadline;
      if (aDue && bDue) {
        const diff = new Date(aDue).getTime() - new Date(bDue).getTime();
        if (diff !== 0) return diff;
      } else if (aDue) return -1;
      else if (bDue) return 1;

      // Secondary: highest energy demand (High > Medium > Low)
      const energyOrder = { High: 3, Medium: 2, Low: 1 };
      const energyDiff = energyOrder[b.task.energy] - energyOrder[a.task.energy];
      if (energyDiff !== 0) return energyDiff;

      // Tertiary: longest duration
      return b.duration - a.duration;
    });

  const recurringItems = scheduleItems
    .filter(item => item.task.taskType === 'Recurring')
    .map(item => ({ item, score: scoreTask(item.task, targetDate) }))
    .sort((a, b) => b.score - a.score)
    .map(x => x.item);

  const plannedTasks: DailyPlanTask[] = [];
  let order = 0;

  // Separate today's assigned tasks from new tasks
  const assignedTaskIds = new Set(tasksAssignedToday.map(t => t.id));

  // Schedule Fixed items first
  for (const item of fixedItems) {
    const domain = item.task.domain;
    const domainAlloc = domainAllocations[domain];
    const isAlreadyAssignedToday = isToday && !isDraft && assignedTaskIds.has(item.task.id);

    // For Update/Interruption: MUST schedule already-assigned tasks regardless of domain cap
    // For initial planning: respect domain caps
    if (!isAlreadyAssignedToday && domainAlloc.minutesUsed >= domainAlloc.maxMinutes) {
      continue; // Domain at capacity (only skip if not already assigned)
    }

    const startTime = item.fixedStartTime!;
    const endTime = new Date(startTime.getTime() + item.duration * 60 * 1000);

    // Check if time is available
    if (!isTimeWindowAvailable(startTime, endTime, [...existingBlocks, ...plannedTasks])) {
      continue; // Time conflict
    }

    // Check if within wake-sleep window
    if (startTime < wakeTime || endTime > sleepTime) {
      continue; // Outside wake day
    }

    // Schedule it as single block - chunking happens at timer start only
    plannedTasks.push({
      id: generateId(),
      taskId: item.task.id!,
      planDate: dateString,
      scheduledStartTime: startTime.toISOString(),
      scheduledEndTime: endTime.toISOString(),
      completed: false,
      order: order++,
      blockType: 'task',
      sliceNumber: item.sliceNumber,
      sliceDuration: item.duration,
      isDraft
    });

    domainAlloc.minutesUsed += item.duration;

    // Only update assignedDate if not already assigned (prevent unnecessary writes)
    if (item.task.id && !isAlreadyAssignedToday && !isDraft) {
      await db.tasks.update(item.task.id, { assignedDate: dateString });
    }
  }

  // Schedule Flexible and Recurring items - keep looping until no more can fit
  const allFlexibleAndRecurring = [...flexibleItems, ...recurringItems];
  const scheduledTaskIds = new Set<number>();
  let madeProgress = true;

  // Track reasons for not scheduling
  const unscheduledReasons = {
    domainCapHit: [] as string[],
    noTimeSlot: [] as string[],
    wrongEnergy: 0
  };

  // Keep trying to schedule tasks until we can't schedule any more
  while (madeProgress) {
    madeProgress = false;

    for (const item of allFlexibleAndRecurring) {
      // Skip if already scheduled
      if (scheduledTaskIds.has(item.task.id!)) {
        continue;
      }

      const domain = item.task.domain;
      const domainAlloc = domainAllocations[domain];
      const isAlreadyAssignedToday = isToday && !isDraft && assignedTaskIds.has(item.task.id);

      // For Update/Interruption: MUST schedule already-assigned tasks regardless of domain cap
      // For initial planning: respect domain caps
      if (!isAlreadyAssignedToday && domainAlloc.minutesUsed >= domainAlloc.maxMinutes) {
        if (!unscheduledReasons.domainCapHit.includes(domain)) {
          unscheduledReasons.domainCapHit.push(domain);
        }
        continue;
      }

      const remainingDomainCapacity = domainAlloc.maxMinutes - domainAlloc.minutesUsed;
      if (!isAlreadyAssignedToday && item.duration > remainingDomainCapacity) {
        if (!unscheduledReasons.domainCapHit.includes(domain)) {
          unscheduledReasons.domainCapHit.push(domain);
        }
        continue;
      }

      // Find next available slot
      const slot = findNextAvailableSlot(
        item.duration,
        wakeTime,
        sleepTime,
        [...existingBlocks, ...plannedTasks],
        item.eligibleStart,
        item.mustFinishBy
      );

      if (!slot) {
        unscheduledReasons.noTimeSlot.push(item.task.title);
        continue; // No slot available
      }

      // Successfully found a slot - schedule as single block
      plannedTasks.push({
        id: generateId(),
        taskId: item.task.id!,
        planDate: dateString,
        scheduledStartTime: slot.start.toISOString(),
        scheduledEndTime: slot.end.toISOString(),
        completed: false,
        order: order++,
        blockType: 'task',
        sliceNumber: item.sliceNumber,
        sliceDuration: item.duration,
        isDraft
      });

      domainAlloc.minutesUsed += item.duration;
      if (item.task.id) {
        scheduledTaskIds.add(item.task.id);
        // Only update assignedDate if not already assigned (prevent unnecessary writes)
        if (!isAlreadyAssignedToday && !isDraft) {
          await db.tasks.update(item.task.id, { assignedDate: dateString });
        }
      }

      madeProgress = true; // We scheduled something, so keep trying
    }
  }

  // Count tasks that were filtered out due to wrong energy
  unscheduledReasons.wrongEnergy = allTodoTasks.filter(task =>
    isTaskEligibleForDate(task, targetDate) && !canDoTaskAtEnergy(task.energy, currentEnergy)
  ).length;

  // Fill remaining time with Free blocks
  const sortedPlanned = [...existingBlocks, ...plannedTasks].sort(
    (a, b) => new Date(a.scheduledStartTime).getTime() - new Date(b.scheduledStartTime).getTime()
  );

  // Find gaps and fill with Available time (fill ALL gaps to maintain packed schedule)
  let currentTime = wakeTime;

  for (const block of sortedPlanned) {
    const blockStart = new Date(block.scheduledStartTime);

    if (blockStart > currentTime) {
      // Gap found - fill with Free block (no minimum gap size, fill everything)
      const gapMinutes = (blockStart.getTime() - currentTime.getTime()) / (1000 * 60);

      // Determine free type based on preference and work remaining
      let freeType: FreeTimeType = prefs.freeTimePreference;

      // Use Buffer if work/sidehustle has remaining capacity and eligible tasks exist
      if (prefs.freeTimePreference === 'Recharge') {
        const workRemaining = domainAllocations.Work.maxMinutes - domainAllocations.Work.minutesUsed;
        const sideHustleRemaining = domainAllocations.SideHustle.maxMinutes - domainAllocations.SideHustle.minutesUsed;

        if (workRemaining > 0 || sideHustleRemaining > 0) {
          freeType = 'Buffer';
        }
      }

      plannedTasks.push({
        id: generateId(),
        taskId: null,
        planDate: dateString,
        scheduledStartTime: currentTime.toISOString(),
        scheduledEndTime: blockStart.toISOString(),
        completed: false,
        order: order++,
        blockType: 'free',
        freeType,
        sliceDuration: gapMinutes,
        isDraft
      });
    }

    currentTime = new Date(block.scheduledEndTime);
  }

  // Fill from last block to sleep time (always fill to maintain packed schedule)
  if (currentTime < sleepTime) {
    const remainingMinutes = (sleepTime.getTime() - currentTime.getTime()) / (1000 * 60);

    let freeType: FreeTimeType = prefs.freeTimePreference;

    const workRemaining = domainAllocations.Work.maxMinutes - domainAllocations.Work.minutesUsed;
    const sideHustleRemaining = domainAllocations.SideHustle.maxMinutes - domainAllocations.SideHustle.minutesUsed;

    if (prefs.freeTimePreference === 'Recharge' && (workRemaining > 0 || sideHustleRemaining > 0)) {
      freeType = 'Buffer';
    }

    plannedTasks.push({
      id: generateId(),
      taskId: null,
      planDate: dateString,
      scheduledStartTime: currentTime.toISOString(),
      scheduledEndTime: sleepTime.toISOString(),
      completed: false,
      order: order++,
      blockType: 'free',
      freeType,
      sliceDuration: remainingMinutes,
      isDraft
    });
  }

  // Calculate scheduled task time
  const taskMinutes = plannedTasks
    .filter(p => p.blockType === 'task')
    .reduce((sum, p) => sum + (p.sliceDuration || 0), 0);

  const freeMinutes = plannedTasks
    .filter(p => p.blockType === 'free')
    .reduce((sum, p) => sum + (p.sliceDuration || 0), 0);

  // Build detailed message with feedback
  let message = '';
  const taskCount = plannedTasks.filter(p => p.blockType === 'task').length;

  if (isDraft) {
    message = `Tomorrow preview: ${taskCount} tasks (${Math.round(taskMinutes / 60 * 10) / 10}h)`;
  } else {
    message = `✓ Scheduled ${taskCount} tasks (${Math.round(taskMinutes / 60 * 10) / 10}h)`;

    const totalUnscheduled = allFlexibleAndRecurring.length - scheduledTaskIds.size;

    if (totalUnscheduled > 0 || unscheduledReasons.wrongEnergy > 0) {
      const reasons = [];

      if (unscheduledReasons.wrongEnergy > 0) {
        reasons.push(`${unscheduledReasons.wrongEnergy} task(s) need higher energy (you're at ${currentEnergy})`);
      }

      if (unscheduledReasons.domainCapHit.length > 0) {
        reasons.push(`${unscheduledReasons.domainCapHit.join(', ')} domain cap(s) reached`);
      }

      if (totalUnscheduled > 0 && unscheduledReasons.noTimeSlot.length === 0) {
        reasons.push('all eligible tasks scheduled');
      }

      if (reasons.length > 0) {
        message += `. ${reasons.join(', ')}.`;
      }
    } else if (taskCount === 0 && tasksAssignedToday.length === 0) {
      message = 'No eligible tasks available for your current energy level.';
    } else if (taskCount === 0 && tasksAssignedToday.length > 0) {
      // SAFETY GUARD: If we had tasks assigned to today but none got scheduled, this is a bug
      console.error(`[REFLOW_GUARD] CRITICAL: ${tasksAssignedToday.length} tasks assigned to today but 0 scheduled! This should never happen.`);
      message = `ERROR: Failed to schedule ${tasksAssignedToday.length} task(s). Please report this bug.`;
    } else {
      message += '. All eligible tasks scheduled!';
    }

    if (freeMinutes > 0) {
      message += ` ${Math.round(freeMinutes / 60 * 10) / 10}h available time.`;
    }
  }

  // SAFETY GUARD: For today's schedule, verify all assigned tasks got blocks
  if (isToday && !isDraft && tasksAssignedToday.length > 0) {
    const scheduledAssignedTasks = plannedTasks.filter(p => p.blockType === 'task' && assignedTaskIds.has(p.taskId!));
    const scheduledCount = scheduledAssignedTasks.length;

    console.log(`  → Scheduled ${scheduledCount} of ${tasksAssignedToday.length} assigned tasks`);
    console.log('  → Scheduled task IDs:', scheduledAssignedTasks.map(p => p.taskId));

    if (scheduledCount < tasksAssignedToday.length) {
      const missingTasks = tasksAssignedToday.filter(t => !scheduledTaskIds.has(t.id!));
      console.error(
        `[REFLOW_GUARD] Assigned tasks lost during scheduling! ` +
        `Expected: ${tasksAssignedToday.length}, Got: ${scheduledCount}. ` +
        `Missing tasks:`, missingTasks.map(t => ({ id: t.id, title: t.title, energy: t.energy, domain: t.domain }))
      );
    }
  }

  console.log(`  → Returning ${plannedTasks.length} total blocks (${plannedTasks.filter(p => p.blockType === 'task').length} tasks, ${plannedTasks.filter(p => p.blockType === 'free').length} free)`);

  return {
    plannedTasks,
    totalMinutes: totalAvailableMinutes,
    message
  };
};

/**
 * Start the day by stamping actual wake time and rebuilding schedule
 */
export const startMyDay = async (): Promise<ScheduleResult> => {
  const now = new Date();

  // Clean up old archived tasks based on retention policy
  await cleanupArchivedTasks();

  // Update actualWakeTimeToday
  await db.userPrefs.update(1, {
    actualWakeTimeToday: now.toISOString()
  });

  // Clear today's plan
  const todayString = now.toISOString().split('T')[0];
  await db.dailyPlanTasks.where('planDate').equals(todayString).and(task => !task.isDraft).delete();

  // Rebuild schedule from now
  return await generateWakeDaySchedule(now, false);
};

/**
 * Round time up to next 5-minute increment
 * If already on a 5-minute mark, returns the same time
 * Otherwise rounds up to the next 5-minute increment
 */
const roundUpToNext5Min = (date: Date): Date => {
  const minutes = date.getMinutes();
  const seconds = date.getSeconds();
  const milliseconds = date.getMilliseconds();
  const remainder = minutes % 5;

  // If already on 5-minute mark with no seconds/ms, return as-is
  if (remainder === 0 && seconds === 0 && milliseconds === 0) {
    return new Date(date);
  }

  // If on 5-minute mark but has seconds/ms, round to same 5-minute mark
  if (remainder === 0) {
    const result = new Date(date);
    result.setSeconds(0);
    result.setMilliseconds(0);
    return result;
  }

  // Round up to next 5-minute increment
  const minutesToAdd = 5 - remainder;
  const result = new Date(date);
  result.setMinutes(minutes + minutesToAdd);
  result.setSeconds(0);
  result.setMilliseconds(0);
  return result;
};

/**
 * Update schedule now - reflow remaining wake day from current time
 * This SHIFTS tasks forward from current time, preserving all tasks and their assignedDates
 */
export const updateScheduleNow = async (): Promise<ScheduleResult> => {
  const now = new Date();
  const todayString = now.toISOString().split('T')[0];

  // SAFETY CHECK: Count tasks before update AND capture their IDs/titles
  const tasksBeforeUpdate = await db.tasks
    .where('assignedDate')
    .equals(todayString)
    .and(task => task.status === 'todo' || task.status === 'doing')
    .toArray();

  const tasksBeforeCount = tasksBeforeUpdate.length;
  const tasksBefore = tasksBeforeUpdate.map(t => ({ id: t.id, title: t.title, energy: t.energy, domain: t.domain }));

  console.log('=== UPDATE SCHEDULE NOW ===');
  console.log('BEFORE UPDATE:', tasksBeforeCount, 'tasks assigned to today');
  console.log('Task details:', tasksBefore);

  // Keep interruptions and completed blocks ONLY, remove all other blocks
  const blocksBeforeDelete = await db.dailyPlanTasks.where('planDate').equals(todayString).toArray();
  console.log('Blocks before delete:', blocksBeforeDelete.length, blocksBeforeDelete.map(b => ({ type: b.blockType, completed: b.completed, taskId: b.taskId })));

  await db.dailyPlanTasks
    .where('planDate')
    .equals(todayString)
    .and(block => {
      if (block.isDraft) return true; // Delete drafts
      if (block.blockType === 'interruption') return false; // Keep interruptions
      if (block.completed) return false; // Keep completed
      // Delete ALL unfinished task blocks (they'll be rescheduled)
      return true;
    })
    .delete();

  const blocksAfterDelete = await db.dailyPlanTasks.where('planDate').equals(todayString).toArray();
  console.log('Blocks after delete:', blocksAfterDelete.length, blocksAfterDelete.map(b => ({ type: b.blockType, completed: b.completed, taskId: b.taskId })));

  // Round current time up to next 5-minute increment
  const startTime = roundUpToNext5Min(now);

  console.log('Calling generateWakeDaySchedule with startTime:', startTime.toISOString());

  // Rebuild from rounded time - this will reschedule all tasks assigned to today
  const result = await generateWakeDaySchedule(now, false, startTime);

  // CRITICAL: Save the generated blocks to the database
  if (result.plannedTasks.length > 0) {
    await db.dailyPlanTasks.bulkAdd(result.plannedTasks);
    console.log(`Saved ${result.plannedTasks.length} blocks to database`);
  }

  // SAFETY CHECK: Count tasks after update AND capture their IDs/titles
  const tasksAfterUpdate = await db.tasks
    .where('assignedDate')
    .equals(todayString)
    .and(task => task.status === 'todo' || task.status === 'doing')
    .toArray();

  const tasksAfterCount = tasksAfterUpdate.length;
  const tasksAfter = tasksAfterUpdate.map(t => ({ id: t.id, title: t.title, energy: t.energy, domain: t.domain }));

  console.log('AFTER UPDATE:', tasksAfterCount, 'tasks assigned to today');
  console.log('Task details:', tasksAfter);

  // Count blocks created in dailyPlanTasks
  const blocksCreated = await db.dailyPlanTasks
    .where('planDate')
    .equals(todayString)
    .and(block => block.blockType === 'task')
    .count();

  console.log('Daily plan blocks created:', blocksCreated);

  if (tasksAfterCount < tasksBeforeCount) {
    console.error('❌ REFLOW_GUARD TRIPPED!');
    console.error(`Lost ${tasksBeforeCount - tasksAfterCount} tasks during update!`);

    // Find which tasks were lost
    const afterIds = new Set(tasksAfter.map(t => t.id));
    const lostTasks = tasksBefore.filter(t => !afterIds.has(t.id));
    console.error('Lost tasks:', lostTasks);

    // ABORT: Restore assignedDate for lost tasks
    for (const task of lostTasks) {
      if (task.id) {
        console.log(`Restoring assignedDate for task: ${task.title}`);
        await db.tasks.update(task.id, { assignedDate: todayString });
      }
    }

    console.error('State restored. Update aborted.');
  } else {
    console.log('✓ All tasks preserved during update');
  }

  console.log('=== END UPDATE SCHEDULE ===\n');

  return result;
};

/**
 * Log an interruption and reflow the rest of the day
 * This properly inserts the interruption block, subtracts from available time,
 * and pushes tasks later in the day or defers them if no time remains
 */
export const logInterruption = async (
  durationMinutes: number,
  domain: Domain,
  description?: string
): Promise<ScheduleResult> => {
  const now = new Date();
  const todayString = now.toISOString().split('T')[0];

  // SAFETY CHECK: Count tasks before interruption AND capture their IDs/titles
  const tasksBeforeInterrupt = await db.tasks
    .where('assignedDate')
    .equals(todayString)
    .and(task => task.status === 'todo' || task.status === 'doing')
    .toArray();

  const tasksBeforeCount = tasksBeforeInterrupt.length;
  const tasksBefore = tasksBeforeInterrupt.map(t => ({ id: t.id, title: t.title }));

  console.log('=== LOG INTERRUPTION ===');
  console.log('BEFORE INTERRUPTION:', tasksBeforeCount, 'tasks assigned to today');
  console.log('Task details:', tasksBefore);

  // Round current time to 5-minute grid
  const interruptionStart = roundUpToNext5Min(now);

  // Create interruption block from rounded time for the specified duration
  const interruptionEndTime = new Date(interruptionStart.getTime() + durationMinutes * 60 * 1000);

  // Insert the interruption block at its actual timespan
  await db.dailyPlanTasks.add({
    id: generateId(),
    taskId: null,
    planDate: todayString,
    scheduledStartTime: interruptionStart.toISOString(),
    scheduledEndTime: interruptionEndTime.toISOString(),
    completed: true,
    order: -1,
    blockType: 'interruption',
    interruptionDomain: domain,
    sliceDuration: durationMinutes,
    isDraft: false
  });

  // Remove all unfinished blocks (keep only interruptions and completed)
  // NOTE: We do NOT remove tasks from db.tasks, only from dailyPlanTasks
  await db.dailyPlanTasks
    .where('planDate')
    .equals(todayString)
    .and(block => {
      if (block.isDraft) return true; // Delete drafts
      if (block.blockType === 'interruption') return false; // Keep all interruptions
      if (block.completed) return false; // Keep completed blocks
      // Delete ALL unfinished task blocks (they'll be rescheduled)
      return true;
    })
    .delete();

  // Rebuild from AFTER the interruption, rounded to next 5-min
  const restartTime = roundUpToNext5Min(interruptionEndTime);

  // Get user prefs to calculate remaining capacity
  const prefs = await db.userPrefs.get(1);
  if (!prefs) {
    throw new Error('User preferences not found');
  }

  // Calculate remaining time today
  const sleepTime = parseTimeToDate(prefs.defaultSleepTime, now);
  const remainingMinutesToday = Math.max(0, (sleepTime.getTime() - restartTime.getTime()) / (1000 * 60));

  console.log('CAPACITY CHECK: remainingMinutesToday =', remainingMinutesToday, 'minutes');
  console.log('Restarting schedule from:', restartTime.toISOString());
  console.log('Day ends at:', sleepTime.toISOString());

  // This will attempt to fit all remaining tasks after the interruption
  const result = await generateWakeDaySchedule(now, false, restartTime);

  // CRITICAL: Save the generated blocks to the database
  if (result.plannedTasks.length > 0) {
    await db.dailyPlanTasks.bulkAdd(result.plannedTasks);
    console.log(`Saved ${result.plannedTasks.length} blocks to database`);
  }

  // Check which tasks were successfully scheduled (have blocks in dailyPlanTasks)
  const scheduledBlocks = await db.dailyPlanTasks
    .where('planDate')
    .equals(todayString)
    .and(block => block.blockType === 'task' && block.taskId !== null && !block.completed)
    .toArray();

  const scheduledTodayIds = new Set<string>();
  scheduledBlocks.forEach(block => {
    if (block.taskId) scheduledTodayIds.add(block.taskId);
  });

  console.log('SCHEDULED_TODAY:', scheduledTodayIds.size, 'tasks', Array.from(scheduledTodayIds));

  // Now check which of the ORIGINAL tasks are still assigned to today vs need deferral
  const tasksStillAssignedToday = await db.tasks
    .where('assignedDate')
    .equals(todayString)
    .and(task => task.status === 'todo' || task.status === 'doing')
    .toArray();

  const stillAssignedIds = new Set(tasksStillAssignedToday.map(t => t.id!));

  // Identify tasks that need deferral: were assigned before, but neither scheduled nor still assigned
  const taskIdsBefore = new Set(tasksBefore.map(t => t.id));
  const tasksToDefer = Array.from(taskIdsBefore).filter(id =>
    !scheduledTodayIds.has(id) && !stillAssignedIds.has(id)
  );

  console.log('Tasks that need deferral:', tasksToDefer);

  // ONLY defer if day has actually ended AND there are unscheduled tasks
  if (tasksToDefer.length > 0 && remainingMinutesToday <= 5) {
    console.log(`Deferring ${tasksToDefer.length} tasks to tomorrow (day ended, ${remainingMinutesToday} min remaining)`);

    const tomorrow = new Date(now);
    tomorrow.setDate(tomorrow.getDate() + 1);
    const tomorrowString = tomorrow.toISOString().split('T')[0];

    for (const taskId of tasksToDefer) {
      await db.tasks.update(taskId, {
        assignedDate: tomorrowString
      });
    }

    console.log('DEFERRED_TOMORROW:', tasksToDefer.length, 'tasks', tasksToDefer);
  } else if (tasksToDefer.length > 0 && remainingMinutesToday > 5) {
    console.error(`❌ BUG: ${tasksToDefer.length} tasks lost despite ${remainingMinutesToday} min remaining!`);
    console.error('Lost task IDs:', tasksToDefer);
    // Restore them to today
    for (const taskId of tasksToDefer) {
      await db.tasks.update(taskId, {
        assignedDate: todayString
      });
    }
    console.log('DEFERRED_TOMORROW: 0 tasks []');
  } else {
    console.log('DEFERRED_TOMORROW: 0 tasks []');
  }

  // Verify scheduled and deferred are disjoint
  const deferredSet = new Set(tasksToDefer);
  const intersection = Array.from(scheduledTodayIds).filter(id => deferredSet.has(id));
  if (intersection.length > 0) {
    console.error('❌ CRITICAL BUG: Task(s) appear in BOTH scheduled and deferred!', intersection);
  } else {
    console.log('✓ Scheduled and deferred sets are disjoint');
  }

  // Final count
  const finalTasksToday = await db.tasks
    .where('assignedDate')
    .equals(todayString)
    .and(task => task.status === 'todo' || task.status === 'doing')
    .count();

  console.log('AFTER INTERRUPTION:', finalTasksToday, 'tasks assigned to today');
  console.log('Total blocks returned:', result.plannedTasks.length, `(${result.plannedTasks.filter(p => p.blockType === 'task').length} tasks, ${result.plannedTasks.filter(p => p.blockType === 'free').length} free)`);

  if (scheduledTodayIds.size + tasksToDefer.length !== tasksBeforeCount) {
    console.error('❌ TASK COUNT MISMATCH!');
    console.error(`Before: ${tasksBeforeCount}, Scheduled: ${scheduledTodayIds.size}, Deferred: ${tasksToDefer.length}, Total: ${scheduledTodayIds.size + tasksToDefer.length}`);
  } else {
    console.log('✓ All tasks accounted for');
  }

  console.log('=== END LOG INTERRUPTION ===\n');

  return result;
};
