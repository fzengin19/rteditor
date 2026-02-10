/**
 * Handles visual resizing of images within the editor.
 * Creates handles on corners and tracks drag events.
 */
export class ImageResizer {
  #img = null;
  #overlay = null;
  #handles = [];
  #isResizing = false;
  #startWidth = 0;
  #startX = 0;
  #aspectRatio = 1;

  constructor(img) {
    this.#img = img;
    this.#aspectRatio = img.naturalWidth / img.naturalHeight || 1;
    this.#createOverlay();
  }

  #attachListeners() {
    // Listeners are attached to handles in #createOverlay
  }

  #createOverlay() {
    this.#overlay = document.createElement('div');
    this.#overlay.className = 'absolute border-2 border-blue-500 pointer-events-none z-[50]';
    this.#updateOverlayPosition();

    const handlePositions = ['bottom-right']; // Start with just one for simplicity/reliability
    for (const pos of handlePositions) {
      const handle = document.createElement('div');
      handle.className = 'absolute w-3 h-3 bg-blue-600 border border-white rounded-full pointer-events-auto cursor-nwse-resize transform translate-x-1/2 translate-y-1/2';
      handle.style.bottom = '0';
      handle.style.right = '0';
      
      handle.addEventListener('mousedown', (e) => this.#onMouseDown(e));
      this.#overlay.appendChild(handle);
      this.#handles.push(handle);
    }

    // Insert overlay into the editor root (it needs to be relative)
    const root = this.#img.closest('[contenteditable]');
    if (root) {
      root.style.position = 'relative'; // Ensure root is relative
      root.appendChild(this.#overlay);
    }
  }

  #updateOverlayPosition() {
    const rect = this.#img.getBoundingClientRect();
    const rootRect = this.#img.closest('[contenteditable]').getBoundingClientRect();

    this.#overlay.style.top = `${rect.top - rootRect.top}px`;
    this.#overlay.style.left = `${rect.left - rootRect.left}px`;
    this.#overlay.style.width = `${rect.width}px`;
    this.#overlay.style.height = `${rect.height}px`;
  }

  #onMouseDown(e) {
    e.preventDefault();
    e.stopPropagation();
    this.#isResizing = true;
    this.#startX = e.clientX;
    this.#startWidth = this.#img.clientWidth;

    const onMouseMove = (moveEvent) => this.#onMouseMove(moveEvent);
    const onMouseUp = () => {
      this.#isResizing = false;
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
      // Trigger change in editor
      this.#img.closest('[contenteditable]').dispatchEvent(new Event('input', { bubbles: true }));
    };

    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
  }

  #onMouseMove(e) {
    if (!this.#isResizing) return;
    const delta = e.clientX - this.#startX;
    const newWidth = Math.max(50, this.#startWidth + delta);
    
    this.#img.style.width = `${newWidth}px`;
    this.#img.style.height = 'auto'; // Maintain aspect ratio
    this.#updateOverlayPosition();
  }

  destroy() {
    if (this.#overlay && this.#overlay.parentNode) {
      this.#overlay.parentNode.removeChild(this.#overlay);
    }
  }
}
