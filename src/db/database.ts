import Dexie, { Table } from 'dexie';

// Types matching the spec
export type Domain = 'Work' | 'SideHustle' | 'Chore' | 'Errand' | 'Personal' | 'Creative' | 'Unplanned';
export type Priority = 'High' | 'Medium' | 'Low';
export type Energy = 'Low' | 'Medium' | 'High';
export type Recurrence = 'Once' | 'Daily' | 'Weekly' | 'Monthly' | 'CustomDays';
export type TaskStatus = 'todo' | 'doing' | 'done';
export type TaskType = 'Fixed' | 'Flexible' | 'Recurring';
export type FreeTimeType = 'Recharge' | 'Buffer' | 'Leisure';
export type BioRhythmProfile = 'Morning Peak' | 'Afternoon Peak' | 'Evening Peak' | 'Custom';
export type SoundPack = 'Chime' | 'Bell' | 'Pop';

export interface BioRhythmSegment {
  startHour: number; // 0-23
  endHour: number; // 0-23
  energy: Energy;
}

export interface Task {
  id?: string;
  title: string;
  domain: Domain;
  priority: Priority;
  energy: Energy;
  estimateMins: number;
  deadline: string | null; // Legacy field, use dueDate instead
  dueDate: string | null; // ISO date string - when task must be done (for Once tasks)
  startDate: string | null; // ISO date string - earliest date task can be scheduled
  recurrence: Recurrence;
  daysOfWeek: number[]; // For CustomDays: 1=Mon, 2=Tue, ..., 7=Sun
  weeklyDay: number | null; // For Weekly: which day of week (1=Mon, ..., 7=Sun)
  status: TaskStatus;
  dread: number;
  snoozedUntil: string | null;
  notes: string;
  subtasks: string[];
  createdAt: string;
  assignedDate: string | null; // Date when task is scheduled for daily plan (YYYY-MM-DD)
  lastCompletedAt: string | null; // ISO datetime when last completed
  archived: boolean; // True if task is archived (completed one-time tasks)
  completedAt: string | null; // ISO datetime when task was archived
  // Project chunking fields
  isProject: boolean; // True if this is a long task that should be auto-chunked
  totalEstimateMins: number; // Original total time estimate for projects
  remainingMins: number; // Time remaining after completed slices
  preferredSliceSize: number; // Preferred slice size: 15, 30, or 60 minutes
  // Wake-day scheduling fields
  taskType: TaskType; // Fixed, Flexible, or Recurring
  fixedStartTime: string | null; // ISO datetime for Fixed tasks (exact time)
  eligibleStartTime: string | null; // Time of day (HH:MM) - earliest this can start
  mustFinishByTime: string | null; // Time of day (HH:MM) - latest this must end
  // Timer chunk preference (remembered per-task template)
  chunkPreference: { focusMinutes: number; breakMinutes: number; continuous: boolean } | null;
}

export interface BlockType {
  id?: string;
  name: string;
  duration: number; // minutes
  breakAfter: number; // minutes
  energyRange: Energy[];
  colorToken: string;
  domain: Domain;
}

export interface Session {
  id?: string;
  taskId: string;
  blockType: string;
  startTime: string;
  endTime: string | null;
  energyNow: Energy;
  earnedMins: number;
  completed: boolean;
  skipped: boolean;
}

