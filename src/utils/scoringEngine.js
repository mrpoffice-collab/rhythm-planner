// Scoring Engine for Micro-App Ideas
// Converts qualitative AI descriptions into quantitative scores (0-10)

export const calculateBuildSpeed = (buildTime, complexity) => {
  // Build Speed: 10/10 = 1-3 days, 1/10 = months
  let score = 5; // baseline
  
  const timeStr = buildTime.toLowerCase();
  const complexityStr = complexity?.toLowerCase() || '';
  
  // Parse time estimates
  if (timeStr.includes('hour') || timeStr.includes('1 day') || timeStr.includes('1-2 day')) {
    score = 10;
  } else if (timeStr.includes('2-3 day') || timeStr.includes('3 day')) {
    score = 9;
  } else if (timeStr.includes('4-5 day') || timeStr.includes('1 week') || timeStr.includes('5-7 day')) {
    score = 7;
  } else if (timeStr.includes('2 week') || timeStr.includes('10 day') || timeStr.includes('10-14 day')) {
    score = 5;
  } else if (timeStr.includes('3 week') || timeStr.includes('month')) {
    score = 3;
  } else if (timeStr.includes('months') || timeStr.includes('2 month') || timeStr.includes('3 month')) {
    score = 1;
  }
  
  // Adjust based on complexity
  if (complexityStr.includes('simple') || complexityStr.includes('easy')) {
    score = Math.min(10, score + 1);
  } else if (complexityStr.includes('complex') || complexityStr.includes('difficult')) {
    score = Math.max(1, score - 2);
  }
  
  return Math.min(10, Math.max(1, score));
};

export const calculateMarketSize = (targetAudience, marketDemand) => {
  // Market Size: 10/10 = millions + high search volume
  let score = 5; // baseline
  
  const audienceStr = targetAudience.toLowerCase();
  const demandStr = marketDemand?.toLowerCase() || '';
  
  // Look for size indicators
  if (audienceStr.includes('million') || audienceStr.includes('everyone') || audienceStr.includes('all businesses')) {
    score += 3;
  } else if (audienceStr.includes('thousand') || audienceStr.includes('small business')) {
    score += 1;
  } else if (audienceStr.includes('niche') || audienceStr.includes('specific')) {
    score -= 1;
  }
  
  // Demand level
  if (demandStr.includes('high') || demandStr.includes('strong')) {
    score += 2;
  } else if (demandStr.includes('medium') || demandStr.includes('moderate')) {
    score += 0;
  } else if (demandStr.includes('low') || demandStr.includes('limited')) {
    score -= 2;
  }
  
  return Math.min(10, Math.max(1, score));
};

export const calculateRealValue = (painPoint, monetization) => {
  // Real Value/Painkiller: 10/10 = solves expensive recurring problem
  let score = 5; // baseline
  
  const painStr = painPoint.toLowerCase();
  const monetizationStr = monetization?.toLowerCase() || '';
  
  // Pain intensity indicators
  const highValueKeywords = ['expensive', 'critical', 'urgent', 'daily', 'recurring', 'save money', 'save time', 'prevent loss'];
  const mediumValueKeywords = ['helpful', 'convenient', 'useful', 'better'];
  const lowValueKeywords = ['nice to have', 'minor', 'occasional'];
  
  let matchedHigh = highValueKeywords.some(keyword => painStr.includes(keyword));
  let matchedMedium = mediumValueKeywords.some(keyword => painStr.includes(keyword));
  let matchedLow = lowValueKeywords.some(keyword => painStr.includes(keyword));
  
  if (matchedHigh) score += 3;
  else if (matchedMedium) score += 1;
  else if (matchedLow) score -= 2;
  
  // Monetization potential
  if (monetizationStr.includes('subscription') || monetizationStr.includes('recurring')) {
    score += 2;
  } else if (monetizationStr.includes('one-time') || monetizationStr.includes('pay once')) {
    score += 0;
  } else if (monetizationStr.includes('free') || monetizationStr.includes('ads')) {
    score -= 1;
  }
  
  return Math.min(10, Math.max(1, score));
};

