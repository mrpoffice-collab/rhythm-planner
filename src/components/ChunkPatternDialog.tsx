import { useState } from 'react';
import { motion } from 'framer-motion';
import { X } from 'lucide-react';

export interface ChunkPattern {
  focusMinutes: number;
  breakMinutes: number;
  continuous: boolean;
}

interface ChunkPatternDialogProps {
  taskTitle: string;
  taskDuration: number;
  defaultMaxFocus: number;
  defaultBreak: number;
  onConfirm: (pattern: ChunkPattern, remember: boolean) => void;
  onCancel: () => void;
}

export const ChunkPatternDialog = ({
  taskTitle,
  taskDuration,
  defaultMaxFocus,
  defaultBreak,
  onConfirm,
  onCancel
}: ChunkPatternDialogProps) => {
  const [selectedPreset, setSelectedPreset] = useState<'default' | 'pomodoro' | 'deep' | 'custom'>('default');
  const [customFocus, setCustomFocus] = useState(defaultMaxFocus);
  const [customBreak, setCustomBreak] = useState(defaultBreak);
  const [rememberChoice, setRememberChoice] = useState(false);

  const getPattern = (): ChunkPattern => {
    switch (selectedPreset) {
      case 'default':
        return { focusMinutes: defaultMaxFocus, breakMinutes: defaultBreak, continuous: false };
      case 'pomodoro':
        return { focusMinutes: 25, breakMinutes: 5, continuous: false };
      case 'deep':
        return { focusMinutes: 50, breakMinutes: 10, continuous: false };
      case 'custom':
        return { focusMinutes: customFocus, breakMinutes: customBreak, continuous: false };
    }
  };

  const calculatePreview = (pattern: ChunkPattern): string => {
    if (pattern.continuous) {
      return `${taskDuration} min → 1 continuous block (no breaks)`;
    }

    const numFullSegments = Math.floor(taskDuration / pattern.focusMinutes);
    const remainingMins = taskDuration % pattern.focusMinutes;
    const numBreaks = remainingMins > 0 ? numFullSegments : numFullSegments - 1;

    let preview = `${taskDuration} min → ${numFullSegments} × ${pattern.focusMinutes}m focus`;
    if (numBreaks > 0) {
      preview += ` + ${numBreaks} × ${pattern.breakMinutes}m break`;
    }
    if (remainingMins > 0) {
      preview += ` + 1 × ${remainingMins}m final focus`;
    }

    return preview;
  };

  const pattern = getPattern();
  const preview = calculatePreview(pattern);

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[70] p-4">
      <motion.div
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        className="bg-white rounded-xl shadow-2xl w-full max-w-md p-6"
      >
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold text-gray-800">Choose Chunk Pattern</h2>
          <button
            onClick={onCancel}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <X size={24} />
          </button>
        </div>

        <p className="text-sm text-gray-600 mb-4">
          <span className="font-medium">{taskTitle}</span> is {taskDuration} minutes long.
          Choose how to split it:
        </p>

        {/* Presets */}
        <div className="space-y-2 mb-4">
          <label className="flex items-center gap-3 p-3 border-2 rounded-lg cursor-pointer hover:bg-gray-50 transition-colors"
            style={{ borderColor: selectedPreset === 'default' ? '#3B82F6' : '#E5E7EB' }}
          >
            <input
              type="radio"
              name="preset"
              checked={selectedPreset === 'default'}
              onChange={() => setSelectedPreset('default')}
              className="w-4 h-4"
            />
            <div className="flex-1">
              <div className="font-medium text-gray-800">Use Default</div>
              <div className="text-xs text-gray-500">{defaultMaxFocus} min focus / {defaultBreak} min break</div>
            </div>
          </label>

          <label className="flex items-center gap-3 p-3 border-2 rounded-lg cursor-pointer hover:bg-gray-50 transition-colors"
            style={{ borderColor: selectedPreset === 'pomodoro' ? '#3B82F6' : '#E5E7EB' }}
          >
            <input
              type="radio"
              name="preset"
              checked={selectedPreset === 'pomodoro'}
              onChange={() => setSelectedPreset('pomodoro')}
              className="w-4 h-4"
            />
            <div className="flex-1">
              <div className="font-medium text-gray-800">Pomodoro</div>
              <div className="text-xs text-gray-500">25 min focus / 5 min break</div>
            </div>
          </label>

          <label className="flex items-center gap-3 p-3 border-2 rounded-lg cursor-pointer hover:bg-gray-50 transition-colors"
            style={{ borderColor: selectedPreset === 'deep' ? '#3B82F6' : '#E5E7EB' }}
          >
            <input
              type="radio"
              name="preset"
              checked={selectedPreset === 'deep'}
              onChange={() => setSelectedPreset('deep')}
              className="w-4 h-4"
            />
            <div className="flex-1">
              <div className="font-medium text-gray-800">Deep Work</div>
              <div className="text-xs text-gray-500">50 min focus / 10 min break</div>
            </div>
          </label>

          <label className="flex items-center gap-3 p-3 border-2 rounded-lg cursor-pointer hover:bg-gray-50 transition-colors"
            style={{ borderColor: selectedPreset === 'custom' ? '#3B82F6' : '#E5E7EB' }}
          >
            <input
              type="radio"
              name="preset"
              checked={selectedPreset === 'custom'}
              onChange={() => setSelectedPreset('custom')}
              className="w-4 h-4"
            />
            <div className="flex-1">
              <div className="font-medium text-gray-800">Custom</div>
              <div className="text-xs text-gray-500">Set your own pattern</div>
            </div>
          </label>
        </div>

        {/* Custom inputs */}
        {selectedPreset === 'custom' && (
          <div className="grid grid-cols-2 gap-3 mb-4">
            <div>
              <label className="text-xs font-medium text-gray-700 block mb-1">Focus (min)</label>
              <input
                type="number"
                min="5"
                max="240"
                value={customFocus}
                onChange={(e) => setCustomFocus(parseInt(e.target.value) || 5)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-gray-700 block mb-1">Break (min)</label>
              <input
                type="number"
                min="0"
                max="60"
                value={customBreak}
                onChange={(e) => setCustomBreak(parseInt(e.target.value) || 0)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
          </div>
        )}

        {/* Preview */}
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mb-4">
          <div className="text-xs font-medium text-blue-800 mb-1">Preview:</div>
          <div className="text-sm text-blue-900">{preview}</div>
        </div>

        {/* Remember choice */}
        <label className="flex items-center gap-2 mb-4 cursor-pointer">
          <input
            type="checkbox"
            checked={rememberChoice}
            onChange={(e) => setRememberChoice(e.target.checked)}
            className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-2 focus:ring-blue-500"
          />
          <span className="text-sm text-gray-700">Remember this pattern as my default</span>
        </label>

        {/* Actions */}
        <div className="flex gap-3">
          <button
            onClick={() => onConfirm(pattern, rememberChoice)}
            className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-colors"
          >
            Start with these chunks
          </button>
          <button
            onClick={() => onConfirm({ focusMinutes: taskDuration, breakMinutes: 0, continuous: true }, rememberChoice)}
            className="flex-1 px-4 py-2 bg-gray-200 text-gray-700 rounded-lg font-medium hover:bg-gray-300 transition-colors"
          >
            Start continuous
          </button>
        </div>

        <button
          onClick={onCancel}
          className="w-full mt-2 px-4 py-2 text-gray-600 hover:text-gray-800 text-sm font-medium transition-colors"
        >
          Cancel
        </button>
      </motion.div>
    </div>
  );
};
