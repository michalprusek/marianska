/**
 * ModalFactory - Dynamic modal creation and management
 * SSOT for modal HTML structure and behavior
 *
 * Features:
 * - Creates modals with consistent structure
 * - Handles open/close with animations
 * - Manages escape key and click-outside-to-close
 * - Provides event hooks (onOpen, onClose)
 *
 * Usage:
 *   const factory = new ModalFactory();
 *
 *   // Create a new modal
 *   const modal = factory.create({
 *     id: 'myModal',
 *     title: 'My Title',
 *     content: '<p>Modal content</p>',
 *     actions: [
 *       { text: 'Cancel', type: 'secondary', onClick: () => factory.close('myModal') },
 *       { text: 'Confirm', type: 'primary', onClick: () => handleConfirm() }
 *     ]
 *   });
 *
 *   // Open existing modal
 *   factory.open('bookingModal');
 *
 *   // Close modal
 *   factory.close('bookingModal');
 */

class ModalFactory {
  constructor() {
    this.modals = new Map();
    this.activeModal = null;
    this.boundEscapeHandler = this.handleEscape.bind(this);
    this.initialized = false;
  }

  /**
   * Initialize event listeners (call once on page load)
   */
  init() {
    if (this.initialized) return;

    // Global escape key handler
    document.addEventListener('keydown', this.boundEscapeHandler);

    // Register existing modals from DOM
    document.querySelectorAll('.modal').forEach((modal) => {
      if (modal.id) {
        this.register(modal.id);
      }
    });

    this.initialized = true;
  }

  /**
   * Register an existing DOM modal
   * @param {string} id - Modal element ID
   */
  register(id) {
    const element = document.getElementById(id);
    if (!element) return;

    this.modals.set(id, {
      element,
      isOpen: false,
      onOpen: null,
      onClose: null,
    });

    // Setup click-outside-to-close
    element.addEventListener('click', (e) => {
      if (e.target === element) {
        this.close(id);
      }
    });

    // Setup close button(s)
    element.querySelectorAll('.modal-close').forEach((btn) => {
      btn.addEventListener('click', () => this.close(id));
    });
  }

  /**
   * Create a new modal dynamically
   * @param {Object} options - Modal options
   * @param {string} options.id - Unique modal ID
   * @param {string} options.title - Modal title
   * @param {string} options.content - HTML content (use with caution) or DOM element
   * @param {string} [options.contentClass] - Additional class for modal-content
   * @param {string} [options.maxWidth] - Max width (e.g., '600px')
   * @param {Array} [options.actions] - Action buttons [{text, type, onClick}]
   * @param {Function} [options.onOpen] - Callback when modal opens
   * @param {Function} [options.onClose] - Callback when modal closes
   * @returns {HTMLElement} - The created modal element
   */
  create(options) {
    const {
      id,
      title,
      content,
      contentClass = '',
      maxWidth = null,
      actions = [],
      onOpen = null,
      onClose = null,
    } = options;

    // Check if modal already exists
    if (document.getElementById(id)) {
      console.warn(`ModalFactory: Modal with id "${id}" already exists`);
      return document.getElementById(id);
    }

    // Create modal structure
    const modal = document.createElement('div');
    modal.id = id;
    modal.className = 'modal';

    const modalContent = document.createElement('div');
    modalContent.className = `modal-content ${contentClass}`.trim();
    if (maxWidth) {
      modalContent.style.maxWidth = maxWidth;
    }

    // Close button
    const closeBtn = document.createElement('button');
    closeBtn.className = 'modal-close';
    closeBtn.innerHTML = '&times;';
    closeBtn.setAttribute('aria-label', 'Zavrit');
    modalContent.appendChild(closeBtn);

    // Title
    if (title) {
      const titleEl = document.createElement('h2');
      titleEl.textContent = title;
      modalContent.appendChild(titleEl);
    }

    // Content
    const contentContainer = document.createElement('div');
    contentContainer.className = 'modal-body';
    if (typeof content === 'string') {
      contentContainer.innerHTML = content;
    } else if (content instanceof HTMLElement) {
      contentContainer.appendChild(content);
    }
    modalContent.appendChild(contentContainer);

    // Actions
    if (actions.length > 0) {
      const actionsContainer = document.createElement('div');
      actionsContainer.className = 'modal-actions';

      actions.forEach((action) => {
        const btn = document.createElement('button');
        btn.className = `btn btn-${action.type || 'secondary'}`;
        btn.textContent = action.text;
        if (action.onClick) {
          btn.addEventListener('click', action.onClick);
        }
        if (action.id) {
          btn.id = action.id;
        }
        actionsContainer.appendChild(btn);
      });

      modalContent.appendChild(actionsContainer);
    }

    modal.appendChild(modalContent);
    document.body.appendChild(modal);

    // Register and store
    this.modals.set(id, {
      element: modal,
      isOpen: false,
      onOpen,
      onClose,
    });

    // Setup event listeners
    closeBtn.addEventListener('click', () => this.close(id));
    modal.addEventListener('click', (e) => {
      if (e.target === modal) {
        this.close(id);
      }
    });

    return modal;
  }

