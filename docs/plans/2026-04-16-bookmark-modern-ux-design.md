# Bookmark Modern UX Design

**Goal:** Refresh the desktop bookmark workspace into a calmer productivity UI while fixing the missing folder, tag, and color workflows that still expose raw string inputs or hidden hierarchy actions.

**Design Direction:** Use Raindrop.io for structure, GoodLinks for compact reading/detail flows, and only a small amount of mymind-like softness in color and spacing. The product should feel like a desktop information tool, not a card-heavy showcase.

**Visual Thesis:** Quiet, flat, structured productivity UI with lighter chrome, reduced corner radii, tighter controls, and clearer hierarchy around search, folders, and bookmark metadata.

## Scope

### 1. Search Bar

- Keep the desktop search surface as a single-row quick bar.
- Replace the awkward desktop `검색 모드` select with a compact segmented control.
- Keep the query input as the primary field.
- Keep sort as a compact select.
- Keep advanced filters behind one button.
- Convert advanced color filters from free-text inputs into compact color pickers.

### 2. Color Input System

- Remove free-text color entry from:
  - bookmark display options
  - search color filters
  - tag manager
- Reuse a shared preset color vocabulary so folder, tag, bookmark, and URL colors read consistently.
- Selected colors should present as pressed chips with swatches, not text boxes.

### 3. Folder Tree Actions

- Add a small inline `+ 하위` action on each folder row in the folder tree panel.
- Clicking it should reset folder edit state, open creation mode, and prefill that row as the parent folder.
- Keep less common actions in `더보기`.
- Also make quick folder creation from the bookmark composer default to the currently selected folder when one is already chosen.

### 4. Bookmark Composer

- Keep the current modal and disclosure structure.
- Add `새 태그 바로 추가` inside the composer so users can create a tag without leaving the bookmark flow.
- New tags created there should be auto-selected for the bookmark draft.
- Replace bookmark color and URL color string inputs with preset pickers.

### 5. Tag UI

- Replace the tag manager color string input with a preset picker.
- Reduce tag chip roundness and visual puffiness.
- Keep tags compact and scannable, closer to utility tokens than bubbles.

### 6. Bookmark Card Metadata

- Stop showing only tag counts on cards.
- Show actual tag names inline, with a compact overflow token such as `+2` for the remainder.
- Keep the metadata quiet and readable so the card still scans quickly.

## Behavioral Notes

- Existing search behavior and accessibility names should remain intact where practical.
- Where a visible control type changes, preserve the semantic label through `aria-label`, `role`, or grouped controls.
- Folder hierarchy and advanced search semantics should not regress while the UI becomes more compact.

## Testing Plan

- Add desktop UI tests for:
  - segmented desktop search mode control
  - advanced search color pickers
  - child-folder quick action in folder tree
  - quick tag creation inside the bookmark composer
  - bookmark card tag name visibility
- Re-run full web tests, API tests, and web build.
