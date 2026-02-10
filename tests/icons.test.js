import { describe, it, expect } from 'vitest';
import { ICONS } from '../src/icons.js';

describe('ICONS', () => {
  it('contains all required toolbar icons', () => {
    const required = [
      'bold', 'italic', 'underline', 'strikethrough',
      'heading', 'unorderedList', 'orderedList',
      'blockquote', 'codeBlock', 'link', 'image',
      'undo', 'redo', 'clearFormat', 'chevronDown'
    ];
    for (const key of required) {
      expect(ICONS[key], `Missing icon: ${key}`).toBeDefined();
      expect(ICONS[key]).toContain('<svg');
      expect(ICONS[key]).toContain('</svg>');
    }
  });

  it('uses consistent stroke attributes', () => {
    expect(ICONS.bold).toContain('stroke="currentColor"');
    expect(ICONS.bold).toContain('stroke-width="2"');
  });
});
