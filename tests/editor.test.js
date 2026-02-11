import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { RichTextEditor } from '../src/editor.js';

describe('RichTextEditor Integration', () => {
  let container;

  beforeEach(() => {
    container = document.createElement('div');
    container.id = 'editor-target';
    document.body.appendChild(container);
  });

  afterEach(() => {
    document.body.innerHTML = '';
  });

  it('initializes with target selector', () => {
    const editor = new RichTextEditor('#editor-target');
    expect(container.querySelector('[contenteditable]')).not.toBeNull();
    editor.destroy();
  });

  it('initializes with DOM element', () => {
    const editor = new RichTextEditor(container);
    expect(container.querySelector('[contenteditable]')).not.toBeNull();
    editor.destroy();
  });

  it('throws for invalid target', () => {
    expect(() => new RichTextEditor('#nonexistent')).toThrow('not found');
  });

  it('sets and gets normalized HTML', () => {
    const editor = new RichTextEditor(container);
    editor.setHTML('<b>Bold</b>');
    
    // Should be normalized to <strong> and have tailwind classes
    const html = editor.getHTML();
    expect(html).toContain('<strong');
    expect(html).toContain('font-bold');
    expect(html).not.toContain('<b>');
    editor.destroy();
  });

  it('reports isEmpty correctly', () => {
    const editor = new RichTextEditor(container);
    expect(editor.isEmpty()).toBe(true);
    editor.setHTML('<p>hello</p>');
    expect(editor.isEmpty()).toBe(false);
    editor.destroy();
  });

  it('triggers onChange callback on content changes', () => {
    const onChange = vi.fn();
    const editor = new RichTextEditor(container, { onChange });
    
    editor.setHTML('<p>New Content</p>');
    expect(onChange).toHaveBeenCalled();
    editor.destroy();
  });

  it('gets plain text', () => {
    const editor = new RichTextEditor(container);
    editor.setHTML('<h1>Title</h1><p>Hello <strong>world</strong></p>');
    const text = editor.getText();
    expect(text).toContain('Title');
    expect(text).toContain('Hello world');
    editor.destroy();
  });

  it('cleans up on destroy including placeholder listeners (BUG-004)', () => {
    const editor = new RichTextEditor(container, { placeholder: 'Test' });
    const contentEl = container.querySelector('[contenteditable]');
    const spy = vi.spyOn(contentEl, 'removeEventListener');
    
    editor.destroy();
    
    expect(spy).toHaveBeenCalledWith('input', expect.any(Function));
    expect(spy).toHaveBeenCalledWith('focus', expect.any(Function));
    expect(spy).toHaveBeenCalledWith('blur', expect.any(Function));
    expect(container.querySelector('[contenteditable]')).toBeNull();
    expect(container.querySelector('[role="toolbar"]')).toBeNull();
  });

  it('respects initialHTML option', () => {
    const initialHTML = '<p>Initial</p>';
    const editor = new RichTextEditor(container, { initialHTML });
    expect(editor.getHTML()).toContain('Initial');
    editor.destroy();
  });

  it('does not undo to empty state after initialHTML load (BUG-009)', () => {
    const initialHTML = '<p>Initial</p>';
    const editor = new RichTextEditor(container, { initialHTML });

    editor.exec('undo');

    expect(editor.getText().trim()).toBe('Initial');
    editor.destroy();
  });

  it('uses rAF-based resizer guard instead of fixed timeout (BUG-015)', () => {
    const rafQueue = [];
    const rafSpy = vi.spyOn(window, 'requestAnimationFrame').mockImplementation((cb) => {
      rafQueue.push(cb);
      return rafQueue.length;
    });
    const cancelSpy = vi.spyOn(window, 'cancelAnimationFrame').mockImplementation(() => {});

    const editor = new RichTextEditor(container);
    editor.setHTML('<p><img src="https://example.com/x.png" alt="x"></p>');

    let img = container.querySelector('img');
    img.click();
    expect(container.querySelector('[data-rt-resizer="true"]')).not.toBeNull();

    editor.setHTML('<p><img src="https://example.com/x.png" alt="x"></p>');
    img = container.querySelector('img');

    img.click();
    expect(container.querySelector('[data-rt-resizer="true"]')).toBeNull();

    const first = rafQueue.shift();
    expect(first).toBeTypeOf('function');
    first(0);

    const second = rafQueue.shift();
    expect(second).toBeTypeOf('function');
    second(0);

    img.click();
    expect(container.querySelector('[data-rt-resizer="true"]')).not.toBeNull();

    expect(rafSpy).toHaveBeenCalled();

    editor.destroy();
    cancelSpy.mockRestore();
    rafSpy.mockRestore();
  });
});
