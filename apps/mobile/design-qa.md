**Design QA — NOW warm editorial mobile UI**

- Source visual truth: `/Users/haozhou/.codex/generated_images/01a075a0-0f8a-7563-9f96-b9d8ebc1b149/exec-0b3779fa-6455-42de-aa22-fff592e1613d.png`
- Implementation screenshot: `/private/tmp/now-ui-home-v2.png`
- Combined comparison evidence: `/private/tmp/now-design-comparison.png`
- Entry-state evidence: `/private/tmp/now-ui-entry-v1.png`
- Viewport: 390 × 844 CSS px, device scale factor 2
- Source pixels: 853 × 1844; normalized to 780 × 1688 for comparison
- Implementation pixels: 780 × 1688
- State: test mode, Now tab, before location permission

**Findings**

- No actionable P0/P1/P2 findings remain.
- Fonts and typography: bold system display weights reproduce the reference hierarchy. The NOW mark, two-line hero, section title, action label, and support copy remain legible at 390 px.
- Spacing and layout rhythm: 16 px outer gutters, 24 px rounded cards, the oversized primary action, and fixed five-item bottom navigation follow the source composition without horizontal overflow.
- Colors and visual tokens: the implementation preserves brand orange `#FF5A36`, warm white `#FFFDFC`, soft gray cards, peach selected states, and dark neutral type with accessible contrast.
- Image quality and asset fidelity: the implementation state is intentionally the pre-location state, so live plan photography and avatars from the populated mock are not shown. Standard UI icons use Expo Symbols rather than drawn substitutes. The location prompt uses the same card art direction as the populated plan region.
- Copy and content: core source language is preserved: “What feels good right now?”, “Plans near you in the next six hours.”, “I'm Free”, and “Plans near you”. Location copy accurately describes the product's real permission behavior.
- Responsive behavior: all five navigation destinations fit at 390 px; the previous top navigation overflow is removed.
- Focused-region comparison was not needed because the normalized side-by-side image is full-resolution and all important typography, action, card, and navigation details are readable.

**Open Questions**

- Plan imagery remains dependent on future backend image fields; no placeholder photography was introduced.

**Comparison History**

1. Initial capture: `/private/tmp/now-ui-home-v1.png`
   - [P2] The hero title wrapped to three lines at 390 px and felt denser than the two-line source.
   - Fix: reduced the mobile hero from 42/43 to 36/38 with tighter tracking.
2. Post-fix capture: `/private/tmp/now-ui-home-v2.png`
   - The hero now holds the intended two-line hierarchy. No P0/P1/P2 issues remain.

**Interactions Tested**

- Enter test mode opens the app.
- Map tab navigates to `/explore`.
- Now tab returns to `/`.
- Browser console and page errors checked: none.

**Implementation Checklist**

- [x] Warm editorial home hierarchy
- [x] Prominent working “I'm Free” action
- [x] Mobile-safe five-item bottom navigation
- [x] Restyled location, plan, empty, and error surfaces
- [x] Simplified test entry hierarchy
- [x] Web export, TypeScript, and ESLint checks

**Follow-up Polish**

- Add real plan cover images and participant avatars when the data model exposes them.
- Replace the generic “Nearby” label with reverse-geocoded city text after location permission.

---

**Map module QA**

- Source visual truth: `/Users/haozhou/.codex/generated_images/01a075a0-0f8a-7563-9f96-b9d8ebc1b149/exec-eade3c79-e9d1-4be3-af9c-31da6ca0684e.png`
- Implementation map screenshot: `/private/tmp/now-map-v5.png`
- Implementation list screenshot: `/private/tmp/now-map-list-v4.png`
- Combined comparison evidence: `/private/tmp/now-map-comparison-final.png`
- Viewport: 390 × 844 CSS px; final capture density 1
- Source pixels: 853 × 1844; normalized to 390 × 844
- Implementation pixels: 390 × 844
- State: test mode, simulated Milan location, one demo plan selected

**Map Findings**

- No actionable P0/P1/P2 findings remain.
- Typography and colors follow the approved warm editorial home system rather than copying the earlier map concept's cooler styling.
- Map, location point, two plan markers, selected plan card, Map/List switcher, zoom controls, attribution, and five-item bottom navigation are visible and usable at 390 px.
- Standard map geometry and controls come from Leaflet; app icons come from Expo Symbols. No placeholder or handcrafted map graphics are used.
- Copy is concise and matches the live product model. Test-mode plans are explicitly isolated from authenticated Supabase data behavior.
- Full-view evidence is sufficient because all controls, labels, markers, and the selected card are legible at native CSS resolution.

**Map Comparison History**

1. `/private/tmp/now-map-v1.png`: live map worked, but anonymous test mode could not load the authenticated Supabase RPC.
   - Fix: added two test-only nearby plans while preserving the real RPC for signed-in users.
2. `/private/tmp/now-map-v2.png`: markers and preview worked, but navigation retained the prior page scroll position.
   - Fix: reset Map to the top on entry.
3. `/private/tmp/now-map-list-v3.png`: Leaflet controls and markers remained visible behind List mode.
   - Fix: retain the map instance inside a fully hidden container and refresh its size when returning to Map.
4. `/private/tmp/now-map-v3.png`: the marker tooltip clipped at the screen edge and attribution overlapped the preview region.
   - Fix: removed the redundant tooltip and moved attribution to the top-right.
5. `/private/tmp/now-map-v5.png` and `/private/tmp/now-map-list-v4.png`: post-fix evidence has no remaining P0/P1/P2 issues.

**Map Interactions Tested**

- Location permission with simulated coordinates
- Map tab navigation and scroll reset
- Pan/zoom-capable Leaflet map render
- Plan marker selection and preview card
- Map/List switching
- No visible map controls remaining in List mode
- Browser page errors checked: none

final result: passed
