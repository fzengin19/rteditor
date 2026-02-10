import { describe, it, expect, beforeEach, vi } from 'vitest';
import { EditorEngine } from '../src/engine.js';
import { CLASS_MAP } from '../src/class-map.js';

describe('EditorEngine', () => {
  let root;

  beforeEach(() => {
    root = document.createElement('div');
    document.body.innerHTML = '';
    document.body.appendChild(root);
  });

  it('initializes the root element with contenteditable and a default paragraph', () => {
    new EditorEngine(root);
    expect(root.getAttribute('contenteditable')).toBe('true');
    expect(root.querySelector(`p.${CLASS_MAP.p.split(' ')[0]}`)).not.toBeNull();
  });

  it('executes commands and updates history', () => {
    const engine = new EditorEngine(root);
    vi.spyOn(engine.history, 'push');
    
    engine.exec('bold');
    expect(engine.history.push).toHaveBeenCalled();
  });

  it('handles Enter key by creating a new paragraph', () => {
    const engine = new EditorEngine(root);
    root.innerHTML = `<p class="${CLASS_MAP.p}">Line 1</p>`;
    const p = root.querySelector('p');
    const textNode = p.firstChild;
    
    // Position cursor at end of line 1
    const range = document.createRange();
    range.setStart(textNode, 6);
    range.collapse(true);
    const sel = window.getSelection();
    sel.removeAllRanges();
    sel.addRange(range);

    const event = new KeyboardEvent('keydown', { key: 'Enter', bubbles: true });
    root.dispatchEvent(event);

    const paragraphs = root.querySelectorAll('p');
    expect(paragraphs.length).toBe(2);
  });

  it('sanitizes pasted HTML content', async () => {
    const engine = new EditorEngine(root);
    const html = '<p>Safe</p><script>alert("xss")</script>';
    
    // JSDOM might not have ClipboardEvent, use generic Event
    const event = new Event('paste', {
      bubbles: true,
      cancelable: true
    });

    // Mock clipboardData
    Object.defineProperty(event, 'clipboardData', {
      value: {
        getData: (type) => (type === 'text/html' ? html : '')
      }
    });

    // Ensure focus and selection
    root.focus();
    const range = document.createRange();
    range.selectNodeContents(root.firstChild);
    const sel = window.getSelection();
    sel.removeAllRanges();
    sel.addRange(range);

    root.dispatchEvent(event);

    // Wait for the async dynamic import in handlePaste
    await new Promise(resolve => setTimeout(resolve, 150));
    
    expect(root.innerHTML).not.toContain('script');
    expect(root.innerHTML).toContain('Safe');
    expect(root.querySelector('p').className).toContain(CLASS_MAP.p.split(' ')[0]);
  });
});
