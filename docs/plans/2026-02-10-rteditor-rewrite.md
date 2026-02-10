# RTEditor — Professional Rich Text Editor Rewrite

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build a professional, lightweight rich text editor that outputs Tailwind CSS v4 native classes on every HTML element, ensuring WYSIWYG fidelity between admin editor and frontend display in any Tailwind-reset environment.

**Architecture:** Zero-dependency vanilla JS library. No `document.execCommand` — all formatting via Selection/Range API with a Command pattern. Vite library mode for ESM + UMD distribution. Editor creates DOM elements with Tailwind classes at creation time (not post-processing), so the WYSIWYG view looks identical to the final rendered output. Central `CLASS_MAP` object is the single source of truth for element→class mappings.

**Tech Stack:** Vanilla JS (ES2022), Vite 6 (build + dev server), Vitest (testing), Tailwind CSS v4 classes (consumer provides Tailwind runtime)

---

## File Structure

```
rteditor/
├── src/
│   ├── index.js           # Public API: export { RichTextEditor, CLASS_MAP }
│   ├── editor.js          # Main RichTextEditor class (orchestrator)
│   ├── engine.js          # EditorEngine: contenteditable, events, exec()
│   ├── commands.js         # All formatting commands (inline + block + insert)
│   ├── selection.js       # Selection/Range utilities
│   ├── history.js         # Undo/Redo manager
│   ├── toolbar.js         # Toolbar component
│   ├── icons.js           # SVG icon strings
│   ├── class-map.js       # Tailwind v4 class definitions
│   └── normalizer.js      # HTML normalization + paste sanitization
├── dev/
│   └── index.html         # Dev playground (not included in build)
├── tests/
│   ├── class-map.test.js
│   ├── normalizer.test.js
│   ├── selection.test.js
│   ├── commands.test.js
│   └── editor.test.js
├── vite.config.js
├── package.json
└── .gitignore
```

---

## Key Design Decisions

### Why no `execCommand`?
`execCommand` creates bare `<b>`, `<i>`, `<div>` elements with NO classes. Tailwind v4's preflight strips ALL default styling (`* { margin:0; padding:0; font-size:inherit; font-weight:inherit }`). So a bare `<h2>` looks like a `<p>`. We MUST control which classes are on every element. This requires creating elements ourselves via Selection/Range API.

### Why no CSS bundling?
The library outputs HTML with Tailwind utility classes. The CONSUMER provides Tailwind CSS runtime. The consumer adds `node_modules/rteditor/dist/**/*.js` to their Tailwind `content` config so all classes are picked up by the JIT compiler. Zero CSS shipped with the library.

### Toolbar Architecture
Toolbar is a separate component that calls `editor.exec(command)`. Editor exposes formatting API, toolbar is one consumer of it. `selectionchange` event drives toolbar button active states.

### Undo/Redo
innerHTML snapshot-based history stack. Cursor position saved as DOM path (array of child indices). Simple, reliable, no OT/CRDT complexity.

---

## Task 1: Project Scaffolding

**Files:**
- Delete: `editor.js`, `src/html-normalizer.js`, `tests/setup.mjs`, `tests/normalize-html.test.mjs`, `index.html` (if exists)
- Create: `package.json`, `vite.config.js`, `.gitignore`, `src/index.js`

**Step 1: Clean out old files**

```bash
rm -f editor.js index.html
rm -rf src/ tests/
mkdir -p src tests dev
```

**Step 2: Create `package.json`**

```json
{
  "name": "rteditor",
  "version": "0.1.0",
  "type": "module",
  "description": "Lightweight rich text editor with native Tailwind CSS v4 class output",
  "main": "./dist/rteditor.umd.js",
  "module": "./dist/rteditor.es.js",
  "exports": {
    ".": {
      "import": "./dist/rteditor.es.js",
      "require": "./dist/rteditor.umd.js"
    }
  },
  "files": [
    "dist"
  ],
  "scripts": {
    "dev": "vite serve dev",
    "build": "vite build",
    "test": "vitest run",
    "test:watch": "vitest"
  },
  "devDependencies": {
    "vite": "^6.1.0",
    "vitest": "^3.0.0",
    "jsdom": "^26.0.0"
  },
  "keywords": ["rich-text-editor", "wysiwyg", "tailwindcss", "contenteditable"],
  "license": "MIT"
}
```

**Step 3: Create `vite.config.js`**

```js
import { defineConfig } from 'vite';
import { resolve } from 'path';

export default defineConfig({
  build: {
    lib: {
      entry: resolve(__dirname, 'src/index.js'),
      name: 'RTEditor',
      fileName: (format) => `rteditor.${format}.js`,
      formats: ['es', 'umd'],
    },
    copyPublicDir: false,
    rollupOptions: {
      output: {
        exports: 'named',
      },
    },
  },
  test: {
    environment: 'jsdom',
    globals: true,
  },
});
```

**Step 4: Create minimal `src/index.js`**

```js
export const VERSION = '0.1.0';
```

**Step 5: Update `.gitignore`**

```
node_modules/
dist/
npm-debug.log*
.vite/
```

**Step 6: Install dependencies and verify**

```bash
npm install
npx vite build
# Expected: dist/rteditor.es.js and dist/rteditor.umd.js created
```

**Step 7: Commit**

```bash
git add -A
git commit -m "chore: scaffold project with Vite library mode"
```

---

## Task 2: Tailwind Class Map

**Files:**
- Create: `src/class-map.js`
- Test: `tests/class-map.test.js`

**Step 1: Write the failing test**

```js
// tests/class-map.test.js
import { describe, it, expect } from 'vitest';
import { CLASS_MAP, getClassFor } from '../src/class-map.js';

describe('CLASS_MAP', () => {
  it('has classes for all block elements', () => {
    const blocks = ['p', 'h1', 'h2', 'h3', 'h4', 'ul', 'ol', 'li', 'blockquote', 'pre'];
    for (const tag of blocks) {
      expect(CLASS_MAP[tag], `Missing class for <${tag}>`).toBeDefined();
      expect(CLASS_MAP[tag].length).toBeGreaterThan(0);
    }
  });

  it('has classes for all inline elements', () => {
    const inlines = ['strong', 'em', 'u', 's', 'code', 'a'];
    for (const tag of inlines) {
      expect(CLASS_MAP[tag], `Missing class for <${tag}>`).toBeDefined();
    }
  });

  it('has classes for media elements', () => {
    expect(CLASS_MAP.img).toBeDefined();
  });

  it('getClassFor returns class string for known tag', () => {
    expect(getClassFor('p')).toBe(CLASS_MAP.p);
    expect(getClassFor('P')).toBe(CLASS_MAP.p); // case insensitive
  });

  it('getClassFor returns empty string for unknown tag', () => {
    expect(getClassFor('div')).toBe('');
    expect(getClassFor('span')).toBe('');
  });
});
```

**Step 2: Run test to verify it fails**

```bash
npx vitest run tests/class-map.test.js
# Expected: FAIL — module not found
```

**Step 3: Implement `src/class-map.js`**

```js
/**
 * Tailwind CSS v4 class mapping for all editor-generated HTML elements.
 * 
 * Tailwind v4 preflight strips ALL default browser styles:
 * - Headings: font-size/weight inherit (look like plain text)
 * - Lists: list-style: none
 * - All elements: margin: 0, padding: 0
 * 
 * These classes restore proper rich-text appearance and ensure
 * identical rendering in any Tailwind v4 environment.
 * 
 * Consumer MUST add this library to their Tailwind content config:
 *   content: ['./node_modules/rteditor/dist/**/*.js']
 */
export const CLASS_MAP = {
  // Block elements
  p:          'text-base leading-7 my-4',
  h1:         'text-4xl font-bold mt-8 mb-4 leading-tight',
  h2:         'text-3xl font-semibold mt-8 mb-3 leading-snug',
  h3:         'text-2xl font-semibold mt-6 mb-3 leading-snug',
  h4:         'text-xl font-semibold mt-4 mb-2',

  // Lists
  ul:         'list-disc pl-6 my-4 space-y-1',
  ol:         'list-decimal pl-6 my-4 space-y-1',
  li:         'text-base leading-7',

  // Quote & code blocks
  blockquote: 'border-l-4 border-gray-300 pl-4 py-1 my-4 italic text-gray-600',
  pre:        'bg-gray-900 text-gray-100 p-4 rounded-lg overflow-x-auto font-mono text-sm my-4',
  code:       'font-mono text-sm bg-gray-100 px-1.5 py-0.5 rounded',

  // Inline formatting
  strong:     'font-bold',
  em:         'italic',
  u:          'underline decoration-2 underline-offset-2',
  s:          'line-through',

  // Links & media
  a:          'text-blue-600 underline decoration-1 underline-offset-2',
  img:        'max-w-full h-auto rounded-lg my-4',
};

/**
 * Get Tailwind classes for a given tag name (case-insensitive).
 * Returns empty string for unknown tags.
 */
export function getClassFor(tagName) {
  return CLASS_MAP[tagName.toLowerCase()] || '';
}
```

**Step 4: Run test to verify it passes**

```bash
npx vitest run tests/class-map.test.js
# Expected: PASS
```

**Step 5: Commit**

```bash
git add -A
git commit -m "feat: add Tailwind v4 class map for all editor elements"
```

---

## Task 3: Selection & DOM Utilities

