import { describe, it, expect, beforeEach } from 'vitest';
import { RichTextEditor } from '../src/editor.js';

describe('Multi-instance Isolation (§1.2)', () => {
  let container1, container2;

  beforeEach(() => {
    document.body.innerHTML = '';
    container1 = document.createElement('div');
    container1.id = 'editor1';
    container2 = document.createElement('div');
    container2.id = 'editor2';
    document.body.appendChild(container1);
    document.body.appendChild(container2);
  });

  it('maintains independent class maps across instances', () => {
    // Editor 1 with default styling
    const editor1 = new RichTextEditor('#editor1');
    
    // Editor 2 with customized paragraph styling
    const editor2 = new RichTextEditor('#editor2', {
      classMap: {
        p: 'custom-p-class'
      }
    });

    editor1.setHTML('<p>Hello 1</p>');
    editor2.setHTML('<p>Hello 2</p>');

    // Verify Editor 1 has DEFAULT classes
    expect(editor1.getHTML()).toContain('text-base leading-7');
    expect(editor1.getHTML()).not.toContain('custom-p-class');

    // Verify Editor 2 has CUSTOM classes
    expect(editor2.getHTML()).toContain('custom-p-class');
    expect(editor2.getHTML()).not.toContain('text-base leading-7');
  });

  it('does not leak configuration during command execution', () => {
    const editor1 = new RichTextEditor('#editor1');
    const editor2 = new RichTextEditor('#editor2', {
      classMap: {
        strong: 'custom-bold'
      }
    });

    // Manually trigger a bold command (mocking selection for JSDOM)
    editor1.setHTML('<p><strong>text1</strong></p>');
    editor2.setHTML('<p><strong>text2</strong></p>');

    expect(editor1.getHTML()).toContain('font-bold');
    expect(editor2.getHTML()).toContain('custom-bold');
    expect(editor2.getHTML()).not.toContain('font-bold');
  });

  it('independently normalizes headings', () => {
    const editor1 = new RichTextEditor('#editor1');
    const editor2 = new RichTextEditor('#editor2', {
      classMap: {
        h1: 'h1-custom'
      }
    });

    editor1.setHTML('<h1>Title 1</h1>');
    editor2.setHTML('<h1>Title 2</h1>');

    expect(editor1.getHTML()).toContain('text-4xl font-bold');
    expect(editor2.getHTML()).toContain('h1-custom');
  });
});
