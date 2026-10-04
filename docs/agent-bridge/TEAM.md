# Aris login team — current coordination contract

> [!IMPORTANT]
> **ACTIVE BRIEF (2026-09-18):** V4 and all prior briefs are superseded by [`v5-interactive-spectacle.md`](v5-interactive-spectacle.md) ("Aris — Trường cộng hưởng / Resonance"). Earlier bans on spheres/rings/galaxies are cancelled. Antigravity is the sole coder for `docs/design-lab/aris-login-v5/`.

Updated 2026-09-18 by the active Codex coordinator and Antigravity.

## User instruction

Invite Antigravity to collaborate. Antigravity is the primary coder because the user prefers its lower cost. Codex and Claude supervise the design and implementation. The goal is an original, immediately impressive animated login. The two reference sites establish a quality bar; copying their galaxies, particle spheres or compositions is not the objective. The user has not chosen a concept. The team should develop and critique concepts together without repeatedly asking the user to choose implementation details.

## Ownership

- **Antigravity:** sole implementation owner for the NEXT iteration, under `docs/design-lab/aris-login-v3/`. Produce visual studies, implement the chosen direction, test it, and provide screenshots and actual motion recordings. Start by inspecting existing artifacts and proposing a short implementation approach. Do not change v2 while Claude finishes its current bounded work.
- **Claude:** design critic and technical reviewer. Finish any already-running bounded capture, preserve the current v2 state, then stop prototype source edits. Respond to Codex's concept discussion and review Antigravity's actual outputs. Do not spawn more independent Codex sessions. Do not implement a competing v3.
- **Codex (this active session):** coordinator, art-direction synthesis and independent acceptance checks. Maintain the approved brief and focused revision requests; inspect evidence. Do not edit prototype source concurrently with Antigravity.

These are coordination instructions, not an enforced filesystem lock. Report any accidental overlapping work promptly.

## Working boundaries

Only isolated prototype and coordination artifacts are authorized. Preserve Razor/application source, authentication, database and the running app server on 5025. Simulate authentication states; do not send email or initiate real OAuth. Preserve earlier prototypes. No deploy or source integration in this phase.

## First round

1. Read `docs/ui-redesign/05-claude-login-design-dialogue.md`, including the latest clarification at its top. The sculpture critique is feedback on an existing candidate, not a locked concept.
2. Claude and Antigravity independently propose or challenge the candidate directions. Each reply should explain the first-frame composition, one memorable motion gesture, what gives it an Aris identity, and the biggest risk of it looking generic. A maximum of three short alternatives is enough.
3. Antigravity may prepare an isolated v3 scaffold and inexpensive static composition studies immediately. Do not begin a costly full animation rewrite before the team selects a concept. Keep the form functional from first paint in all studies.
4. Codex writes the selected concept and a bounded implementation brief in `docs/agent-bridge/approved-login-concept.md`. This is internal coordination within already-authorized work; no further user permission is needed.
5. Antigravity implements that brief, then provides reviewable evidence. Claude and Codex critique the result and return specific corrections. Antigravity remains the coder for corrections.

## Communication

- Antigravity's invitation acknowledgement: the JSON response specified in the request, under `docs/agent-bridge/outbox/`.
- Antigravity's proposal and progress: `docs/agent-bridge/antigravity/design-response.md`.
- Claude's response and review: `docs/agent-bridge/claude/reply-to-codex.md`. Explicitly acknowledge the switch to reviewer.
- Codex's feedback: `docs/agent-bridge/codex/review.md` and the approved concept file above.
- Agents must read the latest TEAM.md and relevant feedback before a new work chunk. After writing a reply, check for follow-up feedback for up to two minutes using short waits; if none arrives, state that work is awaiting team review instead of claiming a daemon or ongoing monitoring.
- Include artifact paths and timestamps in progress updates. Distinguish queued messages, acknowledged messages, completed work and independently verified work.

## Review evidence required

The user has reiterated that an impressive, fully animated experience at the aspirational craft level of the reference sites is the main acceptance criterion. Review the added quality gate at the top of approved-login-concept.md. Phase A stills are an internal checkpoint, not the finished deliverable. Functional checks alone do not constitute visual acceptance.

- A settled desktop frame, a mobile frame, and a real 12–20 second recording covering entrance, pointer interaction and input focus. Identify the build being shown so older screenshots are not mistaken for current output.
- Inspect screenshots before claiming visual success. Explain what was improved after inspection.
- Confirm no console exceptions when focusing, typing, submitting and changing states. Check invalid email, pending request, accepted request, resend and recoverable error. Acceptance of a request is not successful authentication.
- Check reduced motion, keyboard operation, 320px/390px widths, ordinary desktop sizes, no clipped primary controls, and no artwork intercepting form input.
- Technology is chosen for the visual goal. Three.js is allowed; unsupported performance claims or automatic downgrades to an inadequate effect are not. Avoid dependencies in the ASP.NET application.

Report actual checks and gaps. A well-written report does not substitute for an impressive rendered result.
