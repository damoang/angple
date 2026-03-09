# Angple Production Deployment Checklist

## Pre-deployment

### Environment Variables

- [ ] Copy `.env.example` to `.env.local` and fill in all production values
- [ ] `NODE_ENV=production`
- [ ] `INTERNAL_API_URL` points to the Go backend (e.g. `http://angple-api:8081/api/v2`)
- [ ] `DB_HOST`, `DB_USER`, `DB_PASSWORD`, `DB_NAME` configured for production database
- [ ] `GITHUB_TOKEN_ENCRYPTION_KEY` generated (`node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`)
- [ ] `PUBLIC_TURNSTILE_SITE_KEY` and `TURNSTILE_SECRET_KEY` set if CAPTCHA is enabled
- [ ] `VITE_SITE_NAME` set to the desired site branding name
- [ ] Run env validation: `node --import tsx apps/web/scripts/validate-env.ts`

### Secrets

- [ ] Database credentials are not hardcoded; they come from `.env.local` or Docker secrets
- [ ] `.env.local` is in `.gitignore` and never committed
- [ ] SMTP credentials configured if email features are required

### Docker Build

- [ ] Docker image builds successfully: `docker build -t angple-web -f apps/web/Dockerfile .`
- [ ] Or use pre-built image: `ANGPLE_WEB_IMAGE=ghcr.io/angple/angple-web:<tag>`
- [ ] Verify image size is reasonable (should be under 500 MB)

### Database

- [ ] Production database is accessible from the Docker network
- [ ] Database user has appropriate permissions (read/write on the application database)
- [ ] Database backups are configured and tested

---

## Docker Deployment

### Using compose.prod.yml

1. Ensure external Docker networks exist:

```bash
docker network create angple-network
docker network create proxy-network
# backend_angple-network is created by the Go backend compose
```

2. Create or update `.env.local` with production values.

3. Start services:

```bash
docker compose -f compose.prod.yml --env-file .env.local up -d
```

4. Verify the container is running:

```bash
docker compose -f compose.prod.yml ps
docker logs angple-web --tail 50
```

### Updating to a New Version

```bash
# Pull latest image
docker compose -f compose.prod.yml pull

# Recreate with new image (zero-downtime if using a reverse proxy)
docker compose -f compose.prod.yml up -d --force-recreate
```

---

## Post-deployment Verification

### Health Check

```bash
# From the host machine
curl -f http://localhost:3010/health

# Expected response:
# {"status":"ok","timestamp":"2026-02-17T...","version":"...","service":"angple-web"}
```

### Admin Access

- [ ] Navigate to `https://<domain>/admin` and verify the admin login page loads
- [ ] Log in with admin credentials and verify the dashboard is accessible

### API Connectivity

```bash
# Verify the web app can reach the Go backend (from inside the container)
docker exec angple-web wget -qO- http://angple-api:8081/api/v2/health
```

- [ ] Boards load correctly on the homepage
- [ ] Posts can be created and read
- [ ] User authentication (login/logout) works

### SSL / Reverse Proxy

- [ ] HTTPS is properly configured via reverse proxy (Nginx, Traefik, Caddy, etc.)
- [ ] HTTP redirects to HTTPS
- [ ] HSTS headers are present

---

## Rollback Procedure

### Quick Rollback (previous image)

```bash
# Stop current deployment
docker compose -f compose.prod.yml down

# Update .env.local to use the previous image tag
# ANGPLE_WEB_IMAGE=ghcr.io/angple/angple-web:<previous-tag>

# Start with previous version
docker compose -f compose.prod.yml --env-file .env.local up -d
```

### If Using Specific Image Tags

```bash
# List available tags
docker image ls ghcr.io/angple/angple-web

# Roll back to a known-good tag
ANGPLE_WEB_IMAGE=ghcr.io/angple/angple-web:v1.2.3 \
  docker compose -f compose.prod.yml up -d
```

### Database Rollback

If a deployment includes database schema changes:

1. Stop the application: `docker compose -f compose.prod.yml down`
2. Restore the database from the pre-deployment backup
3. Deploy the previous application version (see above)

---

## Monitoring Endpoints

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/health` | GET | Application health check (used by Docker HEALTHCHECK) |

### Docker Health Status

```bash
# Check container health status
docker inspect --format='{{.State.Health.Status}}' angple-web

# View recent health check results
docker inspect --format='{{json .State.Health}}' angple-web | python3 -m json.tool
```

### Log Monitoring

```bash
# Follow application logs
docker logs -f angple-web

# Filter for errors
docker logs angple-web 2>&1 | grep -i error
```

### Resource Monitoring

```bash
# Check container resource usage
docker stats angple-web --no-stream
```

---

## Troubleshooting

### Container fails to start

1. Check logs: `docker logs angple-web`
2. Verify environment variables: `docker exec angple-web env | sort`
3. Ensure the Go backend is running and reachable on the Docker network

### Health check failing

1. Check if the application is listening: `docker exec angple-web wget -qO- http://127.0.0.1:3000/health`
2. Verify `PORT` environment variable matches the exposed port (default `3000` inside container)

### Database connection errors

1. Verify database credentials in environment variables
2. Test connectivity: `docker exec angple-web wget -qO- http://<DB_HOST>:<DB_PORT>/ || echo "Connection test complete"`
3. Check that the database host is resolvable from the container network
