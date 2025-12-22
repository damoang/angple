# Angple Project

A minimal SvelteKit project setup for frontend and backend development.

## Tech Stack

- **SvelteKit 5** - Full-stack web framework
- **Svelte 5** - Component framework
- **TypeScript 5** - Type safety
- **Tailwind CSS 4** - Utility-first CSS
- **Vite 7** - Build tool

## Prerequisites

- docker compose
- Node.js 18+
- npm 9+

## Development

### Web Application

The main [web application](./apps/web/README.md) is located in `apps/web/`. To work on it:

```bash
docker compose up -d web
```

Access at: http://localhost:3010

### Admin Dashboard

The [admin dashboard](./apps/admin/README.md) is located in `apps/admin/`. To work on it:

```bash
docker compose up -d admin
```

Access at: http://localhost:3011

## Production Deployment

### Prerequisites

1. **Backend Network Setup**

   This project requires `angple-backend` to be running first to create the shared Docker network:

   ```bash
   # 1. Start angple-backend (creates angple-network)
   cd ../angple-backend
   docker compose up -d

   # 2. Verify network exists
   docker network ls | grep angple-network
   ```

2. **Environment Configuration**

   - `.env.production` - Production environment (SSR enabled)
   - `.env.staging` - Staging environment (SSR enabled)
   - `.env` - Local development (CSR, Mock data)

### Deployment Steps

```bash
# 1. Build and start frontend containers
docker compose -f compose.yml up -d

# 2. Check container status
docker ps | grep angple

# 3. View logs
docker compose logs -f web
```

### Network Architecture

```
┌─────────────────────────────────────────────────────────┐
│                    angple-network                        │
│  (Created by angple-backend/docker-compose.yml)         │
├─────────────────────────────────────────────────────────┤
│                                                          │
│  angple-gateway:8080  ←─ INTERNAL_API_URL (SSR only)   │
│         ↓                                                │
│  angple-api:8081                                         │
│         ↓                                                │
│  angple-mysql:3307                                       │
│                                                          │
│  angple-web:80 (port 3010)                              │
│  angple-admin:80 (port 3011)                            │
│                                                          │
└─────────────────────────────────────────────────────────┘

Browser → PUBLIC_API_URL (https://api.damoang.net) → Backend
SSR Server → INTERNAL_API_URL (http://angple-gateway:8080) → Backend (무료)
```

### SSR Benefits

- **SEO**: Complete HTML for search engines
- **Performance**: Faster initial page load
- **Traffic Cost**: Internal Docker network (free) vs external API calls (paid)

## Project Structure

```
angple/
├── apps/
│   ├── web/        # Main SvelteKit web application
│   └── admin/      # Admin dashboard (SvelteKit)
├── packages/       # Shared packages (if needed)
├── node_modules/   # Dependencies
└── package.json    # Root package configuration
```

## MCP Tools

This project is configured to work with:

- Serena MCP
- Context7 MCP
- Task Manager MCP

## License

MIT
