import { describe, it, expect } from 'vitest';
import { normalizeHTML, sanitizeHTML } from '../src/normalizer.js';
import { CLASS_MAP } from '../src/class-map.js';

describe('normalizeHTML', () => {
  it('adds Tailwind classes to bare block elements', () => {
    const input = '<h2>Title</h2><p>Text</p>';
    const result = normalizeHTML(input);
    expect(result).toContain(`class="${CLASS_MAP.h2}"`);
    expect(result).toContain(`class="${CLASS_MAP.p}"`);
  });

  it('flattens deeply nested spans and divs', () => {
    const html = '<div><span><p>Text</p></span></div>';
    const normalized = normalizeHTML(html);
    expect(normalized).toBe(`<p class="${CLASS_MAP.p}">Text</p>`);
  });

  it('preserves strong/em while flattening parents', () => {
    const html = '<div style="color:red"><span><strong>Bold</strong></span></div>';
    const normalized = normalizeHTML(html);
    expect(normalized).toBe(`<p class="${CLASS_MAP.p}"><strong class="${CLASS_MAP.strong}">Bold</strong></p>`);
  });

  it('replaces existing classes with correct Tailwind classes', () => {
    const input = '<p class="old-class">Text</p>';
    const result = normalizeHTML(input);
    expect(result).toContain(`class="${CLASS_MAP.p}"`);
    expect(result).not.toContain('old-class');
  });

  it('normalizes <b> to <strong> and <i> to <em>', () => {
    const input = '<p><b>bold</b> and <i>italic</i></p>';
    const result = normalizeHTML(input);
    expect(result).toContain('<strong');
    expect(result).toContain('<em');
    expect(result).not.toContain('<b>');
    expect(result).not.toContain('<i>');
  });

  it('normalizes inline element classes', () => {
    const input = '<p><strong>bold</strong></p>';
    const result = normalizeHTML(input);
    expect(result).toContain(`class="${CLASS_MAP.strong}"`);
  });

  it('wraps bare text nodes in <p>', () => {
    const input = 'bare text';
    const result = normalizeHTML(input);
    expect(result).toContain('<p');
    expect(result).toContain('bare text');
  });

  it('handles nested lists', () => {
    const input = '<ul><li>Item 1</li><li>Item 2</li></ul>';
    const input2 = `<ul><li class="${CLASS_MAP.li}">Item 1</li><li class="${CLASS_MAP.li}">Item 2</li></ul>`;
    const result = normalizeHTML(input);
    expect(result).toContain(`class="${CLASS_MAP.ul}"`);
    expect(result).toContain(`class="${CLASS_MAP.li}"`);
  });
});

describe('sanitizeHTML', () => {
  it('strips <script> tags', () => {
    const input = '<p>Hello</p><script>alert("xss")</script>';
    const result = sanitizeHTML(input);
    expect(result).not.toContain('script');
  });

  it('strips event handlers', () => {
    const input = '<p onclick="alert(1)">Click</p>';
    const result = sanitizeHTML(input);
    expect(result).not.toContain('onclick');
  });

  it('strips style attributes', () => {
    const input = '<p style="color:red">Styled</p>';
    const result = sanitizeHTML(input);
    expect(result).not.toContain('style=');
  });

  it('preserves href on links', () => {
    const input = '<a href="https://example.com">Link</a>';
    const result = sanitizeHTML(input);
    expect(result).toContain('href="https://example.com"');
  });

  it('preserves src and alt on images', () => {
    const input = '<img src="photo.jpg" alt="Photo">';
    const result = sanitizeHTML(input);
    expect(result).toContain('src="photo.jpg"');
    expect(result).toContain('alt="Photo"');
    expect(result).toContain('<p'); // Root level img is wrapped in p
  });
});
