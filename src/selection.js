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