  /**
   * Open a modal by ID
   * @param {string} id - Modal ID
   * @param {Object} [data] - Optional data to pass to onOpen callback
   */
  open(id, data = null) {
    const modalInfo = this.modals.get(id);
    if (!modalInfo) {
      // Try to find and register the modal
      const element = document.getElementById(id);
      if (element) {
        this.register(id);
        return this.open(id, data);
      }
      console.warn(`ModalFactory: Modal "${id}" not found`);
      return;
    }

    const { element, onOpen } = modalInfo;

    // Close any currently open modal
    if (this.activeModal && this.activeModal !== id) {
      this.close(this.activeModal);
    }

    element.style.display = 'flex';
    modalInfo.isOpen = true;
    this.activeModal = id;

    // Prevent body scrolling
    document.body.style.overflow = 'hidden';

    // Focus first focusable element
    setTimeout(() => {
      const focusable = element.querySelector(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
      );
      if (focusable) {
        focusable.focus();
      }
    }, 100);

    // Call onOpen callback
    if (onOpen) {
      onOpen(data);
    }

    // Dispatch custom event
    element.dispatchEvent(new CustomEvent('modalOpen', { detail: { id, data } }));
  }

  /**
   * Close a modal by ID
   * @param {string} id - Modal ID (optional, closes active modal if not specified)
   */
  close(id = null) {
    const modalId = id || this.activeModal;
    if (!modalId) return;

    const modalInfo = this.modals.get(modalId);
    if (!modalInfo) return;

    const { element, onClose } = modalInfo;

    element.style.display = 'none';
    modalInfo.isOpen = false;

    if (this.activeModal === modalId) {
      this.activeModal = null;
      document.body.style.overflow = '';
    }

    // Call onClose callback
    if (onClose) {
      onClose();
    }

    // Dispatch custom event
    element.dispatchEvent(new CustomEvent('modalClose', { detail: { id: modalId } }));
  }

  /**
   * Toggle modal visibility
   * @param {string} id - Modal ID
   */
  toggle(id) {
    const modalInfo = this.modals.get(id);
    if (!modalInfo) return;

    if (modalInfo.isOpen) {
      this.close(id);
    } else {
      this.open(id);
    }
  }

  /**
   * Check if a modal is currently open
   * @param {string} id - Modal ID
   * @returns {boolean}
   */
  isOpen(id) {
    const modalInfo = this.modals.get(id);
    return modalInfo ? modalInfo.isOpen : false;
  }

  /**
   * Get modal element by ID
   * @param {string} id - Modal ID
   * @returns {HTMLElement|null}
   */
  getElement(id) {
    const modalInfo = this.modals.get(id);
    return modalInfo ? modalInfo.element : null;
  }

  /**
   * Set callbacks for a modal
   * @param {string} id - Modal ID
   * @param {Object} callbacks - {onOpen, onClose}
   */
  setCallbacks(id, callbacks) {
    const modalInfo = this.modals.get(id);
    if (!modalInfo) return;

    if (callbacks.onOpen) {
      modalInfo.onOpen = callbacks.onOpen;
    }
    if (callbacks.onClose) {
      modalInfo.onClose = callbacks.onClose;
    }
  }

  /**
   * Destroy a dynamically created modal
   * @param {string} id - Modal ID
   */
  destroy(id) {
    const modalInfo = this.modals.get(id);
    if (!modalInfo) return;

    this.close(id);
    modalInfo.element.remove();
    this.modals.delete(id);
  }

  /**
   * Handle escape key press
   * @private
   */
  handleEscape(e) {
    if (e.key === 'Escape' && this.activeModal) {
      this.close(this.activeModal);
    }
  }

  /**
   * Update modal content
   * @param {string} id - Modal ID
   * @param {Object} options - {title, content}
   */
  updateContent(id, options) {
    const element = this.getElement(id);
    if (!element) return;

    if (options.title) {
      const titleEl = element.querySelector('h2');
      if (titleEl) {
        titleEl.textContent = options.title;
      }
    }

    if (options.content) {
      const bodyEl = element.querySelector('.modal-body');
      if (bodyEl) {
        if (typeof options.content === 'string') {
          bodyEl.innerHTML = options.content;
        } else if (options.content instanceof HTMLElement) {
          bodyEl.innerHTML = '';
          bodyEl.appendChild(options.content);
        }
      }
    }
  }

  /**
   * Create a simple alert modal
   * @param {string} message - Alert message
   * @param {string} [title='Upozorneni'] - Alert title
   * @returns {Promise} - Resolves when modal is closed
   */
  alert(message, title = 'Upozorneni') {
    return new Promise((resolve) => {
      const id = `alert-${Date.now()}`;

      this.create({
        id,
        title,
        content: `<p>${this.escapeHtml(message)}</p>`,
        actions: [
          {
            text: 'OK',
            type: 'primary',
            onClick: () => {
              this.destroy(id);
              resolve();
            },
          },
        ],
      });

      this.open(id);
    });
  }

  /**
   * Create a simple confirm modal
   * @param {string} message - Confirm message
   * @param {string} [title='Potvrzeni'] - Confirm title
   * @returns {Promise<boolean>} - Resolves with true/false
   */
  confirm(message, title = 'Potvrzeni') {
    return new Promise((resolve) => {
      const id = `confirm-${Date.now()}`;

      this.create({
        id,
        title,
        content: `<p>${this.escapeHtml(message)}</p>`,
        onClose: () => {
          this.destroy(id);
          resolve(false);
        },
        actions: [
          {
            text: 'Zrusit',
            type: 'secondary',
            onClick: () => {
              this.destroy(id);
              resolve(false);
            },
          },
          {
            text: 'Potvrdit',
            type: 'primary',
            onClick: () => {
              this.destroy(id);
              resolve(true);
            },
          },
        ],
      });

      this.open(id);
    });
  }

  /**
   * Escape HTML to prevent XSS
   * @private
   */
  escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }
}

// Export singleton instance
const modalFactory = new ModalFactory();

// Auto-initialize when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => modalFactory.init());
} else {
  modalFactory.init();
}

// Export for module systems
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { ModalFactory, modalFactory };
}
