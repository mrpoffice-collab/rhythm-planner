import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Settings as SettingsIcon, Download, Upload, Info, Check, Plus, X, Smartphone, Monitor, Share2 } from 'lucide-react';
import { UserPrefs, db, Domain, BioRhythmProfile, BioRhythmSegment, Energy, SoundPack } from '../db/database';
import { getBioRhythmSegments } from '../utils/bioRhythm';

export const Settings = () => {
  const [prefs, setPrefs] = useState<UserPrefs | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [showCustomBioRhythm, setShowCustomBioRhythm] = useState(false);
  const [showInstallInstructions, setShowInstallInstructions] = useState(false);
  const [deviceType, setDeviceType] = useState<'ios' | 'android' | 'desktop'>('desktop');
  const [isStandalone, setIsStandalone] = useState(false);

  useEffect(() => {
    loadPrefs();

    // Detect device type
    const userAgent = navigator.userAgent || navigator.vendor || (window as any).opera;

    if (/iPad|iPhone|iPod/.test(userAgent) && !(window as any).MSStream) {
      setDeviceType('ios');
    } else if (/android/i.test(userAgent)) {
      setDeviceType('android');
    } else {
      setDeviceType('desktop');
    }

    // Check if already installed (running in standalone mode)
    const isStandaloneMode = window.matchMedia('(display-mode: standalone)').matches ||
                             (window.navigator as any).standalone === true;
    setIsStandalone(isStandaloneMode);
  }, []);

  const loadPrefs = async () => {
    const userPrefs = await db.userPrefs.get(1);
    if (userPrefs) {
      setPrefs(userPrefs);
    }
  };

  const showToast = (message: string) => {
    setToast(message);
    setTimeout(() => setToast(null), 2000);
  };

  const saveSetting = async (updates: Partial<UserPrefs>) => {
    if (!prefs) return;
    const newPrefs = { ...prefs, ...updates };
    setPrefs(newPrefs);
    await db.userPrefs.update(1, updates);
    showToast('Settings saved');

    // Trigger live effects for certain settings
    if ('maxWorkHoursPerWeek' in updates || 'maxWorkBlocksPerDay' in updates || 'domainColors' in updates) {
      // Settings that affect planning - trigger replan
      window.dispatchEvent(new CustomEvent('settings-changed'));
    }
  };

  const handleExport = async () => {
    const tasks = await db.tasks.toArray();
    const userPrefs = await db.userPrefs.get(1);
    const archivedTasks = tasks.filter(t => t.archived);

    const exportData = {
      version: '1.0.0',
      exportDate: new Date().toISOString(),
      settings: userPrefs,
      tasks: tasks.filter(t => !t.archived),
      archive: archivedTasks,
    };

    const blob = new Blob([JSON.stringify(exportData, null, 2)], {
      type: 'application/json',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `rhythm_settings_${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    showToast('Data exported successfully');
  };

  const handleImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const data = JSON.parse(event.target?.result as string);

        // Validate schema
        if (!data.version || !data.settings) {
          showToast('Invalid file format - missing version or settings');
          return;
        }

        if (!data.version.startsWith('1.')) {
          showToast('Incompatible version - please update your export');
          return;
        }

        if (confirm('Import settings and tasks? This will merge with existing data.')) {
          // Import settings
          if (data.settings) {
            await db.userPrefs.clear();
            await db.userPrefs.add(data.settings);
          }

          // Import tasks (merge, don't replace)
          if (data.tasks && Array.isArray(data.tasks)) {
            await db.tasks.bulkPut(data.tasks);
          }

          // Import archive
          if (data.archive && Array.isArray(data.archive)) {
            await db.tasks.bulkPut(data.archive);
          }

          showToast('Data imported successfully');
          loadPrefs();
        }
      } catch (error) {
        showToast('Error importing - check file format');
        console.error(error);
      }
    };
    reader.readAsText(file);
  };

  const domains: Domain[] = ['Work', 'SideHustle', 'Chore', 'Errand', 'Personal', 'Creative'];

  if (!prefs) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-gray-500">Loading settings...</p>
      </div>
    );
  }

  const Tooltip = ({ text }: { text: string }) => (
    <div className="group relative inline-block ml-1">
      <Info size={14} className="text-gray-400 cursor-help" />
      <div className="invisible group-hover:visible absolute left-0 top-6 z-50 w-64 p-2 bg-gray-900 text-white text-xs rounded shadow-lg">
        {text}
      </div>
    </div>
  );

  return (
    <div className="space-y-6 max-w-5xl">
      {/* Toast */}
      <AnimatePresence>
        {toast && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="fixed top-4 right-4 z-50 flex items-center gap-2 px-4 py-3 bg-green-600 text-white rounded-lg shadow-lg"
          >
            <Check size={18} />
            {toast}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Header */}
      <div className="flex items-center gap-3">
        <SettingsIcon size={32} className="text-gray-800" />
        <div>
          <h1 className="text-3xl font-semibold text-gray-800">Settings</h1>
          <p className="text-gray-600 mt-1">All changes save immediately</p>
        </div>
      </div>

      {/* Day Timing */}
      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-xl font-semibold text-gray-800 mb-4">Day Timing</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label className="flex items-center text-sm font-medium text-gray-700 mb-2">
              Default Wake Time
            </label>
            <input
              type="time"
              value={prefs.defaultWakeTime}
              onChange={(e) => saveSetting({ defaultWakeTime: e.target.value })}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-800 focus:border-transparent"
            />
            <p className="text-xs text-gray-500 mt-1">When your day typically starts</p>
          </div>

          <div>
            <label className="flex items-center text-sm font-medium text-gray-700 mb-2">
              Default Sleep Time
            </label>
            <input
              type="time"
              value={prefs.defaultSleepTime}
              onChange={(e) => saveSetting({ defaultSleepTime: e.target.value })}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-800 focus:border-transparent"
            />
            <p className="text-xs text-gray-500 mt-1">Timeline fills to this time</p>
          </div>
        </div>
      </div>

      {/* Weekly Limits & Domain Colors Combined */}
      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-xl font-semibold text-gray-800 mb-4">Domain Limits & Colors</h2>
        <div className="space-y-3">
          {domains.map((domain) => {
            // Get domain-specific caps from prefs
            const getDomainCaps = () => {
              const key = domain.toLowerCase().replace(' ', '');
              return {
                weekly: (prefs as any)[`max${domain}HoursPerWeek`] || 0,
                daily: (prefs as any)[`max${domain}HoursPerDay`] || 0
              };
            };

            const caps = getDomainCaps();

            return (
              <div key={domain} className="grid grid-cols-[40px_100px_1fr_1fr] gap-4 items-center p-2 hover:bg-gray-50 rounded">
                {/* Color swatch */}
                <input
                  type="color"
                  value={prefs.domainColors[domain]}
                  onChange={(e) =>
                    saveSetting({
                      domainColors: {
                        ...prefs.domainColors,
                        [domain]: e.target.value,
                      },
                    })
                  }
                  className="w-8 h-8 rounded border border-gray-300 cursor-pointer"
                />

                {/* Domain label */}
                <span className="text-sm font-medium text-gray-700">{domain}</span>

                {/* Weekly limit */}
                <div>
                  <label className="text-xs text-gray-600 mb-1 block">Weekly hrs</label>
                  <input
                    type="number"
                    min="0"
                    max="168"
                    step="0.25"
                    placeholder="0 = no cap"
                    value={caps.weekly}
                    onChange={(e) => {
                      const value = parseFloat(e.target.value) || 0;
                      const updates: any = {};
                      updates[`max${domain}HoursPerWeek`] = value;
                      saveSetting(updates);
                      console.log(`LIMIT_UPDATE ${domain} daily: ${caps.daily} weekly: ${value}`);
                    }}
                    className="w-full px-3 py-1 text-sm border border-gray-300 rounded focus:ring-2 focus:ring-gray-800 focus:border-transparent"
                  />
                </div>

                {/* Daily limit */}
                <div>
                  <label className="text-xs text-gray-600 mb-1 block">Daily hrs</label>
                  <input
                    type="number"
                    min="0"
                    max="24"
                    step="0.25"
                    placeholder="0 = no cap"
                    value={caps.daily}
                    onChange={(e) => {
                      const value = parseFloat(e.target.value) || 0;
                      const updates: any = {};
                      updates[`max${domain}HoursPerDay`] = value;
                      saveSetting(updates);
                      console.log(`LIMIT_UPDATE ${domain} daily: ${value} weekly: ${caps.weekly}`);
                    }}
                    className="w-full px-3 py-1 text-sm border border-gray-300 rounded focus:ring-2 focus:ring-gray-800 focus:border-transparent"
                  />
                </div>
              </div>
            );
          })}
        </div>
        <p className="text-xs text-gray-500 mt-3">
          Set caps for each domain (0 = no limit). Changes trigger immediate replan.
        </p>
      </div>

      {/* Permission Rules */}
      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-xl font-semibold text-gray-800 mb-4">Permission Rules</h2>
        <div className="space-y-3">
          <label className="flex items-start gap-3 p-2 hover:bg-gray-50 rounded cursor-pointer">
            <input
              type="checkbox"
              checked={prefs.permissionRules.softCap}
              onChange={(e) =>
                saveSetting({
                  permissionRules: {
                    ...prefs.permissionRules,
                    softCap: e.target.checked,
                  },
                })
              }
              className="mt-1 w-5 h-5 text-gray-800 border-gray-300 rounded focus:ring-2 focus:ring-gray-800"
            />
            <div className="flex-1">
              <div className="flex items-center">
                <span className="font-medium text-gray-800">Soft Cap</span>
                <Tooltip text="Show warnings when approaching weekly limits but allow exceeding them" />
              </div>
              <div className="text-sm text-gray-600">Warn when approaching limits</div>
            </div>
          </label>

          <label className="flex items-start gap-3 p-2 hover:bg-gray-50 rounded cursor-pointer">
            <input
              type="checkbox"
              checked={prefs.permissionRules.hardCap}
              onChange={(e) =>
                saveSetting({
                  permissionRules: {
                    ...prefs.permissionRules,
                    hardCap: e.target.checked,
                  },
                })
              }
              className="mt-1 w-5 h-5 text-gray-800 border-gray-300 rounded focus:ring-2 focus:ring-gray-800"
            />
            <div className="flex-1">
              <div className="flex items-center">
                <span className="font-medium text-gray-800">Hard Cap</span>
                <Tooltip text="Prevent scheduling new work sessions when weekly limit is reached" />
              </div>
              <div className="text-sm text-gray-600">Block new sessions when limit reached</div>
            </div>
          </label>

          <label className="flex items-start gap-3 p-2 hover:bg-gray-50 rounded cursor-pointer">
            <input
              type="checkbox"
              checked={prefs.permissionRules.recoveryMode}
              onChange={(e) =>
                saveSetting({
                  permissionRules: {
                    ...prefs.permissionRules,
                    recoveryMode: e.target.checked,
                  },
                })
              }
              className="mt-1 w-5 h-5 text-gray-800 border-gray-300 rounded focus:ring-2 focus:ring-gray-800"
            />
            <div className="flex-1">
              <div className="flex items-center">
                <span className="font-medium text-gray-800">Recovery Mode</span>
                <Tooltip text="Prioritize rest blocks and low-energy tasks when energy is consistently low" />
              </div>
              <div className="text-sm text-gray-600">Prioritize rest when energy is low</div>
            </div>
          </label>
        </div>
      </div>

      {/* Bio-Rhythm Profile */}
      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-xl font-semibold text-gray-800 mb-4">Bio-Rhythm Profile</h2>
        <div className="space-y-4">
          <div>
            <label className="flex items-center text-sm font-medium text-gray-700 mb-2">
              Energy Pattern
              <Tooltip text="Choose when you typically have high, medium, and low energy throughout the day" />
            </label>
            <select
              value={prefs.bioRhythmProfile}
              onChange={(e) => {
                const newProfile = e.target.value as BioRhythmProfile;
                saveSetting({ bioRhythmProfile: newProfile });
                setShowCustomBioRhythm(newProfile === 'Custom');
              }}
              className="w-full max-w-xs px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-800 focus:border-transparent"
            >
              <option value="Morning Peak">Morning Peak</option>
              <option value="Afternoon Peak">Afternoon Peak</option>
              <option value="Evening Peak">Evening Peak</option>
              <option value="Custom">Custom</option>
            </select>
            <p className="text-xs text-gray-500 mt-1">
              {prefs.bioRhythmProfile === 'Morning Peak' && 'High energy 6-10am, Medium 10am-3pm, Low 3pm-sleep'}
              {prefs.bioRhythmProfile === 'Afternoon Peak' && 'Medium 6-11am, High 11am-4pm, Medium 4-7pm, Low 7pm-sleep'}
              {prefs.bioRhythmProfile === 'Evening Peak' && 'Low 6am-12pm, Medium 12-5pm, High 5-9pm, Medium 9pm-sleep'}
              {prefs.bioRhythmProfile === 'Custom' && 'Define your own energy windows below'}
            </p>
          </div>

          {/* Custom Bio-Rhythm Modal/Editor */}
          {showCustomBioRhythm && prefs.bioRhythmProfile === 'Custom' && (
            <div className="border border-gray-300 rounded-lg p-4 bg-gray-50">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-semibold text-gray-800">Custom Energy Windows</h3>
                <button
                  onClick={() => {
                    const newSegment: BioRhythmSegment = {
                      startHour: 9,
                      endHour: 12,
                      energy: 'Medium'
                    };
                    saveSetting({
                      customBioRhythmSegments: [...(prefs.customBioRhythmSegments || []), newSegment]
                    });
                  }}
                  className="flex items-center gap-1 px-2 py-1 text-sm bg-gray-800 text-white rounded hover:bg-gray-900"
                >
                  <Plus size={14} /> Add Window
                </button>
              </div>

              <div className="space-y-2">
                {(prefs.customBioRhythmSegments || []).map((segment, idx) => (
                  <div key={idx} className="grid grid-cols-[80px_80px_100px_40px] gap-2 items-center">
                    <input
                      type="number"
                      min="0"
                      max="23"
                      value={segment.startHour}
                      onChange={(e) => {
                        const updated = [...(prefs.customBioRhythmSegments || [])];
                        updated[idx] = { ...updated[idx], startHour: parseInt(e.target.value) || 0 };
                        saveSetting({ customBioRhythmSegments: updated });
                      }}
                      className="px-2 py-1 text-sm border border-gray-300 rounded"
                      placeholder="Start"
                    />
                    <input
                      type="number"
                      min="0"
                      max="23"
                      value={segment.endHour}
                      onChange={(e) => {
                        const updated = [...(prefs.customBioRhythmSegments || [])];
                        updated[idx] = { ...updated[idx], endHour: parseInt(e.target.value) || 0 };
                        saveSetting({ customBioRhythmSegments: updated });
                      }}
                      className="px-2 py-1 text-sm border border-gray-300 rounded"
                      placeholder="End"
                    />
                    <select
                      value={segment.energy}
                      onChange={(e) => {
                        const updated = [...(prefs.customBioRhythmSegments || [])];
                        updated[idx] = { ...updated[idx], energy: e.target.value as Energy };
                        saveSetting({ customBioRhythmSegments: updated });
                      }}
                      className="px-2 py-1 text-sm border border-gray-300 rounded"
                    >
                      <option value="High">High</option>
                      <option value="Medium">Medium</option>
                      <option value="Low">Low</option>
                    </select>
                    <button
                      onClick={() => {
                        const updated = (prefs.customBioRhythmSegments || []).filter((_, i) => i !== idx);
                        saveSetting({ customBioRhythmSegments: updated });
                      }}
                      className="p-1 text-red-600 hover:bg-red-50 rounded"
                    >
                      <X size={16} />
                    </button>
                  </div>
                ))}
                {(prefs.customBioRhythmSegments || []).length === 0 && (
                  <p className="text-xs text-gray-500">No custom windows defined. Click "Add Window" to start.</p>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Timer Sounds */}
      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-xl font-semibold text-gray-800 mb-4">Timer Sounds</h2>
        <div className="space-y-4">
          <label className="flex items-center gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={prefs.timerSoundsEnabled}
              onChange={(e) => saveSetting({ timerSoundsEnabled: e.target.checked })}
              className="w-5 h-5 text-blue-600 border-gray-300 rounded focus:ring-2 focus:ring-blue-500"
            />
            <div>
              <div className="font-medium text-gray-800">Enable Timer Sounds</div>
              <div className="text-xs text-gray-500">Play audio cues at timer events</div>
            </div>
          </label>

          {prefs.timerSoundsEnabled && (
            <>
              <div>
                <label className="flex items-center text-sm font-medium text-gray-700 mb-2">
                  Volume: {prefs.timerVolume}%
                </label>
                <input
                  type="range"
                  min="0"
                  max="100"
                  value={prefs.timerVolume}
                  onChange={(e) => saveSetting({ timerVolume: parseInt(e.target.value) })}
                  className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-blue-600"
                />
              </div>

              <div>
                <label className="text-sm font-medium text-gray-700 mb-2 block">Sound Pack</label>
                <div className="flex gap-2">
                  {(['Chime', 'Bell', 'Pop'] as SoundPack[]).map((pack) => (
                    <button
                      key={pack}
                      onClick={() => saveSetting({ timerSoundPack: pack })}
                      className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                        prefs.timerSoundPack === pack
                          ? 'bg-blue-600 text-white'
                          : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                      }`}
                    >
                      {pack}
                    </button>
                  ))}
                </div>
              </div>
            </>
          )}
        </div>
        <p className="text-xs text-gray-500 mt-3">
          Sounds play at: Focus start, 5 min remaining, Break start, Segment end, Plan complete
        </p>
      </div>

      {/* Archive Retention */}
      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-xl font-semibold text-gray-800 mb-4">Archive & History</h2>
        <div>
          <label className="flex items-center text-sm font-medium text-gray-700 mb-2">
            Archive Retention Period
          </label>
          <select
            value={prefs.archiveRetentionDays}
            onChange={(e) => saveSetting({ archiveRetentionDays: parseInt(e.target.value) })}
            className="w-full max-w-xs px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-800 focus:border-transparent"
          >
            <option value="0">Delete immediately</option>
            <option value="7">Keep for 7 days</option>
            <option value="30">Keep for 30 days</option>
            <option value="90">Keep for 90 days</option>
            <option value="365">Keep for 1 year</option>
            <option value="-1">Keep forever</option>
          </select>
          <p className="text-xs text-gray-500 mt-1">
            How long to keep completed one-time tasks after archiving
          </p>
        </div>
      </div>

      {/* Install App */}
      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-xl font-semibold text-gray-800 mb-4">Install App</h2>
        {isStandalone ? (
          <div className="flex items-center gap-3 p-4 bg-green-50 border border-green-200 rounded-lg">
            <Check size={24} className="text-green-600 flex-shrink-0" />
            <div>
              <p className="font-semibold text-green-800">Already Installed!</p>
              <p className="text-sm text-green-700">You're using Rhythm as an installed app.</p>
            </div>
          </div>
        ) : (
          <>
            <p className="text-gray-600 mb-4">
              Install Rhythm Planner on your device for quick access and a better experience.
            </p>
            <button
              onClick={() => setShowInstallInstructions(true)}
              className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-lg font-semibold hover:from-blue-700 hover:to-purple-700 transition-all shadow-lg"
            >
              <Smartphone size={20} />
              Show Install Instructions
            </button>
          </>
        )}
      </div>

      {/* Install Instructions Modal */}
      <AnimatePresence>
        {showInstallInstructions && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 overflow-y-auto" style={{ background: 'rgba(0,0,0,0.5)' }} onClick={() => setShowInstallInstructions(false)}>
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full p-6 md:p-8 relative max-h-[85vh] overflow-y-auto"
            >
              <div className="flex justify-between items-start mb-6">
                <div>
                  <div className="text-6xl mb-4">📱</div>
                  <h2 className="text-3xl font-bold text-gray-800 mb-2">Install for Quick Access</h2>
                  <p className="text-gray-600">Add Rhythm to your home screen</p>
                </div>
                <button
                  onClick={() => setShowInstallInstructions(false)}
                  className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                >
                  <X size={24} className="text-gray-600" />
                </button>
              </div>

              {deviceType === 'ios' && (
                <div className="p-6 rounded-2xl mb-6 text-left" style={{ background: 'linear-gradient(135deg, #dbeafe 0%, #bfdbfe 100%)', border: '3px solid #3b82f6' }}>
                  <div className="flex items-center gap-3 mb-4">
                    <Smartphone size={32} color="#1e40af" />
                    <h3 className="text-xl font-bold" style={{ color: '#1e3a8a' }}>iPhone/iPad Instructions:</h3>
                  </div>
                  <ol className="space-y-3 text-sm" style={{ color: '#1e40af' }}>
                    <li className="flex items-start gap-3">
                      <span className="flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold" style={{ backgroundColor: '#3b82f6', color: '#ffffff' }}>1</span>
                      <span>Tap the <strong>Share button</strong> at the bottom of Safari (square with arrow ⬆️)</span>
                    </li>
                    <li className="flex items-start gap-3">
                      <span className="flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold" style={{ backgroundColor: '#3b82f6', color: '#ffffff' }}>2</span>
                      <span>Scroll down and tap <strong>"Add to Home Screen"</strong></span>
                    </li>
                    <li className="flex items-start gap-3">
                      <span className="flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold" style={{ backgroundColor: '#3b82f6', color: '#ffffff' }}>3</span>
                      <span>Tap <strong>"Add"</strong> in the top right</span>
                    </li>
                    <li className="flex items-start gap-3">
                      <span className="flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold" style={{ backgroundColor: '#3b82f6', color: '#ffffff' }}>4</span>
                      <span>Look for the <strong>Rhythm icon</strong> on your home screen!</span>
                    </li>
                  </ol>
                  <div className="mt-4 p-3 rounded-lg" style={{ backgroundColor: '#eff6ff' }}>
                    <p className="text-xs font-semibold" style={{ color: '#1e40af' }}>
                      💡 Tip: The icon will appear with our purple theme and work like a native app!
                    </p>
                  </div>
                </div>
              )}

              {deviceType === 'android' && (
                <div className="p-6 rounded-2xl mb-6 text-left" style={{ background: 'linear-gradient(135deg, #d1fae5 0%, #a7f3d0 100%)', border: '3px solid #10b981' }}>
                  <div className="flex items-center gap-3 mb-4">
                    <Smartphone size={32} color="#065f46" />
                    <h3 className="text-xl font-bold" style={{ color: '#064e3b' }}>Android Instructions:</h3>
                  </div>
                  <ol className="space-y-3 text-sm" style={{ color: '#065f46' }}>
                    <li className="flex items-start gap-3">
                      <span className="flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold" style={{ backgroundColor: '#10b981', color: '#ffffff' }}>1</span>
                      <span>Tap the <strong>menu (⋮)</strong> in the top right of Chrome</span>
                    </li>
                    <li className="flex items-start gap-3">
                      <span className="flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold" style={{ backgroundColor: '#10b981', color: '#ffffff' }}>2</span>
                      <span>Select <strong>"Add to Home screen"</strong> or <strong>"Install app"</strong></span>
                    </li>
                    <li className="flex items-start gap-3">
                      <span className="flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold" style={{ backgroundColor: '#10b981', color: '#ffffff' }}>3</span>
                      <span>Tap <strong>"Add"</strong> or <strong>"Install"</strong></span>
                    </li>
                    <li className="flex items-start gap-3">
                      <span className="flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold" style={{ backgroundColor: '#10b981', color: '#ffffff' }}>4</span>
                      <span>Open from your home screen or app drawer!</span>
                    </li>
                  </ol>
                  <div className="mt-4 p-3 rounded-lg" style={{ backgroundColor: '#ecfdf5' }}>
                    <p className="text-xs font-semibold" style={{ color: '#065f46' }}>
                      💡 Tip: Some Android devices show an automatic install banner at the bottom!
                    </p>
                  </div>
                </div>
              )}

              {deviceType === 'desktop' && (
                <div className="p-6 rounded-2xl mb-6 text-left" style={{ background: 'linear-gradient(135deg, #e0e7ff 0%, #c7d2fe 100%)', border: '3px solid #6366f1' }}>
                  <div className="flex items-center gap-3 mb-4">
                    <Monitor size={32} color="#3730a3" />
                    <h3 className="text-xl font-bold" style={{ color: '#3730a3' }}>Desktop Instructions:</h3>
                  </div>
                  <ol className="space-y-3 text-sm" style={{ color: '#4338ca' }}>
                    <li className="flex items-start gap-3">
                      <span className="flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold" style={{ backgroundColor: '#6366f1', color: '#ffffff' }}>1</span>
                      <span>Look for the <strong>install icon (⊕)</strong> in the address bar (right side)</span>
                    </li>
                    <li className="flex items-start gap-3">
                      <span className="flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold" style={{ backgroundColor: '#6366f1', color: '#ffffff' }}>2</span>
                      <span>Click it and select <strong>"Install Rhythm Planner"</strong></span>
                    </li>
                    <li className="flex items-start gap-3">
                      <span className="flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold" style={{ backgroundColor: '#6366f1', color: '#ffffff' }}>3</span>
                      <span>The app will open in its own window!</span>
                    </li>
                  </ol>
                  <div className="mt-4 p-3 rounded-lg" style={{ backgroundColor: '#eef2ff' }}>
                    <p className="text-xs font-semibold" style={{ color: '#4338ca' }}>
                      💡 Tip: Works in Chrome, Edge, and Brave browsers. Safari on Mac doesn't support PWA installation.
                    </p>
                  </div>
                </div>
              )}

              <button
                onClick={() => setShowInstallInstructions(false)}
                className="w-full px-6 py-3 bg-gray-800 text-white rounded-lg font-semibold hover:bg-gray-900 transition-all"
              >
                Got It!
              </button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Data Management */}
      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-xl font-semibold text-gray-800 mb-4">Data Management</h2>
        <div className="flex gap-4">
          <button
            onClick={handleExport}
            className="flex items-center gap-2 px-6 py-3 bg-gray-800 text-white rounded-lg font-semibold hover:bg-gray-900 transition-all"
          >
            <Download size={20} />
            Export
          </button>

          <label className="flex items-center gap-2 px-6 py-3 bg-gray-100 text-gray-700 rounded-lg font-semibold hover:bg-gray-200 transition-all cursor-pointer">
            <Upload size={20} />
            Import
            <input type="file" accept=".json" onChange={handleImport} className="hidden" />
          </label>
        </div>
        <p className="text-xs text-gray-500 mt-3">
          Export downloads rhythm_settings.json with settings, tasks, and archive
        </p>
      </div>
    </div>
  );
};
