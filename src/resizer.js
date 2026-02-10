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
  #activeHandle = null;

  constructor(img) {
    this.#img = img;
    this.#createOverlay();
    
    // Periodically update position if the editor has layout shifts,
    // though usually handled by resize/scroll listeners if we added them.
  }

  #createOverlay() {
    this.#overlay = document.createElement('div');
    this.#overlay.className = 'absolute border-2 border-blue-500 pointer-events-none z-[50]';
    this.#overlay.setAttribute('data-rt-resizer', 'true');
    this.#updateOverlayPosition();

    const handlePositions = ['top-left', 'top-right', 'bottom-left', 'bottom-right'];
    for (const pos of handlePositions) {
      const handle = document.createElement('div');
      handle.className = `absolute w-3 h-3 bg-blue-600 border border-white rounded-full pointer-events-auto z-[60] transform translate-x-1/2 translate-y-1/2`;
      
      // Position the handles
      if (pos.includes('top')) handle.style.top = '-6px';
      if (pos.includes('bottom')) handle.style.bottom = '-6px';
      if (pos.includes('left')) handle.style.left = '-6px';
      if (pos.includes('right')) handle.style.right = '-6px';

      // Set cursor
      if (pos === 'top-left' || pos === 'bottom-right') handle.className += ' cursor-nwse-resize';
      else handle.className += ' cursor-nesw-resize';
      
      handle.setAttribute('data-rt-resizer-handle', 'true');
      handle.setAttribute('data-rt-resizer-pos', pos);
      
      // Support both mouse and touch
      handle.addEventListener('mousedown', (e) => this.#onStart(e, pos));
      handle.addEventListener('touchstart', (e) => this.#onStart(e, pos), { passive: false });
      
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
    const root = this.#img.closest('[contenteditable]');
    if (!root) return;

    // Use offset-based positioning relative to the [relative] editor root
    let top = 0;
    let left = 0;
    let current = this.#img;
    
    while (current && current !== root) {
      top += current.offsetTop;
      left += current.offsetLeft;
      current = current.offsetParent;
    }

    this.#overlay.style.top = `${top}px`;
    this.#overlay.style.left = `${left}px`;
    this.#overlay.style.width = `${this.#img.offsetWidth}px`;
    this.#overlay.style.height = `${this.#img.offsetHeight}px`;
  }

  #getClientX(e) {
    if (e.touches && e.touches.length > 0) {
      return e.touches[0].clientX;
    }
    return e.clientX;
  }

  #onStart(e, pos) {
    // Only prevent default for touch to avoid scrolling, 
    // for mouse it might interfere with focus if not careful but generally okay here
    if (e.type === 'touchstart') e.preventDefault();
    e.stopPropagation();

    this.#isResizing = true;
    this.#activeHandle = pos;
    this.#startX = this.#getClientX(e);
    this.#startWidth = this.#img.clientWidth;

    const onMove = (moveEvent) => this.#onMove(moveEvent);
    const onEnd = () => {
      this.#isResizing = false;
      this.#activeHandle = null;
      
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onEnd);
      document.removeEventListener('touchmove', onMove);
      document.removeEventListener('touchend', onEnd);
      
      // Dispatch input to trigger changes
      const root = this.#img.closest('[contenteditable]');
      if (root) {
        root.dispatchEvent(new Event('input', { bubbles: true }));
      }
    };

    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onEnd);
    document.addEventListener('touchmove', onMove, { passive: false });
    document.addEventListener('touchend', onEnd);
  }

  #onMove(e) {
    if (!this.#isResizing) return;
    if (e.type === 'touchmove') e.preventDefault(); // Prevent scroll while resizing

    let delta = this.#getClientX(e) - this.#startX;
    
    // If dragging from the left side, moving left (negative delta) should increase width
    if (this.#activeHandle?.includes('left')) {
      delta = -delta;
    }

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
