#!/usr/bin/env bash
#
# One-shot deploy of the weather dashboard to Cloud Run.
# Run this from Google Cloud Shell (or any machine where `gcloud` is logged in).
#
#   chmod +x deploy/deploy.sh
#   PROJECT_ID=my-proj ./deploy/deploy.sh
#
# On the first run it will (unless you already have the secret):
#   - create a Pollen-restricted Google API key for you, and
#   - store it in Secret Manager,
# then deploy and lock the pollen proxy to the new service URL.
#
# To supply your own key instead of auto-creating one:
#   PROJECT_ID=my-proj POLLEN_API_KEY=AIza... ./deploy/deploy.sh
#
# Requires: a project with billing enabled, and Owner/Editor (to create keys).
set -euo pipefail

# ---- Config (override via env vars) ----
PROJECT_ID="${PROJECT_ID:-$(gcloud config get-value project 2>/dev/null || true)}"
REGION="${REGION:-us-central1}"
SERVICE="${SERVICE:-weather-dashboard}"
SECRET_NAME="${SECRET_NAME:-pollen-api-key}"
KEY_DISPLAY_NAME="${KEY_DISPLAY_NAME:-weather-dashboard-pollen}"
# Origins allowed to call /api/pollen. If left empty, we auto-lock to the
# deployed service URL after the first deploy. Set it explicitly to allow more
# (e.g. a custom domain): ALLOWED_ORIGINS="https://a.run.app,https://weather.example.com"
ALLOWED_ORIGINS="${ALLOWED_ORIGINS:-}"

if [[ -z "${PROJECT_ID}" ]]; then
  echo "ERROR: set PROJECT_ID (env var) or run 'gcloud config set project <id>'." >&2
  exit 1
fi

echo ">> Project: ${PROJECT_ID}   Region: ${REGION}   Service: ${SERVICE}"

# ---- Enable required APIs (idempotent) ----
echo ">> Enabling APIs..."
gcloud services enable \
  run.googleapis.com \
  cloudbuild.googleapis.com \
  secretmanager.googleapis.com \
  apikeys.googleapis.com \
  pollen.googleapis.com \
  --project "${PROJECT_ID}"

# Create a Pollen-restricted API key and print ONLY the key string on stdout.
create_pollen_key() {
  local key uid
  key="$(gcloud services api-keys create \
      --display-name="${KEY_DISPLAY_NAME}" \
      --api-target=service=pollen.googleapis.com \
      --project="${PROJECT_ID}" \
      --format="value(keyString)" 2>/dev/null || true)"
  if [[ -n "${key}" ]]; then
    printf '%s' "${key}"
    return 0
  fi
  # Fallback: fetch the string of the key we just created.
  uid="$(gcloud services api-keys list \
      --project="${PROJECT_ID}" \
      --filter="displayName=${KEY_DISPLAY_NAME}" \
      --format="value(uid)" 2>/dev/null | head -1 || true)"
  if [[ -n "${uid}" ]]; then
    gcloud services api-keys get-key-string "${uid}" \
      --project="${PROJECT_ID}" --format="value(keyString)" 2>/dev/null || true
  fi
}

# ---- Ensure the Pollen API key secret exists ----
if gcloud secrets describe "${SECRET_NAME}" --project "${PROJECT_ID}" >/dev/null 2>&1; then
  echo ">> Secret '${SECRET_NAME}' already exists (rotate with: gcloud secrets versions add ${SECRET_NAME} --data-file=-)."
else
  KEY_VALUE="${POLLEN_API_KEY:-}"
  if [[ -z "${KEY_VALUE}" ]]; then
    echo ">> Creating a Pollen-restricted API key via gcloud..."
    KEY_VALUE="$(create_pollen_key || true)"
  fi

  if [[ -n "${KEY_VALUE}" ]]; then
    printf '%s' "${KEY_VALUE}" | gcloud secrets create "${SECRET_NAME}" \
      --replication-policy="automatic" --data-file=- --project "${PROJECT_ID}"
    echo ">> Stored API key in Secret Manager secret '${SECRET_NAME}'."
  else
    echo ">> Could not auto-create a key. Paste your Google Pollen API key, then press Ctrl-D:"
    gcloud secrets create "${SECRET_NAME}" \
      --replication-policy="automatic" --data-file=- --project "${PROJECT_ID}"
  fi
fi

# ---- Let the Cloud Run runtime service account read the secret ----
PROJECT_NUMBER="$(gcloud projects describe "${PROJECT_ID}" --format='value(projectNumber)')"
RUNTIME_SA="${PROJECT_NUMBER}-compute@developer.gserviceaccount.com"
echo ">> Granting secretAccessor to ${RUNTIME_SA}..."
gcloud secrets add-iam-policy-binding "${SECRET_NAME}" \
  --member="serviceAccount:${RUNTIME_SA}" \
  --role="roles/secretmanager.secretAccessor" \
  --project "${PROJECT_ID}" >/dev/null

# ---- Deploy (Cloud Build builds the Dockerfile from source) ----
echo ">> Deploying to Cloud Run..."
gcloud run deploy "${SERVICE}" \
  --source . \
  --region "${REGION}" \
  --platform managed \
  --allow-unauthenticated \
  --set-secrets "POLLEN_API_KEY=${SECRET_NAME}:latest" \
  ${ALLOWED_ORIGINS:+--set-env-vars "ALLOWED_ORIGINS=${ALLOWED_ORIGINS}"} \
  --project "${PROJECT_ID}"

URL="$(gcloud run services describe "${SERVICE}" --region "${REGION}" --project "${PROJECT_ID}" --format='value(status.url)')"

# ---- Lock the pollen proxy to this site by default ----
if [[ -z "${ALLOWED_ORIGINS}" ]]; then
  echo ">> Locking pollen proxy to ${URL} ..."
  gcloud run services update "${SERVICE}" \
    --region "${REGION}" --project "${PROJECT_ID}" \
    --update-env-vars "ALLOWED_ORIGINS=${URL}" >/dev/null
  echo ">> To also allow a custom domain later, re-run with ALLOWED_ORIGINS=\"${URL},https://your-domain\"."
fi

echo
echo ">> Deployed: ${URL}"
