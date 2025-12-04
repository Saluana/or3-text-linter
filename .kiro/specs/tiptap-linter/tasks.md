# Implementation Plan

-   [x] 1. Project setup and core types

    -   [x] 1.1 Initialize bun project with TypeScript, Tiptap, and Vue dependencies
        -   Create package.json with bun as package manager
        -   Install @tiptap/core, @tiptap/pm, @tiptap/vue-3, @tiptap/extension-document, @tiptap/extension-paragraph, @tiptap/extension-heading, @tiptap/extension-text
        -   Install vue, typescript, vitest, fast-check as dev dependencies
        -   Configure tsconfig.json for strict TypeScript
        -   _Requirements: 1.1, 11.1_
    -   [x] 1.2 Create core type definitions
        -   Define Severity type ('info' | 'warning' | 'error')
        -   Define FixFn type signature
        -   Define Issue interface with message, from, to, severity, fix
        -   Define LinterPluginClass and AsyncLinterPluginClass types
        -   _Requirements: 2.1, 2.2, 2.3_
    -   [x] 1.3 Write property test for Issue type constraints
        -   **Property 20: Default Severity**
        -   **Validates: Requirements 2.4**

-   [ ] 2. Base LinterPlugin class

    -   [ ] 2.1 Implement LinterPlugin base class
        -   Constructor accepts typed ProsemirrorNode
        -   Implement record() method with default severity 'warning'
        -   Implement scan() returning this for chaining
        -   Implement getResults() returning Issue array
        -   _Requirements: 3.1, 3.2, 3.3, 3.4_
    -   [ ] 2.2 Write property test for record/getResults round-trip
        -   **Property 2: Record/GetResults Round-Trip**
        -   **Validates: Requirements 3.3, 3.4**

-   [ ] 3. BadWords plugin with all-matches fix

    -   [ ] 3.1 Implement BadWords plugin
        -   Extend LinterPlugin
        -   Define regex for bad words (obviously, clearly, evidently, simply)
        -   Implement scan() that iterates ALL matches using while loop with lastIndex reset
        -   Record issue for each match with word in message
        -   _Requirements: 4.1, 4.2, 4.3, 5.1, 5.2, 5.3_
    -   [ ] 3.2 Write property test for all-matches detection
        -   **Property 1: Regex All-Matches Detection**
        -   **Validates: Requirements 4.1, 4.3, 5.3**
    -   [ ] 3.3 Write property test for BadWords message content
        -   **Property 7: BadWords Detection with Message**
        -   **Validates: Requirements 5.1, 5.2**

-   [ ] 4. Punctuation plugin with fix function

    -   [ ] 4.1 Implement Punctuation plugin
        -   Extend LinterPlugin
        -   Define regex for space before punctuation
        -   Implement scan() with all-matches iteration
        -   Create fix function that replaces with correct spacing
        -   _Requirements: 6.1, 6.2, 6.3, 6.4_
    -   [ ] 4.2 Write property test for Punctuation fix round-trip
        -   **Property 8: Punctuation Fix Round-Trip**
        -   **Validates: Requirements 6.1, 6.2, 6.3**

-   [ ] 5. HeadingLevel plugin with fix function

    -   [ ] 5.1 Implement HeadingLevel plugin
        -   Extend LinterPlugin
        -   Track last heading level during scan
        -   Detect level jumps > 1
        -   Store node position for fix function
        -   Create fix function using setNodeMarkup
        -   _Requirements: 7.1, 7.2, 7.3, 7.4_
    -   [ ] 5.2 Write property test for HeadingLevel detection
        -   **Property 9: HeadingLevel Detection**
        -   **Validates: Requirements 7.2**
    -   [ ] 5.3 Write property test for HeadingLevel fix round-trip
        -   **Property 10: HeadingLevel Fix Round-Trip**
        -   **Validates: Requirements 7.3, 7.4**

-   [ ] 6. Checkpoint

    -   Ensure all tests pass, ask the user if questions arise.

-   [ ] 7. Core Linter extension

    -   [ ] 7.1 Implement icon rendering with severity classes
        -   Create renderIcon function returning IconDivElement
        -   Attach issue to element
        -   Apply severity-based CSS classes
        -   Add accessibility attributes (role, aria-label)
        -   _Requirements: 1.5, 9.2_
    -   [ ] 7.2 Implement runAllLinterPlugins function
        -   Accept doc and plugin array
        -   Instantiate each plugin and call scan()
        -   Handle both sync returns and Promise returns
        -   Collect all issues from getResults()
        -   Create inline decorations with severity classes
        -   Create widget decorations with icons
        -   Return DecorationSet
        -   _Requirements: 1.1, 1.4, 9.1_
    -   [ ] 7.3 Implement Linter extension with ProseMirror plugin
        -   Define LinterOptions interface
        -   Define LinterStorage interface with getIssues()
        -   Implement addOptions() returning plugins array
        -   Implement addStorage() with issues array
        -   Implement addProseMirrorPlugins() with state init/apply
        -   Reuse DecorationSet when docChanged is false
        -   Rebuild DecorationSet when docChanged is true
        -   Update storage.issues after computing
        -   _Requirements: 1.2, 1.3, 10.1, 10.2, 10.3_
    -   [ ] 7.4 Implement click handlers
        -   handleClick: use closest() to find lint-icon
        -   Create TextSelection from issue.from/to
        -   Dispatch transaction with scrollIntoView
        -   handleDoubleClick: execute fix function if present
        -   Focus editor after fix
        -   _Requirements: 8.1, 8.2, 8.3, 8.4_
    -   [ ] 7.5 Write property test for decoration severity classes
        -   **Property 3: Decoration Severity Class Consistency**
        -   **Validates: Requirements 1.4, 9.1, 9.2**
    -   [ ] 7.6 Write property test for storage synchronization
        -   **Property 4: Storage Issues Synchronization**
        -   **Validates: Requirements 10.2, 10.3**
    -   [ ] 7.7 Write property test for DecorationSet reuse
        -   **Property 5: DecorationSet Reuse on Non-Doc Transactions**
        -   **Validates: Requirements 1.3**
    -   [ ] 7.8 Write property test for DecorationSet rebuild
        -   **Property 6: DecorationSet Rebuild on Doc Changes**
        -   **Validates: Requirements 1.2**

