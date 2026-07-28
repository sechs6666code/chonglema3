# 石碑打卡 · 正式网页 Design QA

## Evidence

- Source visual truth: user-supplied reference image
- Browser-rendered implementation screenshot: local QA capture
- Browser implementation: local development preview
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

---

# 8月至次年6月石碑 · 逐月标定 QA

## Evidence

- Source visual truth: eleven user-supplied stone photographs mapped to August through the following June. The June source is `1024 × 1536`; the December source is `1024 × 1535`; the remaining sources are `1024 × 1536`.
- Existing July source and its hand-authored anchors remain unchanged in intent and are now routed through the same month-stone registry.
- Browser-rendered implementation: local cloud-browser preview at a `1363 × 936` CSS viewport, device scale factor `1`; the June full-view capture and source/implementation side-by-side capture were emitted inline during this QA run.
- Focused implementation evidence: `qa/june-anchor-preview.jpg`.
- Tested state: each month was simulated on its final valid calendar day so every available hotspot could be inspected and activated.
- Comparison intent: preserve each photograph's silhouette and scale while placing the interactive selection glow and carved status mark on the exact printed numeral positions unique to that stone.

## Month Mapping and Calibration

| Month | Days | Final-row treatment | Rendered stone size |
|---|---:|---|---|
| August | 31 | Day 31 centered | `342 × 510` |
| September | 30 | Full sixth row | `342 × 520` |
| October | 31 | Day 31 centered | `342 × 522` |
| November | 30 | Full sixth row | `342 × 502` |
| December | 31 | Day 31 centered | `342 × 509` |
| January | 31 | Day 31 centered | `260 × 557` |
| February | 28 | Days 26–28 centered | `360 × 443` |
| March | 31 | Day 31 centered | `355 × 463` |
| April | 30 | Full sixth row | `344 × 470` |
| May | 31 | Day 31 centered | `324 × 516` |
| June | 30 | Full sixth row | `350 × 437` |

Every month has its own independently measured column positions, row positions, final-row rule, and stage width. No uploaded month reuses another uploaded month's date grid. June uses independently measured centers at five columns and six rows rather than inheriting May or July coordinates.

## Full-view Comparison

- All eleven transparent stones were inspected in the complete page composition rather than as isolated cutouts.
- The source silhouettes remain fully visible with no top, side, or base clipping.
- The white source backgrounds are removed cleanly; no blocking white rectangles or visible edge halos remain.
- The different stone proportions are deliberately rendered at different widths so that narrow January, broad February, and the later spring stones retain their source character without colliding with the header or check-in panel.
- The June white studio background was removed with white-matte decontamination; its moss, grass, stones, and irregular upper edge remain intact without a white rectangle or blocking halo.
- The previously empty September WebP was regenerated from the correct September source. It now renders at `958 × 1457` with 30 hotspots and zero broken images.

## Focused Region Comparison

- Each month's last valid day was selected and marked through the real “未破戒” interaction.
- For August through June, the selected hotspot center and rendered status-mark center differed by exactly `0px` on both axes.
- The warm selected-date glow was visually checked on days 31, 30, and February 28, including every special centered final row.
- Hotspot counts matched the printed source day counts exactly: `31, 30, 31, 30, 31, 31, 28, 31, 30, 31, 30`.
- June day 30 rendered with hotspot center and status-mark center both at `(763.046875, 770.25)` CSS pixels in the `1363 × 936` browser viewport.

## Primary Interactions Tested

- Selecting a printed day moves the warm glow to that exact numeral.
- Recording “未破戒” places the supplied real mark asset at that same anchor.
- Completing the current simulated day collapses the bottom check-in panel.
- Selecting another day reopens the panel under the existing interaction rules.
- Reset clears the monthly test record and returns the flower background to its initial state.
- The month is selected automatically from the real calendar month; the QA-only date override is restricted to the local development host and does not run on production.

## Accessibility and Content

- Every date remains a semantic button with a month-appropriate Chinese accessible label.
- Dates later than the simulated current date are disabled; the final-day checks intentionally simulated the last valid day so all printed dates could be inspected.
- Stone images have month-specific descriptive alt text.
- February exposes no invalid day 29–31 controls.

## Findings

- No actionable P0, P1, or P2 issue remains.
- No shared-grid shortcut remains across the eleven uploaded stones.
- No date-count mismatch, invalid extra date, selected-glow drift, or mark-position drift was found.
- No source photograph was redrawn or replaced with CSS/SVG approximation.
- The first September derivative was a zero-byte file (P1); it was replaced from the correct source and revalidated in the complete page composition.

## Validation

- [x] 11 uploaded months mapped from August through the following June
- [x] Existing July retained
- [x] 11 independent date calibrations
- [x] Correct day counts, including 28-day February
- [x] Centered partial final rows
- [x] Per-stone width calibration
- [x] Selection glow centered on printed numerals
- [x] Status marks centered on selected hotspots
- [x] Production build passed
- [x] 28 protected mobile runtime files intact
- [x] 4 Sites worker tests passed
- [x] Full-screen and focused-region visual review passed

final result: passed
