import { getClassFor } from './class-map.js';
import { createCommandRegistry } from './commands.js';
import { History } from './history.js';
import { getClosestBlock } from './selection.js';

export class EditorEngine {
  #root;
  #commands;
  #history;
  #onChange;
  #classMap;
  #debounceTimer = null;
  #listeners = {};

  constructor(contentEl, { onChange = () => {}, classMap = CLASS_MAP } = {}) {
    this.#root = contentEl;
    this.#onChange = onChange;
    this.#classMap = classMap;
    this.#commands = createCommandRegistry(this.#root, this.#classMap);
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

  /** Register an event listener. */
  on(event, callback) {
    if (!this.#listeners[event]) this.#listeners[event] = [];
    this.#listeners[event].push(callback);
  }

  #emit(event, ...args) {
    if (this.#listeners[event]) {
      this.#listeners[event].forEach(cb => cb(...args));
    }
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
    this.#emitChange();
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
      p.className = getClassFor('p', this.#classMap);
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
      p.className = getClassFor('p', this.#classMap);
      p.appendChild(document.createElement('br'));
      this.#root.appendChild(p);
      this.#setCursorToStart(p);
      return;
    }

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
      newClass = getClassFor('li', this.#classMap);
    } else {
      newTag = 'p';
      newClass = getClassFor('p', this.#classMap);
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
    block.parentNode.insertBefore(newBlock, block.nextSibling);

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
      // Import is static at top level or dynamic here as per plan
      import('./normalizer.js').then(({ sanitizeHTML }) => {
        const clean = sanitizeHTML(html, this.#classMap);
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
        p.className = getClassFor('p', this.#classMap);
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
        p.className = getClassFor('p', this.#classMap);
        p.textContent = child.textContent;
        this.#root.replaceChild(p, child);
      } else if (child.nodeType === Node.ELEMENT_NODE && (child.tagName === 'DIV' || child.tagName === 'BR' && child.parentNode === this.#root)) {
        if (child.tagName === 'BR') {
          // BR at root should be wrapped
           const p = document.createElement('p');
           p.className = getClassFor('p', this.#classMap);
           p.appendChild(child.cloneNode());
           this.#root.replaceChild(p, child);
           continue;
        }
        // Replace <div> with <p>
        const p = document.createElement('p');
        p.className = getClassFor('p', this.#classMap);
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
    const html = this.getHTML();
    this.#onChange(html);
    this.#emit('change', html);
  }

  destroy() {
    clearTimeout(this.#debounceTimer);
    this.#root.removeAttribute('contenteditable');
    this.#root.removeAttribute('role');
    this.#root.removeAttribute('aria-multiline');
  }
}
