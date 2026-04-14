# BlockNote - Local Development & Deployment Guide

## Prerequisites
- Docker & Docker Compose
- Node.js 22+
- npm or yarn

## Environment Variables
All environment variables are configured in `.env` file at the project root.

### Database
- **Database Name**: `blocknote` (lowercase - IMPORTANT)
- **Connection String**: `postgresql://postgres:postgres@localhost:5432/blocknote`

### Backend
- **Port**: 4000
- **Health Check**: `GET /api/health`

### Frontend  
- **Port**: 5173
- **API Base URL**: `http://localhost:4000/api`

## Local Development Setup

### Option 1: Using Docker Compose (Recommended)
```bash
# Start all services (Database, Backend, Frontend)
docker-compose up

# Migrate database (automatically runs on startup)
# Or manually:
docker-compose exec backend npm run migrate

# Access:
# - Frontend: http://localhost:5173
# - Backend: http://localhost:4000
# - Database: localhost:5432
```

### Option 2: Manual Setup
```bash
# Terminal 1: Start PostgreSQL
docker-compose up postgres

# Terminal 2: Install dependencies and run backend
cd apps/Backend
npm install
npm run migrate  # Run migrations first
npm run dev      # Start development server

# Terminal 3: Install dependencies and run frontend  
cd apps/Frontend
npm install
npm run dev      # Start dev server
```

## Authentication Flow

### Register
```bash
POST /api/auth/register
Content-Type: application/json

{
  "email": "user@example.com",
  "password": "securepassword"
}

Response:
{
  "user": { "id": "...", "email": "..." },
  "accessToken": "...",
  "refreshToken": "..."
}
```

### Login
```bash
POST /api/auth/login
Content-Type: application/json

{
  "email": "user@example.com",
  "password": "securepassword"
}
```

### Using Access Token
```bash
Authorization: Bearer <accessToken>
```

## Troubleshooting

### Connection Refused Error
- Ensure PostgreSQL is running and accessible
- Check DATABASE_URL in .env points to correct database name (lowercase `blocknote`)
- Verify port 5432 is not blocked

### 404 Errors on API Endpoints
- Ensure backend is running on port 4000
- Check that migrations have been applied
- Verify CORS_ORIGIN includes your frontend URL

### Frontend Cannot Reach Backend
- Verify VITE_API_URL environment variable
- Check CORS_ORIGIN configuration in backend
- Ensure ports 4000 and 5173 are accessible

## Key Fixes Applied

1. ✅ Database name corrected to lowercase `blocknote`
2. ✅ CORS configuration updated to properly parse origins from env
3. ✅ Docker Compose updated with proper service definitions
4. ✅ Health check endpoint configured
5. ✅ Error handling middleware properly configured
