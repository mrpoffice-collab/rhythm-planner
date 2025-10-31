import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Sun, Moon, Calendar, Zap, CheckCircle, ArrowRight } from 'lucide-react';
import { db } from '../db/database';

interface WelcomeScreenProps {
  onComplete: () => void;
}

export const WelcomeScreen = ({ onComplete }: WelcomeScreenProps) => {
  const [step, setStep] = useState(1);
  const [wakeTime, setWakeTime] = useState('07:00');
  const [sleepTime, setSleepTime] = useState('22:00');
  const [bioRhythm, setBioRhythm] = useState<'Morning Peak' | 'Afternoon Peak' | 'Evening Peak'>('Morning Peak');

  const handleComplete = async () => {
    // Save preferences
    await db.userPrefs.update(1, {
      defaultWakeTime: wakeTime,
      defaultSleepTime: sleepTime,
      bioRhythmProfile: bioRhythm,
    });

    // Set onboarding complete flag
    localStorage.setItem('rhythmPlanner_onboarded', 'true');
    localStorage.setItem('rhythmPlanner_lastDayStart', new Date().toISOString().split('T')[0]);

    onComplete();
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 overflow-y-auto" style={{ background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)' }}>
      <motion.div
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        className="rounded-2xl shadow-2xl max-w-2xl w-full p-6 md:p-8 relative z-10 my-auto max-h-[85vh] overflow-y-auto"
        style={{ backgroundColor: '#ffffff' }}
      >
        <AnimatePresence mode="wait">
          {/* Step 1: Welcome */}
          {step === 1 && (
            <motion.div
              key="step1"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="text-center"
            >
              <motion.div
                animate={{ rotate: [0, 10, -10, 0] }}
                transition={{ duration: 2, repeat: Infinity, repeatDelay: 1 }}
                className="text-6xl mb-6"
              >
                🎯
              </motion.div>
              <h1 className="text-4xl font-bold bg-gradient-to-r from-gray-800 to-gray-600 bg-clip-text text-transparent mb-4">
                Welcome to Rhythm Planner
              </h1>
              <p className="text-xl text-gray-600 mb-8">
                Live in rhythm, not on a list
              </p>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                <div className="p-4 rounded-xl" style={{ background: 'linear-gradient(135deg, #fbbf24 0%, #f59e0b 100%)' }}>
                  <Sun className="mx-auto mb-2" size={28} color="#ffffff" />
                  <h3 className="font-semibold mb-1 text-sm" style={{ color: '#ffffff' }}>Start Your Day</h3>
                  <p className="text-xs" style={{ color: '#fef3c7' }}>Generate your daily schedule based on your energy</p>
                </div>
                <div className="p-4 rounded-xl" style={{ background: 'linear-gradient(135deg, #8b5cf6 0%, #6366f1 100%)' }}>
                  <Zap className="mx-auto mb-2" size={28} color="#ffffff" />
                  <h3 className="font-semibold mb-1 text-sm" style={{ color: '#ffffff' }}>Work in Rhythm</h3>
                  <p className="text-xs" style={{ color: '#e9d5ff' }}>Focus blocks matched to your energy levels</p>
                </div>
                <div className="p-4 rounded-xl" style={{ background: 'linear-gradient(135deg, #06b6d4 0%, #3b82f6 100%)' }}>
                  <Moon className="mx-auto mb-2" size={28} color="#ffffff" />
                  <h3 className="font-semibold mb-1 text-sm" style={{ color: '#ffffff' }}>End with Clarity</h3>
                  <p className="text-xs" style={{ color: '#dbeafe' }}>Review your progress and plan tomorrow</p>
                </div>
              </div>

              <motion.button
                onClick={() => setStep(2)}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                className="px-8 py-4 rounded-xl font-bold text-lg shadow-lg flex items-center gap-2 mx-auto"
                style={{
                  background: 'linear-gradient(to right, #3b82f6, #8b5cf6)',
                  color: '#ffffff',
                  border: 'none'
                }}
              >
                Get Started
                <ArrowRight size={20} color="#ffffff" />
              </motion.button>
            </motion.div>
          )}

          {/* Step 2: Wake/Sleep Times */}
          {step === 2 && (
            <motion.div
              key="step2"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
            >
              <div className="text-center mb-8">
                <Sun className="mx-auto mb-4 text-amber-500" size={48} />
                <h2 className="text-3xl font-bold text-gray-800 mb-2">When's Your Day?</h2>
                <p className="text-gray-600">Tell us your typical schedule so we can plan around your life</p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
                <div className="p-6 rounded-xl" style={{ background: 'linear-gradient(135deg, #fef3c7 0%, #fde68a 100%)', border: '2px solid #fbbf24' }}>
                  <label className="block text-sm font-semibold mb-3" style={{ color: '#78350f' }}>
                    <Sun className="inline mr-2" size={16} color="#f59e0b" />
                    I usually wake up at:
                  </label>
                  <input
                    type="time"
                    value={wakeTime}
                    onChange={(e) => setWakeTime(e.target.value)}
                    className="w-full px-4 py-3 rounded-lg text-lg font-semibold"
                    style={{ border: '2px solid #fbbf24', color: '#78350f', backgroundColor: '#ffffff' }}
                  />
                </div>

                <div className="p-6 rounded-xl" style={{ background: 'linear-gradient(135deg, #ddd6fe 0%, #c7d2fe 100%)', border: '2px solid #8b5cf6' }}>
                  <label className="block text-sm font-semibold mb-3" style={{ color: '#4c1d95' }}>
                    <Moon className="inline mr-2" size={16} color="#7c3aed" />
                    I usually go to bed at:
                  </label>
                  <input
                    type="time"
                    value={sleepTime}
                    onChange={(e) => setSleepTime(e.target.value)}
                    className="w-full px-4 py-3 rounded-lg text-lg font-semibold"
                    style={{ border: '2px solid #8b5cf6', color: '#4c1d95', backgroundColor: '#ffffff' }}
                  />
                </div>
              </div>

              <div className="flex gap-3">
                <motion.button
                  onClick={() => setStep(1)}
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  className="px-6 py-3 rounded-xl font-semibold"
                  style={{ backgroundColor: '#e5e7eb', color: '#1f2937', border: 'none' }}
                >
                  Back
                </motion.button>
                <motion.button
                  onClick={() => setStep(3)}
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  className="flex-1 px-6 py-3 rounded-xl font-bold shadow-lg flex items-center justify-center gap-2"
                  style={{
                    background: 'linear-gradient(to right, #3b82f6, #8b5cf6)',
                    color: '#ffffff',
                    border: 'none'
                  }}
                >
                  Continue
                  <ArrowRight size={20} color="#ffffff" />
                </motion.button>
              </div>
            </motion.div>
          )}

          {/* Step 3: Bio-Rhythm */}
          {step === 3 && (
            <motion.div
              key="step3"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
            >
              <div className="text-center mb-8">
                <Zap className="mx-auto mb-4 text-purple-500" size={48} />
                <h2 className="text-3xl font-bold text-gray-800 mb-2">When Do You Peak?</h2>
                <p className="text-gray-600">We'll schedule your hardest tasks when you're at your best</p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
                {[
                  { value: 'Morning Peak', emoji: '🌅', time: 'Best 6am-12pm', desc: 'You hit the ground running', color: '#f59e0b', bg: '#fef3c7' },
                  { value: 'Afternoon Peak', emoji: '☀️', time: 'Best 12pm-6pm', desc: 'You warm up gradually', color: '#f97316', bg: '#fed7aa' },
                  { value: 'Evening Peak', emoji: '🌙', time: 'Best 6pm-12am', desc: 'You come alive at night', color: '#6366f1', bg: '#ddd6fe' },
                ].map((option) => (
                  <motion.button
                    key={option.value}
                    onClick={() => setBioRhythm(option.value as any)}
                    whileHover={{ scale: 1.03, y: -4 }}
                    whileTap={{ scale: 0.97 }}
                    className="p-6 rounded-xl transition-all shadow-lg"
                    style={{
                      backgroundColor: bioRhythm === option.value ? option.color : option.bg,
                      border: `3px solid ${option.color}`,
                      color: bioRhythm === option.value ? '#ffffff' : '#1f2937'
                    }}
                  >
                    <div className="text-4xl mb-3">{option.emoji}</div>
                    <h3 className="font-bold mb-1" style={{ color: bioRhythm === option.value ? '#ffffff' : '#1f2937' }}>{option.value}</h3>
                    <p className="text-sm font-semibold mb-2" style={{ color: bioRhythm === option.value ? '#fef3c7' : option.color }}>{option.time}</p>
                    <p className="text-sm" style={{ color: bioRhythm === option.value ? '#ffffff' : '#4b5563' }}>{option.desc}</p>
                    {bioRhythm === option.value && (
                      <motion.div
                        initial={{ scale: 0 }}
                        animate={{ scale: 1 }}
                        className="mt-3"
                      >
                        <CheckCircle className="mx-auto" size={24} color="#ffffff" />
                      </motion.div>
                    )}
                  </motion.button>
                ))}
              </div>

              <div className="flex gap-3">
                <motion.button
                  onClick={() => setStep(2)}
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  className="px-6 py-3 rounded-xl font-semibold"
                  style={{ backgroundColor: '#e5e7eb', color: '#1f2937', border: 'none' }}
                >
                  Back
                </motion.button>
                <motion.button
                  onClick={() => setStep(4)}
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  className="flex-1 px-6 py-3 rounded-xl font-bold shadow-lg flex items-center justify-center gap-2"
                  style={{
                    background: 'linear-gradient(to right, #3b82f6, #8b5cf6)',
                    color: '#ffffff',
                    border: 'none'
                  }}
                >
                  Continue
                  <ArrowRight size={20} color="#ffffff" />
                </motion.button>
              </div>
            </motion.div>
          )}

          {/* Step 4: Daily Ritual Commitment */}
          {step === 4 && (
            <motion.div
              key="step4"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="text-center"
            >
              <motion.div
                animate={{ scale: [1, 1.1, 1] }}
                transition={{ duration: 2, repeat: Infinity }}
                className="text-6xl mb-6"
              >
                🔥
              </motion.div>
              <h2 className="text-3xl font-bold text-gray-800 mb-4">One Simple Commitment</h2>
              <p className="text-xl text-gray-600 mb-8">
                The magic happens when you make this your daily ritual
              </p>

              <div className="p-8 rounded-2xl mb-8" style={{ background: 'linear-gradient(135deg, #e0e7ff 0%, #f3e8ff 100%)', border: '3px solid #8b5cf6' }}>
                <h3 className="text-2xl font-bold mb-6" style={{ color: '#4c1d95' }}>Your Daily Rhythm:</h3>

                <div className="space-y-4 text-left">
                  <div className="flex items-start gap-4 p-5 rounded-xl" style={{ background: 'linear-gradient(135deg, #fef3c7 0%, #fde68a 100%)' }}>
                    <div className="w-12 h-12 rounded-full flex items-center justify-center flex-shrink-0" style={{ backgroundColor: '#f59e0b' }}>
                      <Sun size={24} color="#ffffff" />
                    </div>
                    <div>
                      <h4 className="font-bold mb-1" style={{ color: '#78350f' }}>Morning: Start My Day</h4>
                      <p className="text-sm" style={{ color: '#92400e' }}>Open Rhythm Planner and click "Start My Day" to generate your schedule</p>
                    </div>
                  </div>

                  <div className="flex items-start gap-4 p-5 rounded-xl" style={{ background: 'linear-gradient(135deg, #dbeafe 0%, #bfdbfe 100%)' }}>
                    <div className="w-12 h-12 rounded-full flex items-center justify-center flex-shrink-0" style={{ backgroundColor: '#3b82f6' }}>
                      <Zap size={24} color="#ffffff" />
                    </div>
                    <div>
                      <h4 className="font-bold mb-1" style={{ color: '#1e3a8a' }}>Throughout: Follow Your Rhythm</h4>
                      <p className="text-sm" style={{ color: '#1e40af' }}>Work through your scheduled blocks, timer by timer</p>
                    </div>
                  </div>

                  <div className="flex items-start gap-4 p-5 rounded-xl" style={{ background: 'linear-gradient(135deg, #ddd6fe 0%, #c7d2fe 100%)' }}>
                    <div className="w-12 h-12 rounded-full flex items-center justify-center flex-shrink-0" style={{ backgroundColor: '#6366f1' }}>
                      <Moon size={24} color="#ffffff" />
                    </div>
                    <div>
                      <h4 className="font-bold mb-1" style={{ color: '#3730a3' }}>Evening: End My Day</h4>
                      <p className="text-sm" style={{ color: '#4338ca' }}>Review your wins and preview tomorrow (we'll remind you!)</p>
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex gap-3">
                <motion.button
                  onClick={() => setStep(3)}
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  className="px-6 py-3 rounded-xl font-semibold"
                  style={{ backgroundColor: '#e5e7eb', color: '#1f2937', border: 'none' }}
                >
                  Back
                </motion.button>
                <motion.button
                  onClick={handleComplete}
                  whileHover={{ scale: 1.05, boxShadow: '0 20px 40px rgba(0,0,0,0.2)' }}
                  whileTap={{ scale: 0.95 }}
                  className="flex-1 px-8 py-4 rounded-xl font-bold text-lg shadow-lg flex items-center justify-center gap-2"
                  style={{
                    background: 'linear-gradient(to right, #10b981, #059669)',
                    color: '#ffffff',
                    border: 'none'
                  }}
                >
                  <CheckCircle size={24} color="#ffffff" />
                  Let's Go!
                </motion.button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Progress Indicator */}
        <div className="flex justify-center gap-2 mt-8">
          {[1, 2, 3, 4].map((i) => (
            <motion.div
              key={i}
              className={`h-2 rounded-full transition-all ${
                i === step ? 'w-8 bg-gradient-to-r from-blue-500 to-purple-500' : 'w-2 bg-gray-300'
              }`}
              animate={{ scale: i === step ? 1.2 : 1 }}
            />
          ))}
        </div>
      </motion.div>
    </div>
  );
};
