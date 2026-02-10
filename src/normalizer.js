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
  'blockquote', 'pre',
  'strong', 'em', 'u', 's', 'code',
  'a', 'img', 'br',
]);

// Attributes to keep per tag
const ALLOWED_ATTRS = {
  a:   ['href', 'target', 'rel', 'title'],
  img: ['src', 'alt', 'title', 'style'], // style is needed for resizing
};

// Dangerous URL schemes
// We allow data: for images (common for pasted content) but block it for links (XSS risk).
const BLOCKED_PROTOCOLS = /^(javascript|vbscript|file):/i;
const BLOCKED_LINK_PROTOCOLS = /^(javascript|data|vbscript|file):/i;

// Tags that count as blocks (don't need wrapping at root)
const BLOCK_TAGS = new Set(['p', 'h1', 'h2', 'h3', 'h4', 'ul', 'ol', 'blockquote']);

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
  
  const doc = new DOMParser().parseFromString(html, 'text/html');
  const container = doc.body;

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

  // 5. Cleanup: Remove Zero-Width Spaces (\u200B) from all text nodes (ANALYSIS 1.4)
  const stripZWS = (node) => {
    if (node.nodeType === Node.TEXT_NODE) {
      node.textContent = node.textContent.replace(/\u200B/g, '');
    } else {
      Array.from(node.childNodes).forEach(child => stripZWS(child));
    }
  };
  stripZWS(container);
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
      const blocker = (name === 'href') ? BLOCKED_LINK_PROTOCOLS : BLOCKED_PROTOCOLS;
      if (blocker.test(value)) {
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
