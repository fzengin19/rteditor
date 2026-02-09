class RichTextEditor {
  constructor(selector, options = {}) {
    this.selector = selector;
    this.options = {
      placeholder: 'Buraya yaz...',
      theme: 'light',
      sanitize: null,
      onChange: null,
      toolbar: [
        'bold',
        'italic',
        'underline',
        'strike',
        'h1',
        'h2',
        'h3',
        'ul',
        'ol',
        'quote',
        'code',
        'link',
        'image',
        'undo',
        'redo'
      ],
      ...options
    };

    this.container = null;
    this.wrapper = null;
    this.toolbarEl = null;
    this.editorEl = null;
    this.placeholderEl = null;
  }

  init() {
    this.container = document.querySelector(this.selector);
    if (!this.container) {
      throw new Error(`RichTextEditor: "${this.selector}" bulunamadı.`);
    }

    this.container.innerHTML = '';
    this.wrapper = document.createElement('div');
    this.wrapper.className = this._mergeClasses(
      'rte-wrapper flex flex-col gap-2',
      this.options.theme === 'dark'
        ? 'text-gray-100'
        : 'text-gray-800'
    );

    this._buildToolbar();
    this._buildEditor();

    this.container.appendChild(this.wrapper);
    this._bindEvents();
    this._updatePlaceholder();
  }

  getHTML() {
    const html = this.editorEl ? this.editorEl.innerHTML : '';
    if (typeof this.options.sanitize === 'function') {
      return this.options.sanitize(html);
    }
    return html;
  }

  getMarkdown() {
    if (!this.editorEl) return '';
    const html = this.editorEl.innerHTML;
    return this._toMarkdown(html);
  }

  setHTML(html) {
    if (!this.editorEl) return;
    this.editorEl.innerHTML = html;
    this._updatePlaceholder();
  }

  _buildToolbar() {
    this.toolbarEl = document.createElement('div');
    this.toolbarEl.className = this._mergeClasses(
      'rte-toolbar flex flex-wrap gap-2 rounded-lg border border-gray-200 bg-white p-2 shadow-sm',
      this.options.theme === 'dark'
        ? 'border-gray-700 bg-gray-900 text-gray-100'
        : 'border-gray-200 bg-white text-gray-800'
    );

    const buttons = this._getToolbarButtons();
    buttons.forEach((button) => {
      this.toolbarEl.appendChild(button);
    });

    this.wrapper.appendChild(this.toolbarEl);
  }

  _buildEditor() {
    const editorWrapper = document.createElement('div');
    editorWrapper.className = 'relative';

    this.editorEl = document.createElement('div');
    this.editorEl.className = this._mergeClasses(
      'rte-editor min-h-[220px] w-full rounded-lg border border-gray-200 bg-white p-4 text-sm leading-relaxed shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 md:text-base',
      'overflow-y-auto whitespace-pre-wrap',
      this.options.theme === 'dark'
        ? 'border-gray-700 bg-gray-900 text-gray-100 focus:ring-blue-400'
        : 'border-gray-200 bg-white text-gray-800'
    );
    this.editorEl.setAttribute('contenteditable', 'true');
    this.editorEl.setAttribute('role', 'textbox');
    this.editorEl.setAttribute('aria-multiline', 'true');

    this.placeholderEl = document.createElement('span');
    this.placeholderEl.className = this._mergeClasses(
      'rte-placeholder pointer-events-none absolute left-4 top-4 select-none text-sm text-gray-400 md:text-base',
      this.options.theme === 'dark' ? 'text-gray-500' : 'text-gray-400'
    );
    this.placeholderEl.textContent = this.options.placeholder;

    editorWrapper.appendChild(this.editorEl);
    editorWrapper.appendChild(this.placeholderEl);

    this.wrapper.appendChild(editorWrapper);
  }

  _bindEvents() {
    this.toolbarEl.addEventListener('click', (event) => {
      const button = event.target.closest('button[data-command]');
      if (!button) return;

      const command = button.dataset.command;
      const value = button.dataset.value || null;

      if (command === 'link') {
        this._insertLink();
      } else if (command === 'image') {
        this._insertImage();
      } else if (command === 'undo') {
        document.execCommand('undo');
      } else if (command === 'redo') {
        document.execCommand('redo');
      } else {
        this._applyCommand(command, value);
      }

      this._updateActiveStates();
      this.editorEl.focus();
    });

    this.editorEl.addEventListener('input', () => {
      this._updatePlaceholder();
      if (typeof this.options.onChange === 'function') {
        this.options.onChange(this.getHTML());
      }
    });

    this.editorEl.addEventListener('focus', () => this._updateActiveStates());
    document.addEventListener('selectionchange', () => {
      if (document.activeElement === this.editorEl) {
        this._updateActiveStates();
      }
    });

    this.editorEl.addEventListener('drop', (event) => {
      event.preventDefault();
      const files = Array.from(event.dataTransfer.files || []);
      const imageFile = files.find((file) => file.type.startsWith('image/'));
      if (imageFile) {
        const reader = new FileReader();
        reader.onload = () => {
          this._applyCommand('insertImage', reader.result);
        };
        reader.readAsDataURL(imageFile);
      } else {
        const text = event.dataTransfer.getData('text/plain');
        if (text && this._isValidUrl(text)) {
          this._applyCommand('insertImage', text);
        }
      }
    });

    this.editorEl.addEventListener('dragover', (event) => {
      event.preventDefault();
    });
  }

  _applyCommand(command, value = null) {
    if (command === 'h1' || command === 'h2' || command === 'h3') {
      const block = command.toUpperCase();
      document.execCommand('formatBlock', false, block);
      return;
    }

    if (command === 'quote') {
      document.execCommand('formatBlock', false, 'blockquote');
      return;
    }

    if (command === 'code') {
      document.execCommand('formatBlock', false, 'pre');
      return;
    }

    const execCommandMap = {
      bold: 'bold',
      italic: 'italic',
      underline: 'underline',
      strike: 'strikeThrough',
      ul: 'insertUnorderedList',
      ol: 'insertOrderedList'
    };

    const execCommand = execCommandMap[command] || command;
    document.execCommand(execCommand, false, value);
  }

  _insertLink() {
    const url = window.prompt('Link URL girin:');
    if (!url) return;
    document.execCommand('createLink', false, url);
  }

  _insertImage() {
    const url = window.prompt('Resim URL girin:');
    if (!url) return;
    document.execCommand('insertImage', false, url);
  }

  _updatePlaceholder() {
    const isEmpty = !this.editorEl.textContent.trim() && !this.editorEl.querySelector('img');
    this.placeholderEl.classList.toggle('hidden', !isEmpty);
  }

  _updateActiveStates() {
    const buttons = this.toolbarEl.querySelectorAll('button[data-command]');
    buttons.forEach((button) => {
      const command = button.dataset.command;
      if (['bold', 'italic', 'underline', 'strike'].includes(command)) {
        const stateCommand = command === 'strike' ? 'strikeThrough' : command;
        const isActive = document.queryCommandState(stateCommand);
        button.classList.toggle('bg-blue-100', isActive);
        button.classList.toggle('text-blue-700', isActive);
      }
      if (['ul', 'ol'].includes(command)) {
        const listCommand = command === 'ul' ? 'insertUnorderedList' : 'insertOrderedList';
        const isActive = document.queryCommandState(listCommand);
        button.classList.toggle('bg-blue-100', isActive);
        button.classList.toggle('text-blue-700', isActive);
      }
    });
  }

  _getToolbarButtons() {
    const buttonConfigs = {
      bold: { label: 'B', title: 'Kalın' },
      italic: { label: 'I', title: 'İtalik' },
      underline: { label: 'U', title: 'Altı çizili' },
      strike: { label: 'S', title: 'Üstü çizili' },
      h1: { label: 'H1', title: 'Başlık 1' },
      h2: { label: 'H2', title: 'Başlık 2' },
      h3: { label: 'H3', title: 'Başlık 3' },
      ul: { label: '• List', title: 'Sırasız Liste' },
      ol: { label: '1. List', title: 'Sıralı Liste' },
      quote: { label: '❝', title: 'Alıntı' },
      code: { label: '</>', title: 'Kod Bloğu' },
      link: { label: '🔗', title: 'Link Ekle' },
      image: { label: '🖼', title: 'Resim Ekle' },
      undo: { label: '↺', title: 'Geri Al' },
      redo: { label: '↻', title: 'Yinele' }
    };

    return this.options.toolbar.map((command) => {
      const config = buttonConfigs[command];
      const button = document.createElement('button');
      button.type = 'button';
      button.dataset.command = command;
      button.className = this._mergeClasses(
        'inline-flex items-center justify-center rounded-md border border-gray-200 px-2 py-1 text-sm font-medium text-gray-700 transition hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-400 active:bg-gray-200',
        this.options.theme === 'dark'
          ? 'border-gray-700 text-gray-100 hover:bg-gray-800 active:bg-gray-700'
          : 'border-gray-200 text-gray-700'
      );
      button.textContent = config ? config.label : command;
      button.title = config ? config.title : command;
      return button;
    });
  }

  _mergeClasses(...classes) {
    return classes.filter(Boolean).join(' ');
  }

  _isValidUrl(value) {
    try {
      new URL(value);
      return true;
    } catch (error) {
      return false;
    }
  }

  _toMarkdown(html) {
    let output = html;

    const replacements = [
      { regex: /<h1[^>]*>(.*?)<\/h1>/gi, replace: '# $1\n' },
      { regex: /<h2[^>]*>(.*?)<\/h2>/gi, replace: '## $1\n' },
      { regex: /<h3[^>]*>(.*?)<\/h3>/gi, replace: '### $1\n' },
      { regex: /<strong[^>]*>(.*?)<\/strong>/gi, replace: '**$1**' },
      { regex: /<b[^>]*>(.*?)<\/b>/gi, replace: '**$1**' },
      { regex: /<em[^>]*>(.*?)<\/em>/gi, replace: '_$1_' },
      { regex: /<i[^>]*>(.*?)<\/i>/gi, replace: '_$1_' },
      { regex: /<u[^>]*>(.*?)<\/u>/gi, replace: '$1' },
      { regex: /<strike[^>]*>(.*?)<\/strike>/gi, replace: '~~$1~~' },
      { regex: /<s[^>]*>(.*?)<\/s>/gi, replace: '~~$1~~' },
      { regex: /<blockquote[^>]*>(.*?)<\/blockquote>/gi, replace: '> $1\n' },
      { regex: /<pre[^>]*>([\s\S]*?)<\/pre>/gi, replace: '```\n$1\n```\n' },
      { regex: /<br\s*\/>/gi, replace: '\n' },
      { regex: /<ul[^>]*>([\s\S]*?)<\/ul>/gi, replace: '$1\n' },
      { regex: /<ol[^>]*>([\s\S]*?)<\/ol>/gi, replace: '$1\n' },
      { regex: /<li[^>]*>(.*?)<\/li>/gi, replace: '- $1\n' },
      { regex: /<a[^>]*href="([^"]+)"[^>]*>(.*?)<\/a>/gi, replace: '[$2]($1)' },
      { regex: /<img[^>]*src="([^"]+)"[^>]*>/gi, replace: '![]($1)' }
    ];

    replacements.forEach(({ regex, replace }) => {
      output = output.replace(regex, replace);
    });

    output = output.replace(/<[^>]+>/g, '');
    return output.trim();
  }
}

if (typeof window !== 'undefined') {
  window.RichTextEditor = RichTextEditor;
}
