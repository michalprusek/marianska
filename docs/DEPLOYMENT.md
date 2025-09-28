# Deployment Guide

## Prerequisites

### System Requirements
- **Node.js**: 18.x or higher
- **npm**: 9.x or higher
- **Docker**: 20.x or higher (for containerized deployment)
- **Git**: For version control
- **Storage**: Minimum 1GB free space
- **RAM**: Minimum 512MB available

### Network Requirements
- **Ports**: 3000 (app), 80/443 (web)
- **Domain**: Optional but recommended
- **SSL**: Required for production

## Installation

### 1. Clone Repository

```bash
# Clone the repository
git clone https://github.com/your-org/marianska.git
cd marianska

# Check current branch
git branch
# Should show: * main
```

### 2. Install Dependencies

```bash
# Install Node.js dependencies
npm install

# Verify installation
npm list --depth=0
```

### 3. Environment Setup

Create `.env` file for environment variables:

```bash
# .env
NODE_ENV=production
PORT=3000
DATA_DIR=./data
ADMIN_PASSWORD=your_secure_password_here
```

### 4. Data Directory Setup

```bash
# Create data directory
mkdir -p data

# Set proper permissions
chmod 755 data

# Initialize with default data
cp data.example.json data/bookings.json
```

## Deployment Methods

## 🐳 Method 1: Docker Deployment (Recommended)

### Quick Start

```bash
# Build and start containers
docker-compose up --build -d

# Verify containers are running
docker ps

# Check logs
docker-compose logs -f

# Access application
open http://localhost:3000
```

### Docker Configuration

**docker-compose.yml:**
```yaml
version: '3.8'

services:
  app:
    build: .
    ports:
      - "3000:3000"
    volumes:
      - ./data:/app/data
    environment:
      - NODE_ENV=production
      - PORT=3000
    restart: unless-stopped
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:3000/health"]
      interval: 30s
      timeout: 10s
      retries: 3

  nginx:
    image: nginx:alpine
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./nginx.conf:/etc/nginx/nginx.conf
      - ./ssl:/etc/nginx/ssl
    depends_on:
      - app
    restart: unless-stopped
```

### Container Management

```bash
# Stop containers
docker-compose down

# Restart containers
docker-compose restart

# Update application
git pull origin main
docker-compose down
docker-compose up --build -d

# View logs
docker-compose logs app
docker-compose logs nginx

# Enter container shell
docker exec -it marianska_app_1 sh

# Backup data
docker cp marianska_app_1:/app/data/bookings.json ./backup/
```

## 🖥️ Method 2: Manual Deployment

### Local Development

```bash
# Start development server with auto-reload
npm run dev

# Access at http://localhost:3000
```

### Production Server

```bash
# Start production server
npm start

# Or use PM2 for process management
npm install -g pm2
pm2 start server.js --name marianska
pm2 save
pm2 startup
```

### SystemD Service (Linux)

Create `/etc/systemd/system/marianska.service`:

```ini
[Unit]
Description=Marianska Reservation System
After=network.target

[Service]
Type=simple
User=www-data
WorkingDirectory=/var/www/marianska
ExecStart=/usr/bin/node server.js
Restart=on-failure
Environment=NODE_ENV=production

[Install]
WantedBy=multi-user.target
```

Enable and start:
```bash
sudo systemctl enable marianska
sudo systemctl start marianska
sudo systemctl status marianska
```

## 🌐 Method 3: Cloud Deployment

### Heroku

```bash
# Install Heroku CLI
# Create Heroku app
heroku create marianska-app

# Deploy
git push heroku main

# Set environment variables
heroku config:set NODE_ENV=production
heroku config:set ADMIN_PASSWORD=secure_password

# Check logs
heroku logs --tail
```

### AWS EC2

```bash
# SSH to EC2 instance
ssh -i key.pem ec2-user@your-instance.amazonaws.com

# Install Node.js
curl -sL https://rpm.nodesource.com/setup_18.x | sudo bash -
sudo yum install nodejs

# Clone and setup
git clone https://github.com/your-org/marianska.git
cd marianska
npm install

# Use PM2
npm install -g pm2
pm2 start server.js
pm2 startup
pm2 save
```

### DigitalOcean App Platform

```yaml
# app.yaml
name: marianska
services:
- name: web
  github:
    repo: your-org/marianska
    branch: main
  build_command: npm install
  run_command: npm start
  environment_slug: node-js
  instance_size_slug: basic-xxs
  instance_count: 1
  http_port: 3000
  routes:
  - path: /
```

## 🔒 SSL/HTTPS Configuration

### Using Let's Encrypt with Certbot

```bash
# Install Certbot
sudo apt-get update
sudo apt-get install certbot python3-certbot-nginx

# Obtain certificate
sudo certbot --nginx -d yourdomain.com

# Auto-renewal
sudo certbot renew --dry-run
```

### Nginx SSL Configuration

