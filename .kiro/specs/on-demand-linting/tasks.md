# Implementation Plan

-   [x] 1. Extend type definitions and interfaces

    -   [x] 1.1 Add PluginConfig, CustomSeverity, IgnoredIssue, and RunRuleOptions interfaces to types.ts
        -   Add PluginConfig with plugin and mode properties
        -   Add CustomSeverity with name and color properties
        -   Add IgnoredIssue with from, to, and message properties
        -   Add RunRuleOptions with applyResults property
        -   Update Severity type to accept string for custom severities
        -   _Requirements: 7.1, 8.1_
    -   [x] 1.2 Extend PopoverActions interface with ignore method
        -   Add ignore(): void method signature
        -   _Requirements: 9.5_
    -   [x] 1.3 Update LinterOptions interface to support new configuration
        -   Add autoLint optional boolean property
        -   Add customSeverities optional array property
        -   Update plugins type to accept PluginConfig objects
        -   _Requirements: 6.1, 7.1, 8.1_

-   [x] 2. Implement plugin configuration normalization

    -   [x] 2.1 Create normalizePlugins utility function in Linter.ts
        -   Accept mixed array of plugin classes and PluginConfig objects
        -   Return array of NormalizedPlugin with pluginClass and mode
        -   Default mode to 'auto' when not specified
        -   _Requirements: 7.2_
    -   [x] 2.2 Write property test for plugin mode filtering
        -   **Property 5: Plugin mode filtering**
        -   **Validates: Requirements 7.1, 7.2, 7.3, 7.4**

-   [x] 3. Implement autoLint configuration

    -   [x] 3.1 Update Linter extension to respect autoLint option
        -   Check autoLint flag in ProseMirror plugin state init
        -   Skip plugin execution in apply when autoLint is false
        -   Return empty DecorationSet when autoLint is false
        -   _Requirements: 6.1, 6.2, 6.4_
    -   [x] 3.2 Write property test for autoLint disabled behavior
        -   **Property 4: autoLint disabled behavior**
        -   **Validates: Requirements 6.1, 6.2, 6.3**

-   [x] 4. Implement runRule method

    -   [x] 4.1 Add runRule method to LinterStorage
        -   Accept plugin class and optional RunRuleOptions
        -   Detect sync vs async plugin using isAsyncPlugin helper
        -   Execute plugin and collect issues
        -   Return Promise resolving to issues array
        -   _Requirements: 1.1, 1.2, 1.3, 2.1, 2.2, 4.1, 4.2_
    -   [x] 4.2 Implement applyResults option in runRule
        -   When true, update decorations with returned issues
        -   When false or omitted, do not modify decorations or stored issues
        -   Dispatch transaction with metadata to trigger decoration update
        -   _Requirements: 3.1, 3.2, 3.3_
    -   [x] 4.3 Add error handling and validation to runRule
        -   Validate plugin class is a function with expected shape
        -   Reject Promise with descriptive error for invalid plugins
        -   Filter out invalid issues (bad positions)
        -   Propagate plugin errors to caller
        -   _Requirements: 2.3, 5.1, 5.2, 5.3_
    -   [x] 4.4 Write property test for runRule isolation
        -   **Property 1: runRule isolation**
        -   **Validates: Requirements 1.1, 1.4, 3.2**
    -   [x] 4.5 Write property test for runRule Promise resolution
        -   **Property 2: runRule Promise resolution**
        -   **Validates: Requirements 1.2, 1.3, 2.1, 2.2**
    -   [x] 4.6 Write property test for runRule applyResults
        -   **Property 3: runRule applyResults behavior**
        -   **Validates: Requirements 3.1, 3.3**
    -   [x] 4.7 Write property test for error propagation
        -   **Property 10: Error propagation**
        -   **Validates: Requirements 5.1, 5.2**
    -   [x] 4.8 Write property test for invalid issue filtering
        -   **Property 11: Invalid issue filtering**
        -   **Validates: Requirements 5.3**

-   [ ] 5. Checkpoint - Ensure all tests pass

    -   Ensure all tests pass, ask the user if questions arise.

-   [x] 6. Implement custom severity support

    -   [x] 6.1 Create generateCustomSeverityCSS utility function
        -   Accept array of CustomSeverity definitions
        -   Generate CSS for .problem--{name} with background color
        -   Generate CSS for .lint-icon--{name} with background color
        -   Return CSS string
        -   _Requirements: 8.2, 8.3, 8.4_
    -   [x] 6.2 Inject custom severity CSS on Linter initialization
        -   Create or update style element with id 'linter-custom-severities'
        -   Inject into document head
        -   Clean up on extension destroy
        -   _Requirements: 8.2_
    -   [x] 6.3 Update createDecorationSet to handle custom severities
        -   Use severity name directly in class names
        -   Fall back to warning styling for unregistered severities
        -   _Requirements: 8.5_
    -   [x] 6.4 Write property test for custom severity CSS generation
        -   **Property 6: Custom severity CSS generation**
        -   **Validates: Requirements 8.2, 8.3, 8.4**
    -   [x] 6.5 Write property test for custom severity fallback
        -   **Property 7: Custom severity fallback**
        -   **Validates: Requirements 8.5**

-   [x] 7. Implement ignore functionality

    -   [x] 7.1 Add ignoredIssues array and clearIgnoredIssues method to LinterStorage
        -   Initialize ignoredIssues as empty array
        -   Implement clearIgnoredIssues to reset array
        -   _Requirements: 9.3_
    -   [x] 7.2 Add ignore method to PopoverManager actions
        -   Add issue to ignoredIssues storage
        -   Trigger decoration update to remove ignored issue
        -   Close popover after ignoring
        -   _Requirements: 9.2, 9.5_
    -   [x] 7.3 Update createDecorationSet to filter ignored issues
        -   Check each issue against ignoredIssues by from, to, message
        -   Skip decoration creation for matching issues
        -   _Requirements: 9.4_
    -   [x] 7.4 Add ignore button to default popover renderer
        -   Add button with appropriate styling
        -   Wire up click handler to call actions.ignore()
        -   _Requirements: 9.1_
    -   [x] 7.5 Write property test for ignored issue filtering
        -   **Property 8: Ignored issue filtering**
        -   **Validates: Requirements 9.3, 9.4**
    -   [x] 7.6 Write property test for ignore action storage update
        -   **Property 9: Ignore action storage update**
        -   **Validates: Requirements 9.2, 9.3**

-   [x] 8. Update automatic linting to respect plugin modes

    -   [x] 8.1 Modify runSyncPlugins to filter by mode
        -   Only run plugins with mode 'auto' or undefined
        -   Skip plugins with mode 'onDemand'
        -   _Requirements: 7.1, 7.2_
    -   [x] 8.2 Modify runAsyncPlugins to filter by mode
        -   Only run plugins with mode 'auto' or undefined
        -   Skip plugins with mode 'onDemand'
        -   _Requirements: 7.1, 7.2_

-   [x] 9. Update exports and documentation

    -   [x] 9.1 Export new types from index.ts
        -   Export PluginConfig, CustomSeverity, IgnoredIssue, RunRuleOptions
        -   _Requirements: 4.1_
    -   [x] 9.2 Update API documentation in docs/api-reference.md
        -   Document runRule method and options
        -   Document autoLint configuration
        -   Document customSeverities configuration
        -   Document plugin mode configuration
        -   Document ignore functionality
        -   _Requirements: 1.1, 6.1, 7.1, 8.1, 9.1_

-   [x] 10. Final Checkpoint - Ensure all tests pass
    -   Ensure all tests pass, ask the user if questions arise.
