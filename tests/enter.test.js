import { describe, it, expect, beforeEach } from 'vitest';
import { RichTextEditor } from '../src/editor.js';

describe('Enter Key Handling (Refactored)', () => {
  let container;
  let editor;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
    editor = new RichTextEditor(container);
  });

  afterEach(() => {
    editor.destroy();
    container.remove();
  });

  it('splits a paragraph into two', () => {
    editor.setHTML('<p>FirstPart|SecondPart</p>');
    simulateEnter(container, '|');
    const html = editor.getHTML();
    expect(html).toContain('FirstPart');
    expect(html).toContain('SecondPart');
    expect(container.querySelectorAll('p').length).toBe(2);
  });

  it('splits a heading into a paragraph when at the end', () => {
    editor.setHTML('<h1>Heading|</h1>');
    simulateEnter(container, '|');
    const html = editor.getHTML();
    expect(html).toMatch(/<h1[^>]*>Heading<\/h1>/);
    expect(html).toMatch(/<p[^>]*><br><\/p>/);
  });

  it('breaks out of a list on double enter', () => {
    editor.setHTML('<ul><li>Item 1</li><li>|</li></ul>');
    simulateEnter(container, '|');
    const html = editor.getHTML();
    expect(html).toMatch(/<li[^>]*>Item 1<\/li>/);
    expect(html).not.toMatch(/<li[^>]*><\/li>/);
    expect(html).toMatch(/<p[^>]*><br><\/p>/);
  });

  it('breaks out of a blockquote on double enter', () => {
    editor.setHTML('<blockquote><p>|</p></blockquote>');
    simulateEnter(container, '|');
    const html = editor.getHTML();
    // One P should remain
    expect(container.querySelectorAll('p').length).toBe(1);
    expect(html).toMatch(/<p[^>]*><br><\/p>/);
  });

  it('detects "empty" blocks containing Zero-Width Spaces', () => {
    // \u200B is ZWS
    editor.setHTML('<ul><li>Item 1</li><li>\u200B|</li></ul>');
    simulateEnter(container, '|');
    const html = editor.getHTML();
    expect(html).toMatch(/<li[^>]*>Item 1<\/li>/);
    expect(html).toMatch(/<p[^>]*><br><\/p>/);
  });
});

/**
 * Helper to simulate Enter at a position marked by a character (default '|')
 */
function simulateEnter(container, marker = '|') {
    const root = container.querySelector('[contenteditable]');
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    let node;
    while (node = walker.nextNode()) {
        const index = node.textContent.indexOf(marker);
        if (index !== -1) {
            // Remove marker
            const text = node.textContent.replace(marker, '');
            node.textContent = text;
            
            // Set selection
            const range = document.createRange();
            range.setStart(node, index);
            range.setEnd(node, index);
            const sel = window.getSelection();
            sel.removeAllRanges();
            sel.addRange(range);
            
            // Dispatch Enter
            const event = new KeyboardEvent('keydown', {
                key: 'Enter',
                code: 'Enter',
                keyCode: 13,
                which: 13,
                bubbles: true,
                cancelable: true
            });
            root.dispatchEvent(event);
            return;
        }
    }
}
