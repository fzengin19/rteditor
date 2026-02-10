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
  // Use a recursive approach or a queue to ensure nested disallowed tags are handled
  // querySelectorAll('*') returns a static list, so we must be careful with mutations.
  let elements = Array.from(container.querySelectorAll('*'));
  
  while (elements.length > 0) {
    const el = elements.shift();
    if (!el.parentNode) continue; // Already removed in previous iteration

    const tag = el.tagName.toLowerCase();

    // 1. Replace aliased tags (b→strong, i→em, etc.)
    if (TAG_ALIASES[tag]) {
      const newEl = el.ownerDocument.createElement(TAG_ALIASES[tag]);
      while (el.firstChild) newEl.appendChild(el.firstChild);
      el.parentNode.replaceChild(newEl, el);
      applyClasses(newEl);
      // Re-scan nested items
      elements = Array.from(container.querySelectorAll('*'));
      continue;
    }

    // 2. Remove disallowed tags (div, span, etc.) but keep their children
    if (!ALLOWED_TAGS.has(tag)) {
      const parent = el.parentNode;
      while (el.firstChild) {
        parent.insertBefore(el.firstChild, el);
      }
      parent.removeChild(el);
      // Re-scan because structure changed
      elements = Array.from(container.querySelectorAll('*'));
      continue;
    }

    // 3. For allowed tags, ensure correct classes and strip attributes
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
