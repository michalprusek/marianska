/* global DOMUtils */
/**
 * BookingContactForm - Reusable component for booking contact details
 * Handles rendering, validation, and data collection for contact forms.
 * Used by both CreateBookingComponent and EditBookingComponent.
 */
class BookingContactForm {
  /**
   * @param {Object} config
   * @param {string} config.containerId - ID of the container to render the form into
   * @param {string} config.prefix - Prefix for input IDs to avoid collisions (e.g., 'edit', 'create')
   * @param {Object} config.initialData - Initial data to populate the form
   * @param {boolean} config.isReadOnly - Whether the form is read-only
   * @param {boolean} config.showChristmasCode - Whether to show Christmas code field
   */
  constructor(config = {}) {
    this.containerId = config.containerId;
    this.prefix = config.prefix || 'booking';
    this.initialData = config.initialData || {};
    this.isReadOnly = config.isReadOnly || false;
    this.showChristmasCode = config.showChristmasCode || false;

    this.container = document.getElementById(this.containerId);
  }

  /**
   * Render the form into the container
   */
  render() {
    if (!this.container) {
      console.error(`BookingContactForm: Container #${this.containerId} not found`);
      return;
    }

    const p = this.prefix;
    const d = this.initialData;
    const ro = this.isReadOnly ? 'disabled' : '';

    this.container.innerHTML = `
      <div class="booking-contact-form">
        <h3 data-translate="contactDetails">Kontaktní údaje</h3>
        
        <div class="input-group">
          <label for="${p}Name" data-translate="fullName">Jméno a příjmení *</label>
          <input type="text" id="${p}Name" value="${this.escapeHtml(d.name || '')}" required minlength="3" ${ro} />
        </div>

        <div class="input-group">
          <label for="${p}Email" data-translate="email">Email *</label>
          <input type="email" id="${p}Email" value="${this.escapeHtml(d.email || '')}" required ${ro} />
        </div>

        <div class="input-group">
          <label for="${p}Phone" data-translate="phone">Telefon *</label>
          <div class="phone-input-container">
            <select id="${p}PhonePrefix" class="phone-prefix-select" ${ro}>
              <option value="+420" ${this.isSelectedPrefix(d.phone, '+420')}>+420 (CZ)</option>
              <option value="+421" ${this.isSelectedPrefix(d.phone, '+421')}>+421 (SK)</option>
              <option value="+1" ${this.isSelectedPrefix(d.phone, '+1')}>+1 (US)</option>
              <option value="+44" ${this.isSelectedPrefix(d.phone, '+44')}>+44 (UK)</option>
              <option value="+49" ${this.isSelectedPrefix(d.phone, '+49')}>+49 (DE)</option>
              <option value="+33" ${this.isSelectedPrefix(d.phone, '+33')}>+33 (FR)</option>
              <option value="+43" ${this.isSelectedPrefix(d.phone, '+43')}>+43 (AT)</option>
              <option value="+48" ${this.isSelectedPrefix(d.phone, '+48')}>+48 (PL)</option>
              <option value="+386" ${this.isSelectedPrefix(d.phone, '+386')}>+386 (SI)</option>
            </select>
            <input type="tel" id="${p}Phone" class="phone-number-input" 
                   value="${this.formatPhoneNumber(d.phone)}" 
                   placeholder="123 456 789" required ${ro} />
          </div>
        </div>

        <h3 data-translate="billingDetails" style="margin-top: 1.5rem;">Fakturační údaje</h3>

        <div class="input-group">
          <label for="${p}Company" data-translate="company">Firma</label>
          <input type="text" id="${p}Company" value="${this.escapeHtml(d.company || '')}" ${ro} />
        </div>

        <div class="input-group">
          <label for="${p}Address" data-translate="address">Ulice a číslo *</label>
          <input type="text" id="${p}Address" value="${this.escapeHtml(d.address || '')}" required minlength="5" ${ro} />
        </div>

        <div style="display: grid; grid-template-columns: 2fr 1fr; gap: 1rem;">
          <div class="input-group">
            <label for="${p}City" data-translate="city">Město *</label>
            <input type="text" id="${p}City" value="${this.escapeHtml(d.city || '')}" required minlength="2" ${ro} />
          </div>
          <div class="input-group">
            <label for="${p}Zip" data-translate="zip">PSČ *</label>
            <input type="text" id="${p}Zip" value="${this.escapeHtml(d.zip || '')}" required pattern="[0-9]{5}" maxlength="5" ${ro} />
          </div>
        </div>

        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem;">
          <div class="input-group">
            <label for="${p}Ico" data-translate="ico">IČO</label>
            <input type="text" id="${p}Ico" value="${this.escapeHtml(d.ico || '')}" maxlength="8" ${ro} />
          </div>
          <div class="input-group">
            <label for="${p}Dic" data-translate="dic">DIČ</label>
            <input type="text" id="${p}Dic" value="${this.escapeHtml(d.dic || '')}" placeholder="CZ12345678" ${ro} />
          </div>
        </div>

        <div class="input-group">
          <label for="${p}Notes" data-translate="notes">Poznámky</label>
          <textarea id="${p}Notes" rows="3" ${ro}>${this.escapeHtml(d.notes || '')}</textarea>
        </div>

        ${this.renderChristmasCodeField(p, d, ro)}

        <div class="input-group" style="margin-top: 1rem;">
          <label style="display: flex; align-items: center; gap: 0.5rem; cursor: pointer;">
            <input type="checkbox" id="${p}PayFromBenefit" style="width: auto; margin: 0;" 
                   ${d.payFromBenefit ? 'checked' : ''} ${ro} />
            <span data-translate="paymentFromBenefit">Platba z benefitů</span>
          </label>
        </div>
      </div>
    `;

    this.attachEventListeners();

    // Apply translations after dynamic render
    if (typeof langManager !== 'undefined' && langManager.applyTranslations) {
      langManager.applyTranslations();
    }
  }

