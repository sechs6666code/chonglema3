# 石碑打卡 Demo · Design QA

## Evidence

- Source visual truth:
  - `public/assets/scene/source/stone.jpg`
  - `public/assets/scene/source/mark-success.jpg`
  - `public/assets/scene/source/mark-broken.jpg`
  - `public/assets/scene/source/level-1-wilted.jpg`
  - `public/assets/scene/source/level-2-sparse.jpg`
  - `public/assets/scene/source/level-3-normal.jpg`
  - `public/assets/scene/source/level-4-lush.jpg`
  - `public/assets/scene/source/level-5-blooming.jpg`
- Browser-rendered implementation screenshot: `/home/oai/share/implementation-phone.png`
- Browser stage screenshot: `/home/oai/share/browser-stage.png`
- Combined source/implementation comparison: `/home/oai/share/qa-comparison.png`
- Focused date-anchor evidence: `qa/date-anchor-preview.jpg`
- Target viewport: iPhone content viewport, `393 × 852` CSS px, device scale factor `1`
- Browser capture: `360.52 × 781.59` px at template stage scale `0.91735`, cropped from a `1363 × 936` browser screenshot and normalized to `393 × 852` px for comparison
- Source pixels: background and mark source files are approximately `1024 × 1536`; processed stone is `944 × 1454`
- State: clean first-use state, day 27 selected, no records, level 3 / 正常

## Findings

- No actionable P0, P1, or P2 differences remained.
- Fonts and typography: the title, compact status chip, date status, and action labels remain readable over the photographic scene and preserve a clear hierarchy.
- Spacing and layout rhythm: the stone owns the visual center, the header clears the status bar, and the bottom action sheet remains fully visible without covering the active date rows.
- Colors and visual tokens: the cream action sheet and dark moss action color sit within the muted green/stone palette and retain sufficient contrast.
- Image quality and asset fidelity: all core visuals use the supplied raster assets. The stone and marks use processed transparent WebP derivatives; no CSS, SVG, emoji, or programmatic drawing replaces them. The upper scene remains fixed while the lower vegetation region crossfades.
- Copy and content: the interface consistently uses “未破戒 / 破戒”, displays the current 1–5 level and name, and exposes reset, edit, and clear-record states.

## Full-view Comparison

The combined comparison shows the same supplied normal vegetation, stone texture, centered monument hierarchy, and photographic visual language. The implementation intentionally reduces the stone slightly to reserve a stable header and bottom action area. This is an interaction-layout adaptation, not asset drift.

## Focused Region Comparison

`qa/date-anchor-preview.jpg` overlays all 31 measured anchors on the processed stone. Each anchor lands on its corresponding engraved date; the browser interaction test also confirmed that the real success and broken-mark images render at those anchors.

## Primary Interactions Tested

- New user starts at level 3.
- “未破戒” advances one level and clamps at level 5.
- “破戒” reduces one level and clamps at level 1.
- Editing an older record recalculates the current level chronologically from level 3.
- Deleting an older record recalculates the remaining sequence.
- Future dates 28–31 are disabled for the browser date used in this run.
- Reset clears all records and restores level 3.
- The lower-only background transition was visually checked at levels 1, 2, 3, 4, and 5.

## Console Check

- Application-origin console warnings/errors: none.
- Cloud-browser extension metadata errors were present only under a `chrome-extension://` URL and are unrelated to the app.

## Comparison History

- Initial comparison: no P0/P1/P2 visual issue found.
- No design-QA fix iteration was required.
- Residual P3 note: the cloud stage scales the device frame to fit the available browser height; the captured content was normalized to the intended `393 × 852` comparison size.

## Implementation Checklist

- [x] Real photographic assets retained
- [x] White backgrounds removed from stone and mark assets
- [x] Thirty-one dates independently calibrated
- [x] Lower vegetation-only crossfade implemented
- [x] Revised stepwise 1–5 level calculation implemented
- [x] Historical edits recalculate chronologically
- [x] Mobile interactions and reset verified
- [x] Runtime console checked

final result: passed
