/**
 * ModalDialog - Custom confirmation and alert dialogs
 * Replaces native browser confirm/alert with styled modals
 * Uses safe DOM manipulation to prevent XSS
 */

class ModalDialog {
  constructor() {
    this.currentModal = null;
    this.injectStyles();
  }

  /**
   * Inject CSS animations once
   */
  injectStyles() {
    if (document.getElementById('modal-dialog-styles')) {
      return;
    }

    const style = document.createElement('style');
    style.id = 'modal-dialog-styles';
    style.textContent = `
      @keyframes fadeIn {
        from { opacity: 0; }
        to { opacity: 1; }
      }
      @keyframes slideIn {
        from { transform: translateY(-20px); opacity: 0; }
        to { transform: translateY(0); opacity: 1; }
      }
      .modal-cancel-btn:hover {
        background: #f8f9fa !important;
        border-color: #495057 !important;
      }
      .modal-confirm-btn:hover {
        opacity: 0.9;
      }
      .modal-ok-btn:hover {
        opacity: 0.9;
      }
      .modal-backdrop {
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: rgba(0, 0, 0, 0.5);
        display: flex;
        justify-content: center;
        align-items: center;
        z-index: 10000;
        animation: fadeIn 0.2s ease-out;
      }
      .modal-dialog {
        background: white;
        border-radius: 8px;
        box-shadow: 0 4px 24px rgba(0, 0, 0, 0.2);
        max-width: 500px;
        width: 90%;
        max-height: 90vh;
        display: flex;
        flex-direction: column;
        animation: slideIn 0.3s ease-out;
      }
      .modal-header {
        padding: 20px;
        border-bottom: 1px solid #e9ecef;
        border-top-left-radius: 8px;
        border-top-right-radius: 8px;
        display: flex;
        align-items: center;
        justify-content: space-between;
      }
      .modal-body {
        padding: 20px;
        overflow-y: auto;
      }
      .modal-footer {
        padding: 16px 20px;
        border-top: 1px solid #e9ecef;
        display: flex;
        justify-content: flex-end;
        gap: 12px;
        background: #f8f9fa;
        border-bottom-left-radius: 8px;
        border-bottom-right-radius: 8px;
      }
      .modal-close-btn {
        background: none;
        border: none;
        font-size: 24px;
        cursor: pointer;
        color: #6c757d;
        padding: 0;
        line-height: 1;
      }
      .modal-close-btn:hover {
        color: #343a40;
      }
    `;
    document.head.appendChild(style);
  }

  /**
   * Create a safe text node or element
   */
  createSafeElement(tag, text, styles = {}) {
    const el = document.createElement(tag);
    if (text) {
      el.textContent = text; // Safe: no HTML injection
    }
    Object.assign(el.style, styles);
    return el;
  }

