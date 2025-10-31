import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Clock, Play, Check, X, Calendar, Sun, RefreshCw, AlertCircle, List, LayoutGrid } from 'lucide-react';
import { Task, DailyPlanTask, db, Domain, FreeTimeType } from '../db/database';
import { startMyDay, updateScheduleNow, logInterruption, generateWakeDaySchedule } from '../utils/wakeDayScheduler';
import { getDomainColor } from '../utils/domainColors';

interface TodayViewProps {
  onStartTask: (task: Task, blockDuration: number) => void;
}

interface PlannedTaskWithDetails {
  plannedTask: DailyPlanTask;
  task: Task | null; // null for Free/Rest blocks
}

type SortMode = 'time' | 'domain';

export const TodayView = ({ onStartTask }: TodayViewProps) => {
  const [plannedTasks, setPlannedTasks] = useState<PlannedTaskWithDetails[]>([]);
  const [tomorrowTasks, setTomorrowTasks] = useState<PlannedTaskWithDetails[]>([]);
  const [loading, setLoading] = useState(true);
  const [dayStarted, setDayStarted] = useState(false);
  const [showInterruptionModal, setShowInterruptionModal] = useState(false);
  const [sortMode, setSortMode] = useState<SortMode>('time');
  const [tomorrowSortMode, setTomorrowSortMode] = useState<SortMode>('time');
  const [interruptionData, setInterruptionData] = useState({
    duration: 30,
    domain: 'Unplanned' as Domain,
    description: ''
  });

  useEffect(() => {
    loadTodaysPlan();
    checkIfDayStarted();
  }, []);

  const checkIfDayStarted = async () => {
    const prefs = await db.userPrefs.get(1);
    if (prefs && prefs.actualWakeTimeToday) {
      const wakeTime = new Date(prefs.actualWakeTimeToday);
      const today = new Date();
      const isSameDay = wakeTime.toDateString() === today.toDateString();
      setDayStarted(isSameDay);
    }
  };

  const loadTodaysPlan = async () => {
    setLoading(true);

    // Load today's plan
    const today = new Date();
    const todayString = today.toISOString().split('T')[0];

    const todayPlanned = await db.dailyPlanTasks
      .where('planDate')
      .equals(todayString)
      .and(task => !task.isDraft)
      .sortBy('order');

    // Fetch task details
    const todayWithDetails = await Promise.all(
      todayPlanned.map(async (plannedTask) => {
        if (plannedTask.taskId === null) {
          return { plannedTask, task: null };
        }
        const task = await db.tasks.get(plannedTask.taskId);
        return { plannedTask, task };
      })
    );

    setPlannedTasks(todayWithDetails.filter(item => item.task !== undefined) as PlannedTaskWithDetails[]);

    // Load tomorrow's draft
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    const tomorrowString = tomorrow.toISOString().split('T')[0];

    const tomorrowPlanned = await db.dailyPlanTasks
      .where('planDate')
      .equals(tomorrowString)
      .and(task => task.isDraft === true)
      .sortBy('order');

    const tomorrowWithDetails = await Promise.all(
      tomorrowPlanned.map(async (plannedTask) => {
        if (plannedTask.taskId === null) {
          return { plannedTask, task: null };
        }
        const task = await db.tasks.get(plannedTask.taskId);
        return { plannedTask, task };
      })
    );

    setTomorrowTasks(tomorrowWithDetails.filter(item => item.task !== undefined) as PlannedTaskWithDetails[]);
    setLoading(false);
  };

  const handleStartMyDay = async () => {
    setLoading(true);
    try {
      await startMyDay();
      await loadTodaysPlan();
      setDayStarted(true);
    } catch (error) {
      console.error('Error starting day:', error);
      alert('Failed to start day. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateSchedule = async () => {
    setLoading(true);
    try {
      await updateScheduleNow();
      await loadTodaysPlan();
    } catch (error) {
      console.error('Error updating schedule:', error);
      alert('Failed to update schedule. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleLogInterruption = async () => {
    setLoading(true);
    try {
      await logInterruption(interruptionData.duration, interruptionData.domain, interruptionData.description);
      await loadTodaysPlan();
      setShowInterruptionModal(false);
      setInterruptionData({ duration: 30, domain: 'Unplanned', description: '' });
    } catch (error) {
      console.error('Error logging interruption:', error);
      alert('Failed to log interruption. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleGenerateTomorrowPreview = async () => {
    setLoading(true);
    try {
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);

      // Clear existing tomorrow draft
      const tomorrowString = tomorrow.toISOString().split('T')[0];
      await db.dailyPlanTasks.where('planDate').equals(tomorrowString).and(task => task.isDraft === true).delete();

      // Generate new draft
      const result = await generateWakeDaySchedule(tomorrow, true);

      // Save draft to database
      if (result.plannedTasks.length > 0) {
        await db.dailyPlanTasks.bulkAdd(result.plannedTasks);
      }

      await loadTodaysPlan();
    } catch (error) {
      console.error('Error generating tomorrow preview:', error);
      alert('Failed to generate tomorrow preview. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleComplete = async (plannedTaskId: string) => {
    // Mark the block as completed
    await db.dailyPlanTasks.update(plannedTaskId, { completed: true });

    // Get the task to update its status and clear assignment
    const plannedTask = await db.dailyPlanTasks.get(plannedTaskId);
    if (plannedTask && plannedTask.taskId) {
      const task = await db.tasks.get(plannedTask.taskId);
      if (task) {
        if (task.recurrence === 'Once') {
          // Non-recurring task: archive it (or delete if retention=0)
          const now = new Date().toISOString();
          await db.tasks.update(plannedTask.taskId, {
            archived: true,
            completedAt: now,
            assignedDate: null,
            status: 'done'
          });

          // Run cleanup immediately to delete if retention is 0
          const prefs = await db.userPrefs.get(1);
          if (prefs && prefs.archiveRetentionDays === 0) {
            // Cascade delete with sessions and daily plans
            await db.transaction('rw', [db.tasks, db.sessions, db.dailyPlanTasks], async () => {
              await db.sessions.where('taskId').equals(plannedTask.taskId).delete();
              await db.dailyPlanTasks.where('taskId').equals(plannedTask.taskId).delete();
              await db.tasks.delete(plannedTask.taskId);
            });
          }
        } else {
          // Recurring task: update lastCompletedAt, clear assignment, stays in todo
          const { generateNextOccurrence } = await import('../utils/recurringTaskGenerator');
          await generateNextOccurrence(task);
          await db.tasks.update(plannedTask.taskId, {
            assignedDate: null
          });
        }
      }
    }

    // Trigger Update Schedule to reflow and reclaim the time slot
    await updateScheduleNow();
    await loadTodaysPlan();
  };

  const handleRemove = async (plannedTaskId: string) => {
    if (confirm('Remove this task from today\'s plan?')) {
      const plannedTask = await db.dailyPlanTasks.get(plannedTaskId);
      if (plannedTask && plannedTask.taskId) {
        await db.tasks.update(plannedTask.taskId, { assignedDate: null });
      }
      await db.dailyPlanTasks.delete(plannedTaskId);
      loadTodaysPlan();
    }
  };

  const formatTime = (isoString: string): string => {
    const date = new Date(isoString);
    return date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });
  };

  const getDuration = (start: string, end: string): number => {
    const startTime = new Date(start).getTime();
    const endTime = new Date(end).getTime();
    return Math.round((endTime - startTime) / (1000 * 60));
  };

  // Group tasks by domain (including Free/Rest/Interruption as pseudo-domains)
  const tasksByDomain = plannedTasks.reduce((acc, item) => {
    let domain: string;
    if (item.plannedTask.blockType === 'free') {
      domain = 'Available Time';
    } else if (item.plannedTask.blockType === 'rest') {
      domain = 'Rest';
    } else if (item.plannedTask.blockType === 'interruption') {
      domain = item.plannedTask.interruptionDomain || 'Unplanned';
    } else if (item.task) {
      domain = item.task.domain;
    } else {
      return acc; // Skip invalid entries
    }

    if (!acc[domain]) acc[domain] = [];
    acc[domain].push(item);
    return acc;
  }, {} as Record<string, PlannedTaskWithDetails[]>);

  const domains = Object.keys(tasksByDomain);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-gray-500">Loading today's plan...</p>
      </div>
    );
  }

  if (plannedTasks.length === 0) {
    return (
      <div className="space-y-6">
        <div className="text-center">
          <h1 className="text-4xl font-semibold text-gray-800 mb-2">Today's Schedule</h1>
          <p className="text-gray-600">Your daily plan appears here</p>
        </div>

        <div className="bg-white rounded-lg shadow p-12 text-center">
          <div className="text-6xl mb-4">📅</div>
          <h3 className="text-2xl font-semibold text-gray-800 mb-2">No Plan Yet</h3>
          <p className="text-gray-600 mb-6">
            Click "Plan My Day" on the Dashboard to automatically generate your daily schedule
          </p>
          <div className="text-sm text-gray-500">
            The planner will select tasks based on:
            <ul className="mt-2 space-y-1">
              <li>• Priority and deadlines</li>
              <li>• Available time for the day</li>
              <li>• Energy requirements</li>
              <li>• Domain variety</li>
            </ul>
          </div>
        </div>
      </div>
    );
  }

  // Calculate total time and completion
  const totalTasks = plannedTasks.length;
  const completedTasks = plannedTasks.filter(item => item.plannedTask.completed).length;
  const totalMinutes = plannedTasks.reduce((sum, item) => {
    return sum + getDuration(item.plannedTask.scheduledStartTime, item.plannedTask.scheduledEndTime);
  }, 0);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-4xl font-semibold text-gray-800 mb-2">Today's Wake Day</h1>
          <p className="text-gray-600">
            {completedTasks} of {totalTasks} blocks completed • {Math.round(totalMinutes / 60 * 10) / 10}h planned
          </p>
        </div>
        <div className="flex items-center gap-3">
          {/* Sort toggle */}
          <div className="flex bg-white rounded-lg shadow overflow-hidden">
            <button
              onClick={() => setSortMode('time')}
              className={`flex items-center gap-2 px-4 py-2 font-medium transition-all ${
                sortMode === 'time'
                  ? 'bg-gray-800 text-white'
                  : 'text-gray-600 hover:bg-gray-100'
              }`}
            >
              <List size={16} />
              Time
            </button>
            <button
              onClick={() => setSortMode('domain')}
              className={`flex items-center gap-2 px-4 py-2 font-medium transition-all ${
                sortMode === 'domain'
                  ? 'bg-gray-800 text-white'
                  : 'text-gray-600 hover:bg-gray-100'
              }`}
            >
              <LayoutGrid size={16} />
              Domain
            </button>
          </div>
          <div className="flex items-center gap-2 px-4 py-2 bg-white rounded-lg shadow">
            <Calendar size={20} className="text-gray-600" />
            <span className="font-medium text-gray-800">
              {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
            </span>
          </div>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="flex gap-3 flex-wrap">
        {!dayStarted && (
          <button
            onClick={handleStartMyDay}
            disabled={loading}
            className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-orange-500 to-amber-500 text-white rounded-lg font-semibold hover:from-orange-600 hover:to-amber-600 shadow-lg hover:shadow-xl transition-all disabled:opacity-50"
          >
            <Sun size={20} />
            Start My Day
          </button>
        )}
        <button
          onClick={handleUpdateSchedule}
          disabled={loading}
          className="flex items-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 shadow-md hover:shadow-lg transition-all disabled:opacity-50"
        >
          <RefreshCw size={20} />
          Update Schedule Now
        </button>
        <button
          onClick={() => setShowInterruptionModal(true)}
          disabled={loading}
          className="flex items-center gap-2 px-6 py-3 bg-purple-600 text-white rounded-lg font-semibold hover:bg-purple-700 shadow-md hover:shadow-lg transition-all disabled:opacity-50"
        >
          <AlertCircle size={20} />
          Log Interruption
        </button>
        <button
          onClick={handleGenerateTomorrowPreview}
          disabled={loading}
          className="flex items-center gap-2 px-6 py-3 bg-gray-600 text-white rounded-lg font-semibold hover:bg-gray-700 shadow-md hover:shadow-lg transition-all disabled:opacity-50"
        >
          <Calendar size={20} />
          Preview Tomorrow
        </button>
      </div>

      {/* Progress bar */}
      <div className="bg-white rounded-lg shadow p-6">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-medium text-gray-700">Daily Progress</span>
          <span className="text-sm font-medium text-gray-700">
            {Math.round((completedTasks / totalTasks) * 100)}%
          </span>
        </div>
        <div className="bg-gray-200 rounded-full h-3 overflow-hidden">
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: `${(completedTasks / totalTasks) * 100}%` }}
            className="h-full bg-gradient-to-r from-green-500 to-emerald-600 rounded-full"
            transition={{ duration: 0.5 }}
          />
        </div>
      </div>

      {/* Tasks - Time or Domain sorted */}
      {sortMode === 'time' ? (
        // Time mode: Single chronological list
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <div className="px-6 py-4 bg-gray-50 border-b border-gray-200">
            <h3 className="text-xl font-semibold text-gray-800">Chronological Timeline</h3>
          </div>
          <div className="divide-y divide-gray-100">
            {plannedTasks.map((item, index) => {
              const { plannedTask, task } = item;
              const duration = getDuration(plannedTask.scheduledStartTime, plannedTask.scheduledEndTime);

              // Free/Rest/Interruption block rendering
              if (plannedTask.blockType === 'free' || plannedTask.blockType === 'rest' || plannedTask.blockType === 'interruption') {
                const isFree = plannedTask.blockType === 'free';
                const isRest = plannedTask.blockType === 'rest';
                const isInterruption = plannedTask.blockType === 'interruption';

                return (
                  <motion.div
                    key={plannedTask.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.05 }}
                    className={`p-4 ${isInterruption ? 'bg-purple-50' : 'bg-gray-50'}`}
                  >
                    <div className="flex items-start gap-4">
                      <div className="flex-shrink-0 text-right" style={{ width: '120px' }}>
                        <div className="font-semibold text-gray-800">
                          {formatTime(plannedTask.scheduledStartTime)}
                        </div>
                        <div className="text-xs text-gray-500">{duration} min</div>
                      </div>
                      <div className="flex-1">
                        <h4 className="font-semibold text-gray-700 mb-1">
                          {isFree && '⏱️ Available Time'}
                          {isRest && '😴 Rest Time'}
                          {isInterruption && '⚠️ Interruption'}
                        </h4>
                        <p className="text-sm text-gray-500">
                          {isFree && 'Available time - use as needed'}
                          {isRest && 'Scheduled rest period'}
                          {isInterruption && `Time consumed by ${plannedTask.interruptionDomain || 'unplanned activity'}`}
                        </p>
                      </div>
                    </div>
                  </motion.div>
                );
              }

              // Regular task rendering
              if (!task) return null;

              const domainColor = getDomainColor(task.domain);

              return (
                <motion.div
                  key={plannedTask.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.05 }}
                  className={`p-4 ${plannedTask.completed ? 'bg-gray-50 opacity-75' : ''}`}
                  style={{ borderLeft: `4px solid ${domainColor}` }}
                >
                  <div className="flex items-start gap-4">
                    {/* Time */}
                    <div className="flex-shrink-0 text-right" style={{ width: '120px' }}>
                      <div className="font-semibold text-gray-800">
                        {formatTime(plannedTask.scheduledStartTime)}
                      </div>
                      <div className="text-xs text-gray-500">
                        {duration} min
                      </div>
                    </div>

                    {/* Task details */}
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span
                          className="inline-block px-2 py-1 rounded text-xs font-medium text-white"
                          style={{ backgroundColor: domainColor }}
                        >
                          {task.domain}
                        </span>
                      </div>
                      <h4 className={`font-semibold text-gray-800 mb-1 ${plannedTask.completed ? 'line-through' : ''}`}>
                        {task.title}
                        {task.isProject && plannedTask.sliceNumber && (
                          <span className="ml-2 text-xs text-gray-500">
                            (Slice {plannedTask.sliceNumber}/{Math.ceil(task.totalEstimateMins / task.preferredSliceSize)})
                          </span>
                        )}
                      </h4>
                      {task.isProject && (
                        <div className="mb-2">
                          <div className="flex items-center gap-2 text-xs text-gray-600">
                            <span>Project Progress:</span>
                            <div className="flex-1 max-w-xs bg-gray-200 rounded-full h-2">
                              <div
                                className="bg-blue-500 h-2 rounded-full"
                                style={{
                                  width: `${Math.round(((task.totalEstimateMins - task.remainingMins) / task.totalEstimateMins) * 100)}%`
                                }}
                              />
                            </div>
                            <span>{task.remainingMins}m left</span>
                          </div>
                        </div>
                      )}
                      {task.notes && (
                        <p className="text-sm text-gray-600 line-clamp-2">{task.notes}</p>
                      )}
                      <div className="flex items-center gap-3 mt-2">
                        <span className="text-xs text-gray-500 flex items-center gap-1">
                          <Clock size={12} />
                          {task.isProject ? `${duration}m slice` : `${task.estimateMins}m estimate`}
                        </span>
                        {task.priority === 'High' && (
                          <span className="text-xs text-red-500 font-semibold">High Priority</span>
                        )}
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex-shrink-0 flex items-center gap-2">
                      {!plannedTask.completed && (
                        <>
                          <button
                            onClick={() => onStartTask(task, duration)}
                            className="p-2 bg-gray-800 text-white rounded-lg hover:bg-gray-900 transition-all"
                            title="Start task"
                          >
                            <Play size={16} />
                          </button>
                          <button
                            onClick={() => handleComplete(plannedTask.id!)}
                            className="p-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-all"
                            title="Mark complete"
                          >
                            <Check size={16} />
                          </button>
                        </>
                      )}
                      <button
                        onClick={() => handleRemove(plannedTask.id!)}
                        className="p-2 bg-red-100 text-red-600 rounded-lg hover:bg-red-200 transition-all"
                        title="Remove from plan"
                      >
                        <X size={16} />
                      </button>
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </div>
        </div>
      ) : (
        // Domain mode: Grouped by domain
        <div className="space-y-6">
          {domains.map((domain) => {
            const domainTasks = tasksByDomain[domain];
            const domainColor = getDomainColor(domain);
            const domainCompleted = domainTasks.filter(item => item.plannedTask.completed).length;

            return (
              <div key={domain} className="bg-white rounded-lg shadow overflow-hidden">
                {/* Domain header */}
                <div
                  className="px-6 py-4 flex items-center justify-between"
                  style={{ backgroundColor: `${domainColor}15`, borderLeft: `4px solid ${domainColor}` }}
                >
                  <h3 className="text-xl font-semibold text-gray-800">{domain}</h3>
                  <span className="text-sm text-gray-600">
                    {domainCompleted} / {domainTasks.length} completed
                  </span>
                </div>

                {/* Tasks */}
                <div className="divide-y divide-gray-100">
                  {domainTasks.map((item, index) => {
                  const { plannedTask, task } = item;
                  const duration = getDuration(plannedTask.scheduledStartTime, plannedTask.scheduledEndTime);

                  // Free/Rest/Interruption block rendering
                  if (plannedTask.blockType === 'free' || plannedTask.blockType === 'rest' || plannedTask.blockType === 'interruption') {
                    const isFree = plannedTask.blockType === 'free';
                    const isRest = plannedTask.blockType === 'rest';
                    const isInterruption = plannedTask.blockType === 'interruption';

                    return (
                      <motion.div
                        key={plannedTask.id}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: index * 0.05 }}
                        className={`p-4 ${isInterruption ? 'bg-purple-50' : 'bg-gray-50'}`}
                      >
                        <div className="flex items-start gap-4">
                          <div className="flex-shrink-0 text-right" style={{ width: '120px' }}>
                            <div className="font-semibold text-gray-800">
                              {formatTime(plannedTask.scheduledStartTime)}
                            </div>
                            <div className="text-xs text-gray-500">{duration} min</div>
                          </div>
                          <div className="flex-1">
                            <h4 className="font-semibold text-gray-700 mb-1">
                              {isFree && '⏱️ Available Time'}
                              {isRest && '😴 Rest Time'}
                              {isInterruption && '⚠️ Interruption'}
                            </h4>
                            <p className="text-sm text-gray-500">
                              {isFree && 'Available time - use as needed'}
                              {isRest && 'Scheduled rest period'}
                              {isInterruption && `Time consumed by ${plannedTask.interruptionDomain || 'unplanned activity'}`}
                            </p>
                          </div>
                        </div>
                      </motion.div>
                    );
                  }

                  // Regular task rendering
                  if (!task) return null;

                  return (
                    <motion.div
                      key={plannedTask.id}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: index * 0.05 }}
                      className={`p-4 ${plannedTask.completed ? 'bg-gray-50 opacity-75' : ''}`}
                    >
                      <div className="flex items-start gap-4">
                        {/* Time */}
                        <div className="flex-shrink-0 text-right" style={{ width: '120px' }}>
                          <div className="font-semibold text-gray-800">
                            {formatTime(plannedTask.scheduledStartTime)}
                          </div>
                          <div className="text-xs text-gray-500">
                            {duration} min
                          </div>
                        </div>

                        {/* Task details */}
                        <div className="flex-1">
                          <h4 className={`font-semibold text-gray-800 mb-1 ${plannedTask.completed ? 'line-through' : ''}`}>
                            {task.title}
                            {task.isProject && plannedTask.sliceNumber && (
                              <span className="ml-2 text-xs text-gray-500">
                                (Slice {plannedTask.sliceNumber}/{Math.ceil(task.totalEstimateMins / task.preferredSliceSize)})
                              </span>
                            )}
                          </h4>
                          {task.isProject && (
                            <div className="mb-2">
                              <div className="flex items-center gap-2 text-xs text-gray-600">
                                <span>Project Progress:</span>
                                <div className="flex-1 max-w-xs bg-gray-200 rounded-full h-2">
                                  <div
                                    className="bg-blue-500 h-2 rounded-full"
                                    style={{
                                      width: `${Math.round(((task.totalEstimateMins - task.remainingMins) / task.totalEstimateMins) * 100)}%`
                                    }}
                                  />
                                </div>
                                <span>{task.remainingMins}m left</span>
                              </div>
                            </div>
                          )}
                          {task.notes && (
                            <p className="text-sm text-gray-600 line-clamp-2">{task.notes}</p>
                          )}
                          <div className="flex items-center gap-3 mt-2">
                            <span className="text-xs text-gray-500 flex items-center gap-1">
                              <Clock size={12} />
                              {task.isProject ? `${duration}m slice` : `${task.estimateMins}m estimate`}
                            </span>
                            {task.priority === 'High' && (
                              <span className="text-xs text-red-500 font-semibold">High Priority</span>
                            )}
                          </div>
                        </div>

                        {/* Actions */}
                        <div className="flex-shrink-0 flex items-center gap-2">
                          {!plannedTask.completed && (
                            <>
                              <button
                                onClick={() => onStartTask(task, duration)}
                                className="p-2 bg-gray-800 text-white rounded-lg hover:bg-gray-900 transition-all"
                                title="Start task"
                              >
                                <Play size={16} />
                              </button>
                              <button
                                onClick={() => handleComplete(plannedTask.id!)}
                                className="p-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-all"
                                title="Mark complete"
                              >
                                <Check size={16} />
                              </button>
                            </>
                          )}
                          <button
                            onClick={() => handleRemove(plannedTask.id!)}
                            className="p-2 bg-red-100 text-red-600 rounded-lg hover:bg-red-200 transition-all"
                            title="Remove from plan"
                          >
                            <X size={16} />
                          </button>
                        </div>
                      </div>
                    </motion.div>
                  );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Tomorrow Preview */}
      {tomorrowTasks.length > 0 && (
        <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-lg shadow p-6 border-2 border-blue-200">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-2xl font-semibold text-gray-800">Tomorrow's Draft Schedule</h2>
              <p className="text-sm text-gray-600 mt-1">
                This is a preview of tomorrow's schedule. It will be finalized when you start tomorrow.
              </p>
            </div>
            {/* Tomorrow Sort toggle */}
            <div className="flex bg-white rounded-lg shadow overflow-hidden">
              <button
                onClick={() => setTomorrowSortMode('time')}
                className={`flex items-center gap-2 px-4 py-2 font-medium transition-all ${
                  tomorrowSortMode === 'time'
                    ? 'bg-gray-800 text-white'
                    : 'text-gray-600 hover:bg-gray-100'
                }`}
              >
                <List size={16} />
                Time
              </button>
              <button
                onClick={() => setTomorrowSortMode('domain')}
                className={`flex items-center gap-2 px-4 py-2 font-medium transition-all ${
                  tomorrowSortMode === 'domain'
                    ? 'bg-gray-800 text-white'
                    : 'text-gray-600 hover:bg-gray-100'
                }`}
              >
                <LayoutGrid size={16} />
                Domain
              </button>
            </div>
          </div>

          {tomorrowSortMode === 'time' ? (
            // Time mode: chronological list
            <div className="space-y-2">
              {tomorrowTasks.map((item, index) => {
                const { plannedTask, task } = item;
                const duration = getDuration(plannedTask.scheduledStartTime, plannedTask.scheduledEndTime);

                if (plannedTask.blockType === 'free' || plannedTask.blockType === 'rest') {
                  return (
                    <div key={index} className="flex items-center gap-3 py-2 px-4 bg-white/60 rounded">
                      <span className="text-sm text-gray-600 w-24">{formatTime(plannedTask.scheduledStartTime)}</span>
                      <span className="text-sm text-gray-700">
                        {plannedTask.blockType === 'free' ? '⏱️ Available Time' : '😴 Rest Time'} ({duration}m)
                      </span>
                    </div>
                  );
                }

                if (!task) return null;
                const domainColor = getDomainColor(task.domain);

                return (
                  <div key={index} className="flex items-center gap-3 py-2 px-4 bg-white/60 rounded border-l-4" style={{ borderLeftColor: domainColor }}>
                    <span className="text-sm text-gray-600 w-24">{formatTime(plannedTask.scheduledStartTime)}</span>
                    <span
                      className="inline-block px-2 py-1 rounded text-xs font-medium text-white"
                      style={{ backgroundColor: domainColor }}
                    >
                      {task.domain}
                    </span>
                    <span className="text-sm text-gray-800 font-medium flex-1">{task.title}</span>
                    <span className="text-xs text-gray-500">{duration}m</span>
                  </div>
                );
              })}
            </div>
          ) : (
            // Domain mode: grouped by domain
            (() => {
              const tomorrowByDomain = tomorrowTasks.reduce((acc, item) => {
                let domain: string;
                if (item.plannedTask.blockType === 'free') {
                  domain = 'Available Time';
                } else if (item.plannedTask.blockType === 'rest') {
                  domain = 'Rest';
                } else if (item.task) {
                  domain = item.task.domain;
                } else {
                  return acc;
                }
                if (!acc[domain]) acc[domain] = [];
                acc[domain].push(item);
                return acc;
              }, {} as Record<string, PlannedTaskWithDetails[]>);

              const tomorrowDomains = Object.keys(tomorrowByDomain);

              return (
                <div className="space-y-4">
                  {tomorrowDomains.map((domain) => {
                    const domainTasks = tomorrowByDomain[domain];
                    const domainColor = getDomainColor(domain);

                    return (
                      <div key={domain} className="bg-white/60 rounded-lg overflow-hidden">
                        <div
                          className="px-4 py-2 flex items-center justify-between"
                          style={{ backgroundColor: `${domainColor}15`, borderLeft: `4px solid ${domainColor}` }}
                        >
                          <h3 className="text-sm font-semibold text-gray-800">{domain}</h3>
                          <span className="text-xs text-gray-600">{domainTasks.length} blocks</span>
                        </div>
                        <div className="divide-y divide-gray-200">
                          {domainTasks.map((item, index) => {
                            const { plannedTask, task } = item;
                            const duration = getDuration(plannedTask.scheduledStartTime, plannedTask.scheduledEndTime);

                            if (plannedTask.blockType === 'free' || plannedTask.blockType === 'rest') {
                              return (
                                <div key={index} className="flex items-center gap-3 py-2 px-4">
                                  <span className="text-sm text-gray-600 w-24">{formatTime(plannedTask.scheduledStartTime)}</span>
                                  <span className="text-sm text-gray-700 flex-1">
                                    {plannedTask.blockType === 'free' ? '⏱️ Available Time' : '😴 Rest'}
                                  </span>
                                  <span className="text-xs text-gray-500">{duration}m</span>
                                </div>
                              );
                            }

                            if (!task) return null;

                            return (
                              <div key={index} className="flex items-center gap-3 py-2 px-4">
                                <span className="text-sm text-gray-600 w-24">{formatTime(plannedTask.scheduledStartTime)}</span>
                                <span className="text-sm text-gray-800 font-medium flex-1">{task.title}</span>
                                <span className="text-xs text-gray-500">{duration}m</span>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                </div>
              );
            })()
          )}
        </div>
      )}

      {/* Interruption Modal */}
      {showInterruptionModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={() => setShowInterruptionModal(false)}>
          <motion.div
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="bg-white rounded-lg shadow-2xl p-8 max-w-md w-full mx-4"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="text-2xl font-semibold text-gray-800 mb-4">Log Interruption</h2>
            <p className="text-sm text-gray-600 mb-6">
              Record an unplanned activity that consumed time from your wake day. This will reflow your remaining schedule.
            </p>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Duration (minutes)
                </label>
                <input
                  type="number"
                  min="5"
                  step="5"
                  value={interruptionData.duration}
                  onChange={(e) => setInterruptionData({ ...interruptionData, duration: parseInt(e.target.value) })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-600 focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Domain (what consumed the time?)
                </label>
                <select
                  value={interruptionData.domain}
                  onChange={(e) => setInterruptionData({ ...interruptionData, domain: e.target.value as Domain })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-600 focus:border-transparent"
                >
                  <option value="Unplanned">Unplanned</option>
                  <option value="Work">Work</option>
                  <option value="SideHustle">SideHustle</option>
                  <option value="Chore">Chore</option>
                  <option value="Errand">Errand</option>
                  <option value="Personal">Personal</option>
                  <option value="Creative">Creative</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Description (optional)
                </label>
                <input
                  type="text"
                  placeholder="e.g., Emergency call, unexpected meeting"
                  value={interruptionData.description}
                  onChange={(e) => setInterruptionData({ ...interruptionData, description: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-600 focus:border-transparent"
                />
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <button
                onClick={handleLogInterruption}
                disabled={loading}
                className="flex-1 px-6 py-3 bg-purple-600 text-white rounded-lg font-semibold hover:bg-purple-700 transition-all disabled:opacity-50"
              >
                Log & Reflow
              </button>
              <button
                onClick={() => setShowInterruptionModal(false)}
                className="px-6 py-3 bg-gray-200 text-gray-700 rounded-lg font-semibold hover:bg-gray-300 transition-all"
              >
                Cancel
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
};
