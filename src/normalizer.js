import { CLASS_MAP, getClassFor } from './class-map.js';

// Tags we strictly block (dangerous or unwanted)
const BLOCKED_TAGS = new Set([
  'script', 'style', 'iframe', 'object', 'embed', 'form', 
  'input', 'textarea', 'button', 'select', 'meta', 'link',
  'canvas', 'svg', 'audio', 'video'
]);

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

// Dangerous URL schemes
const BLOCKED_PROTOCOLS = /^(javascript|data|vbscript|file):/i;

// Tags that count as blocks (don't need wrapping at root)
const BLOCK_TAGS = new Set(['p', 'h1', 'h2', 'h3', 'h4', 'ul', 'ol', 'blockquote', 'pre']);

// Tag normalization: old → new (aliasing)
const TAG_ALIASES = {
  b:      'strong',
  i:      'em',
  strike: 's',
  del:    's',
};

/**
 * Normalize HTML string: ensure every element has correct Tailwind classes,
 * normalize deprecated tags, strip disallowed attributes and dangerous content.
 */
export function normalizeHTML(html, classMap = CLASS_MAP) {
  if (!html) return '';
  
  const doc = new DOMParser().parseFromString(`<div>${html}</div>`, 'text/html');
  const container = doc.body.firstChild;

  // 1. Process all elements (sanitize, alias, strip)
  processNodes(container, classMap);

  // 2. Final pass: Ensure all root content is wrapped in block tags (usually <p>)
  ensureBlockWrappers(container, classMap);

  return container.innerHTML;
}

/**
 * Ensures all children of the container are blocks.
 * Wraps sequences of inline content (text nodes or inline elements) into <p> tags.
 */
function ensureBlockWrappers(container, classMap) {
  const nodes = Array.from(container.childNodes);
  let currentGroup = [];

  const flushGroup = () => {
    if (currentGroup.length === 0) return;
    
    // Check if group is just whitespace
    const isOnlyWhitespace = currentGroup.every(n => n.nodeType === Node.TEXT_NODE && !n.textContent.trim());
    
    if (!isOnlyWhitespace) {
      const p = container.ownerDocument.createElement('p');
      p.className = getClassFor('p', classMap);
      const first = currentGroup[0];
      container.insertBefore(p, first);
      currentGroup.forEach(node => p.appendChild(node));
    } else {
      // Just remove the whitespace nodes or leave them? 
      // Usually cleaner to remove if they are between blocks
      currentGroup.forEach(node => node.remove());
    }
    currentGroup = [];
  };

  for (const node of nodes) {
    const isBlock = node.nodeType === Node.ELEMENT_NODE && BLOCK_TAGS.has(node.tagName.toLowerCase());
    
    if (isBlock) {
      flushGroup();
    } else {
      currentGroup.push(node);
    }
  }
  flushGroup();
}

function processNodes(container, classMap) {
  // Use a snapshot
  const elements = Array.from(container.querySelectorAll('*'));
  
  for (const el of elements) {
    if (!el.parentNode) continue;

    const tag = el.tagName.toLowerCase();

    // 1. Remove dangerous/blocked tags entirely
    if (BLOCKED_TAGS.has(tag)) {
      el.remove();
      continue;
    }

    // 2. Replace aliased tags (b→strong, etc.)
    if (TAG_ALIASES[tag]) {
      const targetTag = TAG_ALIASES[tag];
      const newEl = el.ownerDocument.createElement(targetTag);
      while (el.firstChild) {
        newEl.appendChild(el.firstChild);
      }
      el.parentNode.replaceChild(newEl, el);
      applyClasses(newEl, classMap);
      sanitizeAttributes(newEl, targetTag);
      continue;
    }

    // 3. Remove non-aliased disallowed tags (div, span, etc.) but keep children
    if (!ALLOWED_TAGS.has(tag)) {
      const parent = el.parentNode;
      while (el.firstChild) {
        parent.insertBefore(el.firstChild, el);
      }
      el.remove();
      continue;
    }

    // 4. For allowed tags, ensure classes and strip attributes
    applyClasses(el, classMap);
    sanitizeAttributes(el, tag);
  }
}

function applyClasses(el, classMap) {
  const tag = el.tagName.toLowerCase();
  const classes = getClassFor(tag, classMap);
  if (classes) {
    el.className = classes;
  }
}

function sanitizeAttributes(el, tag) {
  const allowed = ALLOWED_ATTRS[tag] || [];
  const attrs = Array.from(el.attributes);
  
  for (const attr of attrs) {
    const name = attr.name.toLowerCase();
    
    // Always keep class (applied by applyClasses)
    if (name === 'class') continue;

    // Block ANY event handlers (on*)
    if (name.startsWith('on')) {
      el.removeAttribute(name);
      continue;
    }

    // Block non-whitelisted attributes
    if (!allowed.includes(name)) {
      el.removeAttribute(name);
      continue;
    }

    // Validate URL schemes for href/src
    if (name === 'href' || name === 'src') {
      const value = attr.value.trim();
      if (BLOCKED_PROTOCOLS.test(value)) {
        el.removeAttribute(name);
      }
    }
  }
}

/**
 * Sanitize pasted HTML: now a safe alias to normalizeHTML.
 * DOMParser automatically handles entities and nested tag bypasses.
 */
export function sanitizeHTML(html, classMap = CLASS_MAP) {
  return normalizeHTML(html, classMap);
}
