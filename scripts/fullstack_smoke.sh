#!/usr/bin/env bash
set -euo pipefail

API_BASE="${API_BASE:-http://localhost:8000/api/v1}"
TENANT_NAME="Smoke Tenant"
TENANT_SLUG="smoke-tenant"
USER_EMAIL="smoke@example.com"
USER_PASS="password-1234"

echo "[1/5] Register"
REGISTER_JSON=$(curl -sS -X POST "$API_BASE/auth/register" \
  -H "Content-Type: application/json" \
  -d "{\"name\":\"Smoke User\",\"email\":\"$USER_EMAIL\",\"password\":\"$USER_PASS\",\"tenant_name\":\"$TENANT_NAME\",\"tenant_slug\":\"$TENANT_SLUG\"}")
TOKEN=$(echo "$REGISTER_JSON" | php -r '$d=json_decode(stream_get_contents(STDIN),true); echo $d["token"] ?? "";')
TENANT_ID=$(echo "$REGISTER_JSON" | php -r '$d=json_decode(stream_get_contents(STDIN),true); echo $d["tenant"]["id"] ?? "";')

if [[ -z "$TOKEN" || -z "$TENANT_ID" ]]; then
  echo "Register failed: $REGISTER_JSON"
  exit 1
fi

echo "[2/5] Me"
curl -sS "$API_BASE/auth/me" -H "Authorization: Bearer $TOKEN" -H "X-Tenant-Id: $TENANT_ID" >/dev/null

echo "[3/5] Review queue"
curl -sS "$API_BASE/review-queue" -H "Authorization: Bearer $TOKEN" -H "X-Tenant-Id: $TENANT_ID" >/dev/null

echo "[4/5] Worker metrics"
curl -sS "$API_BASE/worker-tasks/metrics" -H "Authorization: Bearer $TOKEN" -H "X-Tenant-Id: $TENANT_ID" >/dev/null

echo "[5/5] Analytics"
curl -sS "$API_BASE/analytics/overview" -H "Authorization: Bearer $TOKEN" -H "X-Tenant-Id: $TENANT_ID" >/dev/null

echo "Smoke run completed."
