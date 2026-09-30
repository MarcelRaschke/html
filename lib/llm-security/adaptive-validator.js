// AdaptiveValidator: Context-aware multi-signal validation with dynamic thresholds (Phase 2)
// Integrates pattern-based, semantic, statistical, and ML-based detection

import { LLMInputSanitizer } from './sanitizer.js';
import { EmbeddingAnomalyDetector, BayesianRiskScorer, MultiLLMProfiler } from './ml-detector.js';
import { ExtendedInjectionPatterns, ExtendedSeverityMap } from './patterns-extended.js';

/**
 * AdaptiveValidator: Multi-factor validation with context awareness
 * Combines structural, statistical, semantic, and ML-based signals
 * Adjusts thresholds based on context (user, model, risk profile)
 */
export class AdaptiveValidator {
  constructor(config = {}) {
    // Core components
    this.structuralSanitizer = new LLMInputSanitizer(config.sanitizer || {});
    this.embeddingDetector = new EmbeddingAnomalyDetector(config.embedding || {});
    this.bayesianScorer = new BayesianRiskScorer(config.bayesian || {});
    this.modelProfiler = new MultiLLMProfiler(config.profiler || {});

    // Configuration
    this.enableMLDetection = config.enableMLDetection !== false;
    this.contextAwareness = config.contextAwareness !== false;
    this.userHistoryTracking = config.userHistoryTracking !== false;
    this.dynamicThresholds = config.dynamicThresholds !== false;

    // User history for anomaly detection
    this.userHistory = new Map(); // userId -> { violations, patterns, riskProfile }
    this.maxHistorySize = config.maxHistorySize || 1000;

    // Thresholds (can be adjusted dynamically)
    this.thresholds = {
      structural: config.structuralThreshold || 0.8, // 0-1, higher = stricter
      semantic: config.semanticThreshold || 0.65,
      bayesian: config.bayesianThreshold || 0.7,
      bayesianCritical: config.bayesianCriticalThreshold || 0.9,
    };
  }

  /**
   * Main validation method: Multi-factor analysis with context awareness
   * Returns comprehensive validation result with all signals and reasoning
   */
  async validate(input, context = {}) {
    const startTime = Date.now();

    // Extract context information
    const {
      userId = null,
      model = 'claude',
      riskProfile = 'moderate',
      userHistory = null,
      recentContext = null,
    } = context;

    // Initialize result object
    const result = {
      isValid: true,
      riskLevel: 'low',
      signals: {},
      components: {},
      reasoning: [],
      recommendation: 'accept',
      latency: 0,
      timestamp: new Date().toISOString(),
    };

    // Layer 1: Structural/Pattern-based detection
    const structuralResult = this.structuralSanitizer.process(input, { userId });
    const structuralIsValid = structuralResult.metadata.validationResult.isValid;
    result.signals.structural = {
      isValid: structuralIsValid,
      violations: structuralResult.metadata.violations,
      score: structuralIsValid ? 0 : 0.8, // Violations = high risk
    };
    result.components.structural = structuralResult;

    if (!structuralIsValid) {
      result.reasoning.push(`Structural violations detected: ${structuralResult.metadata.violations.join(', ')}`);
    }

    // Layer 2: Semantic detection (if ML enabled)
    if (this.enableMLDetection) {
      const semanticResult = await this.embeddingDetector.detectSemanticJailbreak(input);
      result.signals.semantic = {
        detected: semanticResult.detected,
        similarity: semanticResult.score,
        confidence: semanticResult.confidence,
        patternFamily: semanticResult.patternFamily,
      };

      if (semanticResult.detected && semanticResult.score > this.thresholds.semantic) {
        result.reasoning.push(
          `Semantic jailbreak detected (${semanticResult.patternFamily}): ${(semanticResult.score * 100).toFixed(1)}% similarity`
        );
      }
    }

    // Layer 3: Model-specific profiling
    if (model && this.enableMLDetection) {
      const modelResult = this.modelProfiler.detectModelSpecificAttack(input, model);
      result.signals.modelSpecific = {
        detected: modelResult.detected,
        vulnerabilities: modelResult.vulnerabilities,
        confidence: modelResult.confidence,
      };

      if (modelResult.detected) {
        result.reasoning.push(
          `${model}-specific attack patterns detected: ${modelResult.vulnerabilities.join(', ')}`
        );
      }
    }

    // Layer 4: Extended pattern detection (Phase 2)
    const extendedViolations = this._checkExtendedPatterns(input);
    result.signals.extended = {
      violations: extendedViolations,
      count: extendedViolations.length,
    };

    if (extendedViolations.length > 0) {
      result.reasoning.push(
        `Extended threat patterns detected: ${extendedViolations.join(', ')}`
      );
    }

    // Layer 5: Bayesian risk scoring (combines all signals)
    if (this.enableMLDetection) {
      const bayesianSignals = {
        patternMatch: !structuralIsValid,
        highEntropy: structuralResult.metadata.entropyResult.entropy > 6.0,
        semanticSimilarity: result.signals.semantic?.detected || false,
        multiplePatterns: extendedViolations.length > 1,
        modelSpecificBehavior: result.signals.modelSpecific?.detected || false,
      };

      const bayesianResult = this.bayesianScorer.calculateRisk(bayesianSignals);
      result.signals.bayesian = bayesianResult;

      result.reasoning.push(
        `Bayesian risk assessment: ${(bayesianResult.probability * 100).toFixed(1)}% (${bayesianResult.riskLevel})`
      );
    }

    // Context-aware threshold adjustment
    if (this.contextAwareness) {
      this._adjustThresholds(userId, riskProfile, result);
    }

    // User history analysis
    if (this.userHistoryTracking && userId) {
      this._analyzeUserHistory(userId, result);
    }

    // Final decision logic
    result.isValid = this._makeDecision(result, riskProfile);
    result.riskLevel = this._classifyRiskLevel(result);
    result.recommendation = this._generateRecommendation(result);

    result.latency = Date.now() - startTime;

    return result;
  }

