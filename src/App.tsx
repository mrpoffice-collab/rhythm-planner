import { useState, useEffect } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Home, List, Settings as SettingsIcon, Calendar, Menu, X } from 'lucide-react';
import { Dashboard } from './components/Dashboard';
import { TaskLibrary } from './components/TaskLibrary';
import { Settings } from './components/Settings';
import { TodayView } from './components/TodayView';
import { Timer } from './components/Timer';
import { SkipReplacementModal } from './components/SkipReplacementModal';
import { Task, Energy, initializeDatabase, cleanupArchivedTasks } from './db/database';

type View = 'dashboard' | 'today' | 'library' | 'settings';

function App() {
  const [currentView, setCurrentView] = useState<View>('dashboard');
  const [currentEnergy, setCurrentEnergy] = useState<Energy>('Medium');
  const [activeTask, setActiveTask] = useState<Task | null>(null);
  const [blockDuration, setBlockDuration] = useState<number>(30);
  const [showTimer, setShowTimer] = useState(false);
  const [showSkipModal, setShowSkipModal] = useState(false);
  const [skippedTask, setSkippedTask] = useState<Task | null>(null);
  const [showAddTaskFromTimer, setShowAddTaskFromTimer] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const handleNavigateToView = (view: View) => {
    setCurrentView(view);
    setIsMobileMenuOpen(false); // Close mobile menu on navigation
  };

  useEffect(() => {
    // Initialize database on app load
    initializeDatabase();

    // Clean up old archived tasks based on retention policy
    cleanupArchivedTasks();
  }, []);

  const handleStartTask = (task: Task, duration: number) => {
    setActiveTask(task);
    setBlockDuration(duration);
    setShowTimer(true);
  };

  const handleTimerComplete = () => {
    setShowTimer(false);
    setActiveTask(null);
  };

  const handleSkip = (task: Task) => {
    setShowTimer(false);
    setSkippedTask(task);
    setShowSkipModal(true);
  };

  const handleSelectReplacement = (task: Task) => {
    setShowSkipModal(false);
    setSkippedTask(null);
    setActiveTask(task);
    setBlockDuration(task.estimateMins <= 30 ? 30 : 60);
    setShowTimer(true);
  };

  const handleCloseSkipModal = () => {
    setShowSkipModal(false);
    setSkippedTask(null);
  };

  const navItems: { id: View; label: string; icon: any }[] = [
    { id: 'dashboard', label: 'Dashboard', icon: Home },
    { id: 'today', label: 'Today', icon: Calendar },
    { id: 'library', label: 'Task Library', icon: List },
    { id: 'settings', label: 'Settings', icon: SettingsIcon },
  ];

  return (
    <div className="min-h-screen bg-background">
      {/* Mobile Header */}
      <header className="lg:hidden fixed top-0 left-0 right-0 bg-white shadow-md z-50 px-4 py-3 flex items-center justify-between">
        <div>
          <h1 className="text-lg font-bold text-gray-800">Rhythm Planner</h1>
          <p className="text-xs text-gray-500">
            {currentEnergy === 'Low' && '🌙 Low'}
            {currentEnergy === 'Medium' && '☀️ Medium'}
            {currentEnergy === 'High' && '⚡ High'}
          </p>
        </div>
        <button
          onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
          className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          aria-label="Toggle menu"
        >
          {isMobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
        </button>
      </header>

      {/* Mobile Menu Overlay */}
      <AnimatePresence>
        {isMobileMenuOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="lg:hidden fixed inset-0 bg-black/50 z-40"
              onClick={() => setIsMobileMenuOpen(false)}
            />
            <motion.aside
              initial={{ x: '-100%' }}
              animate={{ x: 0 }}
              exit={{ x: '-100%' }}
              transition={{ type: 'tween', duration: 0.3 }}
              className="lg:hidden fixed left-0 top-0 h-full w-64 bg-white shadow-lg z-50"
            >
              <div className="p-6 border-b border-gray-200">
                <h1 className="text-2xl font-bold text-gray-800">Rhythm Planner</h1>
                <p className="text-xs text-gray-500 mt-1">Local-first life management</p>
              </div>

              <nav className="p-4 space-y-2">
                {navItems.map((item) => {
                  const Icon = item.icon;
                  const isActive = currentView === item.id;
                  return (
                    <button
                      key={item.id}
                      onClick={() => handleNavigateToView(item.id)}
                      className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg font-medium transition-all ${
                        isActive
                          ? 'bg-gray-800 text-white shadow-md'
                          : 'text-gray-700 hover:bg-gray-100'
                      }`}
                    >
                      <Icon size={20} />
                      {item.label}
                    </button>
                  );
                })}
              </nav>

              {/* Energy indicator in sidebar */}
              <div className="absolute bottom-0 left-0 right-0 p-4 border-t border-gray-200 bg-gray-50">
                <div className="text-xs text-gray-500 mb-1">Current Energy</div>
                <div className="text-sm font-semibold text-gray-800">
                  {currentEnergy === 'Low' && '🌙 Low Energy'}
                  {currentEnergy === 'Medium' && '☀️ Medium Energy'}
                  {currentEnergy === 'High' && '⚡ High Energy'}
                </div>
              </div>
            </motion.aside>
          </>
        )}
      </AnimatePresence>

      {/* Desktop Sidebar Navigation */}
      <aside className="hidden lg:block fixed left-0 top-0 h-full w-64 bg-white shadow-lg z-40">
        <div className="p-6 border-b border-gray-200">
          <h1 className="text-2xl font-bold text-gray-800">Rhythm Planner</h1>
          <p className="text-xs text-gray-500 mt-1">Local-first life management</p>
        </div>

        <nav className="p-4 space-y-2">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = currentView === item.id;
            return (
              <button
                key={item.id}
                onClick={() => setCurrentView(item.id)}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg font-medium transition-all ${
                  isActive
                    ? 'bg-gray-800 text-white shadow-md'
                    : 'text-gray-700 hover:bg-gray-100'
                }`}
              >
                <Icon size={20} />
                {item.label}
              </button>
            );
          })}
        </nav>

        {/* Energy indicator in sidebar */}
        <div className="absolute bottom-0 left-0 right-0 p-4 border-t border-gray-200 bg-gray-50">
          <div className="text-xs text-gray-500 mb-1">Current Energy</div>
          <div className="text-sm font-semibold text-gray-800">
            {currentEnergy === 'Low' && '🌙 Low Energy'}
            {currentEnergy === 'Medium' && '☀️ Medium Energy'}
            {currentEnergy === 'High' && '⚡ High Energy'}
          </div>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="lg:ml-64 pt-16 lg:pt-0 p-4 sm:p-6 lg:p-8">
        <AnimatePresence mode="wait">
          {currentView === 'dashboard' && (
            <Dashboard
              key="dashboard"
              onStartTask={handleStartTask}
              currentEnergy={currentEnergy}
              onEnergyChange={setCurrentEnergy}
              onNavigateToView={handleNavigateToView}
            />
          )}
          {currentView === 'today' && (
            <TodayView
              key="today"
              onStartTask={handleStartTask}
            />
          )}
          {currentView === 'library' && <TaskLibrary key="library" />}
          {currentView === 'settings' && <Settings key="settings" />}
        </AnimatePresence>
      </main>

      {/* Timer Modal */}
      <AnimatePresence>
        {showTimer && activeTask && (
          <Timer
            task={activeTask}
            blockDuration={blockDuration}
            onComplete={handleTimerComplete}
            onSkip={handleSkip}
            onClose={() => setShowTimer(false)}
            currentEnergy={currentEnergy}
            onAddTask={() => {
              setShowAddTaskFromTimer(true);
              setCurrentView('library');
            }}
          />
        )}
      </AnimatePresence>

      {/* Skip Replacement Modal */}
      <AnimatePresence>
        {showSkipModal && skippedTask && (
          <SkipReplacementModal
            skippedTask={skippedTask}
            currentEnergy={currentEnergy}
            availableMinutes={60}
            onSelectTask={handleSelectReplacement}
            onClose={handleCloseSkipModal}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

export default App;