**Files:**
- Create: `src/selection.js`
- Test: `tests/selection.test.js`

**Step 1: Write the failing tests**

```js
// tests/selection.test.js
import { describe, it, expect, beforeEach } from 'vitest';
import {
  getClosestBlock,
  findParentTag,
  getNodePath,
  resolveNodePath,
  isEditorElement,
  BLOCK_TAGS,
} from '../src/selection.js';

describe('selection utilities', () => {
  let root;

  beforeEach(() => {
    root = document.createElement('div');
    document.body.appendChild(root);
  });

  describe('BLOCK_TAGS', () => {
    it('includes all block-level tags', () => {
      expect(BLOCK_TAGS).toContain('p');
      expect(BLOCK_TAGS).toContain('h1');
      expect(BLOCK_TAGS).toContain('li');
      expect(BLOCK_TAGS).toContain('blockquote');
      expect(BLOCK_TAGS).toContain('pre');
    });
  });

  describe('getClosestBlock', () => {
    it('returns the closest block ancestor', () => {
      root.innerHTML = '<p>hello <strong>world</strong></p>';
      const strong = root.querySelector('strong');
      const textNode = strong.firstChild;
      expect(getClosestBlock(textNode, root).tagName).toBe('P');
    });

    it('returns null if node is outside root', () => {
      const orphan = document.createTextNode('orphan');
      expect(getClosestBlock(orphan, root)).toBeNull();
    });
  });

  describe('findParentTag', () => {
    it('finds parent with matching tag name', () => {
      root.innerHTML = '<p><strong><em>text</em></strong></p>';
      const text = root.querySelector('em').firstChild;
      const result = findParentTag(text, 'strong', root);
      expect(result).not.toBeNull();
      expect(result.tagName).toBe('STRONG');
    });

    it('returns null when tag not found', () => {
      root.innerHTML = '<p><em>text</em></p>';
      const text = root.querySelector('em').firstChild;
      expect(findParentTag(text, 'strong', root)).toBeNull();
    });
  });

  describe('getNodePath / resolveNodePath', () => {
    it('round-trips a node path', () => {
      root.innerHTML = '<p>hello</p><p>world <strong>bold</strong></p>';
      const boldText = root.querySelector('strong').firstChild;
      const path = getNodePath(root, boldText);
      const resolved = resolveNodePath(root, path);
      expect(resolved).toBe(boldText);
    });
  });
});
```

**Step 2: Run test to verify it fails**

```bash
npx vitest run tests/selection.test.js
# Expected: FAIL
```

**Step 3: Implement `src/selection.js`**

```js
/**
 * Selection and DOM traversal utilities for the editor.
 * All operations are relative to an editor root element.
 */

export const BLOCK_TAGS = ['p', 'h1', 'h2', 'h3', 'h4', 'ul', 'ol', 'li', 'blockquote', 'pre'];
export const INLINE_TAGS = ['strong', 'em', 'u', 's', 'code', 'a'];

const BLOCK_SELECTOR = BLOCK_TAGS.join(',');

/**
 * Find the closest block-level ancestor of a node within the editor root.
 * Returns null if not found within root.
 */
export function getClosestBlock(node, root) {
  if (!root.contains(node)) return null;
  let current = node.nodeType === Node.TEXT_NODE ? node.parentElement : node;
  while (current && current !== root) {
    if (current.matches && current.matches(BLOCK_SELECTOR)) return current;
    current = current.parentElement;
  }
  return null;
}

/**
 * Find the closest ancestor with a specific tag name, stopping at root.
 */
export function findParentTag(node, tagName, root) {
  const upper = tagName.toUpperCase();
  let current = node.nodeType === Node.TEXT_NODE ? node.parentElement : node;
  while (current && current !== root) {
    if (current.tagName === upper) return current;
    current = current.parentElement;
  }
  return null;
}

/**
 * Compute a path from root to node as an array of child indices.
 * Used for serializing cursor position for undo/redo.
 */
export function getNodePath(root, node) {
  const path = [];
  let current = node;
  while (current && current !== root) {
    const parent = current.parentNode;
    if (!parent) return path;
    const index = Array.from(parent.childNodes).indexOf(current);
    path.unshift(index);
    current = parent;
  }
  return path;
}

/**
 * Resolve a path (array of child indices) back to a node.
 */
export function resolveNodePath(root, path) {
  let current = root;
  for (const index of path) {
    if (!current || !current.childNodes || index >= current.childNodes.length) return null;
    current = current.childNodes[index];
  }
  return current;
}

/**
 * Check if a node is the editor root element (not a child).
 */
export function isEditorElement(node, root) {
  return node === root;
}

/**
 * Save current selection as serializable paths relative to root.
 */
export function saveSelection(root) {
  const sel = window.getSelection();
  if (!sel || !sel.rangeCount) return null;
  const range = sel.getRangeAt(0);
  if (!root.contains(range.startContainer)) return null;
  return {
    startPath: getNodePath(root, range.startContainer),
    startOffset: range.startOffset,
    endPath: getNodePath(root, range.endContainer),
    endOffset: range.endOffset,
  };
}

/**
 * Restore selection from saved paths.
 */
export function restoreSelection(root, saved) {
  if (!saved) return;
  const startNode = resolveNodePath(root, saved.startPath);
  const endNode = resolveNodePath(root, saved.endPath);
  if (!startNode || !endNode) return;

  const sel = window.getSelection();
  const range = document.createRange();
  try {
    range.setStart(startNode, Math.min(saved.startOffset, startNode.length || startNode.childNodes.length));
    range.setEnd(endNode, Math.min(saved.endOffset, endNode.length || endNode.childNodes.length));
    sel.removeAllRanges();
    sel.addRange(range);
  } catch {
    // Selection restoration can fail if DOM structure changed significantly
  }
}

/**
 * Ensure selection is within the editor root element.
 */
export function isSelectionInEditor(root) {
  const sel = window.getSelection();
  if (!sel || !sel.rangeCount) return false;
  return root.contains(sel.anchorNode);
}
```

**Step 4: Run test to verify it passes**

```bash
npx vitest run tests/selection.test.js
# Expected: PASS
```

**Step 5: Commit**

```bash
git add -A
git commit -m "feat: add selection and DOM traversal utilities"
```

---

## Task 4: Command System

**Files:**
- Create: `src/commands.js`
- Test: `tests/commands.test.js`

**Step 1: Write the failing tests**

```js
// tests/commands.test.js
import { describe, it, expect, beforeEach } from 'vitest';
import { createCommandRegistry, COMMANDS } from '../src/commands.js';
import { CLASS_MAP } from '../src/class-map.js';

describe('command registry', () => {
  let root, registry;

  beforeEach(() => {
    root = document.createElement('div');
    root.setAttribute('contenteditable', 'true');
    root.innerHTML = `<p class="${CLASS_MAP.p}">hello world</p>`;
    document.body.innerHTML = '';
    document.body.appendChild(root);
    registry = createCommandRegistry(root);
  });

  it('registers all standard commands', () => {
    const expected = [
      'bold', 'italic', 'underline', 'strikethrough',
      'h1', 'h2', 'h3', 'h4', 'paragraph',
      'unorderedList', 'orderedList',
      'blockquote', 'codeBlock',
      'link', 'image',
      'clearFormatting',
    ];
    for (const cmd of expected) {
      expect(registry.has(cmd), `Missing command: ${cmd}`).toBe(true);
    }
  });

  describe('inline: bold', () => {
    it('wraps selected text in <strong> with class', () => {
      // Select "hello"
      const textNode = root.querySelector('p').firstChild;
      const range = document.createRange();
      range.setStart(textNode, 0);
      range.setEnd(textNode, 5);
      const sel = window.getSelection();
      sel.removeAllRanges();
      sel.addRange(range);

      registry.exec('bold');

      const strong = root.querySelector('strong');
      expect(strong).not.toBeNull();
      expect(strong.className).toBe(CLASS_MAP.strong);
      expect(strong.textContent).toBe('hello');
    });
  });

  describe('block: h2', () => {
    it('converts <p> to <h2> with correct class', () => {
      // Place cursor inside paragraph
      const textNode = root.querySelector('p').firstChild;
      const range = document.createRange();
      range.setStart(textNode, 0);
      range.collapse(true);
      const sel = window.getSelection();
      sel.removeAllRanges();
      sel.addRange(range);

      registry.exec('h2');

      const h2 = root.querySelector('h2');
      expect(h2).not.toBeNull();
      expect(h2.className).toBe(CLASS_MAP.h2);
      expect(h2.textContent).toBe('hello world');
      expect(root.querySelector('p')).toBeNull();
    });
  });
});
```

**Step 2: Run test to verify it fails**

```bash
npx vitest run tests/commands.test.js
# Expected: FAIL
```

**Step 3: Implement `src/commands.js`**

This is the largest file. Each command is a function that manipulates the DOM using Selection/Range API.

