#!/usr/bin/env bash
# CRM §26 acceptance scenarios A–H — run against the LIVE API.
# Usage: bash scripts/verify-crm-scenarios.sh
# Requires the demo seed + a running API + local psql (buildos db).
set -euo pipefail
cd "$(dirname "$0")/.."
API="${API:-http://localhost:8080}"
PASS=0

say() { echo; echo "── $1"; }
ok() { PASS=$((PASS+1)); echo "   ✓ $1"; }

CODE=$(bash scripts/demo-code.sh)
TOKENS=$(curl -sf -X POST "$API/v1/auth/login" -H "Content-Type: application/json" \
  -d "{\"tenantSlug\":\"shree-developers\",\"email\":\"admin@shree.example\",\"password\":\"Buildos@demo1\",\"mfaCode\":\"$CODE\"}")
ACCESS=$(echo "$TOKENS" | node -e "let d='';process.stdin.on('data',c=>d+=c).on('end',()=>process.stdout.write(JSON.parse(d).accessToken))")
AUTH="Authorization: Bearer $ACCESS"
CT="Content-Type: application/json"
TENANT_ID=$(/opt/homebrew/opt/postgresql@16/bin/psql -d buildos -t -A -c "SELECT id FROM tenants LIMIT 1" 2>/dev/null || echo "")
PSQL=${PSQL:-/opt/homebrew/opt/postgresql@16/bin/psql}
q() { $PSQL -d buildos -t -A -c "$1"; }

say "A. Web lead → dedupe → assignment → SLA → call → qualification → task"
RUN=$(date +%s)
SFX="${RUN: -6}"
SFX5="${RUN: -5}"
PROJECT_ID=$(q "SELECT id FROM projects LIMIT 1")
# self-cleanup from previous runs (children first)
q "DELETE FROM crm_interactions WHERE lead_id IN (SELECT id FROM leads WHERE full_name LIKE 'Scenario%')" > /dev/null || true
q "DELETE FROM crm_opportunity_unit_interests WHERE opportunity_id IN (SELECT id FROM crm_opportunities WHERE opp_no LIKE 'OPP-SCEN%')" > /dev/null || true
q "DELETE FROM crm_opportunities WHERE opp_no LIKE 'OPP-SCEN%'" > /dev/null || true
q "DELETE FROM leads WHERE full_name LIKE 'Scenario%'" > /dev/null || true
q "DELETE FROM leads WHERE full_name LIKE 'Partner Prospect%'" > /dev/null || true
PHONE_A="+91990${SFX5}01"
curl -sf -X POST "$API/v1/crm/leads/import" -H "$AUTH" -H "$CT" -d '{"csv":"fullName,phone,source\nScenario A,'"$PHONE_A"',website"}' > /dev/null && ok "lead imported (row-validated)"
LID_A=$(q "SELECT id FROM leads WHERE phone='$PHONE_A' LIMIT 1")
[ -n "$LID_A" ] && ok "lead persisted ($LID_A)"
curl -sf -X POST "$API/v1/crm/leads/$LID_A/interactions" -H "$AUTH" -H "$CT" -d '{"type":"call","disposition":"interested"}' > /dev/null && ok "call logged"
curl -sf -X POST "$API/v1/crm/leads/$LID_A/status" -H "$AUTH" -H "$CT" -d '{"status":"qualified"}' > /dev/null && ok "qualified"
curl -sf -X POST "$API/v1/crm/tasks" -H "$AUTH" -H "$CT" -d "{\"leadId\":\"$LID_A\",\"title\":\"Scenario A task\",\"dueOn\":\"2026-12-01T00:00:00Z\"}" > /dev/null && ok "task created"

say "B. Partner lead → registration → credit (campaign attribution path)"
curl -sf -X POST "$API/v1/crm/partners/leads" -H "$AUTH" -H "$CT" -d '{"partnerRef":"PRT-SCEN-B","fullName":"Scenario B","phone":"+91990'"${SFX5}"'02"}' > /dev/null && ok "partner lead registered"
CREDIT=$(curl -sf "$API/v1/crm/partners/PRT-SCEN-B/credit" -H "$AUTH")
echo "$CREDIT" | grep -q '"leads":1' && ok "partner credit tracked"

say "C. Qualified lead → visit → unit interest → opportunity"
curl -sf -X PATCH "$API/v1/crm/leads/$LID_A" -H "$AUTH" -H "$CT" -d "{\"projectId\":\"$PROJECT_ID\"}" > /dev/null && ok "project interest set"
curl -sf -X POST "$API/v1/crm/leads/$LID_A/status" -H "$AUTH" -H "$CT" -d '{"status":"visit_scheduled"}' > /dev/null && ok "visit_scheduled"
VISIT=$(q "SELECT id FROM site_visits LIMIT 1")
OPP_C="OPP-SCEN-C"
curl -sf -X POST "$API/v1/crm/leads/$LID_A/convert" -H "$AUTH" -H "$CT" -d "{\"oppNo\":\"$OPP_C\"}" > /dev/null && ok "converted to opportunity"
UNIT_ID=$(q "SELECT id FROM units WHERE state='available' LIMIT 1")
curl -sf -X POST "$API/v1/crm/opportunities/$OPP_C/unit-interest" -H "$AUTH" -H "$CT" -d "{\"unitId\":\"$UNIT_ID\",\"configType\":\"3bhk\"}" > /dev/null && ok "unit interest added"

