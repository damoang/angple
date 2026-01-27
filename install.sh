#!/bin/bash
#
# Angple Self-Host Installation Script
# https://angple.com
#
# Usage:
#   curl -fsSL https://install.angple.com | bash
#   or
#   bash install.sh
#
# Environment Variables:
#   ANGPLE_DOMAIN     - Domain for your site (default: localhost)
#   ANGPLE_VERSION    - Version to install (default: latest)
#   ANGPLE_DIR        - Installation directory (default: ./angple)

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Default values
ANGPLE_VERSION="${ANGPLE_VERSION:-latest}"
ANGPLE_DIR="${ANGPLE_DIR:-./angple}"
ANGPLE_DOMAIN="${ANGPLE_DOMAIN:-localhost}"
GITHUB_REPO="angple/angple"

# Print functions
print_banner() {
    echo -e "${BLUE}"
    echo "    _                    _      "
    echo "   / \   _ __   __ _ _ __ | | ___ "
    echo "  / _ \ | '_ \ / _\` | '_ \| |/ _ \\"
    echo " / ___ \| | | | (_| | |_) | |  __/"
    echo "/_/   \_\_| |_|\__, | .__/|_|\___|"
    echo "               |___/|_|           "
    echo -e "${NC}"
    echo "Angple Self-Host Installation Script"
    echo "======================================"
    echo ""
}

print_step() {
    echo -e "${BLUE}==>${NC} $1"
}

print_success() {
    echo -e "${GREEN}✓${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}!${NC} $1"
}

print_error() {
    echo -e "${RED}✗${NC} $1"
}

# Check system requirements
check_requirements() {
    print_step "Checking system requirements..."

    # Check for root/sudo
    if [ "$EUID" -eq 0 ]; then
        print_warning "Running as root. This is not recommended for production."
    fi

    # Check Docker
    if ! command -v docker &> /dev/null; then
        print_error "Docker is not installed."
        echo ""
        echo "Please install Docker first:"
        echo "  curl -fsSL https://get.docker.com | sh"
        echo ""
        exit 1
    fi
    print_success "Docker found: $(docker --version)"

    # Check Docker Compose
    if ! docker compose version &> /dev/null; then
        if ! command -v docker-compose &> /dev/null; then
            print_error "Docker Compose is not installed."
            echo ""
            echo "Please install Docker Compose:"
            echo "  https://docs.docker.com/compose/install/"
            echo ""
            exit 1
        fi
    fi
    print_success "Docker Compose found"

    # Check if Docker daemon is running
    if ! docker info &> /dev/null; then
        print_error "Docker daemon is not running."
        echo ""
        echo "Please start Docker:"
        echo "  sudo systemctl start docker"
        echo ""
        exit 1
    fi
    print_success "Docker daemon is running"

    # Check available disk space (minimum 2GB)
    available_space=$(df -P "$PWD" | awk 'NR==2 {print $4}')
    if [ "$available_space" -lt 2097152 ]; then
        print_warning "Less than 2GB disk space available. Installation may fail."
    else
        print_success "Sufficient disk space available"
    fi

    echo ""
}

# Get user configuration
get_configuration() {
    print_step "Configuration..."
    echo ""

    # Domain
    if [ "$ANGPLE_DOMAIN" = "localhost" ]; then
        read -p "Enter your domain (leave empty for localhost): " user_domain
        if [ -n "$user_domain" ]; then
            ANGPLE_DOMAIN="$user_domain"
        fi
    fi
    echo "  Domain: $ANGPLE_DOMAIN"

    # Generate random passwords
    DB_PASSWORD=$(openssl rand -base64 32 | tr -dc 'a-zA-Z0-9' | head -c 32)
    DB_ROOT_PASSWORD=$(openssl rand -base64 32 | tr -dc 'a-zA-Z0-9' | head -c 32)
    JWT_SECRET=$(openssl rand -base64 64 | tr -dc 'a-zA-Z0-9' | head -c 64)

    echo ""
}