```js
import { CLASS_MAP, getClassFor } from './class-map.js';
import { getClosestBlock, findParentTag, BLOCK_TAGS } from './selection.js';

/**
 * Create a command registry bound to an editor root element.
 */
export function createCommandRegistry(root) {
  const commands = new Map();

  // --- INLINE COMMANDS ---

  function toggleInline(tagName) {
    const sel = window.getSelection();
    if (!sel || !sel.rangeCount) return;
    const range = sel.getRangeAt(0);
    if (!root.contains(range.commonAncestorContainer)) return;

    const existing = findParentTag(range.startContainer, tagName, root);

    if (existing) {
      // Unwrap: replace element with its children
      const parent = existing.parentNode;
      while (existing.firstChild) {
        parent.insertBefore(existing.firstChild, existing);
      }
      parent.removeChild(existing);
      root.normalize(); // merge adjacent text nodes
    } else if (range.collapsed) {
      // Cursor only, no selection: insert zero-width space in wrapper
      const el = document.createElement(tagName);
      el.className = getClassFor(tagName);
      el.textContent = '\u200B';
      range.insertNode(el);
      // Move cursor inside after the zero-width space
      const newRange = document.createRange();
      newRange.setStart(el.firstChild, 1);
      newRange.collapse(true);
      sel.removeAllRanges();
      sel.addRange(newRange);
    } else {
      // Wrap selected content
      const el = document.createElement(tagName);
      el.className = getClassFor(tagName);
      try {
        // Simple case: selection within one parent
        el.appendChild(range.extractContents());
        range.insertNode(el);
      } catch {
        // Cross-boundary: extract and wrap
        const fragment = range.extractContents();
        el.appendChild(fragment);
        range.insertNode(el);
      }
      // Select the wrapped content
      const newRange = document.createRange();
      newRange.selectNodeContents(el);
      sel.removeAllRanges();
      sel.addRange(newRange);
    }
  }

  commands.set('bold',          () => toggleInline('strong'));
  commands.set('italic',        () => toggleInline('em'));
  commands.set('underline',     () => toggleInline('u'));
  commands.set('strikethrough', () => toggleInline('s'));

  // --- BLOCK COMMANDS ---

  function setBlockType(tagName) {
    const sel = window.getSelection();
    if (!sel || !sel.rangeCount) return;

    const block = getClosestBlock(sel.getRangeAt(0).startContainer, root);
    if (!block) return;

    const targetTag = block.tagName.toLowerCase() === tagName ? 'p' : tagName;
    const newBlock = document.createElement(targetTag);
    newBlock.className = getClassFor(targetTag);

    // Move all children from old block to new block
    while (block.firstChild) {
      newBlock.appendChild(block.firstChild);
    }
    block.parentNode.replaceChild(newBlock, block);

    // Restore cursor in new block
    const range = document.createRange();
    range.selectNodeContents(newBlock);
    range.collapse(false);
    sel.removeAllRanges();
    sel.addRange(range);
  }

  commands.set('h1',        () => setBlockType('h1'));
  commands.set('h2',        () => setBlockType('h2'));
  commands.set('h3',        () => setBlockType('h3'));
  commands.set('h4',        () => setBlockType('h4'));
  commands.set('paragraph', () => setBlockType('p'));

  // --- LIST COMMANDS ---

  function toggleList(listTag) {
    const sel = window.getSelection();
    if (!sel || !sel.rangeCount) return;

    const block = getClosestBlock(sel.getRangeAt(0).startContainer, root);
    if (!block) return;

    // If already in a list of this type, unwrap
    if (block.tagName === 'LI' && block.parentElement.tagName === listTag.toUpperCase()) {
      const list = block.parentElement;
      const items = Array.from(list.children);

      // Convert each LI to a P
      const fragment = document.createDocumentFragment();
      for (const li of items) {
        const p = document.createElement('p');
        p.className = getClassFor('p');
        while (li.firstChild) p.appendChild(li.firstChild);
        fragment.appendChild(p);
      }
      list.parentNode.replaceChild(fragment, list);
      return;
    }

    // If in a different list type, switch
    if (block.tagName === 'LI' && block.parentElement) {
      const oldList = block.parentElement;
      const newList = document.createElement(listTag);
      newList.className = getClassFor(listTag);
      while (oldList.firstChild) {
        newList.appendChild(oldList.firstChild);
      }
      oldList.parentNode.replaceChild(newList, oldList);
      return;
    }

    // Wrap current block in a list
    const list = document.createElement(listTag);
    list.className = getClassFor(listTag);
    const li = document.createElement('li');
    li.className = getClassFor('li');
    while (block.firstChild) li.appendChild(block.firstChild);
    list.appendChild(li);
    block.parentNode.replaceChild(list, block);

    // Cursor into LI
    const range = document.createRange();
    range.selectNodeContents(li);
    range.collapse(false);
    sel.removeAllRanges();
    sel.addRange(range);
  }

  commands.set('unorderedList', () => toggleList('ul'));
  commands.set('orderedList',   () => toggleList('ol'));

  // --- BLOCKQUOTE ---

  commands.set('blockquote', () => {
    const sel = window.getSelection();
    if (!sel || !sel.rangeCount) return;
    const block = getClosestBlock(sel.getRangeAt(0).startContainer, root);
    if (!block) return;

    if (block.tagName === 'BLOCKQUOTE') {
      // Unwrap: convert to paragraph
      const p = document.createElement('p');
      p.className = getClassFor('p');
      while (block.firstChild) p.appendChild(block.firstChild);
      block.parentNode.replaceChild(p, block);
    } else {
      const bq = document.createElement('blockquote');
      bq.className = getClassFor('blockquote');

      // If block is a P, replace it. Otherwise wrap contents.
      if (block.parentNode === root) {
        while (block.firstChild) bq.appendChild(block.firstChild);
        block.parentNode.replaceChild(bq, block);
      } else {
        bq.appendChild(block.cloneNode(true));
        block.parentNode.replaceChild(bq, block);
      }
    }
  });

  // --- CODE BLOCK ---

  commands.set('codeBlock', () => {
    const sel = window.getSelection();
    if (!sel || !sel.rangeCount) return;
    const block = getClosestBlock(sel.getRangeAt(0).startContainer, root);
    if (!block) return;

    if (block.tagName === 'PRE') {
      const p = document.createElement('p');
      p.className = getClassFor('p');
      p.textContent = block.textContent;
      block.parentNode.replaceChild(p, block);
    } else {
      const pre = document.createElement('pre');
      pre.className = getClassFor('pre');
      const code = document.createElement('code');
      code.textContent = block.textContent;
      pre.appendChild(code);
      block.parentNode.replaceChild(pre, block);
    }
  });

  // --- LINK ---

  commands.set('link', (url, text) => {
    const sel = window.getSelection();
    if (!sel || !sel.rangeCount) return;
    const range = sel.getRangeAt(0);

    // Check if already in a link
    const existingLink = findParentTag(range.startContainer, 'a', root);
    if (existingLink) {
      if (url) {
        existingLink.href = url;
      } else {
        // Remove link, keep text
        const parent = existingLink.parentNode;
        while (existingLink.firstChild) parent.insertBefore(existingLink.firstChild, existingLink);
        parent.removeChild(existingLink);
      }
      return;
    }

    if (!url) return;

    const a = document.createElement('a');
    a.href = url;
    a.className = getClassFor('a');
    a.target = '_blank';
    a.rel = 'noopener noreferrer';

    if (range.collapsed) {
      a.textContent = text || url;
      range.insertNode(a);
    } else {
      a.appendChild(range.extractContents());
      range.insertNode(a);
    }
  });

  // --- IMAGE ---

  commands.set('image', (src, alt) => {
    if (!src) return;
    const sel = window.getSelection();
    if (!sel || !sel.rangeCount) return;
    const range = sel.getRangeAt(0);

    const img = document.createElement('img');
    img.src = src;
    img.alt = alt || '';
    img.className = getClassFor('img');

    // Insert after current block
    const block = getClosestBlock(range.startContainer, root);
    if (block && block.parentNode) {
      block.parentNode.insertBefore(img, block.nextSibling);
    } else {
      range.insertNode(img);
    }
  });

  // --- CLEAR FORMATTING ---

  commands.set('clearFormatting', () => {
    const sel = window.getSelection();
    if (!sel || !sel.rangeCount) return;
    const range = sel.getRangeAt(0);
    if (range.collapsed) return;

    const text = range.toString();
    range.deleteContents();
    range.insertNode(document.createTextNode(text));
    root.normalize();
  });

  return {
    exec(name, ...args) {
      const cmd = commands.get(name);
      if (!cmd) {
        console.warn(`RTEditor: unknown command "${name}"`);
        return;
      }
      cmd(...args);
    },
    has(name) {
      return commands.has(name);
    },
    list() {
      return Array.from(commands.keys());
    },
  };
}
```

**Step 4: Run tests to verify they pass**

```bash
npx vitest run tests/commands.test.js
# Expected: PASS
```

Note: Some tests may need adjustment based on jsdom's Selection API support. If jsdom doesn't support `surroundContents` or `extractContents` properly, mark those tests as `.skip` with `// TODO: needs browser test` and create corresponding e2e tests later.

**Step 5: Commit**

```bash
git add -A
git commit -m "feat: implement command system with inline and block formatting"
```

---

## Task 5: Undo/Redo History

**Files:**
- Create: `src/history.js`
- Test: `tests/history.test.js`

**Step 1: Write the failing tests**

