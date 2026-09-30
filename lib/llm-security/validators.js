import { InjectionPatterns, SeverityMap, PatternSeverity } from './patterns.js';

export class InputValidator {
  constructor(options = {}) {
    this.maxLength = options.maxLength || 10000;
    this.allowedLanguages = options.allowedLanguages || null;
    this.strictMode = options.strictMode ?? true;
    this.detectionResults = [];
  }

  validate(input) {
    if (typeof input !== 'string') {
      throw new TypeError('Input must be a string');
    }

    this.detectionResults = [];
    const violations = [];

    // Check length limits
    if (input.length > this.maxLength) {
      violations.push({
        type: 'length_exceeded',
        severity: PatternSeverity.HIGH,
        message: `Input exceeds maximum length of ${this.maxLength} characters`,
        length: input.length,
      });
    }

    // Check for null bytes and control characters
    if (InjectionPatterns.controlCharacters.test(input)) {
      violations.push({
        type: 'control_characters',
        severity: SeverityMap.controlCharacters,
        message: 'Input contains control characters',
      });
    }

    // Check for suspicious patterns
    for (const [patternName, patterns] of Object.entries(InjectionPatterns)) {
      if (patternName === 'controlCharacters') continue;

      const patternList = Array.isArray(patterns) ? patterns : [patterns];
      for (const pattern of patternList) {
        // Reset regex state for global patterns
        if (pattern.global) {
          pattern.lastIndex = 0;
        }

        if (pattern.test(input)) {
          violations.push({
            type: patternName,
            severity: SeverityMap[patternName],
            message: `Detected potential injection pattern: ${patternName}`,
            pattern: pattern.source,
          });
          // Break after first match to avoid redundant detections
          break;
        }
      }
    }

    this.detectionResults = violations;

    return {
      isValid: violations.filter(v => v.severity === PatternSeverity.CRITICAL).length === 0,
      violations,
      riskLevel: this.calculateRiskLevel(violations),
    };
  }

  calculateRiskLevel(violations) {
    if (violations.length === 0) return 'none';

    const hasCritical = violations.some(v => v.severity === PatternSeverity.CRITICAL);
    const hasHigh = violations.some(v => v.severity === PatternSeverity.HIGH);
    const hasMedium = violations.some(v => v.severity === PatternSeverity.MEDIUM);

    if (hasCritical) return 'critical';
    if (hasHigh) return 'high';
    if (hasMedium) return 'medium';
    return 'low';
  }

  getDetectionResults() {
    return this.detectionResults;
  }
}

export class LanguageValidator {
  constructor(allowedLanguages = null) {
    this.allowedLanguages = allowedLanguages;
  }

  validateLanguage(input) {
    if (!this.allowedLanguages) {
      return { isValid: true };
    }

    // Simple language detection based on character ranges
    const detected = this.detectLanguage(input);
    const isAllowed = this.allowedLanguages.includes(detected);

    return {
      isValid: isAllowed,
      detected,
      message: isAllowed
        ? `Language '${detected}' is allowed`
        : `Language '${detected}' is not in allowed list`,
    };
  }

  detectLanguage(input) {
    const latinCount = (input.match(/[a-zA-Z]/g) || []).length;
    const cyrillicCount = (input.match(/[а-яёґєї]/gi) || []).length;
    const asianCount = (input.match(/[一-鿿぀-ゟ가-힯]/g) || []).length;
    const arabicCount = (input.match(/[؀-ۿ]/g) || []).length;

    const scores = {
      latin: latinCount,
      cyrillic: cyrillicCount,
      asian: asianCount,
      arabic: arabicCount,
    };

    const [dominant] = Object.entries(scores).sort(([, a], [, b]) => b - a);
    return dominant[0] || 'unknown';
  }
}

export class EntropyValidator {
  static calculateEntropy(input) {
    const len = input.length;
    const freq = {};

    for (let i = 0; i < len; i++) {
      freq[input[i]] = (freq[input[i]] || 0) + 1;
    }

    let entropy = 0;
    for (const count of Object.values(freq)) {
      const p = count / len;
      entropy -= p * Math.log2(p);
    }

    return entropy;
  }

  validateEntropy(input, minEntropy = 2.0, maxEntropy = 7.0) {
    const entropy = EntropyValidator.calculateEntropy(input);

    return {
      entropy,
      isValid: entropy >= minEntropy && entropy <= maxEntropy,
      message: entropy < minEntropy
        ? 'Input has suspiciously low entropy (possible token smuggling)'
        : entropy > maxEntropy
          ? 'Input has unusually high entropy'
          : 'Entropy within acceptable range',
    };
  }
}
