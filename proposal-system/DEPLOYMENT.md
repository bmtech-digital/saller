# Proposal System - Google Cloud Deployment Guide

## Prerequisites

1. **Google Cloud SDK** - Install from: https://cloud.google.com/sdk/docs/install
2. **Google Cloud Account** with billing enabled
3. **Supabase Project** with database and authentication configured

## Project Configuration

- **Project ID:** `bemtech-478413`
- **Region:** `me-west1` (Israel)
- **Services:**
  - Backend: `proposal-backend`
  - Frontend: `proposal-frontend`

---

## Step 1: Setup Google Cloud

```bash
# Login to Google Cloud
gcloud auth login

# Set the project
gcloud config set project bemtech-478413

# Enable required APIs
gcloud services enable cloudbuild.googleapis.com
gcloud services enable run.googleapis.com
gcloud services enable containerregistry.googleapis.com
gcloud services enable secretmanager.googleapis.com
```

---

## Step 2: Create Secrets in Secret Manager

Store sensitive environment variables in Secret Manager:

```bash
# Create Supabase secrets
echo -n "https://your-project.supabase.co" | gcloud secrets create SUPABASE_URL --data-file=-
echo -n "your-anon-key" | gcloud secrets create SUPABASE_ANON_KEY --data-file=-
echo -n "your-service-key" | gcloud secrets create SUPABASE_SERVICE_KEY --data-file=-

# Optional: Email secrets
echo -n "your-smtp-password" | gcloud secrets create SMTP_PASS --data-file=-
```

Or create them via the [Google Cloud Console](https://console.cloud.google.com/security/secret-manager).

---

## Step 3: Deploy Backend

```bash
cd backend

# Build and push to Container Registry
gcloud builds submit --tag gcr.io/bemtech-478413/proposal-backend

# Deploy to Cloud Run
gcloud run deploy proposal-backend \
    --image gcr.io/bemtech-478413/proposal-backend \
    --region me-west1 \
    --platform managed \
    --allow-unauthenticated \
    --memory 1Gi \
    --cpu 1 \
    --min-instances 0 \
    --max-instances 10 \
    --port 3001 \
    --set-env-vars "NODE_ENV=production" \
    --set-secrets "SUPABASE_URL=SUPABASE_URL:latest,SUPABASE_ANON_KEY=SUPABASE_ANON_KEY:latest,SUPABASE_SERVICE_KEY=SUPABASE_SERVICE_KEY:latest"

# Get the backend URL
gcloud run services describe proposal-backend --region me-west1 --format='value(status.url)'
```

Save the backend URL (e.g., `https://proposal-backend-xxxxx-xx.a.run.app`)

---

## Step 4: Deploy Frontend

```bash
cd frontend

# Build with the backend URL (replace with your actual backend URL)
gcloud builds submit \
    --config cloudbuild.yaml \
    --substitutions="_VITE_API_URL=https://proposal-backend-xxxxx-xx.a.run.app/api"

# Deploy to Cloud Run
gcloud run deploy proposal-frontend \
    --image gcr.io/bemtech-478413/proposal-frontend \
    --region me-west1 \
    --platform managed \
    --allow-unauthenticated \
    --memory 256Mi \
    --cpu 1 \
    --min-instances 0 \
    --max-instances 10 \
    --port 80

# Get the frontend URL
gcloud run services describe proposal-frontend --region me-west1 --format='value(status.url)'
```

---

## Step 5: Update Backend with Frontend URL

Update the backend's FRONTEND_URL for CORS:

```bash
gcloud run services update proposal-backend \
    --region me-west1 \
    --set-env-vars "FRONTEND_URL=https://proposal-frontend-xxxxx-xx.a.run.app"
```

---

## Step 6: Configure Supabase

1. Go to your Supabase project dashboard
2. Navigate to **Authentication > URL Configuration**
3. Add your frontend URL to:
   - Site URL: `https://proposal-frontend-xxxxx-xx.a.run.app`
   - Redirect URLs: `https://proposal-frontend-xxxxx-xx.a.run.app/*`

---

## Quick Deploy (Automated)

### Windows (PowerShell)
```powershell
.\deploy.ps1
```

### Linux/Mac (Bash)
```bash
chmod +x deploy.sh
./deploy.sh
```

---

## Useful Commands

### View Logs
```bash
# Backend logs
gcloud run logs read --service proposal-backend --region me-west1

# Frontend logs
gcloud run logs read --service proposal-frontend --region me-west1

# Stream logs in real-time
gcloud run logs tail --service proposal-backend --region me-west1
```

### Update Deployment
```bash
# Rebuild and redeploy backend
cd backend && gcloud builds submit --tag gcr.io/bemtech-478413/proposal-backend
gcloud run deploy proposal-backend --image gcr.io/bemtech-478413/proposal-backend --region me-west1

# Rebuild and redeploy frontend
cd frontend && gcloud builds submit --config cloudbuild.yaml --substitutions="_VITE_API_URL=YOUR_BACKEND_URL/api"
gcloud run deploy proposal-frontend --image gcr.io/bemtech-478413/proposal-frontend --region me-west1
```

### Check Service Status
```bash
gcloud run services list --region me-west1
```

### Delete Services (Cleanup)
```bash
gcloud run services delete proposal-backend --region me-west1
gcloud run services delete proposal-frontend --region me-west1
```

---

## Custom Domain (Optional)

To use a custom domain instead of the Cloud Run URLs:

1. Go to Cloud Run in the Google Cloud Console
2. Select your service
3. Click "Manage Custom Domains"
4. Follow the instructions to verify and map your domain

---

## Cost Estimation

Cloud Run pricing is based on:
- **CPU:** $0.00002400 / vCPU-second
- **Memory:** $0.00000250 / GiB-second
- **Requests:** $0.40 / million requests

With `min-instances: 0`, you only pay when the service is handling requests.

For a typical small business application:
- Estimated monthly cost: $5-50 USD (depending on usage)
- Free tier includes 2 million requests per month

---

## Troubleshooting

### "Permission denied" errors
```bash
# Grant Cloud Build permissions
gcloud projects add-iam-policy-binding bemtech-478413 \
    --member="serviceAccount:xxxxx@cloudbuild.gserviceaccount.com" \
    --role="roles/run.admin"
```

### Container fails to start
```bash
# Check logs for startup errors
gcloud run logs read --service proposal-backend --region me-west1 --limit 50
```

### CORS errors
Make sure `FRONTEND_URL` in the backend matches your exact frontend URL (including `https://`).

### PDF generation issues
The backend uses Puppeteer with Chromium. Ensure the container has enough memory (1Gi recommended).