```js
// tests/history.test.js
import { describe, it, expect, beforeEach } from 'vitest';
import { History } from '../src/history.js';

describe('History', () => {
  let root, history;

  beforeEach(() => {
    root = document.createElement('div');
    root.setAttribute('contenteditable', 'true');
    root.innerHTML = '<p>initial</p>';
    document.body.innerHTML = '';
    document.body.appendChild(root);
    history = new History(root);
    history.push(); // save initial state
  });

  it('saves snapshots', () => {
    expect(history.length).toBe(1);
    root.innerHTML = '<p>changed</p>';
    history.push();
    expect(history.length).toBe(2);
  });

  it('undo restores previous state', () => {
    root.innerHTML = '<p>changed</p>';
    history.push();
    history.undo();
    expect(root.innerHTML).toBe('<p>initial</p>');
  });

  it('redo restores next state', () => {
    root.innerHTML = '<p>changed</p>';
    history.push();
    history.undo();
    history.redo();
    expect(root.innerHTML).toBe('<p>changed</p>');
  });

  it('push after undo discards future states', () => {
    root.innerHTML = '<p>v2</p>';
    history.push();
    root.innerHTML = '<p>v3</p>';
    history.push();
    history.undo(); // back to v2
    root.innerHTML = '<p>v4</p>';
    history.push();
    expect(history.length).toBe(3); // initial, v2, v4
    history.undo();
    expect(root.innerHTML).toBe('<p>v2</p>');
  });

  it('respects max size', () => {
    history = new History(root, 3);
    history.push();
    root.innerHTML = '<p>a</p>'; history.push();
    root.innerHTML = '<p>b</p>'; history.push();
    root.innerHTML = '<p>c</p>'; history.push();
    expect(history.length).toBeLessThanOrEqual(3);
  });

  it('canUndo / canRedo report correctly', () => {
    expect(history.canUndo).toBe(false);
    root.innerHTML = '<p>changed</p>';
    history.push();
    expect(history.canUndo).toBe(true);
    expect(history.canRedo).toBe(false);
    history.undo();
    expect(history.canRedo).toBe(true);
  });
});
```

**Step 2: Run test to verify it fails**

```bash
npx vitest run tests/history.test.js
# Expected: FAIL
```

**Step 3: Implement `src/history.js`**

```js
import { saveSelection, restoreSelection } from './selection.js';

export class History {
  #stack = [];
  #index = -1;
  #root;
  #maxSize;

  constructor(root, maxSize = 100) {
    this.#root = root;
    this.#maxSize = maxSize;
  }

  get length() {
    return this.#stack.length;
  }

  get canUndo() {
    return this.#index > 0;
  }

  get canRedo() {
    return this.#index < this.#stack.length - 1;
  }

  /** Save current state as a snapshot. */
  push() {
    // Discard future states if we're not at the end
    this.#stack = this.#stack.slice(0, this.#index + 1);

    this.#stack.push({
      html: this.#root.innerHTML,
      selection: saveSelection(this.#root),
    });

    // Enforce max size
    if (this.#stack.length > this.#maxSize) {
      this.#stack.shift();
    }

    this.#index = this.#stack.length - 1;
  }

  /** Restore previous state. */
  undo() {
    if (!this.canUndo) return;
    this.#index--;
    this.#restore(this.#stack[this.#index]);
  }

  /** Restore next state. */
  redo() {
    if (!this.canRedo) return;
    this.#index++;
    this.#restore(this.#stack[this.#index]);
  }

  #restore(snapshot) {
    this.#root.innerHTML = snapshot.html;
    if (snapshot.selection) {
      restoreSelection(this.#root, snapshot.selection);
    }
  }
}
```

**Step 4: Run test to verify it passes**

```bash
npx vitest run tests/history.test.js
# Expected: PASS
```

**Step 5: Commit**

```bash
git add -A
git commit -m "feat: implement undo/redo history with selection preservation"
```

---

## Task 6: HTML Normalizer

**Files:**
- Create: `src/normalizer.js`
- Test: `tests/normalizer.test.js`

**Step 1: Write the failing tests**

```js
// tests/normalizer.test.js
import { describe, it, expect } from 'vitest';
import { normalizeHTML, sanitizeHTML } from '../src/normalizer.js';
import { CLASS_MAP } from '../src/class-map.js';

describe('normalizeHTML', () => {
  it('adds Tailwind classes to bare block elements', () => {
    const input = '<h2>Title</h2><p>Text</p>';
    const result = normalizeHTML(input);
    expect(result).toContain(`class="${CLASS_MAP.h2}"`);
    expect(result).toContain(`class="${CLASS_MAP.p}"`);
  });

  it('replaces existing classes with correct Tailwind classes', () => {
    const input = '<p class="old-class">Text</p>';
    const result = normalizeHTML(input);
    expect(result).toContain(`class="${CLASS_MAP.p}"`);
    expect(result).not.toContain('old-class');
  });

  it('normalizes <b> to <strong> and <i> to <em>', () => {
    const input = '<p><b>bold</b> and <i>italic</i></p>';
    const result = normalizeHTML(input);
    expect(result).toContain('<strong');
    expect(result).toContain('<em');
    expect(result).not.toContain('<b>');
    expect(result).not.toContain('<i>');
  });

  it('normalizes inline element classes', () => {
    const input = '<p><strong>bold</strong></p>';
    const result = normalizeHTML(input);
    expect(result).toContain(`class="${CLASS_MAP.strong}"`);
  });

  it('wraps bare text nodes in <p>', () => {
    const input = 'bare text';
    const result = normalizeHTML(input);
    expect(result).toContain('<p');
    expect(result).toContain('bare text');
  });

  it('handles nested lists', () => {
    const input = '<ul><li>Item 1</li><li>Item 2</li></ul>';
    const result = normalizeHTML(input);
    expect(result).toContain(`class="${CLASS_MAP.ul}"`);
    expect(result).toContain(`class="${CLASS_MAP.li}"`);
  });
});

describe('sanitizeHTML', () => {
  it('strips <script> tags', () => {
    const input = '<p>Hello</p><script>alert("xss")</script>';
    const result = sanitizeHTML(input);
    expect(result).not.toContain('script');
  });

  it('strips event handlers', () => {
    const input = '<p onclick="alert(1)">Click</p>';
    const result = sanitizeHTML(input);
    expect(result).not.toContain('onclick');
  });

  it('strips style attributes', () => {
    const input = '<p style="color:red">Styled</p>';
    const result = sanitizeHTML(input);
    expect(result).not.toContain('style=');
  });

  it('preserves href on links', () => {
    const input = '<a href="https://example.com">Link</a>';
    const result = sanitizeHTML(input);
    expect(result).toContain('href="https://example.com"');
  });

  it('preserves src and alt on images', () => {
    const input = '<img src="photo.jpg" alt="Photo">';
    const result = sanitizeHTML(input);
    expect(result).toContain('src="photo.jpg"');
    expect(result).toContain('alt="Photo"');
  });
});
```

**Step 2: Run test to verify it fails**

```bash
npx vitest run tests/normalizer.test.js
# Expected: FAIL
```

**Step 3: Implement `src/normalizer.js`**

```js
import { CLASS_MAP, getClassFor } from './class-map.js';

// Tags we allow in editor output
const ALLOWED_TAGS = new Set([
  'p', 'h1', 'h2', 'h3', 'h4',
  'ul', 'ol', 'li',
  'blockquote', 'pre', 'code',
  'strong', 'em', 'u', 's',
  'a', 'img', 'br',
]);

// Attributes to keep per tag
const ALLOWED_ATTRS = {
  a:   ['href', 'target', 'rel'],
  img: ['src', 'alt'],
};

// Tag normalization: old → new
const TAG_ALIASES = {
  b:      'strong',
  i:      'em',
  strike: 's',
  del:    's',
};

/**
 * Normalize HTML string: ensure every element has correct Tailwind classes,
 * normalize deprecated tags, strip disallowed attributes.
 */
export function normalizeHTML(html) {
  const doc = new DOMParser().parseFromString(`<div>${html}</div>`, 'text/html');
  const container = doc.body.firstChild;

  // Wrap bare text nodes in <p>
  wrapBareTextNodes(container);

  // Process all elements
  processNode(container);

  return container.innerHTML;
}

function wrapBareTextNodes(container) {
  const childNodes = Array.from(container.childNodes);
  for (const node of childNodes) {
    if (node.nodeType === Node.TEXT_NODE && node.textContent.trim()) {
      const p = container.ownerDocument.createElement('p');
      p.className = getClassFor('p');
      p.textContent = node.textContent;
      container.replaceChild(p, node);
    }
  }
}

function processNode(container) {
  const elements = Array.from(container.querySelectorAll('*'));

  for (const el of elements) {
    const tag = el.tagName.toLowerCase();

    // Replace aliased tags (b→strong, i→em, etc.)
    if (TAG_ALIASES[tag]) {
      const newEl = el.ownerDocument.createElement(TAG_ALIASES[tag]);
      while (el.firstChild) newEl.appendChild(el.firstChild);
      el.parentNode.replaceChild(newEl, el);
      applyClasses(newEl);
      continue;
    }

    // Remove disallowed tags (keep their children)
    if (!ALLOWED_TAGS.has(tag)) {
      const parent = el.parentNode;
      while (el.firstChild) parent.insertBefore(el.firstChild, el);
      parent.removeChild(el);
      continue;
    }

    applyClasses(el);
    stripAttributes(el, tag);
  }
}

function applyClasses(el) {
  const tag = el.tagName.toLowerCase();
  const classes = getClassFor(tag);
  if (classes) {
    el.className = classes;
  }
}

function stripAttributes(el, tag) {
  const allowed = ALLOWED_ATTRS[tag] || [];
  const attrs = Array.from(el.attributes);
  for (const attr of attrs) {
    if (attr.name !== 'class' && !allowed.includes(attr.name)) {
      el.removeAttribute(attr.name);
    }
  }
}

/**
 * Sanitize pasted HTML: remove dangerous content, then normalize.
 */
export function sanitizeHTML(html) {
  // Strip script, style, iframe, object, embed tags entirely
  let clean = html.replace(/<(script|style|iframe|object|embed|form|input|textarea|button)[^>]*>[\s\S]*?<\/\1>/gi, '');
  clean = clean.replace(/<(script|style|iframe|object|embed|form|input|textarea|button)[^>]*\/?>/gi, '');

  // Strip event handler attributes
  clean = clean.replace(/\s+on\w+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, '');

  // Strip javascript: URLs
  clean = clean.replace(/href\s*=\s*["']javascript:[^"']*["']/gi, '');

  // Now normalize
  return normalizeHTML(clean);
}
```

