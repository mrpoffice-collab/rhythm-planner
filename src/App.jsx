import { useState } from 'react';
import InputForm from './components/InputForm';
import ComparisonTable from './components/ComparisonTable';
import WeightAdjuster from './components/WeightAdjuster';
import { scoreAllIdeas, findWinner, explainWinner } from './utils/scoringEngine';

function App() {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [rawIdeas, setRawIdeas] = useState(null);
  const [scoredIdeas, setScoredIdeas] = useState(null);
  const [winner, setWinner] = useState(null);
  const [winnerReasons, setWinnerReasons] = useState([]);

  const handleFormSubmit = async (formData) => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/generate-ideas', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(formData),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to generate ideas');
      }

      const data = await response.json();
      
      setRawIdeas(data.ideas);
      
      const scored = scoreAllIdeas(data.ideas);
      setScoredIdeas(scored);
      
      const winningIdea = findWinner(scored);
      setWinner(winningIdea);
      setWinnerReasons(explainWinner(winningIdea));

    } catch (err) {
      console.error('Error:', err);
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleWeightsChange = (newWeights) => {
    if (!rawIdeas) return;

    const weights = {
      buildSpeed: newWeights.buildSpeed / 100,
      marketSize: newWeights.marketSize / 100,
      realValue: newWeights.realValue / 100,
      nicheSpecificity: newWeights.nicheSpecificity / 100,
      scalePotential: newWeights.scalePotential / 100,
    };

    const scored = scoreAllIdeas(rawIdeas, weights);
    setScoredIdeas(scored);
    
    const winningIdea = findWinner(scored);
    setWinner(winningIdea);
    setWinnerReasons(explainWinner(winningIdea));
  };

  const handleReset = () => {
    setRawIdeas(null);
    setScoredIdeas(null);
    setWinner(null);
    setWinnerReasons([]);
    setError(null);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-100 via-purple-100 to-pink-100 py-12 px-4">
      <div className="max-w-7xl mx-auto">
        
        {/* Hero Header */}
        <div className="text-center mb-16">
          <div className="inline-block mb-6 animate-bounce">
            <div className="text-8xl">🚀</div>
          </div>
          <h1 className="text-6xl md:text-7xl font-black mb-6">
            <span className="bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 bg-clip-text text-transparent">
              Micro-App Idea Generator
            </span>
          </h1>
          <p className="text-2xl text-gray-700 max-w-3xl mx-auto leading-relaxed font-medium">
            Get 5 strategically viable micro-app ideas based on <span className="text-purple-600 font-bold">your unfair advantage</span>, 
            scored across 5 metrics with AI-powered recommendations
          </p>
          
          {/* Feature Pills */}
          <div className="flex flex-wrap justify-center gap-3 mt-8">
            <span className="bg-white px-6 py-3 rounded-full text-gray-700 font-semibold shadow-lg border-2 border-indigo-200">
              ⚡ Built-in Distribution
            </span>
            <span className="bg-white px-6 py-3 rounded-full text-gray-700 font-semibold shadow-lg border-2 border-purple-200">
              🎯 Strategic Scoring
            </span>
            <span className="bg-white px-6 py-3 rounded-full text-gray-700 font-semibold shadow-lg border-2 border-pink-200">
              🤖 AI-Powered
            </span>
          </div>
        </div>

        {/* Error Display */}
        {error && (
          <div className="max-w-3xl mx-auto mb-8">
            <div className="bg-red-50 border-4 border-red-300 rounded-2xl p-6 shadow-xl">
              <div className="flex items-start">
                <div className="flex-shrink-0">
                  <svg className="w-8 h-8 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <div className="ml-4">
                  <h3 className="text-xl font-bold text-red-900">Oops! Something went wrong</h3>
                  <p className="text-red-800 mt-2 text-lg">{error}</p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Input Form */}
        {!scoredIdeas && (
          <InputForm onSubmit={handleFormSubmit} isLoading={isLoading} />
        )}

        {/* Results */}
        {scoredIdeas && (
          <div className="space-y-8">
            {/* Weight Adjuster */}
            <WeightAdjuster onWeightsChange={handleWeightsChange} />

            {/* Comparison Table */}
            <ComparisonTable 
              ideas={scoredIdeas} 
              winner={winner}
              winnerReasons={winnerReasons}
            />

            {/* Reset Button */}
            <div className="text-center pb-12">
              <button
                onClick={handleReset}
                className="bg-gradient-to-r from-gray-700 to-gray-900 text-white py-4 px-10 rounded-2xl font-bold text-lg hover:from-gray-800 hover:to-black transition-all shadow-xl hover:shadow-2xl transform hover:-translate-y-1"
              >
                <span className="flex items-center justify-center">
                  <span className="mr-2">←</span>
                  Start Over with New Profile
                </span>
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default App;
