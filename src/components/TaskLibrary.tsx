import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Plus,
  Filter,
  Edit,
  Trash2,
  Clock,
  Zap,
  AlertCircle,
  X,
} from 'lucide-react';
import { Task, Domain, Priority, Energy, Recurrence, TaskType, db } from '../db/database';
import { getDomainColor } from '../utils/domainColors';

export const TaskLibrary = () => {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [filteredTasks, setFilteredTasks] = useState<Task[]>([]);
  const [filterDomain, setFilterDomain] = useState<Domain | 'All'>('All');
  const [filterPriority, setFilterPriority] = useState<Priority | 'All'>('All');
  const [filterEnergy, setFilterEnergy] = useState<Energy | 'All'>('All');
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [showArchive, setShowArchive] = useState(false);

  useEffect(() => {
    loadTasks();
  }, []);

  useEffect(() => {
    applyFilters();
  }, [tasks, filterDomain, filterPriority, filterEnergy]);

  const loadTasks = async () => {
    // Exclude archived tasks from Task Library view
    const allTasks = await db.tasks
      .filter(task => !task.archived)
      .toArray();
    setTasks(allTasks);
  };

  const applyFilters = () => {
    let filtered = tasks;

    if (filterDomain !== 'All') {
      filtered = filtered.filter((task) => task.domain === filterDomain);
    }

    if (filterPriority !== 'All') {
      filtered = filtered.filter((task) => task.priority === filterPriority);
    }

    if (filterEnergy !== 'All') {
      filtered = filtered.filter((task) => task.energy === filterEnergy);
    }

    setFilteredTasks(filtered);
  };

  const handleDeleteTask = async (taskId: string) => {
    if (confirm('Are you sure you want to delete this task?')) {
      await db.tasks.delete(taskId);
      loadTasks();
    }
  };

  const domains: (Domain | 'All')[] = ['All', 'Work', 'SideHustle', 'Chore', 'Errand', 'Personal', 'Creative'];
  const priorities: (Priority | 'All')[] = ['All', 'High', 'Medium', 'Low'];
  const energyLevels: (Energy | 'All')[] = ['All', 'Low', 'Medium', 'High'];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-semibold text-gray-800">Task Library</h1>
          <p className="text-gray-600 mt-1">{tasks.length} active tasks</p>
        </div>
        <div className="flex gap-3">
          <button
            onClick={() => setShowArchive(true)}
            className="flex items-center gap-2 px-6 py-3 bg-gray-100 text-gray-700 rounded-lg font-semibold hover:bg-gray-200 transition-all shadow"
          >
            View Archive
          </button>
          <button
            onClick={() => {
              setEditingTask(null);
              setShowAddModal(true);
            }}
            className="flex items-center gap-2 px-6 py-3 bg-gray-800 text-white rounded-lg font-semibold hover:bg-gray-900 transition-all shadow"
          >
            <Plus size={20} />
            Add Task
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-lg shadow p-6">
        <div className="flex items-center gap-2 mb-4">
          <Filter size={20} className="text-gray-600" />
          <h3 className="font-semibold text-gray-700">Filters</h3>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Domain filter */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Domain</label>
            <select
              value={filterDomain}
              onChange={(e) => setFilterDomain(e.target.value as Domain | 'All')}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-800 focus:border-transparent"
            >
              {domains.map((domain) => (
                <option key={domain} value={domain}>
                  {domain}
                </option>
              ))}
            </select>
          </div>

          {/* Priority filter */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Priority</label>
            <select
              value={filterPriority}
              onChange={(e) => setFilterPriority(e.target.value as Priority | 'All')}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-800 focus:border-transparent"
            >
              {priorities.map((priority) => (
                <option key={priority} value={priority}>
                  {priority}
                </option>
              ))}
            </select>
          </div>

          {/* Energy filter */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Energy</label>
            <select
              value={filterEnergy}
              onChange={(e) => setFilterEnergy(e.target.value as Energy | 'All')}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-800 focus:border-transparent"
            >
              {energyLevels.map((energy) => (
                <option key={energy} value={energy}>
                  {energy}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Task list */}
      <div className="space-y-3">
        <AnimatePresence>
          {filteredTasks.map((task) => {
            const domainColor = getDomainColor(task.domain);
            return (
              <motion.div
                key={task.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                className="bg-white rounded-lg shadow p-4 border-l-4"
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
                        <Clock size={12} />
                        {task.estimateMins} min
                      </span>
                      <span className="text-xs text-gray-500 flex items-center gap-1">
                        <Zap size={12} />
                        {task.energy}
                      </span>
                      {task.priority === 'High' && (
                        <span className="text-xs text-red-500 font-semibold flex items-center gap-1">
                          <AlertCircle size={12} />
                          High Priority
                        </span>
                      )}
                      <span className="text-xs text-gray-500">{task.recurrence}</span>
                      {task.dread > 0 && (
                        <span className="text-xs text-orange-500 font-semibold">
                          Dread: {task.dread}
                        </span>
                      )}
                    </div>
                    <h3 className="font-semibold text-gray-800 text-lg mb-1">{task.title}</h3>
                    {task.notes && <p className="text-sm text-gray-600">{task.notes}</p>}
                    {task.deadline && (
                      <p className="text-xs text-gray-500 mt-2">
                        Due: {new Date(task.deadline).toLocaleDateString()}
                      </p>
                    )}
                  </div>

                  <div className="flex gap-2 ml-4">
                    <button
                      onClick={() => {
                        setEditingTask(task);
                        setShowAddModal(true);
                      }}
                      className="p-2 text-gray-600 hover:text-gray-800 hover:bg-gray-100 rounded-lg transition-all"
                    >
                      <Edit size={18} />
                    </button>
                    <button
                      onClick={() => handleDeleteTask(task.id!)}
                      className="p-2 text-red-600 hover:text-red-800 hover:bg-red-50 rounded-lg transition-all"
                    >
                      <Trash2 size={18} />
                    </button>
                  </div>
                </div>
              </motion.div>
            );
          })}
        </AnimatePresence>

        {filteredTasks.length === 0 && (
          <div className="text-center py-12 bg-white rounded-lg shadow">
            <p className="text-lg text-gray-500">No tasks found with these filters.</p>
            <button
              onClick={() => {
                setFilterDomain('All');
                setFilterPriority('All');
                setFilterEnergy('All');
              }}
              className="mt-4 px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg text-sm font-medium transition-all"
            >
              Clear Filters
            </button>
          </div>
        )}
      </div>

      {/* Add/Edit Modal */}
      {showAddModal && (
        <TaskModal
          task={editingTask}
          onClose={() => {
            setShowAddModal(false);
            setEditingTask(null);
          }}
          onSave={() => {
            setShowAddModal(false);
            setEditingTask(null);
            loadTasks();
          }}
        />
      )}
    </div>
  );
};

// Task Modal Component
interface TaskModalProps {
  task: Task | null;
  onClose: () => void;
  onSave: () => void;
}

const TaskModal = ({ task, onClose, onSave }: TaskModalProps) => {
  const [formData, setFormData] = useState<Partial<Task>>({
    title: task?.title || '',
    domain: task?.domain || 'Work',
    priority: task?.priority || 'Medium',
    energy: task?.energy || 'Medium',
    estimateMins: task?.estimateMins || 30,
    deadline: task?.deadline || null,
    dueDate: task?.dueDate || null,
    startDate: task?.startDate || null,
    recurrence: task?.recurrence || 'Once',
    daysOfWeek: task?.daysOfWeek || [],
    weeklyDay: task?.weeklyDay || null,
    notes: task?.notes || '',
    subtasks: task?.subtasks || [],
    status: task?.status || 'todo',
    dread: task?.dread || 0,
    snoozedUntil: task?.snoozedUntil || null,
    assignedDate: task?.assignedDate || null,
    lastCompletedAt: task?.lastCompletedAt || null,
    // Project chunking fields
    isProject: task?.isProject || false,
    totalEstimateMins: task?.totalEstimateMins || 30,
    remainingMins: task?.remainingMins || 30,
    preferredSliceSize: task?.preferredSliceSize || 30,
    // Wake-day scheduling fields
    taskType: task?.taskType || 'Flexible',
    fixedStartTime: task?.fixedStartTime || null,
    eligibleStartTime: task?.eligibleStartTime || null,
    mustFinishByTime: task?.mustFinishByTime || null,
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (task?.id) {
      // Update existing task
      await db.tasks.update(task.id, formData);
    } else {
      // Create new task
      await db.tasks.add({
        ...formData,
        id: crypto.randomUUID(),
        createdAt: new Date().toISOString(),
      } as Task);
    }

    onSave();
  };

  const domains: Domain[] = ['Work', 'SideHustle', 'Chore', 'Errand', 'Personal', 'Creative'];
  const priorities: Priority[] = ['High', 'Medium', 'Low'];
  const energyLevels: Energy[] = ['Low', 'Medium', 'High'];
  const recurrences: Recurrence[] = ['Once', 'Daily', 'Weekly', 'Monthly', 'CustomDays'];
  const taskTypes: TaskType[] = ['Fixed', 'Flexible', 'Recurring'];
  const sliceSizes = [15, 30, 45, 60];

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <motion.div
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        className="bg-white rounded-lg shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto"
      >
        <div className="p-6 border-b border-gray-200 flex items-center justify-between">
          <h2 className="text-2xl font-semibold text-gray-800">
            {task ? 'Edit Task' : 'Add New Task'}
          </h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X size={24} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {/* Title */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Task Title*</label>
            <input
              type="text"
              required
              value={formData.title}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-800 focus:border-transparent"
              placeholder="What needs to be done?"
            />
          </div>

          {/* Domain, Priority, Energy */}
          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Domain*</label>
              <select
                value={formData.domain}
                onChange={(e) => setFormData({ ...formData, domain: e.target.value as Domain })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-800 focus:border-transparent"
              >
                {domains.map((d) => (
                  <option key={d} value={d}>
                    {d}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Priority*</label>
              <select
                value={formData.priority}
                onChange={(e) => setFormData({ ...formData, priority: e.target.value as Priority })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-800 focus:border-transparent"
              >
                {priorities.map((p) => (
                  <option key={p} value={p}>
                    {p}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Energy*</label>
              <select
                value={formData.energy}
                onChange={(e) => setFormData({ ...formData, energy: e.target.value as Energy })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-800 focus:border-transparent"
              >
                {energyLevels.map((e) => (
                  <option key={e} value={e}>
                    {e}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Estimate, Recurrence */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Estimated Minutes*
              </label>
              <input
                type="number"
                required
                min="1"
                value={formData.estimateMins}
                onChange={(e) =>
                  setFormData({ ...formData, estimateMins: parseInt(e.target.value) })
                }
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-800 focus:border-transparent"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Recurrence*</label>
              <select
                value={formData.recurrence}
                onChange={(e) =>
                  setFormData({ ...formData, recurrence: e.target.value as Recurrence })
                }
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-800 focus:border-transparent"
              >
                {recurrences.map((r) => (
                  <option key={r} value={r}>
                    {r}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Start Date and Due Date */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Start Date (Optional)
              </label>
              <input
                type="date"
                value={formData.startDate?.split('T')[0] || ''}
                onChange={(e) => setFormData({ ...formData, startDate: e.target.value || null })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-800 focus:border-transparent"
              />
              <p className="text-xs text-gray-500 mt-1">Earliest date to schedule</p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                {formData.recurrence === 'Once' ? 'Due Date (Optional)' : 'Due Date (Optional)'}
              </label>
              <input
                type="date"
                value={formData.dueDate?.split('T')[0] || ''}
                onChange={(e) => setFormData({ ...formData, dueDate: e.target.value || null })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-800 focus:border-transparent"
              />
              <p className="text-xs text-gray-500 mt-1">
                {formData.recurrence === 'Once' ? 'Must be done by this date' : 'Deadline for this task'}
              </p>
            </div>
          </div>

          {/* Weekly Day Selector (shown only for Weekly recurrence) */}
          {formData.recurrence === 'Weekly' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Day of Week*
              </label>
              <select
                value={formData.weeklyDay || ''}
                onChange={(e) => setFormData({ ...formData, weeklyDay: e.target.value ? parseInt(e.target.value) : null })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-800 focus:border-transparent"
                required
              >
                <option value="">Select a day</option>
                <option value="1">Monday</option>
                <option value="2">Tuesday</option>
                <option value="3">Wednesday</option>
                <option value="4">Thursday</option>
                <option value="5">Friday</option>
                <option value="6">Saturday</option>
                <option value="7">Sunday</option>
              </select>
            </div>
          )}

          {/* Custom Days Selector (shown only for CustomDays recurrence) */}
          {formData.recurrence === 'CustomDays' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Days of Week*
              </label>
              <div className="grid grid-cols-7 gap-2">
                {[
                  { num: 1, name: 'Mon' },
                  { num: 2, name: 'Tue' },
                  { num: 3, name: 'Wed' },
                  { num: 4, name: 'Thu' },
                  { num: 5, name: 'Fri' },
                  { num: 6, name: 'Sat' },
                  { num: 7, name: 'Sun' },
                ].map((day) => (
                  <button
                    key={day.num}
                    type="button"
                    onClick={() => {
                      const currentDays = formData.daysOfWeek || [];
                      const newDays = currentDays.includes(day.num)
                        ? currentDays.filter(d => d !== day.num)
                        : [...currentDays, day.num].sort((a, b) => a - b);
                      setFormData({ ...formData, daysOfWeek: newDays });
                    }}
                    className={`px-3 py-2 rounded-lg text-sm font-medium transition-all ${
                      (formData.daysOfWeek || []).includes(day.num)
                        ? 'bg-gray-800 text-white'
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}
                  >
                    {day.name}
                  </button>
                ))}
              </div>
              <div className="mt-2 flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => setFormData({ ...formData, daysOfWeek: [1, 2, 3, 4, 5] })}
                  className="px-2 py-1 text-xs bg-blue-100 text-blue-700 rounded hover:bg-blue-200"
                >
                  Weekdays
                </button>
                <button
                  type="button"
                  onClick={() => setFormData({ ...formData, daysOfWeek: [6, 7] })}
                  className="px-2 py-1 text-xs bg-blue-100 text-blue-700 rounded hover:bg-blue-200"
                >
                  Weekends
                </button>
                <button
                  type="button"
                  onClick={() => setFormData({ ...formData, daysOfWeek: [1, 3, 5] })}
                  className="px-2 py-1 text-xs bg-blue-100 text-blue-700 rounded hover:bg-blue-200"
                >
                  Mon/Wed/Fri
                </button>
                <button
                  type="button"
                  onClick={() => setFormData({ ...formData, daysOfWeek: [2, 4] })}
                  className="px-2 py-1 text-xs bg-blue-100 text-blue-700 rounded hover:bg-blue-200"
                >
                  Tue/Thu
                </button>
              </div>
            </div>
          )}

          {/* Task Type & Time Windows Section */}
          <div className="border-t border-gray-200 pt-4">
            <h3 className="text-lg font-semibold text-gray-800 mb-4">Wake-Day Scheduling</h3>

            {/* Task Type */}
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">Task Type*</label>
              <select
                value={formData.taskType}
                onChange={(e) => setFormData({ ...formData, taskType: e.target.value as TaskType })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-800 focus:border-transparent"
              >
                {taskTypes.map((type) => (
                  <option key={type} value={type}>
                    {type}
                  </option>
                ))}
              </select>
              <p className="text-xs text-gray-500 mt-1">
                {formData.taskType === 'Fixed' && 'Must happen at a specific date/time'}
                {formData.taskType === 'Flexible' && 'Can happen anytime within your wake day'}
                {formData.taskType === 'Recurring' && 'Repeats on schedule, flexible within the day'}
              </p>
            </div>

            {/* Fixed Start Time (only for Fixed tasks) */}
            {formData.taskType === 'Fixed' && (
              <div className="mb-4 pl-4 border-l-2 border-orange-200 bg-orange-50 p-3 rounded-r-lg">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Fixed Start Time*
                </label>
                <input
                  type="datetime-local"
                  required={formData.taskType === 'Fixed'}
                  value={formData.fixedStartTime ? new Date(formData.fixedStartTime).toISOString().slice(0, 16) : ''}
                  onChange={(e) => setFormData({ ...formData, fixedStartTime: e.target.value ? new Date(e.target.value).toISOString() : null })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-800 focus:border-transparent"
                />
                <p className="text-xs text-gray-600 mt-1">
                  This task will be scheduled at exactly this time
                </p>
              </div>
            )}

            {/* Time Window (for Flexible tasks) */}
            {formData.taskType === 'Flexible' && (
              <div className="space-y-4 pl-4 border-l-2 border-blue-200 bg-blue-50 p-3 rounded-r-lg">
                <p className="text-sm text-gray-700 font-medium">
                  Optional: Specify when this task can be scheduled
                </p>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Earliest Start (HH:MM)
                    </label>
                    <input
                      type="time"
                      value={formData.eligibleStartTime || ''}
                      onChange={(e) => setFormData({ ...formData, eligibleStartTime: e.target.value || null })}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-800 focus:border-transparent"
                    />
                    <p className="text-xs text-gray-600 mt-1">e.g., 09:00 for morning only</p>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Must Finish By (HH:MM)
                    </label>
                    <input
                      type="time"
                      value={formData.mustFinishByTime || ''}
                      onChange={(e) => setFormData({ ...formData, mustFinishByTime: e.target.value || null })}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-800 focus:border-transparent"
                    />
                    <p className="text-xs text-gray-600 mt-1">e.g., 17:00 for before evening</p>
                  </div>
                </div>

                <div className="text-xs text-gray-600 bg-white p-2 rounded">
                  <strong>Example:</strong> Set "Earliest Start" to 14:00 and "Must Finish By" to 18:00 to schedule this task only in the afternoon.
                </div>
              </div>
            )}

            {/* Info for Recurring tasks */}
            {formData.taskType === 'Recurring' && (
              <div className="pl-4 border-l-2 border-green-200 bg-green-50 p-3 rounded-r-lg">
                <p className="text-sm text-gray-700">
                  <strong>Recurring tasks</strong> will appear on their scheduled days and can be placed flexibly within your wake day. Use the optional time window fields above if you need to constrain when they can be scheduled.
                </p>
              </div>
            )}
          </div>

          {/* Notes */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Notes (Optional)
            </label>
            <textarea
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              rows={3}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-800 focus:border-transparent resize-none"
              placeholder="Any additional details..."
            />
          </div>

          {/* Project Chunking Section */}
          <div className="border-t border-gray-200 pt-4">
            <div className="flex items-center gap-2 mb-4">
              <input
                type="checkbox"
                id="isProject"
                checked={formData.isProject}
                onChange={(e) => {
                  const isProject = e.target.checked;
                  setFormData({
                    ...formData,
                    isProject,
                    totalEstimateMins: isProject ? (formData.estimateMins || 30) : 30,
                    remainingMins: isProject ? (formData.estimateMins || 30) : 30,
                  });
                }}
                className="w-4 h-4 text-gray-800 border-gray-300 rounded focus:ring-gray-800"
              />
              <label htmlFor="isProject" className="text-sm font-medium text-gray-700">
                This is a long project (auto-chunk into Pomodoro slices)
              </label>
            </div>

            {formData.isProject && (
              <div className="space-y-4 pl-6 border-l-2 border-blue-200">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Total Project Time (minutes)*
                    </label>
                    <input
                      type="number"
                      required
                      min="30"
                      value={formData.totalEstimateMins}
                      onChange={(e) => {
                        const total = parseInt(e.target.value);
                        setFormData({
                          ...formData,
                          totalEstimateMins: total,
                          remainingMins: task ? formData.remainingMins : total,
                          estimateMins: total,
                        });
                      }}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-800 focus:border-transparent"
                    />
                    <p className="text-xs text-gray-500 mt-1">
                      E.g., 360 mins = 6-hour project
                    </p>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Preferred Slice Size*
                    </label>
                    <select
                      value={formData.preferredSliceSize}
                      onChange={(e) =>
                        setFormData({ ...formData, preferredSliceSize: parseInt(e.target.value) })
                      }
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-800 focus:border-transparent"
                    >
                      {sliceSizes.map((size) => (
                        <option key={size} value={size}>
                          {size} minutes
                        </option>
                      ))}
                    </select>
                    <p className="text-xs text-gray-500 mt-1">
                      Work in focused {formData.preferredSliceSize}-min sessions
                    </p>
                  </div>
                </div>

                {task && (
                  <div className="bg-blue-50 p-3 rounded-lg">
                    <div className="text-sm text-gray-700">
                      <strong>Progress:</strong>{' '}
                      {formData.totalEstimateMins - formData.remainingMins} of{' '}
                      {formData.totalEstimateMins} minutes completed
                    </div>
                    <div className="mt-2 bg-blue-200 rounded-full h-2">
                      <div
                        className="bg-blue-600 h-2 rounded-full"
                        style={{
                          width: `${
                            ((formData.totalEstimateMins - formData.remainingMins) /
                              formData.totalEstimateMins) *
                            100
                          }%`,
                        }}
                      />
                    </div>
                  </div>
                )}

                <div className="text-xs text-gray-600 bg-gray-50 p-3 rounded">
                  <strong>How it works:</strong> Your {formData.totalEstimateMins}-minute project will be
                  automatically split into {Math.ceil(formData.totalEstimateMins / formData.preferredSliceSize)}{' '}
                  slices of {formData.preferredSliceSize} minutes each. Only today's slice appears in your
                  daily plan. Time burns down as you complete each slice.
                </div>
              </div>
            )}
          </div>

          {/* Submit buttons */}
          <div className="flex gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-6 py-3 bg-gray-100 text-gray-700 rounded-lg font-semibold hover:bg-gray-200 transition-all"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="flex-1 px-6 py-3 bg-gray-800 text-white rounded-lg font-semibold hover:bg-gray-900 transition-all"
            >
              {task ? 'Update Task' : 'Add Task'}
            </button>
          </div>
        </form>
      </motion.div>
    </div>
  );
};
