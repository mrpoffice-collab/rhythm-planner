import DOMPurify from 'dompurify';

/**
 * Sanitizes user-provided HTML to prevent XSS attacks
 * @param dirty - Potentially unsafe HTML string
 * @returns Sanitized HTML safe for rendering
 */
export const sanitizeHtml = (dirty: string): string => {
  return DOMPurify.sanitize(dirty, {
    ALLOWED_TAGS: ['b', 'i', 'em', 'strong', 'br'],
    ALLOWED_ATTR: []
  });
};

/**
 * Sanitizes plain text by escaping HTML entities
 * @param text - Plain text that might contain HTML characters
 * @returns Escaped text safe for rendering
 */
export const sanitizeText = (text: string): string => {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
};
