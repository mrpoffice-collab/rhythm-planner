import { useState } from 'react';

export default function ComparisonTable({ ideas, winner, winnerReasons }) {
  const [expandedIdea, setExpandedIdea] = useState(null);

  const getScoreColor = (score) => {
    if (score >= 8) return 'text-green-600 bg-green-50';
    if (score >= 6) return 'text-yellow-600 bg-yellow-50';
    return 'text-red-600 bg-red-50';
  };

  const getScoreBarColor = (score) => {
    if (score >= 8) return 'bg-green-500';
    if (score >= 6) return 'bg-yellow-500';
    return 'bg-red-500';
  };

  const toggleExpand = (ideaName) => {
    setExpandedIdea(expandedIdea === ideaName ? null : ideaName);
  };

  return (
    <div className="max-w-7xl mx-auto">
      {/* Winner Highlight */}
      {winner && (
        <div className="bg-gradient-to-r from-blue-50 to-purple-50 border-2 border-blue-300 rounded-lg p-6 mb-8">
          <div className="flex items-start justify-between">
            <div>
              <div className="flex items-center gap-3 mb-2">
                <span className="bg-yellow-400 text-yellow-900 px-3 py-1 rounded-full text-sm font-bold">
                  🏆 WINNER
                </span>
                <h3 className="text-2xl font-bold text-gray-900">{winner.name}</h3>
              </div>
              <p className="text-gray-700 mb-3">{winner.description}</p>
              
              {/* Winner Reasons */}
              <div className="space-y-1">
                <p className="font-semibold text-gray-900">Why this won:</p>
                <ul className="list-disc list-inside space-y-1 text-gray-700">
                  {winnerReasons.map((reason, idx) => (
                    <li key={idx}>{reason}</li>
                  ))}
                </ul>
              </div>
            </div>
            
            <div className="text-right">
              <div className="text-4xl font-bold text-blue-600">
                {winner.scores.totalScore}
              </div>
              <div className="text-sm text-gray-600">Total Score</div>
            </div>
          </div>
        </div>
      )}

      {/* Comparison Table */}
      <div className="bg-white rounded-lg shadow-md overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b-2 border-gray-200">
              <tr>
                <th className="px-6 py-4 text-left text-sm font-semibold text-gray-900">
                  Idea
                </th>
                <th className="px-4 py-4 text-center text-sm font-semibold text-gray-900">
                  Build Speed<br />
                  <span className="text-xs font-normal text-gray-500">(30%)</span>
                </th>
                <th className="px-4 py-4 text-center text-sm font-semibold text-gray-900">
                  Market Size<br />
                  <span className="text-xs font-normal text-gray-500">(20%)</span>
                </th>
                <th className="px-4 py-4 text-center text-sm font-semibold text-gray-900">
                  Real Value<br />
                  <span className="text-xs font-normal text-gray-500">(25%)</span>
                </th>
                <th className="px-4 py-4 text-center text-sm font-semibold text-gray-900">
                  Niche<br />
                  <span className="text-xs font-normal text-gray-500">(15%)</span>
                </th>
                <th className="px-4 py-4 text-center text-sm font-semibold text-gray-900">
                  Scale<br />
                  <span className="text-xs font-normal text-gray-500">(10%)</span>
                </th>
                <th className="px-4 py-4 text-center text-sm font-semibold text-gray-900 bg-blue-50">
                  Total<br />
                  <span className="text-xs font-normal text-gray-500">Score</span>
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {ideas.map((idea, idx) => {
                const isWinner = winner && idea.name === winner.name;
                const isExpanded = expandedIdea === idea.name;
                
                return (
                  <tr key={idx} className={`hover:bg-gray-50 ${isWinner ? 'bg-blue-50' : ''}`}>
                    <td className="px-6 py-4">
                      <button
                        onClick={() => toggleExpand(idea.name)}
                        className="text-left w-full group"
                      >
                        <div className="flex items-center gap-2">
                          {isWinner && <span className="text-lg">🏆</span>}
                          <div>
                            <div className="font-semibold text-gray-900 group-hover:text-blue-600">
                              {idea.name}
                            </div>
                            <div className="text-sm text-gray-600 mt-1">
                              {isExpanded ? idea.description : `${idea.description.substring(0, 60)}...`}
                            </div>
                            {isExpanded && (
                              <div className="mt-3 space-y-2 text-sm">
                                <div><span className="font-medium">Build Time:</span> {idea.buildTime}</div>
                                <div><span className="font-medium">Target:</span> {idea.targetAudience}</div>
                                <div><span className="font-medium">Pain Point:</span> {idea.painPoint}</div>
                              </div>
                            )}
                            <div className="text-xs text-blue-600 mt-1">
                              {isExpanded ? '↑ Click to collapse' : '↓ Click for details'}
                            </div>
                          </div>
                        </div>
                      </button>
                    </td>
                    
                    {/* Score Cells */}
                    {['buildSpeed', 'marketSize', 'realValue', 'nicheSpecificity', 'scalePotential'].map((metric) => (
                      <td key={metric} className="px-4 py-4">
                        <div className="flex flex-col items-center gap-1">
                          <span className={`font-bold text-lg px-2 py-1 rounded ${getScoreColor(idea.scores[metric])}`}>
                            {idea.scores[metric]}
                          </span>
                          <div className="w-full bg-gray-200 rounded-full h-1.5">
                            <div 
                              className={`h-1.5 rounded-full ${getScoreBarColor(idea.scores[metric])}`}
                              style={{ width: `${idea.scores[metric] * 10}%` }}
                            />
                          </div>
                        </div>
                      </td>
                    ))}
                    
                    {/* Total Score */}
                    <td className="px-4 py-4 bg-blue-50">
                      <div className="text-center">
                        <span className="font-bold text-2xl text-blue-600">
                          {idea.scores.totalScore}
                        </span>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Legend */}
      <div className="mt-4 flex items-center gap-6 text-sm text-gray-600">
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 bg-green-500 rounded"></div>
          <span>Excellent (8-10)</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 bg-yellow-500 rounded"></div>
          <span>Good (6-7)</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 bg-red-500 rounded"></div>
          <span>Needs Work (1-5)</span>
        </div>
      </div>
    </div>
  );
}
