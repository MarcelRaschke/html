// ML-based detection modules for semantic and probabilistic jailbreak analysis (Phase 2)
// Provides advanced detection capabilities beyond pattern matching

import { ExtendedInjectionPatterns, ExtendedSeverityMap, PatternCoverageMap } from './patterns-extended.js';
import { InjectionPatterns, SeverityMap } from './patterns.js';

/**
 * EmbeddingAnomalyDetector: Detects semantic similarity to known jailbreak patterns
 * Uses simple cosine similarity via character n-gram vectors for inference
 * Avoids heavy ML dependencies while providing semantic detection
 */
export class EmbeddingAnomalyDetector {
  constructor(config = {}) {
    this.enabled = config.enabled !== false;
    this.threshold = config.threshold || 0.65; // Cosine similarity threshold
    this.ngramSize = config.ngramSize || 3;
    this.jailbreakSignatures = this._buildSignatures();
  }

  _buildSignatures() {
    // Pre-computed signatures for known jailbreak patterns
    return {
      danVariants: [
        'do anything now',
        'do anything mode',
        'bypass restrictions',
        'no restrictions',
        'unleashed mode',
      ],
      roleplayBreakouts: [
        'act as if you are',
        'pretend you are',
        'imagine you are',
        'you are now a',
        'assume you are',
      ],
      ignoreInstructions: [
        'ignore all previous',
        'disregard all prior',
        'forget your instructions',
        'override your rules',
        'bypass your safety',
        'ignore your rules',
      ],
    };
  }

  _ngramize(text, n = 3) {
    // Convert text to n-grams for similarity matching (word-level)
    const normalized = text.toLowerCase().replace(/[^\w\s]/g, '');
    const tokens = normalized.split(/\s+/).filter(t => t.length > 0);

    // Also generate character-level n-grams for better matching
    const ngrams = new Set();

    // Word n-grams
    for (let i = 0; i <= tokens.length - Math.min(n, tokens.length); i++) {
      ngrams.add(tokens.slice(i, i + n).join(' '));
    }

    // Character n-grams (bigrams) for short words
    const text_chars = normalized.replace(/\s+/g, '');
    for (let i = 0; i < text_chars.length - 1; i++) {
      ngrams.add(text_chars.substring(i, i + 2));
    }

    return ngrams;
  }

  _cosineSimilarity(set1, set2) {
    if (set1.size === 0 || set2.size === 0) return 0;

    const intersection = new Set([...set1].filter(x => set2.has(x)));

    // Use recall (intersection / smaller set) for better detection of paraphrased attacks
    // This prioritizes finding signature patterns in longer inputs
    const smallerSize = Math.min(set1.size, set2.size);
    const recallScore = intersection.size / smallerSize;

    return recallScore;
  }

  async detectSemanticJailbreak(input) {
    if (!this.enabled) {
      return { detected: false, score: 0, confidence: 0 };
    }

    const inputNgrams = this._ngramize(input, this.ngramSize);
    let maxSimilarity = 0;
    let matchedFamily = null;

    for (const [family, signatures] of Object.entries(this.jailbreakSignatures)) {
      for (const sig of signatures) {
        const sigNgrams = this._ngramize(sig, this.ngramSize);
        const similarity = this._cosineSimilarity(inputNgrams, sigNgrams);

        if (similarity > maxSimilarity) {
          maxSimilarity = similarity;
          matchedFamily = family;
        }
      }
    }

    return {
      detected: maxSimilarity >= this.threshold,
      score: maxSimilarity,
      confidence: Math.min(maxSimilarity * 1.5, 1.0), // Scale to confidence 0-1
      patternFamily: matchedFamily,
    };
  }

  async detectParaphrasedAttack(input, referenceAttack) {
    // Detect if input is a paraphrased version of a known attack
    // Use lower threshold for paraphrase detection since paraphrases have fewer n-gram overlaps
    const inputNgrams = this._ngramize(input, 2);
    const refNgrams = this._ngramize(referenceAttack, 2);
    const similarity = this._cosineSimilarity(inputNgrams, refNgrams);

    return {
      isParaphrase: similarity >= 0.3,
      similarity,
    };
  }
}

/**
 * BayesianRiskScorer: Combines multiple signals for probabilistic risk assessment
 * Uses Bayesian inference to weight evidence from different detectors
 */
export class BayesianRiskScorer {
  constructor(config = {}) {
    this.enabled = config.enabled !== false;
    // Prior probability of injection in general traffic
    this.priorProbability = config.priorProbability || 0.01;
    // Likelihood ratios for different signals
    this.likelihoodRatios = config.likelihoodRatios || {
      patternMatch: 50.0, // Strong evidence
      highEntropy: 8.0,
      semanticSimilarity: 25.0,
      multiplePatterns: 100.0,
      modelSpecificBehavior: 30.0,
    };
  }

