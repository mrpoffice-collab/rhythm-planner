import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Plus, Zap, Check } from 'lucide-react';
import { Task, Domain, Energy, db } from '../db/database';
import { getDomainColor } from '../utils/domainColors';
import { getRecommendedTasks } from '../utils/taskRecommender';

interface DomainPanelProps {
  domain: Domain;
  onClose: () => void;
  onStartTask: (task: Task, duration: number) => void;
  currentEnergy: Energy;
}

type TabType = 'today' | 'backlog' | 'recurring' | 'completed';

export const DomainPanel = ({ domain, onClose, onStartTask, currentEnergy }: DomainPanelProps) => {
  const [activeTab, setActiveTab] = useState<TabType>('today');
  const [todayTasks, setTodayTasks] = useState<Task[]>([]);
  const [backlogTasks, setBacklogTasks] = useState<Task[]>([]);
  const [recurringTasks, setRecurringTasks] = useState<Task[]>([]);
  const [completedTasks, setCompletedTasks] = useState<Task[]>([]);
  const [metrics, setMetrics] = useState({ plannedToday: 0, remainingToday: 0, energyMix: { High: 0, Medium: 0, Low: 0 } });
  const [showNewTaskModal, setShowNewTaskModal] = useState(false);
  const [showSuggestModal, setShowSuggestModal] = useState(false);
  const [suggestedTask, setSuggestedTask] = useState<Task | null>(null);
  const [newTask, setNewTask] = useState({
    title: '',
    estimateMins: 30,
    energy: 'Medium' as Energy,
    dueDate: ''
  });
  const [validationError, setValidationError] = useState('');
  const [toast, setToast] = useState<string | null>(null);

  const domainColor = getDomainColor(domain);

  useEffect(() => {
    loadDomainData();
  }, [domain]);

  const loadDomainData = async () => {
    const todayString = new Date().toISOString().split('T')[0];

    // Today: tasks assigned to today for this domain
    const today = await db.tasks
      .where('assignedDate')
      .equals(todayString)
      .and(task => task.domain === domain && !task.archived && task.status === 'todo')
      .toArray();
    setTodayTasks(today);

    // Backlog: todo tasks not assigned, not recurring
    const backlog = await db.tasks
      .filter(task => task.domain === domain && task.status === 'todo' && !task.assignedDate && task.recurrence === 'Once' && !task.archived)
      .toArray();
    setBacklogTasks(backlog);

    // Recurring: recurring tasks for this domain
    const recurring = await db.tasks
      .filter(task => task.domain === domain && task.status === 'todo' && task.recurrence !== 'Once' && !task.archived)
      .toArray();
    setRecurringTasks(recurring);

    // Completed: archived tasks from last 7 days
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    const completed = await db.tasks
      .filter(task => task.domain === domain && task.archived && task.completedAt && new Date(task.completedAt) >= sevenDaysAgo)
      .toArray();
    setCompletedTasks(completed);

    // Calculate metrics
    const plannedMins = today.reduce((sum, t) => sum + t.estimateMins, 0);
    const energyMix = today.reduce((acc, t) => ({ ...acc, [t.energy]: acc[t.energy] + 1 }), { High: 0, Medium: 0, Low: 0 } as { High: number; Medium: number; Low: number });
    setMetrics({ plannedToday: plannedMins, remainingToday: plannedMins, energyMix });
  };

  const handleSuggestNext = async () => {
    // Filter domain tasks by status and energy
    const eligibleTasks = await db.tasks
      .filter(task =>
        task.domain === domain &&
        task.status === 'todo' &&
        !task.archived &&
        canDoTaskAtEnergy(task.energy, currentEnergy)
      )
      .toArray();

    if (eligibleTasks.length === 0) {
      console.log(`SUGGEST_NEXT ${domain} → none available`);
      return;
    }

    // Select highest priority: closest due, highest energy, longest duration
    const sorted = eligibleTasks.sort((a, b) => {
      // Primary: earliest due date
      const aDue = a.dueDate || a.deadline;
      const bDue = b.dueDate || b.deadline;
      if (aDue && bDue) {
        const diff = new Date(aDue).getTime() - new Date(bDue).getTime();
        if (diff !== 0) return diff;
      } else if (aDue) return -1;
      else if (bDue) return 1;

      // Secondary: highest energy demand
      const energyOrder = { High: 3, Medium: 2, Low: 1 };
      const energyDiff = energyOrder[b.energy] - energyOrder[a.energy];
      if (energyDiff !== 0) return energyDiff;

      // Tertiary: longest duration
      return b.estimateMins - a.estimateMins;
    });

    const suggestion = sorted[0];
    setSuggestedTask(suggestion);
    setShowSuggestModal(true);
  };

  const canDoTaskAtEnergy = (taskEnergy: Energy, currentEnergy: Energy): boolean => {
    if (taskEnergy === 'Low') return true;
    if (taskEnergy === 'Medium') return currentEnergy === 'Medium' || currentEnergy === 'High';
    if (taskEnergy === 'High') return currentEnergy === 'High';
    return false;
  };

  const handleAcceptSuggestion = () => {
    if (suggestedTask) {
      console.log(`SUGGEST_NEXT ${domain} → ${suggestedTask.title} decision:accepted`);
      onStartTask(suggestedTask, suggestedTask.estimateMins <= 30 ? 30 : 60);
      setShowSuggestModal(false);
    }
  };

  const handleSkipSuggestion = () => {
    if (suggestedTask) {
      console.log(`SUGGEST_NEXT ${domain} → ${suggestedTask.title} decision:skipped`);
    }
    setShowSuggestModal(false);
  };

  const showToast = (message: string) => {
    setToast(message);
    setTimeout(() => setToast(null), 2000);
  };

  const handleCreateTask = async () => {
    // Validation
    if (!newTask.title.trim()) {
      setValidationError('Title is required');
      return;
    }
    if (newTask.estimateMins <= 0) {
      setValidationError('Duration must be greater than 0');
      return;
    }

    setValidationError('');

    const task: Partial<Task> = {
      title: newTask.title.trim(),
      domain,
      estimateMins: newTask.estimateMins,
      energy: newTask.energy,
      priority: 'Medium',
      status: 'todo',
      recurrence: 'Once',
      dueDate: newTask.dueDate || undefined,
      archived: false,
      dread: 0,
      createdAt: new Date().toISOString(),
      // Auto-assign to today if eligible
      assignedDate: new Date().toISOString().split('T')[0]
    };

    try {
      const taskId = await db.tasks.add(task as Task);
      console.log(`TASK_SAVED ${domain} ${newTask.title.trim()}`);

      // Show success toast
      showToast('Task saved');

      // Reset form
      setNewTask({ title: '', estimateMins: 30, energy: 'Medium', dueDate: '' });
      setShowNewTaskModal(false);

      // Reload domain data
      await loadDomainData();

      // Trigger replan
      window.dispatchEvent(new CustomEvent('task-created'));
    } catch (error) {
      console.error('Error creating task:', error);
      setValidationError('Failed to save task');
    }
  };

  const renderTaskList = (tasks: Task[]) => {
    if (tasks.length === 0) {
      return <p className="text-gray-500 text-center py-8">No tasks in this category</p>;
    }

    return (
      <div className="space-y-2">
        {tasks.map(task => (
          <div key={task.id} className="p-3 bg-white rounded-lg border border-gray-200 hover:border-gray-300 transition-all">
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <h4 className="font-medium text-gray-800">{task.title}</h4>
                <div className="flex items-center gap-2 mt-1">
                  <span className="text-xs text-gray-500">{task.estimateMins}m</span>
                  <span className="text-xs text-gray-500">{task.energy} energy</span>
                  {task.priority === 'High' && <span className="text-xs text-red-500 font-semibold">High Priority</span>}
                </div>
              </div>
              {activeTab === 'today' && (
                <button
                  onClick={() => onStartTask(task, task.estimateMins <= 30 ? 30 : 60)}
                  className="px-3 py-1 text-xs font-medium text-white rounded hover:opacity-90"
                  style={{ backgroundColor: domainColor }}
                >
                  Start
                </button>
              )}
            </div>
          </div>
        ))}
      </div>
    );
  };

  const tabs: { id: TabType; label: string }[] = [
    { id: 'today', label: 'Today' },
    { id: 'backlog', label: 'Backlog' },
    { id: 'recurring', label: 'Recurring' },
    { id: 'completed', label: 'Completed (7d)' }
  ];

  const getTasksForTab = (tab: TabType) => {
    switch (tab) {
      case 'today': return todayTasks;
      case 'backlog': return backlogTasks;
      case 'recurring': return recurringTasks;
      case 'completed': return completedTasks;
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 bg-black/50 z-50 flex items-center justify-end"
      onClick={onClose}
    >
      <motion.div
        initial={{ x: '100%' }}
        animate={{ x: 0 }}
        exit={{ x: '100%' }}
        transition={{ type: 'tween', duration: 0.3 }}
        className="bg-white h-full w-full max-w-2xl shadow-2xl overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="sticky top-0 bg-white border-b border-gray-200 p-6 z-10">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-3xl font-semibold text-gray-800">{domain}</h2>
            <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-lg transition-all">
              <X size={24} className="text-gray-600" />
            </button>
          </div>

          {/* Metrics */}
          <div className="grid grid-cols-3 gap-4 mb-4">
            <div className="text-center">
              <div className="text-2xl font-bold text-gray-800">{Math.round(metrics.plannedToday / 60)}h</div>
              <div className="text-xs text-gray-500">Planned Today</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-gray-800">{todayTasks.length}</div>
              <div className="text-xs text-gray-500">Tasks Today</div>
            </div>
            <div className="text-center">
              <div className="text-sm font-medium text-gray-700">
                H:{metrics.energyMix.High} M:{metrics.energyMix.Medium} L:{metrics.energyMix.Low}
              </div>
              <div className="text-xs text-gray-500">Energy Mix</div>
            </div>
          </div>

          {/* Quick Actions */}
          <div className="flex gap-2">
            <button
              onClick={() => setShowNewTaskModal(true)}
              className="flex-1 px-4 py-2 bg-gray-100 hover:bg-gray-200 rounded-lg text-sm font-medium transition-all flex items-center justify-center gap-2"
              title="Create a new task in this domain"
            >
              <Plus size={16} />
              New Task
            </button>
            <button
              onClick={handleSuggestNext}
              className="flex-1 px-4 py-2 text-white rounded-lg text-sm font-medium transition-all flex items-center justify-center gap-2"
              style={{ backgroundColor: domainColor }}
              title="AI suggests a task that fits your current energy and time"
            >
              <Zap size={16} />
              Suggest Next
            </button>
          </div>
        </div>

        {/* Tabs */}
        <div className="border-b border-gray-200 px-6">
          <div className="flex gap-6">
            {tabs.map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`pb-3 border-b-2 font-medium transition-all ${
                  activeTab === tab.id
                    ? 'border-gray-800 text-gray-800'
                    : 'border-transparent text-gray-500 hover:text-gray-700'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {/* Content */}
        <div className="p-6">
          <AnimatePresence mode="wait">
            <motion.div
              key={activeTab}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.2 }}
            >
              {renderTaskList(getTasksForTab(activeTab))}
            </motion.div>
          </AnimatePresence>
        </div>
      </motion.div>

      {/* Toast */}
      <AnimatePresence>
        {toast && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="fixed top-4 right-4 z-[70] flex items-center gap-2 px-4 py-3 bg-green-600 text-white rounded-lg shadow-lg"
          >
            <Check size={18} />
            {toast}
          </motion.div>
        )}
      </AnimatePresence>

      {/* New Task Modal */}
      <AnimatePresence>
        {showNewTaskModal && (
          <div className="fixed inset-0 bg-black/50 z-[60] flex items-center justify-center" onClick={() => {
            setShowNewTaskModal(false);
            setValidationError('');
          }}>
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white rounded-lg shadow-2xl p-6 max-w-md w-full mx-4"
              onClick={(e) => e.stopPropagation()}
            >
              <h3 className="text-2xl font-semibold text-gray-800 mb-4">New Task in {domain}</h3>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Title</label>
                  <input
                    type="text"
                    value={newTask.title}
                    onChange={(e) => {
                      setNewTask({ ...newTask, title: e.target.value });
                      setValidationError('');
                    }}
                    className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-gray-800 focus:border-transparent ${
                      validationError && !newTask.title.trim() ? 'border-red-500' : 'border-gray-300'
                    }`}
                    placeholder="Task name"
                  />
                  {validationError && !newTask.title.trim() && (
                    <p className="text-xs text-red-500 mt-1">{validationError}</p>
                  )}
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Duration (minutes)</label>
                  <input
                    type="number"
                    min="5"
                    step="5"
                    value={newTask.estimateMins}
                    onChange={(e) => {
                      setNewTask({ ...newTask, estimateMins: parseInt(e.target.value) || 5 });
                      setValidationError('');
                    }}
                    className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-gray-800 focus:border-transparent ${
                      validationError && newTask.estimateMins <= 0 ? 'border-red-500' : 'border-gray-300'
                    }`}
                  />
                  {validationError && newTask.estimateMins <= 0 && (
                    <p className="text-xs text-red-500 mt-1">{validationError}</p>
                  )}
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Energy Level</label>
                  <select
                    value={newTask.energy}
                    onChange={(e) => setNewTask({ ...newTask, energy: e.target.value as Energy })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-800 focus:border-transparent"
                  >
                    <option value="Low">Low</option>
                    <option value="Medium">Medium</option>
                    <option value="High">High</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Due Date (optional)</label>
                  <input
                    type="date"
                    value={newTask.dueDate}
                    onChange={(e) => setNewTask({ ...newTask, dueDate: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-800 focus:border-transparent"
                  />
                </div>
              </div>
              <div className="flex gap-3 mt-6">
                <button
                  onClick={handleCreateTask}
                  disabled={!newTask.title.trim()}
                  className="flex-1 px-6 py-2 bg-gray-800 text-white rounded-lg font-semibold hover:bg-gray-900 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Save
                </button>
                <button
                  onClick={() => setShowNewTaskModal(false)}
                  className="px-6 py-2 bg-gray-200 text-gray-700 rounded-lg font-semibold hover:bg-gray-300 transition-all"
                >
                  Cancel
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Suggest Next Modal */}
      <AnimatePresence>
        {showSuggestModal && suggestedTask && (
          <div className="fixed inset-0 bg-black/50 z-[60] flex items-center justify-center" onClick={handleSkipSuggestion}>
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white rounded-lg shadow-2xl p-6 max-w-md w-full mx-4"
              onClick={(e) => e.stopPropagation()}
            >
              <h3 className="text-2xl font-semibold text-gray-800 mb-4">Suggested Task</h3>
              <p className="text-gray-600 mb-4">
                We suggest you work on <strong className="text-gray-800">{suggestedTask.title}</strong> next.
              </p>
              <div className="flex items-center gap-3 mb-6 text-sm text-gray-600">
                <span>{suggestedTask.estimateMins}m</span>
                <span>•</span>
                <span>{suggestedTask.energy} energy</span>
                {suggestedTask.priority === 'High' && (
                  <>
                    <span>•</span>
                    <span className="text-red-500 font-semibold">High Priority</span>
                  </>
                )}
              </div>
              <div className="flex gap-3">
                <button
                  onClick={handleAcceptSuggestion}
                  className="flex-1 px-6 py-2 text-white rounded-lg font-semibold hover:opacity-90 transition-all"
                  style={{ backgroundColor: domainColor }}
                >
                  Start
                </button>
                <button
                  onClick={handleSkipSuggestion}
                  className="px-6 py-2 bg-gray-200 text-gray-700 rounded-lg font-semibold hover:bg-gray-300 transition-all"
                >
                  Skip
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </motion.div>
  );
};
