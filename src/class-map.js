/**
 * Tailwind CSS v4 class mapping for all editor-generated HTML elements.
 * Restores proper rich-text appearance in Tailwind v4 preflight environments.
 */
export const CLASS_MAP = {

  // Block elements
  p:          'text-base leading-7 my-4',
  h1:         'text-4xl font-bold mt-8 mb-4 leading-tight',
  h2:         'text-3xl font-semibold mt-8 mb-3 leading-snug',
  h3:         'text-2xl font-semibold mt-6 mb-3 leading-snug',
  h4:         'text-xl font-semibold mt-4 mb-2',

  // Lists
  ul:         'list-disc pl-6 my-4 space-y-1',
  ol:         'list-decimal pl-6 my-4 space-y-1',
  li:         'text-base leading-7',

  // Quote & code blocks
  blockquote: 'border-l-4 border-gray-300 pl-4 py-1 my-4 italic text-gray-600',
  pre:        'bg-gray-900 text-gray-100 p-4 rounded-lg overflow-x-auto font-mono text-sm my-4',
  code:       'font-mono text-sm bg-gray-100 px-1.5 py-0.5 rounded',

  // Inline formatting
  strong:     'font-bold',
  em:         'italic',
  u:          'underline decoration-2 underline-offset-2',
  s:          'line-through',

  // Links & media
  a:          'text-blue-600 underline decoration-1 underline-offset-2',
  img:        'max-w-full h-auto rounded-lg my-4',
};

/**
 * Get Tailwind classes for a given tag name (case-insensitive).
 * Returns empty string for unknown tags.
 */
export function getClassFor(tagName, classMap = CLASS_MAP) {
  return classMap[tagName.toLowerCase()] || '';
}
