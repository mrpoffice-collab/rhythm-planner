import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Task, Energy } from '../db/database';
import { getRecommendedTasks, getMicroTask } from '../utils/taskRecommender';
import { getDomainColor } from '../utils/domainColors';
import { Clock, Zap, AlertCircle } from 'lucide-react';

interface SkipReplacementModalProps {
  skippedTask: Task;
  currentEnergy: Energy;
  availableMinutes: number;
  onSelectTask: (task: Task) => void;
  onClose: () => void;
}

export const SkipReplacementModal = ({
  skippedTask,
  currentEnergy,
  availableMinutes,
  onSelectTask,
  onClose,
}: SkipReplacementModalProps) => {
  const [replacements, setReplacements] = useState<Task[]>([]);
  const [countdown, setCountdown] = useState(30);
  const [showMicroTask, setShowMicroTask] = useState(false);

  useEffect(() => {
    loadReplacements();
  }, []);

  useEffect(() => {
    // 30 second countdown
    const timer = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          handleTimeout();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  const loadReplacements = async () => {
    const tasks = await getRecommendedTasks(
      currentEnergy,
      availableMinutes,
      3,
      skippedTask.id
    );
    setReplacements(tasks);
  };

  const handleTimeout = async () => {
    // Show micro task as fallback
    const microTask = await getMicroTask();
    if (microTask) {
      setShowMicroTask(true);
      onSelectTask(microTask);
    } else {
      onClose();
    }
  };

  const energyIcons: Record<Energy, string> = {
    Low: '🌙',
    Medium: '☀️',
    High: '⚡',
  };

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
      <motion.div
        initial={{ scale: 0.9, opacity: 0, y: 20 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        className="bg-white rounded-lg shadow-xl w-full max-w-2xl p-8"
      >
        {/* Header */}
        <div className="text-center mb-6">
          <div className="text-5xl mb-3">🔄</div>
          <h2 className="text-3xl font-semibold text-gray-800 mb-2">
            Let's try something else
          </h2>
          <p className="text-gray-600">
            Here are 3 tasks that might fit better right now
          </p>
          <div className="mt-4 text-sm text-gray-500">
            Auto-selecting in <span className="font-semibold text-red-500">{countdown}s</span>
          </div>
        </div>

        {/* Replacement tasks */}
        <div className="space-y-3 mb-6">
          {replacements.map((task) => {
            const domainColor = getDomainColor(task.domain);
            return (
              <motion.button
                key={task.id}
                onClick={() => onSelectTask(task)}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                className="w-full p-4 bg-gray-50 hover:bg-gray-100 rounded-lg transition-all text-left border-l-4"
                style={{ borderLeftColor: domainColor }}
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <span
                        className="inline-block px-2 py-1 rounded text-xs font-medium text-white"
                        style={{ backgroundColor: domainColor }}
                      >
                        {task.domain}
                      </span>
                      <span className="text-xs text-gray-500 flex items-center gap-1">
                        <Zap size={12} />
                        {energyIcons[task.energy]} {task.energy}
                      </span>
                      <span className="text-xs text-gray-500 flex items-center gap-1">
                        <Clock size={12} />
                        {task.estimateMins} min
                      </span>
                    </div>
                    <h3 className="font-semibold text-gray-800 mb-1">{task.title}</h3>
                    {task.notes && (
                      <p className="text-sm text-gray-600 line-clamp-2">{task.notes}</p>
                    )}
                  </div>
                  <div className="ml-4">
                    {task.priority === 'High' && (
                      <span className="text-red-500 text-xs font-semibold flex items-center gap-1">
                        <AlertCircle size={14} />
                        High Priority
                      </span>
                    )}
                  </div>
                </div>
              </motion.button>
            );
          })}
        </div>

        {replacements.length === 0 && (
          <div className="text-center py-8 text-gray-500">
            <p>No suitable tasks found right now.</p>
            <p className="text-sm mt-2">Try adjusting your energy level or adding more tasks.</p>
          </div>
        )}

        {/* Skip all button */}
        <div className="flex justify-center gap-4">
          <button
            onClick={onClose}
            className="px-6 py-2 bg-gray-200 text-gray-700 rounded-lg font-medium hover:bg-gray-300 transition-all"
          >
            Take a Break Instead
          </button>
        </div>
      </motion.div>
    </div>
  );
};
