import LLMInputSanitizer, { SanitizerPresets } from './sanitizer.js';

// Production configurations for different use cases

export const ProductionConfigs = {
  // For public chat applications - maximum security
  publicChat: () => new LLMInputSanitizer({
    maxLength: 2000,
    strictMode: true,
    entropyValidator: true,
    enableAudit: true,
    allowedLanguages: ['latin'], // Only allow ASCII/English
    rateLimit: {
      maxPerMinute: 50,
      trackByIP: true,
    },
  }),

  // For internal company applications - balanced
  internalChat: () => new LLMInputSanitizer({
    maxLength: 5000,
    strictMode: true,
    entropyValidator: true,
    enableAudit: true,
    rateLimit: {
      maxPerMinute: 200,
      trackByIP: false,
    },
  }),

  // For API endpoints - strict
  apiEndpoint: () => new LLMInputSanitizer({
    maxLength: 1000,
    strictMode: true,
    entropyValidator: true,
    enableAudit: true,
    rateLimit: {
      maxPerMinute: 100,
      trackByIP: true,
    },
  }),

  // For batch processing - moderate
  batchProcessing: () => new LLMInputSanitizer({
    maxLength: 10000,
    strictMode: false, // Sanitize instead of reject
    entropyValidator: false,
    enableAudit: true,
    rateLimit: {
      maxPerMinute: 1000,
      trackByIP: false,
    },
  }),

  // For trusted environments - permissive
  trustedEnvironment: () => new LLMInputSanitizer({
    maxLength: 50000,
    strictMode: false,
    entropyValidator: false,
    enableAudit: false,
    rateLimit: {
      maxPerMinute: 10000,
    },
  }),

  // For research/testing - custom
  research: () => new LLMInputSanitizer({
    maxLength: 20000,
    strictMode: false,
    entropyValidator: true,
    enableAudit: true,
    rateLimit: {
      maxPerMinute: 500,
    },
  }),

  // For multilingual applications
  multilingual: () => new LLMInputSanitizer({
    maxLength: 5000,
    strictMode: true,
    entropyValidator: true,
    allowedLanguages: ['latin', 'cyrillic', 'arabic'], // Multiple scripts
    enableAudit: true,
    rateLimit: {
      maxPerMinute: 100,
    },
  }),
};

// Quick access to presets
export const QuickStart = {
  strict: SanitizerPresets.strict,
  moderate: SanitizerPresets.moderate,
  permissive: SanitizerPresets.permissive,
};

// Example usage:
// import { ProductionConfigs } from './config.example.js';
// const sanitizer = ProductionConfigs.publicChat();
