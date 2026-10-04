P1 IMPLEMENTED 2026-09-21 — hard-refresh Dashboard + Chat to verify.

# ArisSkyve — Cosmos interact bookmark (2026-09-21)

User paused work: resume when quota allows. **Notify user to check after each phase completes.**

## Done
- **Chat / Kết nối**: Gargantua WebGL BH (`aris-gargantua.*`, black-hole-scene), accretion ~speed 1.55 / motion 2.1 / cycle ~14s, amber glass panes, small eye peek (Esc), video-call icon centered. Not on login/index.
- **Dashboard / Trang chủ**: Earth stage — `wwwroot/img/cosmos/earth/earth-horizon.png`, `aris-earth.css` / `aris-earth.js`, wired in `Views/Dashboard/Index.cshtml` (server-rendered `#aris-earth-root`). Peek eye + Esc. Beat `body.aris-app-shell` `#01030a` with transparent overrides (`aris-home-earth-stage`, `aris-earth-cinematic`).
- **Important**: Razor views are compiled — after `.cshtml` edits must `dotnet build` + restart (`http://localhost:5025`).

## Not started — interact plan
Metaphor: Earth = career world; BH = live connection channel.

### Phase 1 — DONE (2026-09-21)
- Earth scroll parallax (ris-earth-plate--parallax)
- BH ArisGargantua.pulse on composer input / ArisChat message+typing
- Thinner glass on Dashboard + Chat

### Phase 1 (was next)
- Earth: scroll parallax (feed scroll → plate drift)
- BH: disk speed / glow reacts to typing + new messages
- Thin glass opacity so stages stay readable

### Phase 2
- Post success → short atmosphere ripple on Earth
- Open thread → soft camera push-in on BH
- Video call → cyan rim halo

### Phase 3
- Short warp Home ↔ Chat (reuse `aris-warp-transition`)
- Upcoming interview → warm sunrise cue on Earth
- Optional “static pin” / honor `prefers-reduced-motion`

## Key paths
- Earth: `wwwroot/css/aris-earth.css`, `wwwroot/js/aris-earth.js`, `Views/Dashboard/Index.cshtml`
- BH: Chat Index + gargantua / black-hole-scene assets
- App: `D:\Downloads\ArisThucTap-main\ArisThucTap-main\ArisSkyve`