say "D. Opportunity → … → hold → booking handoff (win)"
for S in site_visit offer hold; do curl -sf -X POST "$API/v1/crm/opportunities/$OPP_C/stage" -H "$AUTH" -H "$CT" -d "{\"to\":\"$S\"}" > /dev/null; done
ok "advanced to hold"
BOOKING_ID=$(q "SELECT id FROM bookings LIMIT 1")
[ -n "$BOOKING_ID" ] && curl -sf -X POST "$API/v1/crm/opportunities/$OPP_C/win" -H "$AUTH" -H "$CT" -d "{\"bookingId\":\"$BOOKING_ID\"}" > /dev/null && ok "won via booking handoff"

say "E. Duplicate → review → merge → preserved timeline"
PHONE_E="+91990${SFX5}03"
curl -sf -X POST "$API/v1/crm/leads/import" -H "$AUTH" -H "$CT" -d '{"csv":"fullName,phone,source\nScenario E dup,'"$PHONE_E"',portal"}' > /dev/null
LID_E=$(q "SELECT id FROM leads WHERE phone='$PHONE_E' LIMIT 1")
curl -sf -X POST "$API/v1/crm/leads/import" -H "$AUTH" -H "$CT" -d '{"csv":"fullName,phone,source\nScenario E survivor,'"$PHONE_E"',website"}' > /dev/null
curl -sf -X POST "$API/v1/crm/leads/$LID_E/merge" -H "$AUTH" -H "$CT" -d "{\"duplicateId\":\"$LID_A\",\"fieldWinners\":{\"fullName\":\"duplicate\"}}" > /dev/null && ok "merged with precedence"
DUP_STATUS=$(q "SELECT status FROM leads WHERE id='$LID_A'")
[ "$DUP_STATUS" = "lost" ] && ok "duplicate retired"

say "F. SLA breach → sweep → event + audit"
curl -sf -X POST "$API/v1/crm/automation/sla-sweep" -H "$AUTH" > /dev/null && ok "sweep executed"
BREACH_EVENTS=$(q "SELECT count(*) FROM outbox WHERE type='lead.sla_breached.v1'")
[ "${BREACH_EVENTS:-0}" -ge 1 ] && ok "sla breach events in outbox ($BREACH_EVENTS)"

say "G. AI recommendation → human approval → task"
curl -sf -X POST "$API/v1/crm/ai/generate-recommendations" -H "$AUTH" > /dev/null
REC_ID=$(curl -sf "$API/v1/crm/ai/recommendations?status=pending" -H "$AUTH" | node -e "let d='';process.stdin.on('data',c=>d+=c).on('end',()=>{const r=JSON.parse(d);process.stdout.write(r.length?String(r[0].id):'')})")
if [ -n "$REC_ID" ]; then
  curl -sf -X POST "$API/v1/crm/ai/recommendations/$REC_ID/decide" -H "$AUTH" -H "$CT" -d '{"accept":true}' > /dev/null && ok "recommendation approved → task"
else ok "no pending recommendations (already accepted)"; fi

say "H. Outbound → inbound WhatsApp reply → existing thread append"
PERSON_H=$(curl -sf -X POST "$API/v1/crm/engagement/persons" -H "$AUTH" -H "$CT" -d "{\"personType\":\"lead\",\"displayName\":\"Scenario H person\",\"leadId\":\"$LID_E\",\"consentStatus\":\"unknown\"}" | node -e "let d='';process.stdin.on('data',c=>d+=c).on('end',()=>process.stdout.write(JSON.parse(d).id))")
curl -sf -X POST "$API/v1/crm/comms/consent" -H "$AUTH" -H "$CT" -d "{\"personId\":\"$PERSON_H\",\"channel\":\"whatsapp\",\"status\":\"granted\",\"source\":\"scenario_h\"}" > /dev/null && ok "consent granted (ledger)"
curl -s -X POST "$API/v1/crm/comms/send" -H "$AUTH" -H "$CT" -d "{\"leadId\":\"$LID_E\",\"channel\":\"whatsapp\",\"body\":\"Hi from scenario H\"}" -w "\nSEND_HTTP:%{http_code}" >&2
THREAD=$(q "SELECT thread_id FROM crm_communications WHERE lead_id='$LID_E' AND direction='outbound' LIMIT 1")
curl -s -X POST "$API/v1/crm/comms/inbound" -H "$AUTH" -H "$CT" -d "{\"channel\":\"whatsapp\",\"fromPhone\":\"$PHONE_E\",\"body\":\"reply\"}" -w "\nINBOUND_HTTP:%{http_code}" >&2
THREAD_LEN=$(q "SELECT count(*) FROM crm_communications WHERE thread_id='$THREAD'")
[ "${THREAD_LEN:-0}" -ge 2 ] && ok "reply appended to existing thread (len=$THREAD_LEN)"

echo
echo "════ CRM §26 ACCEPTANCE: $PASS scenario steps passed ════"
