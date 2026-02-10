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
  'unorderedList', 'orderedList', 'blockquote',
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
  unorderedList:  { label: 'Bullet List',    icon: 'unorderedList', command: 'unorderedList',  type: 'block',  tag: 'ul' },
  orderedList:    { label: 'Numbered List',  icon: 'orderedList',   command: 'orderedList',    type: 'block',  tag: 'ol' },
  blockquote:     { label: 'Quote',          icon: 'blockquote',    command: 'blockquote',     type: 'block',  tag: 'blockquote' },
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
  #promptOverlay = null;

  constructor(editor, toolbarItems = DEFAULT_TOOLBAR) {
    this.#editor = editor;
    this.#container = document.createElement('div');
    this.#container.className = 'flex flex-wrap items-center gap-0.5 p-1.5 border-b border-gray-200 bg-gray-50 rounded-t-lg outline-none';
    this.#container.setAttribute('role', 'toolbar');
    this.#container.setAttribute('aria-label', 'Rich Text Toolbar');

    this.#buildButtons(toolbarItems);
    this.#setupKeyboardNav();
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
    btn.className = 'p-1.5 rounded hover:bg-gray-200 transition-colors text-gray-600 hover:text-gray-900 flex items-center justify-center';
    btn.innerHTML = ICONS[def.icon] || def.label;
    btn.title = def.shortcut ? `${def.label} (${def.shortcut})` : def.label;
    btn.setAttribute('aria-label', def.label);
    btn.setAttribute('data-command', name);
    btn.tabIndex = -1; // Managed via arrow keys

    if (def.type === 'inline' || def.type === 'block') {
      btn.setAttribute('aria-pressed', 'false');
    }

    btn.addEventListener('mousedown', (e) => {
      e.preventDefault(); // Don't steal focus from editor
    });

    btn.addEventListener('click', (e) => {
      e.preventDefault();
      if (def.type === 'prompt') {
        this.#showPrompt(def.label, (val) => {
          if (val) this.#editor.exec(def.command, val);
        });
      } else {
        this.#editor.exec(def.command);
      }
    });

    this.#buttons[name] = { el: btn, def };

    // Set first button in tab sequence if this is the first item
    if (Object.keys(this.#buttons).length === 1) {
      btn.tabIndex = 0;
    }

    this.#container.appendChild(btn);
  }

  #showPrompt(label, callback) {
    if (this.#promptOverlay) this.#promptOverlay.remove();

    this.#promptOverlay = document.createElement('div');
    this.#promptOverlay.className = 'absolute top-full left-0 right-0 mt-1 bg-white border border-gray-200 shadow-lg p-2 flex gap-2 z-[200] items-center rounded-lg animate-in fade-in slide-in-from-top-1 duration-200';
    
    const input = document.createElement('input');
    input.type = 'text';
    input.placeholder = `Enter ${label.toLowerCase()} URL...`;
    input.className = 'flex-1 px-3 py-1.5 text-sm border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none';
    
    const applyBtn = document.createElement('button');
    applyBtn.type = 'button';
    applyBtn.className = 'px-3 py-1.5 bg-blue-600 text-white text-sm font-medium rounded hover:bg-blue-700 transition-colors';
    applyBtn.textContent = 'Apply';
    
    const cancelBtn = document.createElement('button');
    cancelBtn.type = 'button';
    cancelBtn.className = 'px-3 py-1.5 bg-gray-100 text-gray-600 text-sm font-medium rounded hover:bg-gray-200 transition-colors';
    cancelBtn.textContent = 'Cancel';

    const close = () => {
      this.#promptOverlay.remove();
      this.#promptOverlay = null;
    };

    applyBtn.onclick = () => {
      callback(input.value.trim());
      close();
    };

    cancelBtn.onclick = close;
    
    input.onkeydown = (e) => {
      if (e.key === 'Enter') applyBtn.click();
      if (e.key === 'Escape') close();
    };

    this.#promptOverlay.appendChild(input);
    this.#promptOverlay.appendChild(applyBtn);
    this.#promptOverlay.appendChild(cancelBtn);
    
    // We need a relative parent to position the overlay
    if (this.#container.style.position !== 'relative') {
      this.#container.style.position = 'relative';
    }
    this.#container.appendChild(this.#promptOverlay);
    
    setTimeout(() => input.focus(), 10);
  }

  #createDropdown(name, def) {
    const wrapper = document.createElement('div');
    wrapper.className = 'relative';

    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'flex items-center gap-0.5 p-1.5 rounded hover:bg-gray-200 transition-colors text-gray-600 hover:text-gray-900';
    btn.innerHTML = `${ICONS[def.icon]}${ICONS.chevronDown}`;
    btn.title = def.label;
    btn.setAttribute('aria-label', `${def.label} options`);
    btn.setAttribute('aria-haspopup', 'true');
    btn.setAttribute('aria-expanded', 'false');
    btn.tabIndex = -1;

    const dropdown = document.createElement('div');
    dropdown.className = 'absolute left-0 top-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg py-1 min-w-[140px] z-[100] hidden';

    const headingButtons = [];
    for (const opt of HEADING_OPTIONS) {
      const item = document.createElement('button');
      item.type = 'button';
      item.className = 'w-full text-left px-3 py-1.5 text-sm hover:bg-gray-100 transition-colors flex items-center whitespace-nowrap';
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
      headingButtons.push({ el: item, tag: opt.tag });
    }

    btn.addEventListener('mousedown', (e) => e.preventDefault());
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      const isHidden = dropdown.classList.toggle('hidden');
      btn.setAttribute('aria-expanded', (!isHidden).toString());
    });

    // Close dropdown on outside click
    const closeOnOutside = (e) => {
      if (!wrapper.contains(e.target)) {
        dropdown.classList.add('hidden');
      }
    };
    document.addEventListener('click', closeOnOutside);

    wrapper.appendChild(btn);
    wrapper.appendChild(dropdown);
    this.#buttons[name] = { el: btn, def, dropdownItems: headingButtons };
    
    // Set first button in tab sequence if this is the first item
    if (Object.keys(this.#buttons).length === 1) {
      btn.tabIndex = 0;
    }

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
    if (!node || !editorRoot.contains(node)) return;

    const block = getClosestBlock(node, editorRoot);
    const blockTag = block ? block.tagName.toLowerCase() : 'p';

    for (const { el, def, dropdownItems } of Object.values(this.#buttons)) {
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

      // Handle dropdown item highlighting
      if (dropdownItems) {
        for (const item of dropdownItems) {
          const isActive = blockTag === item.tag;
          item.el.classList.toggle('bg-gray-100', isActive);
          item.el.classList.toggle('text-blue-600', isActive);
          item.el.setAttribute('aria-current', isActive ? 'true' : 'false');
        }
      }
      
      if (def.type === 'inline' || def.type === 'block') {
        const isActive = el.classList.contains('text-blue-600');
        el.setAttribute('aria-pressed', isActive.toString());
      }
    }
  }

  #onKeydown = (e) => {
    const items = Array.from(this.#container.querySelectorAll('button:not([data-tag])'));
    const index = items.indexOf(document.activeElement);
    if (index === -1) return;

    let nextIndex;
    if (e.key === 'ArrowRight') nextIndex = (index + 1) % items.length;
    else if (e.key === 'ArrowLeft') nextIndex = (index - 1 + items.length) % items.length;
    else if (e.key === 'Home') nextIndex = 0;
    else if (e.key === 'End') nextIndex = items.length - 1;
    else return;

    e.preventDefault();
    items[index].tabIndex = -1;
    items[nextIndex].tabIndex = 0;
    items[nextIndex].focus();
  };

  #setupKeyboardNav() {
    this.#container.addEventListener('keydown', this.#onKeydown);
  }

  destroy() {
    this.#container.removeEventListener('keydown', this.#onKeydown);
    if (this.#container.parentNode) {
      this.#container.parentNode.removeChild(this.#container);
    }
    this.#buttons = {};
    if (this.#dropdown && this.#dropdown.parentNode) {
       this.#dropdown.parentNode.removeChild(this.#dropdown);
    }
  }
}