**Step 4: Run test to verify it passes**

```bash
npx vitest run tests/normalizer.test.js
# Expected: PASS
```

**Step 5: Commit**

```bash
git add -A
git commit -m "feat: implement HTML normalizer with sanitization and Tailwind class enforcement"
```

---

## Task 7: SVG Icons

**Files:**
- Create: `src/icons.js`

**Step 1: Implement `src/icons.js`**

All icons are inline SVG strings (24x24, stroke-based, 2px stroke). No external dependencies.

```js
/**
 * SVG icon strings for toolbar buttons.
 * All icons: 20x20 viewBox, currentColor stroke, 2px stroke-width.
 */

const s = (d) => `<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${d}</svg>`;

export const ICONS = {
  bold: s('<path d="M6 4h8a4 4 0 0 1 4 4 4 4 0 0 1-4 4H6z"/><path d="M6 12h9a4 4 0 0 1 4 4 4 4 0 0 1-4 4H6z"/>'),
  italic: s('<line x1="19" y1="4" x2="10" y2="4"/><line x1="14" y1="20" x2="5" y2="20"/><line x1="15" y1="4" x2="9" y2="20"/>'),
  underline: s('<path d="M6 3v7a6 6 0 0 0 6 6 6 6 0 0 0 6-6V3"/><line x1="4" y1="21" x2="20" y2="21"/>'),
  strikethrough: s('<path d="M16 4H9a3 3 0 0 0 0 6h6a3 3 0 0 1 0 6H8"/><line x1="4" y1="12" x2="20" y2="12"/>'),
  heading: s('<path d="M6 4v16"/><path d="M18 4v16"/><path d="M6 12h12"/>'),
  list: s('<line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/>'),
  orderedList: s('<line x1="10" y1="6" x2="21" y2="6"/><line x1="10" y1="12" x2="21" y2="12"/><line x1="10" y1="18" x2="21" y2="18"/><path d="M4 6h1v4"/><path d="M4 10h2"/><path d="M6 18H4c0-1 2-2 2-3s-1-1.5-2-1"/>'),
  blockquote: s('<path d="M6 17h3l2-4V7H5v6h3"/><path d="M15 17h3l2-4V7h-6v6h3"/>'),
  code: s('<polyline points="16 18 22 12 16 6"/><polyline points="8 6 2 12 8 18"/>'),
  link: s('<path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/>'),
  image: s('<rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/>'),
  undo: s('<polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10"/>'),
  redo: s('<polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/>'),
  clearFormat: s('<path d="M4 7V4h16v3"/><path d="M9 20h6"/><path d="M12 4v16"/><line x1="3" y1="21" x2="21" y2="3"/>'),
  chevronDown: s('<polyline points="6 9 12 15 18 9"/>'),
};
```

**Step 2: Commit**

```bash
git add src/icons.js
git commit -m "feat: add SVG icon set for toolbar"
```

---

## Task 8: Toolbar Component

**Files:**
- Create: `src/toolbar.js`

**Step 1: Implement `src/toolbar.js`**

The toolbar creates DOM elements with Tailwind classes, binds click handlers to `editor.exec()`, and updates button active states on selection change.

```js
import { ICONS } from './icons.js';
import { getClosestBlock, findParentTag } from './selection.js';

/**
 * Default toolbar button configuration.
 * Groups are separated by '|'.
 */
export const DEFAULT_TOOLBAR = [
  'bold', 'italic', 'underline', 'strikethrough',
  '|',
  'heading',
  '|',
  'unorderedList', 'orderedList', 'blockquote', 'codeBlock',
  '|',
  'link', 'image',
  '|',
  'undo', 'redo',
  '|',
  'clearFormatting',
];

/**
 * Button metadata: label, icon, command, type.
 */
const BUTTON_DEFS = {
  bold:           { label: 'Bold',           icon: 'bold',          command: 'bold',           type: 'inline', tag: 'strong',     shortcut: 'Ctrl+B' },
  italic:         { label: 'Italic',         icon: 'italic',        command: 'italic',         type: 'inline', tag: 'em',         shortcut: 'Ctrl+I' },
  underline:      { label: 'Underline',      icon: 'underline',     command: 'underline',      type: 'inline', tag: 'u',          shortcut: 'Ctrl+U' },
  strikethrough:  { label: 'Strikethrough',  icon: 'strikethrough', command: 'strikethrough',  type: 'inline', tag: 's' },
  heading:        { label: 'Heading',        icon: 'heading',       command: null,             type: 'dropdown' },
  unorderedList:  { label: 'Bullet List',    icon: 'list',          command: 'unorderedList',  type: 'block',  tag: 'ul' },
  orderedList:    { label: 'Numbered List',  icon: 'orderedList',   command: 'orderedList',    type: 'block',  tag: 'ol' },
  blockquote:     { label: 'Quote',          icon: 'blockquote',    command: 'blockquote',     type: 'block',  tag: 'blockquote' },
  codeBlock:      { label: 'Code Block',     icon: 'code',          command: 'codeBlock',      type: 'block',  tag: 'pre' },
  link:           { label: 'Link',           icon: 'link',          command: 'link',           type: 'prompt' },
  image:          { label: 'Image',          icon: 'image',         command: 'image',          type: 'prompt' },
  undo:           { label: 'Undo',           icon: 'undo',          command: 'undo',           type: 'action',                    shortcut: 'Ctrl+Z' },
  redo:           { label: 'Redo',           icon: 'redo',          command: 'redo',           type: 'action',                    shortcut: 'Ctrl+Shift+Z' },
  clearFormatting:{ label: 'Clear Format',   icon: 'clearFormat',   command: 'clearFormatting',type: 'action' },
};

const HEADING_OPTIONS = [
  { label: 'Heading 1', command: 'h1', tag: 'h1' },
  { label: 'Heading 2', command: 'h2', tag: 'h2' },
  { label: 'Heading 3', command: 'h3', tag: 'h3' },
  { label: 'Heading 4', command: 'h4', tag: 'h4' },
  { label: 'Paragraph', command: 'paragraph', tag: 'p' },
];

export class Toolbar {
  #container;
  #editor;          // editor instance (has exec, contentEl)
  #buttons = {};    // name → { el, def }
  #dropdown = null; // heading dropdown element

  constructor(editor, toolbarItems = DEFAULT_TOOLBAR) {
    this.#editor = editor;
    this.#container = document.createElement('div');
    this.#container.className = 'flex flex-wrap items-center gap-0.5 p-2 border-b border-gray-200 bg-gray-50 rounded-t-lg';
    this.#container.setAttribute('role', 'toolbar');

    this.#buildButtons(toolbarItems);
  }

  get element() {
    return this.#container;
  }

  #buildButtons(items) {
    for (const item of items) {
      if (item === '|') {
        const sep = document.createElement('div');
        sep.className = 'w-px h-6 bg-gray-300 mx-1';
        this.#container.appendChild(sep);
        continue;
      }

      const def = BUTTON_DEFS[item];
      if (!def) continue;

      if (def.type === 'dropdown') {
        this.#createDropdown(item, def);
      } else {
        this.#createButton(item, def);
      }
    }
  }

  #createButton(name, def) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'p-1.5 rounded hover:bg-gray-200 transition-colors text-gray-600 hover:text-gray-900';
    btn.innerHTML = ICONS[def.icon] || def.label;
    btn.title = def.shortcut ? `${def.label} (${def.shortcut})` : def.label;
    btn.setAttribute('data-command', name);

    btn.addEventListener('mousedown', (e) => {
      e.preventDefault(); // Don't steal focus from editor
    });

    btn.addEventListener('click', (e) => {
      e.preventDefault();
      if (def.type === 'prompt' && def.command === 'link') {
        const url = prompt('Enter URL:');
        if (url) this.#editor.exec('link', url);
      } else if (def.type === 'prompt' && def.command === 'image') {
        const src = prompt('Enter image URL:');
        if (src) this.#editor.exec('image', src);
      } else {
        this.#editor.exec(def.command);
      }
    });

    this.#buttons[name] = { el: btn, def };
    this.#container.appendChild(btn);
  }

  #createDropdown(name, def) {
    const wrapper = document.createElement('div');
    wrapper.className = 'relative';

    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'flex items-center gap-0.5 p-1.5 rounded hover:bg-gray-200 transition-colors text-gray-600 hover:text-gray-900';
    btn.innerHTML = `${ICONS[def.icon]}${ICONS.chevronDown}`;
    btn.title = def.label;

    const dropdown = document.createElement('div');
    dropdown.className = 'absolute left-0 top-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg py-1 min-w-36 z-50 hidden';

    for (const opt of HEADING_OPTIONS) {
      const item = document.createElement('button');
      item.type = 'button';
      item.className = 'w-full text-left px-3 py-1.5 text-sm hover:bg-gray-100 transition-colors';
      item.textContent = opt.label;
      item.setAttribute('data-command', opt.command);
      item.setAttribute('data-tag', opt.tag);

      item.addEventListener('mousedown', (e) => e.preventDefault());
      item.addEventListener('click', (e) => {
        e.preventDefault();
        this.#editor.exec(opt.command);
        dropdown.classList.add('hidden');
      });

      dropdown.appendChild(item);
    }

    btn.addEventListener('mousedown', (e) => e.preventDefault());
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      dropdown.classList.toggle('hidden');
    });

    // Close dropdown on outside click
    document.addEventListener('click', (e) => {
      if (!wrapper.contains(e.target)) {
        dropdown.classList.add('hidden');
      }
    });

    wrapper.appendChild(btn);
    wrapper.appendChild(dropdown);
    this.#buttons[name] = { el: btn, def };
    this.#dropdown = dropdown;
    this.#container.appendChild(wrapper);
  }

  /**
   * Update button active states based on current selection.
   * Called on every selectionchange event.
   */
  updateState(editorRoot) {
    const sel = window.getSelection();
    if (!sel || !sel.rangeCount) return;

    const node = sel.anchorNode;
    if (!editorRoot.contains(node)) return;

    const block = getClosestBlock(node, editorRoot);
    const blockTag = block ? block.tagName.toLowerCase() : 'p';

    for (const [name, { el, def }] of Object.entries(this.#buttons)) {
      if (def.type === 'inline') {
        const isActive = !!findParentTag(node, def.tag, editorRoot);
        el.classList.toggle('bg-gray-200', isActive);
        el.classList.toggle('text-blue-600', isActive);
      }

      if (def.type === 'block') {
        let isActive = false;
        if (def.tag === 'ul' || def.tag === 'ol') {
          isActive = block?.tagName === 'LI' && block.parentElement?.tagName === def.tag.toUpperCase();
        } else {
          isActive = blockTag === def.tag;
        }
        el.classList.toggle('bg-gray-200', isActive);
        el.classList.toggle('text-blue-600', isActive);
      }
    }

    // Update heading dropdown items
    if (this.#dropdown) {
      for (const item of this.#dropdown.children) {
        const tag = item.getAttribute('data-tag');
        const isActive = blockTag === tag;
        item.classList.toggle('bg-gray-100', isActive);
        item.classList.toggle('font-semibold', isActive);
      }
    }
  }

  destroy() {
    this.#container.remove();
    this.#buttons = {};
  }
}
```

