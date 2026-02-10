import { EditorEngine } from './engine.js';
import { Toolbar, DEFAULT_TOOLBAR } from './toolbar.js';
import { CLASS_MAP } from './class-map.js';
import { normalizeHTML } from './normalizer.js';
import { ImageResizer } from './resizer.js';

/**
 * RTEditor: A rich text editor that outputs Tailwind CSS v4 classes.
 */
export class RichTextEditor {
  #wrapper;
  #engine;
  #toolbar;
  #options;
  #classMap;
  #currentResizer = null;

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

    // Create a per-instance class map (clone the global one)
    this.#classMap = { ...CLASS_MAP };
    if (this.#options.classMap) {
      Object.assign(this.#classMap, this.#options.classMap);
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
    this.#wrapper.className = 'border border-gray-300 rounded-lg overflow-hidden bg-white shadow-sm';

    // Create content area
    const contentEl = document.createElement('div');
    // outline-none is important for contenteditable, we use custom ring on wrapper if needed
    contentEl.className = 'p-4 min-h-[200px] max-h-[70vh] overflow-y-auto outline-none focus:ring-2 focus:ring-blue-500/10 rounded-b-lg';

    // Create engine (manages contenteditable)
    this.#engine = new EditorEngine(contentEl, {
      onChange: (html) => this.#options.onChange(html),
      classMap: this.#classMap,
    });

    // Create toolbar integration
    // The toolbar needs an object with an exec method
    const toolbarProxy = {
      exec: (cmd, ...args) => this.#engine.exec(cmd, ...args),
      contentEl: contentEl
    };

    this.#toolbar = new Toolbar(toolbarProxy, this.#options.toolbar);

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

    // Placeholder Logic
    this.#setupPlaceholder();

    // Toolbar state tracking: update toolbar highlights on selection change
    // Using a bound listener to allow cleanup
    this._selectionHandler = () => {
      this.#toolbar.updateState(this.#engine.contentEl);
    };
    document.addEventListener('selectionchange', this._selectionHandler);

    this.#setupResizer();
  }

  #setupResizer() {
    this.#currentResizer = null;

    this.#engine.contentEl.addEventListener('click', this.#onClick);

    // Cleanup resizer when user clicks outside
    this._resizerCleanup = (e) => {
      if (this.#currentResizer && !this.#engine.contentEl.contains(e.target)) {
        this.#currentResizer.destroy();
        this.#currentResizer = null;
      }
    };
    document.addEventListener('mousedown', this._resizerCleanup);

    // Handle commands that might replace content or state restores
    this.#engine.on('change', () => {
      if (this.#currentResizer) {
        this.#currentResizer.destroy();
        this.#currentResizer = null;
      }
    });
  }

  #onClick = (e) => {
    if (this.#currentResizer) {
      this.#currentResizer.destroy();
      this.#currentResizer = null;
    }

    if (e.target.tagName === 'IMG') {
      this.#currentResizer = new ImageResizer(e.target);
    }
  };

  #setupPlaceholder() {
    const contentEl = this.#engine.contentEl;
    const placeholder = this.#options.placeholder;

    const updatePlaceholder = () => {
      const isEmpty = !contentEl.textContent.trim() && !contentEl.querySelector('img');
      contentEl.setAttribute('data-placeholder', isEmpty ? placeholder : '');
    };

    // Inject placeholder CSS once if not present
    if (!document.getElementById('rt-editor-placeholder-styles')) {
      const style = document.createElement('style');
      style.id = 'rt-editor-placeholder-styles';
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
    }

    contentEl.addEventListener('input', updatePlaceholder);
    contentEl.addEventListener('focus', updatePlaceholder);
    contentEl.addEventListener('blur', updatePlaceholder);
    updatePlaceholder();
  }

  /** Get the current HTML content (normalized to Tailwind classes). */
  getHTML() {
    return normalizeHTML(this.#engine.getHTML(), this.#classMap);
  }

  /** Get raw (un-normalized) HTML from the editor. */
  getRawHTML() {
    return this.#engine.getHTML();
  }

  /** Set HTML content (normalized and sanitized). */
  setHTML(html) {
    const cleanHTML = normalizeHTML(html || '', this.#classMap);
    this.#engine.setHTML(cleanHTML);
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

  /** Destroy the editor and clean up listeners/DOM. */
  destroy() {
    document.removeEventListener('mousedown', this._resizerCleanup);
    this.#engine.contentEl.removeEventListener('click', this.#onClick);
    
    if (this.#currentResizer) {
      this.#currentResizer.destroy();
    }

    this.#engine.destroy();
    this.#toolbar.destroy();
    this.#wrapper.remove();
  }
}
