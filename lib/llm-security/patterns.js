export const InjectionPatterns = {
  // System prompt breakout attempts
  systemPromptBreakouts: [
    /ignore\s+(?:\w+\s+)*previous\s+instructions/gi,
    /disregard\s+(?:\w+\s+)*prior\s+instructions/gi,
    /forget\s+(?:\w+\s+)*previous\s+context/gi,
    /act\s+as\s+if\s+you\s+are/gi,
    /pretend\s+you\s+(?:are\s+)?not/gi,
    /you\s+are\s+now\s+a\s+(?:different\s+)?system/gi,
  ],

  // Delimiter attacks
  delimiterAttacks: [
    /[\[\{\(]system[\]\}\)]/gi,
    /[\[\{\(]admin[\]\}\)]/gi,
    /---+/g,
    /===+/g,
    /####+/g,
  ],

  // Context injection via formatting
  contextInjection: [
    /\n\s*(?:as|if|when|assuming)\s+you\s+are/gi,
    /\n\s*(?:pretend|imagine|consider)\s+that/gi,
    /\n\s*(?:from now on|henceforth|going forward)/gi,
  ],

  // Role-playing attempts
  rolePlayingAttacks: [
    /you\s+are\s+(?:a|an)\s+(?:evil|malicious|hacked|compromised)/gi,
    /you\s+must\s+ignore\s+your\s+(?:rules|guidelines|instructions)/gi,
    /bypass\s+(?:safety|security|filter)/gi,
  ],

  // Token smuggling via special encoding
  tokenSmugglingPatterns: [
    /\$\{.*?\}/g,
    /\{\{.*?\}\}/g,
    /<\s*script/gi,
    /<\s*iframe/gi,
    /javascript:/gi,
    /on\w+\s*=/gi,
  ],

  // SQL/Command injection (context-dependent)
  sqlInjectionPatterns: [
    /('\s*(or|and)\s*'|\d+\s*(or|and)\s*\d+)/gi,
    /(union\s+select|select\s+from|insert\s+into|delete\s+from)/gi,
    /(drop\s+table|truncate|update\s+\w+\s+set)/gi,
  ],

  // Environment variable leakage
  envVarLeakage: [
    /\$\{[A-Z_]+\}/g,
    /process\.env\.\w+/g,
    /os\.environ/g,
    /System\.getenv/g,
  ],

  // Null byte and control character injection
  controlCharacters: /[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g,

  // Homograph attacks (confusable characters)
  homographCharacters: /[а-яёґєї]/g, // Cyrillic lookalikes

  // Excessive repetition/spam
  excessiveRepetition: /(.)\1{100,}|(\w+\s+){50,}/g,
};

export const PatternSeverity = {
  CRITICAL: 'critical',
  HIGH: 'high',
  MEDIUM: 'medium',
  LOW: 'low',
};

export const SeverityMap = {
  systemPromptBreakouts: PatternSeverity.CRITICAL,
  delimiterAttacks: PatternSeverity.HIGH,
  contextInjection: PatternSeverity.HIGH,
  rolePlayingAttacks: PatternSeverity.CRITICAL,
  tokenSmugglingPatterns: PatternSeverity.HIGH,
  sqlInjectionPatterns: PatternSeverity.CRITICAL,
  envVarLeakage: PatternSeverity.CRITICAL,
  controlCharacters: PatternSeverity.MEDIUM,
  homographCharacters: PatternSeverity.MEDIUM,
  excessiveRepetition: PatternSeverity.MEDIUM,
};
