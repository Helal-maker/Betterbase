# Contributing to Betterbase

Thank you for your interest in contributing to Betterbase!

## Getting Started

1. **Fork** the repository
2. **Clone** your fork: `git clone https://github.com/your-username/betterbase.git`
3. **Install** dependencies: `bun install`
4. **Create** a branch: `git checkout -b feature/my-feature`

## Development Setup

```bash
# Install dependencies
bun install

# Build all packages
bun run build

# Run tests
bun test

# Run linting
bun run lint
```

## Code Style

We use Biome for code formatting and linting:

```bash
# Format code
bun run format

# Lint code
bun run lint

# Fix auto-fixable issues
bun run lint:fix
```

## Testing

```bash
# Run all tests
bun test

# Run tests for specific package
bun test --filter=@betterbase/cli

# Run tests in watch mode
bun test --watch
```

## Commit Messages

Follow Conventional Commits:

```
feat: add new feature
fix: resolve bug
docs: update documentation
refactor: restructure code
test: add tests
chore: maintenance
```

## Submitting Changes

1. Push your branch: `git push origin feature/my-feature`
2. Open a **Pull Request**
3. Fill out the PR template
4. Wait for review

## Good First Issues

Looking for a way to contribute? Check out our [Good First Issues](https://github.com/weroperking/Betterbase/labels/good-first-issue) label on GitHub.

## Community

Join our community:
- **Discord**: https://discord.gg/R6Dm6Cgy2E
- **GitHub Discussions**: https://github.com/weroperking/Betterbase/discussions
