import { CLASS_MAP, getClassFor } from './class-map.js';
import { getClosestBlock, findParentTag, saveSelection, restoreSelection, BLOCK_TAGS } from './selection.js';

/**
 * Create a command registry bound to an editor root element.
 */
/**
 * Create a command registry bound to an editor root element.
 */
export function createCommandRegistry(root, classMap = CLASS_MAP) {
  const commands = new Map();

  function isSafeImageSrc(src) {
    if (typeof src !== 'string') return false;
    const value = src.trim();
    if (!value) return false;

    const lower = value.toLowerCase();
    if (lower.startsWith('javascript:') || lower.startsWith('vbscript:') || lower.startsWith('file:')) {
      return false;
    }

    if (lower.startsWith('data:')) {
      return /^data:image\//i.test(value);
    }

    try {
      const parsed = new URL(value, window.location.href);
      const protocol = parsed.protocol.toLowerCase();
      return protocol === 'http:' || protocol === 'https:' || protocol === 'blob:';
    } catch {
      return !/^[a-zA-Z][a-zA-Z\d+.-]*:/.test(value);
    }
  }

  function isSafeLinkUrl(url) {
    if (typeof url !== 'string') return false;
    const value = url.trim();
    if (!value) return false;

    const lower = value.toLowerCase();
    if (lower.startsWith('javascript:') || lower.startsWith('vbscript:') || lower.startsWith('file:') || lower.startsWith('data:')) {
      return false;
    }

    try {
      const parsed = new URL(value, window.location.href);
      const protocol = parsed.protocol.toLowerCase();
      return protocol === 'http:' || protocol === 'https:' || protocol === 'blob:' || protocol === 'mailto:' || protocol === 'tel:';
    } catch {
      return !/^[a-zA-Z][a-zA-Z\d+.-]*:/.test(value);
    }
  }

  function isRangeFullyFormatted(range, tagName) {
    if (range.collapsed) {
      return !!findParentTag(range.startContainer, tagName, root);
    }

    const common = range.commonAncestorContainer;
    if (common.nodeType === Node.TEXT_NODE) {
      return !!findParentTag(common, tagName, root);
    }

    const walker = document.createTreeWalker(
      common,
      NodeFilter.SHOW_TEXT,
      { acceptNode: node => (range.intersectsNode(node) ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT) }
    );

    let hasText = false;
    let node = walker.nextNode();
    while (node) {
      hasText = true;
      if (!findParentTag(node, tagName, root)) return false;
      node = walker.nextNode();
    }

    return hasText;
  }

  function getSelectedLeafBlocks(root, range) {
    const allBlocks = Array.from(root.querySelectorAll(BLOCK_TAGS.join(',')));
    const selectedBlocks = allBlocks.filter(block => range.intersectsNode(block));
    return selectedBlocks.filter(block => {
      return !selectedBlocks.some(other => block !== other && block.contains(other));
    });
  }

  // --- INLINE COMMANDS ---

  function toggleInline(tagName) {
    const sel = window.getSelection();
    if (!sel || !sel.rangeCount) return;
    const range = sel.getRangeAt(0);
    if (!root.contains(range.commonAncestorContainer)) return;

    const existing = findParentTag(range.startContainer, tagName, root);
    const fullyFormatted = isRangeFullyFormatted(range, tagName);

    if (existing && fullyFormatted) {
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

    const range = sel.getRangeAt(0);
    const saved = saveSelection(root);

    const leafBlocks = getSelectedLeafBlocks(root, range);

    if (leafBlocks.length === 0) return;

    // Toggle logic: if the first leaf block matches the target, we toggle all to 'p'
    const targetTag = leafBlocks[0].tagName.toLowerCase() === tagName ? 'p' : tagName;

    leafBlocks.forEach(block => {
      const newBlock = document.createElement(targetTag);
      newBlock.className = getClassFor(targetTag, classMap);

      while (block.firstChild) {
        newBlock.appendChild(block.firstChild);
      }
      block.parentNode.replaceChild(newBlock, block);
    });

    if (saved) {
      restoreSelection(root, saved);
    }
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

    const range = sel.getRangeAt(0);
    const saved = saveSelection(root);

    const leafBlocks = getSelectedLeafBlocks(root, range);

    if (leafBlocks.length === 0) return;

    // Toggle logic: if the first leaf block matches the target list type, we unwrap ALL selected items
    const firstBlock = leafBlocks[0];
    const isInTargetList = firstBlock.tagName === 'LI' && firstBlock.parentElement?.tagName === listTag.toUpperCase();
    const isInOtherList = firstBlock.tagName === 'LI' && firstBlock.parentElement?.tagName !== listTag.toUpperCase();

    if (isInTargetList) {
      // UNWRAP: Convert each selected LI to a P
      // BUG-002: Capture the insertion point before the loop to avoid order reversal
      const list = firstBlock.parentElement;
      const insertRef = list ? list.nextSibling : null;

      leafBlocks.forEach(li => {
        if (li.tagName !== 'LI') return;
        const p = document.createElement('p');
        p.className = getClassFor('p', classMap);
        while (li.firstChild) p.appendChild(li.firstChild);
        
        const currentList = li.parentElement;
        if (currentList) {
          currentList.parentNode.insertBefore(p, insertRef);
          li.remove();
          if (currentList.children.length === 0) currentList.remove();
        }
      });
    } else if (isInOtherList) {
      // SWITCH: Change parent list type for all selected items
      const listsToSwitch = new Set(leafBlocks.map(li => li.parentElement).filter(el => el && el.tagName.match(/^(UL|OL)$/)));
      listsToSwitch.forEach(oldList => {
        const newList = document.createElement(listTag);
        newList.className = getClassFor(listTag, classMap);
        while (oldList.firstChild) newList.appendChild(oldList.firstChild);
        oldList.parentNode.replaceChild(newList, oldList);
      });
    } else {
      // WRAP: Group contiguous blocks into a single list
      let currentList = null;
      leafBlocks.forEach(block => {
        // If the block's previous element sibling is not our current list, start a new one
        if (!currentList || block.previousElementSibling !== currentList) {
          currentList = document.createElement(listTag);
          currentList.className = getClassFor(listTag, classMap);
          block.parentNode.insertBefore(currentList, block);
        }
        const li = document.createElement('li');
        li.className = getClassFor('li', classMap);
        while (block.firstChild) li.appendChild(block.firstChild);
        currentList.appendChild(li);
        block.remove();
      });
    }

    if (saved) {
      restoreSelection(root, saved);
    }
  }

  commands.set('unorderedList', () => toggleList('ul'));
  commands.set('orderedList',   () => toggleList('ol'));

  // --- BLOCKQUOTE ---

  commands.set('blockquote', () => {
    const sel = window.getSelection();
    if (!sel || !sel.rangeCount) return;

    const range = sel.getRangeAt(0);
    const saved = saveSelection(root);

    const leafBlocks = getSelectedLeafBlocks(root, range);

    if (leafBlocks.length === 0) return;

    // Toggle logic: if the first leaf block matches the target list type, we unwrap ALL selected items
    const firstBlock = leafBlocks[0];
    const isInBlockquote = findParentTag(firstBlock, 'blockquote', root);

    if (isInBlockquote) {
      // UNWRAP: Convert each selected block inside a blockquote back to P
      // BUG-003: Capture the insertion point before the loop to avoid order reversal
      const bq = findParentTag(firstBlock, 'blockquote', root);
      const insertRef = bq ? bq.nextSibling : null;

      leafBlocks.forEach(block => {
        const currentBq = findParentTag(block, 'blockquote', root);
        if (!currentBq) return;

        // Convert block to P if it's not already
        const p = document.createElement('p');
        p.className = getClassFor('p', classMap);
        while (block.firstChild) p.appendChild(block.firstChild);
        
        currentBq.parentNode.insertBefore(p, insertRef);
        block.remove();
        if (currentBq.children.length === 0) currentBq.remove();
      });
    } else {
      // WRAP: Move all selected blocks into a single blockquote
      const bq = document.createElement('blockquote');
      bq.className = getClassFor('blockquote', classMap);
      
      // Use the first block's parent as the insertion point
      const firstParent = leafBlocks[0].parentNode;
      const firstSibling = leafBlocks[0];
      firstParent.insertBefore(bq, firstSibling);

      leafBlocks.forEach(block => {
        // If it's a P, we can just move it in. 
        // If it's something else, we might want to wrap its contents in a P inside the BQ.
        if (block.tagName === 'P') {
          bq.appendChild(block);
        } else {
          const p = document.createElement('p');
          p.className = getClassFor('p', classMap);
          while (block.firstChild) p.appendChild(block.firstChild);
          bq.appendChild(p);
          block.remove();
        }
      });
    }

    if (saved) {
      restoreSelection(root, saved);
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
        if (!isSafeLinkUrl(url)) return;
        existingLink.href = url;
      } else {
        // Remove link, keep text
        const parent = existingLink.parentNode;
        while (existingLink.firstChild) parent.insertBefore(existingLink.firstChild, existingLink);
        parent.removeChild(existingLink);
      }
      return;
    }

    if (!url || !isSafeLinkUrl(url)) return;

    const a = document.createElement('a');
    a.href = url;
    a.className = getClassFor('a', classMap);
    a.target = '_blank';
    a.rel = 'noopener noreferrer';

    if (range.collapsed) {
      // For collapsed selections, if text is provided use it, otherwise use URL
      const linkText = text || url;
      const textNode = document.createTextNode(linkText);
      a.appendChild(textNode);
      range.insertNode(a);
      
      // Move cursor after the inserted link
      const newRange = document.createRange();
      newRange.setStartAfter(a);
      newRange.collapse(true);
      sel.removeAllRanges();
      sel.addRange(newRange);
    } else {
      // Wrap existing content
      try {
        const fragment = range.extractContents();
        a.appendChild(fragment);
        range.insertNode(a);
        
        // Select the new link
        const newRange = document.createRange();
        newRange.selectNodeContents(a);
        sel.removeAllRanges();
        sel.addRange(newRange);
      } catch (e) {
        console.error('RTEditor: link wrap failed', e);
      }
    }
  });

  // --- IMAGE ---

  commands.set('image', (src, alt = '') => {
    if (!isSafeImageSrc(src)) return;
    const sel = window.getSelection();
    if (!sel || !sel.rangeCount) return;
    const range = sel.getRangeAt(0);

    const img = document.createElement('img');
    img.src = src;
    img.alt = alt;
    img.className = getClassFor('img', classMap);

    // Create a paragraph wrapper (ANALYSIS 3.3)
    const p = document.createElement('p');
    p.className = getClassFor('p', classMap);
    p.appendChild(img);

    // Insert after current block or at cursor
    const block = getClosestBlock(range.startContainer, root);
    if (block && block.parentNode && block.parentNode === root) {
      block.parentNode.insertBefore(p, block.nextSibling);
    } else {
      range.insertNode(p);
    }
  });

  // --- CLEAR FORMATTING ---

  commands.set('clearFormatting', () => {
    const sel = window.getSelection();
    if (!sel || !sel.rangeCount) return;
    const range = sel.getRangeAt(0);
    if (range.collapsed) return;

    const saved = saveSelection(root);

    const leafBlocks = getSelectedLeafBlocks(root, range);
    if (leafBlocks.length === 0) return;

    leafBlocks.forEach(block => {
      // 1. Reset block to paragraph
      const p = document.createElement('p');
      p.className = getClassFor('p', classMap);
      
      // 2. Clear inline formatting while moving contents
      // Tags to preserve during clearFormatting (not inline style tags)
      const PRESERVE_TAGS = new Set(['BR', 'A', 'IMG', 'CODE']);
      const clearInline = (node, target) => {
        Array.from(node.childNodes).forEach(child => {
          if (child.nodeType === Node.TEXT_NODE) {
            target.appendChild(child.cloneNode());
          } else if (child.nodeType === Node.ELEMENT_NODE) {
            if (PRESERVE_TAGS.has(child.tagName)) {
              // Preserve the element as-is (links, images, code, br)
              target.appendChild(child.cloneNode(true));
            } else {
              // Recurse into inline style elements (strong, em, u, s, etc.)
              clearInline(child, target);
            }
          }
        });
      };

      clearInline(block, p);
      block.parentNode.replaceChild(p, block);
    });

    root.normalize();
    if (saved) {
      restoreSelection(root, saved);
    }
  });

   // UX-002
   commands.set('indentList', () => {
     const sel = window.getSelection();
     if (!sel || !sel.rangeCount) return;
     const range = sel.getRangeAt(0);
     const li = findParentTag(range.startContainer, 'li', root);
     if (!li) return;

     const parentList = li.parentElement;
     if (!parentList || !['UL', 'OL'].includes(parentList.tagName)) return;

     const allLis = Array.from(parentList.children);
     const startIdx = allLis.indexOf(li);
     let endIdx = startIdx;
     for (let i = startIdx + 1; i < allLis.length; i++) {
       if (range.intersectsNode(allLis[i])) endIdx = i;
       else break;
     }

     const nestedList = document.createElement(parentList.tagName.toLowerCase());
     const siblingsToMove = allLis.slice(startIdx, endIdx + 1);
     siblingsToMove.forEach(sib => {
       if (!li.children.length) {
         nestedList.appendChild(sib);
       } else if (sib !== li) {
         nestedList.appendChild(sib);
       }
     });

     if (li === siblingsToMove[0]) {
       li.appendChild(nestedList);
     } else {
       siblingsToMove[0].appendChild(nestedList);
     }
   });

   commands.set('outdentList', () => {
     const sel = window.getSelection();
     if (!sel || !sel.rangeCount) return;
     const range = sel.getRangeAt(0);
     const li = findParentTag(range.startContainer, 'li', root);
     if (!li) return;

     const parentList = li.parentElement;
     if (!parentList || !['UL', 'OL'].includes(parentList.tagName)) return;

     const grandparentList = parentList.parentElement;
     if (!grandparentList || !['UL', 'OL'].includes(grandparentList.tagName)) return;

     const allLis = Array.from(parentList.children);
     const startIdx = allLis.indexOf(li);
     let endIdx = startIdx;
     for (let i = startIdx + 1; i < allLis.length; i++) {
       if (range.intersectsNode(allLis[i])) endIdx = i;
       else break;
     }

     const siblingsToMove = allLis.slice(startIdx, endIdx + 1);
     siblingsToMove.forEach(sib => {
       grandparentList.insertBefore(sib, parentList.nextSibling);
     });

     if (parentList.children.length === 0) parentList.remove();
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
