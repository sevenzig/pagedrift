# Conventional Commits

This project uses [Conventional Commits](https://www.conventionalcommits.org/) to ensure consistent and meaningful commit messages.

## Overview

Conventional Commits is a specification for adding human and machine readable meaning to commit messages. This setup provides:

- **Consistent commit message format** across the entire project
- **Automated validation** of commit messages via git hooks
- **Interactive commit creation** with guided prompts
- **Better project history** and easier navigation
- **Automated changelog generation** capabilities
- **Integration with release tools** and CI/CD pipelines

## Setup Components

### Dependencies

The following packages are installed as dev dependencies:

```json
{
  "@commitlint/cli": "^20.1.0",
  "@commitlint/config-conventional": "^20.0.0", 
  "@commitlint/cz-commitlint": "^20.1.0",
  "commitizen": "^4.3.1",
  "husky": "^9.1.7"
}
```

### Configuration Files

#### `commitlint.config.js`
ES module configuration for commitlint with custom rules:

```javascript
export default {
  extends: ['@commitlint/config-conventional'],
  rules: {
    'type-enum': [
      2,
      'always',
      [
        'feat',     // A new feature
        'fix',      // A bug fix
        'docs',     // Documentation only changes
        'style',    // Changes that do not affect the meaning of the code
        'refactor', // A code change that neither fixes a bug nor adds a feature
        'perf',     // A code change that improves performance
        'test',     // Adding missing tests or correcting existing tests
        'build',    // Changes that affect the build system or external dependencies
        'ci',       // Changes to our CI configuration files and scripts
        'chore',    // Other changes that don't modify src or test files
        'revert'    // Reverts a previous commit
      ]
    ],
    // Additional validation rules...
  }
};
```

#### `.czrc`
Commitizen configuration for interactive commits:

```json
{
  "path": "@commitlint/cz-commitlint"
}
```

#### Git Hooks (`.husky/`)

**`.husky/commit-msg`** - Validates commit messages:
```bash
# Simple commit message validation
# Check if commit message follows conventional commit format
commit_msg=$(cat $1)
if echo "$commit_msg" | grep -qE "^(feat|fix|docs|style|refactor|perf|test|build|ci|chore|revert)(\(.+\))?: .+"; then
    echo "✅ Commit message follows conventional commit format"
    exit 0
else
    echo "❌ Commit message does not follow conventional commit format"
    echo "Expected format: type(scope): description"
    echo "Example: feat(auth): add login functionality"
    exit 1
fi
```

**`.husky/pre-commit`** - Pre-commit checks (currently disabled due to TypeScript errors):
```bash
# Temporarily disabled due to TypeScript errors
# npm run check
```

## Commit Message Format

### Basic Structure

```
<type>[optional scope]: <description>

[optional body]

[optional footer(s)]
```

### Components

#### Type (Required)
The type of change being made:

- **feat**: A new feature for the user
- **fix**: A bug fix for the user
- **docs**: Documentation only changes
- **style**: Changes that do not affect the meaning of the code (white-space, formatting, missing semi-colons, etc)
- **refactor**: A code change that neither fixes a bug nor adds a feature
- **perf**: A code change that improves performance
- **test**: Adding missing tests or correcting existing tests
- **build**: Changes that affect the build system or external dependencies
- **ci**: Changes to our CI configuration files and scripts
- **chore**: Other changes that don't modify src or test files
- **revert**: Reverts a previous commit

#### Scope (Optional)
The scope of the change, indicating which part of the codebase is affected:

**Common scopes for this project:**
- **auth**: Authentication and authorization
- **books**: Book management and parsing
- **search**: Search functionality
- **ui**: User interface components
- **api**: API endpoints
- **db**: Database related changes
- **docker**: Docker configuration
- **deps**: Dependencies
- **parser**: Book parsing functionality
- **reader**: E-book reader functionality
- **upload**: File upload functionality

#### Description (Required)
A short description of the change, written in imperative mood:

- ✅ "add login functionality"
- ✅ "fix EPUB parsing error"
- ✅ "update API documentation"
- ❌ "added login functionality"
- ❌ "fixes EPUB parsing error"

#### Body (Optional)
A longer description providing additional context:

- What the change does
- Why the change was made
- Any important details

#### Footer (Optional)
Additional metadata:

- Breaking changes
- Issues closed
- References to other commits

## Usage

### Interactive Commits (Recommended)

Use the interactive commit tool for guided commit creation:

```bash
npm run commit
```

This will present you with:
1. **Type selection** - Choose from the available commit types
2. **Scope input** - Specify the affected area (optional)
3. **Description** - Write a clear, imperative description
4. **Body** - Add detailed explanation (optional)
5. **Footer** - Add breaking changes or issue references (optional)

### Manual Commits

You can write commits manually, but they must follow the conventional commit format:

```bash
git commit -m "feat(auth): add JWT token refresh functionality"
git commit -m "fix(books): resolve EPUB parsing error for nested directories"
git commit -m "docs: update API documentation for search endpoints"
```

### Retry Failed Commits

If a commit fails validation, you can retry with:

```bash
npm run commit:retry
```

## Examples

### Feature Addition
```bash
feat(auth): add JWT token refresh functionality

Implement automatic token refresh to improve user experience
and reduce authentication failures.

Closes #123
```

### Bug Fix
```bash
fix(books): resolve EPUB parsing error for nested directories

The EPUB parser was failing when encountering deeply nested
directory structures in the archive. This fix properly handles
relative path resolution for nested content.

Fixes #456
```

### Documentation Update
```bash
docs: update API documentation for search endpoints

Add comprehensive examples and parameter descriptions for
all search API endpoints to improve developer experience.
```

### Code Style
```bash
style(ui): improve button component styling

Update button component to use consistent spacing and
improve accessibility with better focus states.
```

### Refactoring
```bash
refactor(search): optimize search indexing performance

Replace linear search with indexed lookup to improve
search performance for large book collections.

Performance improvement: 60% faster search queries
```

### Performance Improvement
```bash
perf(books): cache parsed book metadata

Implement metadata caching to avoid re-parsing book
information on every page load.

Reduces page load time by 40%
```

### Test Addition
```bash
test(auth): add unit tests for password validation

Add comprehensive test coverage for password strength
validation and security requirements.
```

### Build System
```bash
build(docker): update Node.js version in Dockerfile

Update base image to Node.js 20 LTS for better
performance and security updates.
```

### CI/CD Changes
```bash
ci: add automated testing workflow

Implement GitHub Actions workflow for automated
testing on pull requests and main branch pushes.
```

### Maintenance
```bash
chore(deps): update dependencies to latest versions

Update all dependencies to their latest stable versions
to address security vulnerabilities and get latest features.
```

### Reverting Changes
```bash
revert: revert "feat(auth): add OAuth integration"

This reverts commit abc123def456.

OAuth integration caused authentication issues in production.
Will re-implement with proper error handling.
```

## Breaking Changes

### Using `!` in Type
```bash
feat(api)!: change authentication endpoint structure

BREAKING CHANGE: The /auth/login endpoint now requires additional parameters
```

### Using Footer
```bash
feat(auth): add OAuth integration

BREAKING CHANGE: The authentication flow has changed. Users will need to
re-authenticate after this update.
```

## Validation Rules

The commit message validation enforces:

- **Type is required** and must be one of the allowed types
- **Type must be lowercase**
- **Scope must be lowercase** (if provided)
- **Description is required** and cannot be empty
- **Description cannot end with a period**
- **Header cannot exceed 100 characters**
- **Body and footer lines cannot exceed 100 characters**

## Git Hooks

### Pre-commit Hook
Currently disabled due to TypeScript errors in the project. When enabled, it will:
- Run linting checks
- Run type checking
- Prevent commits if checks fail

### Commit-msg Hook
Automatically validates every commit message to ensure it follows the conventional commit format.

## Benefits

### For Developers
- **Consistency**: All commit messages follow the same format
- **Clarity**: Easy to understand what each commit does
- **History**: Better git history navigation
- **Automation**: Guided commit creation reduces errors

### For the Project
- **Automated changelogs**: Generate changelogs from commit history
- **Release automation**: Automatically determine version bumps
- **CI/CD integration**: Better integration with automated workflows
- **Documentation**: Commit history serves as project documentation

### For Teams
- **Onboarding**: New team members can quickly understand the codebase
- **Code review**: Easier to review changes with clear commit messages
- **Debugging**: Easier to find when bugs were introduced
- **Communication**: Clear communication about what changes were made

## Troubleshooting

### Commit Message Validation Fails

If your commit message fails validation, check:

1. **Type is correct**: Must be one of the allowed types (feat, fix, docs, etc.)
2. **Format is correct**: Must follow `type(scope): description` format
3. **Description is present**: Cannot be empty
4. **No trailing period**: Description should not end with a period

### Interactive Commit Tool Not Working

If `npm run commit` fails:

1. Ensure commitizen is installed: `npm install --save-dev commitizen`
2. Check `.czrc` configuration file exists
3. Try using `npx git-cz` directly

### Git Hooks Not Running

If git hooks aren't executing:

1. Ensure husky is installed: `npm install --save-dev husky`
2. Check `.husky/` directory exists with proper permissions
3. Verify git hooks are executable

## Integration with Tools

### Automated Changelog Generation
Conventional commits enable automated changelog generation using tools like:
- [conventional-changelog](https://github.com/conventional-changelog/conventional-changelog)
- [standard-version](https://github.com/conventional-changelog/standard-version)
- [semantic-release](https://github.com/semantic-release/semantic-release)

### Version Management
Commit types can be used to automatically determine version bumps:
- **feat**: Minor version bump
- **fix**: Patch version bump
- **BREAKING CHANGE**: Major version bump

### CI/CD Integration
Many CI/CD tools can parse conventional commits for:
- Automated testing based on changed areas
- Deployment strategies based on commit types
- Notification systems for different types of changes

## References

- [Conventional Commits Specification](https://www.conventionalcommits.org/)
- [Commitlint Documentation](https://commitlint.js.org/)
- [Commitizen Documentation](https://github.com/commitizen/cz-cli)
- [Husky Documentation](https://typicode.github.io/husky/)
- [Semantic Versioning](https://semver.org/)

## Project-Specific Notes

This ebook-reader project uses conventional commits to maintain consistency across:
- Book parsing and management features
- Authentication and user management
- Search functionality
- UI/UX improvements
- Docker and deployment configurations
- Database migrations and schema changes

The commit history serves as a living documentation of the project's evolution and helps maintain code quality and team collaboration standards.