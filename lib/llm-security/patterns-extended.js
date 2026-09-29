// Extended pattern database for emerging prompt injection threats (Phase 2)
// Covers 5 emerging threat categories not fully addressed by Phase 1

export const ExtendedInjectionPatterns = {
  // Indirect Injections via URLs and embedded content
  indirectInjection: [
    // Markdown link injections
    /\[.*?\]\(.*?(?:ignore|bypass|jailbreak|prompt).*?\)/gi,
    // HTML comment injections
    /<!--.*?(?:ignore|bypass|override).*?-->/gi,
    // YAML metadata injections
    /^(?:system|instructions|rules):\s*(?:ignore|bypass|override)/gmi,
    // JSON schema injections in properties
    /"(?:instruction|rule|system)":\s*"(?:ignore|bypass|override)/gi,
  ],

  // Semantic jailbreaks via paraphrasing and obfuscation
  semanticJailbreaks: [
    // Soft directives disguised as questions
    /what\s+(?:if|would|should).*?(?:you\s+)?(?:ignore|bypass|not\s+follow)/gi,
    // Hypothetical framing
    /(?:imagine|assume|suppose|pretend).*?(?:you|the\s+system).*?(?:doesn't?|can't)\s+(?:have|follow|enforce)/gi,
    // Delegation attacks ("tell me how you would")
    /tell\s+(?:me|us)\s+(?:how|what|the\s+way).*?(?:bypass|ignore|overcome|circumvent)/gi,
    // Role hypothesis attacks
    /if\s+(?:you\s+were|one\s+were).*?(?:evil|malicious|unrestricted|unchained)/gi,
    // Reward hacking
    /(?:forget|discard|ignore)\s+(?:your\s+)?(?:constraint|rule|instruction|guideline).*?(?:and\s+)?(?:reward|thank|appreciate)/gi,
  ],

  // Model-specific exploit patterns (Claude behaviors)
  claudeSpecificPatterns: [
    // Claude reasoning escape
    /(?:i'll\s+)?(?:think|reason|analyze)\s+(?:step\s+)?by\s+step.*?(?:ignore|bypass|override)/gi,
    // Claude preference manipulation
    /(?:actually|wait|on second thought).*?(?:i\s+should|let\s+me|i\s+can)/gi,
    // Claude helpfulness exploitation
    /(?:would\s+)?(?:be\s+)?(?:really|very|so)\s+(?:helpful|useful).*?if\s+you\s+(?:ignored|bypassed)/gi,
    // Claude jailbreak via instruction injection
    /let\s+me\s+(?:clarify|rephrase|reframe)\s+(?:that|the\s+request).*?as.*?(?:ignore|not\s+follow)/gi,
  ],

  // Model-specific exploit patterns (GPT-4 behaviors)
  gpt4SpecificPatterns: [
    // GPT-4 DAN variant detection
    /(?:do\s+)?anything\s+now/gi,
    // GPT-4 token smuggling via narrative
    /(?:story|scenario|narrative).*?(?:ignore|bypass|not\s+follow)/gi,
    // GPT-4 goal redefinition
    /your\s+(?:new\s+)?(?:goal|objective|purpose|task).*?(?:bypass|ignore)/gi,
  ],

  // Context window and caching attacks
  contextWindowAttacks: [
    // Prompt caching invalidation attempts
    /(?:clear|reset|flush|purge)\s+(?:cache|context|memory|history)/gi,
    // Token limit boundary exploitation
    /at\s+token\s+limit|approaching\s+limit|near\s+(?:context|token)\s+boundary/gi,
    // Context bleeding indicators
    /(?:previous|earlier|above|earlier in|from the|recall).*?(?:instruction|prompt|system)/gi,
    // Cache injection via repeated patterns
    /\b\w+\b(?:\s+\b\w+\b){0,3}\s*\1(?:\s+\1)+/g, // Detects word repetition patterns
  ],

  // API-level injections (function calling, tool use)
  apiLevelInjection: [
    // Function name manipulation
    /function.*?(?:ignore|bypass|override|execute_dangerous)/gi,
    // Tool parameter injection
    /(?:tool|function).*?(?:args|parameters|input).*?(?:ignore|bypass)/gi,
    // Structured output breakout attempts
    /(?:json|xml|markdown).*?escape|break\s+(?:out|free)/gi,
    // Vision/multimodal bypass attempts
    /(?:image|vision|multimodal).*?(?:ignore|bypass|show\s+hidden)/gi,
  ],

  // Nested and recursive injection patterns
  nestedInjectionPatterns: [
    // Nested instruction sets
    /\[(?:[^\[\]]+|\[(?:[^\[\]]+|\[[^\]]*\])*\])*\]/g,
    // Recursive role definitions
    /as\s+(?:a|an)\s+\w+\s+who\s+(?:is|acts\s+as).*?as\s+(?:a|an)\s+/gi,
    // Template literal nesting
    /\$\{.*?\$\{.*?\}\s*.*?\}/g,
  ],

  // Encoding evasion (extended)
  advancedEncodingEvasion: [
    // Unicode escape sequences
    /\\u[0-9a-f]{4}|\\U[0-9a-f]{8}/gi,
    // HTML entity encoding
    /&#(?:[0-9]+|x[0-9a-f]+);/gi,
    // Double encoding
    /%(?:25|3D|2B|2F)[\w%]*(?:%(?:25|3D|2B|2F)[\w%]*)*/gi,
    // Morse-like encoding indicators
    /(?:morse|binary|hex|encode|decode|cipher)/gi,
  ],

  // Semantic similarity to known jailbreaks
  jailbreakSignatures: [
    // "Grandma's Exploit" variant
    /(?:grandmother|old\s+woman|friend).*?(?:told|taught|showed).*?how\s+to/gi,
    // "Do Anything Now" variants
    /(?:do|can\s+you)\s+(?:anything|everything)(?:\s+now)?/gi,
    // "Custom instructions" manipulation
    /(?:custom|user-defined|personal).*?(?:instruction|rule|guideline)/gi,
    // "Believe you are" statements
    /(?:believe|think|assume|act\s+like)\s+you\s+(?:are|represent).*?(?:free|unlimited|unrestricted)/gi,
  ],

  // Compound and multi-vector attacks
  compoundAttackPatterns: [
    // Combines encoding + role-play
    /(?:base64|encoded|cipher).*?(?:ignore|bypass|pretend)/gi,
    // Combines hypothetical + direct request
    /(?:if|imagine).*?(?:you|it)\s+(?:were|is).*?(?:then\s+)?(?:ignore|bypass)/gi,
    // Combines privilege escalation + jailbreak
    /(?:admin|root|sudo).*?(?:mode|access|bypass)/gi,
  ],

  // Adversarial prompt templates detected via signature
  adversarialTemplates: [
    // Universal adversarial suffix pattern
    /(?:append|add|include)\s+(?:to\s+)?(?:every|all|each).*?(?:response|output|message)/gi,
    // Adversarial prefix pattern
    /(?:start|begin|prefix).*?(?:with|by)\s+/gi,
    // Token smuggling via invisible characters
    /​|‌|‍|‮|﻿/g, // Zero-width characters
  ],

  // Consistency and contradiction attacks
  consistencyAttacks: [
    // Self-contradiction for confusion
    /(?:true|false|yes|no)\s+and\s+(?:false|true|no|yes)/gi,
    // Contradiction injection
    /(?:is|was)\s+(?:both|not|neither).*?\s+and\s+(?:both|not|neither)/gi,
    // Logical paradox attempts
    /(?:this|the\s+statement).*?(?:paradox|contradiction|impossible)/gi,
  ],

  // Severity mapping for extended patterns
};

