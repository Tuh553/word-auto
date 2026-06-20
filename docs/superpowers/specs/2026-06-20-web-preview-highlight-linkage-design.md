# Web Preview Highlight And Linkage Design

Date: `2026-06-20`

## Goal

Improve Web-side `run`-level partial highlighting and report/preview linkage stability without changing parser/validator semantics, rule-library format, deployment shape, or local-only processing constraints.

This work is limited to UX and interaction correctness for:

- report issue -> preview paragraph/fragment targeting
- preview fragment/paragraph click -> report selection
- preview scroll -> report auto-selection within the currently visible issue set

## Non-Goals

- No parser or validator semantic changes
- No rule-library schema changes
- No backend, upload, or server-side processing
- No DOM-index-based paragraph targeting
- No fuzzy cross-paragraph fragment matching
- No attempt to disambiguate logically identical issues using new parser metadata

## Existing Constraints To Preserve

- Preview targeting remains based on paragraph raw text matching, not DOM order.
- If an issue has `affectedText`, fragment highlighting is attempted first.
- If fragment matching fails, fallback is whole-paragraph highlight.
- Reverse linkage only works within the currently filtered visible issue set.
- When the selected issue is filtered out, existing `resolveSelectedIssue` semantics remain unchanged.
- `ReportPanel` behavior must not regress:
  - grouping
  - sorting
  - provenance expansion
  - fix hint rendering
  - low-confidence hint rendering
  - selected state
  - selected-item scroll into view

## Root Cause

The current implementation already supports:

- report click -> preview scroll/highlight
- preview click -> report selection
- preview scroll -> report auto-selection
- programmatic-scroll suppression window

The remaining instability comes from one structural gap: preview interaction logic has no explicit, testable model for mapping the current visible report issues into paragraph-level and fragment-level hit targets.

As a result, these behaviors are only partially encoded in UI code:

- multiple issues in the same paragraph
- repeated `affectedText` within one paragraph
- fragment-vs-paragraph click resolution
- stable visible-target selection after filtering/grouping

## Design Summary

Introduce a small “preview hit description” layer shared by report grouping and preview highlighting logic.

Responsibilities become:

- `reportGroups.ts`
  - define stable ordering for currently visible issues
  - define stable same-paragraph issue precedence used by preview reverse linkage
- `previewHighlight.ts`
  - define fragment matching and fallback strategy inside a known target paragraph
  - define preview hit selection helpers for click and viewport-driven selection
- `PreviewPanel.tsx`
  - keep DOM work minimal: mark targets, apply active highlight, emit click/scroll selections
- `useDetectionFlow.ts`
  - preserve selection semantics and suppression-window behavior
- `ReportPanel.tsx`
  - preserve rendering behavior; only keep the selected issue as the sole active preview-highlight source

## Stable Selection Rules

### 1. Same-Paragraph Issue Priority

When multiple currently visible issues belong to the same paragraph, preview reverse linkage must use a deterministic priority:

1. higher severity first: `error` > `warn` > `info`
2. then existing report order within that visible set
3. then earlier fragment occurrence in paragraph text when available

This rule applies only to preview-side disambiguation when the user clicks a paragraph region that is not already a uniquely marked active fragment.

### 2. Repeated `affectedText` In The Same Paragraph

When `affectedText` appears more than once in the same paragraph:

1. only search inside the already matched target paragraph
2. prefer the occurrence consistent with the same-paragraph issue priority above
3. if no occurrence can be assigned confidently under that deterministic rule, fallback to whole-paragraph highlight

The implementation must not guess across paragraphs or rely on incidental DOM structure.

### 3. Active Highlight Exclusivity

Only the currently selected issue may produce the active highlight.

That means:

- if a fragment match is reliable, highlight only that fragment
- otherwise highlight only the whole paragraph
- never highlight multiple sibling issue fragments at once

This preserves a strict 1:1 mapping between the selected report item and the active preview highlight.

## Interaction Design

### Report -> Preview

When a report item is selected:

- locate the paragraph by paragraph text matching
- attempt fragment highlight only for that selected issue
- if fragment match succeeds, scroll the fragment into view when needed
- if fragment match fails, fallback to whole-paragraph highlight and scroll that paragraph into view
- keep a lightweight paragraph-level marker so preview click and viewport logic still know the paragraph belongs to a visible issue set

