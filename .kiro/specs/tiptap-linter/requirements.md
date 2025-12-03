# Requirements Document

## Introduction

This feature implements an improved Tiptap/ProseMirror linter extension that addresses correctness issues, type safety, performance, and UX improvements identified in the analysis of the existing linter pattern. The linter runs configurable lint plugins over ProseMirror documents, collects issues, and renders decorations to highlight problems with interactive fix capabilities.

## Glossary

-   **Linter**: A Tiptap extension that runs lint plugins and manages decorations for detected issues
-   **LinterPlugin**: A base class that scans ProseMirror documents and records lint issues
-   **Issue/Result**: An object containing message, position range, severity, and optional fix function for a detected problem
-   **Decoration**: ProseMirror visual overlay (inline highlight or widget icon) indicating a lint issue
-   **DecorationSet**: ProseMirror collection of decorations applied to the document view
-   **Fix Function**: A callback that applies an automatic correction for a detected issue
-   **Severity**: Classification of issue importance (info, warning, error)

## Requirements

### Requirement 1: Core Linter Extension

**User Story:** As a developer, I want a Tiptap linter extension that runs configurable lint plugins, so that I can detect and highlight document issues.

#### Acceptance Criteria

1. WHEN the editor initializes THEN the Linter extension SHALL run all configured plugins and create a DecorationSet from the results
2. WHEN a transaction changes the document THEN the Linter extension SHALL rerun all plugins and rebuild the DecorationSet
3. WHEN a transaction does not change the document THEN the Linter extension SHALL reuse the existing DecorationSet
4. WHEN plugins return issues THEN the Linter extension SHALL create inline decorations with severity-based CSS classes for each issue range
5. WHEN plugins return issues THEN the Linter extension SHALL create widget decorations with clickable icons at each issue position

### Requirement 2: Issue Data Model

**User Story:** As a developer, I want a well-typed issue data model with severity levels, so that I can distinguish between different types of problems.

#### Acceptance Criteria

1. WHEN an issue is recorded THEN the Issue object SHALL contain message, from position, to position, and severity fields
2. WHEN an issue has an automatic fix THEN the Issue object SHALL contain a typed fix function that accepts EditorView and Issue parameters
3. WHEN severity is specified THEN the Issue object SHALL accept one of three values: info, warning, or error
4. WHEN severity is not specified THEN the Issue object SHALL default to warning severity

### Requirement 3: Base LinterPlugin Class

**User Story:** As a plugin author, I want a base LinterPlugin class with proper typing and helpers, so that I can easily create custom lint rules.

#### Acceptance Criteria

1. WHEN a LinterPlugin is constructed THEN the plugin SHALL store a typed ProseMirror document reference
2. WHEN scan is called THEN the plugin SHALL return itself for method chaining
3. WHEN record is called THEN the plugin SHALL add an Issue to the internal results array with the provided message, positions, severity, and optional fix
4. WHEN getResults is called THEN the plugin SHALL return all recorded Issue objects

### Requirement 4: Regex-Based Plugin Scanning

**User Story:** As a plugin author, I want regex scanning that finds all matches in text nodes, so that multiple issues per node are detected.

#### Acceptance Criteria

1. WHEN a regex plugin scans a text node THEN the plugin SHALL find all regex matches in that node, not just the first match
2. WHEN a regex plugin starts scanning a new text node THEN the plugin SHALL reset the regex lastIndex to zero
3. WHEN multiple matches exist in a single text node THEN the plugin SHALL record a separate issue for each match

### Requirement 5: BadWords Plugin

**User Story:** As an editor user, I want a plugin that detects discouraged words, so that I can improve my writing style.

#### Acceptance Criteria

1. WHEN scanning text nodes THEN the BadWords plugin SHALL detect words matching the configured pattern (obviously, clearly, evidently, simply by default)
2. WHEN a bad word is found THEN the BadWords plugin SHALL record an issue with a message indicating which word to avoid
3. WHEN multiple bad words exist in one text node THEN the BadWords plugin SHALL record an issue for each occurrence

