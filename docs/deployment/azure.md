# Azure Deployment Guide

Complete guide for deploying ECO-Tracking to Microsoft Azure cloud platform.

## 🎯 Deployment Overview

This guide covers deploying:
- **Backend API** to Azure App Service
- **Frontend** to Azure Static Web Apps
- **Database** using Azure Cosmos DB
- **AI Services** with Azure Cognitive Services
- **File Storage** with Azure Blob Storage
- **Maps** with Azure Maps API

## 📋 Prerequisites

### Azure Account Setup
1. **Azure Subscription** with sufficient credits/budget
2. **Azure CLI** installed and configured
3. **Resource Group** for organizing resources
4. **Appropriate permissions** for creating resources

### Local Development
1. **Working local environment** (see Quick Start Guide)
2. **Environment variables** configured and tested
3. **Code committed** to Git repository
4. **Tests passing** locally

## 🏗️ Infrastructure Setup

### 1. Create Resource Group
```bash
# Create resource group
az group create \
  --name eco-tracking-rg \
  --location eastus

# Verify creation
az group show --name eco-tracking-rg
```

### 2. Create Azure Cosmos DB
```bash
# Create Cosmos DB account
az cosmosdb create \
  --name eco-tracking-cosmos \
  --resource-group eco-tracking-rg \
  --kind GlobalDocumentDB \
  --locations regionName=eastus failoverPriority=0 \
  --default-consistency-level Session \
  --enable-automatic-failover true

# Create database
az cosmosdb sql database create \
  --account-name eco-tracking-cosmos \
  --resource-group eco-tracking-rg \
  --name eco-tracking

# Create containers
az cosmosdb sql container create \
  --account-name eco-tracking-cosmos \
  --resource-group eco-tracking-rg \
  --database-name eco-tracking \
  --name users \
  --partition-key-path "/id" \
  --throughput 400

az cosmosdb sql container create \
  --account-name eco-tracking-cosmos \
  --resource-group eco-tracking-rg \
  --database-name eco-tracking \
  --name recycling-records \
  --partition-key-path "/userId" \
  --throughput 400
```

### 3. Create Cognitive Services
```bash
# Create Custom Vision Training resource
az cognitiveservices account create \
  --name eco-tracking-cv-training \
  --resource-group eco-tracking-rg \
  --kind CustomVision.Training \
  --sku F0 \
  --location eastus

# Create Custom Vision Prediction resource
az cognitiveservices account create \
  --name eco-tracking-cv-prediction \
  --resource-group eco-tracking-rg \
  --kind CustomVision.Prediction \
  --sku F0 \
  --location eastus
```

### 4. Create Storage Account
```bash
# Create storage account
az storage account create \
  --name ecotrackingstorage \
  --resource-group eco-tracking-rg \
  --location eastus \
  --sku Standard_LRS \
  --kind StorageV2

# Create blob container
az storage container create \
  --name eco-tracking-images \
  --account-name ecotrackingstorage \
  --public-access blob
```

### 5. Create Azure Maps Account
```bash
# Create Azure Maps account
az maps account create \
  --name eco-tracking-maps \
  --resource-group eco-tracking-rg \
  --sku S0
```

## 🚀 Application Deployment

### Backend Deployment (Azure App Service)

#### 1. Create App Service Plan
```bash
# Create App Service Plan
az appservice plan create \
  --name eco-tracking-plan \
  --resource-group eco-tracking-rg \
  --sku B1 \
  --is-linux
```

#### 2. Create Web App
```bash
# Create Web App
az webapp create \
  --name eco-tracking-backend \
  --resource-group eco-tracking-rg \
  --plan eco-tracking-plan \
  --runtime "NODE|18-lts"
```

#### 3. Configure Environment Variables
```bash
# Get connection strings
COSMOS_CONNECTION=$(az cosmosdb keys list \
  --name eco-tracking-cosmos \
  --resource-group eco-tracking-rg \
  --type connection-strings \
  --query "connectionStrings[0].connectionString" \
  --output tsv)

CV_KEY=$(az cognitiveservices account keys list \
  --name eco-tracking-cv-prediction \
  --resource-group eco-tracking-rg \
  --query "key1" \
  --output tsv)

MAPS_KEY=$(az maps account keys list \
  --name eco-tracking-maps \
  --resource-group eco-tracking-rg \
  --query "primaryKey" \
  --output tsv)

# Set application settings
az webapp config appsettings set \
  --name eco-tracking-backend \
  --resource-group eco-tracking-rg \
  --settings \
    NODE_ENV=production \
    PORT=8000 \
    JWT_SECRET="your-production-jwt-secret" \
    COSMOS_DB_CONNECTION_STRING="$COSMOS_CONNECTION" \
    CUSTOM_VISION_PREDICTION_KEY="$CV_KEY" \
    CUSTOM_VISION_ENDPOINT="https://eastus.api.cognitive.microsoft.com/" \
    AZURE_MAPS_SUBSCRIPTION_KEY="$MAPS_KEY"
```

