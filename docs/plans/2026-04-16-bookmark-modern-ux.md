# Bookmark Modern UX Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Modernize the bookmark workspace UI while fixing missing folder child-create, quick tag creation, preset color pickers, and tag visibility flows.

**Architecture:** Update the existing React `App.tsx` composition in place rather than splitting the view tree. Reuse the current draft state model, add a shared preset-driven color picker helper, and layer a compact segmented search mode control plus quick-create flows into the current desktop modal and manager surfaces.

**Tech Stack:** React, TypeScript, CSS, Vitest, Testing Library

---

### Task 1: Document and lock the target desktop UX

**Files:**
- Create: `docs/plans/2026-04-16-bookmark-modern-ux-design.md`
- Create: `docs/plans/2026-04-16-bookmark-modern-ux.md`

**Step 1: Save the approved design**

Write the approved desktop UX direction, missing workflow fixes, and testing scope into the design doc.

**Step 2: Save the execution plan**

Write this implementation plan into `docs/plans/2026-04-16-bookmark-modern-ux.md`.

**Step 3: Verify the docs exist**

Run: `Get-ChildItem docs/plans | Select-String '2026-04-16-bookmark-modern-ux'`
Expected: both files are listed

### Task 2: Add failing UI tests for the new desktop interactions

**Files:**
- Modify: `apps/web/src/test/bookmark-dashboard.test.tsx`
- Modify: `apps/web/src/test/folder-tag-dashboard.test.tsx`

**Step 1: Write the failing tests**

Add tests that assert:
- desktop search mode renders as a segmented control instead of a bare select
- advanced search uses color picker groups for bookmark and URL colors
- bookmark composer exposes quick tag creation and auto-selects the new tag
- bookmark cards show actual tag names, not only a count
- folder tree rows expose a small `+ 하위` action that preselects the clicked folder as parent
- tag manager exposes a tag color picker group instead of a string input

**Step 2: Run focused tests to verify they fail**

Run: `npm run test:web -- bookmark-dashboard.test.tsx folder-tag-dashboard.test.tsx`
Expected: FAIL because the new controls and metadata are not rendered yet

### Task 3: Build shared preset-driven color controls

**Files:**
- Modify: `apps/web/src/lib/folder-presets.ts`
- Modify: `apps/web/src/App.tsx`
- Modify: `apps/web/src/App.css`

**Step 1: Add shared color presets**

Expose one shared preset list usable by folders, tags, bookmark colors, URL colors, and search filters.

**Step 2: Replace raw color string inputs**

Implement compact preset picker groups for:
- bookmark color
- URL color
- tag color
- advanced search bookmark color filter
- advanced search URL color filter

**Step 3: Run focused tests**

Run: `npm run test:web -- bookmark-dashboard.test.tsx folder-tag-dashboard.test.tsx`
Expected: color-control-related tests pass or move to the next missing area

### Task 4: Modernize the desktop search toolbar

**Files:**
- Modify: `apps/web/src/App.tsx`
- Modify: `apps/web/src/App.css`
- Modify: `apps/web/src/test/bookmark-dashboard.test.tsx`

**Step 1: Replace desktop search mode select with a segmented control**

Use a grouped set of compact buttons bound to the existing search mode state.

**Step 2: Keep accessibility and submit behavior stable**

Preserve `검색 모드` semantics through grouped labeling and continue submitting the selected search mode through the current search draft state.

**Step 3: Tighten the toolbar styling**

Reduce visual awkwardness around `통합 검색` by using shorter labels, flatter controls, and cleaner spacing.

**Step 4: Run focused tests**

Run: `npm run test:web -- bookmark-dashboard.test.tsx`
Expected: desktop search toolbar tests pass

### Task 5: Restore inline child-folder creation from the folder tree

**Files:**
- Modify: `apps/web/src/App.tsx`
- Modify: `apps/web/src/App.css`
- Modify: `apps/web/src/test/folder-tag-dashboard.test.tsx`

**Step 1: Add a folder-row quick action**

Render a small `+ 하위` action on each folder tree row.

**Step 2: Wire the action to folder draft state**

When clicked, clear edit mode and prefill the selected folder as the parent folder in the manager form.

**Step 3: Default quick folder creation in the bookmark composer**

If the bookmark draft already has a selected folder, default quick folder creation to that folder as parent.

**Step 4: Run focused tests**

Run: `npm run test:web -- folder-tag-dashboard.test.tsx bookmark-dashboard.test.tsx`
Expected: folder quick-action tests pass

### Task 6: Add quick tag creation inside the bookmark composer

**Files:**
- Modify: `apps/web/src/App.tsx`
- Modify: `apps/web/src/App.css`
- Modify: `apps/web/src/test/bookmark-dashboard.test.tsx`

**Step 1: Add quick tag draft state and create handler**

Use the existing tag API flow to create a tag from within the bookmark composer.

**Step 2: Auto-select the created tag**

Append the newly created tag to the bookmark draft tag ids immediately after successful creation.

**Step 3: Keep the disclosure compact**

Place the quick tag UI inside the classification section rather than reopening the full tag manager.

**Step 4: Run focused tests**

Run: `npm run test:web -- bookmark-dashboard.test.tsx`
Expected: quick tag creation tests pass

### Task 7: Update tag presentation and bookmark metadata

**Files:**
- Modify: `apps/web/src/App.tsx`
- Modify: `apps/web/src/App.css`
- Modify: `apps/web/src/test/bookmark-dashboard.test.tsx`

**Step 1: Reduce pill roundness**

Change tag and picker tokens from full-pill shapes to lower-radius compact chips.

**Step 2: Show real tag names on bookmark cards**

Render up to a small number of tag names with an overflow token for the remainder.

**Step 3: Keep cards scannable**

Do not let the metadata line become visually heavy; keep the compact desktop tone.

**Step 4: Run focused tests**

Run: `npm run test:web -- bookmark-dashboard.test.tsx`
Expected: bookmark metadata tests pass

### Task 8: Full verification

**Files:**
- Modify: `apps/web/src/App.tsx`
- Modify: `apps/web/src/App.css`
- Modify: `apps/web/src/test/bookmark-dashboard.test.tsx`
- Modify: `apps/web/src/test/folder-tag-dashboard.test.tsx`

**Step 1: Run the full web test suite**

Run: `npm run test:web`
Expected: PASS

**Step 2: Run the API suite**

Run: `npm run test:api`
Expected: PASS

**Step 3: Run the web build**

Run: `npm run build:web`
Expected: PASS
