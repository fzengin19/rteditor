import { describe, it, expect, beforeEach } from 'vitest';
import { History } from '../src/history.js';

describe('History', () => {
  let root, history;

  beforeEach(() => {
    root = document.createElement('div');
    root.setAttribute('contenteditable', 'true');
    root.innerHTML = '<p>initial</p>';
    document.body.innerHTML = '';
    document.body.appendChild(root);
    history = new History(root);
    history.push(); // save initial state
  });

  it('saves snapshots', () => {
    expect(history.length).toBe(1);
    root.innerHTML = '<p>changed</p>';
    history.push();
    expect(history.length).toBe(2);
  });

  it('undo restores previous state', () => {
    root.innerHTML = '<p>changed</p>';
    history.push();
    history.undo();
    expect(root.innerHTML).toBe('<p>initial</p>');
  });

  it('redo restores next state', () => {
    root.innerHTML = '<p>changed</p>';
    history.push();
    history.undo();
    history.redo();
    expect(root.innerHTML).toBe('<p>changed</p>');
  });

  it('push after undo discards future states', () => {
    root.innerHTML = '<p>v2</p>';
    history.push();
    root.innerHTML = '<p>v3</p>';
    history.push();
    history.undo(); // back to v2
    root.innerHTML = '<p>v4</p>';
    history.push();
    expect(history.length).toBe(3); // initial, v2, v4
    history.undo();
    expect(root.innerHTML).toBe('<p>v2</p>');
  });

  it('respects max size', () => {
    history = new History(root, 3);
    history.push(); // 1
    root.innerHTML = '<p>a</p>'; history.push(); // 2
    root.innerHTML = '<p>b</p>'; history.push(); // 3
    root.innerHTML = '<p>c</p>'; history.push(); // overwrites oldest
    expect(history.length).toBe(3);
  });

  it('canUndo / canRedo report correctly', () => {
    expect(history.canUndo).toBe(false);
    root.innerHTML = '<p>changed</p>';
    history.push();
    expect(history.canUndo).toBe(true);
    expect(history.canRedo).toBe(false);
    history.undo();
    expect(history.canRedo).toBe(true);
  });
});
