import { describe, it, expect, beforeEach } from 'vitest';
import {
  getClosestBlock,
  findParentTag,
  getNodePath,
  resolveNodePath,
  BLOCK_TAGS,
} from '../src/selection.js';

describe('selection utilities', () => {
  let root;

  beforeEach(() => {
    root = document.createElement('div');
    document.body.appendChild(root);
  });

  describe('BLOCK_TAGS', () => {
    it('includes all block-level tags', () => {
      expect(BLOCK_TAGS).toContain('p');
      expect(BLOCK_TAGS).toContain('h1');
      expect(BLOCK_TAGS).toContain('li');
      expect(BLOCK_TAGS).toContain('blockquote');
      expect(BLOCK_TAGS).toContain('pre');
    });
  });

  describe('getClosestBlock', () => {
    it('returns the closest block ancestor', () => {
      root.innerHTML = '<p>hello <strong>world</strong></p>';
      const strong = root.querySelector('strong');
      const textNode = strong.firstChild;
      expect(getClosestBlock(textNode, root).tagName).toBe('P');
    });

    it('returns null if node is outside root', () => {
      const orphan = document.createTextNode('orphan');
      expect(getClosestBlock(orphan, root)).toBeNull();
    });
  });

  describe('findParentTag', () => {
    it('finds parent with matching tag name', () => {
      root.innerHTML = '<p><strong><em>text</em></strong></p>';
      const text = root.querySelector('em').firstChild;
      const result = findParentTag(text, 'strong', root);
      expect(result).not.toBeNull();
      expect(result.tagName).toBe('STRONG');
    });

    it('returns null when tag not found', () => {
      root.innerHTML = '<p><em>text</em></p>';
      const text = root.querySelector('em').firstChild;
      expect(findParentTag(text, 'strong', root)).toBeNull();
    });
  });

  describe('getNodePath / resolveNodePath', () => {
    it('round-trips a node path', () => {
      root.innerHTML = '<p>hello</p><p>world <strong>bold</strong></p>';
      const boldText = root.querySelector('strong').firstChild;
      const path = getNodePath(root, boldText);
      const resolved = resolveNodePath(root, path);
      expect(resolved).toBe(boldText);
    });
  });
});
