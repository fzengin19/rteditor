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

  it('off() removes a previously registered event listener (BUG-006)', () => {
    const engine = new EditorEngine(root);
    const spy = vi.fn();
    engine.on('change', spy);
    engine.exec('bold');
    expect(spy).toHaveBeenCalledTimes(1);

    spy.mockClear();
    engine.off('change', spy);
    engine.exec('italic');
    expect(spy).not.toHaveBeenCalled();
  });

  it('off() only removes the specific callback, not all listeners (BUG-006)', () => {
    const engine = new EditorEngine(root);
    const spy1 = vi.fn();
    const spy2 = vi.fn();
    engine.on('change', spy1);
    engine.on('change', spy2);
    engine.exec('bold');
    expect(spy1).toHaveBeenCalledTimes(1);
    expect(spy2).toHaveBeenCalledTimes(1);

    spy1.mockClear();
    spy2.mockClear();
    engine.off('change', spy1);
    engine.exec('italic');
    expect(spy1).not.toHaveBeenCalled();
    expect(spy2).toHaveBeenCalledTimes(1);
  });

  it('off() does not throw for unregistered event or callback (BUG-006)', () => {
    const engine = new EditorEngine(root);
    expect(() => engine.off('nonexistent', () => {})).not.toThrow();
    engine.on('change', () => {});
    expect(() => engine.off('change', () => {})).not.toThrow();
  });

  it('plain text paste positions cursor after pasted content (BUG-007)', () => {
    const engine = new EditorEngine(root);
    root.innerHTML = `<p class="${CLASS_MAP.p}">existing</p>`;
    const p = root.querySelector('p');
    const textNode = p.firstChild;

    const range = document.createRange();
    range.setStart(textNode, 8);
    range.collapse(true);
    const sel = window.getSelection();
    sel.removeAllRanges();
    sel.addRange(range);

    const event = new Event('paste', { bubbles: true, cancelable: true });
    Object.defineProperty(event, 'clipboardData', {
      value: { getData: (type) => (type === 'text/plain' ? 'pasted text' : '') }
    });

    root.dispatchEvent(event);

    const curSel = window.getSelection();
    expect(curSel.rangeCount).toBe(1);
    const curRange = curSel.getRangeAt(0);
    expect(curRange.collapsed).toBe(true);

    expect(root.textContent).toContain('pasted text');
  });

  it('HTML paste positions cursor after pasted content (BUG-007)', () => {
    const engine = new EditorEngine(root);
    root.innerHTML = `<p class="${CLASS_MAP.p}">before</p>`;
    const p = root.querySelector('p');
    const textNode = p.firstChild;

    const range = document.createRange();
    range.setStart(textNode, 6);
    range.collapse(true);
    const sel = window.getSelection();
    sel.removeAllRanges();
    sel.addRange(range);

    const event = new Event('paste', { bubbles: true, cancelable: true });
    Object.defineProperty(event, 'clipboardData', {
      value: { getData: (type) => (type === 'text/html' ? '<p>inserted</p>' : 'inserted') }
    });

    root.dispatchEvent(event);

    const curSel = window.getSelection();
    expect(curSel.rangeCount).toBe(1);
    const curRange = curSel.getRangeAt(0);
    expect(curRange.collapsed).toBe(true);
  });

  it('debounces normalization instead of normalizing every input event (PERF-001)', () => {
    vi.useFakeTimers();
    const engine = new EditorEngine(root);

    root.innerHTML = '<div>Unnormalized</div>';
    root.dispatchEvent(new Event('input', { bubbles: true }));

    expect(root.querySelector('div')).not.toBeNull();

    vi.advanceTimersByTime(260);

    expect(root.querySelector('div')).toBeNull();
    expect(root.querySelector('p')).not.toBeNull();
    vi.useRealTimers();
  });

  it('debounces change emission during rapid input events (PERF-002)', () => {
    vi.useFakeTimers();
    const onChange = vi.fn();
    const engine = new EditorEngine(root, { onChange });

    root.innerHTML = '<p>abc</p>';
    root.dispatchEvent(new Event('input', { bubbles: true }));
    root.dispatchEvent(new Event('input', { bubbles: true }));

    expect(onChange).toHaveBeenCalledTimes(0);

    vi.advanceTimersByTime(130);

    expect(onChange).toHaveBeenCalledTimes(1);
    vi.useRealTimers();
  });
});
