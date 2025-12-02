/**
 * Safe DOM Manipulation Utilities
 *
 * This module provides secure alternatives to innerHTML and other potentially
 * unsafe DOM manipulation methods. All functions sanitize input to prevent XSS attacks.
 *
 * @module domUtils
 */

/* eslint-disable no-param-reassign */

(function (root, factory) {
  if (typeof module !== 'undefined' && module.exports) {
    // CommonJS (Node.js)
    module.exports = factory();
  } else {
    // Browser global
    root.DOMUtils = factory();
  }
})(typeof self !== 'undefined' ? self : this, function () {
  /**
   * Escapes HTML special characters to prevent XSS
   * @param {string} str - String to escape
   * @returns {string} Escaped string
   */
  function escapeHtml(str) {
    if (typeof str !== 'string') {
      return '';
    }

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
    if (!element) {
      return;
    }
    element.textContent = text || '';
  }

  /**
   * Safely creates an element with text content
   * @param {string} tagName - HTML tag name
   * @param {string} text - Text content
   * @param {Object} attributes - Optional attributes to set
   * @returns {HTMLElement} Created element
   */
  function createElement(tagName, text, attributes) {
    text = text || '';
    attributes = attributes || {};
    const element = document.createElement(tagName);

    if (text) {
      element.textContent = text;
    }

    Object.keys(attributes).forEach(function (key) {
      const value = attributes[key];
      if (key === 'className') {
        element.className = value;
      } else if (key === 'style' && typeof value === 'object') {
        Object.assign(element.style, value);
      } else if (key.startsWith('data-')) {
        element.setAttribute(key, value);
      } else {
        element[key] = value;
      }
    });

    return element;
  }

  /**
   * Safely appends multiple children to a parent element
   * @param {HTMLElement} parent - Parent element
   * @param {HTMLElement[]} children - Child elements to append
   */
  function appendChildren(parent, children) {
    if (!parent) {
      return;
    }

    var args = Array.prototype.slice.call(arguments, 1);
    args.forEach(function (child) {
      if (child instanceof HTMLElement || child instanceof Text) {
        parent.appendChild(child);
      }
    });
  }

  /**
   * Clears all children from an element
   * @param {HTMLElement} element - Element to clear
   */
  function clearElement(element) {
    if (!element) {
      return;
    }

    while (element.firstChild) {
      element.removeChild(element.firstChild);
    }
  }

  /**
   * Safely replaces element content with new children
   * @param {HTMLElement} element - Target element
   * @param {HTMLElement[]} children - New children
   */
  function replaceChildren(element) {
    if (!element) {
      return;
    }

    clearElement(element);
    var args = Array.prototype.slice.call(arguments, 1);
    appendChildren.apply(null, [element].concat(args));
  }

  /**
   * Creates a table row with safe cell content
   * @param {Array<string|HTMLElement>} cells - Cell contents (strings will be escaped)
   * @param {string} cellTag - 'td' or 'th'
   * @param {Object} rowAttributes - Optional row attributes
   * @returns {HTMLTableRowElement} Created row
   */
  function createTableRow(cells, cellTag, rowAttributes) {
    cellTag = cellTag || 'td';
    rowAttributes = rowAttributes || {};
    const row = createElement('tr', '', rowAttributes);

    cells.forEach(function (cellContent) {
      const cell = document.createElement(cellTag);

      if (typeof cellContent === 'string') {
        cell.textContent = cellContent;
      } else if (cellContent instanceof HTMLElement) {
        cell.appendChild(cellContent);
      }

      row.appendChild(cell);
    });

    return row;
  }

  /**
   * Creates a list with safe item content
   * @param {Array<string|HTMLElement>} items - List items
   * @param {string} listType - 'ul' or 'ol'
   * @param {Object} listAttributes - Optional list attributes
   * @returns {HTMLUListElement|HTMLOListElement} Created list
   */
  function createList(items, listType, listAttributes) {
    listType = listType || 'ul';
    listAttributes = listAttributes || {};
    const list = createElement(listType, '', listAttributes);

    items.forEach(function (itemContent) {
      const li = document.createElement('li');

      if (typeof itemContent === 'string') {
        li.textContent = itemContent;
      } else if (itemContent instanceof HTMLElement) {
        li.appendChild(itemContent);
      }

      list.appendChild(li);
    });

    return list;
  }

  /**
   * Creates a button element with safe text
   * @param {string} text - Button text
   * @param {Function} onClick - Click handler
   * @param {Object} attributes - Optional attributes
   * @returns {HTMLButtonElement} Created button
   */
  function createButton(text, onClick, attributes) {
    attributes = attributes || {};
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
  function createLink(text, href, attributes) {
    attributes = attributes || {};
    const link = createElement('a', text, Object.assign({ href: href || '#' }, attributes));
    return link;
  }

  /**
   * Creates a div with class and optional content
   * @param {string} className - CSS class name(s)
   * @param {string|HTMLElement|Array<HTMLElement>} content - Content
   * @returns {HTMLDivElement} Created div
   */
  function createDiv(className, content) {
    const div = createElement('div', '', { className: className });

    if (typeof content === 'string') {
      div.textContent = content;
    } else if (content instanceof HTMLElement) {
      div.appendChild(content);
    } else if (Array.isArray(content)) {
      appendChildren.apply(null, [div].concat(content));
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
    return createElement('span', text, { className: className });
  }

  /**
   * Safely sets HTML from a trusted template string
   * WARNING: Only use with trusted, sanitized HTML
   * @param {HTMLElement} element - Target element
   * @param {string} html - HTML string (MUST be sanitized)
   */
  function setInnerHTML(element, html) {
    if (!element) {
      return;
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
   * Displays a notification toast message to the user.
   * This is the SSOT (Single Source of Truth) implementation for notifications.
   *
   * @param {string} message - The message to display
   * @param {string} [type='info'] - Notification type: 'success', 'error', 'warning', 'info'
   * @param {number} [duration=5000] - How long to show the notification in milliseconds
   *
   * @example
   * showNotification('Booking saved successfully!', 'success');
   * showNotification('Please fill all required fields', 'error', 8000);
   */
  function showNotification(message, type, duration) {
    type = type || 'info';
    duration = duration || 5000;

    const notification = document.createElement('div');
    notification.className = 'notification notification-' + type;
    notification.style.setProperty('--duration', (duration / 1000) + 's');

    const iconMap = {
      success: '✓',
      error: '✕',
      warning: '⚠',
      info: 'ℹ',
    };

    // XSS Protection: escape user message before inserting into HTML
    var safeMessage = escapeHtml(message);
    notification.innerHTML =
      '<span class="notification-icon">' + (iconMap[type] || iconMap.info) + '</span>' +
      '<span class="notification-content">' + safeMessage + '</span>' +
      '<span class="notification-close">×</span>';

    var container = document.getElementById('notification-container');
    if (!container) {
      container = document.createElement('div');
      container.id = 'notification-container';
      container.style.cssText =
        'position: fixed; top: 20px; right: 20px; z-index: 10000; ' +
        'display: flex; flex-direction: column; gap: 10px; pointer-events: none;';
      document.body.appendChild(container);
    }

    container.appendChild(notification);
    notification.style.pointerEvents = 'auto';

    // Auto-remove after duration
    var timeoutId = setTimeout(function () {
      notification.classList.add('notification-hide');
      setTimeout(function () {
        if (notification.parentNode) {
          notification.parentNode.removeChild(notification);
        }
      }, 300);
    }, duration);

    // Manual close button
    var closeBtn = notification.querySelector('.notification-close');
    if (closeBtn) {
      closeBtn.addEventListener('click', function () {
        clearTimeout(timeoutId);
        notification.classList.add('notification-hide');
        setTimeout(function () {
          if (notification.parentNode) {
            notification.parentNode.removeChild(notification);
          }
        }, 300);
      });
    }
  }

  /**
   * ElementBuilder class for fluent API
   */
  function ElementBuilder(tagName) {
    this.element = document.createElement(tagName);
  }

  ElementBuilder.prototype.text = function (content) {
    this.element.textContent = content;
    return this;
  };

  ElementBuilder.prototype.attr = function (name, value) {
    if (name === 'className') {
      this.element.className = value;
    } else if (name.startsWith('data-')) {
      this.element.setAttribute(name, value);
    } else {
      this.element[name] = value;
    }
    return this;
  };

  ElementBuilder.prototype.addClass = function (className) {
    this.element.classList.add(className);
    return this;
  };

  ElementBuilder.prototype.style = function (property, value) {
    this.element.style[property] = value;
    return this;
  };

  ElementBuilder.prototype.child = function () {
    var args = Array.prototype.slice.call(arguments);
    appendChildren.apply(null, [this.element].concat(args));
    return this;
  };

  ElementBuilder.prototype.on = function (event, handler) {
    this.element.addEventListener(event, handler);
    return this;
  };

  ElementBuilder.prototype.build = function () {
    return this.element;
  };

  /**
   * Builds complex HTML structure using builder pattern
   * @param {string} tagName - Root element tag
   * @returns {ElementBuilder} Builder instance
   */
  function buildElement(tagName) {
    return new ElementBuilder(tagName);
  }

  // Return the public API
  return {
    escapeHtml: escapeHtml,
    setText: setText,
    createElement: createElement,
    appendChildren: appendChildren,
    clearElement: clearElement,
    replaceChildren: replaceChildren,
    createTableRow: createTableRow,
    createList: createList,
    createButton: createButton,
    createLink: createLink,
    createDiv: createDiv,
    createSpan: createSpan,
    setInnerHTML: setInnerHTML,
    createTextNode: createTextNode,
    showNotification: showNotification,
    buildElement: buildElement,
    ElementBuilder: ElementBuilder,
  };
});