#### 4. Deploy Backend Code
```bash
# Option A: Deploy from local Git
cd backend
az webapp deployment source config-local-git \
  --name eco-tracking-backend \
  --resource-group eco-tracking-rg

# Add Azure remote and push
git remote add azure https://eco-tracking-backend.scm.azurewebsites.net:443/eco-tracking-backend.git
git push azure main

# Option B: Deploy from GitHub
az webapp deployment source config \
  --name eco-tracking-backend \
  --resource-group eco-tracking-rg \
  --repo-url https://github.com/yourusername/eco-tracking-unified \
  --branch main \
  --manual-integration
```

### Frontend Deployment (Azure Static Web Apps)

#### 1. Create Static Web App
```bash
# Create Static Web App
az staticwebapp create \
  --name eco-tracking-frontend \
  --resource-group eco-tracking-rg \
  --source https://github.com/yourusername/eco-tracking-unified \
  --branch main \
  --app-location "frontend" \
  --output-location "out" \
  --login-with-github
```

#### 2. Configure Frontend Environment
```bash
# Set Static Web App configuration
az staticwebapp appsettings set \
  --name eco-tracking-frontend \
  --setting-names \
    NEXT_PUBLIC_API_BASE_URL=https://eco-tracking-backend.azurewebsites.net \
    NEXT_PUBLIC_AZURE_MAPS_KEY="$MAPS_KEY"
```

#### 3. Configure Build Settings
Create `.github/workflows/azure-static-web-apps-*.yml`:
```yaml
name: Azure Static Web Apps CI/CD

on:
  push:
    branches:
      - main
  pull_request:
    types: [opened, synchronize, reopened, closed]
    branches:
      - main

jobs:
  build_and_deploy_job:
    if: github.event_name == 'push' || (github.event_name == 'pull_request' && github.event.action != 'closed')
    runs-on: ubuntu-latest
    name: Build and Deploy Job
    steps:
      - uses: actions/checkout@v3
        with:
          submodules: true
      - name: Build And Deploy
        id: builddeploy
        uses: Azure/static-web-apps-deploy@v1
        with:
          azure_static_web_apps_api_token: ${{ secrets.AZURE_STATIC_WEB_APPS_API_TOKEN }}
          repo_token: ${{ secrets.GITHUB_TOKEN }}
          action: "upload"
          app_location: "frontend"
          output_location: "out"
          
  close_pull_request_job:
    if: github.event_name == 'pull_request' && github.event.action == 'closed'
    runs-on: ubuntu-latest
    name: Close Pull Request Job
    steps:
      - name: Close Pull Request
        id: closepullrequest
        uses: Azure/static-web-apps-deploy@v1
        with:
          azure_static_web_apps_api_token: ${{ secrets.AZURE_STATIC_WEB_APPS_API_TOKEN }}
          action: "close"
```

## 🔧 Post-Deployment Configuration

### 1. Configure Custom Domains (Optional)
```bash
# Add custom domain to backend
az webapp config hostname add \
  --webapp-name eco-tracking-backend \
  --resource-group eco-tracking-rg \
  --hostname api.yourdomain.com

# Add custom domain to frontend
az staticwebapp hostname set \
  --name eco-tracking-frontend \
  --hostname www.yourdomain.com
```

### 2. Enable HTTPS and SSL
```bash
# Enable HTTPS redirect for backend
az webapp config set \
  --name eco-tracking-backend \
  --resource-group eco-tracking-rg \
  --https-only true

# Static Web Apps have HTTPS by default
```

### 3. Configure CORS
```bash
# Configure CORS for backend
az webapp cors add \
  --name eco-tracking-backend \
  --resource-group eco-tracking-rg \
  --allowed-origins https://eco-tracking-frontend.azurestaticapps.net
```

## 📊 Monitoring and Logging

### 1. Enable Application Insights
```bash
# Create Application Insights
az monitor app-insights component create \
  --app eco-tracking-insights \
  --location eastus \
  --resource-group eco-tracking-rg

# Get instrumentation key
INSIGHTS_KEY=$(az monitor app-insights component show \
  --app eco-tracking-insights \
  --resource-group eco-tracking-rg \
  --query "instrumentationKey" \
  --output tsv)

# Configure backend with Application Insights
az webapp config appsettings set \
  --name eco-tracking-backend \
  --resource-group eco-tracking-rg \
  --settings APPINSIGHTS_INSTRUMENTATIONKEY="$INSIGHTS_KEY"
```

