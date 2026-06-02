#!/usr/bin/env bash
#
# One-shot deploy of the weather dashboard to Cloud Run.
# Run this from your own machine or Cloud Shell where `gcloud` is authenticated.
#
#   chmod +x deploy/deploy.sh
#   PROJECT_ID=my-proj ./deploy/deploy.sh
#
# Re-run any time to ship a new revision. The first run will prompt for your
# Google Pollen API key and store it in Secret Manager.
set -euo pipefail

# ---- Config (override via env vars) ----
PROJECT_ID="${PROJECT_ID:-$(gcloud config get-value project 2>/dev/null || true)}"
REGION="${REGION:-us-central1}"
SERVICE="${SERVICE:-weather-dashboard}"
SECRET_NAME="${SECRET_NAME:-pollen-api-key}"
# After the first deploy, set this to the service URL (and any custom domain) to
# lock the pollen proxy to your site, e.g.
#   ALLOWED_ORIGINS="https://weather-dashboard-xxxxx-uc.a.run.app"
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
  pollen.googleapis.com \
  --project "${PROJECT_ID}"

# ---- Create the Pollen API key secret if it doesn't exist ----
if ! gcloud secrets describe "${SECRET_NAME}" --project "${PROJECT_ID}" >/dev/null 2>&1; then
  echo ">> Secret '${SECRET_NAME}' not found. Paste your Google Pollen API key below, then press Ctrl-D:"
  gcloud secrets create "${SECRET_NAME}" \
    --replication-policy="automatic" \
    --data-file=- \
    --project "${PROJECT_ID}"
else
  echo ">> Secret '${SECRET_NAME}' already exists (rotate with: gcloud secrets versions add ${SECRET_NAME} --data-file=- )."
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
echo
echo ">> Deployed: ${URL}"
if [[ -z "${ALLOWED_ORIGINS}" ]]; then
  echo ">> NOTE: pollen proxy is currently open. Re-run with ALLOWED_ORIGINS=\"${URL}\" to lock it to your site."
fi
