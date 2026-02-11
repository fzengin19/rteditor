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

  describe('inline formats', () => {
    it('exec("bold") wraps selection in <strong>', () => {
      const textNode = root.querySelector('p').firstChild;
      const range = document.createRange();
      range.setStart(textNode, 0);
      range.setEnd(textNode, 5);
      const sel = window.getSelection();
      sel.removeAllRanges();
      sel.addRange(range);

      registry.exec('bold');
      const el = root.querySelector('strong');
      expect(el).not.toBeNull();
      expect(el.className).toBe(CLASS_MAP.strong);
      expect(el.textContent).toBe('hello');
    });

    it('exec("italic") wraps selection in <em>', () => {
      const textNode = root.querySelector('p').firstChild;
      const range = document.createRange();
      range.setStart(textNode, 0);
      range.setEnd(textNode, 5);
      const sel = window.getSelection();
      sel.removeAllRanges();
      sel.addRange(range);

      registry.exec('italic');
      const el = root.querySelector('em');
      expect(el).not.toBeNull();
      expect(el.className).toBe(CLASS_MAP.em);
      expect(el.textContent).toBe('hello');
    });

    it('exec("underline") wraps selection in <u>', () => {
      const textNode = root.querySelector('p').firstChild;
      const range = document.createRange();
      range.setStart(textNode, 0);
      range.setEnd(textNode, 5);
      const sel = window.getSelection();
      sel.removeAllRanges();
      sel.addRange(range);

      registry.exec('underline');
      const el = root.querySelector('u');
      expect(el).not.toBeNull();
      expect(el.className).toBe(CLASS_MAP.u);
      expect(el.textContent).toBe('hello');
    });

    it('exec("strikethrough") wraps selection in <s>', () => {
      const textNode = root.querySelector('p').firstChild;
      const range = document.createRange();
      range.setStart(textNode, 0);
      range.setEnd(textNode, 5);
      const sel = window.getSelection();
      sel.removeAllRanges();
      sel.addRange(range);

      registry.exec('strikethrough');
      const el = root.querySelector('s');
      expect(el).not.toBeNull();
      expect(el.className).toBe(CLASS_MAP.s);
      expect(el.textContent).toBe('hello');
    });

    it('applies format across mixed formatted selection (BUG-008)', () => {
      root.innerHTML = `<p class="${CLASS_MAP.p}"><strong>bold</strong> normal</p>`;
      const p = root.querySelector('p');
      const strongText = p.querySelector('strong').firstChild;
      const plainText = p.lastChild;

      const range = document.createRange();
      range.setStart(strongText, 2);
      range.setEnd(plainText, 5);
      const sel = window.getSelection();
      sel.removeAllRanges();
      sel.addRange(range);

      registry.exec('bold');

      const strongNodes = Array.from(root.querySelectorAll('strong'));
      const boldText = strongNodes.map(node => node.textContent).join('');
      expect(boldText.includes('ld nor')).toBe(true);
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

    it('unwraps list items in the correct order (BUG-002)', () => {
      root.innerHTML = '<ul><li>A</li><li>B</li><li>C</li></ul><p id="after">After</p>';
      const list = root.querySelector('ul');
      const range = document.createRange();
      range.selectNodeContents(list);
      const sel = window.getSelection();
      sel.removeAllRanges();
      sel.addRange(range);

      registry.exec('unorderedList');
      const paragraphs = Array.from(root.querySelectorAll('p')).map(p => p.textContent.trim());
      expect(paragraphs).toEqual(['A', 'B', 'C', 'After']);
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

    it('unwraps blockquote items in the correct order (BUG-003)', () => {
      root.innerHTML = '<blockquote><p>1</p><p>2</p><p>3</p></blockquote><p id="after">After</p>';
      const bq = root.querySelector('blockquote');
      const range = document.createRange();
      range.selectNodeContents(bq);
      const sel = window.getSelection();
      sel.removeAllRanges();
      sel.addRange(range);

      registry.exec('blockquote');
      const paragraphs = Array.from(root.querySelectorAll('p')).map(p => p.textContent.trim());
      expect(paragraphs).toEqual(['1', '2', '3', 'After']);
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

    it('preserves links when clearing formatting (BUG-005)', () => {
      root.innerHTML = `<p><strong>bold</strong> <a href="https://example.com">link text</a> normal</p>`;
      const p = root.querySelector('p');

      const range = document.createRange();
      range.selectNodeContents(p);
      const sel = window.getSelection();
      sel.removeAllRanges();
      sel.addRange(range);

      registry.exec('clearFormatting');

      expect(root.querySelector('strong')).toBeNull();
      const link = root.querySelector('a');
      expect(link).not.toBeNull();
      expect(link.href).toBe('https://example.com/');
      expect(link.textContent).toBe('link text');
    });

    it('preserves images when clearing formatting (BUG-005)', () => {
      root.innerHTML = `<p><em>text</em><img src="test.png" alt="img"></p>`;
      const p = root.querySelector('p');

      const range = document.createRange();
      range.selectNodeContents(p);
      const sel = window.getSelection();
      sel.removeAllRanges();
      sel.addRange(range);

      registry.exec('clearFormatting');

      expect(root.querySelector('em')).toBeNull();
      const img = root.querySelector('img');
      expect(img).not.toBeNull();
      expect(img.alt).toBe('img');
    });

    it('preserves code elements when clearing formatting (BUG-005)', () => {
      root.innerHTML = `<p><strong>bold</strong> <code>snippet</code></p>`;
      const p = root.querySelector('p');

      const range = document.createRange();
      range.selectNodeContents(p);
      const sel = window.getSelection();
      sel.removeAllRanges();
      sel.addRange(range);

      registry.exec('clearFormatting');

      expect(root.querySelector('strong')).toBeNull();
      const code = root.querySelector('code');
      expect(code).not.toBeNull();
      expect(code.textContent).toBe('snippet');
    });

    it('unwraps lists and preserves structure (P1-001)', () => {
      // <ul><li>Item 1</li><li>Item 2 (Selected)</li><li>Item 3</li></ul>
      root.innerHTML = '<ul><li>Item 1</li><li>Item 2</li><li>Item 3</li></ul>';
      const li2 = root.querySelector('ul').children[1];
      const range = document.createRange();
      range.selectNodeContents(li2);
      const selection = window.getSelection();
      selection.removeAllRanges();
      selection.addRange(range);

      registry.exec('clearFormatting');

      // Expected:
      // <ul><li>Item 1</li></ul>
      // <p>Item 2</p>
      // <ul><li>Item 3</li></ul>
      
      const children = root.children;
      expect(children.length).toBe(3);
      expect(children[0].tagName).toBe('UL');
      expect(children[0].textContent).toBe('Item 1');
      expect(children[1].tagName).toBe('P');
      expect(children[1].textContent).toBe('Item 2');
      expect(children[2].tagName).toBe('UL');
      expect(children[2].textContent).toBe('Item 3');
    });
  });

  describe('command: image', () => {
    it('rejects unsafe image URLs (BUG-014)', () => {
      const textNode = root.querySelector('p').firstChild;
      const range = document.createRange();
      range.setStart(textNode, 0);
      range.collapse(true);
      const sel = window.getSelection();
      sel.removeAllRanges();
      sel.addRange(range);

      registry.exec('image', 'javascript:alert(1)', 'x');

      expect(root.querySelector('img')).toBeNull();
    });

    it('accepts safe image URLs (BUG-014)', () => {
      const textNode = root.querySelector('p').firstChild;
      const range = document.createRange();
      range.setStart(textNode, 0);
      range.collapse(true);
      const sel = window.getSelection();
      sel.removeAllRanges();
      sel.addRange(range);

      registry.exec('image', 'https://example.com/image.png', 'ok');

      const img = root.querySelector('img');
      expect(img).not.toBeNull();
      expect(img.src).toBe('https://example.com/image.png');
      expect(img.alt).toBe('ok');
    });
  });

  describe('link URL sanitization', () => {
    it('rejects javascript: URLs in link command', () => {
      const textNode = root.querySelector('p').firstChild;
      const range = document.createRange();
      range.setStart(textNode, 0);
      range.setEnd(textNode, 5);
      const sel = window.getSelection();
      sel.removeAllRanges();
      sel.addRange(range);

      registry.exec('link', 'javascript:alert(1)');

      expect(root.querySelector('a')).toBeNull();
    });

    it('rejects vbscript: URLs in link command', () => {
      const textNode = root.querySelector('p').firstChild;
      const range = document.createRange();
      range.setStart(textNode, 0);
      range.setEnd(textNode, 5);
      const sel = window.getSelection();
      sel.removeAllRanges();
      sel.addRange(range);

      registry.exec('link', 'vbscript:MsgBox("xss")');

      expect(root.querySelector('a')).toBeNull();
    });

    it('rejects javascript: URLs with mixed case', () => {
      const textNode = root.querySelector('p').firstChild;
      const range = document.createRange();
      range.setStart(textNode, 0);
      range.setEnd(textNode, 5);
      const sel = window.getSelection();
      sel.removeAllRanges();
      sel.addRange(range);

      registry.exec('link', 'JaVaScRiPt:alert(1)');

      expect(root.querySelector('a')).toBeNull();
    });

    it('rejects data: URLs in link command', () => {
      const textNode = root.querySelector('p').firstChild;
      const range = document.createRange();
      range.setStart(textNode, 0);
      range.setEnd(textNode, 5);
      const sel = window.getSelection();
      sel.removeAllRanges();
      sel.addRange(range);

      registry.exec('link', 'data:text/html,<script>alert(1)</script>');

      expect(root.querySelector('a')).toBeNull();
    });

    it('accepts safe http/https URLs in link command', () => {
      const textNode = root.querySelector('p').firstChild;
      const range = document.createRange();
      range.setStart(textNode, 0);
      range.setEnd(textNode, 5);
      const sel = window.getSelection();
      sel.removeAllRanges();
      sel.addRange(range);

      registry.exec('link', 'https://example.com');

      const link = root.querySelector('a');
      expect(link).not.toBeNull();
      expect(link.href).toBe('https://example.com/');
    });

    it('does not sanitize when removing a link (empty url)', () => {
      root.innerHTML = '<p><a href="https://example.com">hello</a> world</p>';
      const link = root.querySelector('a');
      const range = document.createRange();
      range.selectNodeContents(link);
      const sel = window.getSelection();
      sel.removeAllRanges();
      sel.addRange(range);

      registry.exec('link', '');

      expect(root.querySelector('a')).toBeNull();
      expect(root.textContent).toContain('hello');
    });

    it('rejects javascript: URLs when updating existing link', () => {
      root.innerHTML = '<p><a href="https://example.com">hello</a> world</p>';
      const link = root.querySelector('a');
      const range = document.createRange();
      range.selectNodeContents(link);
      const sel = window.getSelection();
      sel.removeAllRanges();
      sel.addRange(range);

      registry.exec('link', 'javascript:alert(1)');

      const updatedLink = root.querySelector('a');
      expect(updatedLink.href).not.toContain('javascript');
    });
  });

  describe('list indentation', () => {
    it('should not indent the first list item (no previous sibling)', () => {
      root.innerHTML = `<ul><li class="${CLASS_MAP.li}">First item</li><li class="${CLASS_MAP.li}">Second item</li></ul>`;
      const li = root.querySelector('li');
      const textNode = li.firstChild;
      const range = document.createRange();
      range.setStart(textNode, 0);
      range.collapse(true);
      const sel = window.getSelection();
      sel.removeAllRanges();
      sel.addRange(range);

      registry.exec('indentList');

      // Structure should remain unchanged - first item can't be indented
      const ul = root.querySelector('ul');
      expect(ul.children.length).toBe(2);
      expect(ul.children[0].tagName).toBe('LI');
      expect(ul.children[1].tagName).toBe('LI');
    });

    it('should indent second item under first item', () => {
      root.innerHTML = `<ul><li class="${CLASS_MAP.li}">First item</li><li class="${CLASS_MAP.li}">Second item</li></ul>`;
      const lis = root.querySelectorAll('li');
      const secondLi = lis[1];
      const textNode = secondLi.firstChild;
      const range = document.createRange();
      range.setStart(textNode, 0);
      range.collapse(true);
      const sel = window.getSelection();
      sel.removeAllRanges();
      sel.addRange(range);

      registry.exec('indentList');

      // First LI should now contain a nested UL with second LI
      const firstLi = root.querySelector('li');
      const nestedUl = firstLi.querySelector('ul');
      expect(nestedUl).not.toBeNull();
      expect(nestedUl.querySelector('li').textContent).toBe('Second item');
    });

    it('should not create self-reference when indenting item without children', () => {
      root.innerHTML = `<ul><li class="${CLASS_MAP.li}">First</li><li class="${CLASS_MAP.li}">Second</li></ul>`;
      const lis = root.querySelectorAll('li');
      const secondLi = lis[1];
      const range = document.createRange();
      range.selectNodeContents(secondLi);
      const sel = window.getSelection();
      sel.removeAllRanges();
      sel.addRange(range);

      registry.exec('indentList');

      // Check no circular reference
      const html = root.innerHTML;
      // The second LI should be INSIDE the first LI, not the other way around
      const firstLi = root.querySelector('ul > li');
      expect(firstLi.textContent).toContain('First');
      const nestedUl = firstLi.querySelector(':scope > ul');
      expect(nestedUl).not.toBeNull();
      expect(nestedUl.querySelector('li').textContent).toBe('Second');
    });

    it('should do nothing when not inside a list', () => {
      root.innerHTML = `<p class="${CLASS_MAP.p}">Just a paragraph</p>`;
      const p = root.querySelector('p');
      const textNode = p.firstChild;
      const range = document.createRange();
      range.setStart(textNode, 0);
      range.collapse(true);
      const sel = window.getSelection();
      sel.removeAllRanges();
      sel.addRange(range);

      registry.exec('indentList');

      // Should remain unchanged
      expect(root.querySelector('p')).not.toBeNull();
      expect(root.querySelector('ul')).toBeNull();
      expect(root.querySelector('ol')).toBeNull();
    });
  });
});