### 2. Configure Alerts
```bash
# Create alert for high response time
az monitor metrics alert create \
  --name "High Response Time" \
  --resource-group eco-tracking-rg \
  --scopes "/subscriptions/{subscription}/resourceGroups/eco-tracking-rg/providers/Microsoft.Web/sites/eco-tracking-backend" \
  --condition "avg responseTime > 1000" \
  --description "Alert when average response time exceeds 1 second"
```

## 🔄 CI/CD Pipeline Setup

### GitHub Actions Workflow
Create `.github/workflows/deploy.yml`:
```yaml
name: Deploy ECO-Tracking

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '18'
      - run: npm ci
      - run: npm run test

  deploy-backend:
    needs: test
    runs-on: ubuntu-latest
    if: github.ref == 'refs/heads/main'
    steps:
      - uses: actions/checkout@v3
      - uses: azure/login@v1
        with:
          creds: ${{ secrets.AZURE_CREDENTIALS }}
      - uses: azure/webapps-deploy@v2
        with:
          app-name: 'eco-tracking-backend'
          package: './backend'
```

## 🧪 Deployment Verification

### 1. Health Checks
```bash
# Test backend health
curl https://eco-tracking-backend.azurewebsites.net/health

# Test frontend
curl https://eco-tracking-frontend.azurestaticapps.net
```

### 2. API Testing
```bash
# Test authentication endpoint
curl -X POST https://eco-tracking-backend.azurewebsites.net/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"Test123!","name":"Test User"}'

# Test classification endpoint (requires auth token)
curl -X POST https://eco-tracking-backend.azurewebsites.net/api/recycling/classify \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -F "image=@test-image.jpg"
```

### 3. Database Verification
```bash
# Connect to Cosmos DB and verify collections
az cosmosdb sql database show \
  --account-name eco-tracking-cosmos \
  --resource-group eco-tracking-rg \
  --name eco-tracking
```

## 💰 Cost Optimization

### 1. Choose Appropriate Tiers
- **App Service**: Start with Basic B1, upgrade as needed
- **Cosmos DB**: Use serverless for development, provisioned for production
- **Cognitive Services**: F0 (free) for development, S1 for production
- **Storage**: Standard LRS for cost efficiency

### 2. Configure Auto-scaling
```bash
# Enable auto-scaling for App Service
az monitor autoscale create \
  --resource-group eco-tracking-rg \
  --resource eco-tracking-backend \
  --resource-type Microsoft.Web/sites \
  --name autoscale-backend \
  --min-count 1 \
  --max-count 3 \
  --count 1
```

### 3. Set Budget Alerts
```bash
# Create budget alert
az consumption budget create \
  --budget-name eco-tracking-budget \
  --amount 100 \
  --category cost \
  --time-grain monthly \
  --resource-group eco-tracking-rg
```

## 🔒 Security Best Practices

### 1. Network Security
- Configure Virtual Network integration
- Use Private Endpoints for databases
- Enable Web Application Firewall

### 2. Identity and Access
- Use Managed Identity for service connections
- Configure Azure AD authentication
- Implement role-based access control

### 3. Data Protection
- Enable encryption at rest and in transit
- Configure backup and disaster recovery
- Implement data retention policies

## 🆘 Troubleshooting

### Common Deployment Issues

#### 1. Build Failures
```bash
# Check build logs
az webapp log tail --name eco-tracking-backend --resource-group eco-tracking-rg

# Enable detailed error messages
az webapp config appsettings set \
  --name eco-tracking-backend \
  --resource-group eco-tracking-rg \
  --settings SCM_DO_BUILD_DURING_DEPLOYMENT=true
```

#### 2. Environment Variable Issues
```bash
# List all app settings
az webapp config appsettings list \
  --name eco-tracking-backend \
  --resource-group eco-tracking-rg

# Update specific setting
az webapp config appsettings set \
  --name eco-tracking-backend \
  --resource-group eco-tracking-rg \
  --settings KEY=VALUE
```

#### 3. Database Connection Issues
```bash
# Test Cosmos DB connectivity
az cosmosdb check-name-exists --name eco-tracking-cosmos

# Regenerate access keys if needed
az cosmosdb keys regenerate \
  --name eco-tracking-cosmos \
  --resource-group eco-tracking-rg \
  --key-kind primary
```

---

**Your ECO-Tracking application is now deployed to Azure! 🚀☁️**

For ongoing maintenance and updates, refer to the [Production Maintenance Guide](./maintenance.md).