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

    this.#stack.push({
      html: this.#root.innerHTML,
      selection: saveSelection(this.#root),
    });

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
    this.#restore(this.#stack[this.#index]);
  }

  /** Restore next state. */
  redo() {
    if (!this.canRedo) return;
    this.#index++;
    this.#restore(this.#stack[this.#index]);
  }

  #restore(snapshot) {
    this.#root.innerHTML = snapshot.html;
    if (snapshot.selection) {
      restoreSelection(this.#root, snapshot.selection);
    }
  }
}