-   [ ] 8. Checkpoint

    -   Ensure all tests pass, ask the user if questions arise.

-   [ ] 9. Async plugin support

    -   [ ] 9.1 Update runAllLinterPlugins for async support
        -   Detect if scan() returns Promise
        -   Use Promise.allSettled for concurrent execution
        -   Catch errors and continue with other plugins
        -   Merge sync and async results
        -   _Requirements: 12.1, 12.2, 12.3, 12.4_
    -   [ ] 9.2 Write property test for async plugin awaiting
        -   **Property 11: Async Plugin Awaiting**
        -   **Validates: Requirements 12.1**
    -   [ ] 9.3 Write property test for async error isolation
        -   **Property 12: Async Plugin Error Isolation**
        -   **Validates: Requirements 12.4**

-   [ ] 10. AILinterPlugin base class

    -   [ ] 10.1 Define AI types and interfaces
        -   Define AIProviderFn type
        -   Define AIResponse interface
        -   Define AILinterPluginConfig interface
        -   _Requirements: 13.1, 14.1, 14.2, 14.3, 14.4_
    -   [ ] 10.2 Implement AILinterPlugin base class
        -   Extend LinterPlugin
        -   Constructor accepts config with provider
        -   Implement extractTextWithPositions() for text extraction
        -   Build position map from text offsets to ProseMirror positions
        -   _Requirements: 13.2_
    -   [ ] 10.3 Implement AI response parsing helpers
        -   Implement parseAIResponse() with error handling
        -   Implement findTextPosition() to locate text in document
        -   Implement createTextFix() for replacement fixes
        -   Handle malformed responses gracefully
        -   _Requirements: 13.3, 15.1, 15.2, 15.3, 15.4_
    -   [ ] 10.4 Write property test for text extraction position mapping
        -   **Property 13: AI Text Extraction Position Mapping**
        -   **Validates: Requirements 13.2, 15.2**
    -   [ ] 10.5 Write property test for AI response conversion
        -   **Property 14: AI Response to Issue Conversion**
        -   **Validates: Requirements 13.3, 15.1, 16.3**
    -   [ ] 10.6 Write property test for AI fix function creation
        -   **Property 15: AI Fix Function Creation**
        -   **Validates: Requirements 15.3, 16.4**
    -   [ ] 10.7 Write property test for malformed response handling
        -   **Property 16: AI Response Malformed Handling**
        -   **Validates: Requirements 15.4**

-   [ ] 11. Checkpoint

    -   Ensure all tests pass, ask the user if questions arise.

-   [ ] 12. Natural language rule factory

    -   [ ] 12.1 Implement createNaturalLanguageRule factory
        -   Accept NaturalLanguageRuleConfig with rule string and provider
        -   Return class extending AILinterPlugin
        -   Generate system prompt instructing AI to find violations
        -   Support optional severity and debounce config
        -   _Requirements: 16.1, 16.2, 17.1, 17.2, 17.3, 17.4, 17.5_
    -   [ ] 12.2 Write property test for factory output
        -   **Property 17: Natural Language Rule Factory Output**
        -   **Validates: Requirements 17.1**
    -   [ ] 12.3 Write property test for provider invocation
        -   **Property 18: Natural Language Rule Provider Invocation**
        -   **Validates: Requirements 16.2, 17.5**
    -   [ ] 12.4 Write property test for multiple rules aggregation
        -   **Property 19: Multiple Natural Language Rules Aggregation**
        -   **Validates: Requirements 16.5**

-   [ ] 13. Vue demo component

    -   [ ] 13.1 Create LinterDemo.vue component
        -   Import Tiptap editor and extensions
        -   Configure Linter with BadWords, Punctuation, HeadingLevel
        -   Create sample content with known issues
        -   Implement mounted/beforeUnmount lifecycle
        -   _Requirements: 11.1, 11.2_
    -   [ ] 13.2 Add CSS styles for linter UI
        -   Style .problem with severity variants (--info, --warning, --error)
        -   Style .lint-icon with severity variants
        -   Position icons correctly
        -   _Requirements: 9.3, 11.3_

-   [ ] 14. Export and package structure

    -   [ ] 14.1 Create index.ts with public exports
        -   Export Linter extension
        -   Export LinterPlugin base class
        -   Export AILinterPlugin base class
        -   Export createNaturalLanguageRule factory
        -   Export BadWords, Punctuation, HeadingLevel plugins
        -   Export all types (Issue, Severity, FixFn, etc.)
        -   _Requirements: 13.5_

-   [ ] 15. Final Checkpoint
    -   Ensure all tests pass, ask the user if questions arise.
