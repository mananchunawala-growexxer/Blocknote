# BlockNote - Deployment Fixes Summary

## Critical Issues Fixed

### 1. ✅ Database Connection Error (FIXED)
**Problem**: Connection refused when trying to access the database
- **Root Cause**: Database name mismatch - `.env` specified `Blocknote` (uppercase) but docker-compose creates `blocknote` (lowercase)
- **Solution**: Updated `.env` file to use correct database name
  ```
  DATABASE_URL=postgresql://postgres:postgres@localhost:5432/blocknote
  ```

### 2. ✅ Backend Server Not Starting (FIXED)
**Problem**: `net::ERR_CONNECTION_REFUSED` when accessing `localhost:4000/api/auth/register`
- **Root Cause**: Backend server crashed due to failed database connection on startup
- **Solution**: Fixed database connection in `.env` file
- **Verification**: Added health check endpoint at `GET /api/health`

### 3. ✅ CORS Configuration Error (FIXED)
**Problem**: CORS middleware incorrectly configured
- **Root Cause**: Origin validation logic used wrong data type - treated string as array
- **Solution**: Updated `apps/Backend/src/app.ts` to properly parse CORS origins from environment variable:
  ```typescript
  const allowedOrigins = env.CORS_ORIGIN.split(",").map((origin) => origin.trim());
  ```

### 4. ✅ Docker Compose Configuration (ENHANCED)
**Problem**: Missing service definitions for backend and frontend
- **Root Cause**: docker-compose only had PostgreSQL, no backend/frontend services
- **Solution**: 
  - Added backend service with proper dependencies
  - Added frontend service with proper dependencies
  - Configured health checks
  - Added migration command to run on startup
  - Set up volume mounts for development

### 5. ✅ Missing Dockerfiles (CREATED)
**Problem**: Dockerfiles weren't provided for containerization
- **Solution**:
  - Created `apps/Backend/Dockerfile` with proper build configuration
  - Created `apps/Frontend/Dockerfile` with Vite build setup
  - Both files properly handle workspace dependencies

## Files Modified

1. **`.env`** - Fixed database name and configured all environment variables
   - Database: `blocknote` (lowercase)
   - Backend Port: 4000
   - Frontend Port: 5173
   - API URL: `http://localhost:4000/api`

2. **`docker-compose.yml`** - Enhanced with complete service definitions
   - PostgreSQL with healthcheck
   - Backend service with migrations
   - Frontend service with proper dependencies
   - Proper port mappings and environment variables

3. **`apps/Backend/src/app.ts`** - Fixed CORS configuration
   - Properly parses origins from environment
   - Splits comma-separated origins correctly
   - Validates each origin independently

4. **`apps/Backend/Dockerfile`** - Created for containerization
5. **`apps/Frontend/Dockerfile`** - Created for containerization

## Verification Steps

Run the verification script:
```bash
chmod +x verify-deployment.sh
./verify-deployment.sh
```

Then deploy with Docker Compose:
```bash
docker-compose up
```

## Expected Behavior After Fixes

✅ **Database**: Connects successfully to PostgreSQL  
✅ **Backend**: Starts on port 4000, migrations apply automatically  
✅ **Frontend**: Starts on port 5173, connects to backend API  
✅ **Authentication**: Register and login work correctly  
✅ **CORS**: No cross-origin errors  
✅ **Health Check**: `GET http://localhost:4000/api/health` returns `{"status":"ok"}`

## API Endpoints Available

```
GET  /api/health              - Health check
POST /api/auth/register       - Create new account
POST /api/auth/login          - Login
POST /api/auth/refresh        - Refresh access token
POST /api/auth/logout         - Logout
GET  /api/documents           - List user documents
POST /api/documents           - Create new document
GET  /api/documents/:id       - Get document details
PATCH /api/documents/:id      - Rename document
DELETE /api/documents/:id     - Delete document
```

## Configuration Variables

All variables are configured in `.env`:
- `NODE_ENV`: development/production
- `PORT`: Backend port (4000)
- `DATABASE_URL`: PostgreSQL connection string
- `JWT_ACCESS_SECRET`: Access token secret (min 32 chars)
- `JWT_REFRESH_SECRET`: Refresh token secret (min 32 chars)
- `CORS_ORIGIN`: Allowed origins (comma-separated)
- `VITE_API_URL`: Frontend API URL

## Troubleshooting

### Port Already in Use
```bash
# Kill existing processes
lsof -ti :4000 | xargs kill -9
lsof -ti :5173 | xargs kill -9
lsof -ti :5432 | xargs kill -9
```

### Database Connection Issues
```bash
# Verify PostgreSQL is running
docker-compose logs postgres

# Connect to database directly
docker-compose exec postgres psql -U postgres -d blocknote
```

### Frontend Cannot Reach Backend
```bash
# Check if backend is running
curl http://localhost:4000/api/health

# Check frontend logs
docker-compose logs frontend

# Check CORS configuration
docker-compose logs backend | grep CORS
```

## Next Steps

1. Deploy using Docker Compose: `docker-compose up`
2. Access application at `http://localhost:5173`
3. Create account and test authentication flow
4. Create/edit/delete documents to verify full functionality
5. For production, update environment variables and deploy to Vercel
