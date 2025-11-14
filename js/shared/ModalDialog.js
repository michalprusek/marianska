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
    if (document.getElementById('modal-dialog-styles')) return;

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
   * Show a confirmation dialog with custom styling
   * @param {Object} options - Dialog options
   * @param {string} options.title - Dialog title (plain text)
   * @param {string} options.message - Main message (plain text)
   * @param {string} options.icon - Icon emoji (e.g., '🗑️', '⚠️')
   * @param {string} options.confirmText - Confirm button text
   * @param {string} options.cancelText - Cancel button text
   * @param {string} options.type - Dialog type: 'warning', 'danger', 'info'
   * @param {Array<Object>} options.details - Additional details to display [{label, value}]
   * @returns {Promise<boolean>} - true if confirmed, false if cancelled
   */
  async confirm(options) {
    return new Promise((resolve) => {
      // Remove any existing modal
      this.close();

      // Create modal backdrop
      const backdrop = this.createSafeElement('div', null, {
        position: 'fixed',
        top: '0',
        left: '0',
        width: '100%',
        height: '100%',
        background: 'rgba(0, 0, 0, 0.5)',
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        zIndex: '10000',
        animation: 'fadeIn 0.2s ease-out',
      });
      backdrop.className = 'modal-backdrop';

      // Create modal container
      const modal = this.createSafeElement('div', null, {
        background: 'white',
        borderRadius: '8px',
        boxShadow: '0 4px 24px rgba(0, 0, 0, 0.2)',
        maxWidth: '500px',
        width: '90%',
        maxHeight: '80vh',
        overflowY: 'auto',
        animation: 'slideIn 0.3s ease-out',
      });
      modal.className = 'modal-dialog';

      // Color schemes
      const typeColors = {
        warning: { bg: '#fff3cd', border: '#ffc107', text: '#856404' },
        danger: { bg: '#f8d7da', border: '#dc3545', text: '#721c24' },
        info: { bg: '#d1ecf1', border: '#17a2b8', text: '#0c5460' },
      };
      const colors = typeColors[options.type] || typeColors.info;

      // Header
      const header = this.createSafeElement('div', null, {
        padding: '20px',
        borderBottom: '1px solid #e9ecef',
        background: colors.bg,
        borderTopLeftRadius: '8px',
        borderTopRightRadius: '8px',
      });

      const headerContent = this.createSafeElement('div', null, {
        display: 'flex',
        alignItems: 'center',
        gap: '12px',
      });

      const iconSpan = this.createSafeElement('span', options.icon || 'ℹ️', {
        fontSize: '32px',
      });

      const title = this.createSafeElement('h3', options.title, {
        margin: '0',
        color: colors.text,
        fontSize: '18px',
        fontWeight: '600',
      });

      headerContent.appendChild(iconSpan);
      headerContent.appendChild(title);
      header.appendChild(headerContent);

      // Body
      const body = this.createSafeElement('div', null, { padding: '20px' });

      const message = this.createSafeElement('p', options.message, {
        margin: '0 0 12px 0',
        color: '#212529',
        lineHeight: '1.6',
        whiteSpace: 'pre-line',
      });
      body.appendChild(message);

      // Details section
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

          const label = this.createSafeElement('span', `${detail.label}:`, {
            color: '#6c757d',
          });

          const value = this.createSafeElement('strong', detail.value, {
            color: '#212529',
          });

          row.appendChild(label);
          row.appendChild(value);
          detailsContainer.appendChild(row);
        });

        body.appendChild(detailsContainer);
      }

      // Footer
      const footer = this.createSafeElement('div', null, {
        padding: '16px 20px',
        borderTop: '1px solid #e9ecef',
        display: 'flex',
        justifyContent: 'flex-end',
        gap: '12px',
        background: '#f8f9fa',
        borderBottomLeftRadius: '8px',
        borderBottomRightRadius: '8px',
      });

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

      footer.appendChild(cancelBtn);
      footer.appendChild(confirmBtn);

      // Assemble modal
      modal.appendChild(header);
      modal.appendChild(body);
      modal.appendChild(footer);
      backdrop.appendChild(modal);
      document.body.appendChild(backdrop);
      this.currentModal = backdrop;

      // Event handlers
      const handleConfirm = () => {
        this.close();
        resolve(true);
      };

      const handleCancel = () => {
        this.close();
        resolve(false);
      };

      confirmBtn.addEventListener('click', handleConfirm);
      cancelBtn.addEventListener('click', handleCancel);

      backdrop.addEventListener('click', (e) => {
        if (e.target === backdrop) {
          handleCancel();
        }
      });

      const handleKeydown = (e) => {
        if (e.key === 'Escape') {
          handleCancel();
          document.removeEventListener('keydown', handleKeydown);
        }
      };
      document.addEventListener('keydown', handleKeydown);

      setTimeout(() => confirmBtn.focus(), 100);
    });
  }

  /**
   * Show an alert dialog (info only, no confirmation)
   * @param {Object} options - Dialog options
   * @param {string} options.title - Dialog title (plain text)
   * @param {string} options.message - Main message (plain text)
   * @param {string} options.icon - Icon emoji
   * @param {string} options.type - 'success', 'error', 'warning', 'info'
   * @param {string} options.okText - OK button text
   * @returns {Promise<void>}
   */
  async alert(options) {
    return new Promise((resolve) => {
      this.close();

      const backdrop = this.createSafeElement('div', null, {
        position: 'fixed',
        top: '0',
        left: '0',
        width: '100%',
        height: '100%',
        background: 'rgba(0, 0, 0, 0.5)',
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        zIndex: '10000',
        animation: 'fadeIn 0.2s ease-out',
      });
      backdrop.className = 'modal-backdrop';

      const modal = this.createSafeElement('div', null, {
        background: 'white',
        borderRadius: '8px',
        boxShadow: '0 4px 24px rgba(0, 0, 0, 0.2)',
        maxWidth: '400px',
        width: '90%',
        animation: 'slideIn 0.3s ease-out',
      });
      modal.className = 'modal-dialog';

      const typeColors = {
        success: { bg: '#d4edda', text: '#155724', border: '#28a745' },
        error: { bg: '#f8d7da', text: '#721c24', border: '#dc3545' },
        warning: { bg: '#fff3cd', text: '#856404', border: '#ffc107' },
        info: { bg: '#d1ecf1', text: '#0c5460', border: '#17a2b8' },
      };
      const colors = typeColors[options.type] || typeColors.info;

      // Header
      const header = this.createSafeElement('div', null, {
        padding: '20px',
        borderBottom: '1px solid #e9ecef',
        background: colors.bg,
        borderTopLeftRadius: '8px',
        borderTopRightRadius: '8px',
      });

      const headerContent = this.createSafeElement('div', null, {
        display: 'flex',
        alignItems: 'center',
        gap: '12px',
      });

      const iconSpan = this.createSafeElement('span', options.icon || 'ℹ️', { fontSize: '32px' });
      const title = this.createSafeElement('h3', options.title, {
        margin: '0',
        color: colors.text,
        fontSize: '18px',
        fontWeight: '600',
      });

      headerContent.appendChild(iconSpan);
      headerContent.appendChild(title);
      header.appendChild(headerContent);

      // Body
      const body = this.createSafeElement('div', null, { padding: '20px' });
      const message = this.createSafeElement('p', options.message, {
        margin: '0',
        color: '#212529',
        lineHeight: '1.6',
        whiteSpace: 'pre-line',
      });
      body.appendChild(message);

      // Footer
      const footer = this.createSafeElement('div', null, {
        padding: '16px 20px',
        borderTop: '1px solid #e9ecef',
        display: 'flex',
        justifyContent: 'flex-end',
        background: '#f8f9fa',
        borderBottomLeftRadius: '8px',
        borderBottomRightRadius: '8px',
      });

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

      footer.appendChild(okBtn);

      modal.appendChild(header);
      modal.appendChild(body);
      modal.appendChild(footer);
      backdrop.appendChild(modal);
      document.body.appendChild(backdrop);
      this.currentModal = backdrop;

      const handleOk = () => {
        this.close();
        resolve();
      };

      okBtn.addEventListener('click', handleOk);
      backdrop.addEventListener('click', (e) => {
        if (e.target === backdrop) {
          handleOk();
        }
      });

      const handleKeydown = (e) => {
        if (e.key === 'Escape' || e.key === 'Enter') {
          handleOk();
          document.removeEventListener('keydown', handleKeydown);
        }
      };
      document.addEventListener('keydown', handleKeydown);

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
