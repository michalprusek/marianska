# Suggested Development Commands

## Development Workflow

```bash
npm install          # Install dependencies
npm start           # Start production server on port 3000
npm run dev         # Start development server with auto-reload
```

## Code Quality & Validation

```bash
npm run lint        # Run ESLint with auto-fix
npm run format      # Format code with Prettier
npm run lint:check  # Check linting without fixing
npm run format:check # Check formatting without fixing
npm run duplicates  # Check for code duplicates with jscpd
npm run validate:json # Validate all JSON files
npm run pre-commit  # Run all checks (used by git hooks)
```

## Docker Production Deployment

```bash
docker-compose up -d                    # Start containers
docker-compose down                     # Stop containers
docker-compose up --build -d           # Rebuild and start containers

# IMPORTANT: After any code changes, MUST rebuild containers:
docker-compose down && docker-compose up --build -d
```

## Git Workflow

```bash
git add .
git commit -m "feat: description"  # Uses conventional commits
git push
```

## System Commands (Darwin/macOS)

- `ls -la` - list files with details
- `grep -r "pattern" .` - search for patterns
- `find . -name "*.js"` - find JavaScript files
- `cd /path/to/directory` - change directory