### Preview -> Report

When the user clicks the preview:

- if the click lands inside the active fragment marker, select that exact issue
- otherwise resolve from the clicked paragraph’s visible issue set using the deterministic same-paragraph priority

This ensures the user gets the most severe visible issue by default when paragraph-only clicks cannot distinguish siblings.

### Preview Scroll -> Report

When the user manually scrolls the preview:

- select only from the currently visible issue candidates
- keep existing “viewport center first, top fallback” behavior
- do not trigger preview scrolling again

### Feedback-Loop Prevention

Keep the existing suppression window for programmatic preview scrolling:

- report-driven scrolling suppresses preview-scroll auto-selection temporarily
- user clicks remain active during suppression
- user manual scrolling after suppression updates only report selection, not preview scroll position

## Data Flow

### Visible Issue Set

The visible issue set remains:

- original report issues
- filtered by active severities
- then resolved through existing `resolveSelectedIssue` logic

Grouping and sorting in `ReportPanel` do not change the meaning of visible issues. Preview reverse linkage must operate on the same filtered issue set, regardless of display grouping.

### Derived Preview Data

Derived data should be computed from visible issues and paragraphs:

- per-paragraph visible issue candidates
- stable paragraph hit targets for reverse linkage
- active highlight target for the selected issue

These derived helpers should live in pure functions so repeated behavior is tested without fragile DOM assertions.

## Implementation Plan

### `apps/web/src/lib/reportGroups.ts`

Add helpers that:

- sort visible issues deterministically
- expose same-paragraph visible issue candidates
- keep preview target generation stable after filtering

Do not change existing grouping/label semantics.

### `apps/web/src/lib/previewHighlight.ts`

Add helpers that:

- compute fragment match candidates inside a paragraph
- deterministically resolve repeated fragment matches
- describe paragraph-level hit ownership for preview click handling
- keep viewport candidate selection behavior testable as a pure function

### `apps/web/src/components/PreviewPanel.tsx`

Limit responsibilities to:

- docx-preview render lifecycle
- DOM marker application for visible paragraph hits
- active highlight application for one selected issue
- click delegation to marker metadata
- scroll callback using pure viewport-selection helpers

Avoid pushing additional ranking logic into the component.

### `apps/web/src/hooks/useDetectionFlow.ts`

Preserve:

- `resolveSelectedIssue` behavior
- severity filter semantics
- preview-scroll suppression behavior

Only adjust data wiring as needed to feed the refined preview hit helpers.

### `apps/web/src/components/ReportPanel.tsx`

Keep existing rendering behavior. If needed, make the fragment anchor text more explicit, but do not change grouping, sorting, provenance, fix hint, or low-confidence behavior.

## Testing Strategy

Prefer pure-function tests. Keep component tests minimal and integration-oriented.

### `previewHighlight.test.ts`

Must cover:

- repeated fragment match strategy is deterministic
- fragment match failure falls back cleanly to paragraph-level behavior
- viewport issue selection helper still behaves correctly

### `reportGroups.test.ts`

Must cover:

- same-paragraph multi-issue stable priority
- filtered visible target list remains stable

### `PreviewPanel.test.ts`

Must cover:

- clicking a local fragment marker still resolves the corresponding `issueKey`

### `reportPanel.test.ts`

Must cover:

- selected state rendering does not regress
- selected-item scroll-into-view helper does not regress

## Risks And Limits

- If two issues in the same paragraph are textually identical and share identical severity/order signals, preview paragraph-only clicks cannot produce true semantic disambiguation. In that case, deterministic fallback is acceptable; hidden guessing is not.
- Fragment matching remains text-based and therefore depends on docx-preview rendered text fidelity. The design intentionally avoids parser/schema changes.
- This work improves reliability and predictability, not perfect semantic identification in every ambiguous document.

## Acceptance Mapping

This design is intended to satisfy the requested acceptance criteria:

- report click scrolls preview to the correct paragraph
- `affectedText` is highlighted first when reliable
- fragment failure falls back to whole paragraph
- preview fragment click selects the matching report issue
- preview scroll selects within the current visible issue set only
- no preview jump loop from scroll linkage
- same-paragraph multiple issues highlight only the selected issue’s fragment or fallback paragraph
- filtering/grouping/sorting changes keep linkage scoped to visible issues

