#!/bin/bash
set -euo pipefail

# PHASE-1-SETUP-VERIFICATION.sh
# Validates credentials and prerequisites for deployment setup

readonly SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
readonly RED='\033[0;31m'
readonly GREEN='\033[0;32m'
readonly YELLOW='\033[1;33m'
readonly NC='\033[0m' # No Color

# Counters
PASSED=0
FAILED=0

log_pass() {
    echo -e "${GREEN}✓${NC} $1"
    ((PASSED++))
}

log_fail() {
    echo -e "${RED}✗${NC} $1"
    ((FAILED++))
}

log_warn() {
    echo -e "${YELLOW}⚠${NC} $1"
}

log_info() {
    echo -e "${YELLOW}→${NC} $1"
}

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "PHASE-1 SETUP VERIFICATION"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# 1. Check Environment Variables
echo "1. Checking Credentials..."

if [[ -z "${CF_ACCOUNT_ID:-}" ]]; then
    log_fail "CF_ACCOUNT_ID not set"
else
    # Validate format (alphanumeric, 32 chars)
    if [[ ${#CF_ACCOUNT_ID} -eq 32 ]] && [[ "$CF_ACCOUNT_ID" =~ ^[a-f0-9]+$ ]]; then
        log_pass "CF_ACCOUNT_ID: $CF_ACCOUNT_ID"
    else
        log_fail "CF_ACCOUNT_ID format invalid (expected 32 hex chars): ${CF_ACCOUNT_ID:0:8}..."
    fi
fi

if [[ -z "${CF_API_TOKEN:-}" ]]; then
    log_fail "CF_API_TOKEN not set"
else
    # Validate format (Cloudflare tokens start with specific patterns)
    if [[ ${#CF_API_TOKEN} -gt 20 ]]; then
        log_pass "CF_API_TOKEN: ${CF_API_TOKEN:0:8}...${CF_API_TOKEN: -4}"
    else
        log_fail "CF_API_TOKEN too short: ${#CF_API_TOKEN} chars (expected 20+)"
    fi
fi

if [[ -z "${ANTHROPIC_API_KEY:-}" ]]; then
    log_fail "ANTHROPIC_API_KEY not set"
else
    # Validate format (typically sk-ant-... for Anthropic)
    if [[ ${#ANTHROPIC_API_KEY} -gt 20 ]]; then
        log_pass "ANTHROPIC_API_KEY: ${ANTHROPIC_API_KEY:0:10}...${ANTHROPIC_API_KEY: -4}"
    else
        log_fail "ANTHROPIC_API_KEY too short: ${#ANTHROPIC_API_KEY} chars (expected 20+)"
    fi
fi

echo ""
echo "2. Checking System Prerequisites..."

# Check required commands
for cmd in curl jq git; do
    if command -v "$cmd" &> /dev/null; then
        log_pass "$cmd available"
    else
        log_fail "$cmd not found"
    fi
done

echo ""
echo "3. Checking Git Status..."

cd "$SCRIPT_DIR"
if git rev-parse --is-inside-work-tree > /dev/null 2>&1; then
    log_pass "Git repository detected"
    BRANCH=$(git rev-parse --abbrev-ref HEAD)
    log_info "Current branch: $BRANCH"

    if [[ "$BRANCH" == "claude/credentials-deployment-setup-09112i" ]]; then
        log_pass "Correct deployment branch active"
    else
        log_warn "Expected branch 'claude/credentials-deployment-setup-09112i', got '$BRANCH'"
    fi
else
    log_fail "Not a git repository"
fi

echo ""
echo "4. Network Connectivity..."

if command -v curl &> /dev/null; then
    # Test Cloudflare API connectivity (dry-run, no auth)
    if curl -s -o /dev/null -w "%{http_code}" https://api.cloudflare.com/client/v4/zones 2>/dev/null | grep -q "^[34]"; then
        log_pass "Cloudflare API endpoint reachable"
    else
        log_fail "Cannot reach Cloudflare API"
    fi

    # Test Anthropic API connectivity
    if curl -s -o /dev/null -w "%{http_code}" https://api.anthropic.com/v1/messages 2>/dev/null | grep -q "^401"; then
        log_pass "Anthropic API endpoint reachable"
    else
        log_fail "Cannot reach Anthropic API"
    fi
else
    log_warn "curl not available, skipping connectivity checks"
fi

echo ""
echo "5. Optional: Credential Validation Against APIs..."

if [[ -n "${CF_ACCOUNT_ID:-}" ]] && [[ -n "${CF_API_TOKEN:-}" ]]; then
    if curl -s -H "Authorization: Bearer $CF_API_TOKEN" \
            https://api.cloudflare.com/client/v4/accounts/"$CF_ACCOUNT_ID" 2>/dev/null | jq -e '.success' > /dev/null 2>&1; then
        log_pass "Cloudflare credentials validated"
    else
        log_fail "Cloudflare credentials invalid or API call failed"
    fi
else
    log_warn "Skipping Cloudflare validation (credentials not set)"
fi

if [[ -n "${ANTHROPIC_API_KEY:-}" ]]; then
    # Quick validation: make a minimal request
    RESPONSE=$(curl -s -X POST https://api.anthropic.com/v1/messages \
        -H "x-api-key: $ANTHROPIC_API_KEY" \
        -H "anthropic-version: 2023-06-01" \
        -H "content-type: application/json" \
        -d '{"model":"claude-3-5-haiku-20241022","max_tokens":10,"messages":[{"role":"user","content":"test"}]}' 2>/dev/null)

    if echo "$RESPONSE" | jq -e '.id' > /dev/null 2>&1; then
        log_pass "Anthropic API key validated"
    elif echo "$RESPONSE" | jq -e '.error.type' > /dev/null 2>&1; then
        ERROR=$(echo "$RESPONSE" | jq -r '.error.type // "unknown"')
        if [[ "$ERROR" == "authentication_error" ]]; then
            log_fail "Anthropic API key invalid: $ERROR"
        else
            log_warn "Anthropic validation returned error: $ERROR (may be transient)"
        fi
    else
        log_warn "Anthropic validation response unclear"
    fi
else
    log_warn "Skipping Anthropic validation (key not set)"
fi

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "VERIFICATION SUMMARY"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo -e "${GREEN}Passed: $PASSED${NC} | ${RED}Failed: $FAILED${NC}"
echo ""

if [[ $FAILED -eq 0 ]]; then
    echo -e "${GREEN}✓ All checks passed. Ready for Phase 1 deployment.${NC}"
    echo ""
    echo "Next: bash deploy-setup.sh \$CF_ACCOUNT_ID \$CF_API_TOKEN \$ANTHROPIC_API_KEY"
    exit 0
else
    echo -e "${RED}✗ $FAILED check(s) failed. Fix issues before proceeding.${NC}"
    exit 1
fi
