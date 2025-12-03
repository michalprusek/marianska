/**
 * CounterUI - Dynamic counter component for guest counts
 * SSOT for counter HTML structure and behavior
 *
 * Features:
 * - Creates counter groups with consistent structure
 * - Handles increment/decrement with min/max constraints
 * - Provides event callbacks (onChange)
 * - Supports different counter types (adults, children, toddlers)
 *
 * Usage:
 *   // Create a counter group
 *   const counterUI = new CounterUI({
 *     container: document.getElementById('guestCounters'),
 *     columns: 3,
 *     counters: [
 *       { id: 'adults', label: 'Dospeli', value: 1, min: 1, max: 26 },
 *       { id: 'children', label: 'Deti (3-17)', value: 0, min: 0, max: 26 },
 *       { id: 'toddlers', label: 'Batolata (0-3)', value: 0, min: 0, max: 26 }
 *     ],
 *     onChange: (id, value, allValues) => { /* handle change */ }
 *   });
 *
 *   // Update values programmatically
 *   counterUI.setValue('adults', 2);
 *
 *   // Get current values
 *   const values = counterUI.getValues(); // { adults: 2, children: 0, toddlers: 0 }
 */

class CounterUI {
  /**
   * @param {Object} options - Counter options
   * @param {HTMLElement} options.container - Container element for the counters
   * @param {number} [options.columns=3] - Number of columns (2 or 3)
   * @param {Array} options.counters - Array of counter configs
   * @param {Function} [options.onChange] - Callback when any counter changes
   */
  constructor(options) {
    const { container, columns = 3, counters = [], onChange = null } = options;

    this.container = container;
    this.columns = columns;
    this.counters = counters;
    this.onChange = onChange;
    this.elements = new Map(); // Store references to counter elements
    this.values = {}; // Current values

    // Initialize values
    counters.forEach((counter) => {
      this.values[counter.id] = counter.value ?? 0;
    });

    this.render();
  }

  /**
   * Render the counter group
   */
  render() {
    if (!this.container) {
      console.warn('CounterUI: No container provided');
      return;
    }

    // Clear container
    this.container.innerHTML = '';

    // Create wrapper with grid class
    const wrapper = document.createElement('div');
    wrapper.className = `guest-counters guest-counters--${this.columns}col`;

    // Create each counter
    this.counters.forEach((config) => {
      const counterItem = this.createCounterItem(config);
      wrapper.appendChild(counterItem);
    });

    this.container.appendChild(wrapper);
  }

  /**
   * Create a single counter item
   * @param {Object} config - Counter configuration
   * @returns {HTMLElement}
   */
  createCounterItem(config) {
    const { id, label, value = 0, min = 0, max = 99, translateKey = null } = config;

    // Counter item wrapper
    const item = document.createElement('div');
    item.className = 'counter-item';

    // Label
    const labelEl = document.createElement('label');
    labelEl.className = 'counter-label';
    labelEl.textContent = label;
    if (translateKey) {
      labelEl.setAttribute('data-translate', translateKey);
    }
    item.appendChild(labelEl);

    // Controls container
    const controls = document.createElement('div');
    controls.className = 'counter-controls';

    // Minus button
    const minusBtn = document.createElement('button');
    minusBtn.type = 'button';
    minusBtn.className = 'counter-btn';
    minusBtn.textContent = '-';
    minusBtn.setAttribute('aria-label', `Snizit ${label}`);
    minusBtn.addEventListener('click', () => this.adjust(id, -1));
    controls.appendChild(minusBtn);

    // Value display
    const valueEl = document.createElement('span');
    valueEl.className = 'counter-value';
    valueEl.id = `counter-${id}`;
    valueEl.textContent = value;
    valueEl.setAttribute('aria-live', 'polite');
    controls.appendChild(valueEl);

    // Plus button
    const plusBtn = document.createElement('button');
    plusBtn.type = 'button';
    plusBtn.className = 'counter-btn';
    plusBtn.textContent = '+';
    plusBtn.setAttribute('aria-label', `Zvysit ${label}`);
    plusBtn.addEventListener('click', () => this.adjust(id, 1));
    controls.appendChild(plusBtn);

    item.appendChild(controls);

    // Store element references
    this.elements.set(id, {
      item,
      valueEl,
      minusBtn,
      plusBtn,
      min,
      max,
    });

    // Update button states
    this.updateButtonStates(id);

    return item;
  }

