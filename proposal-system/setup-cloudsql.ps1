# ===========================================
# Cloud SQL Setup Script for Proposal System
# ===========================================

$ErrorActionPreference = "Stop"

# Configuration
$PROJECT_ID = "bemtech-478413"
$REGION = "me-west1"
$INSTANCE_NAME = "proposal-db"
$DATABASE_NAME = "proposal_system"
$DB_USER = "app_user"

Write-Host "=== Cloud SQL Setup for Proposal System ===" -ForegroundColor Green
Write-Host ""

# Check gcloud
try {
    $null = Get-Command gcloud -ErrorAction Stop
} catch {
    Write-Host "Error: gcloud CLI is not installed" -ForegroundColor Red
    Write-Host "Please install it from: https://cloud.google.com/sdk/docs/install"
    exit 1
}

# Set project
Write-Host "Setting project to $PROJECT_ID..." -ForegroundColor Yellow
gcloud config set project $PROJECT_ID

# Enable APIs
Write-Host "Enabling required APIs..." -ForegroundColor Yellow
gcloud services enable sqladmin.googleapis.com
gcloud services enable sql-component.googleapis.com

# Create Cloud SQL instance
Write-Host ""
Write-Host "Creating Cloud SQL PostgreSQL instance..." -ForegroundColor Yellow
Write-Host "This may take several minutes..."

$instanceExists = gcloud sql instances list --filter="name=$INSTANCE_NAME" --format="value(name)" 2>$null

if ($instanceExists) {
    Write-Host "Instance $INSTANCE_NAME already exists" -ForegroundColor Yellow
} else {
    gcloud sql instances create $INSTANCE_NAME `
        --database-version=POSTGRES_15 `
        --tier=db-f1-micro `
        --region=$REGION `
        --storage-type=SSD `
        --storage-size=10GB `
        --storage-auto-increase `
        --backup-start-time=03:00 `
        --maintenance-window-day=SUN `
        --maintenance-window-hour=03 `
        --availability-type=zonal

    Write-Host "Instance created successfully!" -ForegroundColor Green
}

# Create database
Write-Host ""
Write-Host "Creating database..." -ForegroundColor Yellow
gcloud sql databases create $DATABASE_NAME --instance=$INSTANCE_NAME 2>$null
if ($LASTEXITCODE -ne 0) {
    Write-Host "Database may already exist, continuing..." -ForegroundColor Yellow
}

# Generate random password
$DB_PASSWORD = -join ((65..90) + (97..122) + (48..57) | Get-Random -Count 24 | ForEach-Object {[char]$_})

# Create database user
Write-Host ""
Write-Host "Creating database user..." -ForegroundColor Yellow
gcloud sql users create $DB_USER `
    --instance=$INSTANCE_NAME `
    --password=$DB_PASSWORD 2>$null

if ($LASTEXITCODE -ne 0) {
    Write-Host "User may already exist, setting new password..." -ForegroundColor Yellow
    gcloud sql users set-password $DB_USER `
        --instance=$INSTANCE_NAME `
        --password=$DB_PASSWORD
}

# Get instance connection name
$CONNECTION_NAME = gcloud sql instances describe $INSTANCE_NAME --format="value(connectionName)"

# Store password in Secret Manager
Write-Host ""
Write-Host "Storing credentials in Secret Manager..." -ForegroundColor Yellow

# Create or update secrets
$secrets = @{
    "DB_HOST" = "/cloudsql/$CONNECTION_NAME"
    "DB_NAME" = $DATABASE_NAME
    "DB_USER" = $DB_USER
    "DB_PASSWORD" = $DB_PASSWORD
}

foreach ($key in $secrets.Keys) {
    $value = $secrets[$key]
    $secretExists = gcloud secrets describe $key 2>$null

    if ($secretExists) {
        Write-Host "Updating secret: $key" -ForegroundColor Gray
        echo $value | gcloud secrets versions add $key --data-file=-
    } else {
        Write-Host "Creating secret: $key" -ForegroundColor Gray
        echo $value | gcloud secrets create $key --data-file=-
    }
}