export interface UserPrefs {
  id?: number;
  maxWorkHoursPerWeek: number;
  maxWorkBlocksPerDay: number;
  maxWorkHoursPerDay: number; // Daily cap for Work domain
  maxSideHustleHoursPerDay: number; // Daily cap for SideHustle domain
  maxSideHustleHoursPerWeek: number; // Weekly cap for SideHustle domain
  protectedTimes: string[];
  domainColors: Record<Domain, string>;
  permissionRules: {
    softCap: boolean;
    hardCap: boolean;
    recoveryMode: boolean;
  };
  // Wake-day model fields
  defaultWakeTime: string; // e.g., "06:00" - typical wake time
  defaultSleepTime: string; // e.g., "22:00" - typical sleep time
  actualWakeTimeToday: string | null; // ISO datetime when user started day (null if not set)
  freeTimePreference: FreeTimeType; // Default type for free blocks
  inTownDays: number[]; // Days when user is in town for errands (1=Mon, 7=Sun)
  currentEnergy: Energy; // User's current energy level for task filtering
  archiveRetentionDays: number; // How many days to keep archived tasks (0=delete immediately, -1=forever)
  // Bio-rhythm fields
  bioRhythmProfile: BioRhythmProfile; // Selected profile preset
  customBioRhythmSegments: BioRhythmSegment[]; // Used when profile is 'Custom'
  // Timer audio settings
  timerSoundsEnabled: boolean; // Whether timer sounds are enabled
  timerVolume: number; // Volume 0-100
  timerSoundPack: SoundPack; // Which sound pack to use
  // Legacy fields (kept for migration compatibility)
  dailyPlanStartTime: string;
  dailyPlanEndTime: string;
  maxFocusBlock: number; // DEPRECATED - chunks chosen at timer start only
  breakDuration: number; // DEPRECATED - chunks chosen at timer start only
}

export interface DailyPlanTask {
  id?: string;
  taskId: string | null; // null for Free/Rest/Interruption blocks
  planDate: string; // ISO date string (YYYY-MM-DD)
  scheduledStartTime: string; // ISO datetime
  scheduledEndTime: string; // ISO datetime
  completed: boolean;
  order: number; // Order in the day's schedule
  blockType: 'task' | 'free' | 'rest' | 'interruption'; // Type of block
  freeType?: FreeTimeType; // For free blocks: Recharge, Buffer, or Leisure
  interruptionDomain?: Domain; // For interruption blocks: which domain consumed the time
  sliceNumber?: number; // For project slices: which slice this is (1, 2, 3, etc.)
  sliceDuration?: number; // For project slices: duration of this specific slice
  isDraft?: boolean; // True if this is a tomorrow preview (not committed)
}

// Dexie database class
export class RhythmPlannerDB extends Dexie {
  tasks!: Table<Task, string>;
  blockTypes!: Table<BlockType, string>;
  sessions!: Table<Session, string>;
  userPrefs!: Table<UserPrefs, number>;
  dailyPlanTasks!: Table<DailyPlanTask, string>;

