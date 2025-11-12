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

Access at: http://localhost:5173

### Admin Dashboard

The [admin dashboard](./apps/admin/README.md) is located in `apps/admin/`. To work on it:

```bash
docker compose up -d admin
```

Access at: http://localhost:5174

## Production

```bash
docker compose up -f compose.yml -d
```

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