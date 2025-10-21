import { useState } from 'react';

export default function InputForm({ onSubmit, isLoading }) {
  const [formData, setFormData] = useState({
    unfairAdvantage: '',
    targetAudience: '',
    problems: '',
    time: '5-10hrs',
    budget: '$0',
    preferredCategory: ''
  });

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    });
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    
    if (!formData.unfairAdvantage.trim() || !formData.targetAudience.trim() || !formData.problems.trim()) {
      alert('Please fill out the first three fields - they\'re critical for generating viable ideas!');
      return;
    }
    
    onSubmit(formData);
  };

  return (
    <div className="max-w-4xl mx-auto">
      {/* Card Container */}
      <div className="bg-white rounded-3xl shadow-2xl overflow-hidden border-2 border-indigo-100">
        
        {/* Header Section */}
        <div className="bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 px-8 py-8 text-white">
          <h2 className="text-3xl font-bold mb-2">Strategic Idea Generator</h2>
          <p className="text-indigo-100 text-lg">Questions are ordered by AI priority - early inputs weighted more heavily</p>
        </div>

        <form onSubmit={handleSubmit} className="p-8 space-y-8">
          
          {/* Question 1 - CRITICAL */}
          <div className="relative">
            <div className="absolute -left-4 top-0 w-12 h-12 bg-gradient-to-br from-yellow-400 to-orange-500 rounded-full flex items-center justify-center text-white font-bold text-xl shadow-lg z-10">
              1
            </div>
            <div className="bg-gradient-to-br from-yellow-50 to-orange-50 rounded-2xl p-6 border-2 border-yellow-300 shadow-md ml-4">
              <label htmlFor="unfairAdvantage" className="block text-lg font-bold text-gray-900 mb-3 flex items-center">
                <span className="mr-2">⭐</span>
                Your Unfair Advantage
                <span className="ml-3 text-sm font-normal bg-red-500 text-white px-3 py-1 rounded-full">CRITICAL</span>
              </label>
              <textarea
                id="unfairAdvantage"
                name="unfairAdvantage"
                value={formData.unfairAdvantage}
                onChange={handleChange}
                rows={3}
                className="w-full px-4 py-4 text-base border-2 border-yellow-400 rounded-xl focus:ring-4 focus:ring-yellow-300 focus:border-yellow-500 bg-white shadow-inner transition-all"
                placeholder="e.g., '10k Twitter followers in finance' or 'I'm a physical therapist with access to 200 other PTs' or 'I run a 5k subscriber newsletter for solopreneurs'"
                disabled={isLoading}
                required
              />
              <p className="mt-3 text-sm text-gray-700 font-medium bg-yellow-100 px-4 py-2 rounded-lg">
                💡 How will you reach your first 100 customers? Think: audience, expertise, network, insider access
              </p>
            </div>
          </div>

          {/* Question 2 */}
          <div className="relative">
            <div className="absolute -left-4 top-0 w-12 h-12 bg-gradient-to-br from-purple-500 to-pink-500 rounded-full flex items-center justify-center text-white font-bold text-xl shadow-lg z-10">
              2
            </div>
            <div className="bg-gradient-to-br from-purple-50 to-pink-50 rounded-2xl p-6 border-2 border-purple-300 shadow-md ml-4">
              <label htmlFor="targetAudience" className="block text-lg font-bold text-gray-900 mb-3 flex items-center">
                <span className="mr-2">👥</span>
                Target Audience
              </label>
              <input
                type="text"
                id="targetAudience"
                name="targetAudience"
                value={formData.targetAudience}
                onChange={handleChange}
                className="w-full px-4 py-4 text-base border-2 border-purple-300 rounded-xl focus:ring-4 focus:ring-purple-300 focus:border-purple-500 bg-white shadow-inner transition-all"
                placeholder="e.g., Solopreneurs, Fitness coaches, Real estate agents, Parents with toddlers"
                disabled={isLoading}
                required
              />
              <p className="mt-3 text-sm text-gray-700 font-medium bg-purple-100 px-4 py-2 rounded-lg">
                Who specifically do you want to serve? Be as niche as possible!
              </p>
            </div>
          </div>

          {/* Question 3 */}
          <div className="relative">
            <div className="absolute -left-4 top-0 w-12 h-12 bg-gradient-to-br from-blue-500 to-indigo-500 rounded-full flex items-center justify-center text-white font-bold text-xl shadow-lg z-10">
              3
            </div>
            <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-2xl p-6 border-2 border-blue-300 shadow-md ml-4">
              <label htmlFor="problems" className="block text-lg font-bold text-gray-900 mb-3 flex items-center">
                <span className="mr-2">💡</span>
                Problems They Face
              </label>
              <textarea
                id="problems"
                name="problems"
                value={formData.problems}
                onChange={handleChange}
                rows={3}
                className="w-full px-4 py-4 text-base border-2 border-blue-300 rounded-xl focus:ring-4 focus:ring-blue-300 focus:border-blue-500 bg-white shadow-inner transition-all"
                placeholder="e.g., Can't find clients consistently, Waste hours on repetitive admin work, Struggle to stay organized"
                disabled={isLoading}
                required
              />
              <p className="mt-3 text-sm text-gray-700 font-medium bg-blue-100 px-4 py-2 rounded-lg">
                What specific pain points do you see them struggling with daily?
              </p>
            </div>
          </div>

          {/* Questions 4-6 - Lower Priority */}
          <div className="space-y-6 opacity-90">
            
            {/* Question 4 */}
            <div className="relative">
              <div className="absolute -left-4 top-0 w-10 h-10 bg-gray-400 rounded-full flex items-center justify-center text-white font-semibold shadow z-10">
                4
              </div>
              <div className="ml-4">
                <label htmlFor="time" className="block text-base font-semibold text-gray-800 mb-2">
                  ⏱️ Time Available per Week
                </label>
                <select
                  id="time"
                  name="time"
                  value={formData.time}
                  onChange={handleChange}
                  className="w-full px-4 py-3 border-2 border-gray-300 rounded-xl focus:ring-2 focus:ring-gray-400 focus:border-gray-500 bg-white shadow-sm transition-all"
                  disabled={isLoading}
                >
                  <option value="<5hrs">1-5 hours (Side project)</option>
                  <option value="5-10hrs">5-10 hours (Serious side hustle)</option>
                  <option value="10-20hrs">10-20 hours (Almost full-time)</option>
                  <option value="20+hrs">20+ hours (Full-time)</option>
                </select>
              </div>
            </div>

            {/* Question 5 */}
            <div className="relative">
              <div className="absolute -left-4 top-0 w-10 h-10 bg-gray-400 rounded-full flex items-center justify-center text-white font-semibold shadow z-10">
                5
              </div>
              <div className="ml-4">
                <label htmlFor="budget" className="block text-base font-semibold text-gray-800 mb-2">
                  💰 Budget for MVP
                </label>
                <select
                  id="budget"
                  name="budget"
                  value={formData.budget}
                  onChange={handleChange}
                  className="w-full px-4 py-3 border-2 border-gray-300 rounded-xl focus:ring-2 focus:ring-gray-400 focus:border-gray-500 bg-white shadow-sm transition-all"
                  disabled={isLoading}
                >
                  <option value="$0">$0-100 (Bootstrap/free tools)</option>
                  <option value="<$500">$100-500 (Basic paid tools)</option>
                  <option value="$500-2k">$500-2k (Professional setup)</option>
                  <option value="$2k+">$2k+ (Premium tools)</option>
                </select>
              </div>
            </div>

            {/* Question 6 */}
            <div className="relative opacity-75">
              <div className="absolute -left-4 top-0 w-10 h-10 bg-gray-300 rounded-full flex items-center justify-center text-gray-600 font-semibold shadow z-10">
                6
              </div>
              <div className="ml-4">
                <label htmlFor="preferredCategory" className="block text-base font-medium text-gray-700 mb-2">
                  🎨 Problem Category Preference <span className="text-sm text-gray-500">(Optional)</span>
                </label>
                <input
                  type="text"
                  id="preferredCategory"
                  name="preferredCategory"
                  value={formData.preferredCategory}
                  onChange={handleChange}
                  className="w-full px-4 py-3 border-2 border-gray-300 rounded-xl focus:ring-2 focus:ring-gray-300 focus:border-gray-400 bg-white shadow-sm transition-all"
                  placeholder="e.g., Productivity, Finance, Content creation, Health & wellness"
                  disabled={isLoading}
                />
                <p className="mt-2 text-sm text-gray-500">
                  Nice to have, but less critical than the above
                </p>
              </div>
            </div>

          </div>

          {/* Submit Button */}
          <div className="pt-6">
            <button
              type="submit"
              disabled={isLoading}
              className="w-full bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 text-white py-5 px-8 rounded-2xl font-bold text-xl hover:from-indigo-700 hover:via-purple-700 hover:to-pink-700 focus:outline-none focus:ring-4 focus:ring-purple-300 disabled:from-gray-400 disabled:via-gray-400 disabled:to-gray-400 disabled:cursor-not-allowed transition-all duration-300 shadow-xl hover:shadow-2xl transform hover:-translate-y-1"
            >
              {isLoading ? (
                <span className="flex items-center justify-center">
                  <svg className="animate-spin h-6 w-6 mr-3" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                  ✨ Generating Strategic Ideas...
                </span>
              ) : (
                <span className="flex items-center justify-center">
                  <span className="mr-2">🚀</span>
                  Generate 5 Viable Micro-App Ideas
                </span>
              )}
            </button>
          </div>

        </form>
      </div>
    </div>
  );
}