export const ExtendedSeverityMap = {
  indirectInjection: 'high',
  semanticJailbreaks: 'critical',
  claudeSpecificPatterns: 'critical',
  gpt4SpecificPatterns: 'critical',
  contextWindowAttacks: 'high',
  apiLevelInjection: 'high',
  nestedInjectionPatterns: 'high',
  advancedEncodingEvasion: 'medium',
  jailbreakSignatures: 'critical',
  compoundAttackPatterns: 'critical',
  adversarialTemplates: 'high',
  consistencyAttacks: 'medium',
};

// Coverage map: which detection method catches each pattern type
export const PatternCoverageMap = {
  indirectInjection: ['pattern_matching', 'semantic_analysis'],
  semanticJailbreaks: ['semantic_analysis', 'bayesian_scoring'],
  claudeSpecificPatterns: ['pattern_matching', 'model_profiling'],
  gpt4SpecificPatterns: ['pattern_matching', 'model_profiling'],
  contextWindowAttacks: ['statistical_analysis', 'contextual_detection'],
  apiLevelInjection: ['pattern_matching', 'api_validation'],
  nestedInjectionPatterns: ['pattern_matching', 'recursive_analysis'],
  advancedEncodingEvasion: ['statistical_analysis', 'entropy_detection'],
  jailbreakSignatures: ['embedding_similarity', 'pattern_matching'],
  compoundAttackPatterns: ['multi_signal_analysis', 'bayesian_scoring'],
  adversarialTemplates: ['pattern_matching', 'suffix_detection'],
  consistencyAttacks: ['semantic_analysis', 'logical_validation'],
};
