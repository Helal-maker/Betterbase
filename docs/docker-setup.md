# Docker Setup Guide

Quick start guides for running Betterbase with Docker.

## Quick Start (Local Development)

The simplest way to get started:

```bash
# Start infrastructure (PostgreSQL, MinIO, Inngest)
docker compose up -d

# Run Betterbase server locally with hot-reload
bun run dev
```

That's it! Your server will be available at `http://localhost:3001`.

### Services Started

| Service | URL | Purpose |
|---------|-----|---------|
| PostgreSQL | localhost:5432 | Database |
| MinIO | localhost:9000 | S3-compatible storage |
| MinIO Console | localhost:9001 | Storage management UI |
| Inngest | localhost:8288 | Workflow engine |
| Betterbase | localhost:3001 | API server |

### Environment Variables

For local development, the default values in `docker-compose.yml` should work.
Create a `.env` file if you need custom values:

```bash
cp .env.example .env
```

## Production Self-Hosted

Deploy all services on your own infrastructure:

```bash
# 1. Build the project
bun run build

# 2. Configure environment
cp .env.example .env
# Edit .env with your values

# 3. Start all services
docker compose -f docker-compose.self-hosted.yml up -d
```

### Required Environment Variables

```bash
# Generate a secure auth secret
AUTH_SECRET=$(openssl rand -base64 32)

# Generate Inngest keys (optional for development)
INNGEST_SIGNING_KEY=$(openssl rand -hex 32)
INNGEST_EVENT_KEY=$(openssl rand -hex 16)
```

### Accessing Services

| Service | URL | Credentials |
|---------|-----|--------------|
| Betterbase API | http://localhost | Through nginx |
| Dashboard | http://localhost | Admin login |
| MinIO Console | http://localhost:9001 | minioadmin/minioadmin_password |

## Common Issues

### PostgreSQL Connection Failed

```bash
# Check if PostgreSQL is running
docker compose ps postgres

# View logs
docker compose logs postgres
```

### MinIO Bucket Not Found

The `minio-init` service creates the bucket automatically. If it fails:

```bash
# Manually create bucket
docker compose exec minio mc alias set local http://localhost:9000 minioadmin minioadmin_password
docker compose exec minio mc mb local/betterbase
```

### Port Already in Use

If a port is already bound:

```bash
# Check what's using the port
lsof -i :5432

# Change the port in docker-compose.yml
```

### Build Fails with "Cannot find module"

Make sure to run `bun install` before building:

```bash
bun install
bun run build
```

### Permission Issues

On Linux, you may need to set ownership:

```bash
sudo chown -R $(id -u):$(id -g) .
```

## Docker Commands Reference

```bash
# Start services
docker compose up -d

# Stop services
docker compose down

# Stop and remove volumes (clean slate)
docker compose down -v

# View logs
docker compose logs -f

# View logs for specific service
docker compose logs -f postgres

# Restart a service
docker compose restart postgres

# Rebuild a service
docker compose up -d --build betterbase-server
```

## Development vs Production

| Feature | Development | Production |
|---------|-------------|------------|
| Runs locally | Yes | Self-hosted server |
| Hot reload | Yes (server runs in terminal) | No |
| Database | Docker PostgreSQL | Docker or managed |
| Storage | Docker MinIO | Docker, R2, S3, or B2 |
| SSL/TLS | Not needed | Required (use Traefik/Caddy) |
| Inngest | Dev mode | Production mode |

## Alternative: External Services

Instead of running everything with Docker, you can use managed services:

```yaml
# docker-compose.production.yml
# Use external PostgreSQL (Neon, Supabase, RDS)
# Use external storage (Cloudflare R2, AWS S3)
```

See `docker-compose.production.yml` for a configuration that assumes external services.