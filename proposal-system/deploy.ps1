# ===========================================
# Proposal System - Google Cloud Deployment
# PowerShell script for Windows
# ===========================================

$ErrorActionPreference = "Stop"

# Configuration - EDIT THESE VALUES
$PROJECT_ID = "bemtech-478413"
$REGION = "me-west1"  # Israel region
$BACKEND_SERVICE = "proposal-backend"
$FRONTEND_SERVICE = "proposal-frontend"

Write-Host "=== Proposal System - Google Cloud Deployment ===" -ForegroundColor Green
Write-Host ""

# Step 1: Check if gcloud is installed
try {
    $null = Get-Command gcloud -ErrorAction Stop
} catch {
    Write-Host "Error: gcloud CLI is not installed" -ForegroundColor Red
    Write-Host "Please install it from: https://cloud.google.com/sdk/docs/install"
    exit 1
}

# Step 2: Set project
Write-Host "Setting project to $PROJECT_ID..." -ForegroundColor Yellow
gcloud config set project $PROJECT_ID

# Step 3: Enable required APIs
Write-Host "Enabling required APIs..." -ForegroundColor Yellow
gcloud services enable cloudbuild.googleapis.com
gcloud services enable run.googleapis.com
gcloud services enable containerregistry.googleapis.com
gcloud services enable secretmanager.googleapis.com

# Step 4: Create secrets instructions
Write-Host ""
Write-Host "=== Secret Manager Setup ===" -ForegroundColor Yellow
Write-Host "Please ensure you have created the following secrets in Google Secret Manager:"
Write-Host "  - SUPABASE_URL"
Write-Host "  - SUPABASE_ANON_KEY"
Write-Host "  - SUPABASE_SERVICE_KEY"
Write-Host ""
Write-Host "Create them in the Google Cloud Console or via CLI:"
Write-Host '  echo "your-value" | gcloud secrets create SUPABASE_URL --data-file=-'
Write-Host ""
Read-Host "Press Enter to continue after setting up secrets..."

# Step 5: Build and push Backend
Write-Host ""
Write-Host "Building and pushing Backend..." -ForegroundColor Yellow
Push-Location backend

# Build with Cloud Build
gcloud builds submit --tag "gcr.io/$PROJECT_ID/$BACKEND_SERVICE"

# Deploy to Cloud Run
Write-Host "Deploying Backend to Cloud Run..." -ForegroundColor Yellow
gcloud run deploy $BACKEND_SERVICE `
    --image "gcr.io/$PROJECT_ID/$BACKEND_SERVICE" `
    --region $REGION `
    --platform managed `
    --allow-unauthenticated `
    --memory 1Gi `
    --cpu 1 `
    --min-instances 0 `
    --max-instances 10 `
    --port 3001 `
    --set-env-vars "NODE_ENV=production" `
    --set-secrets "SUPABASE_URL=SUPABASE_URL:latest,SUPABASE_ANON_KEY=SUPABASE_ANON_KEY:latest,SUPABASE_SERVICE_KEY=SUPABASE_SERVICE_KEY:latest"

# Get Backend URL
$BACKEND_URL = gcloud run services describe $BACKEND_SERVICE --region $REGION --format='value(status.url)'
Write-Host "Backend deployed at: $BACKEND_URL" -ForegroundColor Green

Pop-Location

# Step 6: Build and push Frontend
Write-Host ""
Write-Host "Building and pushing Frontend..." -ForegroundColor Yellow
Push-Location frontend

# Build with the backend URL
gcloud builds submit `
    --tag "gcr.io/$PROJECT_ID/$FRONTEND_SERVICE" `
    --substitutions "_VITE_API_URL=$BACKEND_URL/api"

# We need a cloudbuild.yaml for frontend to handle build-args
# For now, let's use the simpler approach with environment substitution

# Deploy to Cloud Run
Write-Host "Deploying Frontend to Cloud Run..." -ForegroundColor Yellow
gcloud run deploy $FRONTEND_SERVICE `
    --image "gcr.io/$PROJECT_ID/$FRONTEND_SERVICE" `
    --region $REGION `
    --platform managed `
    --allow-unauthenticated `
    --memory 256Mi `
    --cpu 1 `
    --min-instances 0 `
    --max-instances 10 `
    --port 80

# Get Frontend URL
$FRONTEND_URL = gcloud run services describe $FRONTEND_SERVICE --region $REGION --format='value(status.url)'
Write-Host "Frontend deployed at: $FRONTEND_URL" -ForegroundColor Green

Pop-Location

# Step 7: Update Backend with Frontend URL for CORS
Write-Host ""
Write-Host "Updating Backend with Frontend URL for CORS..." -ForegroundColor Yellow
gcloud run services update $BACKEND_SERVICE `
    --region $REGION `
    --set-env-vars "FRONTEND_URL=$FRONTEND_URL"

# Done!
Write-Host ""
Write-Host "=== Deployment Complete! ===" -ForegroundColor Green
Write-Host ""
Write-Host "Frontend URL: $FRONTEND_URL"
Write-Host "Backend URL:  $BACKEND_URL"
Write-Host ""
Write-Host "Next Steps:" -ForegroundColor Yellow
Write-Host "1. Update your Supabase project settings with the new URLs"
Write-Host "2. Add $FRONTEND_URL to allowed redirect URLs in Supabase Auth"
Write-Host "3. Test the application!"
Write-Host ""
Write-Host "To view logs:" -ForegroundColor Yellow
Write-Host "  gcloud run logs read --project $PROJECT_ID --service $BACKEND_SERVICE --region $REGION"
Write-Host "  gcloud run logs read --project $PROJECT_ID --service $FRONTEND_SERVICE --region $REGION"
