#!/usr/bin/env bash
# ==============================================================================
# Shuttle Tracking System - One-Click Production Deployment Script
# ==============================================================================
set -e

GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

echo -e "${BLUE}======================================================${NC}"
echo -e "${BLUE}   🚐 Shuttle Tracking System - Production Deploy     ${NC}"
echo -e "${BLUE}======================================================${NC}"

# 1. Check Docker & Docker Compose
echo -e "\n${YELLOW}[1/4] Checking prerequisites...${NC}"
if ! command -v docker &> /dev/null; then
    echo -e "${RED}Error: docker is not installed. Please install Docker first.${NC}"
    exit 1
fi

if ! docker compose version &> /dev/null; then
    echo -e "${RED}Error: docker compose v2 is not installed.${NC}"
    exit 1
fi
echo -e "${GREEN}✓ Docker & Docker Compose detected.${NC}"

# 2. Setup Environment Variables
echo -e "\n${YELLOW}[2/4] Verifying environment configuration...${NC}"
if [ ! -f .env ]; then
    echo -e "${YELLOW}Creating .env from .env.example with secure auto-generated secrets...${NC}"
    cp .env.example .env

    # Generate random passwords if openssl is available
    if command -v openssl &> /dev/null; then
        PG_PASS=$(openssl rand -hex 16)
        JWT_SEC=$(openssl rand -hex 32)
        sed -i.bak "s/shuttle_secret_dev/${PG_PASS}/g" .env
        sed -i.bak "s/shuttle_jwt_super_secret_key_2026/${JWT_SEC}/g" .env
        rm -f .env.bak
        echo -e "${GREEN}✓ Generated secure random POSTGRES_PASSWORD & JWT_SECRET in .env${NC}"
    else
        echo -e "${YELLOW}Notice: openssl not found, using default secrets in .env (recommended to update manually).${NC}"
    fi
else
    echo -e "${GREEN}✓ Existing .env file found.${NC}"
fi

# 3. Build and Launch Containers
echo -e "\n${YELLOW}[3/4] Building and launching containers with Docker Compose...${NC}"
docker compose up -d --build

# 4. Verification and Healthchecks
echo -e "\n${YELLOW}[4/4] Verifying service statuses...${NC}"
sleep 5

docker compose ps

echo -e "\n${GREEN}======================================================${NC}"
echo -e "${GREEN}   🎉 Deployment Complete! Service Endpoints:        ${NC}"
echo -e "${GREEN}======================================================${NC}"
echo -e "  🌐 Public Live Map:   http://localhost:3001"
echo -e "  🔐 Admin Portal:      http://localhost:3001/admin"
echo -e "  ⚡ Backend REST API:  http://localhost:3000/api/v1"
echo -e "  📡 Mosquitto MQTT:    mqtt://localhost:1883"
echo -e "------------------------------------------------------"
echo -e "Default Admin: admin@example.com / admin123456"
echo -e "Default Viewer: viewer@example.com / viewer123456"
echo -e "\nTo test live telemetry simulator:"
echo -e "  node tools/gps-simulator.js --count 2 --protocol mqtt --broker mqtt://localhost:1883\n"
