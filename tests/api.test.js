import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { RichTextEditor } from '../src/editor.js';

describe('Editor API: getHTML vs getRawHTML', () => {
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

  it('getHTML() returns normalized HTML (<b> -> <strong>)', () => {
    const root = container.querySelector('[contenteditable]');
    root.innerHTML = '<p><b>bold</b></p>';
    
    const html = editor.getHTML();
    expect(html).toMatch(/<strong[^>]*>bold<\/strong>/);
    expect(html).not.toContain('<b>');
  });

  it('getRawHTML() returns un-normalized HTML (<b> remains <b>)', () => {
    const root = container.querySelector('[contenteditable]');
    root.innerHTML = '<p><b>bold</b></p>';
    
    const raw = editor.getRawHTML();
    expect(raw).toContain('<b>bold</b>');
    expect(raw).not.toContain('<strong>');
  });

  it('getHTML() applies Tailwind classes from CLASS_MAP', () => {
    const root = container.querySelector('[contenteditable]');
    root.innerHTML = '<p>text</p>';
    
    const html = editor.getHTML();
    // Expect the class mapped for 'p' in class-map.js
    expect(html).toMatch(/<p class="[^"]+">text<\/p>/);
  });

  it('getRawHTML() does not apply classes unless they are already in DOM', () => {
    const root = container.querySelector('[contenteditable]');
    root.innerHTML = '<p>text</p>';
    
    const raw = editor.getRawHTML();
    expect(raw).toBe('<p>text</p>');
  });
});
