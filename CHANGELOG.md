# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.0.0] - 2025-12-04

### Added

- Initial release of tiptap-linter
- Core linting framework with `LinterPlugin` base class
- AI-powered linting support with `AILinterPlugin`
- Natural language rule factory with `createNaturalLanguageRule()`
- Customizable popover system with default and custom renderers
- Vue 3 integration for popover components
- Built-in plugins:
  - `BadWords` - Detects discouraged words
  - `Punctuation` - Fixes spacing around punctuation
  - `HeadingLevel` - Validates heading hierarchy
- Comprehensive test suite with 58 tests
- TypeScript strict mode support
- Full type definitions and JSDoc documentation
- Security documentation (SECURITY.md)
- Contributing guidelines (CONTRIBUTING.md)
- MIT License

### Security

- Input validation on all public APIs
- Bounds checking for document positions
- Memory leak prevention with cleanup hooks
- ARIA attributes for accessibility
- Safe error handling that prevents crashes
- XSS prevention through text-only insertions
- Production-safe error logging

### Documentation

- Complete API reference
- Plugin development guide
- AI integration examples
- Popover customization guide
- Vue component usage examples
- Security audit report

### Developer Experience

- Property-based testing with fast-check
- TypeScript strict mode enabled
- Comprehensive JSDoc comments
- Build system with declaration files
- npm package configuration
- Peer dependency management

### Known Issues

- Moderate severity vulnerability in esbuild (dev dependency only)
  - Does not affect production builds
  - Only impacts development server
  - Mitigation: Use dev server on trusted networks only

## [Unreleased]

### Planned

- Additional built-in plugins (grammar, style, readability)
- Caching mechanism for AI responses
- Rate limiting helpers for AI providers
- Performance benchmarks
- E2E testing suite
- Documentation website

---

## Version History

- **1.0.0** (2025-12-04) - Initial stable release
