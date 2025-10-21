import { useState } from 'react';

export default function WeightAdjuster({ onWeightsChange }) {
  const [weights, setWeights] = useState({
    buildSpeed: 30,
    marketSize: 20,
    realValue: 25,
    nicheSpecificity: 15,
    scalePotential: 10
  });

  const [showAdjuster, setShowAdjuster] = useState(false);

  const handleWeightChange = (metric, value) => {
    const newWeights = {
      ...weights,
      [metric]: parseInt(value)
    };
    setWeights(newWeights);
  };

  const getTotalWeight = () => {
    return Object.values(weights).reduce((sum, w) => sum + w, 0);
  };

  const resetWeights = () => {
    const defaultWeights = {
      buildSpeed: 30,
      marketSize: 20,
      realValue: 25,
      nicheSpecificity: 15,
      scalePotential: 10
    };
    setWeights(defaultWeights);
    onWeightsChange(defaultWeights);
  };

  const applyWeights = () => {
    const total = getTotalWeight();
    if (total !== 100) {
      alert(`Weights must total 100%. Current total: ${total}%`);
      return;
    }
    onWeightsChange(weights);
  };

  const totalWeight = getTotalWeight();
  const isValid = totalWeight === 100;

  return (
    <div className="max-w-4xl mx-auto bg-white rounded-lg shadow-md p-6 mb-8">
      <button
        onClick={() => setShowAdjuster(!showAdjuster)}
        className="w-full flex items-center justify-between text-left"
      >
        <div>
          <h3 className="text-lg font-semibold text-gray-900">
            Adjust Metric Weights
          </h3>
          <p className="text-sm text-gray-600 mt-1">
            Customize what matters most to you (must total 100%)
          </p>
        </div>
        <svg 
          className={`w-6 h-6 text-gray-600 transition-transform ${showAdjuster ? 'rotate-180' : ''}`}
          fill="none" 
          viewBox="0 0 24 24" 
          stroke="currentColor"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {showAdjuster && (
        <div className="mt-6 space-y-6">
          {/* Build Speed */}
          <div>
            <div className="flex justify-between items-center mb-2">
              <label className="text-sm font-medium text-gray-700">
                Build Speed (How quickly can you launch?)
              </label>
              <span className="text-lg font-bold text-blue-600">{weights.buildSpeed}%</span>
            </div>
            <input
              type="range"
              min="0"
              max="100"
              step="5"
              value={weights.buildSpeed}
              onChange={(e) => handleWeightChange('buildSpeed', e.target.value)}
              className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-blue-600"
            />
          </div>

          {/* Market Size */}
          <div>
            <div className="flex justify-between items-center mb-2">
              <label className="text-sm font-medium text-gray-700">
                Market Size (How many potential customers?)
              </label>
              <span className="text-lg font-bold text-blue-600">{weights.marketSize}%</span>
            </div>
            <input
              type="range"
              min="0"
              max="100"
              step="5"
              value={weights.marketSize}
              onChange={(e) => handleWeightChange('marketSize', e.target.value)}
              className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-blue-600"
            />
          </div>

          {/* Real Value */}
          <div>
            <div className="flex justify-between items-center mb-2">
              <label className="text-sm font-medium text-gray-700">
                Real Value (Does it solve a painful problem?)
              </label>
              <span className="text-lg font-bold text-blue-600">{weights.realValue}%</span>
            </div>
            <input
              type="range"
              min="0"
              max="100"
              step="5"
              value={weights.realValue}
              onChange={(e) => handleWeightChange('realValue', e.target.value)}
              className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-blue-600"
            />
          </div>

          {/* Niche Specificity */}
          <div>
            <div className="flex justify-between items-center mb-2">
              <label className="text-sm font-medium text-gray-700">
                Niche Specificity (How targeted is the audience?)
              </label>
              <span className="text-lg font-bold text-blue-600">{weights.nicheSpecificity}%</span>
            </div>
            <input
              type="range"
              min="0"
              max="100"
              step="5"
              value={weights.nicheSpecificity}
              onChange={(e) => handleWeightChange('nicheSpecificity', e.target.value)}
              className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-blue-600"
            />
          </div>

          {/* Scale Potential */}
          <div>
            <div className="flex justify-between items-center mb-2">
              <label className="text-sm font-medium text-gray-700">
                Scale Potential (Can it grow to adjacent markets?)
              </label>
              <span className="text-lg font-bold text-blue-600">{weights.scalePotential}%</span>
            </div>
            <input
              type="range"
              min="0"
              max="100"
              step="5"
              value={weights.scalePotential}
              onChange={(e) => handleWeightChange('scalePotential', e.target.value)}
              className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-blue-600"
            />
          </div>

          {/* Total & Actions */}
          <div className="pt-4 border-t border-gray-200">
            <div className="flex items-center justify-between mb-4">
              <span className="text-sm font-medium text-gray-700">Total Weight:</span>
              <span className={`text-2xl font-bold ${isValid ? 'text-green-600' : 'text-red-600'}`}>
                {totalWeight}%
              </span>
            </div>

            {!isValid && (
              <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-md">
                <p className="text-sm text-red-800">
                  ⚠️ Weights must total exactly 100%. Currently at {totalWeight}%.
                </p>
              </div>
            )}

            <div className="flex gap-3">
              <button
                onClick={applyWeights}
                disabled={!isValid}
                className="flex-1 bg-blue-600 text-white py-2 px-4 rounded-md font-semibold hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
              >
                Apply New Weights
              </button>
              <button
                onClick={resetWeights}
                className="px-4 py-2 border-2 border-gray-300 text-gray-700 rounded-md font-semibold hover:bg-gray-50 transition-colors"
              >
                Reset to Default
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
