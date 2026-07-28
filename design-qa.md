# 石碑打卡 · 正式网页 Design QA

## Evidence

- Source visual truth: `/workspace/scratch/b64449f8d5b4/upload/89542562-7F95-46E6-949F-BBB19C496069.jpeg`
- Browser-rendered implementation screenshot: `/home/oai/share/chonglema3-qa-standalone-final.jpg`
- Cloud browser implementation URL: `http://terminal.local:4173/`
- Source pixels: `709 × 1536`
- Implementation pixels and CSS viewport: `1363 × 936`, device scale factor `1`
- State: 2026-07-27, day 27 selected, no saved records, level 3 / 正常
- Comparison intent: the source screenshot documents the incorrect preview-shell state; the target is the same app-owned scene and controls rendered as a normal full-viewport webpage.

## Findings

- No actionable P0, P1, or P2 issues remain.
- Fonts and typography: the redundant “石碑打卡” title is removed. The date remains as a quiet orientation cue, while selected-day and current-level information lead the action panel.
- Spacing and layout rhythm: the page fills the browser viewport. Header and action panel are capped to readable widths on larger screens, while the stone remains centered and the bottom panel clears the safe area.
- Colors and visual tokens: the background imagery is approximately 17% brighter than its unfiltered source, with the dark wash and upper/lower inset shading reduced. The interaction palette now comes exclusively from warm brass, moss, weathered rock and dark misted glass.
- Selection treatment: the selected date uses a soft warm radial glow blended into the stone rather than an outlined oval.
- Control materials: the action panel is a dark translucent frosted surface. “未破戒” uses a muted moss/brass finish and “破戒” a desaturated weathered gray-brown finish; neither uses standard red/green status colors.
- Secondary disclosure: flower level and reset are no longer exposed as first-screen labels. A small stone-textured control opens a compact secondary panel, supports Escape/outside dismissal, and removes hidden controls from keyboard focus.
- Scene transition: all five vegetation-state photographs use the same full-viewport geometry and crossfade across 100% of the scene; no lower-region mask or fixed upper crop remains.
- Image quality and asset fidelity: all supplied photographic and stone/mark raster assets are retained without redrawing. All rendered images reported real natural dimensions; broken image count was zero.
- Copy and content: the original “未破戒 / 破戒” interaction, current level, selected day, reset and clear-record states are unchanged; only the redundant title and exposed debug-style labels were removed from the first screen.

## Full-view Comparison

The source showed the app nested inside a white prototype canvas with an iPhone bezel, device selector, simulated status bar and simulated home indicator. The browser-rendered implementation contains none of those elements and instead occupies the entire `1363 × 936` viewport. The photographic scene is visibly clearer, while the stone, header and bottom controls retain the original composition.

## Focused Region Comparison

No additional focused crop was required: this change concerns the outer runtime shell and overall scene luminance, both of which are clearly visible in the full-view evidence. App-owned typography, date anchors and controls were not redesigned.

## Primary Interactions Tested

- The secondary stone control opens the flower-level/reset panel and closes with the same control.
- The hidden secondary panel is inert and does not expose its reset action to keyboard focus.
- “未破戒” changes the visible flower level from `正常` to `茂盛` and sets `aria-pressed=true`.
- Reset returns the app to level 3 / `正常`.
- The standalone shell exactly matches the viewport dimensions.
- Device preview chrome counts: phone stage `0`, phone frame `0`, device picker `0`, simulated status bar `0`, home indicator `0`.
- All scene and stone images loaded successfully.

## Console Check

- Application-origin warnings/errors: none.
- The only logged errors came from a `chrome-extension://` metadata script and are unrelated to the app.

## Comparison History

- Initial P1: production showed the prototype iPhone frame and debug device selector.
  - Fix: replaced the production entry with a standalone full-viewport shell while retaining the existing providers and app interaction logic.
  - Post-fix evidence: all five debug/prototype chrome selectors return a count of zero.
- Initial P2: the photographic background was too dark to read comfortably.
  - Fix: increased scene brightness by 11% and reduced the overlay/inset darkness.
  - Post-fix evidence: vegetation, sky and tree framing are visibly clearer while white text remains readable.

## Implementation Checklist

- [x] Production preview shell removed
- [x] Normal full-viewport webpage enabled
- [x] Safe-area spacing retained
- [x] Background subtly brightened
- [x] Five vegetation states crossfade across the full viewport
- [x] Selected date changed from outline to warm radial light
- [x] Bottom panel changed to dark misted glass
- [x] Status buttons moved to one muted material palette
- [x] Flower state and reset moved behind secondary disclosure
- [x] “石碑打卡” title removed
- [x] App interactions preserved
- [x] Images and console verified
- [x] Runtime lock refreshed

final result: passed
