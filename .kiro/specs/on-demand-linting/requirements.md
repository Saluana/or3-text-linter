# Requirements Document

## Introduction

This feature enables users to run specific linter rules on demand rather than having all configured rules run automatically. Users should be able to programmatically trigger a single linter rule (either sync or async/AI-powered) and receive only the issues from that specific rule. Additionally, users can disable automatic linting entirely and configure per-plugin settings to control which rules run automatically versus on-demand. This is useful for performance optimization, targeted analysis, and user-controlled linting workflows.

## Glossary

-   **Linter**: The Tiptap extension that manages lint plugins and displays issues as decorations
-   **LinterPlugin**: A synchronous plugin class that scans documents for issues
-   **AILinterPlugin**: An asynchronous plugin class that uses AI providers to detect issues
-   **Issue**: A detected problem in the document with position, message, severity, and optional fix
-   **On-Demand Linting**: Running a specific linter rule manually rather than automatically on document changes
-   **Rule**: A single linter plugin class (either sync or async)
-   **Automatic Linting**: The default behavior where all enabled plugins run on document changes
-   **Plugin Configuration**: Per-plugin settings that control whether a plugin runs automatically or only on-demand
-   **Custom Severity**: A user-defined severity level with a custom name and color for issue categorization beyond the default info/warning/error levels
-   **Ignored Issue**: An issue that the user has explicitly dismissed and should not be shown again at the same position with the same message

## Requirements

### Requirement 1

**User Story:** As a developer, I want to run a single linter rule on command, so that I can get targeted feedback without running all configured rules.

#### Acceptance Criteria

1. WHEN a developer calls the runRule method with a specific plugin class THEN the Linter SHALL execute only that plugin and return its issues
2. WHEN a developer calls runRule with a sync plugin THEN the Linter SHALL return a Promise that resolves with the issues array
3. WHEN a developer calls runRule with an async plugin THEN the Linter SHALL return a Promise that resolves with the issues array after the async operation completes
4. WHEN runRule completes THEN the Linter SHALL NOT modify the current decoration state or stored issues

### Requirement 2

**User Story:** As a developer, I want on-demand linting to work with both sync and AI-powered rules, so that I can use this feature regardless of the rule type.

#### Acceptance Criteria

1. WHEN runRule is called with a LinterPlugin subclass THEN the Linter SHALL execute the plugin synchronously and return results
2. WHEN runRule is called with an AILinterPlugin subclass THEN the Linter SHALL execute the plugin asynchronously and await results
3. WHEN runRule is called with an invalid plugin class THEN the Linter SHALL reject the Promise with a descriptive error

### Requirement 3

**User Story:** As a developer, I want to optionally apply the results of on-demand linting to the editor, so that I can choose whether to display the issues.

#### Acceptance Criteria

1. WHEN runRule is called with applyResults option set to true THEN the Linter SHALL update decorations to show only issues from that rule
2. WHEN runRule is called with applyResults option set to false or omitted THEN the Linter SHALL return issues without modifying decorations
3. WHEN applyResults is true and the rule produces issues THEN the Linter SHALL create decorations for each issue

### Requirement 4

**User Story:** As a developer, I want to access the runRule functionality through the editor instance, so that I can easily integrate on-demand linting into my application.

#### Acceptance Criteria

1. WHEN the Linter extension is configured THEN the editor storage SHALL expose a runRule method
2. WHEN runRule is called THEN the method SHALL accept a plugin class and an optional options object
3. WHEN runRule is called on an editor without the Linter extension THEN the call SHALL fail gracefully with an appropriate error

### Requirement 5

**User Story:** As a developer, I want on-demand linting to handle errors gracefully, so that my application remains stable even if a rule fails.

#### Acceptance Criteria

1. WHEN a sync plugin throws an error during on-demand execution THEN the Linter SHALL reject the Promise with the error
2. WHEN an async plugin rejects during on-demand execution THEN the Linter SHALL propagate the rejection to the caller
3. WHEN a plugin produces invalid issues THEN the Linter SHALL filter them out and return only valid issues

### Requirement 6

**User Story:** As a developer, I want to disable automatic linting entirely, so that I can control exactly when linting occurs.

#### Acceptance Criteria

1. WHEN the Linter is configured with autoLint option set to false THEN the Linter SHALL NOT run any plugins automatically on document changes
2. WHEN autoLint is false and the document changes THEN the Linter SHALL NOT update decorations or stored issues
3. WHEN autoLint is false THEN the developer SHALL still be able to run rules on-demand using runRule
4. WHEN autoLint is true or omitted THEN the Linter SHALL run plugins automatically on document changes as the default behavior

### Requirement 7

**User Story:** As a developer, I want to configure individual plugins to run only on-demand, so that I can have some rules run automatically while others require manual triggering.

#### Acceptance Criteria

1. WHEN a plugin is configured with mode set to onDemand THEN the Linter SHALL NOT run that plugin automatically on document changes
2. WHEN a plugin is configured with mode set to auto or omitted THEN the Linter SHALL run that plugin automatically on document changes
3. WHEN plugins are configured with mixed modes THEN the Linter SHALL respect each plugin individual mode setting
4. WHEN runRule is called with a plugin configured as onDemand THEN the Linter SHALL execute that plugin and return its issues

### Requirement 8

**User Story:** As a developer, I want to register custom severity levels with custom colors, so that I can categorize issues beyond the default info/warning/error levels.

#### Acceptance Criteria

1. WHEN the Linter is configured with a customSeverities option THEN the Linter SHALL accept an array of severity definitions with name and color properties
2. WHEN a plugin records an issue with a custom severity name THEN the Linter SHALL apply the corresponding custom color to the decoration
3. WHEN a custom severity is used THEN the Linter SHALL generate CSS classes using the severity name for both inline highlights and lint icons
4. WHEN a custom severity color is specified THEN the Linter SHALL use that color for the underline and icon background styling
5. WHEN an issue uses an unregistered severity name THEN the Linter SHALL fall back to the default warning styling

### Requirement 9

**User Story:** As a user, I want to ignore specific lint issues via a button in the popover, so that I can dismiss false positives without fixing them.

#### Acceptance Criteria

1. WHEN a popover is displayed for an issue THEN the popover SHALL include an ignore button
2. WHEN the user clicks the ignore button THEN the Linter SHALL remove the decoration for that specific issue
3. WHEN an issue is ignored THEN the Linter SHALL add the issue to an ignored issues list in storage
4. WHEN the document is re-linted THEN the Linter SHALL NOT display decorations for previously ignored issues at the same position with the same message
5. WHEN the ignore action is provided to custom popover renderers THEN the PopoverActions interface SHALL include an ignore method
