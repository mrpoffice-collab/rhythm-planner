import { Task, Energy, db } from '../db/database';

interface ScoredTask extends Task {
  score: number;
}

export const scoreTask = (
  task: Task,
  currentEnergy: Energy,
  availableMinutes: number,
  lastDomain: string | null
): number => {
  // Urgency score (0-1)
  let urgency = 0;
  if (task.deadline) {
    const daysUntilDeadline = (new Date(task.deadline).getTime() - Date.now()) / (1000 * 60 * 60 * 24);
    if (daysUntilDeadline < 1) urgency = 1.0;
    else if (daysUntilDeadline < 3) urgency = 0.8;
    else if (daysUntilDeadline < 7) urgency = 0.6;
    else urgency = 0.3;
  } else {
    urgency = 0.2; // Default for tasks without deadlines
  }

  // Value score based on priority (0-1)
  const value = task.priority === 'High' ? 1.0 : task.priority === 'Medium' ? 0.6 : 0.3;

  // Energy fit score (0-1)
  let energyFit = 0;
  const energyLevels: Record<Energy, number> = { Low: 1, Medium: 2, High: 3 };
  const taskEnergyLevel = energyLevels[task.energy];
  const currentEnergyLevel = energyLevels[currentEnergy];

  if (taskEnergyLevel === currentEnergyLevel) energyFit = 1.0;
  else if (taskEnergyLevel < currentEnergyLevel) energyFit = 0.7; // Can do lower energy tasks
  else energyFit = 0.3; // Harder to do high energy tasks when low

  // Time fit score (0-1)
  const timeFit = task.estimateMins <= availableMinutes ? 1.0 : availableMinutes / task.estimateMins;

  // Dread penalty (reduces score)
  const dreadPenalty = task.dread * 0.1; // Each skip reduces score by 0.1

  // Variety bonus - prefer different domain than last task
  const varietyBonus = lastDomain && task.domain !== lastDomain ? 0.15 : 0;

  // Calculate final score using the spec formula
  const score =
    0.35 * urgency +
    0.30 * value +
    0.20 * energyFit +
    0.15 * timeFit -
    dreadPenalty +
    varietyBonus;

  return Math.max(0, Math.min(1, score)); // Clamp between 0 and 1
};

export const getRecommendedTasks = async (
  currentEnergy: Energy,
  availableMinutes: number,
  count: number = 3,
  excludeTaskId?: string
): Promise<Task[]> => {
  // Get all active tasks that aren't snoozed
  const now = new Date().toISOString();
  const allTasks = await db.tasks
    .where('status')
    .equals('todo')
    .filter(task => {
      if (excludeTaskId && task.id === excludeTaskId) return false;
      if (task.snoozedUntil && task.snoozedUntil > now) return false;
      return true;
    })
    .toArray();

  // Get last completed session to determine last domain
  const lastSession = await db.sessions
    .where('completed')
    .equals(true)
    .reverse()
    .first();

  let lastDomain: string | null = null;
  if (lastSession) {
    const lastTask = await db.tasks.get(lastSession.taskId);
    lastDomain = lastTask?.domain || null;
  }

  // Score all tasks
  const scoredTasks: ScoredTask[] = allTasks.map(task => ({
    ...task,
    score: scoreTask(task, currentEnergy, availableMinutes, lastDomain),
  }));

  // Sort by score (highest first) and return top N
  return scoredTasks
    .sort((a, b) => b.score - a.score)
    .slice(0, count);
};

export const getMicroTask = async (): Promise<Task | null> => {
  // Get a 5-minute or less task for fallback
  const microTasks = await db.tasks
    .where('status')
    .equals('todo')
    .filter(task => task.estimateMins <= 5)
    .toArray();

  if (microTasks.length === 0) return null;

  // Return random micro task
  return microTasks[Math.floor(Math.random() * microTasks.length)];
};

export const getTasksByDomain = async (domain: string): Promise<Task[]> => {
  return await db.tasks
    .where('domain')
    .equals(domain as any)
    .and(task => task.status === 'todo')
    .toArray();
};

export const calculateWeeklyMinutes = async (domain?: string): Promise<number> => {
  const oneWeekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

  let sessions = await db.sessions
    .where('startTime')
    .above(oneWeekAgo)
    .and(session => session.completed === true)
    .toArray();

  if (domain) {
    // Filter by domain
    const domainTaskIds = new Set(
      (await getTasksByDomain(domain)).map(task => task.id!)
    );
    sessions = sessions.filter(session => domainTaskIds.has(session.taskId));
  }

  return sessions.reduce((total, session) => total + session.earnedMins, 0);
};

export const getTodayMinutes = async (): Promise<number> => {
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);

  const sessions = await db.sessions
    .where('startTime')
    .above(todayStart.toISOString())
    .and(session => session.completed === true)
    .toArray();

  return sessions.reduce((total, session) => total + session.earnedMins, 0);
};
