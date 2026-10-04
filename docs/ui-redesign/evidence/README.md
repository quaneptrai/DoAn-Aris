# Audit evidence and attribution

Captured 18 September 2026. Application screenshots use the isolated local Audit host with no user data or authenticated session.

| File | Origin | What it proves |
|---|---|---|
| [register-desktop.png](register-desktop.png) | Local `/Account/Register`, Chrome, 1440 × 1000 | Current desktop rendering; measured scroll width 1440, card width 432 |
| [register-mobile.png](register-mobile.png) | Same route, Chrome device emulation, 390 × 844, device scale factor 1 | Current mobile rendering; measured scroll width 390, card width 334 |
| [reference-job-ui-kit.png](reference-job-ui-kit.png) | Public Job UI Kit / Jobizz preview linked from [Free Figma Templates](https://www.freefigmatemplates.com/gallery/job-ui-kit) | One visually inspected reference preview; not the editable Figma file or proof of reuse rights |

Job UI Kit preview source: https://uploads-ssl.webflow.com/600b6ab92506fd10a1ca3f8a/6288ab66ef00fad33b999b6c_Job%20UI%20Kit%20cover.png

Publisher attributes the resource to Zee Free Templates. Preserve attribution. The preview is research evidence only; do not ship its artwork, logos or example profile photography as an Aris asset. Exact editable-file licensing still needs verification.

Direct Figma Community access was restricted. The alternative onboarding-preview request returned 404 and no image was saved for it. No claim of inspecting hidden layers, component variants, prototype interactions or design tokens is made.

The source screenshot `ArisSkyve/UI.png` was checked but is an unrelated Facebook-media reference, not a current Aris screen; it was not used as evidence of the application's appearance.

Read [the audit](../01-audit.md) for the recorded HTTP status table and [the plan](../03-execution-plan.md) for tests still required. No database-backed or online journey was completed in this audit.
