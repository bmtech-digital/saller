#!/bin/bash

# ===========================================
# Proposal System - Google Cloud Deployment
# ===========================================

set -e

# Configuration - EDIT THESE VALUES
PROJECT_ID="bemtech-478413"
REGION="me-west1"  # Israel region
BACKEND_SERVICE="proposal-backend"
FRONTEND_SERVICE="proposal-frontend"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${GREEN}=== Proposal System - Google Cloud Deployment ===${NC}"
echo ""

# Step 1: Check if gcloud is installed
if ! command -v gcloud &> /dev/null; then
    echo -e "${RED}Error: gcloud CLI is not installed${NC}"
    echo "Please install it from: https://cloud.google.com/sdk/docs/install"
    exit 1
fi

# Step 2: Set project
echo -e "${YELLOW}Setting project to ${PROJECT_ID}...${NC}"
gcloud config set project $PROJECT_ID

# Step 3: Enable required APIs
echo -e "${YELLOW}Enabling required APIs...${NC}"
gcloud services enable cloudbuild.googleapis.com
gcloud services enable run.googleapis.com
gcloud services enable containerregistry.googleapis.com
gcloud services enable secretmanager.googleapis.com

# Step 4: Create secrets in Secret Manager (if not exists)
echo ""
echo -e "${YELLOW}=== Secret Manager Setup ===${NC}"
echo "Please ensure you have created the following secrets in Google Secret Manager:"
echo "  - SUPABASE_URL"
echo "  - SUPABASE_ANON_KEY"
echo "  - SUPABASE_SERVICE_KEY"
echo "  - FRONTEND_URL (will be updated after deployment)"
echo ""
echo "You can create them via:"
echo "  gcloud secrets create SUPABASE_URL --data-file=-"
echo "  echo -n 'your-value' | gcloud secrets create SUPABASE_URL --data-file=-"
echo ""
read -p "Press Enter to continue after setting up secrets..."

# Step 5: Build and push Backend
echo ""
echo -e "${YELLOW}Building and pushing Backend...${NC}"
cd backend

# Build with Cloud Build
gcloud builds submit --tag gcr.io/$PROJECT_ID/$BACKEND_SERVICE

# Deploy to Cloud Run
echo -e "${YELLOW}Deploying Backend to Cloud Run...${NC}"
gcloud run deploy $BACKEND_SERVICE \
    --image gcr.io/$PROJECT_ID/$BACKEND_SERVICE \
    --region $REGION \
    --platform managed \
    --allow-unauthenticated \
    --memory 1Gi \
    --cpu 1 \
    --min-instances 0 \
    --max-instances 10 \
    --port 3001 \
    --set-env-vars "NODE_ENV=production" \
    --set-secrets "SUPABASE_URL=SUPABASE_URL:latest,SUPABASE_ANON_KEY=SUPABASE_ANON_KEY:latest,SUPABASE_SERVICE_KEY=SUPABASE_SERVICE_KEY:latest"

# Get Backend URL
BACKEND_URL=$(gcloud run services describe $BACKEND_SERVICE --region $REGION --format='value(status.url)')
echo -e "${GREEN}Backend deployed at: ${BACKEND_URL}${NC}"

cd ..

# Step 6: Build and push Frontend
echo ""
echo -e "${YELLOW}Building and pushing Frontend...${NC}"
cd frontend

# Build with the backend URL
gcloud builds submit \
    --tag gcr.io/$PROJECT_ID/$FRONTEND_SERVICE \
    --build-arg VITE_API_URL="${BACKEND_URL}/api" \
    -f Dockerfile.cloudrun .

# Deploy to Cloud Run
echo -e "${YELLOW}Deploying Frontend to Cloud Run...${NC}"
gcloud run deploy $FRONTEND_SERVICE \
    --image gcr.io/$PROJECT_ID/$FRONTEND_SERVICE \
    --region $REGION \
    --platform managed \
    --allow-unauthenticated \
    --memory 256Mi \
    --cpu 1 \
    --min-instances 0 \
    --max-instances 10 \
    --port 80

# Get Frontend URL
FRONTEND_URL=$(gcloud run services describe $FRONTEND_SERVICE --region $REGION --format='value(status.url)')
echo -e "${GREEN}Frontend deployed at: ${FRONTEND_URL}${NC}"

cd ..

# Step 7: Update Backend with Frontend URL for CORS
echo ""
echo -e "${YELLOW}Updating Backend with Frontend URL for CORS...${NC}"
gcloud run services update $BACKEND_SERVICE \
    --region $REGION \
    --set-env-vars "FRONTEND_URL=${FRONTEND_URL}"

# Done!
echo ""
echo -e "${GREEN}=== Deployment Complete! ===${NC}"
echo ""
echo "Frontend URL: ${FRONTEND_URL}"
echo "Backend URL:  ${BACKEND_URL}"
echo ""
echo -e "${YELLOW}Next Steps:${NC}"
echo "1. Update your Supabase project settings with the new URLs"
echo "2. Add ${FRONTEND_URL} to allowed redirect URLs in Supabase Auth"
echo "3. Test the application!"
echo ""
echo -e "${YELLOW}To view logs:${NC}"
echo "  gcloud run logs read --project $PROJECT_ID --service $BACKEND_SERVICE --region $REGION"
echo "  gcloud run logs read --project $PROJECT_ID --service $FRONTEND_SERVICE --region $REGION"
