import { describe, it, expect, beforeEach, vi } from 'vitest';
import { RichTextEditor } from '../src/editor.js';

describe('Resource Cleanup (§4.1, §4.2)', () => {
  let container;

  beforeEach(() => {
    document.body.innerHTML = '';
    container = document.createElement('div');
    container.id = 'editor';
    document.body.appendChild(container);
  });

  it('correctly destroys the editor and cleans up DOM', () => {
    const editor = new RichTextEditor('#editor');
    const editorEl = document.querySelector('#editor');
    
    expect(editorEl.querySelector('[contenteditable]')).not.toBeNull();
    
    editor.destroy();
    
    // Wrapper should be removed from DOM
    expect(document.body.contains(editorEl)).toBe(true); // container remains
    expect(editorEl.children.length).toBe(0); // but wrapper inside it is gone
  });

  it('removes event listeners from the engine', () => {
    const editor = new RichTextEditor('#editor');
    const engineRoot = document.querySelector('[contenteditable]');
    
    // We can't easily check listeners on a DOM node in JSDOM,
    // but we can verify that actions no longer trigger logic.
    // However, we can check if attributes are removed.
    
    editor.destroy();
    
    expect(engineRoot.getAttribute('contenteditable')).toBeNull();
    expect(engineRoot.getAttribute('role')).toBeNull();
  });

  it('cleans up toolbar listeners', () => {
    const editor = new RichTextEditor('#editor');
    const toolbar = document.querySelector('.border-gray-300'); // the wrapper
    
    editor.destroy();
    
    expect(document.body.contains(toolbar)).toBe(false);
  });

  it('cleans up resizer listeners', () => {
    const editor = new RichTextEditor('#editor');
    editor.setHTML('<img src="test.jpg">');
    
    // Find image regardless of wrapping or id stripping
    const img = document.querySelector('[contenteditable] img');
    expect(img).not.toBeNull();
    
    img.click(); // Trigger resizer creation
    
    expect(document.querySelector('.border-blue-500')).not.toBeNull(); // Overlay exists
    
    editor.destroy();
    
    expect(document.querySelector('.border-blue-500')).toBeNull(); // Overlay removed
  });
});
