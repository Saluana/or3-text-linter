# Security Policy

## Supported Versions

We release patches for security vulnerabilities in the following versions:

| Version | Supported          |
| ------- | ------------------ |
| 1.0.x   | :white_check_mark: |

## Reporting a Vulnerability

We take the security of tiptap-linter seriously. If you believe you have found a security vulnerability, please report it to us as described below.

**Please do not report security vulnerabilities through public GitHub issues.**

Instead, please report them via GitHub Security Advisories:
1. Go to the [Security tab](https://github.com/Saluana/or3-text-linter/security) of this repository
2. Click "Report a vulnerability"
3. Fill out the form with details about the vulnerability

You should receive a response within 48 hours. If for some reason you do not, please follow up to ensure we received your original message.

Please include the following information in your report:

- Type of issue (e.g., buffer overflow, SQL injection, cross-site scripting, etc.)
- Full paths of source file(s) related to the manifestation of the issue
- The location of the affected source code (tag/branch/commit or direct URL)
- Any special configuration required to reproduce the issue
- Step-by-step instructions to reproduce the issue
- Proof-of-concept or exploit code (if possible)
- Impact of the issue, including how an attacker might exploit it

## Security Considerations

### AI Provider Integration

When using AI-powered linting features:

1. **API Keys**: Never hardcode API keys in your application. Use environment variables or secure key management systems.
2. **Data Privacy**: Be aware that document content is sent to your chosen AI provider. Ensure this complies with your data privacy requirements.
3. **Rate Limiting**: Implement rate limiting and caching for AI provider calls to prevent cost overruns and API abuse.
4. **Input Validation**: The library validates AI responses, but malformed responses are logged and ignored rather than crashing the editor.

### Content Security

1. **XSS Prevention**: The library does not render arbitrary HTML. All text is inserted as plain text nodes in ProseMirror.
2. **User Input**: Custom popover renderers should sanitize any user input before rendering to prevent XSS attacks.
3. **Event Handlers**: Event listeners are properly cleaned up when popovers are closed to prevent memory leaks.

### Dependencies

Current known vulnerabilities in development dependencies:

- **esbuild** (≤0.24.2): Moderate severity - allows websites to send requests to development server
  - Impact: Development only, does not affect production builds
  - Mitigation: Only use `npm run dev` on trusted networks
  - Fix: Awaiting compatible vite/vitest updates

## Best Practices

When using tiptap-linter in production:

1. **Regular Updates**: Keep the library and its dependencies up to date
2. **Review Custom Plugins**: Audit any custom lint plugins for security issues
3. **AI Provider Security**: Use secure, authenticated API endpoints for AI providers
4. **Content Validation**: Validate document content before processing with AI plugins
5. **Error Handling**: Monitor error logs for unusual patterns that might indicate attacks

## Disclosure Policy

When we receive a security bug report, we will:

1. Confirm the problem and determine affected versions
2. Audit code to find any similar problems
3. Prepare fixes for all supported versions
4. Release new versions as soon as possible

## Comments on this Policy

If you have suggestions on how this policy could be improved, please submit a pull request or open an issue.
