#!/bin/bash

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${YELLOW}=== BlockNote Deployment Verification ===${NC}\n"

# Check if Docker is running
echo -e "${YELLOW}1. Checking Docker...${NC}"
if command -v docker &> /dev/null; then
    echo -e "${GREEN}✓ Docker is installed${NC}"
else
    echo -e "${RED}✗ Docker is not installed${NC}"
    exit 1
fi

# Check if Docker daemon is running
if docker ps &> /dev/null; then
    echo -e "${GREEN}✓ Docker daemon is running${NC}"
else
    echo -e "${RED}✗ Docker daemon is not running${NC}"
    exit 1
fi

# Check environment file
echo -e "\n${YELLOW}2. Checking environment configuration...${NC}"
if [ -f .env ]; then
    echo -e "${GREEN}✓ .env file exists${NC}"
    if grep -q "blocknote" .env; then
        echo -e "${GREEN}✓ Database name is correct (blocknote)${NC}"
    else
        echo -e "${RED}✗ Database name is incorrect in .env${NC}"
    fi
else
    echo -e "${RED}✗ .env file not found${NC}"
fi

# Check docker-compose
echo -e "\n${YELLOW}3. Checking docker-compose configuration...${NC}"
if [ -f docker-compose.yml ]; then
    echo -e "${GREEN}✓ docker-compose.yml exists${NC}"
    if grep -q "healthcheck" docker-compose.yml; then
        echo -e "${GREEN}✓ Healthcheck configured${NC}"
    else
        echo -e "${YELLOW}⚠ Healthcheck not configured${NC}"
    fi
else
    echo -e "${RED}✗ docker-compose.yml not found${NC}"
fi

# Check Dockerfiles
echo -e "\n${YELLOW}4. Checking Dockerfiles...${NC}"
if [ -f apps/Backend/Dockerfile ]; then
    echo -e "${GREEN}✓ Backend Dockerfile exists${NC}"
else
    echo -e "${RED}✗ Backend Dockerfile not found${NC}"
fi

if [ -f apps/Frontend/Dockerfile ]; then
    echo -e "${GREEN}✓ Frontend Dockerfile exists${NC}"
else
    echo -e "${RED}✗ Frontend Dockerfile not found${NC}"
fi

# Check port availability
echo -e "\n${YELLOW}5. Checking port availability...${NC}"
if ! lsof -Pi :4000 -sTCP:LISTEN -t >/dev/null 2>&1; then
    echo -e "${GREEN}✓ Port 4000 is available${NC}"
else
    echo -e "${RED}✗ Port 4000 is already in use${NC}"
fi

if ! lsof -Pi :5173 -sTCP:LISTEN -t >/dev/null 2>&1; then
    echo -e "${GREEN}✓ Port 5173 is available${NC}"
else
    echo -e "${RED}✗ Port 5173 is already in use${NC}"
fi

if ! lsof -Pi :5432 -sTCP:LISTEN -t >/dev/null 2>&1; then
    echo -e "${GREEN}✓ Port 5432 is available${NC}"
else
    echo -e "${YELLOW}⚠ Port 5432 is in use (PostgreSQL might already be running)${NC}"
fi

# Check node modules
echo -e "\n${YELLOW}6. Checking dependencies...${NC}"
if [ -d "node_modules" ]; then
    echo -e "${GREEN}✓ Root dependencies installed${NC}"
else
    echo -e "${YELLOW}⚠ Root dependencies not installed (will be installed in Docker)${NC}"
fi

echo -e "\n${GREEN}=== Verification Complete ===${NC}"
echo -e "\n${YELLOW}Next steps:${NC}"
echo "1. Run: docker-compose up"
echo "2. Wait for all services to start (< 1 minute)"
echo "3. Access frontend: http://localhost:5173"
echo "4. Access backend API: http://localhost:4000/api/health"
echo "\n${YELLOW}To troubleshoot:${NC}"
echo "- View backend logs: docker-compose logs backend"
echo "- View frontend logs: docker-compose logs frontend"
echo "- View database logs: docker-compose logs postgres"
echo "- Access database: docker-compose exec postgres psql -U postgres -d blocknote"
