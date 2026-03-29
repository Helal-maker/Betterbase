# Installation

This guide covers how to install and set up Betterbase in your development environment.

## Prerequisites

Before installing Betterbase, ensure you have the following:

- **Docker** & **Docker Compose** - For running infrastructure services
- **Bun** (v1.0+) - The JavaScript runtime powering Betterbase
- **Git** - For version control

### Installing Bun

BetterBase requires Bun. Install it using one of the following methods:

```bash
# macOS/Linux (via curl)
curl -fsSL https://bun.sh/install | bash

# Windows (via PowerShell)
powershell -Command "irm bun.sh/install.ps1 | iex"

# Via npm
npm install -g bun

# Via brew
brew install bun
```

Verify the installation:

```bash
bun --version
```

### Installing Docker

BetterBase uses Docker for local development infrastructure (PostgreSQL, MinIO, Inngest).

Install Docker Desktop for macOS/Windows, or on Linux:

```bash
# Ubuntu/Debian
curl -fsSL https://get.docker.com | sh

# Verify Docker
docker --version
docker compose version
```

Verify the installation:

```bash
bun --version
```

## Installing BetterBase CLI

The BetterBase CLI (`bb`) is your primary tool for managing projects and deployments.

### Global Installation

```bash
# Install globally via Bun
bun add -g @betterbase/cli

# Verify installation
bb --version
```

### Local Installation

Alternatively, install locally in your project:

```bash
# Add as dev dependency
bun add -D @betterbase/cli

# Run via npx
npx bb --version
```

Or add to your `package.json` scripts:

```json
{
  "scripts": {
    "bb": "bb"
  }
}
```

Then run with `bun run bb`.

## Installing Core Packages

For backend development, install the core package:

```bash
bun add @betterbase/core
```

For frontend development, install the client SDK:

```bash
bun add @betterbase/client
```

## Project Initialization

Clone and set up the project:

```bash
# Clone the repository
git clone https://github.com/betterbase/betterbase.git
cd betterbase

# Install dependencies
bun install

# Start infrastructure (PostgreSQL, MinIO, Inngest)
docker compose up -d

# Start development server with hot-reload
bun run dev
```

This creates the following project structure:

```text
betterbase/
├── packages/
│   ├── core/          # Core framework
│   ├── cli/           # CLI tools
│   ├── client/        # Client SDK
│   ├── server/        # Server implementation
│   └── shared/        # Shared utilities
├── apps/
│   └── dashboard/     # Admin dashboard
├── docker-compose.yml # Local development services
└── docs/             # Documentation
```

## Quick Start with Docker

For the simplest setup, start infrastructure services with Docker:

```bash
# Start PostgreSQL, MinIO, and Inngest
docker compose up -d

# Run the server locally (with hot-reload)
bun run dev
```

Your API will be available at `http://localhost:3001`.

See [Docker Setup Guide](../docker-setup.md) for detailed instructions.

## Production Environment

Set up environment variables for production:

```bash
# Database
DATABASE_URL=postgresql://user:password@host:5432/db

# Authentication - Generate: openssl rand -base64 32
AUTH_SECRET=your-secret-key-min-32-chars
AUTH_URL=https://your-domain.com

# Storage (optional - uses MinIO by default)
STORAGE_PROVIDER=s3
STORAGE_BUCKET=your-bucket
AWS_ACCESS_KEY_ID=your-key
AWS_SECRET_ACCESS_KEY=your-secret
```

See the [Configuration Guide](./configuration.md) for all available options.

## Verifying Your Setup

Once Docker services are running and the server is started:

```bash
# Check Docker services are healthy
docker compose ps

# Check the server is running
curl http://localhost:3001/health
```

You should see:
- Docker services: `postgres`, `minio`, `inngest` - all running
- Server health check: returns successful response

Available endpoints:
- `http://localhost:3001` - API root
- `http://localhost:3001/graphql` - GraphQL playground
- `http://localhost:3001/api/auth/*` - Auth endpoints
- `http://localhost:3001/storage/*` - Storage endpoints

## Next Steps

- [Quick Start Guide](./quick-start.md) - Get running in 5 minutes
- [Your First Project](./your-first-project.md) - Build a complete application
- [Configuration](./configuration.md) - Customize your setup
- [Docker Setup Guide](../docker-setup.md) - Detailed Docker configuration
