// Suggestion Detection Module
// Detects user-requested and important suggestions via pattern matching

/**
 * Patterns for detecting user-requested suggestions
 */
const USER_REQUEST_PATTERNS = [
  /what\s+should\s+I\s+do/i,
  /any\s+suggestions?/i,
  /how\s+would\s+you\s+(approach|handle|implement)/i,
  /what\s+do\s+you\s+(recommend|suggest)/i,
  /best\s+way\s+to/i,
  /what\s+are\s+the\s+alternatives/i,
  /alternatives?\s+to/i,
  /how\s+can\s+I\s+improve/i,
  /what\s+would\s+be\s+better/i,
  /your\s+(recommendation|advice)/i
];

/**
 * Patterns for detecting important suggestions from Claude
 * Format: { pattern, category, importance }
 */
const IMPORTANT_SUGGESTION_PATTERNS = [
  // Architecture suggestions
  { pattern: /I\s+(strongly\s+)?recommend\s+using/i, category: 'architecture', importance: 'high' },
  { pattern: /consider\s+using\s+\w+\s+for/i, category: 'architecture', importance: 'medium' },
  { pattern: /architecture:\s*/i, category: 'architecture', importance: 'high' },
  { pattern: /design\s+pattern:\s*/i, category: 'architecture', importance: 'medium' },

  // Security suggestions
  { pattern: /security:\s*/i, category: 'security', importance: 'high' },
  { pattern: /security\s+best\s+practice/i, category: 'security', importance: 'high' },
  { pattern: /(you\s+should|you\s+must)\s+(use|implement|add)\s+\w+\s+for\s+security/i, category: 'security', importance: 'high' },
  { pattern: /important\s+to\s+(implement|use|add)\s+\w+\s+to\s+prevent/i, category: 'security', importance: 'high' },

  // Performance suggestions
  { pattern: /performance:\s*/i, category: 'performance', importance: 'medium' },
  { pattern: /consider\s+caching/i, category: 'performance', importance: 'medium' },
  { pattern: /optimize\s+by/i, category: 'performance', importance: 'medium' },

  // Best practices
  { pattern: /best\s+practice:\s*/i, category: 'best-practice', importance: 'medium' },
  { pattern: /I\s+strongly\s+suggest/i, category: 'best-practice', importance: 'high' },
  { pattern: /critical\s+to/i, category: 'best-practice', importance: 'high' },

  // General recommendations
  { pattern: /I\s+recommend/i, category: 'general', importance: 'medium' },
  { pattern: /you\s+should\s+consider/i, category: 'general', importance: 'low' }
];

/**
 * Detect if user message is requesting suggestions
 * @param {string} userMessage - The user's message
 * @returns {boolean} - True if user is requesting suggestions
 */
function detectUserRequestedSuggestion(userMessage) {
  if (!userMessage || typeof userMessage !== 'string') {
    return false;
  }

  return USER_REQUEST_PATTERNS.some(pattern => pattern.test(userMessage));
}

/**
 * Detect important suggestions in Claude's response
 * @param {string} claudeResponse - Claude's response text
 * @returns {Array} - Array of detected suggestions with metadata
 */
function detectImportantSuggestions(claudeResponse) {
  if (!claudeResponse || typeof claudeResponse !== 'string') {
    return [];
  }

  const detectedSuggestions = [];
  const lines = claudeResponse.split('\n');

  for (const pattern of IMPORTANT_SUGGESTION_PATTERNS) {
    const matches = claudeResponse.match(pattern.pattern);
    if (matches) {
      // Find the line containing the match
      const matchedLine = lines.find(line => pattern.pattern.test(line));

      if (matchedLine) {
        // Extract suggestion text (the line containing the pattern)
        const suggestionText = matchedLine.trim();

        detectedSuggestions.push({
          type: 'important',
          category: pattern.category,
          importance: pattern.importance,
          text: suggestionText,
          pattern: pattern.pattern.source
        });
      }
    }
  }

  // Remove duplicates based on text
  const uniqueSuggestions = Array.from(
    new Map(detectedSuggestions.map(s => [s.text, s])).values()
  );

  return uniqueSuggestions;
}

/**
 * Extract suggestion context from surrounding conversation
 * @param {string} fullConversation - Recent conversation context
 * @param {number} maxLength - Maximum context length
 * @returns {string} - Extracted context
 */
function extractSuggestionContext(fullConversation, maxLength = 200) {
  if (!fullConversation) return '';

  const truncated = fullConversation.slice(0, maxLength);
  return truncated + (fullConversation.length > maxLength ? '...' : '');
}

/**
 * Categorize suggestion importance based on keywords
 * @param {string} suggestionText - The suggestion text
 * @returns {string} - 'high', 'medium', or 'low'
 */
function categorizeSuggestionImportance(suggestionText) {
  const text = suggestionText.toLowerCase();

  // High importance keywords
  if (text.includes('critical') ||
      text.includes('must') ||
      text.includes('security') ||
      text.includes('strongly recommend')) {
    return 'high';
  }

  // Medium importance keywords
  if (text.includes('should') ||
      text.includes('recommend') ||
      text.includes('best practice') ||
      text.includes('architecture')) {
    return 'medium';
  }

  return 'low';
}

// Export functions
module.exports = {
  detectUserRequestedSuggestion,
  detectImportantSuggestions,
  extractSuggestionContext,
  categorizeSuggestionImportance,
  USER_REQUEST_PATTERNS,
  IMPORTANT_SUGGESTION_PATTERNS
};
