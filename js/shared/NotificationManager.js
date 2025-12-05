/**
 * NotificationManager - Centralized toast notifications
 * Replaces ad-hoc showNotification implementations
 */

class NotificationManager {
  /**
   * Escape HTML to prevent XSS attacks
   * @param {string} text - Text to escape
   * @returns {string} - Escaped text safe for innerHTML
   */
  static escapeHtml(text) {
    if (typeof text !== 'string') {
      return String(text);
    }
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  constructor() {
    this.container = null;
    this.injectStyles();
    this.createContainer();
  }

  injectStyles() {
    if (document.getElementById('notification-manager-styles')) {
      return;
    }

    const style = document.createElement('style');
    style.id = 'notification-manager-styles';
    style.textContent = `
      .notification-container {
        position: fixed;
        bottom: 20px;
        right: 20px;
        z-index: 11000;
        display: flex;
        flex-direction: column;
        gap: 10px;
        pointer-events: none;
      }
      .notification-toast {
        background: white;
        color: #1f2937;
        padding: 16px;
        border-radius: 8px;
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
        display: flex;
        align-items: center;
        gap: 12px;
        min-width: 300px;
        max-width: 450px;
        pointer-events: auto;
        animation: slideInRight 0.3s ease-out;
        border-left: 4px solid #3b82f6;
      }
      .notification-toast.success {
        border-left-color: #10b981;
      }
      .notification-toast.error {
        border-left-color: #ef4444;
      }
      .notification-toast.warning {
        border-left-color: #f59e0b;
      }
      .notification-toast.info {
        border-left-color: #3b82f6;
      }
      .notification-icon {
        font-size: 20px;
      }
      .notification-content {
        flex: 1;
        font-size: 14px;
        line-height: 1.4;
      }
      .notification-close {
        background: none;
        border: none;
        color: #9ca3af;
        cursor: pointer;
        font-size: 18px;
        padding: 0;
        line-height: 1;
      }
      .notification-close:hover {
        color: #4b5563;
      }
      @keyframes slideInRight {
        from { transform: translateX(100%); opacity: 0; }
        to { transform: translateX(0); opacity: 1; }
      }
      @keyframes slideOutRight {
        from { transform: translateX(0); opacity: 1; }
        to { transform: translateX(100%); opacity: 0; }
      }
    `;
    document.head.appendChild(style);
  }

  createContainer() {
    if (document.getElementById('notification-container')) {
      this.container = document.getElementById('notification-container');
      return;
    }
    this.container = document.createElement('div');
    this.container.id = 'notification-container';
    this.container.className = 'notification-container';
    document.body.appendChild(this.container);
  }

  /**
   * Show a notification toast
   * @param {string} message - Message to display
   * @param {string} type - 'success', 'error', 'warning', 'info'
   * @param {number} duration - Duration in ms (default: 5000)
   */
  show(message, type = 'info', duration = 5000) {
    const toast = document.createElement('div');
    toast.className = `notification-toast ${type}`;

    const icons = {
      success: '✅',
      error: '❌',
      warning: '⚠️',
      info: 'ℹ️',
    };

    // Use safe HTML construction to prevent XSS
    const safeMessage = NotificationManager.escapeHtml(message);
    toast.innerHTML = `
      <div class="notification-icon">${icons[type] || icons.info}</div>
      <div class="notification-content">${safeMessage}</div>
      <button class="notification-close">&times;</button>
    `;

    // Close button handler
    const closeBtn = toast.querySelector('.notification-close');
    closeBtn.onclick = () => this.close(toast);

    this.container.appendChild(toast);

    // Auto close
    if (duration > 0) {
      setTimeout(() => {
        if (toast.parentElement) {
          this.close(toast);
        }
      }, duration);
    }

    return toast;
  }

  close(toast) {
    toast.style.animation = 'slideOutRight 0.3s ease-in forwards';
    setTimeout(() => {
      if (toast.parentElement) {
        toast.remove();
      }
    }, 300);
  }
}

// Create singleton instance
const notificationManager = new NotificationManager();

// Make available globally
if (typeof window !== 'undefined') {
  window.NotificationManager = NotificationManager;
  window.notificationManager = notificationManager;
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { NotificationManager, notificationManager };
}
