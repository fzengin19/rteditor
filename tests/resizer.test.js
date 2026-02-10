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
    const handle = container.querySelector('[data-rt-resizer-pos="bottom-right"]');
    
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

  it('increases image width when dragging left-side handle to the left', () => {
    editor.setHTML('<p><img src="test.jpg" style="width: 100px"></p>');
    const img = container.querySelector('img');
    Object.defineProperty(img, 'clientWidth', { value: 100 });
    
    img.click();
    const handle = container.querySelector('[data-rt-resizer-pos="bottom-left"]');
    
    // Start drag
    handle.dispatchEvent(new MouseEvent('mousedown', { 
      clientX: 100,
      bubbles: true 
    }));
    
    // Move 50px left (clientX 100 -> 50)
    document.dispatchEvent(new MouseEvent('mousemove', { 
      clientX: 50,
      bubbles: true 
    }));
    
    // Width should increase: 100 + (startX[100] - moveX[50]) = 150
    expect(img.style.width).toBe('150px');
    
    document.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }));
  });

  it('resizes image using arrow keys when handle is focused', () => {
    editor.setHTML('<p><img src="test.jpg" style="width: 100px"></p>');
    const img = container.querySelector('img');
    
    // Dynamic mock for clientWidth based on style width
    Object.defineProperty(img, 'clientWidth', { 
      get: () => parseInt(img.style.width) || 100 
    });
    
    img.click();
    const handle = container.querySelector('[data-rt-resizer-pos="bottom-right"]');
    
    // Simulate ArrowRight (expand)
    handle.dispatchEvent(new KeyboardEvent('keydown', { 
      key: 'ArrowRight',
      bubbles: true 
    }));
    
    expect(img.style.width).toBe('110px');
    
    // Simulate ArrowLeft (shrink)
    handle.dispatchEvent(new KeyboardEvent('keydown', { 
      key: 'ArrowLeft',
      bubbles: true 
    }));
    
    expect(img.style.width).toBe('100px');
  });
});
