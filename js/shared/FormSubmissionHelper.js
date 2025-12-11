/**
 * FormSubmissionHelper - Utility for managing form submission states
 *
 * Provides consistent handling of:
 * - Button loading states (disabled, loading text, visual feedback)
 * - Async submission with error handling
 * - Language-aware loading messages
 *
 * @example
 * const helper = new FormSubmissionHelper({
 *   buttonSelector: '#submitBtn',
 *   language: 'cs'
 * });
 *
 * await helper.submit(async () => {
 *   return await api.createBooking(data);
 * }, {
 *   onSuccess: (result) => showSuccess('Booking created'),
 *   onError: (error) => showError(error.message)
 * });
 */
class FormSubmissionHelper {
  /**
   * @param {Object} options - Configuration options
   * @param {string|HTMLElement} options.button - Button selector or element
   * @param {string} [options.language='cs'] - Language for loading text ('cs' or 'en')
   * @param {Object} [options.loadingText] - Custom loading text by language
   */
  constructor(options = {}) {
    this.button =
      typeof options.button === 'string' ? document.querySelector(options.button) : options.button;
    this.language = options.language || 'cs';
    this.loadingText = options.loadingText || {
      cs: '⏳ Zpracování...',
      en: '⏳ Processing...',
    };
    this.originalState = null;
  }

  /**
   * Get the current button element
   * @returns {HTMLElement|null}
   */
  getButton() {
    return this.button;
  }

  /**
   * Set button to loading or normal state
   * @param {boolean} loading - Whether to show loading state
   */
  setLoading(loading) {
    const button = this.getButton();
    if (!button) {
      console.warn('[FormSubmissionHelper] Button not found');
      return;
    }

    if (loading) {
      // Save original state
      this.originalState = {
        disabled: button.disabled,
        text: button.textContent,
        opacity: button.style.opacity,
        cursor: button.style.cursor,
      };

      // Apply loading state
      button.disabled = true;
      button.textContent = this.loadingText[this.language] || this.loadingText.cs;
      button.style.opacity = '0.7';
      button.style.cursor = 'not-allowed';
    } else if (this.originalState) {
      // Restore original state
      button.disabled = this.originalState.disabled;
      button.textContent = this.originalState.text;
      button.style.opacity = this.originalState.opacity;
      button.style.cursor = this.originalState.cursor;
      this.originalState = null;
    } else {
      // Fallback if no original state
      button.disabled = false;
      button.style.opacity = '';
      button.style.cursor = '';
    }
  }

  /**
   * Execute an async submission with loading state management
   * @param {Function} submitFn - Async function that performs the submission
   * @param {Object} [callbacks] - Optional callbacks
   * @param {Function} [callbacks.onSuccess] - Called with result on success
   * @param {Function} [callbacks.onError] - Called with error on failure
   * @returns {Promise<*>} - Result from submitFn or undefined on error
   */
  async submit(submitFn, callbacks = {}) {
    const { onSuccess, onError } = callbacks;

    this.setLoading(true);

    try {
      const result = await submitFn();

      if (onSuccess) {
        onSuccess(result);
      }

      return result;
    } catch (error) {
      if (onError) {
        onError(error);
      } else {
        console.error('[FormSubmissionHelper] Submission failed:', error);
      }
      // Don't re-throw - let caller decide via onError
      return undefined;
    } finally {
      this.setLoading(false);
    }
  }

  /**
   * Create a helper instance from existing button state pattern
   * @param {Object} options - Same as constructor
   * @returns {FormSubmissionHelper}
   */
  static create(options) {
    return new FormSubmissionHelper(options);
  }
}

// Export for both browser and Node.js environments
if (typeof module !== 'undefined' && module.exports) {
  module.exports = FormSubmissionHelper;
} else if (typeof window !== 'undefined') {
  window.FormSubmissionHelper = FormSubmissionHelper;
}
