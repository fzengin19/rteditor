import { describe, it, expect, beforeEach, vi } from 'vitest';
import { RichTextEditor } from '../src/editor.js';

describe('ImageResizer Integration', () => {
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

  it('shows resizer handles when image is clicked', () => {
    editor.setHTML('<p><img src="test.jpg" width="100"></p>');
    const img = container.querySelector('img');
    
    // Simulate click
    img.click();
    
    const overlay = container.querySelector('.border-blue-500');
    expect(overlay).not.toBeNull();
    const handle = overlay.querySelector('.cursor-nwse-resize');
    expect(handle).not.toBeNull();
  });

  it('removes resizer when clicking away', () => {
    editor.setHTML('<p><img src="test.jpg" width="100"></p>');
    const img = container.querySelector('img');
    img.click();
    
    expect(container.querySelector('.border-blue-500')).not.toBeNull();
    
    // Click body
    document.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
    
    expect(container.querySelector('.border-blue-500')).toBeNull();
  });

  it('updates image width on mousemove', () => {
    editor.setHTML('<p><img src="test.jpg" style="width: 100px"></p>');
    const img = container.querySelector('img');
    
    // JSDOM clientWidth/Height are 0 by default, let's mock them
    Object.defineProperty(img, 'clientWidth', { value: 100 });
    Object.defineProperty(img, 'naturalWidth', { value: 100 });
    Object.defineProperty(img, 'naturalHeight', { value: 100 });
    
    img.click();
    const handle = container.querySelector('.cursor-nwse-resize');
    
    // Start drag
    handle.dispatchEvent(new MouseEvent('mousedown', { 
      clientX: 0,
      bubbles: true 
    }));
    
    // Move 50px right
    document.dispatchEvent(new MouseEvent('mousemove', { 
      clientX: 50,
      bubbles: true 
    }));
    
    expect(img.style.width).toBe('150px');
    
    // End drag
    document.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }));
  });
});
