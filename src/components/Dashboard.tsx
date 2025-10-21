import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Play, Briefcase, Home, ShoppingCart, Heart, Palette, Zap, Calendar, Rocket, Sun } from 'lucide-react';
import { Task, Energy, db, Domain } from '../db/database';
import { getRecommendedTasks, getTodayMinutes, calculateWeeklyMinutes } from '../utils/taskRecommender';
import { getDomainColor, getDomainClasses } from '../utils/domainColors';
import { generateWakeDaySchedule } from '../utils/wakeDayScheduler';
import { DomainPanel } from './DomainPanel';
import { getEnergyAtTime, logBioRhythmApplied, calculateDailyEnergyCurve } from '../utils/bioRhythm';

interface DashboardProps {
  onStartTask: (task: Task, blockDuration: number) => void;
  currentEnergy: Energy;
  onEnergyChange: (energy: Energy) => void;
  onNavigateToView: (view: 'dashboard' | 'today' | 'library' | 'settings') => void;
}

export const Dashboard = ({ onStartTask, currentEnergy, onEnergyChange, onNavigateToView }: DashboardProps) => {
  const [recommendedTasks, setRecommendedTasks] = useState<Task[]>([]);
  const [todayMinutes, setTodayMinutes] = useState(0);
  const [weeklyWorkMinutes, setWeeklyWorkMinutes] = useState(0);
  const [maxWeeklyHours, setMaxWeeklyHours] = useState(24);
  const [todayBlockCount, setTodayBlockCount] = useState(0);
  const [isGeneratingPlan, setIsGeneratingPlan] = useState(false);
  const [planMessage, setPlanMessage] = useState<string | null>(null);
  const [dayStarted, setDayStarted] = useState(false);
  const [selectedDomain, setSelectedDomain] = useState<Domain | null>(null);
  const [showWeekModal, setShowWeekModal] = useState(false);
  const [weekSummary, setWeekSummary] = useState<{ domain: Domain; minutes: number }[]>([]);

  useEffect(() => {
    loadDashboardData();
    checkIfDayStarted();

    // Listen for settings changes and timer completion to reload
    const handleSettingsChanged = () => loadDashboardData();
    const handleTimerComplete = () => loadDashboardData();

    window.addEventListener('settings-changed', handleSettingsChanged);
    window.addEventListener('timer-complete', handleTimerComplete);

    return () => {
      window.removeEventListener('settings-changed', handleSettingsChanged);
      window.removeEventListener('timer-complete', handleTimerComplete);
    };
  }, [currentEnergy]);

  const checkIfDayStarted = async () => {
    const prefs = await db.userPrefs.get(1);
    if (prefs && prefs.actualWakeTimeToday) {
      const wakeTime = new Date(prefs.actualWakeTimeToday);
      const today = new Date();
      const isSameDay = wakeTime.toDateString() === today.toDateString();
      setDayStarted(isSameDay);
    }
  };

  const loadDashboardData = async () => {
    // Get recommended tasks for current energy
    const tasks = await getRecommendedTasks(currentEnergy, 60, 5);
    setRecommendedTasks(tasks);

    const todayString = new Date().toISOString().split('T')[0];

    // Today count: tasks with assignedDate = today
    const todayTaskCount = await db.tasks
      .where('assignedDate')
      .equals(todayString)
      .and(task => !task.archived && task.status === 'todo')
      .count();
    setTodayBlockCount(todayTaskCount);

    // Today minutes: completed sessions today
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const todaySessions = await db.sessions
      .where('startTime')
      .above(todayStart.toISOString())
      .and(session => session.completed === true)
      .toArray();
    const todayMins = todaySessions.reduce((sum, s) => sum + (s.earnedMins || 0), 0);
    setTodayMinutes(todayMins);

    // This week Work: sum of Work domain completed sessions
    const weekStart = new Date();
    weekStart.setDate(weekStart.getDate() - weekStart.getDay()); // Start of week (Sunday)
    weekStart.setHours(0, 0, 0, 0);

    const weekSessions = await db.sessions
      .where('startTime')
      .above(weekStart.toISOString())
      .and(session => session.completed === true)
      .toArray();

    // Get Work domain sessions
    const workTasks = await db.tasks.where('domain').equals('Work').toArray();
    const workTaskIds = new Set(workTasks.map(t => t.id));
    const weeklyMins = weekSessions
      .filter(s => s.taskId && workTaskIds.has(s.taskId))
      .reduce((sum, s) => sum + (s.earnedMins || 0), 0);
    setWeeklyWorkMinutes(weeklyMins);

    // Get user prefs
    const prefs = await db.userPrefs.get(1);
    if (prefs) {
      setMaxWeeklyHours(prefs.maxWorkHoursPerWeek);
    }
  };

  const domainIcons: Record<Domain, any> = {
    Work: Briefcase,
    SideHustle: Rocket,
    Chore: Home,
    Errand: ShoppingCart,
    Personal: Heart,
    Creative: Palette,
  };

  const energyLevels: Energy[] = ['Low', 'Medium', 'High'];
  const energyEmojis: Record<Energy, string> = {
    Low: '🌙',
    Medium: '☀️',
    High: '⚡',
  };

  const weeklyHoursUsed = Math.floor(weeklyWorkMinutes / 60);
  const weeklyProgress = (weeklyHoursUsed / maxWeeklyHours) * 100;

  const formatMinutes = (mins: number): string => {
    const hours = Math.floor(mins / 60);
    const minutes = mins % 60;
    if (hours > 0) {
      return `${hours}h ${minutes}m`;
    }
    return `${minutes}m`;
  };

  const handleStartMyDay = async () => {
    setIsGeneratingPlan(true);
    setPlanMessage(null);
    try {
      const now = new Date();
      const prefs = await db.userPrefs.get(1);

      if (!prefs) {
        throw new Error('User preferences not found');
      }

      // Calculate current energy from bio-rhythm
      const currentHour = now.getHours();
      const bioRhythmEnergy = getEnergyAtTime(
        currentHour,
        prefs.bioRhythmProfile,
        prefs.customBioRhythmSegments
      );

      // Calculate full day energy curve for logging
      const energyCurve = calculateDailyEnergyCurve(
        prefs.bioRhythmProfile,
        prefs.customBioRhythmSegments
      );
      logBioRhythmApplied(prefs.bioRhythmProfile, energyCurve);

      // Update actualWakeTimeToday and current energy based on bio-rhythm
      await db.userPrefs.update(1, {
        actualWakeTimeToday: now.toISOString(),
        currentEnergy: bioRhythmEnergy
      });

      // Update local energy state
      onEnergyChange(bioRhythmEnergy);

      // Clear today's existing plan
      const todayString = now.toISOString().split('T')[0];
      await db.dailyPlanTasks.where('planDate').equals(todayString).and(task => !task.isDraft).delete();

      // Generate new schedule from now
      const result = await generateWakeDaySchedule(now, false);

      // Save schedule to database
      if (result.plannedTasks.length > 0) {
        await db.dailyPlanTasks.bulkAdd(result.plannedTasks);
      }

      setDayStarted(true);
      setPlanMessage(result.message);
      setTimeout(() => setPlanMessage(null), 5000);
    } catch (error) {
      console.error('Error starting day:', error);
      setPlanMessage('Error starting day. Please try again.');
      setTimeout(() => setPlanMessage(null), 5000);
    } finally {
      setIsGeneratingPlan(false);
    }
  };

  const handlePlanMyDay = async () => {
    setIsGeneratingPlan(true);
    setPlanMessage(null);
    try {
      const today = new Date();
      const todayString = today.toISOString().split('T')[0];

      // Clear existing plan for today
      await db.dailyPlanTasks.where('planDate').equals(todayString).and(task => !task.isDraft).delete();

      const result = await generateWakeDaySchedule(today, false);

      // Save schedule to database
      if (result.plannedTasks.length > 0) {
        await db.dailyPlanTasks.bulkAdd(result.plannedTasks);
      }

      setPlanMessage(result.message);
      setTimeout(() => setPlanMessage(null), 5000); // Clear message after 5 seconds
    } catch (error) {
      console.error('Error generating plan:', error);
      setPlanMessage('Error generating plan. Please try again.');
      setTimeout(() => setPlanMessage(null), 5000);
    } finally {
      setIsGeneratingPlan(false);
    }
  };

  return (
    <div className="space-y-8">
      {/* Header with energy selector */}
      <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl lg:text-4xl font-semibold text-gray-800">Rhythm Planner</h1>
          <p className="text-gray-600 mt-1">Live in rhythm, not on a list</p>
        </div>

        <div className="flex flex-col items-start lg:items-end gap-2 w-full lg:w-auto">
          <label className="text-sm text-gray-600 font-medium">Your Energy Right Now</label>
          <div className="flex gap-2 flex-wrap">
            {energyLevels.map((energy) => (
              <button
                key={energy}
                onClick={async () => {
                  onEnergyChange(energy);
                  // Persist energy level to database
                  await db.userPrefs.update(1, { currentEnergy: energy });
                }}
                className={`px-4 py-2 rounded-lg font-medium transition-all min-h-[44px] ${
                  currentEnergy === energy
                    ? 'bg-gray-800 text-white shadow-md scale-105'
                    : 'bg-white text-gray-600 hover:bg-gray-100'
                }`}
              >
                {energyEmojis[energy]} {energy}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="flex gap-4 justify-center flex-wrap">
        {!dayStarted && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="w-full sm:w-auto"
          >
            <button
              onClick={handleStartMyDay}
              disabled={isGeneratingPlan}
              className="w-full sm:w-auto flex items-center justify-center gap-3 px-6 sm:px-10 py-4 sm:py-5 bg-orange-600 text-white rounded-2xl font-bold text-lg sm:text-xl hover:bg-orange-700 transition-all shadow-lg transform hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none min-h-[56px]"
            >
              <Sun size={24} className="sm:w-7 sm:h-7" />
              <span>
                {isGeneratingPlan ? 'Starting Day...' : 'Start My Day'}
              </span>
            </button>
          </motion.div>
        )}

        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="w-full sm:w-auto"
        >
          <button
            onClick={handlePlanMyDay}
            disabled={isGeneratingPlan}
            className="w-full sm:w-auto relative overflow-hidden flex items-center justify-center gap-3 px-6 sm:px-10 py-4 sm:py-5 bg-gradient-to-r from-emerald-500 via-teal-500 to-cyan-500 text-white rounded-2xl font-bold text-lg sm:text-xl hover:from-emerald-600 hover:via-teal-600 hover:to-cyan-600 transition-all shadow-2xl hover:shadow-emerald-500/50 transform hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none min-h-[56px]"
          >
            <div className="absolute inset-0 bg-white/20 blur-xl"></div>
            <Calendar size={24} className="relative z-10 sm:w-7 sm:h-7" />
            <span className="relative z-10">
              {isGeneratingPlan ? 'Generating Plan...' : '✨ Plan My Day'}
            </span>
          </button>
        </motion.div>
      </div>

      {/* Plan Message */}
      {planMessage && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0 }}
          className="text-center p-4 bg-green-50 border border-green-200 rounded-lg text-green-800 font-medium"
        >
          {planMessage}
        </motion.div>
      )}

      {/* Stats summary */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Today's progress */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white rounded-lg shadow p-6 cursor-pointer hover:shadow-lg transition-all"
          onClick={() => {
            console.log('DASH_CLICK Today');
            onNavigateToView('today');
          }}
          title="Click to view details"
        >
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-lg font-semibold text-gray-700">Today</h3>
            <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
              <Play size={20} className="text-blue-600" />
            </div>
          </div>
          <div className="text-3xl font-bold text-gray-800">{todayBlockCount} tasks</div>
          <div className="text-gray-600 mt-1">{formatMinutes(todayMinutes)} completed</div>
        </motion.div>

        {/* Weekly work hours */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="bg-white rounded-lg shadow p-6 cursor-pointer hover:shadow-lg transition-all"
          onClick={async () => {
            console.log('DASH_CLICK This Week (Work)');

            // Calculate week summary for all domains
            const weekStart = new Date();
            weekStart.setDate(weekStart.getDate() - weekStart.getDay());
            weekStart.setHours(0, 0, 0, 0);

            const weekSessions = await db.sessions
              .where('startTime')
              .above(weekStart.toISOString())
              .and(session => session.completed === true)
              .toArray();

            const allTasks = await db.tasks.toArray();
            const taskDomainMap = new Map(allTasks.map(t => [t.id, t.domain]));

            const domainMinutes = weekSessions.reduce((acc, s) => {
              const domain = s.taskId ? taskDomainMap.get(s.taskId) : null;
              if (domain) {
                acc[domain] = (acc[domain] || 0) + (s.earnedMins || 0);
              }
              return acc;
            }, {} as Record<Domain, number>);

            const summary = Object.entries(domainMinutes)
              .map(([domain, minutes]) => ({ domain: domain as Domain, minutes }))
              .sort((a, b) => b.minutes - a.minutes);

            setWeekSummary(summary);
            setShowWeekModal(true);
          }}
          title="Click to view details"
        >
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-lg font-semibold text-gray-700">This Week (Work)</h3>
            <div className="w-10 h-10 bg-work/20 rounded-full flex items-center justify-center">
              <Briefcase size={20} className="text-work" />
            </div>
          </div>
          <div className="text-3xl font-bold text-gray-800">
            {weeklyHoursUsed}h <span className="text-lg text-gray-500">/ {maxWeeklyHours}h</span>
          </div>
          <div className="mt-3 bg-gray-200 rounded-full h-2 overflow-hidden">
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${weeklyProgress}%` }}
              className="h-full bg-work rounded-full"
              transition={{ duration: 0.5, delay: 0.2 }}
            />
          </div>
        </motion.div>

        {/* Energy level indicator */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="bg-white rounded-lg shadow p-6"
        >
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-lg font-semibold text-gray-700">Current Energy</h3>
            <div className="w-10 h-10 bg-yellow-100 rounded-full flex items-center justify-center">
              <Zap size={20} className="text-yellow-600" />
            </div>
          </div>
          <div className="text-3xl font-bold text-gray-800">
            {energyEmojis[currentEnergy]} {currentEnergy}
          </div>
          <div className="text-gray-600 mt-1">Recommendations updated</div>
        </motion.div>
      </div>

      {/* Quick action buttons by domain */}
      <div>
        <h2 className="text-xl sm:text-2xl font-semibold text-gray-800 mb-4">Quick Start</h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 sm:gap-4">
          {(Object.keys(domainIcons) as Domain[]).map((domain) => {
            const Icon = domainIcons[domain];
            const color = getDomainColor(domain);
            return (
              <motion.button
                key={domain}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => setSelectedDomain(domain)}
                className="bg-white rounded-lg shadow p-4 sm:p-6 text-center hover:shadow-lg transition-all group min-h-[100px] sm:min-h-[120px]"
              >
                <div
                  className="w-10 h-10 sm:w-12 sm:h-12 mx-auto rounded-full flex items-center justify-center mb-2 sm:mb-3 group-hover:scale-110 transition-transform"
                  style={{ backgroundColor: `${color}20` }}
                >
                  <Icon size={20} className="sm:w-6 sm:h-6" style={{ color }} />
                </div>
                <div className="font-semibold text-gray-800 text-sm sm:text-base">{domain}</div>
                <div className="text-xs text-gray-500 mt-1">View Tasks</div>
              </motion.button>
            );
          })}
        </div>
      </div>

      {/* Recommended tasks */}
      <div>
        <h2 className="text-xl sm:text-2xl font-semibold text-gray-800 mb-4">
          Recommended for You ({energyEmojis[currentEnergy]} {currentEnergy} Energy)
        </h2>
        <div className="space-y-3">
          {recommendedTasks.map((task, index) => {
            const domainColor = getDomainColor(task.domain);
            return (
              <motion.div
                key={task.id}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: index * 0.1 }}
                className="bg-white rounded-lg shadow p-4 hover:shadow-md transition-all border-l-4"
                style={{ borderLeftColor: domainColor }}
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2 flex-wrap">
                      <span
                        className="inline-block px-2 py-1 rounded text-xs font-medium text-white"
                        style={{ backgroundColor: domainColor }}
                      >
                        {task.domain}
                      </span>
                      <span className="text-xs text-gray-500">{task.estimateMins} min</span>
                      <span className="text-xs text-gray-500">
                        {energyEmojis[task.energy]} {task.energy}
                      </span>
                      {task.priority === 'High' && (
                        <span className="text-xs text-red-500 font-semibold">High Priority</span>
                      )}
                    </div>
                    <h3 className="font-semibold text-gray-800 text-base sm:text-lg">{task.title}</h3>
                    {task.notes && (
                      <p className="text-sm text-gray-600 mt-1 line-clamp-1">{task.notes}</p>
                    )}
                  </div>
                  <div className="flex gap-2 sm:ml-4">
                    <button
                      onClick={() => onStartTask(task, 30)}
                      className="flex-1 sm:flex-none px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg text-sm font-medium transition-all min-h-[44px]"
                    >
                      30 min
                    </button>
                    <button
                      onClick={() => onStartTask(task, 60)}
                      className="flex-1 sm:flex-none px-4 py-2 text-white rounded-lg text-sm font-medium transition-all hover:scale-105 min-h-[44px]"
                      style={{ backgroundColor: domainColor }}
                    >
                      60 min
                    </button>
                  </div>
                </div>
              </motion.div>
            );
          })}

          {recommendedTasks.length === 0 && (
            <div className="text-center py-12 text-gray-500">
              <p className="text-lg">No tasks available right now.</p>
              <p className="text-sm mt-2">Add some tasks to get started!</p>
            </div>
          )}
        </div>
      </div>

      {/* Domain Panel */}
      <AnimatePresence>
        {selectedDomain && (
          <DomainPanel
            domain={selectedDomain}
            onClose={() => setSelectedDomain(null)}
            onStartTask={onStartTask}
            currentEnergy={currentEnergy}
          />
        )}
      </AnimatePresence>

      {/* Week Summary Modal */}
      <AnimatePresence>
        {showWeekModal && (
          <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center" onClick={() => setShowWeekModal(false)}>
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white rounded-lg shadow-2xl p-6 max-w-md w-full mx-4"
              onClick={(e) => e.stopPropagation()}
            >
              <h3 className="text-2xl font-semibold text-gray-800 mb-4">This Week's Summary</h3>
              <div className="space-y-3">
                {weekSummary.length === 0 ? (
                  <p className="text-gray-500 text-center py-4">No completed sessions this week</p>
                ) : (
                  weekSummary.map(({ domain, minutes }) => {
                    const domainColor = getDomainColor(domain);
                    const hours = (minutes / 60).toFixed(1);
                    return (
                      <div key={domain} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                        <div className="flex items-center gap-3">
                          <div className="w-4 h-4 rounded-full" style={{ backgroundColor: domainColor }} />
                          <span className="font-medium text-gray-800">{domain}</span>
                        </div>
                        <span className="text-gray-600">{hours}h ({minutes}m)</span>
                      </div>
                    );
                  })
                )}
              </div>
              <button
                onClick={() => setShowWeekModal(false)}
                className="mt-6 w-full px-6 py-2 bg-gray-800 text-white rounded-lg font-semibold hover:bg-gray-900 transition-all"
              >
                Close
              </button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};
