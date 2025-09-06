#!/bin/bash

# Strava Activity Visualizer Deployment Script
# This script deploys both frontend (Cloudflare Pages) and backend (Cloudflare Workers)

set -e

echo "🚀 Starting deployment for Strava Activity Visualizer..."

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check if required tools are installed
check_dependencies() {
    print_status "Checking dependencies..."
    
    if ! command -v pnpm &> /dev/null; then
        print_error "pnpm is not installed. Please install pnpm first."
        exit 1
    fi
    
    if ! command -v npm &> /dev/null; then
        print_error "npm is not installed. Please install npm first."
        exit 1
    fi
    
    if ! command -v wrangler &> /dev/null; then
        print_warning "Wrangler CLI not found. Installing..."
        npm install -g wrangler
    fi
    
    print_success "Dependencies check complete."
}

# Deploy backend (Cloudflare Worker)
deploy_backend() {
    print_status "Deploying backend (Cloudflare Worker)..."
    
    cd be-pinggerr
    
    # Install dependencies
    print_status "Installing backend dependencies..."
    npm install
    
    # Check if secrets are set
    print_warning "Make sure you have set the following secrets:"
    echo "  - STRAVA_CLIENT_ID"
    echo "  - STRAVA_CLIENT_SECRET"
    echo ""
    echo "Set them with:"
    echo "  wrangler secret put STRAVA_CLIENT_ID"
    echo "  wrangler secret put STRAVA_CLIENT_SECRET"
    echo ""
    
    read -p "Have you set the required secrets? (y/N): " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        print_error "Please set the required secrets before deploying."
        exit 1
    fi
    
    # Deploy worker
    print_status "Deploying Cloudflare Worker..."
    npm run deploy
    
    print_success "Backend deployed successfully!"
    
    cd ..
}

# Deploy frontend (Cloudflare Pages)
deploy_frontend() {
    print_status "Deploying frontend (Cloudflare Pages)..."
    
    cd frontend
    
    # Install dependencies
    print_status "Installing frontend dependencies..."
    pnpm install
    
    # Build the project
    print_status "Building frontend..."
    pnpm run build
    
    # Check if wrangler pages is configured
    print_status "Deploying to Cloudflare Pages..."
    
    # Try to deploy with wrangler pages
    if wrangler pages deploy dist --project-name strava-activity-visualizer; then
        print_success "Frontend deployed to Cloudflare Pages!"
    else
        print_warning "Direct deployment failed. Please deploy manually:"
        echo "1. Go to Cloudflare Dashboard > Pages"
        echo "2. Connect your GitHub repository"
        echo "3. Set build command: 'pnpm run build'"
        echo "4. Set build output directory: 'dist'"
        echo "5. Add environment variables:"
        echo "   - VITE_WORKER_URL: Your worker URL"
        echo "   - VITE_STRAVA_CLIENT_ID: Your Strava Client ID"
        echo "   - VITE_STRAVA_REDIRECT_URI: Your Pages domain + /auth/callback"
    fi
    
    cd ..
}

# Main deployment function
main() {
    check_dependencies
    
    echo ""
    print_status "What would you like to deploy?"
    echo "1. Backend only (Cloudflare Worker)"
    echo "2. Frontend only (Cloudflare Pages)"
    echo "3. Both (recommended)"
    echo ""
    read -p "Enter your choice (1-3): " -n 1 -r
    echo ""
    
    case $REPLY in
        1)
            deploy_backend
            ;;
        2)
            deploy_frontend
            ;;
        3)
            deploy_backend
            echo ""
            deploy_frontend
            ;;
        *)
            print_error "Invalid choice. Please run the script again."
            exit 1
            ;;
    esac
    
    echo ""
    print_success "🎉 Deployment complete!"
    echo ""
    print_status "Next steps:"
    echo "1. Update your Strava app settings:"
    echo "   - Authorization Callback Domain: your-pages-domain.pages.dev"
    echo "   - Redirect URI: https://your-pages-domain.pages.dev/auth/callback"
    echo "2. Update frontend environment variables with production URLs"
    echo "3. Test the complete OAuth flow"
    echo ""
    print_status "Happy running! 🏃‍♂️💪"
}

# Run main function
main