  constructor() {
    super('RhythmPlannerDB');

    this.version(1).stores({
      tasks: 'id, domain, status, priority, deadline, recurrence, snoozedUntil',
      blockTypes: 'id, domain, duration',
      sessions: 'id, taskId, startTime, completed',
      userPrefs: 'id'
    });

    // Version 2: Add assignedDate to tasks and dailyPlanTasks table
    this.version(2).stores({
      tasks: 'id, domain, status, priority, deadline, recurrence, snoozedUntil, assignedDate',
      blockTypes: 'id, domain, duration',
      sessions: 'id, taskId, startTime, completed',
      userPrefs: 'id',
      dailyPlanTasks: 'id, taskId, planDate, order'
    }).upgrade(async (trans) => {
      // Add default values for new fields in existing records
      const tasks = await trans.table('tasks').toArray();
      for (const task of tasks) {
        await trans.table('tasks').update(task.id!, { assignedDate: null });
      }

      const prefs = await trans.table('userPrefs').get(1);
      if (prefs) {
        await trans.table('userPrefs').update(1, {
          dailyPlanStartTime: '09:00',
          dailyPlanEndTime: '17:00'
        });
      }
    });

    // Version 3: Add recurrence fields (startDate, dueDate, daysOfWeek, weeklyDay, lastCompletedAt)
    this.version(3).stores({
      tasks: 'id, domain, status, priority, deadline, dueDate, startDate, recurrence, snoozedUntil, assignedDate, lastCompletedAt',
      blockTypes: 'id, domain, duration',
      sessions: 'id, taskId, startTime, completed',
      userPrefs: 'id',
      dailyPlanTasks: 'id, taskId, planDate, order'
    }).upgrade(async (trans) => {
      const tasks = await trans.table('tasks').toArray();
      for (const task of tasks) {
        await trans.table('tasks').update(task.id!, {
          dueDate: task.deadline || null,
          startDate: null,
          daysOfWeek: [],
          weeklyDay: null,
          lastCompletedAt: null
        });
      }
    });

    // Version 4: Add project chunking and domain caps
    this.version(4).stores({
      tasks: 'id, domain, status, priority, deadline, dueDate, startDate, recurrence, snoozedUntil, assignedDate, lastCompletedAt, isProject',
      blockTypes: 'id, domain, duration',
      sessions: 'id, taskId, startTime, completed',
      userPrefs: 'id',
      dailyPlanTasks: 'id, taskId, planDate, order, blockType'
    }).upgrade(async (trans) => {
      const tasks = await trans.table('tasks').toArray();
      for (const task of tasks) {
        await trans.table('tasks').update(task.id!, {
          isProject: false,
          totalEstimateMins: task.estimateMins || 0,
          remainingMins: task.estimateMins || 0,
          preferredSliceSize: 30
        });
      }

      const prefs = await trans.table('userPrefs').get(1);
      if (prefs) {
        await trans.table('userPrefs').update(1, {
          maxWorkHoursPerDay: 4,
          maxSideHustleHoursPerDay: 2,
          maxSideHustleHoursPerWeek: 10,
          inTownDays: [1, 2, 3, 4, 5] // Default: weekdays
        });
      }

      const dailyPlanTasks = await trans.table('dailyPlanTasks').toArray();
      for (const planTask of dailyPlanTasks) {
        await trans.table('dailyPlanTasks').update(planTask.id!, {
          blockType: 'task',
          sliceNumber: undefined,
          sliceDuration: undefined
        });
      }
    });

    // Version 5: Add wake-day model and task type system
    this.version(5).stores({
      tasks: 'id, domain, status, priority, deadline, dueDate, startDate, recurrence, snoozedUntil, assignedDate, lastCompletedAt, isProject, taskType',
      blockTypes: 'id, domain, duration',
      sessions: 'id, taskId, startTime, completed',
      userPrefs: 'id',
      dailyPlanTasks: 'id, taskId, planDate, order, blockType, isDraft'
    }).upgrade(async (trans) => {
      // Update tasks with new wake-day fields
      const tasks = await trans.table('tasks').toArray();
      for (const task of tasks) {
        // Infer task type from recurrence
        let taskType: TaskType = 'Flexible';
        if (task.recurrence === 'Once' && task.dueDate) {
          taskType = 'Flexible'; // Once tasks are flexible by default
        } else if (task.recurrence !== 'Once') {
          taskType = 'Recurring';
        }

        await trans.table('tasks').update(task.id!, {
          taskType,
          fixedStartTime: null,
          eligibleStartTime: null,
          mustFinishByTime: null
        });
      }

      // Update userPrefs with wake-day fields
      const prefs = await trans.table('userPrefs').get(1);
      if (prefs) {
        await trans.table('userPrefs').update(1, {
          defaultWakeTime: prefs.dailyPlanStartTime || '06:00',
          defaultSleepTime: prefs.dailyPlanEndTime || '22:00',
          actualWakeTimeToday: null,
          freeTimePreference: 'Recharge' as FreeTimeType
        });
      }

      // Update dailyPlanTasks with new fields
      const dailyPlanTasks = await trans.table('dailyPlanTasks').toArray();
      for (const planTask of dailyPlanTasks) {
        await trans.table('dailyPlanTasks').update(planTask.id!, {
          freeType: planTask.blockType === 'free' || planTask.blockType === 'rest' ? 'Recharge' as FreeTimeType : undefined,
          interruptionDomain: undefined,
          isDraft: false
        });
      }
    });

    // Version 6: Add currentEnergy to UserPrefs for energy-based filtering
    this.version(6).stores({
      tasks: 'id, domain, status, priority, deadline, dueDate, startDate, recurrence, snoozedUntil, assignedDate, lastCompletedAt, isProject, taskType',
      blockTypes: 'id, domain, duration',
      sessions: 'id, taskId, startTime, completed',
      userPrefs: 'id',
      dailyPlanTasks: 'id, taskId, planDate, order, blockType, isDraft'
    }).upgrade(async (trans) => {
      // Add currentEnergy field with default 'Medium'
      const prefs = await trans.table('userPrefs').get(1);
      if (prefs) {
        await trans.table('userPrefs').update(1, {
          currentEnergy: 'Medium' as Energy
        });
      }
    });

    // Version 7: Add archive fields to Task and archiveRetentionDays to UserPrefs
    this.version(7).stores({
      tasks: 'id, domain, status, priority, deadline, dueDate, startDate, recurrence, snoozedUntil, assignedDate, lastCompletedAt, isProject, taskType, archived',
      blockTypes: 'id, domain, duration',
      sessions: 'id, taskId, startTime, completed',
      userPrefs: 'id',
      dailyPlanTasks: 'id, taskId, planDate, order, blockType, isDraft'
    }).upgrade(async (trans) => {
      // Add archive fields to all tasks
      const tasks = await trans.table('tasks').toArray();
      for (const task of tasks) {
        await trans.table('tasks').update(task.id!, {
          archived: false,
          completedAt: null
        });
      }

      // Add archiveRetentionDays to userPrefs
      const prefs = await trans.table('userPrefs').get(1);
      if (prefs) {
        await trans.table('userPrefs').update(1, {
          archiveRetentionDays: 0 // Default: delete immediately
        });
      }
    });

    // Version 8: Add bio-rhythm and long-task break settings
    this.version(8).stores({
      tasks: 'id, domain, status, priority, deadline, dueDate, startDate, recurrence, snoozedUntil, assignedDate, lastCompletedAt, isProject, taskType, archived',
      blockTypes: 'id, domain, duration',
      sessions: 'id, taskId, startTime, completed',
      userPrefs: 'id',
      dailyPlanTasks: 'id, taskId, planDate, order, blockType, isDraft'
    }).upgrade(async (trans) => {
      const prefs = await trans.table('userPrefs').get(1);
      if (prefs) {
        await trans.table('userPrefs').update(1, {
          bioRhythmProfile: 'Morning Peak' as BioRhythmProfile,
          customBioRhythmSegments: [],
          maxFocusBlock: 60,
          breakDuration: 15
        });
      }
    });

    // Version 9: Add timer audio settings
    this.version(9).stores({
      tasks: 'id, domain, status, priority, deadline, dueDate, startDate, recurrence, snoozedUntil, assignedDate, lastCompletedAt, isProject, taskType, archived',
      blockTypes: 'id, domain, duration',
      sessions: 'id, taskId, startTime, completed',
      userPrefs: 'id',
      dailyPlanTasks: 'id, taskId, planDate, order, blockType, isDraft'
    }).upgrade(async (trans) => {
      const prefs = await trans.table('userPrefs').get(1);
      if (prefs) {
        await trans.table('userPrefs').update(1, {
          timerSoundsEnabled: true,
          timerVolume: 70,
          timerSoundPack: 'Chime' as SoundPack
        });
      }
    });

    // Version 10: Add per-task chunk preferences
    this.version(10).stores({
      tasks: 'id, domain, status, priority, deadline, dueDate, startDate, recurrence, snoozedUntil, assignedDate, lastCompletedAt, isProject, taskType, archived',
      blockTypes: 'id, domain, duration',
      sessions: 'id, taskId, startTime, completed',
      userPrefs: 'id',
      dailyPlanTasks: 'id, taskId, planDate, order, blockType, isDraft'
    }).upgrade(async (trans) => {
      const tasks = await trans.table('tasks').toArray();
      for (const task of tasks) {
        await trans.table('tasks').update(task.id!, {
          chunkPreference: null
        });
      }
    });
  }
}

