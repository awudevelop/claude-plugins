const fs = require('fs').promises;
const path = require('path');

// Keyword dictionaries with weights
const KEYWORDS = {
  feature: {
    primary: ['implement', 'build', 'create', 'add', 'develop', 'feature'],
    secondary: ['new functionality', 'enhancement', 'capability', 'integration'],
    weight: {
      primary: 10,
      secondary: 5
    }
  },
  bug: {
    primary: ['fix', 'bug', 'error', 'issue', 'broken', 'failing'],
    secondary: ['crash', 'exception', 'not working', 'regression'],
    weight: {
      primary: 10,
      secondary: 5
    }
  },
  spike: {
    primary: ['explore', 'investigate', 'research', 'experiment', 'spike'],
    secondary: ['proof of concept', 'poc', 'feasibility', 'evaluate'],
    weight: {
      primary: 10,
      secondary: 5
    }
  },
  refactor: {
    primary: ['refactor', 'restructure', 'reorganize', 'cleanup', 'improve'],
    secondary: ['technical debt', 'code quality', 'maintainability'],
    weight: {
      primary: 10,
      secondary: 5
    }
  }
};

// Pattern detectors
const PATTERNS = {
  feature: {
    hasRequirements: (log) => log.some(entry =>
      entry.content.toLowerCase().includes('requirement') ||
      entry.content.toLowerCase().includes('should') ||
      entry.content.match(/we need to/i)
    ),
    hasUserStory: (log) => log.some(entry =>
      entry.content.match(/as a .* I want/i) ||
      entry.content.match(/user should be able to/i)
    ),
    hasPhases: (log) => log.some(entry =>
      entry.content.match(/phase \d+/i) ||
      entry.content.match(/step \d+/i)
    )
  },
  bug: {
    hasErrorDiscussion: (log) => log.some(entry =>
      entry.content.match(/error:|exception:|stack trace/i) ||
      entry.content.includes('TypeError') ||
      entry.content.includes('ReferenceError')
    ),
    hasReproSteps: (log) => log.some(entry =>
      entry.content.match(/steps to reproduce/i) ||
      entry.content.match(/to reproduce:/i)
    ),
    hasExpectedVsActual: (log) => log.some(entry =>
      entry.content.match(/expected.*actual/i) ||
      entry.content.match(/should.*but.*instead/i)
    )
  },
  spike: {
    hasQuestions: (log) => {
      const questionCount = log.reduce((count, entry) => {
        const matches = entry.content.match(/\?/g);
        return count + (matches ? matches.length : 0);
      }, 0);
      return questionCount > 5; // High question density
    },
    hasComparison: (log) => log.some(entry =>
      entry.content.match(/compare|versus|vs\.|alternative|option/i)
    ),
    hasUncertainty: (log) => log.some(entry =>
      entry.content.match(/not sure|unclear|investigate|explore/i)
    )
  },
  refactor: {
    hasCodeQualityDiscussion: (log) => log.some(entry =>
      entry.content.match(/code smell|technical debt|cleanup|messy/i)
    ),
    hasStructureDiscussion: (log) => log.some(entry =>
      entry.content.match(/structure|organization|architecture|pattern/i)
    ),
    hasNoNewFeature: (log) => {
      const featureKeywords = ['new feature', 'add functionality', 'implement'];
      return !log.some(entry =>
        featureKeywords.some(kw => entry.content.toLowerCase().includes(kw))
      );
    }
  }
};

/**
 * Main detection function
 */