# Create JWT secret
$JWT_SECRET = -join ((65..90) + (97..122) + (48..57) | Get-Random -Count 64 | ForEach-Object {[char]$_})
$jwtSecretExists = gcloud secrets describe JWT_SECRET 2>$null
if (-not $jwtSecretExists) {
    Write-Host "Creating JWT_SECRET..." -ForegroundColor Gray
    echo $JWT_SECRET | gcloud secrets create JWT_SECRET --data-file=-
}

# Output connection info
Write-Host ""
Write-Host "=== Cloud SQL Setup Complete! ===" -ForegroundColor Green
Write-Host ""
Write-Host "Instance Connection Name: $CONNECTION_NAME" -ForegroundColor Cyan
Write-Host "Database: $DATABASE_NAME" -ForegroundColor Cyan
Write-Host "User: $DB_USER" -ForegroundColor Cyan
Write-Host ""
Write-Host "Credentials stored in Secret Manager:" -ForegroundColor Yellow
Write-Host "  - DB_HOST"
Write-Host "  - DB_NAME"
Write-Host "  - DB_USER"
Write-Host "  - DB_PASSWORD"
Write-Host "  - JWT_SECRET"
Write-Host ""

# Run schema
Write-Host "=== Running Database Schema ===" -ForegroundColor Yellow
Write-Host ""
Write-Host "To run the schema, use Cloud SQL Proxy or the console:" -ForegroundColor Yellow
Write-Host ""
Write-Host "Option 1: Cloud SQL Proxy (recommended for local development)" -ForegroundColor Cyan
Write-Host "  1. Download Cloud SQL Proxy from: https://cloud.google.com/sql/docs/postgres/sql-proxy"
Write-Host "  2. Run: cloud-sql-proxy $CONNECTION_NAME"
Write-Host "  3. Connect: psql -h localhost -U $DB_USER -d $DATABASE_NAME"
Write-Host "  4. Run: \i database/schema-cloudsql.sql"
Write-Host ""
Write-Host "Option 2: Google Cloud Console" -ForegroundColor Cyan
Write-Host "  1. Go to: https://console.cloud.google.com/sql/instances/$INSTANCE_NAME/overview"
Write-Host "  2. Click 'Connect using Cloud Shell'"
Write-Host "  3. Copy and paste the schema SQL"
Write-Host ""

# Create .env.cloudsql file
Write-Host "Creating .env.cloudsql example file..." -ForegroundColor Yellow
$envContent = @"
# Cloud SQL Configuration
# For Cloud Run deployment, use Secret Manager instead

# Database (via Cloud SQL Proxy for local dev)
DB_HOST=localhost
DB_PORT=5432
DB_NAME=$DATABASE_NAME
DB_USER=$DB_USER
DB_PASSWORD=$DB_PASSWORD

# For Cloud Run (uses Unix socket)
# DB_HOST=/cloudsql/$CONNECTION_NAME

# JWT
JWT_SECRET=your-jwt-secret-from-secret-manager
JWT_EXPIRES_IN=24h
JWT_REFRESH_EXPIRES_IN=7d

# Server
PORT=3001
NODE_ENV=production

# Cloud Storage bucket for PDFs
GCS_BUCKET=proposal-pdfs-$PROJECT_ID

# Frontend URL
FRONTEND_URL=https://proposal-frontend-xxxxx.a.run.app
"@

$envContent | Out-File -FilePath "backend\.env.cloudsql.example" -Encoding UTF8

Write-Host ""
Write-Host "Done! Next steps:" -ForegroundColor Green
Write-Host "1. Run the database schema using one of the options above"
Write-Host "2. Create Cloud Storage bucket: gcloud storage buckets create gs://proposal-pdfs-$PROJECT_ID --location=$REGION"
Write-Host "3. Update the backend code (use the updated files)"
Write-Host "4. Deploy using deploy.ps1"
