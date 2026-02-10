import { describe, it, expect } from 'vitest';
import { sanitizeHTML } from '../src/normalizer.js';

describe('Sanitizer Security (§3.1, §3.2)', () => {
  
  it('removes dangerous tags entirely', () => {
    const input = '<div>Safe</div><script>alert(1)</script><style>body{color:red}</style><iframe></iframe>';
    const clean = sanitizeHTML(input);
    expect(clean).toContain('Safe');
    expect(clean).toContain('<p');
    expect(clean).not.toContain('<script');
    expect(clean).not.toContain('<style');
    expect(clean).not.toContain('<iframe');
  });

  it('strips all event handlers (on*)', () => {
    const input = '<p onclick="alert(1)" onmouseover="evil()">Text</p><img src="x" onerror="alert(1)">';
    const clean = sanitizeHTML(input);
    expect(clean).not.toContain('onclick');
    expect(clean).not.toContain('onmouseover');
    expect(clean).not.toContain('onerror');
  });

  it('blocks javascript: URLs in links', () => {
    const input = '<a href="javascript:alert(1)">Evil Link</a><a href="https://google.com">Safe Link</a>';
    const clean = sanitizeHTML(input);
    expect(clean).toContain('https://google.com');
    expect(clean).not.toContain('javascript:');
    expect(clean).toContain('Evil Link');
  });

  it('allows data: URLs for images but blocks them for links', () => {
    const input = '<img src="data:image/png;base64,..." alt="Image"><a href="data:text/html,...">Link</a>';
    const clean = sanitizeHTML(input);
    expect(clean).toContain('src="data:image/png;base64');
    expect(clean).not.toContain('href="data:text/html');
  });

  it('handles nested bypass attempts', () => {
    const input = '<scr<script>ipt>alert(1)</script>';
    const clean = sanitizeHTML(input);
    expect(clean).not.toContain('<script');
    expect(clean).not.toContain('</script');
  });

  it('maintains structural normalization with standard content', () => {
    const input = '<b>Bold</b><i>Italic</i><div>Block</div>';
    const clean = sanitizeHTML(input);
    expect(clean).toContain('<strong');
    expect(clean).toContain('<em');
    expect(clean).toContain('Block');
    expect(clean).toContain('<p'); // div converted to content wrapped in p
  });
});
