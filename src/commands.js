import { CLASS_MAP, getClassFor } from './class-map.js';
import { getClosestBlock, findParentTag } from './selection.js';

/**
 * Create a command registry bound to an editor root element.
 */
/**
 * Create a command registry bound to an editor root element.
 */
export function createCommandRegistry(root, classMap = CLASS_MAP) {
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
      el.className = getClassFor(tagName, classMap);
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
      el.className = getClassFor(tagName, classMap);
      try {
        const fragment = range.extractContents();
        el.appendChild(fragment);
        range.insertNode(el);
      } catch (e) {
        console.error('RTEditor: wrap failed', e);
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
    newBlock.className = getClassFor(targetTag, classMap);

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
        p.className = getClassFor('p', classMap);
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
      newList.className = getClassFor(listTag, classMap);
      while (oldList.firstChild) {
        newList.appendChild(oldList.firstChild);
      }
      oldList.parentNode.replaceChild(newList, oldList);
      return;
    }

    // Wrap current block in a list
    const list = document.createElement(listTag);
    list.className = getClassFor(listTag, classMap);
    const li = document.createElement('li');
    li.className = getClassFor('li', classMap);
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
      p.className = getClassFor('p', classMap);
      while (block.firstChild) p.appendChild(block.firstChild);
      block.parentNode.replaceChild(p, block);
    } else {
      const bq = document.createElement('blockquote');
      bq.className = getClassFor('blockquote', classMap);

      // If block is a P, replace it. Otherwise wrap contents.
      if (block.tagName === 'P') {
        while (block.firstChild) bq.appendChild(block.firstChild);
        block.parentNode.replaceChild(bq, block);
      } else {
        const p = document.createElement('p');
        p.className = getClassFor('p', classMap);
        while (block.firstChild) p.appendChild(block.firstChild);
        bq.appendChild(p);
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
      p.className = getClassFor('p', classMap);
      p.textContent = block.textContent;
      block.parentNode.replaceChild(p, block);
    } else {
      const pre = document.createElement('pre');
      pre.className = getClassFor('pre', classMap);
      const code = document.createElement('code');
      code.className = getClassFor('code', classMap);
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
    a.className = getClassFor('a', classMap);
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

  commands.set('image', (src, alt = '') => {
    if (!src) return;
    const sel = window.getSelection();
    if (!sel || !sel.rangeCount) return;
    const range = sel.getRangeAt(0);

    const img = document.createElement('img');
    img.src = src;
    img.alt = alt;
    img.className = getClassFor('img', classMap);

    // Insert after current block or at cursor
    const block = getClosestBlock(range.startContainer, root);
    if (block && block.parentNode && block.parentNode === root) {
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