  _checkExtendedPatterns(input) {
    // Check against extended pattern database
    const violations = [];

    for (const [patternCategory, patterns] of Object.entries(ExtendedInjectionPatterns)) {
      if (!Array.isArray(patterns)) continue;

      for (const pattern of patterns) {
        if (typeof pattern === 'string' && input.includes(pattern)) {
          violations.push(patternCategory);
          break;
        } else if (pattern instanceof RegExp && pattern.test(input)) {
          violations.push(patternCategory);
          break;
        }
      }
    }

    return violations;
  }

  _adjustThresholds(userId, riskProfile, result) {
    // Adjust decision thresholds based on context
    if (riskProfile === 'strict') {
      this.thresholds.semantic *= 0.9;
      this.thresholds.bayesian *= 0.95;
    } else if (riskProfile === 'permissive') {
      this.thresholds.semantic *= 1.1;
      this.thresholds.bayesian *= 1.05;
    }

    // User-specific adjustment: if user has history of attacks
    if (this.userHistory.has(userId)) {
      const userRecord = this.userHistory.get(userId);
      if (userRecord.violations > 5) {
        // Repeat offender - lower threshold
        this.thresholds.bayesian *= 0.85;
      }
    }
  }

  _analyzeUserHistory(userId, result) {
    // Track user patterns for anomaly detection
    if (!this.userHistory.has(userId)) {
      this.userHistory.set(userId, {
        violations: 0,
        patterns: [],
        riskProfile: 'normal',
        lastSeen: new Date(),
      });
    }

    const userRecord = this.userHistory.get(userId);

    // Update history
    if (!result.isValid || result.signals.semantic?.detected) {
      userRecord.violations++;
      userRecord.patterns.push(...result.signals.extended?.violations || []);
    }

    userRecord.lastSeen = new Date();

    // Maintain size limit
    if (this.userHistory.size > this.maxHistorySize) {
      const oldestUser = [...this.userHistory.entries()]
        .sort((a, b) => a[1].lastSeen - b[1].lastSeen)[0];
      this.userHistory.delete(oldestUser[0]);
    }
  }

