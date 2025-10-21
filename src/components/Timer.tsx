import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Play, Pause, SkipForward, X, Minimize2, ChevronUp, Plus, Square, Bell, BellOff, Volume2 } from 'lucide-react';
import { Task, Session, Energy, db } from '../db/database';
import { getDomainColor } from '../utils/domainColors';
import { playSound, unlockAudio } from '../utils/soundPlayer';

interface TimerSegment {
  type: 'focus' | 'break';
  duration: number; // in minutes
}

interface TimerProps {
  task: Task;
  blockDuration: number;
  onComplete: () => void;
  onSkip: (task: Task) => void;
  onClose: () => void;
  currentEnergy: Energy;
  onAddTask?: () => void;
}

export const Timer = ({ task, blockDuration, onComplete, onSkip, onClose, currentEnergy, onAddTask }: TimerProps) => {
  const totalDuration = task.estimateMins;
  const showSplitBar = totalDuration > 30;

  // Split/Break controls
  const [numChunks, setNumChunks] = useState(Math.min(12, Math.max(1, Math.ceil(totalDuration / 60))));
  const [breakMinutes, setBreakMinutes] = useState(5);
  const [bellEnabled, setBellEnabled] = useState(true);
  const [bellVolume, setBellVolume] = useState(50);

  // Timer state
  const [segments, setSegments] = useState<TimerSegment[]>([]);
  const [currentSegmentIndex, setCurrentSegmentIndex] = useState(0);
  const [timeRemaining, setTimeRemaining] = useState(0); // in seconds
  const [isRunning, setIsRunning] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [position, setPosition] = useState({ x: window.innerWidth - 320, y: window.innerHeight - 120 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });

  const sessionIdRef = useRef<string | null>(null);
  const startTimeRef = useRef<string | null>(null);
  const inactivityTimerRef = useRef<NodeJS.Timeout | null>(null);
  const audioUnlockedRef = useRef(false);

  const domainColor = getDomainColor(task.domain);

  // Calculate preview text for split plan
  const calculatePreview = () => {
    if (numChunks === 1 || breakMinutes === 0) {
      if (numChunks === 1 && breakMinutes === 0) {
        return `${totalDuration}m → continuous (no breaks)`;
      }
      if (breakMinutes === 0) {
        const focusLen = Math.floor(totalDuration / numChunks);
        return `${totalDuration}m → ${numChunks} × ${focusLen}m (no breaks)`;
      }
    }

    const focusLen = Math.floor(totalDuration / numChunks);
    const numBreaks = numChunks - 1;
    return `${totalDuration}m → ${numChunks} × ${focusLen}m + ${numBreaks} × ${breakMinutes}m breaks`;
  };

  // Build segment plan on Start
  const buildSegmentPlan = (): TimerSegment[] => {
    if (numChunks === 1) {
      return [{ type: 'focus', duration: totalDuration }];
    }

    const baseFocusLen = Math.floor(totalDuration / numChunks);
    const remainder = totalDuration % numChunks;
    const plan: TimerSegment[] = [];

    for (let i = 0; i < numChunks; i++) {
      // Distribute remainder into first segments
      const focusDuration = i < remainder ? baseFocusLen + 1 : baseFocusLen;
      plan.push({ type: 'focus', duration: focusDuration });

      // Add break after all but last segment
      if (i < numChunks - 1 && breakMinutes > 0) {
        plan.push({ type: 'break', duration: breakMinutes });
      }
    }

    return plan;
  };

  // Timer countdown with segment transitions
  useEffect(() => {
    let interval: NodeJS.Timeout | null = null;

    if (isRunning && timeRemaining > 0) {
      interval = setInterval(() => {
        setTimeRemaining((prev) => {
          if (prev <= 1) {
            // Segment complete
            handleSegmentComplete();
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }

    return () => {
      if (interval) clearInterval(interval);
    };
  }, [isRunning, timeRemaining]);

  const handleSegmentComplete = async () => {
    const currentSegment = segments[currentSegmentIndex];

    // Play segment end sound
    if (bellEnabled && audioUnlockedRef.current) {
      await playSound('segment-end');
    }

    // Check if there are more segments
    if (currentSegmentIndex < segments.length - 1) {
      // Move to next segment
      const nextIndex = currentSegmentIndex + 1;
      const nextSegment = segments[nextIndex];

      setCurrentSegmentIndex(nextIndex);
      setTimeRemaining(nextSegment.duration * 60);

      // Play start sound for next segment
      if (bellEnabled && audioUnlockedRef.current) {
        await playSound(nextSegment.type === 'focus' ? 'focus-start' : 'break-start');
      }
    } else {
      // All segments complete
      handleComplete();
    }
  };

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'm' || e.key === 'M') {
        e.preventDefault();
        setIsMinimized(prev => !prev);
      }
      if (e.key === 'Escape') {
        e.preventDefault();
        if (!isMinimized) {
          setIsMinimized(true);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isMinimized]);

  // Auto-collapse after 3s inactivity when minimized
  useEffect(() => {
    if (isMinimized && !isCollapsed) {
      inactivityTimerRef.current = setTimeout(() => {
        setIsCollapsed(true);
      }, 3000);
    }

    return () => {
      if (inactivityTimerRef.current) {
        clearTimeout(inactivityTimerRef.current);
      }
    };
  }, [isMinimized, isCollapsed]);

  // Persist position to sessionStorage
  useEffect(() => {
    sessionStorage.setItem('timerPosition', JSON.stringify(position));
  }, [position]);

  // Restore position from sessionStorage on mount
  useEffect(() => {
    const saved = sessionStorage.getItem('timerPosition');
    if (saved) {
      const parsed = JSON.parse(saved);
      setPosition(parsed);
    }
  }, []);

  const handleStart = async () => {
    if (!isRunning) {
      // Unlock audio on user gesture
      if (bellEnabled && !audioUnlockedRef.current) {
        const unlocked = await unlockAudio();
        audioUnlockedRef.current = unlocked;
        if (!unlocked) {
          // Show toast notification
          window.dispatchEvent(new CustomEvent('audio-blocked'));
        }
      }

      // Build segment plan
      const plan = buildSegmentPlan();
      setSegments(plan);
      setCurrentSegmentIndex(0);
      setTimeRemaining(plan[0].duration * 60);

      setIsRunning(true);
      setIsPaused(false);

      // Create session in database
      const sessionId = crypto.randomUUID();
      const startTime = new Date().toISOString();

      sessionIdRef.current = sessionId;
      startTimeRef.current = startTime;

      await db.sessions.add({
        id: sessionId,
        taskId: task.id!,
        blockType: `${task.domain}-${totalDuration}`,
        startTime,
        endTime: null,
        energyNow: currentEnergy,
        earnedMins: 0,
        completed: false,
        skipped: false,
      });

      // Play focus start sound
      if (bellEnabled && audioUnlockedRef.current) {
        await playSound('focus-start');
      }
    }
  };

  const handlePause = () => {
    setIsRunning(false);
    setIsPaused(true);
  };

  const handleResume = () => {
    setIsRunning(true);
    setIsPaused(false);
  };

  const handleComplete = async () => {
    setIsRunning(false);

    // Calculate total earned minutes from all focus segments
    const earnedMins = segments
      .filter(seg => seg.type === 'focus')
      .reduce((sum, seg) => sum + seg.duration, 0);

    // Update session in database
    if (sessionIdRef.current) {
      await db.sessions.update(sessionIdRef.current, {
        endTime: new Date().toISOString(),
        earnedMins,
        completed: true,
      });
    }

    // Update task based on type (project vs regular task)
    const now = new Date().toISOString();

    if (task.isProject) {
      // For projects: burn time from remaining minutes
      const newRemaining = Math.max(0, task.remainingMins - earnedMins);
      const updates: Partial<Task> = {
        remainingMins: newRemaining,
        lastCompletedAt: now,
        assignedDate: null
      };

      // If project is complete, mark as done
      if (newRemaining <= 0) {
        updates.status = 'done';
      }

      await db.tasks.update(task.id!, updates);
    } else {
      // Regular tasks: handle based on recurrence type
      if (task.recurrence === 'Once') {
        // One-time tasks: mark as done
        await db.tasks.update(task.id!, {
          status: 'done',
          lastCompletedAt: now,
          assignedDate: null
        });
      } else {
        // Recurring tasks: record completion but keep as todo, clear assignedDate
        await db.tasks.update(task.id!, {
          lastCompletedAt: now,
          assignedDate: null
        });
      }
    }

    // Play plan complete sound
    if (bellEnabled && audioUnlockedRef.current) {
      await playSound('plan-complete');
    }

    // Trigger dashboard reload
    window.dispatchEvent(new CustomEvent('timer-complete'));

    onComplete();
  };

  const handleSkip = async () => {
    setIsRunning(false);

    // Update session as skipped
    if (sessionIdRef.current) {
      await db.sessions.update(sessionIdRef.current, {
        endTime: new Date().toISOString(),
        earnedMins: 0,
        skipped: true,
      });
    }

    // Increment dread and snooze
    const snoozedUntil = new Date(Date.now() + 90 * 60 * 1000).toISOString(); // 90 minutes
    await db.tasks.update(task.id!, {
      dread: task.dread + 1,
      snoozedUntil,
    });

    onSkip(task);
  };

  const handleSkipBreak = () => {
    if (segments[currentSegmentIndex]?.type === 'break') {
      // Skip to next segment (should be focus)
      if (currentSegmentIndex < segments.length - 1) {
        const nextIndex = currentSegmentIndex + 1;
        const nextSegment = segments[nextIndex];
        setCurrentSegmentIndex(nextIndex);
        setTimeRemaining(nextSegment.duration * 60);

        // Play focus start sound
        if (bellEnabled && audioUnlockedRef.current) {
          playSound('focus-start');
        }
      } else {
        // No more segments, complete
        handleComplete();
      }
    }
  };

  const handleExtendFocus = () => {
    if (segments[currentSegmentIndex]?.type === 'focus') {
      // Add 5 minutes to current segment only
      setTimeRemaining(prev => prev + 5 * 60);
    }
  };

  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    setIsDragging(true);
    setDragStart({ x: e.clientX - position.x, y: e.clientY - position.y });
  };

  const handleMouseMove = (e: MouseEvent) => {
    if (isDragging) {
      const newX = Math.max(0, Math.min(window.innerWidth - 300, e.clientX - dragStart.x));
      const newY = Math.max(0, Math.min(window.innerHeight - 100, e.clientY - dragStart.y));
      setPosition({ x: newX, y: newY });
    }
  };

  const handleMouseUp = () => {
    if (isDragging) {
      setIsDragging(false);
      // Snap to nearest corner
      const centerX = position.x + 150;
      const centerY = position.y + 50;
      const snapX = centerX < window.innerWidth / 2 ? 20 : window.innerWidth - 320;
      const snapY = centerY < window.innerHeight / 2 ? 20 : window.innerHeight - 120;
      setPosition({ x: snapX, y: snapY });
    }
  };

  useEffect(() => {
    if (isDragging) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
      return () => {
        window.removeEventListener('mousemove', handleMouseMove);
        window.removeEventListener('mouseup', handleMouseUp);
      };
    }
  }, [isDragging, dragStart, position]);

  const resetInactivityTimer = () => {
    if (isCollapsed) {
      setIsCollapsed(false);
    }
    if (inactivityTimerRef.current) {
      clearTimeout(inactivityTimerRef.current);
    }
  };

  // Get current focus segment number (ignoring breaks)
  const getCurrentFocusSegment = () => {
    let focusCount = 0;
    for (let i = 0; i <= currentSegmentIndex; i++) {
      if (segments[i]?.type === 'focus') {
        focusCount++;
      }
    }
    return focusCount;
  };

  const getTotalFocusSegments = () => {
    return segments.filter(seg => seg.type === 'focus').length;
  };

  const getCurrentSegmentType = () => {
    return segments[currentSegmentIndex]?.type || 'focus';
  };

  const handleStop = async () => {
    setIsRunning(false);

    // Update session as stopped
    if (sessionIdRef.current) {
      const elapsed = blockDuration * 60 - timeRemaining;
      const earnedMins = Math.floor(elapsed / 60);

      await db.sessions.update(sessionIdRef.current, {
        endTime: new Date().toISOString(),
        earnedMins,
        completed: false,
      });
    }

    // Clear assignment but don't mark as done
    await db.tasks.update(task.id!, {
      assignedDate: null
    });

    onClose();
  };

  // Calculate progress for current segment
  const currentSegmentDuration = segments[currentSegmentIndex]?.duration || totalDuration;
  const currentSegmentTotal = currentSegmentDuration * 60;
  const progress = ((currentSegmentTotal - timeRemaining) / currentSegmentTotal) * 100;
  const circumference = 2 * Math.PI * 120; // radius = 120
  const strokeDashoffset = circumference - (progress / 100) * circumference;

  // Collapsed icon state
  if (isMinimized && isCollapsed) {
    return (
      <motion.div
        initial={{ scale: 0.8, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.8, opacity: 0 }}
        className="fixed w-16 h-16 rounded-full shadow-2xl flex items-center justify-center cursor-pointer z-[60]"
        style={{
          left: position.x,
          top: position.y,
          backgroundColor: domainColor,
          pointerEvents: 'auto'
        }}
        onClick={() => setIsCollapsed(false)}
        onMouseEnter={resetInactivityTimer}
        whileHover={{ scale: 1.1 }}
      >
        <div className="text-white text-center">
          <div className="text-sm font-bold">{formatTime(timeRemaining).split(':')[0]}</div>
          <div className="text-xs">{formatTime(timeRemaining).split(':')[1]}</div>
        </div>
      </motion.div>
    );
  }

  // Mini-player state
  if (isMinimized) {
    return (
      <motion.div
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.9, opacity: 0 }}
        className="fixed rounded-xl shadow-2xl z-[60] cursor-move"
        style={{
          left: position.x,
          top: position.y,
          width: '300px',
          backgroundColor: 'white',
          borderLeft: `4px solid ${domainColor}`,
          pointerEvents: 'auto'
        }}
        onMouseDown={handleMouseDown}
        onMouseEnter={resetInactivityTimer}
        onMouseMove={resetInactivityTimer}
      >
        <div className="p-3">
          {/* Header */}
          <div className="flex items-center justify-between mb-2">
            <button
              onClick={() => setIsMinimized(false)}
              className="flex items-center gap-1 text-gray-700 hover:text-gray-900 text-sm font-medium"
            >
              <ChevronUp size={16} />
              <span className="truncate max-w-[120px]">{task.title}</span>
              {segments.length > 0 && (
                <span className="text-xs text-gray-500">
                  • {getCurrentFocusSegment()}/{getTotalFocusSegments()}
                </span>
              )}
            </button>
            <div className="text-lg font-bold" style={{ color: domainColor }}>
              {formatTime(timeRemaining)}
            </div>
          </div>

          {/* Controls */}
          <div className="flex items-center gap-2 flex-wrap">
            {!isRunning && !isPaused && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  handleStart();
                }}
                className="flex items-center gap-1 px-3 py-1.5 rounded text-white text-sm font-medium hover:opacity-90"
                style={{ backgroundColor: domainColor }}
              >
                <Play size={14} />
                Start
              </button>
            )}

            {isRunning && (
              <>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handlePause();
                  }}
                  className="flex items-center gap-1 px-2 py-1 bg-gray-700 text-white rounded text-xs font-medium hover:bg-gray-800"
                >
                  <Pause size={12} />
                </button>

                {getCurrentSegmentType() === 'focus' && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleExtendFocus();
                    }}
                    className="px-2 py-1 bg-blue-500 text-white rounded text-xs font-medium hover:bg-blue-600"
                    title="Add 5 minutes"
                  >
                    +5m
                  </button>
                )}

                {getCurrentSegmentType() === 'break' && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleSkipBreak();
                    }}
                    className="flex items-center gap-1 px-2 py-1 bg-green-500 text-white rounded text-xs font-medium hover:bg-green-600"
                  >
                    <SkipForward size={12} />
                  </button>
                )}
              </>
            )}

            {isPaused && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  handleResume();
                }}
                className="flex items-center gap-1 px-3 py-1.5 rounded text-white text-sm font-medium hover:opacity-90"
                style={{ backgroundColor: domainColor }}
              >
                <Play size={14} />
              </button>
            )}

            <button
              onClick={(e) => {
                e.stopPropagation();
                handleStop();
              }}
              className="flex items-center gap-1 px-2 py-1 bg-red-500 text-white rounded text-xs font-medium hover:bg-red-600"
            >
              <Square size={12} />
            </button>

            {onAddTask && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onAddTask();
                }}
                className="flex items-center gap-1 px-2 py-1 bg-blue-500 text-white rounded text-xs font-medium hover:bg-blue-600 ml-auto"
                title="Add Task"
              >
                <Plus size={12} />
              </button>
            )}
          </div>
        </div>
      </motion.div>
    );
  }

  // Full panel state
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <motion.div
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.9, opacity: 0 }}
        className="bg-white rounded-lg shadow-lg w-full max-w-lg p-4 sm:p-6 lg:p-8 relative max-h-[90vh] overflow-y-auto"
        style={{ borderTop: `4px solid ${domainColor}` }}
      >
        {/* Header controls */}
        <div className="absolute top-4 right-4 flex items-center gap-2">
          <button
            onClick={() => setIsMinimized(true)}
            className="text-gray-400 hover:text-gray-600 transition-colors"
            title="Minimize (M)"
          >
            <Minimize2 size={20} />
          </button>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <X size={24} />
          </button>
        </div>

        {/* Task title */}
        <div className="text-center mb-4 sm:mb-6">
          <h2 className="text-xl sm:text-2xl font-semibold text-gray-800 mb-2 pr-16">{task.title}</h2>
          <div className="flex items-center justify-center gap-2 flex-wrap">
            <span
              className="inline-block px-3 py-1 rounded-full text-xs sm:text-sm font-medium text-white"
              style={{ backgroundColor: domainColor }}
            >
              {task.domain}
            </span>
            <span className="text-gray-500 text-xs sm:text-sm">{totalDuration} min total</span>
            {isRunning && segments.length > 0 && (
              <span className="text-gray-500 text-xs sm:text-sm">
                • segment {getCurrentFocusSegment()}/{getTotalFocusSegments()}
                {getCurrentSegmentType() === 'break' ? ' (break)' : ''}
              </span>
            )}
          </div>
        </div>

        {/* Split/Break controls (only before start) */}
        {!isRunning && !isPaused && showSplitBar && (
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
            <div className="grid grid-cols-2 gap-4 mb-3">
              <div>
                <label className="text-xs font-medium text-gray-700 block mb-1">Chunks (N)</label>
                <input
                  type="number"
                  min="1"
                  max="12"
                  value={numChunks}
                  onChange={(e) => setNumChunks(Math.min(12, Math.max(1, parseInt(e.target.value) || 1)))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
              <div>
                <label className="text-xs font-medium text-gray-700 block mb-1">Break (min)</label>
                <input
                  type="number"
                  min="0"
                  max="30"
                  value={breakMinutes}
                  onChange={(e) => setBreakMinutes(Math.min(30, Math.max(0, parseInt(e.target.value) || 0)))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
            </div>

            <div className="text-xs text-blue-900 mb-3 font-medium">
              {calculatePreview()}
            </div>

            <div className="flex items-center justify-between">
              <button
                onClick={() => setBellEnabled(!bellEnabled)}
                className="flex items-center gap-2 text-sm text-gray-700 hover:text-gray-900"
              >
                {bellEnabled ? <Bell size={16} /> : <BellOff size={16} />}
                <span>{bellEnabled ? 'Bell On' : 'Bell Off'}</span>
              </button>
              {bellEnabled && (
                <div className="flex items-center gap-2">
                  <Volume2 size={14} className="text-gray-500" />
                  <input
                    type="range"
                    min="0"
                    max="100"
                    value={bellVolume}
                    onChange={(e) => setBellVolume(parseInt(e.target.value))}
                    className="w-24"
                  />
                  <span className="text-xs text-gray-500">{bellVolume}%</span>
                </div>
              )}
            </div>
            <div className="text-xs text-gray-500 mt-1">
              Play at start/end & break transitions
            </div>
          </div>
        )}

        {/* Circular timer */}
        <div className="relative w-48 h-48 sm:w-56 sm:h-56 lg:w-64 lg:h-64 mx-auto mb-6 sm:mb-8">
          <svg className="transform -rotate-90 w-full h-full" viewBox="0 0 256 256">
            {/* Background circle */}
            <circle
              cx="128"
              cy="128"
              r="120"
              stroke="#E5E7EB"
              strokeWidth="8"
              fill="none"
            />
            {/* Progress circle */}
            <motion.circle
              cx="128"
              cy="128"
              r="120"
              stroke={domainColor}
              strokeWidth="8"
              fill="none"
              strokeLinecap="round"
              style={{
                strokeDasharray: circumference,
                strokeDashoffset,
              }}
              animate={{ strokeDashoffset }}
              transition={{ duration: 0.5, ease: 'linear' }}
            />
          </svg>

          {/* Time display */}
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="text-center">
              <div className="text-3xl sm:text-4xl lg:text-5xl font-semibold text-gray-800 mb-2">
                {formatTime(timeRemaining)}
              </div>
              <div className="text-xs sm:text-sm text-gray-500">
                {isRunning ? 'In Progress' : isPaused ? 'Paused' : 'Ready to Start'}
              </div>
            </div>
          </div>
        </div>

        {/* Controls */}
        <div className="flex items-center justify-center gap-2 sm:gap-3 flex-wrap">
          {!isRunning && !isPaused && (
            <button
              onClick={handleStart}
              className="flex items-center justify-center gap-2 px-6 py-3 rounded-lg font-semibold text-white transition-all hover:scale-105 shadow min-h-[48px]"
              style={{ backgroundColor: domainColor }}
            >
              <Play size={20} />
              Start Session
            </button>
          )}

          {isRunning && (
            <>
              <button
                onClick={handlePause}
                className="flex items-center justify-center gap-2 px-4 py-2 bg-gray-700 text-white rounded-lg font-medium hover:bg-gray-800 transition-all shadow text-sm min-h-[44px]"
              >
                <Pause size={16} />
                <span className="hidden sm:inline">Pause</span>
              </button>

              {getCurrentSegmentType() === 'focus' && (
                <button
                  onClick={handleExtendFocus}
                  className="flex items-center justify-center gap-1 px-4 py-2 bg-blue-500 text-white rounded-lg font-medium hover:bg-blue-600 transition-all shadow text-sm min-h-[44px]"
                  title="Add 5 minutes to this focus segment"
                >
                  +5m
                </button>
              )}

              {getCurrentSegmentType() === 'break' && (
                <button
                  onClick={handleSkipBreak}
                  className="flex items-center justify-center gap-2 px-4 py-2 bg-green-500 text-white rounded-lg font-medium hover:bg-green-600 transition-all shadow text-sm min-h-[44px]"
                >
                  <SkipForward size={16} />
                  <span className="hidden sm:inline">Skip Break</span>
                </button>
              )}
            </>
          )}

          {isPaused && (
            <button
              onClick={handleResume}
              className="flex items-center justify-center gap-2 px-6 py-3 rounded-lg font-semibold text-white transition-all hover:scale-105 shadow min-h-[48px]"
              style={{ backgroundColor: domainColor }}
            >
              <Play size={20} />
              Resume
            </button>
          )}

          {(isRunning || isPaused) && (
            <button
              onClick={handleSkip}
              className="flex items-center justify-center gap-2 px-4 py-2 bg-red-500 text-white rounded-lg font-medium hover:bg-red-600 transition-all shadow text-sm min-h-[44px]"
            >
              <SkipForward size={16} />
              <span className="hidden sm:inline">Not This</span>
            </button>
          )}
        </div>

        {/* Task notes */}
        {task.notes && (
          <div className="mt-6 p-4 bg-gray-50 rounded-lg">
            <p className="text-sm text-gray-600 italic">{task.notes}</p>
          </div>
        )}
      </motion.div>
    </div>
  );
};