  renderChristmasCodeField(p, d, ro) {
    const displayStyle = this.showChristmasCode ? 'block' : 'none';
    return `
      <div class="input-group" id="${p}ChristmasCodeGroup" style="display: ${displayStyle};">
        <label for="${p}ChristmasCode" data-translate="christmasCodeLabel">Vánoční přístupový kód</label>
        <input type="text" id="${p}ChristmasCode" value="${this.escapeHtml(d.christmasCode || '')}" 
               placeholder="" data-translate-placeholder="christmasCodePlaceholder" ${ro} />
        <small style="color: var(--warning-color); display: block; margin-top: 0.25rem;" data-translate="christmasCodeRequired">
          Pro rezervace ve vánočním období je vyžadován přístupový kód
        </small>
      </div>
    `;
  }

  attachEventListeners() {
    if (this.isReadOnly) {
      return;
    }

    const p = this.prefix;

    // Phone validation
    const phoneInput = document.getElementById(`${p}Phone`);
    if (phoneInput) {
      phoneInput.addEventListener('input', (e) => {
        // Allow spaces for formatting
        const val = e.target.value.replace(/[^0-9\s]/g, '');
        e.target.value = val;
      });
    }

    // ZIP validation
    const zipInput = document.getElementById(`${p}Zip`);
    if (zipInput) {
      zipInput.addEventListener('input', (e) => {
        e.target.value = e.target.value.replace(/[^0-9]/g, '').slice(0, 5);
      });
    }

    // ICO validation
    const icoInput = document.getElementById(`${p}Ico`);
    if (icoInput) {
      icoInput.addEventListener('input', (e) => {
        e.target.value = e.target.value.replace(/[^0-9]/g, '').slice(0, 8);
      });
    }
  }