  _makeDecision(result, riskProfile) {
    // Combine all signals for final validation decision
    const bayesianRisk = result.signals.bayesian?.probability || 0;
    const threshold = riskProfile === 'strict' ? 0.5 : 0.7;
    const structuralIsValid = result.signals.structural.isValid;

    // Hard reject if structural violations + other signals
    if (!structuralIsValid) {
      if (
        result.signals.semantic?.detected ||
        result.signals.modelSpecific?.detected ||
        result.signals.extended?.count > 0
      ) {
        return false; // High confidence rejection
      }

      // Soft reject based on Bayesian score
      return bayesianRisk < threshold;
    }

    // For clean structural input, check other signals
    if (result.signals.semantic?.detected && result.signals.semantic.similarity > 0.75) {
      return false;
    }

    if (result.signals.modelSpecific?.detected && result.signals.modelSpecific.confidence > 0.8) {
      return false;
    }

    // Multi-pattern detection = automatic rejection
    if (result.signals.extended?.count > 2) {
      return false;
    }

    // Bayesian final verdict
    return bayesianRisk < threshold;
  }

  _classifyRiskLevel(result) {
    const bayesianRisk = result.signals.bayesian?.probability || 0;
    const structuralIsValid = result.signals.structural.isValid;

    if (bayesianRisk >= 0.9 || !structuralIsValid) {
      return 'critical';
    } else if (bayesianRisk >= 0.7 || result.signals.semantic?.detected) {
      return 'high';
    } else if (bayesianRisk >= 0.4 || result.signals.extended?.count > 0) {
      return 'medium';
    } else if (bayesianRisk >= 0.1) {
      return 'low';
    }

    return 'minimal';
  }

  _generateRecommendation(result) {
    if (!result.isValid) {
      if (result.riskLevel === 'critical') {
        return 'block_immediately';
      } else if (result.riskLevel === 'high') {
        return 'block_with_review';
      }
      return 'sanitize_and_continue';
    }

    if (result.riskLevel === 'medium') {
      return 'log_and_monitor';
    }

    return 'accept';
  }

  getUserRiskProfile(userId) {
    // Get risk profile for a user based on history
    if (!this.userHistory.has(userId)) {
      return 'normal';
    }

    const userRecord = this.userHistory.get(userId);

    if (userRecord.violations > 10) return 'high_risk';
    if (userRecord.violations > 5) return 'elevated_risk';
    if (userRecord.violations > 0) return 'flagged';

    return 'normal';
  }

  clearUserHistory(userId = null) {
    if (userId) {
      this.userHistory.delete(userId);
    } else {
      this.userHistory.clear();
    }
  }

  getStatistics() {
    // Return validation statistics
    const totalUsers = this.userHistory.size;
    const totalViolations = Array.from(this.userHistory.values()).reduce(
      (sum, record) => sum + record.violations,
      0
    );

    return {
      totalUsers,
      totalViolations,
      averageViolationsPerUser: totalUsers > 0 ? totalViolations / totalUsers : 0,
      userProfiles: Object.fromEntries(
        Array.from(this.userHistory.entries()).map(([userId, record]) => [
          userId,
          {
            violations: record.violations,
            riskProfile: this.getUserRiskProfile(userId),
            patternCount: record.patterns.length,
          },
        ])
      ),
    };
  }
}

// Export factory functions for quick setup
export function createAdaptiveValidator(preset = 'balanced') {
  const configs = {
    strict: {
      sanitizer: { strictMode: true, entropyValidator: true },
      embedding: { threshold: 0.6 },
      bayesian: { priorProbability: 0.05 },
      structuralThreshold: 0.7,
      semanticThreshold: 0.6,
    },
    balanced: {
      sanitizer: { strictMode: true },
      embedding: { threshold: 0.65 },
      bayesian: { priorProbability: 0.01 },
      structuralThreshold: 0.8,
      semanticThreshold: 0.65,
    },
    permissive: {
      sanitizer: { strictMode: false },
      embedding: { threshold: 0.75 },
      bayesian: { priorProbability: 0.005 },
      structuralThreshold: 0.9,
      semanticThreshold: 0.75,
    },
  };

  return new AdaptiveValidator(configs[preset] || configs.balanced);
}