  /**
   * Open a generic modal with custom content
   * @param {Object} options
   * @param {string} options.title - Modal title
   * @param {HTMLElement|string} options.content - Modal content (element or text)
   * @param {Array<HTMLElement>} options.footerButtons - Array of button elements for footer
   * @param {string} options.size - 'small', 'medium', 'large' (default: 'medium')
   * @param {boolean} options.showCloseButton - Show X button in header (default: true)
   * @param {Function} options.onClose - Callback when modal is closed
   */
  open(options) {
    this.close();

    const backdrop = document.createElement('div');
    backdrop.className = 'modal-backdrop';

    const modal = document.createElement('div');
    modal.className = 'modal-dialog';

    // Set size
    if (options.size === 'large') {
      modal.style.maxWidth = '800px';
    }
    if (options.size === 'small') {
      modal.style.maxWidth = '400px';
    }

    // Header
    if (options.title || options.showCloseButton !== false) {
      const header = document.createElement('div');
      header.className = 'modal-header';

      if (options.title) {
        const title = this.createSafeElement('h3', options.title, {
          margin: '0',
          fontSize: '18px',
          fontWeight: '600',
          color: '#212529',
        });
        header.appendChild(title);
      }

      if (options.showCloseButton !== false) {
        const closeBtn = document.createElement('button');
        closeBtn.className = 'modal-close-btn';
        closeBtn.innerHTML = '&times;';
        closeBtn.onclick = () => this.close();
        header.appendChild(closeBtn);
      }

      modal.appendChild(header);
    }

    // Body
    const body = document.createElement('div');
    body.className = 'modal-body';

    if (typeof options.content === 'string') {
      body.textContent = options.content;
    } else if (options.content instanceof HTMLElement) {
      body.appendChild(options.content);
    }

    modal.appendChild(body);

    // Footer
    if (options.footerButtons && options.footerButtons.length > 0) {
      const footer = document.createElement('div');
      footer.className = 'modal-footer';
      options.footerButtons.forEach((btn) => footer.appendChild(btn));
      modal.appendChild(footer);
    }

    backdrop.appendChild(modal);
    document.body.appendChild(backdrop);
    this.currentModal = backdrop;
    this.onCloseCallback = options.onClose;

    // Close on backdrop click
    backdrop.addEventListener('click', (e) => {
      if (e.target === backdrop) {
        this.close();
      }
    });

    // Close on Escape
    const handleKeydown = (e) => {
      if (e.key === 'Escape') {
        this.close();
        document.removeEventListener('keydown', handleKeydown);
      }
    };
    document.addEventListener('keydown', handleKeydown);
  }

  /**
   * Show a confirmation dialog with custom styling
   * @param {Object} options - Dialog options
   * @returns {Promise<boolean>} - true if confirmed, false if cancelled
   */
  async confirm(options) {
    return new Promise((resolve) => {
      const content = document.createElement('div');

      // Header content (Icon + Title logic moved to content for flexibility in generic open,
      // but for confirm we want strict styling, so we'll build a specific body)

      const typeColors = {
        warning: { bg: '#fff3cd', border: '#ffc107', text: '#856404' },
        danger: { bg: '#f8d7da', border: '#dc3545', text: '#721c24' },
        info: { bg: '#d1ecf1', border: '#17a2b8', text: '#0c5460' },
      };
      const colors = typeColors[options.type] || typeColors.info;

      // We'll use a custom header for confirm to match previous styling exactly
      // So we won't use the generic title in open(), but render it in content

      const headerDiv = this.createSafeElement('div', null, {
        display: 'flex',
        alignItems: 'center',
        gap: '12px',
        marginBottom: '16px',
        padding: '16px',
        background: colors.bg,
        borderRadius: '6px',
        border: `1px solid ${colors.border}`,
      });

      const iconSpan = this.createSafeElement('span', options.icon || 'ℹ️', { fontSize: '24px' });
      const title = this.createSafeElement('h3', options.title, {
        margin: '0',
        color: colors.text,
        fontSize: '18px',
        fontWeight: '600',
      });

      headerDiv.appendChild(iconSpan);
      headerDiv.appendChild(title);
      content.appendChild(headerDiv);

      const message = this.createSafeElement('p', options.message, {
        margin: '0 0 12px 0',
        color: '#212529',
        lineHeight: '1.6',
        whiteSpace: 'pre-line',
      });
      content.appendChild(message);

      if (options.details && options.details.length > 0) {
        const detailsContainer = this.createSafeElement('div', null, {
          marginTop: '16px',
          padding: '12px',
          background: '#f8f9fa',
          borderRadius: '4px',
        });

        options.details.forEach((detail) => {
          const row = this.createSafeElement('div', null, {
            display: 'flex',
            justifyContent: 'space-between',
            padding: '4px 0',
            fontSize: '14px',
          });
          const label = this.createSafeElement('span', `${detail.label}:`, { color: '#6c757d' });
          const value = this.createSafeElement('strong', detail.value, { color: '#212529' });
          row.appendChild(label);
          row.appendChild(value);
          detailsContainer.appendChild(row);
        });
        content.appendChild(detailsContainer);
      }

      const cancelBtn = this.createSafeElement('button', options.cancelText || 'Zrušit', {
        padding: '8px 16px',
        border: '1px solid #6c757d',
        background: 'white',
        color: '#6c757d',
        borderRadius: '4px',
        fontSize: '14px',
        fontWeight: '500',
        cursor: 'pointer',
        transition: 'all 0.2s',
      });
      cancelBtn.className = 'modal-cancel-btn';
      cancelBtn.onclick = () => {
        this.close();
        resolve(false);
      };

      const confirmBtn = this.createSafeElement('button', options.confirmText || 'Potvrdit', {
        padding: '8px 16px',
        border: 'none',
        background: options.type === 'danger' ? '#dc3545' : '#28a745',
        color: 'white',
        borderRadius: '4px',
        fontSize: '14px',
        fontWeight: '500',
        cursor: 'pointer',
        transition: 'all 0.2s',
      });
      confirmBtn.className = 'modal-confirm-btn';
      confirmBtn.onclick = () => {
        this.onCloseCallback = null; // Prevent default close handler
        this.close();
        resolve(true);
      };

      this.open({
        content,
        footerButtons: [cancelBtn, confirmBtn],
        showCloseButton: false,
        onClose: () => resolve(false),
      });

      setTimeout(() => confirmBtn.focus(), 100);
    });
  }