  /**
   * Adjust counter value
   * @param {string} id - Counter ID
   * @param {number} delta - Change amount (+1 or -1)
   */
  adjust(id, delta) {
    const elements = this.elements.get(id);
    if (!elements) return;

    const { min, max } = elements;
    const currentValue = this.values[id] ?? 0;
    const newValue = Math.max(min, Math.min(max, currentValue + delta));

    if (newValue !== currentValue) {
      this.setValue(id, newValue);
    }
  }

  /**
   * Set counter value directly
   * @param {string} id - Counter ID
   * @param {number} value - New value
   */
  setValue(id, value) {
    const elements = this.elements.get(id);
    if (!elements) return;

    const { min, max, valueEl } = elements;
    const clampedValue = Math.max(min, Math.min(max, value));

    this.values[id] = clampedValue;
    valueEl.textContent = clampedValue;

    this.updateButtonStates(id);

    // Fire callback
    if (this.onChange) {
      this.onChange(id, clampedValue, { ...this.values });
    }
  }

  /**
   * Get current value for a counter
   * @param {string} id - Counter ID
   * @returns {number}
   */
  getValue(id) {
    return this.values[id] ?? 0;
  }

  /**
   * Get all current values
   * @returns {Object}
   */
  getValues() {
    return { ...this.values };
  }

  /**
   * Set all values at once
   * @param {Object} values - Object with id:value pairs
   */
  setValues(values) {
    Object.entries(values).forEach(([id, value]) => {
      if (this.elements.has(id)) {
        this.setValue(id, value);
      }
    });
  }

  /**
   * Update button disabled states based on min/max
   * @param {string} id - Counter ID
   * @private
   */
  updateButtonStates(id) {
    const elements = this.elements.get(id);
    if (!elements) return;

    const { min, max, minusBtn, plusBtn } = elements;
    const value = this.values[id] ?? 0;

    minusBtn.disabled = value <= min;
    plusBtn.disabled = value >= max;
  }

  /**
   * Update min/max constraints for a counter
   * @param {string} id - Counter ID
   * @param {Object} constraints - { min, max }
   */
  setConstraints(id, constraints) {
    const elements = this.elements.get(id);
    if (!elements) return;

    if (constraints.min !== undefined) {
      elements.min = constraints.min;
    }
    if (constraints.max !== undefined) {
      elements.max = constraints.max;
    }

    // Re-clamp current value to new constraints
    const currentValue = this.values[id] ?? 0;
    const clampedValue = Math.max(elements.min, Math.min(elements.max, currentValue));

    if (clampedValue !== currentValue) {
      this.setValue(id, clampedValue);
    } else {
      this.updateButtonStates(id);
    }
  }

  /**
   * Get total of all counter values
   * @returns {number}
   */
  getTotal() {
    return Object.values(this.values).reduce((sum, val) => sum + val, 0);
  }

  /**
   * Reset all counters to their initial values
   */
  reset() {
    this.counters.forEach((config) => {
      this.setValue(config.id, config.value ?? 0);
    });
  }

  /**
   * Destroy the counter UI and clean up
   */
  destroy() {
    if (this.container) {
      this.container.innerHTML = '';
    }
    this.elements.clear();
    this.values = {};
  }
}

// Factory function for common counter configurations
const CounterUIFactory = {
  /**
   * Create single room guest counters (adults, children, toddlers)
   * @param {HTMLElement} container
   * @param {Function} onChange
   * @returns {CounterUI}
   */
  createSingleRoomCounters(container, onChange) {
    return new CounterUI({
      container,
      columns: 3,
      counters: [
        {
          id: 'adults',
          label: 'Dospeli',
          translateKey: 'adultsLabel',
          value: 1,
          min: 1,
          max: 26,
        },
        {
          id: 'children',
          label: 'Deti (3-17)',
          translateKey: 'childrenLabel',
          value: 0,
          min: 0,
          max: 26,
        },
        {
          id: 'toddlers',
          label: 'Batolata (0-3)',
          translateKey: 'toddlersCount',
          value: 0,
          min: 0,
          max: 26,
        },
      ],
      onChange,
    });
  },

  /**
   * Create bulk booking guest counters (adults, children only)
   * @param {HTMLElement} container
   * @param {Function} onChange
   * @returns {CounterUI}
   */
  createBulkCounters(container, onChange) {
    return new CounterUI({
      container,
      columns: 2,
      counters: [
        {
          id: 'adults',
          label: 'Dospeli',
          translateKey: 'adultsLabel',
          value: 10,
          min: 1,
          max: 26,
        },
        {
          id: 'children',
          label: 'Deti (3-17)',
          translateKey: 'childrenLabel',
          value: 0,
          min: 0,
          max: 26,
        },
      ],
      onChange,
    });
  },
};

// Export for module systems
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { CounterUI, CounterUIFactory };
}
