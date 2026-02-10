import { saveSelection, restoreSelection } from './selection.js';

export class History {
  #stack = [];
  #index = -1;
  #root;
  #maxSize;

  constructor(root, maxSize = 100) {
    this.#root = root;
    this.#maxSize = maxSize;
  }

  get length() {
    return this.#stack.length;
  }

  get canUndo() {
    return this.#index > 0;
  }

  get canRedo() {
    return this.#index < this.#stack.length - 1;
  }

  /** Save current state as a snapshot. */
  push() {
    // Discard future states if we're not at the end
    this.#stack = this.#stack.slice(0, this.#index + 1);

    const html = this.#root.innerHTML;
    const selection = saveSelection(this.#root);
    
    let entry;
    const prev = this.#stack[this.#index];

    if (prev && prev.fullHTML) {
      // Calculate delta from previous state to save memory
      const delta = this.#calculateDelta(prev.fullHTML, html);
      entry = { delta, selection };
    } else {
      // Store full HTML for the first entry or periodically
      entry = { fullHTML: html, selection };
    }

    this.#stack.push(entry);

    // Enforce max size
    if (this.#stack.length > this.#maxSize) {
      this.#stack.shift();
    } else {
      this.#index++;
    }
  }

  /** Restore previous state. */
  undo() {
    if (!this.canUndo) return;
    this.#index--;
    this.#restore(this.#index);
  }

  /** Restore next state. */
  redo() {
    if (!this.canRedo) return;
    this.#index++;
    this.#restore(this.#index);
  }

  #restore(index) {
    const entry = this.#stack[index];
    let html = entry.fullHTML;

    if (!html) {
      // Reconstruct from delta (assumes previous was full or reconstructed)
      // For simplicity in this professional refinement, we ensure we can always 
      // get the full HTML by reconstructing up from the nearest full snapshot.
      html = this.#reconstructHTML(index);
    }

    this.#root.innerHTML = html;
    if (entry.selection) {
      restoreSelection(this.#root, entry.selection);
    }
  }

  #calculateDelta(oldStr, newStr) {
    let start = 0;
    while (start < oldStr.length && start < newStr.length && oldStr[start] === newStr[start]) {
      start++;
    }

    let endOld = oldStr.length - 1;
    let endNew = newStr.length - 1;
    while (endOld >= start && endNew >= start && oldStr[endOld] === newStr[endNew]) {
      endOld--;
      endNew--;
    }

    return {
      start,
      endOld: endOld + 1,
      text: newStr.slice(start, endNew + 1)
    };
  }

  #reconstructHTML(index) {
    // Traverse back to find the nearest full snapshot
    let currentHTML = '';
    let i = index;
    const chain = [];
    
    while (i >= 0) {
      if (this.#stack[i].fullHTML) {
        currentHTML = this.#stack[i].fullHTML;
        break;
      }
      chain.unshift(this.#stack[i].delta);
      i--;
    }

    // Apply deltas forward
    for (const delta of chain) {
      currentHTML = currentHTML.slice(0, delta.start) + delta.text + currentHTML.slice(delta.endOld);
    }
    
    return currentHTML;
  }
}
