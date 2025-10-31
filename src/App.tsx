import { useState, useEffect } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Home, List, Settings as SettingsIcon, Calendar, Menu, X } from 'lucide-react';
import { Dashboard } from './components/Dashboard';
import { TaskLibrary } from './components/TaskLibrary';
import { Settings } from './components/Settings';
import { TodayView } from './components/TodayView';
import { Timer } from './components/Timer';
import { SkipReplacementModal } from './components/SkipReplacementModal';
import { WelcomeScreen } from './components/WelcomeScreen';
import { EndOfDayReview } from './components/EndOfDayReview';
import { ErrorBoundary } from './components/ErrorBoundary';
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
  const [showWelcome, setShowWelcome] = useState(false);
  const [showEndOfDay, setShowEndOfDay] = useState(false);

  const handleNavigateToView = (view: View) => {
    setCurrentView(view);
    setIsMobileMenuOpen(false); // Close mobile menu on navigation
  };

  useEffect(() => {
    // Initialize database on app load
    initializeDatabase();

    // Clean up old archived tasks based on retention policy
    cleanupArchivedTasks();

    // Check if user has completed onboarding
    const hasOnboarded = localStorage.getItem('rhythmPlanner_onboarded');
    if (!hasOnboarded) {
      setShowWelcome(true);
    }

    // Check if it's evening and user should review their day
    checkForEndOfDayPrompt();

    // Request notification permissions if not already granted
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission();
    }
  }, []);

  const checkForEndOfDayPrompt = () => {
    const lastDayEnd = localStorage.getItem('rhythmPlanner_lastDayEnd');
    const lastDayStart = localStorage.getItem('rhythmPlanner_lastDayStart');
    const currentHour = new Date().getHours();

    // Show end of day review if:
    // 1. It's between 8pm and 11pm
    // 2. User started their day but hasn't ended it yet
    // 3. Not already shown today
    if (currentHour >= 20 && currentHour < 23 && lastDayStart) {
      const todayString = new Date().toISOString().split('T')[0];
      const lastEndDate = lastDayEnd ? new Date(lastDayEnd).toISOString().split('T')[0] : null;

      if (lastEndDate !== todayString) {
        // Wait a bit before showing (not immediately on load)
        setTimeout(() => setShowEndOfDay(true), 5000);
      }
    }
  };

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
    <ErrorBoundary>
      <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-gray-100">
      {/* Mobile Header */}
      <header className="lg:hidden fixed top-0 left-0 right-0 bg-white/80 backdrop-blur-lg shadow-md z-50 px-4 py-3 flex items-center justify-between border-b border-gray-200/50">
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
              transition={{ duration: 0.2 }}
              className="lg:hidden fixed inset-0 bg-black/60 backdrop-blur-sm z-40"
              onClick={() => setIsMobileMenuOpen(false)}
            />
            <motion.aside
              initial={{ x: '-100%', opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              exit={{ x: '-100%', opacity: 0 }}
              transition={{ type: 'spring', stiffness: 300, damping: 30 }}
              className="lg:hidden fixed left-0 top-0 h-full w-64 bg-white/95 backdrop-blur-xl shadow-2xl z-50 border-r border-gray-200/50"
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
                    <motion.button
                      key={item.id}
                      onClick={() => handleNavigateToView(item.id)}
                      whileHover={{ scale: isActive ? 1 : 1.02, x: isActive ? 0 : 4 }}
                      whileTap={{ scale: 0.98 }}
                      className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl font-semibold transition-all ${
                        isActive
                          ? 'bg-gradient-to-r from-gray-800 to-gray-700 text-white shadow-lg'
                          : 'text-gray-700 hover:bg-gray-100/80 hover:shadow-sm'
                      }`}
                    >
                      <Icon size={20} />
                      {item.label}
                    </motion.button>
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
      <aside className="hidden lg:block fixed left-0 top-0 h-full w-64 bg-white/90 backdrop-blur-xl shadow-2xl z-40 border-r border-gray-200/50">
        <div className="p-6 border-b border-gray-200/50 bg-gradient-to-br from-gray-50 to-white">
          <h1 className="text-2xl font-bold bg-gradient-to-r from-gray-800 to-gray-600 bg-clip-text text-transparent">Rhythm Planner</h1>
          <p className="text-xs text-gray-600 mt-1 font-medium">Local-first life management</p>
        </div>

        <nav className="p-4 space-y-2">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = currentView === item.id;
            return (
              <motion.button
                key={item.id}
                onClick={() => setCurrentView(item.id)}
                whileHover={{ scale: isActive ? 1 : 1.02, x: isActive ? 0 : 4 }}
                whileTap={{ scale: 0.98 }}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl font-semibold transition-all ${
                  isActive
                    ? 'bg-gradient-to-r from-gray-800 to-gray-700 text-white shadow-lg'
                    : 'text-gray-700 hover:bg-gray-100/80 hover:shadow-sm'
                }`}
              >
                <Icon size={20} />
                {item.label}
              </motion.button>
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
            <motion.div
              key="dashboard"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.3 }}
            >
              <Dashboard
                onStartTask={handleStartTask}
                currentEnergy={currentEnergy}
                onEnergyChange={setCurrentEnergy}
                onNavigateToView={handleNavigateToView}
                onShowEndOfDay={() => setShowEndOfDay(true)}
              />
            </motion.div>
          )}
          {currentView === 'today' && (
            <motion.div
              key="today"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.3 }}
            >
              <TodayView
                onStartTask={handleStartTask}
              />
            </motion.div>
          )}
          {currentView === 'library' && (
            <motion.div
              key="library"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.3 }}
            >
              <TaskLibrary />
            </motion.div>
          )}
          {currentView === 'settings' && (
            <motion.div
              key="settings"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.3 }}
            >
              <Settings />
            </motion.div>
          )}
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

      {/* Welcome Screen */}
      <AnimatePresence>
        {showWelcome && (
          <WelcomeScreen
            onComplete={() => setShowWelcome(false)}
          />
        )}
      </AnimatePresence>

      {/* End of Day Review */}
      <AnimatePresence>
        {showEndOfDay && (
          <EndOfDayReview
            onClose={() => setShowEndOfDay(false)}
            onPlanTomorrow={() => {
              setShowEndOfDay(false);
              setCurrentView('today');
            }}
          />
        )}
      </AnimatePresence>
    </div>
    </ErrorBoundary>
  );
}

export default App;