### Requirement 6: Punctuation Plugin

**User Story:** As an editor user, I want a plugin that detects suspicious punctuation spacing, so that I can fix formatting errors.

#### Acceptance Criteria

1. WHEN scanning text nodes THEN the Punctuation plugin SHALL detect spaces before punctuation marks (comma, period, exclamation, question, colon)
2. WHEN suspicious spacing is found THEN the Punctuation plugin SHALL record an issue with a fix function
3. WHEN the fix function is invoked THEN the Punctuation plugin SHALL replace the malformed text with properly spaced punctuation
4. WHEN multiple punctuation issues exist in one text node THEN the Punctuation plugin SHALL record an issue for each occurrence

### Requirement 7: HeadingLevel Plugin

**User Story:** As an editor user, I want a plugin that detects heading level jumps, so that I can maintain proper document hierarchy.

#### Acceptance Criteria

1. WHEN scanning heading nodes THEN the HeadingLevel plugin SHALL track the last seen heading level
2. WHEN a heading level jumps by more than one from the previous heading THEN the HeadingLevel plugin SHALL record an issue
3. WHEN a heading issue is recorded THEN the HeadingLevel plugin SHALL include a fix function that adjusts the heading to the correct level
4. WHEN the fix function is invoked THEN the HeadingLevel plugin SHALL use the stored node position to set the correct heading level

### Requirement 8: Click Interaction Handling

**User Story:** As an editor user, I want to click lint icons to select problem text and double-click to auto-fix, so that I can quickly address issues.

#### Acceptance Criteria

1. WHEN a user clicks a lint icon THEN the Linter extension SHALL select the issue text range and scroll it into view
2. WHEN a user double-clicks a lint icon with a fix function THEN the Linter extension SHALL execute the fix and focus the editor
3. WHEN detecting click targets THEN the Linter extension SHALL use closest traversal to find the lint icon element
4. WHEN a lint icon is clicked THEN the Linter extension SHALL retrieve the issue from the icon element's attached data

### Requirement 9: Severity-Based Styling

**User Story:** As an editor user, I want visual distinction between issue severities, so that I can prioritize which problems to address.

#### Acceptance Criteria

1. WHEN rendering inline decorations THEN the Linter extension SHALL apply CSS classes based on issue severity (problem--info, problem--warning, problem--error)
2. WHEN rendering widget icons THEN the Linter extension SHALL apply CSS classes based on issue severity
3. WHEN styling is applied THEN the CSS SHALL provide distinct visual appearance for each severity level

### Requirement 10: Issues Storage API

**User Story:** As a developer, I want to access the current list of issues programmatically, so that I can build external UI components like issue panels.

#### Acceptance Criteria

1. WHEN the Linter extension initializes THEN the extension SHALL expose a storage API for accessing issues
2. WHEN issues are computed THEN the Linter extension SHALL update the storage with the current issue list
3. WHEN getIssues is called on the storage THEN the API SHALL return the current array of Issue objects

### Requirement 11: Vue Component Integration

**User Story:** As a developer, I want a Vue component that demonstrates the linter, so that I can understand how to integrate it.

#### Acceptance Criteria

1. WHEN the Vue component mounts THEN the component SHALL create a Tiptap editor with the Linter extension configured
2. WHEN the Vue component unmounts THEN the component SHALL destroy the editor instance
3. WHEN rendering THEN the component SHALL include CSS styles for problem highlights and lint icons with severity variants

### Requirement 12: Async Plugin Support

**User Story:** As a plugin author, I want to create async lint plugins, so that I can integrate AI-powered linting without blocking the editor.

#### Acceptance Criteria

