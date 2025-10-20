/**
 * Safe DOM Manipulation Utilities
 *
 * This module provides secure alternatives to innerHTML and other potentially
 * unsafe DOM manipulation methods. All functions sanitize input to prevent XSS attacks.
 *
 * @module domUtils
 */

/**
 * Escapes HTML special characters to prevent XSS
 * @param {string} str - String to escape
 * @returns {string} Escaped string
 */
function escapeHtml(str) {
  if (typeof str !== 'string') return '';

  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

/**
 * Safely sets text content of an element
 * @param {HTMLElement} element - Target element
 * @param {string} text - Text to set
 */
function setText(element, text) {
  if (!element) return;
  element.textContent = text || '';
}

/**
 * Safely creates an element with text content
 * @param {string} tagName - HTML tag name
 * @param {string} text - Text content
 * @param {Object} attributes - Optional attributes to set
 * @returns {HTMLElement} Created element
 */
function createElement(tagName, text = '', attributes = {}) {
  const element = document.createElement(tagName);

  if (text) {
    element.textContent = text;
  }

  for (const [key, value] of Object.entries(attributes)) {
    if (key === 'className') {
      element.className = value;
    } else if (key === 'style' && typeof value === 'object') {
      Object.assign(element.style, value);
    } else if (key.startsWith('data-')) {
      element.setAttribute(key, value);
    } else {
      element[key] = value;
    }
  }

  return element;
}

/**
 * Safely appends multiple children to a parent element
 * @param {HTMLElement} parent - Parent element
 * @param {...HTMLElement} children - Child elements to append
 */
function appendChildren(parent, ...children) {
  if (!parent) return;

  for (const child of children) {
    if (child instanceof HTMLElement || child instanceof Text) {
      parent.appendChild(child);
    }
  }
}

/**
 * Clears all children from an element
 * @param {HTMLElement} element - Element to clear
 */
function clearElement(element) {
  if (!element) return;

  while (element.firstChild) {
    element.removeChild(element.firstChild);
  }
}

/**
 * Safely replaces element content with new children
 * @param {HTMLElement} element - Target element
 * @param {...HTMLElement} children - New children
 */
function replaceChildren(element, ...children) {
  if (!element) return;

  clearElement(element);
  appendChildren(element, ...children);
}

/**
 * Creates a table row with safe cell content
 * @param {Array<string|HTMLElement>} cells - Cell contents (strings will be escaped)
 * @param {string} cellTag - 'td' or 'th'
 * @param {Object} rowAttributes - Optional row attributes
 * @returns {HTMLTableRowElement} Created row
 */
function createTableRow(cells, cellTag = 'td', rowAttributes = {}) {
  const row = createElement('tr', '', rowAttributes);

  for (const cellContent of cells) {
    const cell = document.createElement(cellTag);

    if (typeof cellContent === 'string') {
      cell.textContent = cellContent;
    } else if (cellContent instanceof HTMLElement) {
      cell.appendChild(cellContent);
    }

    row.appendChild(cell);
  }

  return row;
}

/**
 * Creates a list with safe item content
 * @param {Array<string|HTMLElement>} items - List items
 * @param {string} listType - 'ul' or 'ol'
 * @param {Object} listAttributes - Optional list attributes
 * @returns {HTMLUListElement|HTMLOListElement} Created list
 */
function createList(items, listType = 'ul', listAttributes = {}) {
  const list = createElement(listType, '', listAttributes);

  for (const itemContent of items) {
    const li = document.createElement('li');

    if (typeof itemContent === 'string') {
      li.textContent = itemContent;
    } else if (itemContent instanceof HTMLElement) {
      li.appendChild(itemContent);
    }

    list.appendChild(li);
  }

  return list;
}

/**
 * Creates a button element with safe text
 * @param {string} text - Button text
 * @param {Function} onClick - Click handler
 * @param {Object} attributes - Optional attributes
 * @returns {HTMLButtonElement} Created button
 */
function createButton(text, onClick, attributes = {}) {
  const button = createElement('button', text, attributes);

  if (onClick && typeof onClick === 'function') {
    button.addEventListener('click', onClick);
  }

  return button;
}

/**
 * Creates a link element with safe text
 * @param {string} text - Link text
 * @param {string} href - Link URL
 * @param {Object} attributes - Optional attributes
 * @returns {HTMLAnchorElement} Created link
 */
function createLink(text, href, attributes = {}) {
  const link = createElement('a', text, {
    href: href || '#',
    ...attributes
  });

  return link;
}

/**
 * Creates a div with class and optional content
 * @param {string} className - CSS class name(s)
 * @param {string|HTMLElement|Array<HTMLElement>} content - Content
 * @returns {HTMLDivElement} Created div
 */
function createDiv(className, content = null) {
  const div = createElement('div', '', { className });

  if (typeof content === 'string') {
    div.textContent = content;
  } else if (content instanceof HTMLElement) {
    div.appendChild(content);
  } else if (Array.isArray(content)) {
    appendChildren(div, ...content);
  }

  return div;
}

/**
 * Creates a span with class and text content
 * @param {string} className - CSS class name(s)
 * @param {string} text - Text content
 * @returns {HTMLSpanElement} Created span
 */
function createSpan(className, text) {
  return createElement('span', text, { className });
}

/**
 * Safely sets HTML from a trusted template string
 * WARNING: Only use with trusted, sanitized HTML
 * @param {HTMLElement} element - Target element
 * @param {string} html - HTML string (MUST be sanitized)
 */
function setInnerHTML(element, html) {
  if (!element) return;

  // Log warning in development
  if (process.env.NODE_ENV === 'development') {
    console.warn('setInnerHTML used - ensure HTML is sanitized:', element);
  }

  element.innerHTML = html;
}

/**
 * Creates a text node
 * @param {string} text - Text content
 * @returns {Text} Text node
 */
function createTextNode(text) {
  return document.createTextNode(text || '');
}

/**
 * Builds complex HTML structure using builder pattern
 * @param {string} tagName - Root element tag
 * @returns {ElementBuilder} Builder instance
 */
function buildElement(tagName) {
  return new ElementBuilder(tagName);
}

/**
 * ElementBuilder class for fluent API
 */
class ElementBuilder {
  constructor(tagName) {
    this.element = document.createElement(tagName);
  }

  text(content) {
    this.element.textContent = content;
    return this;
  }

  attr(name, value) {
    if (name === 'className') {
      this.element.className = value;
    } else if (name.startsWith('data-')) {
      this.element.setAttribute(name, value);
    } else {
      this.element[name] = value;
    }
    return this;
  }

  addClass(className) {
    this.element.classList.add(className);
    return this;
  }

  style(property, value) {
    this.element.style[property] = value;
    return this;
  }

  child(...children) {
    appendChildren(this.element, ...children);
    return this;
  }

  on(event, handler) {
    this.element.addEventListener(event, handler);
    return this;
  }

  build() {
    return this.element;
  }
}

// Export for CommonJS (Node.js) and browser
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    escapeHtml,
    setText,
    createElement,
    appendChildren,
    clearElement,
    replaceChildren,
    createTableRow,
    createList,
    createButton,
    createLink,
    createDiv,
    createSpan,
    setInnerHTML,
    createTextNode,
    buildElement,
    ElementBuilder
  };
} else {
  // Browser global
  window.DOMUtils = {
    escapeHtml,
    setText,
    createElement,
    appendChildren,
    clearElement,
    replaceChildren,
    createTableRow,
    createList,
    createButton,
    createLink,
    createDiv,
    createSpan,
    setInnerHTML,
    createTextNode,
    buildElement,
    ElementBuilder
  };
}
