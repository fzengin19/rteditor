# RTEditor — Phase 2: Professional Refinements & Features

This plan outlines the next steps for maturing RTEditor into a production-ready, accessible, and high-performance library after the successful core rewrite.

## File Structure (Updated)

```
rteditor/
├── ...
├── src/
│   ├── ...
│   └── resizer.js         # [NEW] Image resizing logic
├── types/                 # [NEW]
│   └── index.d.ts         # [NEW] TypeScript definitions
└── tests/
    ├── ...
    ├── a11y.test.js       # [NEW] Accessibility tests
    └── resizer.test.js    # [NEW]
```

---

## Task 14: Accessibility (a11y) & Toolbar UX

**Goal:** Ensure the editor is navigable for screen readers and keyboard-only users.
**Files:**
- [MODIFY] [src/toolbar.js](file:///home/kubuntu/projects/rteditor/src/toolbar.js)
- [NEW] [tests/a11y.test.js](file:///home/kubuntu/projects/rteditor/tests/a11y.test.js)

**Step 1: ARIA Enhancements**
- Update `#createButton` and `#createDropdown` to add `aria-label` based on `def.label`.
- Update `updateState` to set `aria-pressed="true/false"` for inline toggle buttons.
- Add `role="group"` and `aria-label="Rich Text Toolbar"` to the toolbar container.

**Step 2: Arrow Key Navigation**
Implement the standard toolbar keyboard pattern (WAI-ARIA):
- `Left/Right Arrows`: Move focus between buttons.
- `Home/End`: Move focus to first/last button.
- Ensure only one button is in the tab sequence (`tabindex="0"` for current, `-1` for others) or handle focus delegation.

**Verification:**
- Run `npx vitest run tests/a11y.test.js`.
- Manually verify focus movement in the Dev Playground using keyboard.

---

## Task 15: Developer Experience (TypeScript & DX)

**Goal:** Provide full IDE support and easier custom integration.
**Files:**
- [NEW] [types/index.d.ts](file:///home/kubuntu/projects/rteditor/types/index.d.ts)
- [MODIFY] [package.json](file:///home/kubuntu/projects/rteditor/package.json)
- [MODIFY] [src/editor.js](file:///home/kubuntu/projects/rteditor/src/editor.js)

**Step 1: TypeScript Definitions**
Provide interfaces for `RichTextEditor`, `EditorOptions`, and the `CLASS_MAP` exports.
```typescript
export interface EditorOptions {
  toolbar?: string[];
  placeholder?: string;
  initialHTML?: string;
  onChange?: (html: string) => void;
  classMap?: Record<string, string>;
}
```

**Step 2: Update `package.json`**
Add `"types": "./types/index.d.ts"` to ensure consumers get auto-completion.

**Step 3: Refactor Options Handling**
Ensure the constructor deeply merges `classMap` overrides so users can just change `h1` without redefining all other tags.

---

## Task 16: Advanced Sanitization (Legacy Cleanup)

**Goal:** Transparently handle "dirty" HTML pasted from Word/Google Docs.
**Files:**
- [MODIFY] [src/normalizer.js](file:///home/kubuntu/projects/rteditor/src/normalizer.js)
- [MODIFY] [tests/normalizer.test.js](file:///home/kubuntu/projects/rteditor/tests/normalizer.test.js)

**Step 1: Tag Flattening (Spans & Divs)**
Implement a recursive pass that "unwraps" `<span>` and `<div>` tags while preserving their text content and children. Legacy editors often produce deeply nested useless wrappers.

**Step 2: Attribute Purging**
Stricter white-listing for `style` attributes. Ensure that only Tailwind classes remain the primary styling driver.

---

## Task 17: Interactive Image Resizing

**Goal:** Allow users to visually resize images within the editor.
**Files:**
- [NEW] [src/resizer.js](file:///home/kubuntu/projects/rteditor/src/resizer.js)
- [MODIFY] [src/editor.js](file:///home/kubuntu/projects/rteditor/src/editor.js)

**Step 1: Implement Resizer logic**
Create handles (small divs) that appear when an `img` is clicked.
Track `mousedown`/`mousemove` to calculate new width/height while maintaining aspect ratio.

**Step 2: Editor Integration**
Listen for `click` events inside the editor root. Show/hide resizing UI based on whether target is an `img`.

---

## Task 18: Delta-based History (Performance)

**Goal:** Optimize memory for large documents.
**Files:**
- [MODIFY] [src/history.js](file:///home/kubuntu/projects/rteditor/src/history.js)

**Step 1: Snapshot + Patches**
Instead of 100 full HTML strings, store every 10th state as a full snapshot and others as diff-patches.

---

## Roadmap Commitment

1.  **A11y (Task 14)** is the highest priority for production readiness.
2.  **TS Definitions (Task 15)** is critical for industrial adoption.
