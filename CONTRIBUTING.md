# Contributing to Tiptap Linter

Thank you for your interest in contributing to Tiptap Linter! We welcome contributions from the community.

## Code of Conduct

By participating in this project, you agree to maintain a respectful and inclusive environment for all contributors.

## How Can I Contribute?

### Reporting Bugs

Before creating bug reports, please check existing issues to avoid duplicates. When creating a bug report, include:

- **Clear title and description**
- **Steps to reproduce** the issue
- **Expected behavior** vs **actual behavior**
- **Code samples** or test cases
- **Environment details** (OS, Node version, browser, etc.)
- **Screenshots** if applicable

### Suggesting Enhancements

Enhancement suggestions are tracked as GitHub issues. When creating an enhancement suggestion, include:

- **Clear title and description**
- **Use case** explaining why this would be useful
- **Proposed solution** or API design
- **Alternatives considered**
- **Additional context** like mockups or examples

### Pull Requests

1. **Fork the repository** and create your branch from `main`
2. **Make your changes** following the code style guidelines
3. **Add tests** if you've added code that should be tested
4. **Run linter** (`npm run lint`) and fix all issues
5. **Ensure the test suite passes** (`npm test`)
6. **Ensure the build succeeds** (`npm run build`)
7. **Update documentation** as needed
8. **Write a clear commit message** describing your changes

## Development Setup

```bash
# Clone your fork
git clone https://github.com/YOUR_USERNAME/or3-text-linter.git
cd or3-text-linter

# Install dependencies
npm install

# Run linter
npm run lint

# Run linter with auto-fix
npm run lint:fix

# Run tests
npm test

# Run tests in watch mode
npm run test:watch

# Run development server
npm run dev

# Build the project
npm run build
```

## Code Style Guidelines

### Linting

This project uses ESLint with strict TypeScript rules to ensure code quality and type safety:

- **Run `npm run lint`** before committing to catch issues early
- **Zero warnings policy** - ESLint is configured with `--max-warnings 0`
- **Auto-fix when possible** - Use `npm run lint:fix` to automatically fix some issues
- All code must pass ESLint checks before being merged

### TypeScript

- Use TypeScript for all new code
- Enable strict mode and fix all type errors
- **Never use `any` types** - ESLint will error on explicit `any` usage
- Prefer explicit type guards over non-null assertions (`!`)
- Use interfaces for public APIs, types for internal use
- Document all exported functions and classes with JSDoc

### Code Organization

- Keep files focused and under 500 lines when possible
- Use descriptive variable and function names
- Extract complex logic into separate functions
- Follow existing patterns in the codebase

### Testing

- Write property-based tests for plugins using fast-check
- Test edge cases and error conditions
- Ensure tests are deterministic and don't rely on timing
- Mock external dependencies (don't call real AI APIs in tests)

### Documentation

- Update README.md for user-facing changes
- Add JSDoc comments for all public APIs
- Include code examples in documentation
- Keep documentation in sync with code changes

## Testing Guidelines

We use Vitest and fast-check for testing:

```typescript
// Example test structure
import { describe, test, expect } from 'vitest';
import { fc, test as fcTest } from '@fast-check/vitest';

describe('MyPlugin', () => {
    test('should detect issues', () => {
        // Unit test
    });

    fcTest.prop([fc.string()])('property test', (text) => {
        // Property-based test
    });
});
```

### Test Categories

1. **Unit Tests**: Test individual functions and classes
2. **Property Tests**: Test invariants across many inputs using fast-check
3. **Integration Tests**: Test interactions between components
4. **Vue Tests**: Test Vue components and composables

## Commit Message Guidelines

Follow the Conventional Commits specification:

```
type(scope): subject

body

footer
```

**Types:**
- `feat`: New feature
- `fix`: Bug fix
- `docs`: Documentation changes
- `style`: Code style changes (formatting, etc.)
- `refactor`: Code refactoring
- `test`: Adding or updating tests
- `chore`: Maintenance tasks

**Examples:**
```
feat(plugins): add spell check plugin

Implements a basic spell checking plugin using a dictionary-based
approach for English words.

Closes #123

---

fix(popover): prevent memory leak on editor destroy

Added cleanup of event listeners in onDestroy hook to prevent
memory leaks when the editor is destroyed.
```

## Plugin Development

When creating new lint plugins:

1. **Extend LinterPlugin** for synchronous plugins
2. **Extend AILinterPlugin** for AI-powered plugins
3. **Implement scan()** method to detect issues
4. **Use record()** to register issues with positions
5. **Add fix functions** where appropriate
6. **Write comprehensive tests** including edge cases
7. **Document the plugin** with JSDoc and examples

### Plugin Checklist

- [ ] Extends LinterPlugin or AILinterPlugin
- [ ] Implements scan() method
- [ ] Handles all text nodes correctly
- [ ] Uses regex.lastIndex reset when using global regex
- [ ] Provides fix functions where appropriate
- [ ] Includes unit tests
- [ ] Includes property-based tests
- [ ] Has JSDoc documentation
- [ ] Has usage examples in README

## AI Plugin Guidelines

When creating AI-powered plugins:

1. **Never include API keys** in code or tests
2. **Mock AI responses** in tests - don't call real APIs
3. **Handle errors gracefully** - AI calls can fail
4. **Validate AI responses** before using them
5. **Document expected AI response format**
6. **Consider rate limiting** and caching
7. **Respect data privacy** concerns

## Release Process

Maintainers follow this process for releases:

1. Update version in package.json
2. Update CHANGELOG.md
3. Run full test suite
4. Create release tag
5. Publish to npm
6. Create GitHub release with notes

## Questions?

Feel free to open an issue for questions about contributing!

## License

By contributing to Tiptap Linter, you agree that your contributions will be licensed under the MIT License.