export const db = new RhythmPlannerDB();

// Initialize default block types
export const initializeDefaultBlockTypes = async () => {
  const count = await db.blockTypes.count();
  if (count === 0) {
    await db.blockTypes.bulkAdd([
      {
        id: 'deep-60',
        name: 'Deep 60',
        duration: 60,
        breakAfter: 15,
        energyRange: ['High'],
        colorToken: '#3A5BA0',
        domain: 'Work'
      },
      {
        id: 'routine-30',
        name: 'Routine 30',
        duration: 30,
        breakAfter: 5,
        energyRange: ['Medium', 'High'],
        colorToken: '#8FAE8F',
        domain: 'Chore'
      },
      {
        id: 'light-15',
        name: 'Light 15',
        duration: 15,
        breakAfter: 5,
        energyRange: ['Low', 'Medium'],
        colorToken: '#D58B7C',
        domain: 'Personal'
      },
      {
        id: 'errand-30',
        name: 'Errand',
        duration: 30,
        breakAfter: 0,
        energyRange: ['Low', 'Medium', 'High'],
        colorToken: '#D6A656',
        domain: 'Errand'
      },
      {
        id: 'creative-45',
        name: 'Creative 45',
        duration: 45,
        breakAfter: 10,
        energyRange: ['Medium', 'High'],
        colorToken: '#A88FB0',
        domain: 'Creative'
      }
    ]);
  }
};