  /**
   * Calculate posterior probability of injection given multiple signals
   * P(Injection | Signals) = P(Signals | Injection) * P(Injection) / P(Signals)
   */
  calculateRisk(signals) {
    if (!this.enabled) {
      return { overallRisk: 0, probability: 0, components: {} };
    }

    let posteriorOdds = this.priorProbability / (1 - this.priorProbability);
    const componentRisks = {};

    for (const [signalName, signalPresent] of Object.entries(signals)) {
      if (signalPresent && this.likelihoodRatios[signalName]) {
        posteriorOdds *= this.likelihoodRatios[signalName];
        componentRisks[signalName] = Math.min(
          this.likelihoodRatios[signalName] / 100,
          1.0
        );
      }
    }

    const posteriorProbability = posteriorOdds / (1 + posteriorOdds);

    return {
      overallRisk: posteriorProbability,
      probability: posteriorProbability,
      components: componentRisks,
      riskLevel: this._classifyRisk(posteriorProbability),
      reasoning: this._generateReasoning(signals, componentRisks),
    };
  }

  _classifyRisk(probability) {
    if (probability >= 0.9) return 'CRITICAL';
    if (probability >= 0.7) return 'HIGH';
    if (probability >= 0.4) return 'MEDIUM';
    if (probability >= 0.2) return 'LOW';
    return 'MINIMAL';
  }

  _generateReasoning(signals, risks) {
    const activeSignals = Object.entries(signals)
      .filter(([_, present]) => present)
      .map(([name, _]) => name)
      .join(', ');

    return `Risk assessment based on signals: ${activeSignals || 'none'}`;
  }
}

/**
 * MultiLLMProfiler: Model-specific exploit detection
 * Profiles attack patterns specific to different LLM implementations
 */
export class MultiLLMProfiler {
  constructor(config = {}) {
    this.enabled = config.enabled !== false;
    this.models = config.models || ['claude', 'gpt4', 'llama'];
    this.patterns = this._loadModelPatterns();
  }

  _loadModelPatterns() {
    return {
      claude: {
        vulnerabilities: [
          'reasoning_escape',
          'helpfulness_exploitation',
          'instruction_rephrasing',
        ],
        keywords: [
          "i'll think",
          'actually',
          'let me',
          'on second thought',
          'would be helpful',
        ],
        behavior: 'Tends to engage with chain-of-thought requests',
      },
      gpt4: {
        vulnerabilities: [
          'dan_variant',
          'token_smuggling',
          'goal_redefinition',
        ],
        keywords: [
          'do anything now',
          'unrestricted',
          'no restrictions',
          'new goal',
          'token limit',
        ],
        behavior: 'Susceptible to explicit permission requests',
      },
      llama: {
        vulnerabilities: [
          'uncensored_mode',
          'safety_bypass',
          'direct_instruction',
        ],
        keywords: [
          'uncensored',
          'unrestricted',
          'safety off',
          'ignore safety',
        ],
        behavior: 'Responds to direct safety disabling requests',
      },
    };
  }

  detectModelSpecificAttack(input, targetModel) {
    if (!this.enabled || !targetModel || !this.patterns[targetModel]) {
      return { detected: false, vulnerability: null, confidence: 0 };
    }

    const modelProfile = this.patterns[targetModel];
    const inputLower = input.toLowerCase();

    // Check for model-specific keywords - weighted scoring
    const matchedKeywords = [];
    let confidenceScore = 0;

    for (const kw of modelProfile.keywords) {
      if (inputLower.includes(kw)) {
        matchedKeywords.push(kw);
        // Weight longer/more specific keywords higher
        confidenceScore += Math.log(kw.length + 2) / Math.log(10);
      }
    }

    // Normalize confidence to 0-1 range
    const normalizedConfidence = Math.min(confidenceScore / modelProfile.keywords.length, 1.0);

    if (matchedKeywords.length > 0) {
      return {
        detected: true,
        vulnerabilities: modelProfile.vulnerabilities,
        matchedKeywords,
        confidence: Math.max(normalizedConfidence, 0.65), // At least 0.65 if detected
        recommendation: `Attack appears tailored for ${targetModel}`,
      };
    }

    return { detected: false, vulnerability: null, confidence: 0 };
  }

  getModelVulnerabilities(targetModel) {
    if (!this.patterns[targetModel]) {
      return [];
    }
    return this.patterns[targetModel].vulnerabilities;
  }

  profileInput(input) {
    // Analyze input against all model profiles
    const profiles = {};

    for (const model of this.models) {
      profiles[model] = this.detectModelSpecificAttack(input, model);
    }

    return profiles;
  }
}

// Export utility function for combined multi-signal detection
export function combineDetectionSignals(detectors, input) {
  const signals = {
    patternMatch: false,
    highEntropy: false,
    semanticSimilarity: false,
    multiplePatterns: false,
    modelSpecificBehavior: false,
  };

  // This would be populated by calling individual detectors
  // and combining their results

  return signals;
}
