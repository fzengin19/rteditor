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
      'blockquote',
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

  describe('block: unorderedList', () => {
    it('wraps multiple selected paragraphs into a single list', () => {
      root.innerHTML = `
        <p class="${CLASS_MAP.p}">A</p>
        <p class="${CLASS_MAP.p}">B</p>
      `;
      const p1 = root.querySelectorAll('p')[0];
      const p2 = root.querySelectorAll('p')[1];
      
      const range = document.createRange();
      range.setStart(p1.firstChild, 0);
      range.setEnd(p2.firstChild, 1);
      const sel = window.getSelection();
      sel.removeAllRanges();
      sel.addRange(range);

      registry.exec('unorderedList');

      const ul = root.querySelector('ul');
      expect(ul).not.toBeNull();
      expect(ul.children.length).toBe(2);
      expect(ul.children[0].tagName).toBe('LI');
      expect(ul.children[1].tagName).toBe('LI');
      expect(ul.children[0].textContent).toBe('A');
      expect(ul.children[1].textContent).toBe('B');
    });
  });

  describe('block: blockquote', () => {
    it('wraps multiple selected paragraphs into a single blockquote', () => {
      root.innerHTML = `
        <p class="${CLASS_MAP.p}">A</p>
        <p class="${CLASS_MAP.p}">B</p>
      `;
      const p1 = root.querySelectorAll('p')[0];
      const p2 = root.querySelectorAll('p')[1];
      
      const range = document.createRange();
      range.setStart(p1.firstChild, 0);
      range.setEnd(p2.firstChild, 1);
      const sel = window.getSelection();
      sel.removeAllRanges();
      sel.addRange(range);

      registry.exec('blockquote');

      const bq = root.querySelector('blockquote');
      expect(bq).not.toBeNull();
      expect(bq.children.length).toBe(2);
      expect(bq.children[0].tagName).toBe('P');
      expect(bq.children[1].tagName).toBe('P');
      expect(bq.children[0].textContent).toBe('A');
      expect(bq.children[1].textContent).toBe('B');
    });
  });

  describe('command: clearFormatting', () => {
    it('resets blocks to paragraphs and removes inline styles', () => {
      root.innerHTML = `<h1 class="${CLASS_MAP.h1}"><strong>Hello</strong> <em>World</em></h1>`;
      const h1 = root.querySelector('h1');
      
      const range = document.createRange();
      range.selectNodeContents(h1);
      const sel = window.getSelection();
      sel.removeAllRanges();
      sel.addRange(range);

      registry.exec('clearFormatting');

      const p = root.querySelector('p');
      expect(p).not.toBeNull();
      expect(p.className).toBe(CLASS_MAP.p);
      expect(p.innerHTML).toBe('Hello World');
      expect(root.querySelector('h1')).toBeNull();
      expect(root.querySelector('strong')).toBeNull();
      expect(root.querySelector('em')).toBeNull();
    });
  });
});
