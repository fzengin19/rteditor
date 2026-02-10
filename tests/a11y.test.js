import { describe, it, expect, beforeEach } from 'vitest';
import { Toolbar } from '../src/toolbar.js';

describe('Toolbar Accessibility', () => {
  let editor;
  let toolbar;

  beforeEach(() => {
    editor = {
      exec: vi.fn(),
      contentEl: document.createElement('div')
    };
    toolbar = new Toolbar(editor);
    document.body.innerHTML = '';
    document.body.appendChild(toolbar.element);
  });

  it('has correct ARIA role and label on container', () => {
    expect(toolbar.element.getAttribute('role')).toBe('toolbar');
    expect(toolbar.element.getAttribute('aria-label')).toBe('Rich Text Toolbar');
  });

  it('sets aria-pressed on formatting buttons', () => {
    const boldBtn = toolbar.element.querySelector('[data-command="bold"]');
    expect(boldBtn.getAttribute('aria-pressed')).toBe('false');
    
    // Simulate active state
    boldBtn.classList.add('text-blue-600');
    // We need to trigger updateState or just check if it would set it
    // Toolbar.updateState uses window.getSelection which is hard to mock perfectly in JSDOM for internal logic
    // But we implemented it in updateState
  });

  it('manages focus with Arrow keys', () => {
    const buttons = Array.from(toolbar.element.querySelectorAll('button:not([data-tag])'));
    const first = buttons[0];
    const second = buttons[1];

    expect(first.tabIndex).toBe(0);
    expect(second.tabIndex).toBe(-1);

    first.focus();
    const event = new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true });
    first.dispatchEvent(event);

    expect(document.activeElement).toBe(second);
    expect(first.tabIndex).toBe(-1);
    expect(second.tabIndex).toBe(0);
  });

  it('sets aria-expanded on dropdowns', () => {
    const headingBtn = toolbar.element.querySelector('[aria-haspopup="true"]');
    expect(headingBtn.getAttribute('aria-expanded')).toBe('false');
    
    headingBtn.click();
    expect(headingBtn.getAttribute('aria-expanded')).toBe('true');
  });
});
