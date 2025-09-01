# ECO-Tracking Quick Start Guide

This guide will help you get the ECO-Tracking system up and running in under 10 minutes.

## 🚀 Prerequisites

Before starting, ensure you have:
- **Node.js 18+** installed
- **Python 3.9+** installed (for AI model training)
- **Git** for version control
- **Azure Account** with active subscription (for cloud features)

## 📦 Quick Installation

### 1. Clone and Setup
```bash
# Clone the repository
git clone <your-repository-url>
cd eco-tracking-unified

# Install all dependencies
npm run setup
```

### 2. Environment Configuration

#### Backend Environment
```bash
# Copy and configure backend environment
cp backend/.env.example backend/.env
```

Edit `backend/.env` with your Azure credentials:
```env
NODE_ENV=development
PORT=3001
JWT_SECRET=your_secure_jwt_secret_here

# Azure Cosmos DB
COSMOS_DB_ENDPOINT=https://your-account.documents.azure.com:443/
COSMOS_DB_KEY=your_cosmos_db_key

# Azure Custom Vision
CUSTOM_VISION_ENDPOINT=https://your-region.cognitiveservices.azure.com/
CUSTOM_VISION_PREDICTION_KEY=your_prediction_key
CUSTOM_VISION_PROJECT_ID=your_project_id

# Azure Maps
AZURE_MAPS_SUBSCRIPTION_KEY=your_maps_key
```

#### Frontend Environment
```bash
# Copy and configure frontend environment
cp frontend/.env.local.example frontend/.env.local
```

Edit `frontend/.env.local`:
```env
NEXT_PUBLIC_API_BASE_URL=http://localhost:3001
NEXT_PUBLIC_AZURE_MAPS_KEY=your_azure_maps_key
```

### 3. Start Development Servers

#### Option A: Start Both Services (Recommended)
```bash
# Start both backend and frontend
npm run dev
```

#### Option B: Start Services Individually
```bash
# Terminal 1: Start backend
npm run dev:backend

# Terminal 2: Start frontend  
npm run dev:frontend
```

### 4. Access the Application
- **Frontend**: http://localhost:3000
- **Backend API**: http://localhost:3001
- **Health Check**: http://localhost:3001/health

## 🔧 Development Mode Features

### With Azure Services (Full Features)
- ✅ AI-powered waste classification
- ✅ User authentication with JWT
- ✅ Real recycling center maps
- ✅ Environmental impact tracking
- ✅ Cloud data persistence

### Without Azure (Mock Mode)
If you don't have Azure credentials yet, the system will run in mock mode:
- ✅ UI and navigation
- ✅ Local authentication
- ✅ Mock classification results
- ✅ Sample data and statistics
- ⚠️ No real AI classification
- ⚠️ No cloud data persistence

## 📱 Testing the Application

### 1. Register a New User
1. Navigate to http://localhost:3000
2. Click "Register" 
3. Create a new account
4. Login with your credentials

### 2. Test Waste Classification
1. Go to "Classify Waste" page
2. Upload a waste image (or use camera)
3. View AI classification results
4. Log the recycling activity

### 3. View Dashboard
1. Navigate to Dashboard
2. View your recycling statistics
3. Check environmental impact metrics
4. See recent activities

## 🐳 Docker Quick Start

### Run with Docker Compose
```bash
# Build and start all services
docker-compose up -d

# View logs
docker-compose logs -f

# Stop services
docker-compose down
```

### Individual Docker Services
```bash
# Backend only
cd backend
docker build -t eco-tracking-backend .
docker run -p 3001:3001 --env-file .env eco-tracking-backend

# Frontend only
cd frontend  
docker build -t eco-tracking-frontend .
docker run -p 3000:3000 --env-file .env.local eco-tracking-frontend
```

## 🧪 Running Tests

```bash
# Run all tests
npm run test

# Run specific test suites
npm run test:backend   # Backend API tests
npm run test:frontend  # Frontend component tests
npm run test:ai        # AI model tests
```

## 🔍 Troubleshooting

### Common Issues

#### 1. Port Already in Use
```bash
# Kill processes on ports 3000/3001
killall -9 node
# Or use different ports in .env files
```

#### 2. Azure Authentication Errors
- Verify Azure credentials in `.env`
- Check Azure service availability
- Ensure proper resource permissions

#### 3. Module Not Found Errors
```bash
# Reinstall dependencies
rm -rf node_modules package-lock.json
npm install
```

#### 4. Database Connection Issues
- Verify Cosmos DB endpoint and key
- Check network connectivity
- Ensure Cosmos DB service is running

### Development Tools

#### View Backend Logs
```bash
# With npm
cd backend && npm run dev

# With PM2
pm2 logs eco-tracking-backend
```

#### Frontend Development
```bash
# Hot reload with detailed logging
cd frontend && npm run dev

# Type checking
npm run type-check
```

#### API Testing
```bash
# Health check
curl http://localhost:3001/health

# Test authentication
curl -X POST http://localhost:3001/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"password123","name":"Test User"}'
```

## 📚 Next Steps

### For Development
1. Read [Development Guide](./development/README.md)
2. Check [API Documentation](./api/README.md)
3. Review [Architecture Overview](./architecture/README.md)

### For Deployment
1. Follow [Azure Deployment Guide](./deployment/azure.md)
2. Setup [CI/CD Pipeline](./deployment/cicd.md)
3. Configure [Monitoring](./deployment/monitoring.md)

### For AI Model Training
1. Setup [Custom Vision Service](../ai-model/README.md)
2. Train [Enhanced Models](../ai-model/training/README.md)
3. Deploy [TensorFlow Serving](./deployment/tensorflow.md)

## 🆘 Getting Help

- **Issues**: Open a GitHub issue
- **Documentation**: Check the `/docs` directory
- **Community**: Join our developer community
- **Support**: Contact the development team

---

**You're now ready to start developing with ECO-Tracking! 🚀♻️**