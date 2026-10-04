# Local UI redesign pass — cinematic constellation (realistic)

**When:** 2026-09-20 (Asia/Saigon)  
**Machine target:** `D:\Downloads\ArisThucTap-main\ArisThucTap-main\ArisSkyve` (Aris / machineId `5c499c48-…`)  
**Art direction:** realistic cinematic constellation/astral — smoked glass, soft volumetric light, sparse stars. Not cartoon.

## Audit snapshot

| Layout | Views |
|---|---|
| `_AuthLayout` | Login, Register (gold standard — untouched) |
| `_AppLayout` | Dashboard, Jobs, Profile, Settings, Company, Employer, Resume, JobApplications, SocialConnect |
| `Layout = null` | Chat, Interview/Room, NewUserInfor, Home/Error |
| `_ViewStart` → `_Layout` | Plain Bootstrap fallback only if a view forgets to set layout |

## Files changed this pass

| File | What improved |
|---|---|
| `Views/Shared/_AppLayout.cshtml` | Plus Jakarta Sans (Login DNA); `aris-app-shell`; volumetric haze; nav progress gesture; loads `aris-cinematic-shell.css`; toast roles |
| `wwwroot/css/aris-cinematic-shell.css` | **NEW** — auth-weight glass, photographic haze, focus-visible, softened neon/cartoon glows, dashboard hero glass + trajectory, jobs hierarchy, reduced-motion |
| `Views/Shared/Components/AppNavbar/Default.cshtml` | Always `navbar-cockpit` (dark glass) |
| `wwwroot/css/aris-tokens.css` | Display font prefers Plus Jakarta Sans |
| `wwwroot/css/aris-theme.css` | Dark navbar default + global `:focus-visible` |
| `wwwroot/css/aris-dashboard.css` | Display font aligned to Jakarta |
| `Views/Dashboard/Index.cshtml` | One-shot trajectory SVG in hero (no infinite orbit spin) |
| `Views/Jobs/_JobCardPartial.cshtml` | Auth-weight glass card; remove `text-dark`; sized lazy logo; quieter hover |
| `Views/Settings/Index.cshtml` | `settings-shell` class for shell polish |
| `Views/Profile/Index.cshtml` | `profile-page` class |

Backups (scratch): see apply package `backups/`.

## Intentionally not weakened

- `_AuthLayout`, `Login.cshtml`, `Register.cshtml`, `aris-auth.css`, `aris-auth-stage.js` — untouched
- MVC routes / Vietnamese copy / forms kept
- Zodiac watermarks + living starfield canvas kept, but glow intensity softened via shell pass

## Still plain / next recommended pass

1. **Chat / Interview** (`Layout = null`) — bring under `_AppLayout` or a slim cosmos chrome without breaking fullscreen chat
2. **Jobs Index** — still ~59 inline styles; move to CSS; skeleton on filter/search; shared-element card→Details
3. **Dashboard** — still heavy inline styles + stagger; wire trajectory to real `ViewBag` milestones (CV / applications / interview)
4. **Profile / Settings** — many inline hex backgrounds; fold into tokens
5. **`_ViewStart`** — consider defaulting to `_AppLayout` instead of plain `_Layout`

## How Brian can preview

```powershell
cd D:\Downloads\ArisThucTap-main\ArisThucTap-main\ArisSkyve
dotnet run
```

If launchSettings exists under `Properties\launchSettings.json`, use the listed `applicationUrl` (often `https://localhost:7xxx`). Then:

1. Open **Login** — confirm Three stage / glass card still gold-standard  
2. Sign in (or demo candidate) → **Dashboard** — glass hero, trajectory draw once, nav progress flash, soft haze  
3. **Jobs** — glass cards, title hierarchy, 2px hover lift, no cartoon bounce  
4. Tab through navbar — dual-layer focus rings visible  
5. Toggle OS **reduced motion** — trajectory/progress/enter animations should rest immediately  

Hard refresh (`Ctrl+F5`) so `asp-append-version` picks up new CSS.

## Apply note (executor)

Shell `machineId` did **not** route to the Windows machine from this executor (commands ran on the Linux box). Changes were produced from the UI source snapshot and packaged for sync onto Aris. Parent/agent should copy the package onto:

`D:\Downloads\ArisThucTap-main\ArisThucTap-main\`