```nginx
server {
    listen 443 ssl http2;
    server_name yourdomain.com;

    ssl_certificate /etc/letsencrypt/live/yourdomain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/yourdomain.com/privkey.pem;

    # Security headers
    add_header Strict-Transport-Security "max-age=31536000" always;
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;

    location / {
        proxy_pass http://localhost:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}

server {
    listen 80;
    server_name yourdomain.com;
    return 301 https://$server_name$request_uri;
}
```

## 🔧 Configuration

### Application Settings

Edit `data/bookings.json` to configure:

```json
{
  "settings": {
    "adminPassword": "change_this_password",
    "christmasPeriod": {
      "start": "2024-12-23",
      "end": "2025-01-02"
    },
    "christmasAccessCodes": ["XMAS2024"],
    "prices": {
      "utia": {
        "small": { "base": 300, "adult": 50, "child": 25 },
        "large": { "base": 400, "adult": 50, "child": 25 }
      },
      "external": {
        "small": { "base": 500, "adult": 100, "child": 50 },
        "large": { "base": 600, "adult": 100, "child": 50 }
      }
    }
  }
}
```

### Performance Tuning

```javascript
// server.js optimizations
app.use(compression()); // Enable gzip

// Set cache headers
app.use(express.static('public', {
  maxAge: '1y',
  etag: false
}));

// Increase payload limit if needed
app.use(express.json({ limit: '10mb' }));
```

## 📊 Monitoring

### Health Check Endpoint

Add to `server.js`:
```javascript
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    uptime: process.uptime(),
    timestamp: Date.now(),
    environment: process.env.NODE_ENV
  });
});
```

### Logging Setup

```bash
# Create logs directory
mkdir -p logs

# Configure logging in PM2
pm2 start server.js --name marianska \
  --log logs/app.log \
  --error logs/error.log \
  --time
```

### Monitoring Tools

```bash
# PM2 Monitoring
pm2 monit

# Docker stats
docker stats

# System resources
htop

# Network connections
netstat -tlpn
```

## 🔄 Updates & Maintenance

### Update Procedure

```bash
# 1. Backup current data
cp -r data/ backup/data_$(date +%Y%m%d)/

# 2. Pull latest code
git pull origin main

# 3. Install new dependencies
npm install

# 4. Run any migrations
# npm run migrate (if applicable)

# 5. Restart application
docker-compose down && docker-compose up --build -d
# OR
pm2 restart marianska
```

### Backup Strategy

**Automated Daily Backup:**
```bash
#!/bin/bash
# backup.sh
BACKUP_DIR="/backups/marianska"
DATE=$(date +%Y%m%d_%H%M%S)

mkdir -p $BACKUP_DIR
cp data/bookings.json "$BACKUP_DIR/bookings_$DATE.json"

# Keep only last 30 days
find $BACKUP_DIR -name "*.json" -mtime +30 -delete

# Add to crontab
# 0 2 * * * /path/to/backup.sh
```

### Database Migration

If migrating from file to database:

```bash
# Export current data
node scripts/export-to-db.js

# Verify migration
node scripts/verify-migration.js

# Switch to database mode
export USE_DATABASE=true
pm2 restart marianska
```

## 🚨 Troubleshooting

### Common Issues

#### Port Already in Use
```bash
# Find process using port 3000
lsof -i :3000

# Kill process
kill -9 <PID>
```

#### Permission Denied
```bash
# Fix data directory permissions
sudo chown -R $USER:$USER data/
chmod 755 data/
```

#### Docker Container Won't Start
```bash
# Check logs
docker-compose logs app

# Rebuild from scratch
docker-compose down -v
docker-compose build --no-cache
docker-compose up -d
```

#### Memory Issues
```bash
# Increase Node.js memory limit
NODE_OPTIONS="--max-old-space-size=1024" npm start
```

### Debug Mode

```bash
# Enable debug logging
DEBUG=* npm start

# Or in Docker
docker-compose run -e DEBUG=* app
```

## 📋 Deployment Checklist

### Pre-Deployment
- [ ] Test locally with production build
- [ ] Verify all dependencies are listed
- [ ] Update configuration for production
- [ ] Prepare SSL certificates
- [ ] Set strong admin password
- [ ] Create backup of existing data

### Deployment
- [ ] Deploy application code
- [ ] Install dependencies
- [ ] Configure environment variables
- [ ] Set up reverse proxy (nginx)
- [ ] Configure SSL/HTTPS
- [ ] Start application
- [ ] Verify health check endpoint

### Post-Deployment
- [ ] Test all critical functions
- [ ] Verify data persistence
- [ ] Check error logs
- [ ] Set up monitoring
- [ ] Configure automated backups
- [ ] Document deployment details
- [ ] Create runbook for operations

## 📞 Support

For deployment issues:
1. Check logs: `docker-compose logs` or `pm2 logs`
2. Verify configuration in `.env` and `data/bookings.json`
3. Ensure all ports are accessible
4. Test with `curl http://localhost:3000/health`

For persistent issues, create detailed bug report with:
- Deployment method used
- Error messages and logs
- System specifications
- Steps to reproduce