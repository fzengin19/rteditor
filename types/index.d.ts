export interface EditorOptions {
  /** Toolbar button names or '|' for separators. */
  toolbar?: string[];
  /** Placeholder text shown when the editor is empty. */
  placeholder?: string;
  /** Initial HTML content to load into the editor. */
  initialHTML?: string;
  /** Callback triggered on every content change. */
  onChange?: (html: string) => void;
  /** Override default Tailwind class mappings for specific tags. */
  classMap?: Partial<Record<string, string>>;
}

export class RichTextEditor {
  /**
   * Create a new RTEditor instance.
   * @param target - CSS selector or DOM element to attach to.
   * @param options - Editor configuration.
   */
  constructor(target: string | HTMLElement, options?: EditorOptions);

  /** Get the current HTML content (normalized to Tailwind classes). */
  getHTML(): string;

  /** Get raw (un-normalized) HTML from the editor. */
  getRawHTML(): string;

  /** Set HTML content (will be normalized). */
  setHTML(html: string): void;

  /** Get plain text content. */
  getText(): string;

  /** Execute a formatting command programmatically. */
  exec(command: string, ...args: any[]): void;

  /** Focus the editor. */
  focus(): void;

  /** Check if the editor is empty. */
  isEmpty(): boolean;

  /** Destroy the editor instance and clean up DOM/listeners. */
  destroy(): void;
}

/** The default set of toolbar buttons. */
export const DEFAULT_TOOLBAR: string[];

/** The central mapping of HTML tags to Tailwind CSS v4 utility classes. */
export const CLASS_MAP: Record<string, string>;

/** Get the Tailwind classes for a specific tag. */
export function getClassFor(tag: string, classMap?: Record<string, string>): string;

/** Normalize an HTML string by applying Tailwind classes and fixing tags. */
export function normalizeHTML(html: string, classMap?: Record<string, string>): string;

/** Sanitize and normalize HTML content (e.g. from paste). */
export function sanitizeHTML(html: string, classMap?: Record<string, string>): string;
