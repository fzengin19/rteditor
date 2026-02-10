import { describe, it, expect, beforeEach } from 'vitest';
import { createCommandRegistry } from '../src/commands.js';
import { CLASS_MAP } from '../src/class-map.js';

describe('command registry', () => {
  let root, registry;

  beforeEach(() => {
    root = document.createElement('div');
    root.setAttribute('contenteditable', 'true');
    root.innerHTML = `<p class="${CLASS_MAP.p}">hello world</p>`;
    document.body.innerHTML = '';
    document.body.appendChild(root);
    registry = createCommandRegistry(root);
  });

  it('registers all standard commands', () => {
    const expected = [
      'bold', 'italic', 'underline', 'strikethrough',
      'h1', 'h2', 'h3', 'h4', 'paragraph',
      'unorderedList', 'orderedList',
      'blockquote', 'codeBlock',
      'link', 'image',
      'clearFormatting',
    ];
    for (const cmd of expected) {
      expect(registry.has(cmd), `Missing command: ${cmd}`).toBe(true);
    }
  });

  describe('inline: bold', () => {
    it('wraps selected text in <strong> with class', () => {
      // Select "hello"
      const textNode = root.querySelector('p').firstChild;
      const range = document.createRange();
      range.setStart(textNode, 0);
      range.setEnd(textNode, 5);
      const sel = window.getSelection();
      sel.removeAllRanges();
      sel.addRange(range);

      registry.exec('bold');

      const strong = root.querySelector('strong');
      expect(strong).not.toBeNull();
      expect(strong.className).toBe(CLASS_MAP.strong);
      expect(strong.textContent).toBe('hello');
    });
  });

  describe('block: h2', () => {
    it('converts <p> to <h2> with correct class', () => {
      // Place cursor inside paragraph
      const textNode = root.querySelector('p').firstChild;
      const range = document.createRange();
      range.setStart(textNode, 0);
      range.collapse(true);
      const sel = window.getSelection();
      sel.removeAllRanges();
      sel.addRange(range);

      registry.exec('h2');

      const h2 = root.querySelector('h2');
      expect(h2).not.toBeNull();
      expect(h2.className).toBe(CLASS_MAP.h2);
      expect(h2.textContent).toBe('hello world');
      expect(root.querySelector('p')).toBeNull();
    });
  });
});
