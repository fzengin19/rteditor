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
    
    // Check if prompt overlay exists and has correct ARIA roles
    const overlay = toolbar.element.querySelector('input').parentElement;
    expect(overlay).not.toBeNull();
    expect(overlay.getAttribute('role')).toBe('dialog');
    expect(overlay.getAttribute('aria-modal')).toBe('true');
    expect(overlay.getAttribute('aria-label')).toBe('Insert Link');
    
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

  it('closes heading dropdown on Escape and returns focus to trigger (BUG-010)', () => {
    document.body.appendChild(toolbar.element);

    const dropdownWrapper = toolbar.element.querySelector('.relative');
    const toggleBtn = dropdownWrapper.querySelector('button');
    const menu = dropdownWrapper.querySelector('[role="listbox"]');

    toggleBtn.click();
    expect(menu.classList.contains('hidden')).toBe(false);

    toggleBtn.focus();
    toggleBtn.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));

    expect(menu.classList.contains('hidden')).toBe(true);
    expect(toggleBtn.getAttribute('aria-expanded')).toBe('false');
    expect(document.activeElement).toBe(toggleBtn);
  });

  it('sets correct ARIA roles for heading dropdown items', () => {
    const dropdownWrapper = toolbar.element.querySelector('.relative');
    const menu = dropdownWrapper.querySelector('[role="listbox"]');
    const options = menu.querySelectorAll('[role="option"]');

    expect(menu).not.toBeNull();
    expect(options.length).toBeGreaterThan(0);
    
    // Check initial aria-selected
    expect(options[0].getAttribute('aria-selected')).toBe('false');
  });

  test('closes prompt when clicking outside', async () => {
    document.body.appendChild(toolbar.element);
    const linkBtn = document.querySelector('button[aria-label="Link"]');
    linkBtn.click();
    
    // Wait for the timeout in implementation
    await new Promise(resolve => setTimeout(resolve, 20));

    // Click outside (on body)
    document.body.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    expect(document.querySelector('[role="dialog"]')).toBeNull();
  });

  test('traps focus inside prompt dialog', async () => {
    document.body.appendChild(toolbar.element);
    const linkBtn = document.querySelector('button[aria-label="Link"]');
    linkBtn.click();
    
    // Wait for prompt setup
    await new Promise(resolve => setTimeout(resolve, 20));
    
    const dialog = document.querySelector('[role="dialog"]');
    const input = dialog.querySelector('input');
    const cancelBtn = dialog.querySelectorAll('button')[1];
    
    // Simulate Tab on last element (Cancel)
    cancelBtn.focus();
    const event = new KeyboardEvent('keydown', { key: 'Tab', bubbles: true });
    vi.spyOn(event, 'preventDefault');
    vi.spyOn(input, 'focus');
    
    dialog.dispatchEvent(event); // Dispatch on dialog (bubbles) or button
    // The listener is on promptOverlay (dialog)
    
    expect(event.preventDefault).toHaveBeenCalled();
    expect(input.focus).toHaveBeenCalled();
    
    // Simulate Shift+Tab on first element (Input)
    input.focus();
    const shiftTab = new KeyboardEvent('keydown', { key: 'Tab', shiftKey: true, bubbles: true });
    vi.spyOn(shiftTab, 'preventDefault');
    vi.spyOn(cancelBtn, 'focus');
    
    dialog.dispatchEvent(shiftTab);
    
    expect(shiftTab.preventDefault).toHaveBeenCalled();
    expect(cancelBtn.focus).toHaveBeenCalled();
  });
});
