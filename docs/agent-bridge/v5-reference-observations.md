# Verified reference observations — Codex review supplement to V5

Date: 2026-09-18. Read alongside `v5-interactive-spectacle.md`. This supersedes only the earlier observation-limit note that playback had not yet succeeded.

## Verification

Codex successfully started browser playback for all four supplied Shorts and recorded advancing `video.currentTime`, `paused=false`, `readyState=4`, with no media error. The hidden next-video element is not treated as the active media. Codex directly inspected multiple screenshots from each advancing playback. This is sampled visual review, not continuous video/smoothness measurement or proof of how the original websites implement interaction.

| Reference | Approximate observed media times | Directly visible changes |
| --- | --- | --- |
| `yVXsS59LYJ0` | 2.98s, 6.08s, 0.07s after loop; duration 9.061s | The white editorial presentation changes from a vivid folded-band hero into a large angled hardware/product composition, then a close perspective app/device view. Camera/object scale and layout do substantial work. |
| `sYGsqFtojDc` | 3.00s, 6.08s, 1.25s after loop; duration 7.881s | A dark spatial object changes its apparent pose/scale while the typographic scene changes; purple highlights and foreground/background scenery maintain one art direction. |
| `LQOona1NXrE` | 2.97s, 6.05s, 9.13s; duration 9.521s | A richly illustrated environment moves among the waterfall/Tranquility composition, Biodiversity scene and mountain introduction; foreground, landscape and text define distinct staged compositions. |
| `_-Eo8G3CYWc` | 2.98s, 6.07s, 9.18s; duration 10.741s | Earth beside editorial type expands into a close-scale planetary view, followed by a materially different Venus composition with another large planet entering from below. |

Sources: https://www.youtube.com/shorts/yVXsS59LYJ0 , https://www.youtube.com/shorts/sYGsqFtojDc , https://www.youtube.com/shorts/LQOona1NXrE , https://www.youtube.com/shorts/_-Eo8G3CYWc .

Evidence: each reference directory under `docs/design-lab/references/user-shorts/` contains `verified_playback_0.png`, `verified_playback_1.png`, `verified_playback_2.png`. The fourth directory is named `Eo8G3CYWc`. These files are distinct from earlier paused-poster captures named `frame_*s.png`. Sample labels are not exact-frame timestamps; the times above were measured immediately before screenshots.

## Consequences for the Aris direction

The common ambition is a whole authored scene with substantial changes in scale, perspective, composition and depth. It is not a requirement that all references use the same particles, palette or geometry. The first reference even uses repeated folded forms effectively inside a larger presentation; the problem with our rejected staircase was the actual weak result, not the mere presence of repeated forms.

Apply this to V5 through a camera/framing change that reveals the field's interior, independently moving depth layers, a broad arc that changes the distribution of visual mass, and typography positioned within planned negative space. The field must have a clear composed silhouette and rich close-range material, not uniform points across an empty canvas.

Do not mechanically transplant long scroll storytelling into login. Bring the same scene-level ambition into the entrance and pointer interaction while keeping the form available. A reduced-motion/resting scene must still look designed.

These sampled recordings do not establish local cursor-driven physics in the original sites. The requested local force/inertia/wake/recapture behavior comes directly from the user's explicit instruction and remains a V5 acceptance requirement. Do not assert that the four Shorts prove such a simulation.

## Capture correction for future reviews

The failed initial attempts were caused by clicking a wrong/obscured `video` element and by stdout emoji encoding. They were not a YouTube access block. Normal visible-player interaction plus muted playback succeeded; no authentication/challenge bypass was needed. Future evidence must verify media state/time, not assume that waiting after a screenshot advances a video.
