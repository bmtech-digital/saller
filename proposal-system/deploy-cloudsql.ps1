# ===========================================
# Proposal System - Google Cloud Deployment
# With Cloud SQL Database
# ===========================================

$ErrorActionPreference = "Stop"

# Configuration
$PROJECT_ID = "bemtech-478413"
$REGION = "me-west1"
$BACKEND_SERVICE = "proposal-backend"
$FRONTEND_SERVICE = "proposal-frontend"
$SQL_INSTANCE = "proposal-db"
$GCS_BUCKET = "proposal-pdfs-$PROJECT_ID"

Write-Host "=== Proposal System - Cloud Deployment ===" -ForegroundColor Green
Write-Host ""

# Check gcloud
try {
    $null = Get-Command gcloud -ErrorAction Stop
} catch {
    Write-Host "Error: gcloud CLI is not installed" -ForegroundColor Red
    exit 1
}

# Set project
Write-Host "Setting project to $PROJECT_ID..." -ForegroundColor Yellow
gcloud config set project $PROJECT_ID

# Enable APIs
Write-Host "Enabling required APIs..." -ForegroundColor Yellow
gcloud services enable cloudbuild.googleapis.com
gcloud services enable run.googleapis.com
gcloud services enable containerregistry.googleapis.com
gcloud services enable secretmanager.googleapis.com
gcloud services enable sqladmin.googleapis.com

# Get Cloud SQL connection name
$CONNECTION_NAME = gcloud sql instances describe $SQL_INSTANCE --format="value(connectionName)" 2>$null

if (-not $CONNECTION_NAME) {
    Write-Host "Error: Cloud SQL instance '$SQL_INSTANCE' not found!" -ForegroundColor Red
    Write-Host "Please run setup-cloudsql.ps1 first"
    exit 1
}

Write-Host "Cloud SQL connection: $CONNECTION_NAME" -ForegroundColor Cyan

# Create Cloud Storage bucket if not exists
Write-Host ""
Write-Host "Creating Cloud Storage bucket..." -ForegroundColor Yellow
$bucketExists = gsutil ls "gs://$GCS_BUCKET" 2>$null
if (-not $bucketExists) {
    gsutil mb -l $REGION "gs://$GCS_BUCKET"
    # Set CORS for the bucket
    $corsConfig = @"
[
  {
    "origin": ["*"],
    "method": ["GET", "HEAD"],
    "responseHeader": ["Content-Type"],
    "maxAgeSeconds": 3600
  }
]
"@
    $corsConfig | Out-File -FilePath "cors.json" -Encoding UTF8
    gsutil cors set cors.json "gs://$GCS_BUCKET"
    Remove-Item cors.json
    Write-Host "Bucket created: gs://$GCS_BUCKET" -ForegroundColor Green
} else {
    Write-Host "Bucket already exists" -ForegroundColor Gray
}

# Build and deploy Backend
Write-Host ""
Write-Host "Building Backend..." -ForegroundColor Yellow
Push-Location backend

gcloud builds submit --tag "gcr.io/$PROJECT_ID/$BACKEND_SERVICE"

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
    --add-cloudsql-instances $CONNECTION_NAME `
    --set-env-vars "NODE_ENV=production,GCS_BUCKET=$GCS_BUCKET" `
    --set-secrets "DB_HOST=DB_HOST:latest,DB_NAME=DB_NAME:latest,DB_USER=DB_USER:latest,DB_PASSWORD=DB_PASSWORD:latest,JWT_SECRET=JWT_SECRET:latest"

$BACKEND_URL = gcloud run services describe $BACKEND_SERVICE --region $REGION --format='value(status.url)'
Write-Host "Backend deployed at: $BACKEND_URL" -ForegroundColor Green

Pop-Location

# Build and deploy Frontend
Write-Host ""
Write-Host "Building Frontend..." -ForegroundColor Yellow
Push-Location frontend

# Build with backend URL
gcloud builds submit `
    --config cloudbuild.yaml `
    --substitutions "_VITE_API_URL=$BACKEND_URL/api"

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

$FRONTEND_URL = gcloud run services describe $FRONTEND_SERVICE --region $REGION --format='value(status.url)'
Write-Host "Frontend deployed at: $FRONTEND_URL" -ForegroundColor Green

Pop-Location

# Update Backend with Frontend URL
Write-Host ""
Write-Host "Updating Backend with Frontend URL..." -ForegroundColor Yellow
gcloud run services update $BACKEND_SERVICE `
    --region $REGION `
    --set-env-vars "FRONTEND_URL=$FRONTEND_URL"

# Grant Cloud Run service account access to Cloud SQL
Write-Host ""
Write-Host "Granting Cloud Run access to Cloud SQL..." -ForegroundColor Yellow
$SERVICE_ACCOUNT = gcloud run services describe $BACKEND_SERVICE --region $REGION --format='value(spec.template.spec.serviceAccountName)'
if (-not $SERVICE_ACCOUNT) {
    $PROJECT_NUMBER = gcloud projects describe $PROJECT_ID --format='value(projectNumber)'
    $SERVICE_ACCOUNT = "$PROJECT_NUMBER-compute@developer.gserviceaccount.com"
}

gcloud projects add-iam-policy-binding $PROJECT_ID `
    --member="serviceAccount:$SERVICE_ACCOUNT" `
    --role="roles/cloudsql.client"

gcloud projects add-iam-policy-binding $PROJECT_ID `
    --member="serviceAccount:$SERVICE_ACCOUNT" `
    --role="roles/storage.objectAdmin"

# Done!
Write-Host ""
Write-Host "=== Deployment Complete! ===" -ForegroundColor Green
Write-Host ""
Write-Host "Frontend URL: $FRONTEND_URL" -ForegroundColor Cyan
Write-Host "Backend URL:  $BACKEND_URL" -ForegroundColor Cyan
Write-Host "Database:     Cloud SQL ($SQL_INSTANCE)" -ForegroundColor Cyan
Write-Host "Storage:      gs://$GCS_BUCKET" -ForegroundColor Cyan
Write-Host ""
Write-Host "Default admin credentials:" -ForegroundColor Yellow
Write-Host "  Email: admin@demo.com"
Write-Host "  Password: Admin123!"
Write-Host ""
Write-Host "To view logs:" -ForegroundColor Yellow
Write-Host "  gcloud run logs read --service $BACKEND_SERVICE --region $REGION"