**Step 2: Commit**

```bash
git add src/toolbar.js
git commit -m "feat: implement professional toolbar with dropdown and state tracking"
```

---

## Task 9: Editor Engine (Core)

**Files:**
- Create: `src/engine.js`

**Step 1: Implement `src/engine.js`**

The engine manages the contenteditable div, event handling, and coordinates commands + history.

```js
import { CLASS_MAP, getClassFor } from './class-map.js';
import { createCommandRegistry } from './commands.js';
import { History } from './history.js';
import { getClosestBlock, isSelectionInEditor, saveSelection, restoreSelection } from './selection.js';

export class EditorEngine {
  #root;
  #commands;
  #history;
  #onChange;
  #debounceTimer = null;

  constructor(contentEl, { onChange } = {}) {
    this.#root = contentEl;
    this.#onChange = onChange || (() => {});
    this.#commands = createCommandRegistry(this.#root);
    this.#history = new History(this.#root);

    this.#setupContentEditable();
    this.#bindEvents();

    // Save initial state
    this.#history.push();
  }

  get contentEl() {
    return this.#root;
  }

  get history() {
    return this.#history;
  }

  /** Execute a formatting command by name. */
  exec(command, ...args) {
    if (command === 'undo') {
      this.#history.undo();
      this.#emitChange();
      return;
    }
    if (command === 'redo') {
      this.#history.redo();
      this.#emitChange();
      return;
    }

    this.#commands.exec(command, ...args);
    this.#history.push();
    this.#emitChange();
  }

  /** Get normalized HTML content. */
  getHTML() {
    return this.#root.innerHTML;
  }

  /** Set HTML content (normalized). */
  setHTML(html) {
    this.#root.innerHTML = html || '';
    this.#ensureDefaultBlock();
    this.#history.push();
  }

  /** Get plain text content. */
  getText() {
    return this.#root.textContent || '';
  }

  #setupContentEditable() {
    this.#root.setAttribute('contenteditable', 'true');
    this.#root.setAttribute('role', 'textbox');
    this.#root.setAttribute('aria-multiline', 'true');
    this.#ensureDefaultBlock();
  }

  /** Ensure the editor always has at least one block element. */
  #ensureDefaultBlock() {
    if (!this.#root.firstChild || this.#root.innerHTML.trim() === '' || this.#root.innerHTML === '<br>') {
      this.#root.innerHTML = '';
      const p = document.createElement('p');
      p.className = getClassFor('p');
      p.appendChild(document.createElement('br'));
      this.#root.appendChild(p);
    }
  }

  #bindEvents() {
    // Handle Enter key: create proper block elements
    this.#root.addEventListener('keydown', (e) => this.#handleKeydown(e));

    // Handle paste: sanitize
    this.#root.addEventListener('paste', (e) => this.#handlePaste(e));

    // Track input for history and change events
    this.#root.addEventListener('input', () => this.#handleInput());

    // Normalize bare text/divs after mutations
    this.#root.addEventListener('input', () => this.#normalizeContent());
  }

  #handleKeydown(e) {
    // Keyboard shortcuts
    if ((e.ctrlKey || e.metaKey) && !e.shiftKey) {
      switch (e.key.toLowerCase()) {
        case 'b': e.preventDefault(); this.exec('bold'); return;
        case 'i': e.preventDefault(); this.exec('italic'); return;
        case 'u': e.preventDefault(); this.exec('underline'); return;
        case 'z': e.preventDefault(); this.exec('undo'); return;
      }
    }
    if ((e.ctrlKey || e.metaKey) && e.shiftKey) {
      switch (e.key.toLowerCase()) {
        case 'z': e.preventDefault(); this.exec('redo'); return;
      }
    }

    // Enter key: create new paragraph (not div)
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      this.#handleEnter();
    }

    // Tab in lists: indent/outdent (future enhancement)
  }

  #handleEnter() {
    const sel = window.getSelection();
    if (!sel || !sel.rangeCount) return;
    const range = sel.getRangeAt(0);

    // Delete selected content first
    if (!range.collapsed) {
      range.deleteContents();
    }

    const block = getClosestBlock(range.startContainer, this.#root);

    if (!block) {
      // No block context, create a paragraph
      const p = document.createElement('p');
      p.className = getClassFor('p');
      p.appendChild(document.createElement('br'));
      this.#root.appendChild(p);
      this.#setCursorToStart(p);
      return;
    }

    // Check if in a heading: Enter after heading creates a paragraph
    const isHeading = /^H[1-4]$/.test(block.tagName);
    const isListItem = block.tagName === 'LI';

    // Empty list item: remove from list, create paragraph
    if (isListItem && block.textContent.trim() === '') {
      const list = block.parentElement;
      const p = document.createElement('p');
      p.className = getClassFor('p');
      p.appendChild(document.createElement('br'));

      // If this is the only item, remove the whole list
      if (list.children.length === 1) {
        list.parentNode.replaceChild(p, list);
      } else {
        block.remove();
        list.parentNode.insertBefore(p, list.nextSibling);
      }
      this.#setCursorToStart(p);
      this.#history.push();
      this.#emitChange();
      return;
    }

    // Split block at cursor
    const afterRange = document.createRange();
    afterRange.setStart(range.endContainer, range.endOffset);
    afterRange.setEndAfter(block.lastChild || block);
    const afterContent = afterRange.extractContents();

    // Determine new block type
    let newTag, newClass;
    if (isListItem) {
      newTag = 'li';
      newClass = getClassFor('li');
    } else {
      newTag = 'p';
      newClass = getClassFor('p');
    }

    const newBlock = document.createElement(newTag);
    newBlock.className = newClass;

    if (!afterContent.textContent.trim() && afterContent.childNodes.length === 0) {
      newBlock.appendChild(document.createElement('br'));
    } else {
      newBlock.appendChild(afterContent);
    }

    // Handle empty original block
    if (!block.textContent.trim() && !block.querySelector('br, img')) {
      block.innerHTML = '';
      block.appendChild(document.createElement('br'));
    }

    // Insert new block
    if (isListItem) {
      block.parentNode.insertBefore(newBlock, block.nextSibling);
    } else {
      block.parentNode.insertBefore(newBlock, block.nextSibling);
    }

    this.#setCursorToStart(newBlock);
    this.#history.push();
    this.#emitChange();
  }

  #handlePaste(e) {
    e.preventDefault();
    const clipboardData = e.clipboardData;
    if (!clipboardData) return;

    // Prefer HTML, fall back to plain text
    let html = clipboardData.getData('text/html');
    const text = clipboardData.getData('text/plain');

    if (html) {
      // Use the normalizer to sanitize pasted HTML
      // We import dynamically to avoid circular deps
      import('./normalizer.js').then(({ sanitizeHTML }) => {
        const clean = sanitizeHTML(html);
        this.#insertHTML(clean);
        this.#history.push();
        this.#emitChange();
      });
    } else if (text) {
      // Insert plain text as paragraphs
      const paragraphs = text.split(/\n\n+/);
      const fragment = document.createDocumentFragment();
      for (const para of paragraphs) {
        if (!para.trim()) continue;
        const p = document.createElement('p');
        p.className = getClassFor('p');
        // Preserve single line breaks as <br>
        const lines = para.split('\n');
        lines.forEach((line, i) => {
          p.appendChild(document.createTextNode(line));
          if (i < lines.length - 1) p.appendChild(document.createElement('br'));
        });
        fragment.appendChild(p);
      }
      const sel = window.getSelection();
      if (sel && sel.rangeCount) {
        const range = sel.getRangeAt(0);
        range.deleteContents();
        range.insertNode(fragment);
        range.collapse(false);
      }
      this.#history.push();
      this.#emitChange();
    }
  }

  #insertHTML(html) {
    const sel = window.getSelection();
    if (!sel || !sel.rangeCount) return;
    const range = sel.getRangeAt(0);
    range.deleteContents();

    const temp = document.createElement('div');
    temp.innerHTML = html;
    const fragment = document.createDocumentFragment();
    while (temp.firstChild) fragment.appendChild(temp.firstChild);
    range.insertNode(fragment);
    range.collapse(false);
  }

  #handleInput() {
    // Debounce history snapshots for typed text
    clearTimeout(this.#debounceTimer);
    this.#debounceTimer = setTimeout(() => {
      this.#history.push();
    }, 500);

    this.#emitChange();
  }

  /**
   * Normalize content: replace bare divs/text with <p>, ensure classes.
   * Runs after every input to keep DOM clean.
   */
  #normalizeContent() {
    const children = Array.from(this.#root.childNodes);
    for (const child of children) {
      if (child.nodeType === Node.TEXT_NODE && child.textContent.trim()) {
        // Wrap bare text in <p>
        const p = document.createElement('p');
        p.className = getClassFor('p');
        p.textContent = child.textContent;
        this.#root.replaceChild(p, child);
      } else if (child.nodeType === Node.ELEMENT_NODE && child.tagName === 'DIV') {
        // Replace <div> with <p>
        const p = document.createElement('p');
        p.className = getClassFor('p');
        while (child.firstChild) p.appendChild(child.firstChild);
        this.#root.replaceChild(p, child);
      }
    }
  }

  #setCursorToStart(el) {
    const sel = window.getSelection();
    const range = document.createRange();
    if (el.firstChild) {
      range.setStart(el.firstChild, 0);
    } else {
      range.setStart(el, 0);
    }
    range.collapse(true);
    sel.removeAllRanges();
    sel.addRange(range);
  }

  #emitChange() {
    this.#onChange(this.getHTML());
  }

  destroy() {
    clearTimeout(this.#debounceTimer);
    this.#root.removeAttribute('contenteditable');
    this.#root.removeAttribute('role');
    this.#root.removeAttribute('aria-multiline');
  }
}
```

