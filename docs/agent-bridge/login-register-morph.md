# Addendum: living transparent login and registration card

Latest user request, 2026-09-18: the same nano bodies must also transform the login card into a registration card, changing headings and fields. This adds to `word-to-transparent-card.md`; it does not replace the ARIS intro or transparency. AGY is sole coder; Codex and Claude review only.

## Required experience

- Floating bodies form ARIS, then form the transparent login card as already directed.
- Replace the current registration-link notice stub with an actual registration mode in this isolated prototype. A clearly labelled return-to-login control reverses the transformation.
- Interpret the user's 'after login' as after the login screen is formed / selecting registration. Do NOT automatically ask an authenticated user to register, and do not treat a simulated successful sign-in as a registration trigger.
- On explicit mode switch: a controlled subset of the SAME nano bodies detaches/dissolves into depth, follows coherent short arcs, and reassembles around the new card silhouette. Keep identifiable continuity; do not destroy/recreate the scene or replay ARIS. The card grows to accommodate registration content, and headings and real HTML fields change in sync with reassembly.
- No plain crossfade between two unrelated cards. Preserve the transparent surface and perceived material continuity. Keep final rim refined rather than a thick beaded necklace. Restrained blur and low-alpha glass must visibly show the scene behind.
- Target a decisive 0.7-1.1 second user-triggered morph, then a stable usable form. No unsolicited looping. Rapid repeated clicks must resolve predictably without duplicate forms/timers or stuck disabled controls.

## Form and interaction boundaries

Preserve the current passwordless email-login concept. Registration can add full name and email with an appropriate 'Create account' action and back-to-login link; do not invent password requirements or imply backend integration. Label all fields visibly. Preserve typed email across mode changes, retain other draft values when returning, and never submit on mode switch. Validate registration name/email and clearly simulate its accepted/loading/error state without making accounts, sending email, or initiating OAuth.

During switching, outgoing hidden controls must not remain focusable. Restore focus to the new mode's heading or first suitable field when transition completes, announce mode accessibly, and keep Escape/reverse actions sensible. Reduced motion goes directly to each final state, and WebGL fallback still allows both real HTML forms. Skip-intro and replay must not strand registration in an inconsistent scene mode.

Measure the rendered card rectangle after the new content/layout has changed and keep 3D perimeter targets aligned during growth, on resize and on mobile scrolling. At 390px and 320px, allow natural vertical scroll to all registration controls, no horizontal overflow. Do not restart intro on input focus or viewport resize.

## Delivery and verification

Work only inside the existing V5 prototype and associated review evidence; preserve app/auth/backend files and the independent server at http://127.0.0.1:5183. Do not start another port or kill the server. Check current source first: earlier CLI may have ended after implementing ARIS-to-card but before capturing it. Finish both sequences rather than relying on old reports.

Capture the current build's readable ARIS, ARIS-to-card midpoint, final transparent login, login-to-registration midpoint, final registration, and reverse transition. Verify keyboard/focus, preserved email, reduced motion, mobile scroll, and zero runtime exceptions. Await captures before reporting. Update a new focused report rather than repeating the stale pearl-bay report.
