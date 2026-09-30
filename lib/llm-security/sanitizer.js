import { InputValidator, LanguageValidator, EntropyValidator } from './validators.js';
import { CompositeStrategy, DefaultSanitizationPipeline } from './strategies.js';

export class LLMInputSanitizer {
  constructor(options = {}) {
    this.validator = new InputValidator({
      maxLength: options.maxLength || 10000,
      allowedLanguages: options.allowedLanguages,
      strictMode: options.strictMode ?? true,
    });

    this.languageValidator = new LanguageValidator(options.allowedLanguages);
    this.entropyValidator = options.entropyValidator ?? true;

    this.strategies = options.strategies || DefaultSanitizationPipeline;
    this.compositeStrategy = new CompositeStrategy(this.strategies);

    this.rateLimit = options.rateLimit || { maxPerMinute: 100, trackByIP: true };
    this.requestLog = new Map();

    this.auditLog = [];
    this.enableAudit = options.enableAudit ?? true;
  }

  process(input, context = {}) {
    const requestId = this.generateRequestId();
    const timestamp = Date.now();

    // Rate limiting check
    if (!this.checkRateLimit(context.userId || context.ip)) {
      this.log(requestId, 'RATE_LIMIT_EXCEEDED', { input, context }, 'error');
      throw new Error('Rate limit exceeded');
    }

    // Step 1: Input validation
    const validationResult = this.validator.validate(input);
    if (!validationResult.isValid && this.validator.strictMode) {
      this.log(requestId, 'VALIDATION_FAILED', { violations: validationResult.violations }, 'error');
      throw new Error(`Input validation failed: ${validationResult.violations[0].message}`);
    }

    // Step 2: Language validation (if enabled)
    let languageResult = null;
    if (this.validator.allowedLanguages) {
      languageResult = this.languageValidator.validateLanguage(input);
      if (!languageResult.isValid) {
        this.log(requestId, 'LANGUAGE_NOT_ALLOWED', { detected: languageResult.detected }, 'warning');
        throw new Error(`Language not allowed: ${languageResult.detected}`);
      }
    }

    // Step 3: Entropy validation (if enabled)
    let entropyResult = null;
    if (this.entropyValidator) {
      entropyResult = EntropyValidator.prototype.validateEntropy.call(
        new EntropyValidator(),
        input
      );
      if (!entropyResult.isValid && validationResult.riskLevel === 'high') {
        this.log(requestId, 'ENTROPY_WARNING', { entropy: entropyResult.entropy }, 'warning');
      }
    }

    // Step 4: Sanitization
    const sanitized = this.compositeStrategy.sanitize(input);

    // Step 5: Post-sanitization validation (paranoid mode)
    const postSanitizationValidation = this.validator.validate(sanitized);

    // Audit logging
    this.log(requestId, 'SANITIZATION_COMPLETE', {
      inputLength: input.length,
      sanitizedLength: sanitized.length,
      riskLevel: validationResult.riskLevel,
      violations: validationResult.violations.length,
      bytesRemoved: input.length - sanitized.length,
    }, 'info');

    return {
      requestId,
      original: input,
      sanitized,
      metadata: {
        timestamp,
        inputLength: input.length,
        sanitizedLength: sanitized.length,
        bytesRemoved: input.length - sanitized.length,
        validationResult,
        entropyResult,
        languageResult,
        riskLevel: validationResult.riskLevel,
        violations: validationResult.violations,
      },
    };
  }

  checkRateLimit(identifier) {
    const key = identifier || 'global';
    const now = Date.now();
    const windowMs = 60 * 1000; // 1 minute

    if (!this.requestLog.has(key)) {
      this.requestLog.set(key, []);
    }

    const requests = this.requestLog.get(key);
    const recentRequests = requests.filter(ts => now - ts < windowMs);

    if (recentRequests.length >= this.rateLimit.maxPerMinute) {
      return false;
    }

    recentRequests.push(now);
    this.requestLog.set(key, recentRequests);

    // Cleanup old entries
    if (recentRequests.length > this.rateLimit.maxPerMinute * 2) {
      this.requestLog.set(key, recentRequests.slice(-this.rateLimit.maxPerMinute));
    }

    return true;
  }

  generateRequestId() {
    return `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  log(requestId, event, data, level = 'info') {
    if (!this.enableAudit) return;

    const logEntry = {
      requestId,
      timestamp: new Date().toISOString(),
      event,
      level,
      data,
    };

    this.auditLog.push(logEntry);

    // Keep audit log size manageable
    if (this.auditLog.length > 10000) {
      this.auditLog = this.auditLog.slice(-5000);
    }
  }

  getAuditLog(limit = 100, level = null) {
    let logs = this.auditLog;

    if (level) {
      logs = logs.filter(entry => entry.level === level);
    }

    return logs.slice(-limit);
  }

  clearAuditLog() {
    this.auditLog = [];
  }

  addStrategy(strategy) {
    this.compositeStrategy.addStrategy(strategy);
    return this;
  }

  getStatistics() {
    const logs = this.auditLog;
    const errors = logs.filter(l => l.level === 'error').length;
    const warnings = logs.filter(l => l.level === 'warning').length;
    const total = logs.length;

    return {
      totalEvents: total,
      errors,
      warnings,
      errorRate: total > 0 ? ((errors / total) * 100).toFixed(2) + '%' : '0%',
      warningRate: total > 0 ? ((warnings / total) * 100).toFixed(2) + '%' : '0%',
    };
  }
}

// Factory for creating preconfigured sanitizers
export const SanitizerPresets = {
  strict: (options = {}) => new LLMInputSanitizer({
    strictMode: true,
    entropyValidator: true,
    maxLength: 5000,
    ...options,
  }),

  moderate: (options = {}) => new LLMInputSanitizer({
    strictMode: true,
    entropyValidator: false,
    maxLength: 10000,
    ...options,
  }),

  permissive: (options = {}) => new LLMInputSanitizer({
    strictMode: false,
    entropyValidator: false,
    maxLength: 50000,
    ...options,
  }),
};

export default LLMInputSanitizer;