# Download Angple
download_angple() {
    print_step "Downloading Angple..."

    if [ -d "$ANGPLE_DIR" ]; then
        print_warning "Directory $ANGPLE_DIR already exists."
        read -p "Do you want to overwrite? (y/N): " confirm
        if [ "$confirm" != "y" ] && [ "$confirm" != "Y" ]; then
            print_error "Installation cancelled."
            exit 1
        fi
        rm -rf "$ANGPLE_DIR"
    fi

    # Clone repository
    if [ "$ANGPLE_VERSION" = "latest" ]; then
        git clone --depth 1 "https://github.com/$GITHUB_REPO.git" "$ANGPLE_DIR"
    else
        git clone --depth 1 --branch "$ANGPLE_VERSION" "https://github.com/$GITHUB_REPO.git" "$ANGPLE_DIR"
    fi

    print_success "Downloaded Angple to $ANGPLE_DIR"
    echo ""
}

# Create environment configuration
create_env() {
    print_step "Creating environment configuration..."

    cd "$ANGPLE_DIR"

    cat > .env << EOF
# Angple Configuration
# Generated on $(date)

# Domain Configuration
DOMAIN=${ANGPLE_DOMAIN}
PROTOCOL=http

# Database
DB_HOST=mysql
DB_PORT=3306
DB_NAME=angple
DB_USER=angple
DB_PASSWORD=${DB_PASSWORD}
DB_ROOT_PASSWORD=${DB_ROOT_PASSWORD}

# Redis
REDIS_HOST=redis
REDIS_PORT=6379

# JWT
JWT_SECRET=${JWT_SECRET}

# Email (configure for password reset)
# EMAIL_PROVIDER=smtp
# SMTP_HOST=smtp.example.com
# SMTP_PORT=587
# SMTP_USER=
# SMTP_PASSWORD=
# EMAIL_FROM=noreply@${ANGPLE_DOMAIN}

# Storage
STORAGE_TYPE=local
STORAGE_PATH=/data/uploads

# Feature Flags
ENABLE_REGISTRATION=true
ENABLE_OAUTH=false
EOF

    chmod 600 .env

    print_success "Created .env configuration"
    echo ""
}

# Start services
start_services() {
    print_step "Starting Angple services..."

    cd "$ANGPLE_DIR"

    # Pull images first
    docker compose pull

    # Start services
    docker compose up -d

    print_success "Services started"
    echo ""
}

# Wait for services to be ready
wait_for_services() {
    print_step "Waiting for services to be ready..."

    local max_attempts=60
    local attempt=0

    while [ $attempt -lt $max_attempts ]; do
        if curl -sf "http://localhost:3010/health" > /dev/null 2>&1; then
            print_success "Web service is ready"
            break
        fi
        attempt=$((attempt + 1))
        echo -n "."
        sleep 2
    done

    if [ $attempt -eq $max_attempts ]; then
        print_warning "Services took longer than expected. Check logs with: docker compose logs"
    fi

    echo ""
}

# Print success message
print_complete() {
    echo ""
    echo -e "${GREEN}======================================"
    echo "Installation Complete!"
    echo "======================================${NC}"
    echo ""
    echo "Your Angple site is ready at:"
    echo ""
    if [ "$ANGPLE_DOMAIN" = "localhost" ]; then
        echo "  Web:   http://localhost:3010"
        echo "  Admin: http://localhost:3011"
    else
        echo "  Web:   http://${ANGPLE_DOMAIN}"
        echo "  Admin: http://admin.${ANGPLE_DOMAIN}"
    fi
    echo ""
    echo "Next steps:"
    echo ""
    echo "  1. Visit http://${ANGPLE_DOMAIN}/install to complete setup"
    echo "  2. Configure your web server (nginx/Apache) for production"
    echo "  3. Enable HTTPS with Let's Encrypt"
    echo ""
    echo "Useful commands:"
    echo ""
    echo "  cd ${ANGPLE_DIR}"
    echo "  docker compose logs -f          # View logs"
    echo "  docker compose restart          # Restart services"
    echo "  docker compose down             # Stop services"
    echo "  docker compose up -d            # Start services"
    echo ""
    echo "Documentation: https://docs.angple.com"
    echo "Support: https://github.com/angple/angple/issues"
    echo ""
}

# Cleanup on error
cleanup_on_error() {
    print_error "Installation failed. Cleaning up..."
    if [ -d "$ANGPLE_DIR" ]; then
        cd "$ANGPLE_DIR" 2>/dev/null && docker compose down 2>/dev/null
    fi
}

# Main installation flow
main() {
    trap cleanup_on_error ERR

    print_banner
    check_requirements
    get_configuration
    download_angple
    create_env
    start_services
    wait_for_services
    print_complete
}

# Run installation
main "$@"
