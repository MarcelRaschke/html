import { InjectionPatterns } from './patterns.js';

export class SanitizationStrategy {
  sanitize(input) {
    throw new Error('sanitize() must be implemented by subclass');
  }
}

export class StrictNormalizationStrategy extends SanitizationStrategy {
  sanitize(input) {
    let result = input;

    // Remove null bytes
    result = result.replace(InjectionPatterns.controlCharacters, '');

    // Normalize whitespace (collapse multiple spaces)
    result = result.replace(/\s+/g, ' ').trim();

    // Remove leading/trailing special characters
    result = result.replace(/^[\W_]+|[\W_]+$/g, '');

    // Normalize Unicode (NFKC form)
    result = result.normalize('NFKC');

    return result;
  }
}

export class DelimiterRemovalStrategy extends SanitizationStrategy {
  constructor(options = {}) {
    super();
    this.preserveDelimiters = options.preserveDelimiters || [];
  }

  sanitize(input) {
    let result = input;

    // Remove delimiter attack patterns
    result = result.replace(InjectionPatterns.delimiterAttacks, '');

    // Remove potential system prompt markers
    result = result.replace(/\[system\]|\[admin\]|\{system\}|\{admin\}/gi, '');

    return result;
  }
}

export class PatternBlockingStrategy extends SanitizationStrategy {
  constructor(options = {}) {
    super();
    this.patternList = options.patterns || [
      ...InjectionPatterns.systemPromptBreakouts,
      ...InjectionPatterns.rolePlayingAttacks,
      ...InjectionPatterns.contextInjection,
    ];
  }

  sanitize(input) {
    let result = input;

    for (const pattern of this.patternList) {
      result = result.replace(pattern, '');
    }

    return result;
  }
}

export class ContextNormalizationStrategy extends SanitizationStrategy {
  sanitize(input) {
    let result = input;

    // Remove multi-line prompt injection attempts
    result = result.replace(/\n\s*(?:as|if|when|assuming)\s+you\s+are/gi, '');
    result = result.replace(/\n\s*(?:pretend|imagine|consider)\s+that/gi, '');

    // Limit consecutive newlines
    result = result.replace(/\n{3,}/g, '\n\n');

    // Remove trailing instruction-like newlines
    result = result.replace(/\n\s*(?:remember|note|important|attention)[\s:]*$/gi, '');

    return result;
  }
}

export class HTMLEscapingStrategy extends SanitizationStrategy {
  sanitize(input) {
    const map = {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;',
    };

    return input.replace(/[&<>"']/g, char => map[char]);
  }
}

export class CompositeStrategy extends SanitizationStrategy {
  constructor(strategies = []) {
    super();
    this.strategies = strategies;
  }

  sanitize(input) {
    let result = input;

    for (const strategy of this.strategies) {
      result = strategy.sanitize(result);
    }

    return result;
  }

  addStrategy(strategy) {
    this.strategies.push(strategy);
    return this;
  }
}

export class TokenLimitingStrategy extends SanitizationStrategy {
  constructor(options = {}) {
    super();
    this.maxTokens = options.maxTokens || 1000;
    this.tokenEstimate = options.tokenEstimate || 'conservative'; // conservative, moderate, optimistic
  }

  sanitize(input) {
    const estimatedTokens = this.estimateTokens(input);

    if (estimatedTokens > this.maxTokens) {
      return this.truncate(input, this.maxTokens);
    }

    return input;
  }

  estimateTokens(text) {
    // Rough token estimation based on tokenization patterns
    const wordCount = text.split(/\s+/).length;
    const charCount = text.length;

    switch (this.tokenEstimate) {
      case 'conservative':
        return Math.ceil(charCount / 3);
      case 'moderate':
        return Math.ceil(charCount / 4);
      case 'optimistic':
        return Math.ceil(wordCount);
      default:
        return Math.ceil(charCount / 4);
    }
  }

  truncate(text, maxTokens) {
    const estimatedChars = maxTokens * 4; // Inverse of moderate estimate
    return text.substring(0, estimatedChars).trim();
  }
}

export class SpecialCharacterNormalizationStrategy extends SanitizationStrategy {
  sanitize(input) {
    let result = input;

    // Replace homograph characters
    result = result.replace(/[а-яёґєї]/g, char => {
      const map = {
        'а': 'a', 'е': 'e', 'о': 'o', 'р': 'p', 'с': 'c', 'х': 'x', 'у': 'y',
        'ё': 'e', 'б': 'b', 'в': 'v', 'г': 'g', 'д': 'd', 'з': 'z', 'и': 'i',
        'й': 'i', 'к': 'k', 'л': 'l', 'м': 'm', 'н': 'n', 'т': 't', 'ф': 'f',
      };
      return map[char] || char;
    });

    // Normalize quotes
    result = result.replace(/[""]/g, '"');
    result = result.replace(/['\']/g, "'");

    // Normalize dashes
    result = result.replace(/[–—]/g, '-');

    return result;
  }
}

export const DefaultSanitizationPipeline = [
  new StrictNormalizationStrategy(),
  new SpecialCharacterNormalizationStrategy(),
  new DelimiterRemovalStrategy(),
  new PatternBlockingStrategy(),
  new ContextNormalizationStrategy(),
  new TokenLimitingStrategy({ maxTokens: 2000 }),
];
