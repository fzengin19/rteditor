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

  it('renders correctly with toolbar and content area', () => {
    const editor = new RichTextEditor('#editor-target');
    
    expect(container.querySelector('[role="toolbar"]')).not.toBeNull();
    const contentEl = container.querySelector('[contenteditable="true"]');
    expect(contentEl).not.toBeNull();
    expect(contentEl.getAttribute('data-placeholder')).toBe('Start writing...');
  });

  it('sets and gets normalized HTML', () => {
    const editor = new RichTextEditor(container);
    editor.setHTML('<b>Bold</b>');
    
    // Should be normalized to <strong> and have tailwind classes
    const html = editor.getHTML();
    expect(html).toContain('<strong');
    expect(html).toContain('font-bold');
    expect(html).not.toContain('<b>');
  });

  it('triggers onChange callback on content changes', () => {
    const onChange = vi.fn();
    const editor = new RichTextEditor(container, { onChange });
    
    editor.setHTML('<p>New Content</p>');
    expect(onChange).toHaveBeenCalled();
  });

  it('cleans up on destroy', () => {
    const editor = new RichTextEditor(container);
    editor.destroy();
    
    expect(container.children.length).toBe(0);
  });

  it('respects initialHTML option', () => {
    const initialHTML = '<p>Initial</p>';
    const editor = new RichTextEditor(container, { initialHTML });
    
    expect(editor.getHTML()).toContain('Initial');
  });
});