async function detectWorkType(conversationLog) {
  if (!conversationLog || conversationLog.length === 0) {
    return {
      type: 'unknown',
      confidence: 0,
      signals: {},
      reason: 'No conversation data provided'
    };
  }

  // Step 1: Analyze keywords
  const conversationText = conversationLog
    .map(entry => {
      // Support both old format (.content) and compact format (.p and .r)
      if (entry.content) return entry.content;
      // Compact format: combine user prompt and assistant response
      return [entry.p, entry.r].filter(Boolean).join(' ');
    })
    .join(' ')
    .toLowerCase();

  const keywordAnalysis = analyzeKeywords(conversationText);

  // Step 2: Analyze patterns
  const patternAnalysis = analyzePatterns(conversationLog);

  // Step 3: Calculate scores
  const scores = calculateScores(keywordAnalysis, patternAnalysis);

  // Step 4: Determine winner
  const sortedScores = Object.entries(scores)
    .sort((a, b) => b[1] - a[1]);

  const [topType, topScore] = sortedScores[0];
  const [secondType, secondScore] = sortedScores[1];

  // Step 5: Calculate confidence
  const confidence = calculateConfidence(topScore, secondScore, conversationLog.length);

  return {
    type: confidence < 50 ? 'unknown' : topType,
    confidence: Math.round(confidence),
    signals: {
      featureScore: Math.round(scores.feature),
      bugScore: Math.round(scores.bug),
      spikeScore: Math.round(scores.spike),
      refactorScore: Math.round(scores.refactor),
      keywords: keywordAnalysis,
      patterns: patternAnalysis,
      conversationLength: conversationLog.length
    }
  };
}

/**
 * Analyzes keywords in conversation text
 */
function analyzeKeywords(text) {
  const analysis = {};

  for (const [workType, keywords] of Object.entries(KEYWORDS)) {
    let score = 0;
    const matched = { primary: [], secondary: [] };

    // Check primary keywords
    keywords.primary.forEach(keyword => {
      const regex = new RegExp(`\\b${keyword}\\b`, 'gi');
      const matches = text.match(regex);
      if (matches) {
        score += matches.length * keywords.weight.primary;
        matched.primary.push(keyword);
      }
    });

    // Check secondary keywords
    keywords.secondary.forEach(keyword => {
      const regex = new RegExp(keyword, 'gi');
      const matches = text.match(regex);
      if (matches) {
        score += matches.length * keywords.weight.secondary;
        matched.secondary.push(keyword);
      }
    });

    analysis[workType] = { score, matched };
  }

  return analysis;
}

/**
 * Analyzes patterns in conversation
 */
function analyzePatterns(conversationLog) {
  const analysis = {};

  for (const [workType, patterns] of Object.entries(PATTERNS)) {
    analysis[workType] = {};
    for (const [patternName, detector] of Object.entries(patterns)) {
      analysis[workType][patternName] = detector(conversationLog);
    }
  }

  return analysis;
}

/**
 * Calculates final scores combining keywords and patterns
 */
function calculateScores(keywordAnalysis, patternAnalysis) {
  const scores = {
    feature: 0,
    bug: 0,
    spike: 0,
    refactor: 0
  };

  // Add keyword scores (max 100 points each)
  for (const [workType, data] of Object.entries(keywordAnalysis)) {
    scores[workType] += Math.min(data.score, 100);
  }

  // Add pattern bonuses (10 points per matched pattern)
  for (const [workType, patterns] of Object.entries(patternAnalysis)) {
    const matchedPatterns = Object.values(patterns).filter(Boolean).length;
    scores[workType] += matchedPatterns * 10;
  }

  return scores;
}

/**
 * Calculates confidence based on score separation and conversation length
 */
function calculateConfidence(topScore, secondScore, conversationLength) {
  // Base confidence from score separation
  const scoreSeparation = topScore - secondScore;
  let confidence = Math.min((scoreSeparation / topScore) * 100, 100);

  // Adjust for conversation length (more data = higher confidence)
  if (conversationLength < 5) {
    confidence *= 0.6; // Low confidence for short conversations
  } else if (conversationLength < 10) {
    confidence *= 0.8; // Medium confidence
  }
  // else: full confidence for 10+ messages

  // Minimum threshold
  if (topScore < 20) {
    confidence = Math.min(confidence, 40); // Cap at 40% if overall score is low
  }

  return confidence;
}

module.exports = {
  detectWorkType,
  analyzeKeywords,
  analyzePatterns,
  calculateScores,
  KEYWORDS,
  PATTERNS
};
