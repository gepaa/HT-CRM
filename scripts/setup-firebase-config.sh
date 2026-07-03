#!/usr/bin/env bash
# ============================================================
# HT CRM — Firebase Production Config & Secrets Setup
# ============================================================
# Run this script ONCE after deploying to configure server-side
# secrets for Cloud Functions. These are NOT bundled into the
# frontend — they live in Firebase Functions environment config
# or Google Secret Manager (recommended for v2 functions).
#
# Prerequisites:
#   - Firebase CLI installed: npm install -g firebase-tools
#   - Logged in: firebase login
#   - Project set: firebase use YOUR_PROJECT_ID
#
# Usage:
#   chmod +x scripts/setup-firebase-config.sh
#   ./scripts/setup-firebase-config.sh
# ============================================================

set -euo pipefail

# ── Color helpers ──────────────────────────────────────────────
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m'

info()    { echo -e "${CYAN}[INFO]${NC} $1"; }
success() { echo -e "${GREEN}[OK]${NC}   $1"; }
warn()    { echo -e "${YELLOW}[WARN]${NC} $1"; }
error()   { echo -e "${RED}[ERROR]${NC} $1"; exit 1; }

# ── Verify Firebase CLI is available ──────────────────────────
if ! command -v firebase &> /dev/null; then
  error "Firebase CLI not found. Install: npm install -g firebase-tools"
fi

PROJECT_ID=$(firebase use 2>/dev/null | grep -oP '(?<=Now using project )\S+' || echo "")
if [[ -z "$PROJECT_ID" ]]; then
  error "No Firebase project selected. Run: firebase use YOUR_PROJECT_ID"
fi

info "Configuring Firebase project: ${GREEN}${PROJECT_ID}${NC}"
echo ""

# ══════════════════════════════════════════════════════════════
# SECTION 1: CORS — Lead Capture Allowed Origins
# ══════════════════════════════════════════════════════════════
info "Setting CORS allowed origins for lead capture..."

# Space-separated list of origins that may POST to /api/leads/create
# Include your Shopify domain and Firebase Hosting domain
SHOPIFY_DOMAIN="${SHOPIFY_DOMAIN:-https://your-store.myshopify.com}"
HOSTING_DOMAIN="${HOSTING_DOMAIN:-https://${PROJECT_ID}.web.app}"
CUSTOM_DOMAIN="${CUSTOM_DOMAIN:-}"  # e.g. https://crm.yourdomain.com

ALLOWED_ORIGINS="${SHOPIFY_DOMAIN},${HOSTING_DOMAIN}"
if [[ -n "$CUSTOM_DOMAIN" ]]; then
  ALLOWED_ORIGINS="${ALLOWED_ORIGINS},${CUSTOM_DOMAIN}"
fi

firebase functions:config:set \
  lead_capture.allowed_origins="${ALLOWED_ORIGINS}" \
  --project "${PROJECT_ID}"

success "CORS origins set: ${ALLOWED_ORIGINS}"

# ══════════════════════════════════════════════════════════════
# SECTION 2: Shopify Integration Secrets
# ══════════════════════════════════════════════════════════════
info "Setting Shopify webhook secret..."

if [[ -z "${SHOPIFY_WEBHOOK_SECRET:-}" ]]; then
  warn "SHOPIFY_WEBHOOK_SECRET env var not set — skipping. Set it and re-run."
else
  firebase functions:config:set \
    shopify.webhook_secret="${SHOPIFY_WEBHOOK_SECRET}" \
    --project "${PROJECT_ID}"
  success "Shopify webhook secret configured."
fi

# ══════════════════════════════════════════════════════════════
# SECTION 3: Optional Integration Secrets
# (SendGrid, Twilio, OpenAI)
# ══════════════════════════════════════════════════════════════
info "Setting optional integration secrets (skip if not using)..."

if [[ -n "${SENDGRID_API_KEY:-}" ]]; then
  firebase functions:config:set sendgrid.api_key="${SENDGRID_API_KEY}" --project "${PROJECT_ID}"
  success "SendGrid API key configured."
fi

if [[ -n "${TWILIO_ACCOUNT_SID:-}" && -n "${TWILIO_AUTH_TOKEN:-}" ]]; then
  firebase functions:config:set \
    twilio.account_sid="${TWILIO_ACCOUNT_SID}" \
    twilio.auth_token="${TWILIO_AUTH_TOKEN}" \
    twilio.phone_number="${TWILIO_PHONE_NUMBER:-}" \
    --project "${PROJECT_ID}"
  success "Twilio credentials configured."
fi

if [[ -n "${OPENAI_API_KEY:-}" ]]; then
  firebase functions:config:set openai.api_key="${OPENAI_API_KEY}" --project "${PROJECT_ID}"
  success "OpenAI API key configured."
fi

# ══════════════════════════════════════════════════════════════
# SECTION 4: SLA & Business Logic Config
# ══════════════════════════════════════════════════════════════
info "Setting SLA and business logic configuration..."

firebase functions:config:set \
  app.timezone="America/New_York" \
  app.sla_hot_minutes="15" \
  app.sla_warm_minutes="60" \
  app.sla_cold_hours="24" \
  --project "${PROJECT_ID}"

success "SLA configuration set."

# ══════════════════════════════════════════════════════════════
# SECTION 5: Verify configuration was saved
# ══════════════════════════════════════════════════════════════
echo ""
info "Verifying saved configuration..."
firebase functions:config:get --project "${PROJECT_ID}"

# ══════════════════════════════════════════════════════════════
# SECTION 6: Google Secret Manager migration note
# ══════════════════════════════════════════════════════════════
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
warn "NOTE: functions:config:set is deprecated for Firebase Functions v2."
warn "For v2 (2nd gen) functions, migrate secrets to Google Secret Manager:"
echo ""
echo "  # Create a secret:"
echo "  echo -n 'YOUR_SECRET_VALUE' | gcloud secrets create SHOPIFY_WEBHOOK_SECRET \\"
echo "    --data-file=- --project=${PROJECT_ID}"
echo ""
echo "  # Grant Cloud Functions access:"
echo "  gcloud secrets add-iam-policy-binding SHOPIFY_WEBHOOK_SECRET \\"
echo "    --member='serviceAccount:${PROJECT_ID}@appspot.gserviceaccount.com' \\"
echo "    --role='roles/secretmanager.secretAccessor' \\"
echo "    --project=${PROJECT_ID}"
echo ""
echo "  # Reference in function code (v2):"
echo "  import { defineSecret } from 'firebase-functions/params';"
echo "  const shopifySecret = defineSecret('SHOPIFY_WEBHOOK_SECRET');"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
success "Firebase config setup complete for project: ${PROJECT_ID}"