  /**
   * Collect data from the form
   * @returns {Object} Form data
   */
  getData() {
    const p = this.prefix;
    const getVal = (id) => document.getElementById(`${p}${id}`)?.value.trim() || '';
    const getChecked = (id) => document.getElementById(`${p}${id}`)?.checked || false;

    // Combine phone prefix and number
    const phonePrefix = document.getElementById(`${p}PhonePrefix`)?.value || '+420';
    const phoneNumber = getVal('Phone').replace(/\s/g, '');

    return {
      name: getVal('Name'),
      email: getVal('Email'),
      phone: phoneNumber ? `${phonePrefix}${phoneNumber}` : '',
      company: getVal('Company'),
      address: getVal('Address'),
      city: getVal('City'),
      zip: getVal('Zip'),
      ico: getVal('Ico'),
      dic: getVal('Dic'),
      notes: getVal('Notes'),
      christmasCode: getVal('ChristmasCode'),
      payFromBenefit: getChecked('PayFromBenefit'),
    };
  }

  /**
   * Validate the form data
   * @returns {Object} { valid: boolean, error: string }
   */
  validate() {
    const data = this.getData();
    const lang = typeof langManager !== 'undefined' ? langManager.currentLang : 'cs';

    // Required fields
    if (!data.name || !data.email || !data.phone || !data.address || !data.city || !data.zip) {
      return {
        valid: false,
        error:
          lang === 'cs'
            ? 'Vyplňte prosím všechna povinná pole označená hvězdičkou (*)'
            : 'Please fill in all required fields marked with asterisk (*)',
      };
    }

    // Email validation
    if (!ValidationUtils.validateEmail(data.email)) {
      return {
        valid: false,
        error: ValidationUtils.getValidationError('email', data.email, lang),
      };
    }

    // Phone validation
    if (!ValidationUtils.validatePhone(data.phone)) {
      return {
        valid: false,
        error: ValidationUtils.getValidationError('phone', data.phone, lang),
      };
    }

    // ZIP validation
    if (!ValidationUtils.validateZIP(data.zip)) {
      return {
        valid: false,
        error: ValidationUtils.getValidationError('zip', data.zip, lang),
      };
    }

    // ICO validation (optional)
    if (data.ico && !ValidationUtils.validateICO(data.ico)) {
      return {
        valid: false,
        error: ValidationUtils.getValidationError('ico', data.ico, lang),
      };
    }

    // DIC validation (optional)
    if (data.dic && !ValidationUtils.validateDIC(data.dic)) {
      return {
        valid: false,
        error: ValidationUtils.getValidationError('dic', data.dic, lang),
      };
    }

    // Christmas code validation
    if (this.showChristmasCode && !data.christmasCode) {
      return {
        valid: false,
        error:
          lang === 'cs'
            ? 'Vánoční přístupový kód je vyžadován'
            : 'Christmas access code is required',
      };
    }

    return { valid: true };
  }

  // FIX 2025-12-08: Delegate to DOMUtils (SSOT for HTML escaping)
  escapeHtml(unsafe) {
    return DOMUtils.escapeHtml(unsafe);
  }

  isSelectedPrefix(fullPhone, prefix) {
    if (!fullPhone) {
      return prefix === '+420' ? 'selected' : '';
    }
    return fullPhone.startsWith(prefix) ? 'selected' : '';
  }

  formatPhoneNumber(fullPhone) {
    if (!fullPhone) {
      return '';
    }
    // Remove prefix if present to show just the number part
    if (fullPhone.startsWith('+')) {
      // Simple heuristic: remove first 4 chars for +420/+421, else try to guess
      if (fullPhone.startsWith('+420') || fullPhone.startsWith('+421')) {
        return fullPhone.slice(4);
      }
      // For others, we might need more complex logic or just return as is if it doesn't match selected prefix
      // But since we select the prefix in the dropdown, we should strip it here
      const prefix = document.getElementById(`${this.prefix}PhonePrefix`)?.value;
      if (prefix && fullPhone.startsWith(prefix)) {
        return fullPhone.slice(prefix.length);
      }
    }
    return fullPhone;
  }
}

// Export
if (typeof module !== 'undefined' && module.exports) {
  module.exports = BookingContactForm;
} else if (typeof window !== 'undefined') {
  window.BookingContactForm = BookingContactForm;
}
