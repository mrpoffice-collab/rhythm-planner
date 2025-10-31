import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Trophy, TrendingUp, Calendar, ArrowRight, X, Sparkles, Target, Zap } from 'lucide-react';
import { db, Domain } from '../db/database';
import { getDomainColor } from '../utils/domainColors';

interface EndOfDayReviewProps {
  onClose: () => void;
  onPlanTomorrow: () => void;
}

interface DayStats {
  tasksCompleted: number;
  minutesWorked: number;
  topDomain: { domain: Domain; minutes: number } | null;
  streak: number;
}

export const EndOfDayReview = ({ onClose, onPlanTomorrow }: EndOfDayReviewProps) => {
  const [stats, setStats] = useState<DayStats>({
    tasksCompleted: 0,
    minutesWorked: 0,
    topDomain: null,
    streak: 0,
  });
  const [reflection, setReflection] = useState('');
  const [wins, setWins] = useState<string[]>(['', '', '']);

  useEffect(() => {
    loadDayStats();
  }, []);

  const loadDayStats = async () => {
    const today = new Date();
    const todayStart = new Date(today);
    todayStart.setHours(0, 0, 0, 0);

    // Get completed sessions today
    const todaySessions = await db.sessions
      .where('startTime')
      .above(todayStart.toISOString())
      .and(session => session.completed === true)
      .toArray();

    const minutesWorked = todaySessions.reduce((sum, s) => sum + (s.earnedMins || 0), 0);

    // Count completed tasks
    const completedTasks = await db.tasks
      .where('lastCompletedAt')
      .above(todayStart.toISOString())
      .count();

    // Calculate domain breakdown
    const allTasks = await db.tasks.toArray();
    const taskDomainMap = new Map(allTasks.map(t => [t.id, t.domain]));

    const domainMinutes = todaySessions.reduce((acc, s) => {
      const domain = s.taskId ? taskDomainMap.get(s.taskId) : null;
      if (domain) {
        acc[domain] = (acc[domain] || 0) + (s.earnedMins || 0);
      }
      return acc;
    }, {} as Record<Domain, number>);

    const topDomainEntry = Object.entries(domainMinutes)
      .sort(([, a], [, b]) => b - a)[0];

    const topDomain = topDomainEntry
      ? { domain: topDomainEntry[0] as Domain, minutes: topDomainEntry[1] }
      : null;

    // Calculate streak
    const streak = await calculateStreak();

    setStats({
      tasksCompleted: completedTasks,
      minutesWorked,
      topDomain,
      streak,
    });
  };

  const calculateStreak = async (): Promise<number> => {
    const lastDayStart = localStorage.getItem('rhythmPlanner_lastDayStart');
    if (!lastDayStart) return 1;

    const today = new Date().toISOString().split('T')[0];
    const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0];

    if (lastDayStart === yesterday) {
      const currentStreak = parseInt(localStorage.getItem('rhythmPlanner_streak') || '0') + 1;
      localStorage.setItem('rhythmPlanner_streak', currentStreak.toString());
      return currentStreak;
    } else if (lastDayStart === today) {
      return parseInt(localStorage.getItem('rhythmPlanner_streak') || '1');
    } else {
      // Streak broken
      localStorage.setItem('rhythmPlanner_streak', '1');
      return 1;
    }
  };

  const handleFinish = () => {
    // Save reflection and wins to localStorage
    if (reflection) {
      const reflections = JSON.parse(localStorage.getItem('rhythmPlanner_reflections') || '[]');
      reflections.push({
        date: new Date().toISOString(),
        reflection,
        wins: wins.filter(w => w.trim()),
      });
      localStorage.setItem('rhythmPlanner_reflections', JSON.stringify(reflections.slice(-30))); // Keep last 30 days
    }

    // Mark day as ended
    localStorage.setItem('rhythmPlanner_lastDayEnd', new Date().toISOString());

    onClose();
  };

  const formatTime = (mins: number) => {
    const hours = Math.floor(mins / 60);
    const minutes = mins % 60;
    if (hours > 0) return `${hours}h ${minutes}m`;
    return `${minutes}m`;
  };

  const getEncouragingMessage = () => {
    if (stats.tasksCompleted === 0) return "Tomorrow is a fresh start! 🌅";
    if (stats.tasksCompleted < 3) return "You showed up, that's what matters! 💪";
    if (stats.tasksCompleted < 5) return "Solid progress today! 🎯";
    if (stats.tasksCompleted < 8) return "You're on fire! 🔥";
    return "Absolutely crushing it! 🚀";
  };

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
      <motion.div
        initial={{ scale: 0.9, opacity: 0, y: 20 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        exit={{ scale: 0.9, opacity: 0, y: 20 }}
        className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full p-6 sm:p-8 relative z-10 border border-indigo-200 max-h-[90vh] overflow-y-auto"
      >
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 transition-colors"
        >
          <X size={24} />
        </button>

        {/* Header */}
        <div className="text-center mb-8">
          <motion.div
            animate={{ rotate: [0, 10, -10, 0], scale: [1, 1.1, 1] }}
            transition={{ duration: 2, repeat: Infinity, repeatDelay: 1 }}
            className="text-6xl mb-4"
          >
            🌙
          </motion.div>
          <h2 className="text-3xl font-bold bg-gradient-to-r from-gray-800 to-indigo-600 bg-clip-text text-transparent mb-2">
            Day Complete!
          </h2>
          <p className="text-lg text-gray-600">{getEncouragingMessage()}</p>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="bg-gradient-to-br from-green-50 to-white p-6 rounded-xl border-2 border-green-200 text-center"
          >
            <Trophy className="mx-auto mb-2 text-green-500" size={32} />
            <div className="text-3xl font-bold text-gray-800">{stats.tasksCompleted}</div>
            <div className="text-sm text-gray-600 font-medium">Tasks Done</div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="bg-gradient-to-br from-blue-50 to-white p-6 rounded-xl border-2 border-blue-200 text-center"
          >
            <Zap className="mx-auto mb-2 text-blue-500" size={32} />
            <div className="text-3xl font-bold text-gray-800">{formatTime(stats.minutesWorked)}</div>
            <div className="text-sm text-gray-600 font-medium">Focused Time</div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="bg-gradient-to-br from-amber-50 to-white p-6 rounded-xl border-2 border-amber-200 text-center"
          >
            <TrendingUp className="mx-auto mb-2 text-amber-500" size={32} />
            <div className="text-3xl font-bold text-gray-800">{stats.streak}</div>
            <div className="text-sm text-gray-600 font-medium">Day Streak</div>
          </motion.div>
        </div>

        {/* Top Domain */}
        {stats.topDomain && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
            className="bg-gradient-to-br from-purple-50 to-white p-6 rounded-xl border-2 border-purple-200 mb-6"
          >
            <div className="flex items-center gap-4">
              <div
                className="w-16 h-16 rounded-full flex items-center justify-center text-2xl"
                style={{ backgroundColor: `${getDomainColor(stats.topDomain.domain)}20` }}
              >
                <Target style={{ color: getDomainColor(stats.topDomain.domain) }} size={32} />
              </div>
              <div className="flex-1">
                <div className="text-sm text-gray-600 font-medium mb-1">Top Focus Area</div>
                <div className="text-2xl font-bold text-gray-800">{stats.topDomain.domain}</div>
                <div className="text-sm text-gray-600">{formatTime(stats.topDomain.minutes)} invested</div>
              </div>
            </div>
          </motion.div>
        )}

        {/* Quick Wins */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
          className="mb-6"
        >
          <label className="block text-lg font-semibold text-gray-800 mb-3 flex items-center gap-2">
            <Sparkles size={20} className="text-amber-500" />
            3 Wins from Today (Optional)
          </label>
          <div className="space-y-2">
            {wins.map((win, index) => (
              <input
                key={index}
                type="text"
                value={win}
                onChange={(e) => {
                  const newWins = [...wins];
                  newWins[index] = e.target.value;
                  setWins(newWins);
                }}
                placeholder={`Win #${index + 1}`}
                className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent placeholder-gray-400"
              />
            ))}
          </div>
        </motion.div>

        {/* Reflection */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.6 }}
          className="mb-6"
        >
          <label className="block text-lg font-semibold text-gray-800 mb-3">
            How did today feel? (Optional)
          </label>
          <textarea
            value={reflection}
            onChange={(e) => setReflection(e.target.value)}
            placeholder="I'm proud of... / Tomorrow I'll... / I learned..."
            rows={3}
            className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent placeholder-gray-400 resize-none"
          />
        </motion.div>

        {/* Action Buttons */}
        <div className="flex flex-col sm:flex-row gap-3">
          <motion.button
            onClick={handleFinish}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            className="px-6 py-3 bg-gray-200 text-gray-700 rounded-xl font-semibold hover:bg-gray-300 transition-colors"
          >
            Skip for Now
          </motion.button>
          <motion.button
            onClick={() => {
              handleFinish();
              onPlanTomorrow();
            }}
            whileHover={{ scale: 1.02, boxShadow: '0 15px 30px rgba(99, 102, 241, 0.3)' }}
            whileTap={{ scale: 0.98 }}
            className="flex-1 px-6 py-3 bg-gradient-to-r from-indigo-500 to-purple-500 text-white rounded-xl font-bold shadow-lg flex items-center justify-center gap-2"
          >
            <Calendar size={20} />
            Plan Tomorrow & Finish
            <ArrowRight size={20} />
          </motion.button>
        </div>

        <p className="text-center text-sm text-gray-500 mt-4">
          Come back tomorrow to keep your {stats.streak}-day streak going! 🔥
        </p>
      </motion.div>
    </div>
  );
};
