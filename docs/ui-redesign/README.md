# Aris UI redesign and flow repair — agent handoff

Prepared 18 September 2026. Scope: research, inspection, local read-only checks, and implementation planning. Application source and configuration were not edited. Build outputs were refreshed by a successful build. No database migrations, account changes, email delivery, external sharing, or deployment were performed.

## Start here

**Current login collaboration:** see [team ownership and review workflow](../agent-bridge/TEAM.md) and [the active Claude–Codex design dialogue](05-claude-login-design-dialogue.md). Antigravity is the primary coder for isolated V3; Claude and Codex supervise. Current concept exploration is open and takes precedence over locking the earlier V2 sculpture proposal.

Give the next agent this instruction:

> Read `docs/ui-redesign/01-audit.md`, `02-design-direction.md`, and `03-execution-plan.md` before implementing. Keep ASP.NET Core MVC, Razor, Bootstrap, and the existing product capabilities. First establish an isolated local development database and repair authentication, onboarding ownership, and confirmed broken routes. Then implement the shared design system and redesign all 19 full-page surfaces, prioritizing Jobs/Index, Register, NewUserInfor, and Dashboard/Index. Follow the task dependencies and acceptance criteria. Treat source findings, proposed behavior, and runtime evidence as distinct. Do not copy paid Figma assets, use production data as test fixtures, fabricate metrics, or declare untested flows complete. Finish local validation before preparing online deployment. Report each gate with evidence.

Read in this order:

1. [Audit: actual pages, defects, and runtime evidence](01-audit.md).
2. [Design direction: Figma references, all-page specification, components, and states](02-design-direction.md).
3. [Execution plan: agent ownership, dependencies, local setup, tests, and online gates](03-execution-plan.md).
4. [Evidence and reference attribution](evidence/README.md).
5. [Antigravity login prototype V2 assignment](04-antigravity-login-art-direction.md) — later user feedback requests a more striking original visual and real motion; this supersedes the earlier restrained login art direction. Implementation is delegated through the local agent bridge, with application changes excluded from this prototype iteration.

## Most important findings

| Priority | Finding | Evidence |
|---|---|---|
| P0 | Onboarding accepts a caller-supplied user ID, changes the associated profile, and signs in that user without an evident ownership check | AccountController source; not exploited |
| P0 | Development secrets reference a remote/unknown SQL target and startup runs a database-writing seeder | Configuration structure and Program.cs; remote DB not accessed |
| P1 | The CV tab calls `/Resume/Index`, which returns 404; canonical list route is `/Resume` | Source + isolated localhost GET |
| P1 | Interview links use `/Interview/Room/{id}`, which returns 404 | Source + isolated localhost GET |
| P1 | Signed-out protected pages challenge Google directly | Source + localhost 302 inspection |
| P1 | `/Profile/Index` errors for an anonymous visitor; configured `/Home/Error` is missing | Source + localhost 500/404 |
| P1 | Onboarding validation can lose its hidden user ID on redisplay and has inconsistent student-field handling | Source; needs a local fixture reproduction |
| P1 | Job filtering covers only loaded cards; bookmark control has no persistence | Source |
| P1 | CV uploading and some services bypass environment-specific API configuration | Source; online integration not exercised |

Build: `dotnet build ArisSkyve/ArisSkyve.csproj --no-restore --nologo` passed with **65 warnings, 0 errors** using SDK 10.0.302. This is compilation evidence, not an end-to-end pass.

The proposed visual direction is **Aris Career Studio**: preserve the blue trajectory mark, use clear light surfaces for work, retain one restrained dark brand panel, and express personality through typography, career progress, and thoughtfully composed job cards. Preserve the social feed on Dashboard/Index and distinguish it from the employer analytics dashboard.

## Boundaries and assumptions

- Existing source, configuration key names, public design descriptions, and a Job UI Kit preview were inspected. Figma Community links were discovered, but editable layers could not be inspected because Figma is not connected and direct Community access was restricted.
- Register was inspected in a real headless Chrome session at desktop and emulated mobile widths. Other authenticated screens were reviewed from source; no authenticated screenshot fidelity claims are made.
- The isolated audit host used a custom `Audit` environment, placeholder OAuth configuration, and an intentionally unavailable loopback SQL/API target. It skipped the Development seeder and did not load Production configuration or Development user secrets.
- Initial sandbox restrictions prevented ASP.NET key creation and Chrome startup. Both succeeded after tool approval for isolated local execution. Those restrictions are not product defects.
- Default product copy is proposed as Vietnamese, with consistent English technical terms such as CV. This is an assumption based on current content and audience, not a requested translation of the whole product.
- Existing authentication gates remain unless the product owner explicitly wants public job/company discovery. Do not make private pages public to make tests pass.
- Online deployment destination and provider access have not been confirmed. Online readiness is a future gate, not an achieved result.
- No AGENTS.md was found in the workspace. This checkout has no Git metadata at its root; establish version control or a source backup before future implementation.