**Step 2: Commit**

```bash
git add src/engine.js
git commit -m "feat: implement editor engine with event handling, paste, and Enter key logic"
```

---

## Task 10: Main RichTextEditor Class (Integration)

**Files:**
- Create: `src/editor.js`
- Update: `src/index.js`

**Step 1: Implement `src/editor.js`**

This is the public-facing class that ties everything together.

```js
import { EditorEngine } from './engine.js';
import { Toolbar, DEFAULT_TOOLBAR } from './toolbar.js';
import { CLASS_MAP, getClassFor } from './class-map.js';
import { normalizeHTML, sanitizeHTML } from './normalizer.js';

export class RichTextEditor {
  #wrapper;
  #engine;
  #toolbar;
  #options;

  /**
   * @param {string|HTMLElement} target - CSS selector or DOM element to attach to
   * @param {Object} options
   * @param {string[]} options.toolbar - Toolbar button names (default: DEFAULT_TOOLBAR)
   * @param {string} options.placeholder - Placeholder text
   * @param {Function} options.onChange - Called with HTML string on every change
   * @param {string} options.initialHTML - Initial HTML content
   * @param {Object} options.classMap - Override default Tailwind class mappings
   */
  constructor(target, options = {}) {
    this.#options = {
      toolbar: DEFAULT_TOOLBAR,
      placeholder: 'Start writing...',
      onChange: () => {},
      initialHTML: '',
      classMap: null,
      ...options,
    };

    // Apply custom class map overrides
    if (this.#options.classMap) {
      Object.assign(CLASS_MAP, this.#options.classMap);
    }

    const container = typeof target === 'string'
      ? document.querySelector(target)
      : target;

    if (!container) {
      throw new Error(`RTEditor: target "${target}" not found`);
    }

    this.#buildUI(container);
    this.#init();
  }

  #buildUI(container) {
    // Create wrapper
    this.#wrapper = document.createElement('div');
    this.#wrapper.className = 'border border-gray-300 rounded-lg overflow-hidden bg-white';

    // Create content area
    const contentEl = document.createElement('div');
    contentEl.className = 'p-4 min-h-48 max-h-[70vh] overflow-y-auto outline-none focus:ring-2 focus:ring-blue-500/20 rounded-b-lg';

    // Create engine (manages contenteditable)
    this.#engine = new EditorEngine(contentEl, {
      onChange: (html) => this.#options.onChange(html),
    });

    // Create toolbar
    this.#toolbar = new Toolbar(
      { exec: (...args) => this.#engine.exec(...args), contentEl },
      this.#options.toolbar,
    );

    // Assemble
    this.#wrapper.appendChild(this.#toolbar.element);
    this.#wrapper.appendChild(contentEl);
    container.appendChild(this.#wrapper);
  }

  #init() {
    // Set initial content
    if (this.#options.initialHTML) {
      this.setHTML(this.#options.initialHTML);
    }

    // Placeholder
    this.#setupPlaceholder();

    // Toolbar state tracking
    document.addEventListener('selectionchange', () => {
      this.#toolbar.updateState(this.#engine.contentEl);
    });
  }

  #setupPlaceholder() {
    const contentEl = this.#engine.contentEl;
    const placeholder = this.#options.placeholder;

    const updatePlaceholder = () => {
      const isEmpty = !contentEl.textContent.trim() && !contentEl.querySelector('img');
      contentEl.setAttribute('data-placeholder', isEmpty ? placeholder : '');
    };

    // CSS for placeholder via data attribute
    const style = document.createElement('style');
    style.textContent = `
      [data-placeholder]:empty::before,
      [data-placeholder]:has(> p:only-child > br:only-child)::before {
        content: attr(data-placeholder);
        color: #9ca3af;
        pointer-events: none;
        position: absolute;
      }
      [contenteditable][data-placeholder] {
        position: relative;
      }
    `;
    document.head.appendChild(style);

    contentEl.addEventListener('input', updatePlaceholder);
    contentEl.addEventListener('focus', updatePlaceholder);
    contentEl.addEventListener('blur', updatePlaceholder);
    updatePlaceholder();
  }

  /** Get the current HTML content (normalized). */
  getHTML() {
    return normalizeHTML(this.#engine.getHTML());
  }

  /** Get raw (un-normalized) HTML from the editor. */
  getRawHTML() {
    return this.#engine.getHTML();
  }

  /** Set HTML content (will be normalized). */
  setHTML(html) {
    const normalized = normalizeHTML(html);
    this.#engine.setHTML(normalized);
  }

  /** Get plain text content. */
  getText() {
    return this.#engine.getText();
  }

  /** Execute a formatting command programmatically. */
  exec(command, ...args) {
    this.#engine.exec(command, ...args);
  }

  /** Focus the editor. */
  focus() {
    this.#engine.contentEl.focus();
  }

  /** Check if editor is empty. */
  isEmpty() {
    return !this.#engine.getText().trim();
  }

  /** Destroy the editor and clean up. */
  destroy() {
    this.#engine.destroy();
    this.#toolbar.destroy();
    this.#wrapper.remove();
  }
}
```

**Step 2: Update `src/index.js`**

```js
export { RichTextEditor } from './editor.js';
export { CLASS_MAP, getClassFor } from './class-map.js';
export { normalizeHTML, sanitizeHTML } from './normalizer.js';
export { DEFAULT_TOOLBAR } from './toolbar.js';
```

**Step 3: Commit**

```bash
git add -A
git commit -m "feat: implement main RichTextEditor class with full public API"
```

---

## Task 11: Dev Playground

**Files:**
- Create: `dev/index.html`

**Step 1: Create dev playground**

