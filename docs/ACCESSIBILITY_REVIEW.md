# Accessibility Review

Phase 16 adds visible keyboard focus, a minimum 44 × 44 CSS-pixel target for interactive controls, reduced-motion handling, status/alert semantics and labelled icon-only controls. Notification switches use native checkboxes and remain associated with their descriptive labels. Deep-link navigation retains the normal screen heading and server error handling.

Manual release checks:

- Complete login, notification preference changes, task completion and approval decision using keyboard or switch navigation only.
- Verify TalkBack and VoiceOver announce screen headings, location choice, bucket state, checklist state, errors and destructive device revocation.
- Test 200% text size and landscape without clipped decision buttons or hidden order totals.
- Confirm graphite/mint, warning and error states meet WCAG AA contrast with the production theme.
- Verify reduced-motion mode removes nonessential motion and that focus does not become trapped in bottom sheets.
- Test notification permission denied/permanently denied and an empty device list without relying on colour alone.

Native screen-reader and contrast certification must be repeated on signed release builds because WebView, OS font scaling and store build settings can affect results.
