# Task Completion Checklist

## Before Code Changes

1. **Understand the current implementation** - review related files
2. **Check existing tests** (if any) to understand expected behavior
3. **Review database schema** if making data-related changes

## During Development

1. **Follow code style conventions** from the project
2. **Use prepared statements** for any database operations
3. **Validate inputs** on both client and server side
4. **Maintain backward compatibility** where possible
5. **Add proper error handling** and user feedback

## After Code Changes

1. **Run linting and formatting**:

   ```bash
   npm run lint
   npm run format
   ```

2. **Check for code duplicates**:

   ```bash
   npm run duplicates
   ```

3. **Validate JSON files**:

   ```bash
   npm run validate:json
   ```

4. **Run pre-commit checks**:

   ```bash
   npm run pre-commit
   ```

5. **Test functionality locally**:

   ```bash
   npm run dev
   ```

6. **Test Docker build** (for production changes):
   ```bash
   docker-compose up --build -d
   ```

## Git Commit

1. **Use conventional commit messages**:
   - `feat:` for new features
   - `fix:` for bug fixes
   - `refactor:` for code refactoring
   - `docs:` for documentation
   - `style:` for formatting changes

2. **Commit with descriptive message**:
   ```bash
   git add .
   git commit -m "feat: add Christmas periods table management"
   ```

## Database Changes

- **Always create migration logic** for schema changes
- **Test with existing data** to ensure backward compatibility
- **Update both SQLite and LocalStorage fallback** if applicable