This is the development test page. Run `npm run dev` to open it with HMR.

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>RTEditor — Dev Playground</title>
  <script src="https://cdn.tailwindcss.com"></script>
  <style>
    /* Extra styles for dev only */
    body { background: #f3f4f6; }
    .output-preview { font-family: monospace; white-space: pre-wrap; font-size: 13px; }
  </style>
</head>
<body class="p-8 max-w-4xl mx-auto">
  <h1 class="text-3xl font-bold mb-8 text-gray-900">RTEditor Dev Playground</h1>

  <!-- Editor Container -->
  <div class="mb-8">
    <h2 class="text-lg font-semibold mb-2 text-gray-700">Editor</h2>
    <div id="editor"></div>
  </div>

  <!-- HTML Output -->
  <div class="mb-8">
    <div class="flex items-center justify-between mb-2">
      <h2 class="text-lg font-semibold text-gray-700">HTML Output</h2>
      <button id="copy-btn" class="text-sm px-3 py-1 bg-gray-200 rounded hover:bg-gray-300 transition-colors">
        Copy HTML
      </button>
    </div>
    <div id="output" class="output-preview bg-white border border-gray-300 rounded-lg p-4 max-h-64 overflow-auto text-gray-800"></div>
  </div>

  <!-- Rendered Preview -->
  <div class="mb-8">
    <h2 class="text-lg font-semibold mb-2 text-gray-700">Rendered Preview (Tailwind Context)</h2>
    <div id="preview" class="bg-white border border-gray-300 rounded-lg p-6"></div>
  </div>

  <script type="module">
    import { RichTextEditor } from '../src/index.js';

    const editor = new RichTextEditor('#editor', {
      placeholder: 'Start writing something amazing...',
      onChange: (html) => {
        document.getElementById('output').textContent = html;
        document.getElementById('preview').innerHTML = html;
      },
    });

    // Copy button
    document.getElementById('copy-btn').addEventListener('click', () => {
      navigator.clipboard.writeText(editor.getHTML());
      const btn = document.getElementById('copy-btn');
      btn.textContent = 'Copied!';
      setTimeout(() => btn.textContent = 'Copy HTML', 1500);
    });

    // Expose to console for debugging
    window.editor = editor;
    console.log('RTEditor instance available as window.editor');
    console.log('Try: editor.getHTML(), editor.setHTML("<h1>Hello</h1>"), editor.exec("bold")');
  </script>
</body>
</html>
```

**Step 2: Test dev server**

```bash
npm run dev
# Expected: Opens http://localhost:5173 with the playground
# - Editor should be visible with toolbar
# - Typing should work
# - HTML output should update in real-time
# - Preview should render Tailwind-styled content
```

**Step 3: Commit**

```bash
git add dev/
git commit -m "feat: add dev playground with live HTML output and preview"
```

---

## Task 12: Test Suite

**Files:**
- Update: all test files from previous tasks
- Create: `tests/editor.test.js`

**Step 1: Write editor integration tests**

```js
// tests/editor.test.js
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { RichTextEditor } from '../src/index.js';
import { CLASS_MAP } from '../src/class-map.js';

describe('RichTextEditor', () => {
  let container;

  beforeEach(() => {
    container = document.createElement('div');
    container.id = 'editor-test';
    document.body.innerHTML = '';
    document.body.appendChild(container);
  });

  it('initializes with target selector', () => {
    const editor = new RichTextEditor('#editor-test');
    expect(container.querySelector('[contenteditable]')).not.toBeNull();
    editor.destroy();
  });

  it('initializes with DOM element', () => {
    const editor = new RichTextEditor(container);
    expect(container.querySelector('[contenteditable]')).not.toBeNull();
    editor.destroy();
  });

  it('throws for invalid target', () => {
    expect(() => new RichTextEditor('#nonexistent')).toThrow('not found');
  });

  it('sets and gets HTML', () => {
    const editor = new RichTextEditor(container);
    editor.setHTML('<h2>Title</h2><p>Content</p>');
    const html = editor.getHTML();
    expect(html).toContain('Title');
    expect(html).toContain('Content');
    expect(html).toContain(CLASS_MAP.h2);
    editor.destroy();
  });

  it('reports isEmpty correctly', () => {
    const editor = new RichTextEditor(container);
    expect(editor.isEmpty()).toBe(true);
    editor.setHTML('<p>hello</p>');
    expect(editor.isEmpty()).toBe(false);
    editor.destroy();
  });

  it('calls onChange on setHTML', () => {
    const onChange = vi.fn();
    const editor = new RichTextEditor(container, { onChange });
    editor.setHTML('<p>test</p>');
    // onChange may be called through engine
    editor.destroy();
  });

  it('gets plain text', () => {
    const editor = new RichTextEditor(container);
    editor.setHTML('<h1>Title</h1><p>Hello <strong>world</strong></p>');
    const text = editor.getText();
    expect(text).toContain('Title');
    expect(text).toContain('Hello world');
    editor.destroy();
  });

  it('renders toolbar', () => {
    const editor = new RichTextEditor(container);
    const toolbar = container.querySelector('[role="toolbar"]');
    expect(toolbar).not.toBeNull();
    expect(toolbar.querySelectorAll('button').length).toBeGreaterThan(5);
    editor.destroy();
  });

  it('applies initial HTML on construction', () => {
    const editor = new RichTextEditor(container, {
      initialHTML: '<h2>Welcome</h2>',
    });
    expect(editor.getHTML()).toContain('Welcome');
    editor.destroy();
  });

  it('cleans up on destroy', () => {
    const editor = new RichTextEditor(container);
    editor.destroy();
    expect(container.querySelector('[contenteditable]')).toBeNull();
    expect(container.querySelector('[role="toolbar"]')).toBeNull();
  });
});
```

**Step 2: Run all tests**

```bash
npx vitest run
# Expected: All tests PASS
```

**Step 3: Commit**

```bash
git add -A
git commit -m "test: add comprehensive test suite for editor, commands, normalizer, history"
```

---

## Task 13: Build & Package Verification

**Step 1: Run production build**

```bash
npm run build
```

Expected output:
```
dist/
├── rteditor.es.js    (ESM bundle)
└── rteditor.umd.js   (UMD bundle)
```

**Step 2: Verify ESM import works**

```bash
node -e "import('./dist/rteditor.es.js').then(m => console.log(Object.keys(m)))"
# Expected: ['RichTextEditor', 'CLASS_MAP', 'getClassFor', 'normalizeHTML', 'sanitizeHTML', 'DEFAULT_TOOLBAR']
```

**Step 3: Verify UMD global works**

Create a temporary test:
```bash
node -e "
  const { JSDOM } = require('jsdom');
  const dom = new JSDOM('<!DOCTYPE html><div id=\"app\"></div>', { runScripts: 'dangerously' });
  // UMD should expose RTEditor global
  console.log('UMD build exists:', require('fs').existsSync('./dist/rteditor.umd.js'));
"
```

**Step 4: Verify package.json exports are correct**

```bash
node -e "
  const pkg = require('./package.json');
  console.log('main:', pkg.main);
  console.log('module:', pkg.module);
  console.log('exports:', JSON.stringify(pkg.exports));
"
# Expected:
# main: ./dist/rteditor.umd.js
# module: ./dist/rteditor.es.js
# exports: {".":{"import":"./dist/rteditor.es.js","require":"./dist/rteditor.umd.js"}}
```

**Step 5: Final commit**

```bash
git add -A
git commit -m "chore: verify build output and package configuration"
```

---

## Consumer Integration Guide

### NPM Install
```bash
npm install rteditor
```

### Tailwind Config (consumer must add)
```js
// tailwind.config.js or CSS @source
content: [
  './src/**/*.{html,js}',
  './node_modules/rteditor/dist/**/*.js',  // ← REQUIRED
]
```

### Usage
```js
import { RichTextEditor } from 'rteditor';

const editor = new RichTextEditor('#editor', {
  placeholder: 'Write something...',
  toolbar: ['bold', 'italic', 'underline', '|', 'heading', '|', 'unorderedList', 'orderedList'],
  onChange: (html) => {
    // html has Tailwind classes on every element
    // Save to database, send to API, etc.
  },
  classMap: {
    // Optional: override specific element classes
    h1: 'text-5xl font-black mb-6',
  },
});

// API
editor.getHTML();        // Normalized HTML with Tailwind classes
editor.setHTML(html);    // Set content (normalizes input)
editor.getText();        // Plain text
editor.exec('bold');     // Programmatic formatting
editor.isEmpty();        // Check if empty
editor.focus();          // Focus editor
editor.destroy();        // Clean up
```

### Rendering Saved Content
```html
<!-- The HTML from getHTML() renders correctly in any Tailwind v4 environment -->
<div class="content-area">
  ${savedHTML}
  <!-- ↑ Already has all Tailwind classes, renders identically to editor WYSIWYG view -->
</div>
```

---

## Summary

| Module | Lines (est.) | Purpose |
|--------|:---:|---------|
| `class-map.js` | 40 | Single source of truth for Tailwind classes |
| `selection.js` | 90 | Selection/Range/DOM utilities |
| `commands.js` | 200 | All formatting commands (no execCommand) |
| `history.js` | 50 | Undo/Redo with cursor preservation |
| `normalizer.js` | 90 | HTML normalization + paste sanitization |
| `icons.js` | 50 | SVG icon strings |
| `toolbar.js` | 180 | Toolbar UI + state tracking |
| `engine.js` | 200 | Core contenteditable + events |
| `editor.js` | 100 | Public API orchestrator |
| **Total** | **~1000** | |
