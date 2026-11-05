// Phase 1: Core sanitization and validation
export { LLMInputSanitizer, SanitizerPresets, default } from './sanitizer.js';
export { InputValidator, LanguageValidator, EntropyValidator } from './validators.js';
export {
  SanitizationStrategy,
  StrictNormalizationStrategy,
  DelimiterRemovalStrategy,
  PatternBlockingStrategy,
  ContextNormalizationStrategy,
  HTMLEscapingStrategy,
  CompositeStrategy,
  TokenLimitingStrategy,
  SpecialCharacterNormalizationStrategy,
  DefaultSanitizationPipeline,
} from './strategies.js';
export { InjectionPatterns, PatternSeverity, SeverityMap } from './patterns.js';

// Phase 2: ML-based detection and advanced patterns
export {
  EmbeddingAnomalyDetector,
  BayesianRiskScorer,
  MultiLLMProfiler,
  combineDetectionSignals,
} from './ml-detector.js';
export {
  ExtendedInjectionPatterns,
  ExtendedSeverityMap,
  PatternCoverageMap,
} from './patterns-extended.js';
export {
  AdaptiveValidator,
  createAdaptiveValidator,
} from './adaptive-validator.js';