1. WHEN a plugin's scan method returns a Promise THEN the Linter extension SHALL await the result before processing issues
2. WHEN an async plugin is scanning THEN the Linter extension SHALL allow the editor to remain responsive
3. WHEN multiple async plugins are configured THEN the Linter extension SHALL run the plugins concurrently and collect all results
4. WHEN an async plugin throws an error THEN the Linter extension SHALL catch the error and continue processing other plugins

### Requirement 13: AI Linter Plugin Base Class

**User Story:** As a plugin author, I want a base class for AI-powered lint plugins, so that I can easily integrate LLM providers like OpenAI, OpenRouter, or Vercel AI SDK.

#### Acceptance Criteria

1. WHEN an AILinterPlugin is constructed THEN the plugin SHALL accept a configuration object with provider-agnostic options
2. WHEN the AILinterPlugin scans THEN the plugin SHALL extract text content from the document for analysis
3. WHEN the AILinterPlugin receives AI responses THEN the plugin SHALL parse the response and record issues with correct document positions
4. WHEN implementing an AI plugin THEN the plugin author SHALL provide their own API client (OpenAI SDK, OpenRouter, Vercel AI SDK, or custom)
5. WHEN no AI SDK is installed THEN the core linter package SHALL function without errors

### Requirement 14: AI Plugin Configuration

**User Story:** As a developer, I want to configure AI plugins with custom prompts and settings, so that I can tailor AI linting to my needs.

#### Acceptance Criteria

1. WHEN configuring an AI plugin THEN the developer SHALL provide a function that calls their chosen AI provider
2. WHEN configuring an AI plugin THEN the developer MAY specify a custom system prompt for the AI
3. WHEN configuring an AI plugin THEN the developer MAY specify debounce timing to limit API calls
4. WHEN configuring an AI plugin THEN the developer MAY specify which text content to analyze (full document, selection, or changed ranges)

### Requirement 15: AI Response Parsing

**User Story:** As a plugin author, I want helpers for parsing AI responses into lint issues, so that I can focus on the AI integration logic.

#### Acceptance Criteria

1. WHEN an AI returns structured issue data THEN the AILinterPlugin SHALL provide a helper to convert responses to Issue objects
2. WHEN an AI returns text positions THEN the AILinterPlugin SHALL provide helpers to map text offsets to ProseMirror positions
3. WHEN an AI suggests fixes THEN the AILinterPlugin SHALL support creating fix functions from AI-provided replacement text
4. WHEN parsing AI responses THEN the AILinterPlugin SHALL handle malformed responses gracefully without crashing

### Requirement 16: Natural Language Lint Rules

**User Story:** As a non-technical user, I want to create lint rules by writing plain English descriptions, so that I can customize linting without writing code.

#### Acceptance Criteria

1. WHEN a natural language rule is configured THEN the Linter extension SHALL accept a plain English string describing the desired writing style or constraint
2. WHEN scanning with a natural language rule THEN the AI plugin SHALL send the rule description and document text to the configured AI provider
3. WHEN the AI identifies violations THEN the plugin SHALL convert the AI response into Issue objects with human-readable messages
4. WHEN the AI suggests corrections THEN the plugin SHALL create fix functions that apply the suggested text replacements
5. WHEN multiple natural language rules are configured THEN the Linter extension SHALL evaluate each rule and aggregate all issues

### Requirement 17: Natural Language Rule Factory

**User Story:** As a developer, I want a simple factory function to create AI lint plugins from English descriptions, so that adding custom rules requires minimal code.

#### Acceptance Criteria

1. WHEN createNaturalLanguageRule is called with a rule description THEN the factory SHALL return a configured AILinterPlugin class
2. WHEN createNaturalLanguageRule is called THEN the developer SHALL provide their AI provider function as a required parameter
3. WHEN createNaturalLanguageRule is called THEN the developer MAY provide optional severity level for issues found by this rule
4. WHEN createNaturalLanguageRule is called THEN the developer MAY provide optional debounce timing for the rule
5. WHEN the created plugin scans THEN the plugin SHALL use a system prompt that instructs the AI to find violations of the natural language rule and return structured issue data