  /**
   * Show an alert dialog
   */
  async alert(options) {
    return new Promise((resolve) => {
      const content = document.createElement('div');

      const typeColors = {
        success: { bg: '#d4edda', text: '#155724', border: '#28a745' },
        error: { bg: '#f8d7da', text: '#721c24', border: '#dc3545' },
        warning: { bg: '#fff3cd', text: '#856404', border: '#ffc107' },
        info: { bg: '#d1ecf1', text: '#0c5460', border: '#17a2b8' },
      };
      const colors = typeColors[options.type] || typeColors.info;

      const headerDiv = this.createSafeElement('div', null, {
        display: 'flex',
        alignItems: 'center',
        gap: '12px',
        marginBottom: '16px',
        padding: '16px',
        background: colors.bg,
        borderRadius: '6px',
        border: `1px solid ${colors.border}`,
      });

      const iconSpan = this.createSafeElement('span', options.icon || 'ℹ️', { fontSize: '24px' });
      const title = this.createSafeElement('h3', options.title, {
        margin: '0',
        color: colors.text,
        fontSize: '18px',
        fontWeight: '600',
      });

      headerDiv.appendChild(iconSpan);
      headerDiv.appendChild(title);
      content.appendChild(headerDiv);

      const message = this.createSafeElement('p', options.message, {
        margin: '0',
        color: '#212529',
        lineHeight: '1.6',
        whiteSpace: 'pre-line',
      });
      content.appendChild(message);

      const okBtn = this.createSafeElement('button', options.okText || 'OK', {
        padding: '8px 16px',
        border: 'none',
        background: colors.border,
        color: 'white',
        borderRadius: '4px',
        fontSize: '14px',
        fontWeight: '500',
        cursor: 'pointer',
        transition: 'all 0.2s',
      });
      okBtn.className = 'modal-ok-btn';
      okBtn.onclick = () => {
        this.close();
        resolve();
      };

      this.open({
        content,
        footerButtons: [okBtn],
        showCloseButton: false,
        size: 'small',
        onClose: () => resolve(),
      });

      setTimeout(() => okBtn.focus(), 100);
    });
  }

  /**
   * Close the current modal
   */
  close() {
    if (this.currentModal) {
      this.currentModal.remove();
      this.currentModal = null;
      if (this.onCloseCallback) {
        this.onCloseCallback();
        this.onCloseCallback = null;
      }
    }
  }
}

// Create singleton instance
const modalDialog = new ModalDialog();

// Make available globally in browser
if (typeof window !== 'undefined') {
  window.ModalDialog = ModalDialog;
  window.modalDialog = modalDialog;
}

// Export for use in other modules (Node.js)
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { ModalDialog, modalDialog };
}
