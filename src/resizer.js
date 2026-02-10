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
      handle.className = `absolute w-3 h-3 bg-blue-600 border border-white rounded-full pointer-events-auto z-[60] transform translate-x-1/2 translate-y-1/2 focus:outline-none focus:ring-2 focus:ring-offset-1 focus:ring-blue-400`;
      
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

      // Accessibility
      handle.tabIndex = 0;
      handle.setAttribute('role', 'slider');
      handle.setAttribute('aria-label', `Resize image from ${pos.replace('-', ' ')}`);
      handle.setAttribute('aria-valuemin', '50');
      handle.setAttribute('aria-valuenow', this.#img.clientWidth.toString());
      
      // Support mouse, touch, and keyboard
      handle.addEventListener('mousedown', (e) => this.#onStart(e, pos));
      handle.addEventListener('touchstart', (e) => this.#onStart(e, pos), { passive: false });
      handle.addEventListener('keydown', (e) => this.#onKeyDown(e, pos));
      
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
    this.#applySize(newWidth);
  }

  #onKeyDown(e, pos) {
    const step = e.shiftKey ? 50 : 10;
    let delta = 0;

    if (e.key === 'ArrowRight') delta = step;
    if (e.key === 'ArrowLeft') delta = -step;
    if (e.key === 'ArrowDown') delta = step; // Also support vertical arrows for width scaling
    if (e.key === 'ArrowUp') delta = -step;

    if (delta === 0) return;

    e.preventDefault();
    e.stopPropagation();

    // Invert delta if using left-side handles
    if (pos.includes('left')) {
      delta = -delta;
    }

    const newWidth = Math.max(50, this.#img.clientWidth + delta);
    this.#applySize(newWidth);

    // Trigger input event to save history
    const root = this.#img.closest('[contenteditable]');
    if (root) {
      root.dispatchEvent(new Event('input', { bubbles: true }));
    }
  }

  #applySize(width) {
    this.#img.style.width = `${width}px`;
    this.#img.style.height = 'auto'; // Maintain aspect ratio
    this.#updateOverlayPosition();
    
    // Update ARIA values on handles
    for (const handle of this.#handles) {
      handle.setAttribute('aria-valuenow', width.toString());
    }
  }

  destroy() {
    if (this.#overlay && this.#overlay.parentNode) {
      this.#overlay.parentNode.removeChild(this.#overlay);
    }
  }
}