// Initialize default user preferences
export const initializeDefaultPrefs = async () => {
  const count = await db.userPrefs.count();
  if (count === 0) {
    await db.userPrefs.add({
      id: 1,
      maxWorkHoursPerWeek: 24,
      maxWorkBlocksPerDay: 4,
      maxWorkHoursPerDay: 4,
      maxSideHustleHoursPerDay: 2,
      maxSideHustleHoursPerWeek: 10,
      protectedTimes: ['evenings', 'weekends'],
      domainColors: {
        Work: '#3A5BA0',
        SideHustle: '#7B68EE',
        Chore: '#8FAE8F',
        Errand: '#D6A656',
        Personal: '#D58B7C',
        Creative: '#A88FB0',
        Unplanned: '#9E9E9E'
      },
      permissionRules: {
        softCap: true,
        hardCap: false,
        recoveryMode: true
      },
      dailyPlanStartTime: '09:00',
      dailyPlanEndTime: '22:00',
      defaultWakeTime: '06:00',
      defaultSleepTime: '22:00',
      actualWakeTimeToday: null,
      freeTimePreference: 'Recharge' as FreeTimeType,
      inTownDays: [1, 2, 3, 4, 5], // Weekdays
      currentEnergy: 'Medium' as Energy,
      archiveRetentionDays: 0, // Default: delete immediately
      bioRhythmProfile: 'Morning Peak' as BioRhythmProfile,
      customBioRhythmSegments: [],
      maxFocusBlock: 60,
      breakDuration: 15,
      timerSoundsEnabled: true,
      timerVolume: 70,
      timerSoundPack: 'Chime' as SoundPack
    });
  }
};

// Clean up archived tasks based on retention policy
export const cleanupArchivedTasks = async () => {
  const prefs = await db.userPrefs.get(1);
  if (!prefs) return;

  const retention = prefs.archiveRetentionDays;
  if (retention === -1) return; // Forever - don't delete

  const now = new Date();
  const cutoffDate = new Date(now.getTime() - retention * 24 * 60 * 60 * 1000);

  // Delete archived tasks older than retention period
  await db.tasks
    .where('archived')
    .equals(1)
    .and(task => {
      if (!task.completedAt) return false;
      const completedDate = new Date(task.completedAt);
      return completedDate < cutoffDate;
    })
    .delete();
};

// Initialize database with defaults
export const initializeDatabase = async () => {
  await initializeDefaultBlockTypes();
  await initializeDefaultPrefs();
};
