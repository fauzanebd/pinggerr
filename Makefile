# Strava Activity Visualizer - Local Development Makefile

# Color output
CYAN = \033[96m
GREEN = \033[92m
YELLOW = \033[93m
RED = \033[91m
NC = \033[0m # No Color

# Default target
.DEFAULT_GOAL := help

# Variables
FRONTEND_DIR = frontend
BACKEND_DIR = backend

.PHONY: help install dev dev-frontend dev-backend build build-frontend build-backend test lint clean stop logs setup-env check-deps

# Help target
help: ## Show this help message
	@echo "$(CYAN)Strava Activity Visualizer - Local Development$(NC)"
	@echo ""
	@echo "$(GREEN)Available targets:$(NC)"
	@awk 'BEGIN {FS = ":.*##"} /^[a-zA-Z_-]+:.*##/ { printf "  $(YELLOW)%-20s$(NC) %s\n", $$1, $$2 }' $(MAKEFILE_LIST)

# Installation targets
install: ## Install all dependencies for frontend and backend
	@echo "$(CYAN)Installing dependencies...$(NC)"
	pnpm install
	@echo "$(GREEN)✅ All dependencies installed$(NC)"

install-frontend: ## Install only frontend dependencies
	@echo "$(CYAN)Installing frontend dependencies...$(NC)"
	cd $(FRONTEND_DIR) && pnpm install
	@echo "$(GREEN)✅ Frontend dependencies installed$(NC)"

install-backend: ## Install only backend dependencies
	@echo "$(CYAN)Installing backend dependencies...$(NC)"
	cd $(BACKEND_DIR) && npm install
	@echo "$(GREEN)✅ Backend dependencies installed$(NC)"

# Development targets
dev: check-deps ## Run both frontend and backend in development mode
	@echo "$(CYAN)Starting development servers...$(NC)"
	@echo "$(YELLOW)Frontend will be available at: http://localhost:5173$(NC)"
	@echo "$(YELLOW)Backend will be available at: http://localhost:8787$(NC)"
	@echo "$(YELLOW)Press Ctrl+C to stop both servers$(NC)"
	@echo ""
	pnpm run dev

dev-frontend: ## Run only the frontend development server
	@echo "$(CYAN)Starting frontend development server...$(NC)"
	@echo "$(YELLOW)Available at: http://localhost:5173$(NC)"
	cd $(FRONTEND_DIR) && pnpm run dev

dev-backend: ## Run only the backend development server (Cloudflare Worker)
	@echo "$(CYAN)Starting backend development server...$(NC)"
	@echo "$(YELLOW)Available at: http://localhost:8787$(NC)"
	@echo "$(YELLOW)Make sure to set your Strava secrets first:$(NC)"
	@echo "  wrangler secret put STRAVA_CLIENT_ID"
	@echo "  wrangler secret put STRAVA_CLIENT_SECRET"
	cd $(BACKEND_DIR) && wrangler dev

# Build targets
build: build-frontend build-backend ## Build both frontend and backend for production

build-frontend: ## Build frontend for production
	@echo "$(CYAN)Building frontend...$(NC)"
	cd $(FRONTEND_DIR) && pnpm run build
	@echo "$(GREEN)✅ Frontend built successfully$(NC)"

build-backend: ## Build backend for production
	@echo "$(CYAN)Building backend...$(NC)"
	cd $(BACKEND_DIR) && wrangler deploy --dry-run
	@echo "$(GREEN)✅ Backend ready for deployment$(NC)"

# Preview targets
preview: build-frontend ## Preview the built frontend
	@echo "$(CYAN)Starting preview server...$(NC)"
	@echo "$(YELLOW)Available at: http://localhost:4173$(NC)"
	cd $(FRONTEND_DIR) && pnpm run preview

# Testing targets
test: ## Run all tests
	@echo "$(CYAN)Running tests...$(NC)"
	cd $(BACKEND_DIR) && npm run test

test-backend: ## Run backend tests only
	@echo "$(CYAN)Running backend tests...$(NC)"
	cd $(BACKEND_DIR) && npm run test

# Linting targets
lint: ## Run linting for frontend
	@echo "$(CYAN)Running linter...$(NC)"
	cd $(FRONTEND_DIR) && pnpm run lint

lint-fix: ## Run linting with auto-fix for frontend
	@echo "$(CYAN)Running linter with auto-fix...$(NC)"
	cd $(FRONTEND_DIR) && pnpm run lint --fix

# Environment setup
setup-env: ## Set up local environment and Strava secrets
	@echo "$(CYAN)Setting up local environment...$(NC)"
	@echo ""
	@echo "$(YELLOW)You need to set up your Strava app credentials:$(NC)"
	@echo "1. Go to https://www.strava.com/settings/api"
	@echo "2. Create a new app if you haven't already"
	@echo "3. Set Authorization Callback Domain to: localhost"
	@echo "4. Note your Client ID and Client Secret"
	@echo ""
	@echo "$(YELLOW)Set the secrets for local development:$(NC)"
	@echo "Run these commands and enter your Strava credentials when prompted:"
	@echo "  cd $(BACKEND_DIR) && wrangler secret put STRAVA_CLIENT_ID"
	@echo "  cd $(BACKEND_DIR) && wrangler secret put STRAVA_CLIENT_SECRET"
	@echo ""
	@echo "$(YELLOW)Update frontend config:$(NC)"
	@echo "Make sure $(FRONTEND_DIR)/src/config/env.ts has:"
	@echo "  workerUrl: 'http://localhost:8787'"
	@echo "  strava.clientId: 'YOUR_STRAVA_CLIENT_ID'"
	@echo "  strava.redirectUri: 'http://localhost:5173/auth/callback'"

set-strava-secrets: ## Interactive setup for Strava secrets
	@echo "$(CYAN)Setting up Strava secrets...$(NC)"
	@read -p "Enter your Strava Client ID: " client_id; \
	echo "$$client_id" | wrangler secret put STRAVA_CLIENT_ID --local
	@read -p "Enter your Strava Client Secret: " client_secret; \
	echo "$$client_secret" | wrangler secret put STRAVA_CLIENT_SECRET --local

# Utility targets
clean: ## Clean build artifacts and node_modules
	@echo "$(CYAN)Cleaning build artifacts...$(NC)"
	rm -rf $(FRONTEND_DIR)/dist
	rm -rf $(FRONTEND_DIR)/node_modules
	rm -rf $(BACKEND_DIR)/node_modules
	rm -rf node_modules
	@echo "$(GREEN)✅ Cleaned successfully$(NC)"

stop: ## Stop all running development servers
	@echo "$(CYAN)Stopping development servers...$(NC)"
	@pkill -f "vite" || true
	@pkill -f "wrangler dev" || true
	@pkill -f "concurrently" || true
	@echo "$(GREEN)✅ All servers stopped$(NC)"

logs: ## Show logs for development servers
	@echo "$(CYAN)Development server logs:$(NC)"
	@echo "$(YELLOW)Frontend logs:$(NC)"
	@ps aux | grep vite | grep -v grep || echo "Frontend not running"
	@echo "$(YELLOW)Backend logs:$(NC)"
	@ps aux | grep "wrangler dev" | grep -v grep || echo "Backend not running"

# Dependency checking
check-deps: ## Check if required dependencies are installed
	@echo "$(CYAN)Checking dependencies...$(NC)"
	@command -v node >/dev/null 2>&1 || { echo "$(RED)❌ Node.js is required but not installed$(NC)"; exit 1; }
	@command -v pnpm >/dev/null 2>&1 || { echo "$(RED)❌ pnpm is required but not installed$(NC)"; exit 1; }
	@command -v wrangler >/dev/null 2>&1 || { echo "$(RED)❌ wrangler is required but not installed. Run: npm install -g wrangler$(NC)"; exit 1; }
	@test -d $(FRONTEND_DIR)/node_modules || { echo "$(YELLOW)⚠️  Frontend dependencies not installed. Run: make install$(NC)"; }
	@test -d $(BACKEND_DIR)/node_modules || { echo "$(YELLOW)⚠️  Backend dependencies not installed. Run: make install$(NC)"; }
	@echo "$(GREEN)✅ Dependencies check completed$(NC)"

# Development workflow shortcuts
fresh-start: clean install dev ## Clean everything, install dependencies, and start development

quick-test: build test ## Quick build and test

# Production deployment
deploy: build ## Deploy to production (Cloudflare)
	@echo "$(CYAN)Deploying to production...$(NC)"
	@echo "$(YELLOW)Make sure you have set production secrets:$(NC)"
	@echo "  wrangler secret put STRAVA_CLIENT_ID"
	@echo "  wrangler secret put STRAVA_CLIENT_SECRET"
	./deploy.sh

# Status check
status: ## Check the status of local development environment
	@echo "$(CYAN)Development Environment Status:$(NC)"
	@echo ""
	@echo "$(YELLOW)Node.js version:$(NC)"
	@node --version || echo "$(RED)Not installed$(NC)"
	@echo "$(YELLOW)pnpm version:$(NC)"
	@pnpm --version || echo "$(RED)Not installed$(NC)"
	@echo "$(YELLOW)wrangler version:$(NC)"
	@wrangler --version || echo "$(RED)Not installed$(NC)"
	@echo ""
	@echo "$(YELLOW)Frontend dependencies:$(NC)"
	@test -d $(FRONTEND_DIR)/node_modules && echo "$(GREEN)✅ Installed$(NC)" || echo "$(RED)❌ Not installed$(NC)"
	@echo "$(YELLOW)Backend dependencies:$(NC)"
	@test -d $(BACKEND_DIR)/node_modules && echo "$(GREEN)✅ Installed$(NC)" || echo "$(RED)❌ Not installed$(NC)"
	@echo ""
	@echo "$(YELLOW)Running processes:$(NC)"
	@ps aux | grep -E "(vite|wrangler dev)" | grep -v grep || echo "No development servers running"
