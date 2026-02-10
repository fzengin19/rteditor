import { describe, it, expect, beforeEach, vi } from 'vitest';
import { Toolbar, DEFAULT_TOOLBAR } from '../src/toolbar.js';

describe('Toolbar', () => {
  let root, editor, toolbar;

  beforeEach(() => {
    root = document.createElement('div');
    root.setAttribute('contenteditable', 'true');
    document.body.innerHTML = '';
    document.body.appendChild(root);

    editor = {
      exec: vi.fn(),
      contentEl: root,
    };

    toolbar = new Toolbar(editor);
  });

  it('renders a container with the role of toolbar', () => {
    const el = toolbar.element;
    expect(el.tagName).toBe('DIV');
    expect(el.getAttribute('role')).toBe('toolbar');
  });

  it('renders buttons from DEFAULT_TOOLBAR', () => {
    const el = toolbar.element;
    // Count buttons (excluding dividers)
    const buttonCount = DEFAULT_TOOLBAR.filter(i => i !== '|').length;
    // Some buttons are in dropdowns, so we check total buttons + dropdown wrappers
    const renderedButtons = el.querySelectorAll('button[data-command], .relative > button');
    expect(renderedButtons.length).toBeGreaterThanOrEqual(buttonCount);
  });

  it('calls editor.exec when a button is clicked', () => {
    const boldBtn = toolbar.element.querySelector('button[data-command="bold"]');
    boldBtn.click();
    expect(editor.exec).toHaveBeenCalledWith('bold');
  });

  it('shows a custom prompt for link/image buttons', () => {
    const linkBtn = toolbar.element.querySelector('button[data-command="link"]');
    linkBtn.click();
    
    // Check if prompt overlay exists
    const overlay = toolbar.element.querySelector('input').parentElement;
    expect(overlay).not.toBeNull();
    
    // Enter URL and click apply
    const input = overlay.querySelector('input');
    input.value = 'https://vitest.dev';
    const applyBtn = Array.from(overlay.querySelectorAll('button')).find(b => b.textContent === 'Apply');
    applyBtn.click();
    
    expect(editor.exec).toHaveBeenCalledWith('link', 'https://vitest.dev');
    expect(toolbar.element.querySelector('input')).toBeNull(); // Overlay removed
  });

  it('highlights buttons based on selection state', () => {
    const el = toolbar.element;
    const boldBtn = el.querySelector('button[data-command="bold"]');

    // Setup selection inside <strong>
    root.innerHTML = '<p><strong>Bold Text</strong></p>';
    const strong = root.querySelector('strong');
    const range = document.createRange();
    range.selectNodeContents(strong);
    const sel = window.getSelection();
    sel.removeAllRanges();
    sel.addRange(range);

    toolbar.updateState(root);

    expect(boldBtn.classList.contains('text-blue-600')).toBe(true);
    expect(boldBtn.classList.contains('bg-gray-200')).toBe(true);
  });

  it('toggles visibility of dropdown on click', () => {
    const dropdownWrapper = toolbar.element.querySelector('.relative');
    const toggleBtn = dropdownWrapper.querySelector('button');
    const menu = dropdownWrapper.querySelector('.hidden');

    expect(menu).not.toBeNull();
    toggleBtn.click();
    expect(menu.classList.contains('hidden')).toBe(false);
    toggleBtn.click();
    expect(menu.classList.contains('hidden')).toBe(true);
  });
});
