# RTEditor — Comprehensive Code Review & Improvement Opportunities

> Generated from full codebase review. Organized by severity and category.  
> All 60 existing tests pass. Build succeeds (with one warning).

---

## Table of Contents

1. [Critical Bugs](#1-critical-bugs)
2. [Memory Leaks & Resource Management](#2-memory-leaks--resource-management)
3. [Security Vulnerabilities](#3-security-vulnerabilities)
4. [Architecture & Design Issues](#4-architecture--design-issues)
5. [Missing Features](#5-missing-features)
6. [Performance Improvements](#6-performance-improvements)
7. [UX & Accessibility Gaps](#7-ux--accessibility-gaps)
8. [Code Quality & Maintainability](#8-code-quality--maintainability)
9. [Build & Tooling](#9-build--tooling)
10. [Test Coverage Gaps](#10-test-coverage-gaps)
11. [Documentation & Types](#11-documentation--types)
12. [Dev Playground Issues](#12-dev-playground-issues)

---

## 1. Critical Bugs

### 1.1 History Stack Corruption on Max Size Overflow
**File:** `src/history.js`  
**Severity:** CRITICAL  
**Description:** The first entry in the undo stack is the *only* entry that stores `fullHTML`. All subsequent entries store deltas. When the stack reaches `maxSize` and `this.#stack.shift()` removes index 0, the `fullHTML` anchor is permanently lost. `#reconstructHTML()` walks backward looking for a `fullHTML` entry, finds none, and returns `''` — effectively wiping the entire editor content on undo.

```js
// Current (broken)
if (this.#stack.length >= this.#maxSize) {
  this.#stack.shift(); // Removes the ONLY fullHTML entry!
  this.#index = Math.max(0, this.#index - 1);
}
```

**Fix:** Insert periodic full snapshots (e.g., every N entries), or when shifting, convert the new index-0 entry to a `fullHTML` entry by reconstructing its state before discarding.

---

### 1.2 Global CLASS_MAP Mutation Across Instances
**File:** `src/editor.js` (line ~30)  
**Severity:** HIGH  
**Description:** `Object.assign(CLASS_MAP, options.classMap)` mutates the shared module-level `CLASS_MAP` object. If multiple editor instances are created with different `classMap` options, later instances silently corrupt the class mappings of earlier ones.

```js
// Current (mutates global)
if (options.classMap) {
  Object.assign(CLASS_MAP, options.classMap);
}
```

**Fix:** Create a per-instance shallow copy: `this.#classMap = { ...CLASS_MAP, ...options.classMap }` and thread it through engine/normalizer.

---

### 1.3 Dev Playground Variable Name Typo
**File:** `dev/index.html` (line ~87)  
**Severity:** LOW (dev only)  
**Description:** The dev playground references `explorer.getHTML()` instead of `editor.getHTML()`. This silently fails (ReferenceError in console).

---

## 2. Memory Leaks & Resource Management

### 2.1 Toolbar Dropdown Listener Never Removed
**File:** `src/toolbar.js`  
**Severity:** HIGH  
**Description:** The heading dropdown registers `document.addEventListener('click', closeOnOutside)` but the handler reference is not stored. There is no `destroy()` method on the Toolbar class. Even when `editor.destroy()` is called, this global listener persists indefinitely.

**Fix:** Store the handler reference; add a `destroy()` method to Toolbar that removes it.

---

### 2.2 Placeholder Style Tag Never Cleaned Up
**File:** `src/editor.js`  
**Severity:** MEDIUM  
**Description:** `_injectPlaceholderStyle()` appends a `<style>` tag to `document.head` with a `data-rteditor-placeholder` attribute and skips if one already exists. But `destroy()` never removes it. Multiple editor lifecycles on a SPA leave orphaned `<style>` tags.

**Fix:** In `destroy()`, remove the injected `<style>` element.

---

### 2.3 Engine Event Listeners Not Fully Cleaned
**File:** `src/engine.js`  
**Severity:** MEDIUM  
**Description:** `destroy()` calls `this.#root.removeAttribute('contenteditable')` but does NOT remove the input, keydown, paste, or other event listeners attached to `#root`. It also doesn't clear the internal `#listeners` map.

**Fix:** Store all listener references and remove them in `destroy()`. Clear `#listeners`.

---

### 2.4 Resizer Doesn't Clean Up on Editor Destroy
**File:** `src/resizer.js`  
**Severity:** MEDIUM  
**Description:** `ImageResizer` attaches global `mousemove`/`mouseup` listeners during resize, and the `#attachListeners` method is entirely empty (dead code). The resizer's `deactivate()` removes the overlay but if `destroy()` is called mid-resize, the global listeners remain.

**Fix:** Implement `#attachListeners` or remove dead method. Guard against mid-resize destruction.

---

## 3. Security Vulnerabilities

### 3.1 Regex-Based HTML Sanitization Is Bypassable
**File:** `src/normalizer.js`  
**Severity:** HIGH  
**Description:** `sanitizeHTML()` uses regex to strip `<script>`, `<style>`, `on*` attributes, and `javascript:` URLs. Regex-based HTML sanitization is notoriously fragile:

```js
// Can be bypassed with:
// <scr<script>ipt>alert(1)</script>
// <img src=x onerror  =alert(1)>
// <a href="java&#x73;cript:alert(1)">
```

**Fix:** Use DOMParser-based sanitization (the normalizer already uses DOMParser internally — extend it to do the sanitization instead of regex pre-processing).

---

### 3.2 No `data:` URL Sanitization on Images
**File:** `src/normalizer.js`  
**Severity:** MEDIUM  
**Description:** The image command and paste handler accept any URL including `data:text/html;base64,...` which can contain script payloads in some contexts.

**Fix:** Validate image URLs against an allowlist of protocols (`https:`, `http:`, `data:image/*`).

---

## 4. Architecture & Design Issues

### 4.1 Redundant Dynamic Import Causes Build Warning
**File:** `src/engine.js`  
**Severity:** MEDIUM  
**Description:** `#handlePaste` uses `const { normalizeHTML } = await import('./normalizer.js')` even though `normalizer.js` is already statically imported in `editor.js` and `index.js`. Vite warns about this dual import strategy. It serves no purpose since the module is already in the bundle.

**Fix:** Accept `normalizeHTML` as a constructor parameter or import it statically.

---

### 4.2 No Event Unsubscribe / `off()` Method
**File:** `src/engine.js`  
**Severity:** MEDIUM  
**Description:** The engine exposes `on(event, fn)` but no `off(event, fn)`. Consumers cannot detach event handlers, which is a basic event emitter requirement.

**Fix:** Add `off(event, fn)` that splices the handler from `#listeners`.

---

### 4.3 Two Separate `input` Event Listeners
**File:** `src/engine.js`  
**Severity:** LOW  
**Description:** `#handleInput()` registers one `input` listener for debounced history push, and `#normalizeContent()` is called from a second `input` listener (via constructor). These could be a single handler.

**Fix:** Merge into one `input` handler that calls both normalize and debounced-history.

---

### 4.4 onChange Fires Before History Snapshot
**File:** `src/engine.js`  
**Severity:** LOW  
**Description:** `#emitChange()` fires `change` event immediately on input, but `history.push()` is debounced (300ms). This means the `onChange` callback fires with content that hasn't been snapshotted yet — if the user immediately calls `undo()` after `onChange`, they get a stale state.

**Fix:** Either make history push synchronous on significant operations, or document the async nature.

---

## 5. Missing Features

### 5.1 No Inline `<code>` Command
**Severity:** MEDIUM  
**Description:** There's a `codeBlock` command (wraps in `<pre><code>`) but no way to toggle inline `<code>` on selected text.

---

### 5.2 No Indent / Outdent Commands
**Severity:** MEDIUM  
**Description:** No support for Tab/Shift+Tab to indent/outdent list items. Nested lists are impossible to create.

---

### 5.3 No Horizontal Rule (`<hr>`) Command
**Severity:** LOW  
**Description:** No way to insert a horizontal separator.

---

### 5.4 No Table Support
**Severity:** LOW  
**Description:** No table insertion or editing. Common in rich text editors.

---

### 5.5 No Text Alignment Commands
**Severity:** LOW  
**Description:** No support for left/center/right/justify alignment.

---

### 5.6 No Text/Background Color Picker
**Severity:** LOW  
**Description:** No font color or highlight color functionality.

---

### 5.7 No Drag-and-Drop for Images
**Severity:** LOW  
**Description:** Images can only be inserted via URL prompt. No support for drag-and-drop or file input.

---

### 5.8 No Link Editing UI
**Severity:** MEDIUM  
**Description:** `window.prompt()` is used for link URLs. There's no way to edit an existing link, change its text, or remove just the link (without clearing all formatting). The prompt also causes the editor to lose focus/selection on some browsers.

---

## 6. Performance Improvements

### 6.1 Normalizer Has O(n^2) Element Processing
**File:** `src/normalizer.js`  
**Severity:** MEDIUM  
**Description:** `processNode()` uses `querySelectorAll('*')` to find elements, then mutates the DOM (replacing tags, removing elements) inside the loop. After each mutation, the NodeList may be stale. Worse, tag alias replacement re-queries the entire tree per alias.

**Fix:** Collect elements into an array first. Process bottom-up (leaf-to-root) to avoid stale references.

---

### 6.2 No Debounce on Content Normalization
**File:** `src/engine.js`  
**Severity:** LOW  
**Description:** `#normalizeContent()` runs on every `input` event. For fast typing, this means full DOM traversal on every keystroke.

**Fix:** Debounce normalization (50-100ms) or use a MutationObserver with batched processing.

---

### 6.3 History Delta Reconstruction Is O(n)
**File:** `src/history.js`  
**Severity:** LOW  
**Description:** Undoing to an old state requires reconstructing from index 0 forward through all deltas. For large histories, this becomes slow.

**Fix:** Insert periodic full snapshots (e.g., every 20 entries) so reconstruction only walks back to the nearest snapshot.

---

## 7. UX & Accessibility Gaps

### 7.1 Keyboard Shortcuts Show "Ctrl" on macOS
**File:** `src/toolbar.js`  
**Severity:** LOW  
**Description:** Tooltip shortcuts display `Ctrl+B`, `Ctrl+I`, etc. On macOS, these should display `⌘B`, `⌘I`.

**Fix:** Detect `navigator.platform` and swap modifier display.

---

### 7.2 Image Resizer Has No Touch Support
**File:** `src/resizer.js`  
**Severity:** MEDIUM  
**Description:** Resizer only handles `mousedown`/`mousemove`/`mouseup`. Mobile/tablet users cannot resize images at all.

**Fix:** Add `touchstart`/`touchmove`/`touchend` handlers with equivalent logic.

---

### 7.3 Image Resizer Has No Keyboard Support
**File:** `src/resizer.js`  
**Severity:** LOW  
**Description:** No way to resize images via keyboard (e.g., arrow keys while resize handle is focused). Fails WCAG keyboard accessibility.

---

### 7.4 No Focus Management After Commands
**Severity:** LOW  
**Description:** After clicking a toolbar button (e.g., bold), focus should return to the editor. Currently the toolbar button retains focus, requiring user to click back into the editor.

---

### 7.5 Resizer Breaks with Scrolled Editor
**File:** `src/resizer.js`  
**Severity:** MEDIUM  
**Description:** `#updateOverlayPosition` uses `getBoundingClientRect()` offsets relative to the root, but doesn't account for `scrollTop`/`scrollLeft` of the root element. If the editor content is scrollable, the resize overlay misaligns.

**Fix:** Add `root.scrollTop`/`root.scrollLeft` to the position calculations.

---

## 8. Code Quality & Maintainability

### 8.1 Silent Error Swallowing
**Files:** `src/commands.js`, `src/selection.js`  
**Severity:** MEDIUM  
**Description:** Multiple `try/catch` blocks either swallow errors silently or only `console.error` them:
- `toggleInline()` in commands.js catches and logs
- `restoreSelection()` in selection.js has completely empty catch block

**Fix:** At minimum, emit an error event so consumers can observe failures. Remove empty catch blocks.

---

### 8.2 Public Properties for Private State
**File:** `src/editor.js`  
**Severity:** LOW  
**Description:** `_selectionHandler` and `_resizerCleanup` are stored as regular (public) properties despite being internal implementation details. They should use private fields (`#`).

---

### 8.3 Inconsistent Export Patterns
**Severity:** LOW  
**Description:** Some modules export classes (`EditorEngine`, `ImageResizer`), some export factory functions (`createCommandRegistry`), and some export plain objects (`CLASS_MAP`). No consistent pattern.

---

### 8.4 Magic Numbers
**Files:** `src/history.js`, `src/engine.js`, `src/resizer.js`  
**Severity:** LOW  
**Description:** Several hardcoded values without named constants:
- `300` (debounce ms in engine.js)
- `100` (max history size)
- `50` (min image width in resizer.js)

**Fix:** Extract to named constants or make configurable via options.

---

### 8.5 Resizer `#attachListeners` Is Dead Code
**File:** `src/resizer.js`  
**Severity:** LOW  
**Description:** The `#attachListeners()` method exists but has an empty body. It's called nowhere. Dead code.

**Fix:** Remove it or implement the intended functionality.

---

## 9. Build & Tooling

### 9.1 No Linting or Formatting Configuration
**Severity:** MEDIUM  
**Description:** No ESLint, Prettier, or Biome configuration. No enforced code style. As the project grows, inconsistencies will accumulate.

**Fix:** Add `eslint.config.js` with a flat config and `prettier` for formatting.

---

### 9.2 No CI/CD Pipeline
**Severity:** LOW  
**Description:** No GitHub Actions or other CI config. Tests and builds aren't verified on push/PR.

---

### 9.3 No Bundle Size Monitoring
**Severity:** LOW  
**Description:** At 37.87 kB (10.44 gzip) the bundle is reasonable, but there's no size budget or monitoring to catch regressions.

---

### 9.4 No Source Maps in Production Build
**Severity:** LOW  
**Description:** `vite.config.js` doesn't explicitly enable sourcemaps for the library build. Consumers debugging issues will have a hard time.

**Fix:** Add `build: { sourcemap: true }`.

---

## 10. Test Coverage Gaps

### 10.1 Untested Commands
**Severity:** HIGH  
**Description:** Only 3 command tests exist. The following commands have ZERO test coverage:
- List toggling (ordered ↔ unordered)
- Blockquote toggle
- Code block toggle
- Link creation and removal
- Image insertion
- `clearFormatting`
- All heading levels (h1-h4)
- Paragraph reset

---

### 10.2 No Paste Event Tests
**Severity:** MEDIUM  
**Description:** The paste handler (strips HTML, applies normalization) has no test coverage. This is a critical path for content sanitization.

---

### 10.3 No Keyboard Shortcut Tests
**Severity:** MEDIUM  
**Description:** Shortcuts (Ctrl+B, Ctrl+I, Ctrl+U, Ctrl+Z, Ctrl+Shift+Z) are registered but not tested.

---

### 10.4 No Destroy/Cleanup Tests
**Severity:** MEDIUM  
**Description:** `editor.destroy()` is called in test teardown but its behavior is never asserted — listeners removed? DOM cleaned? Toolbar gone?

---

### 10.5 No Multi-Instance Test
**Severity:** MEDIUM  
**Description:** No test creates two editors simultaneously to verify they don't interfere (which they currently do — see §1.2 CLASS_MAP mutation).

---

### 10.6 No Edge Case Tests
**Severity:** LOW  
**Description:** Missing tests for:
- Empty editor operations
- Very long content (performance)
- Rapid undo/redo sequences
- Concurrent input + history operations
- XSS payload handling in paste
- Invalid HTML input normalization

---

## 11. Documentation & Types

### 11.1 TypeScript Definitions Are Incomplete
**File:** `types/index.d.ts`  
**Severity:** MEDIUM  
**Description:** Only `RichTextEditor` and top-level exports are typed. Missing:
- `EditorEngine` class
- `History` class  
- `ImageResizer` class
- `Toolbar` class
- `createCommandRegistry` function
- Selection utility functions
- `exec()` method uses `...args: any[]` — should have per-command overloads

---

### 11.2 No README or API Documentation
**Severity:** MEDIUM  
**Description:** No README.md, no API docs, no usage examples beyond the dev playground.

---

### 11.3 No CHANGELOG
**Severity:** LOW  
**Description:** No changelog to track versions and breaking changes.

---

## 12. Dev Playground Issues

### 12.1 CDN Dependency for Dev
**File:** `dev/index.html`  
**Severity:** LOW  
**Description:** The dev playground loads Tailwind CSS from a CDN `<script>` tag. This requires internet access and could break if the CDN changes.

---

### 12.2 No Error Boundary in Playground
**Severity:** LOW  
**Description:** If the editor throws during init, the playground shows nothing with no error indication.

---

---

## Summary by Priority

| Priority | Count | Items |
|----------|-------|-------|
| CRITICAL | 1 | History stack corruption (§1.1) |
| HIGH | 4 | Global CLASS_MAP mutation (§1.2), Toolbar memory leak (§2.1), Regex sanitization bypass (§3.1), Untested commands (§10.1) |
| MEDIUM | 16 | Style tag leak (§2.2), Engine listener leak (§2.3), Resizer cleanup (§2.4), data: URL XSS (§3.2), Dynamic import (§4.1), No off() (§4.2), No inline code (§5.1), No indent/outdent (§5.2), No link editing (§5.8), O(n²) normalizer (§6.1), Touch resize (§7.2), Scroll resize (§7.5), Silent errors (§8.1), No linting (§9.1), Paste tests (§10.2), Incomplete types (§11.1) |
| LOW | 18 | Remaining items |

**Recommended implementation order:**
1. Fix §1.1 (history corruption) — data loss bug
2. Fix §1.2 (CLASS_MAP mutation) — multi-instance bug
3. Fix §2.1-2.4 (memory leaks) — resource management
4. Fix §3.1-3.2 (security) — XSS vectors
5. Add tests §10.1-10.6 — safety net before further changes
6. Address architecture §4.x — clean foundation
7. Add features §5.x — new capabilities
8. Performance §6.x, UX §7.x, quality §8.x — polish
