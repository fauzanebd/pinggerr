#!/bin/bash

# Strava Activity Visualizer - Local Setup Script
# This script helps you set up the local development environment

set -e

# Colors for output
CYAN='\033[96m'
GREEN='\033[92m'
YELLOW='\033[93m'
RED='\033[91m'
NC='\033[0m' # No Color

echo -e "${CYAN}🏃 Strava Activity Visualizer - Local Setup${NC}"
echo ""

# Function to ask yes/no questions
ask_yes_no() {
    while true; do
        read -p "$1 (y/n): " yn
        case $yn in
            [Yy]* ) return 0;;
            [Nn]* ) return 1;;
            * ) echo "Please answer yes or no.";;
        esac
    done
}

# Check if frontend .env.local exists
if [ ! -f "frontend/.env.local" ]; then
    echo -e "${YELLOW}📝 Setting up frontend environment variables...${NC}"
    echo ""
    
    read -p "Enter your Strava Client ID: " strava_client_id
    
    # Create .env.local file
    cat > frontend/.env.local << EOF
# Local Development Environment Variables
VITE_WORKER_URL=http://localhost:8787
VITE_STRAVA_CLIENT_ID=${strava_client_id}
VITE_STRAVA_REDIRECT_URI=http://localhost:5173/auth/callback
EOF
    
    echo -e "${GREEN}✅ Created frontend/.env.local${NC}"
else
    echo -e "${GREEN}✅ frontend/.env.local already exists${NC}"
fi

echo ""

# Set up backend secrets
echo -e "${YELLOW}🔐 Setting up backend secrets...${NC}"
echo ""

if ask_yes_no "Do you want to set up Strava secrets for the backend?"; then
    echo ""
    echo -e "${CYAN}Setting up Cloudflare Worker secrets...${NC}"
    echo "You'll be prompted to enter your Strava credentials."
    echo ""
    
    cd be-pinggerr
    
    echo "Setting STRAVA_CLIENT_ID:"
    wrangler secret put STRAVA_CLIENT_ID --local
    
    echo ""
    echo "Setting STRAVA_CLIENT_SECRET:"
    wrangler secret put STRAVA_CLIENT_SECRET --local
    
    cd ..
    
    echo ""
    echo -e "${GREEN}✅ Backend secrets configured${NC}"
fi

echo ""
echo -e "${GREEN}🎉 Local setup complete!${NC}"
echo ""
echo -e "${CYAN}Next steps:${NC}"
echo "1. Make sure your Strava app settings are correct:"
echo "   - Go to https://www.strava.com/settings/api"
echo "   - Set Authorization Callback Domain to: localhost"
echo ""
echo "2. Start the development servers:"
echo "   ${YELLOW}make dev${NC}"
echo ""
echo "3. Open your browser to:"
echo "   ${YELLOW}http://localhost:5173${NC}"
echo ""
echo -e "${CYAN}Available commands:${NC}"
echo "   ${YELLOW}make help${NC}     - Show all available commands"
echo "   ${YELLOW}make status${NC}   - Check environment status" 
echo "   ${YELLOW}make stop${NC}     - Stop development servers"
echo ""
