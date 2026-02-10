import { describe, it, expect } from 'vitest';
import { CLASS_MAP, getClassFor } from '../src/class-map.js';

describe('CLASS_MAP', () => {
  it('has classes for all block elements', () => {
    const blocks = ['p', 'h1', 'h2', 'h3', 'h4', 'ul', 'ol', 'li', 'blockquote', 'pre'];
    for (const tag of blocks) {
      expect(CLASS_MAP[tag], `Missing class for <${tag}>`).toBeDefined();
      expect(CLASS_MAP[tag].length).toBeGreaterThan(0);
    }
  });

  it('has classes for all inline elements', () => {
    const inlines = ['strong', 'em', 'u', 's', 'code', 'a'];
    for (const tag of inlines) {
      expect(CLASS_MAP[tag], `Missing class for <${tag}>`).toBeDefined();
    }
  });

  it('has classes for media elements', () => {
    expect(CLASS_MAP.img).toBeDefined();
  });

  it('getClassFor returns class string for known tag', () => {
    expect(getClassFor('p')).toBe(CLASS_MAP.p);
    expect(getClassFor('P')).toBe(CLASS_MAP.p); // case insensitive
  });

  it('getClassFor returns empty string for unknown tag', () => {
    expect(getClassFor('div')).toBe('');
    expect(getClassFor('span')).toBe('');
  });
});