export const calculateNicheSpecificity = (nicheFocus, targetAudience) => {
  // Niche Specificity: 10/10 = hyper-specific audience
  let score = 5; // baseline
  
  const nicheStr = nicheFocus?.toLowerCase() || '';
  const audienceStr = targetAudience.toLowerCase();
  
  // Specificity indicators
  const hyperSpecific = ['very specific', 'hyper-specific', 'narrow', 'specialized', 'exact'];
  const moderatelySpecific = ['specific', 'targeted', 'focused'];
  const broad = ['broad', 'general', 'wide', 'everyone', 'all'];
  
  if (hyperSpecific.some(keyword => nicheStr.includes(keyword) || audienceStr.includes(keyword))) {
    score += 3;
  } else if (moderatelySpecific.some(keyword => nicheStr.includes(keyword))) {
    score += 1;
  } else if (broad.some(keyword => nicheStr.includes(keyword) || audienceStr.includes(keyword))) {
    score -= 2;
  }
  
  // Count specific descriptors in target audience
  const descriptors = audienceStr.split(' ').length;
  if (descriptors > 8) score += 2; // Very specific description
  else if (descriptors > 5) score += 1; // Moderately specific
  
  return Math.min(10, Math.max(1, score));
};

export const calculateScalePotential = (scaleability) => {
  // Scale Potential: 10/10 = easy expansion to adjacent markets
  let score = 5; // baseline
  
  const scaleStr = scaleability?.toLowerCase() || '';
  
  // Scale indicators
  const highScale = ['easy', 'high', 'strong', 'multiple markets', 'expand', 'global', 'international'];
  const mediumScale = ['moderate', 'medium', 'some potential', 'possible'];
  const lowScale = ['limited', 'low', 'difficult', 'narrow', 'restricted'];
  
  if (highScale.some(keyword => scaleStr.includes(keyword))) {
    score += 3;
  } else if (mediumScale.some(keyword => scaleStr.includes(keyword))) {
    score += 0;
  } else if (lowScale.some(keyword => scaleStr.includes(keyword))) {
    score -= 2;
  }
  
  return Math.min(10, Math.max(1, score));
};

export const scoreIdea = (idea, weights = null) => {
  // Default weights matching your requirements
  const defaultWeights = {
    buildSpeed: 0.30,
    marketSize: 0.20,
    realValue: 0.25,
    nicheSpecificity: 0.15,
    scalePotential: 0.10
  };
  
  const w = weights || defaultWeights;
  
  const scores = {
    buildSpeed: calculateBuildSpeed(idea.buildTime, idea.buildComplexity),
    marketSize: calculateMarketSize(idea.targetAudience, idea.marketDemand),
    realValue: calculateRealValue(idea.painPoint, idea.monetization),
    nicheSpecificity: calculateNicheSpecificity(idea.nicheFocus, idea.targetAudience),
    scalePotential: calculateScalePotential(idea.scaleability)
  };
  
  const totalScore = 
    scores.buildSpeed * w.buildSpeed +
    scores.marketSize * w.marketSize +
    scores.realValue * w.realValue +
    scores.nicheSpecificity * w.nicheSpecificity +
    scores.scalePotential * w.scalePotential;
  
  return {
    ...scores,
    totalScore: Math.round(totalScore * 10) / 10 // Round to 1 decimal
  };
};

export const scoreAllIdeas = (ideas, weights = null) => {
  return ideas.map(idea => ({
    ...idea,
    scores: scoreIdea(idea, weights)
  }));
};

export const findWinner = (scoredIdeas) => {
  if (!scoredIdeas || scoredIdeas.length === 0) return null;
  
  return scoredIdeas.reduce((winner, current) => 
    current.scores.totalScore > winner.scores.totalScore ? current : winner
  );
};

export const explainWinner = (winner) => {
  if (!winner) return [];
  
  const scores = winner.scores;
  const reasons = [];
  
  // Find top 3 scoring metrics
  const metricScores = [
    { name: 'Build Speed', score: scores.buildSpeed, weight: 0.30 },
    { name: 'Market Size', score: scores.marketSize, weight: 0.20 },
    { name: 'Real Value', score: scores.realValue, weight: 0.25 },
    { name: 'Niche Specificity', score: scores.nicheSpecificity, weight: 0.15 },
    { name: 'Scale Potential', score: scores.scalePotential, weight: 0.10 }
  ].sort((a, b) => b.score - a.score);
  
  // Generate reasoning based on top metrics
  if (metricScores[0].score >= 8) {
    reasons.push(`Excellent ${metricScores[0].name.toLowerCase()} (${metricScores[0].score}/10) makes this highly executable`);
  }
  
  if (metricScores[1].score >= 7) {
    reasons.push(`Strong ${metricScores[1].name.toLowerCase()} (${metricScores[1].score}/10) indicates solid market opportunity`);
  }
  
  if (scores.totalScore >= 8) {
    reasons.push(`Outstanding overall score (${scores.totalScore}/10) across all metrics`);
  } else if (scores.totalScore >= 7) {
    reasons.push(`Well-balanced approach with good scores across multiple metrics`);
  }
  
  return reasons.slice(0, 3); // Return top 3 reasons
};
