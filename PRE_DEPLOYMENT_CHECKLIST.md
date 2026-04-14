# Pre-Deployment Checklist

## Quick Start (5 minutes)
- [ ] Clone/navigate to project directory
- [ ] Verify .env file exists with all required variables
- [ ] Verify docker-compose.yml has all services
- [ ] Verify Dockerfiles exist in apps/Backend and apps/Frontend
- [ ] Run `docker-compose up`
- [ ] Wait for all services to start
- [ ] Test API health: `curl http://localhost:4000/api/health`
- [ ] Open browser: `http://localhost:5173`

## Environment Variables Check
- [ ] `NODE_ENV=development`
- [ ] `PORT=4000`
- [ ] `DATABASE_URL=postgresql://postgres:postgres@localhost:5432/blocknote` (lowercase!)
- [ ] `VITE_API_URL=http://localhost:4000/api`
- [ ] JWT secrets are at least 32 characters

## Database Check  
- [ ] PostgreSQL is running on port 5432
- [ ] Database name is `blocknote` (lowercase)
- [ ] Migrations are applied
- [ ] Users table is created
- [ ] Other tables are created (documents, blocks, etc.)

## Backend Check
- [ ] Backend server starts on port 4000
- [ ] `/api/health` endpoint responds with `{"status":"ok"}`
- [ ] CORS is properly configured
- [ ] Error handler middleware is active
- [ ] Request logger middleware is active

## Frontend Check
- [ ] Frontend app loads on port 5173
- [ ] Auth page displays correctly
- [ ] Can switch between login/register modes
- [ ] Basic form validation works (email, password)

## API Functionality Check
- [ ] Register endpoint works: `POST /api/auth/register`
  - Email validation works
  - Password validation works (min 8 chars, contains number)
  - Returns accessToken and refreshToken
- [ ] Login endpoint works: `POST /api/auth/login`
  - Can login with existing credentials
  - Returns tokens
- [ ] Authentication header works: `Authorization: Bearer <token>`
- [ ] Documents endpoints require authentication
- [ ] Invalid tokens are rejected

## Common Issues & Solutions

| Issue | Solution |
|-------|----------|
| Connection refused on port 4000 | Ensure backend service is running: `docker-compose logs backend` |
| ERR_CONNECTION_REFUSED on database | Check DATABASE_URL uses lowercase `blocknote` and postgres is running |
| CORS errors | Verify CORS_ORIGIN includes frontend URL |
| 404 on API endpoints | Ensure migrations ran successfully |
| Frontend can't reach backend | Check VITE_API_URL in .env and network connectivity |
| Port already in use | Kill existing process or use different port |

## Performance Notes
- First startup takes ~1-2 minutes (migrations run)
- Subsequent startups are faster
- Hot reload enabled for both frontend and backend in development

## Cleanup
- To stop services: `docker-compose down`
- To remove all data: `docker-compose down -v`
- To rebuild images: `docker-compose build --no-cache`

## Success Criteria
✅ Frontend loads at http://localhost:5173  
✅ Can register new account  
✅ Can login with existing account  
✅ Authenticated users see dashboard  
✅ Can create/edit/delete documents  
✅ No CORS errors in browser console  
✅ Database migrations applied successfully  
