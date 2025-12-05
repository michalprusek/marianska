/**
 * Unit tests for BookingContactForm
 * Tests validation logic and escapeHtml for XSS prevention
 */

// Mock ValidationUtils
const ValidationUtils = {
    validateEmail: jest.fn((email) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)),
    validatePhone: jest.fn((phone) => /^\+?[0-9]{9,15}$/.test(phone.replace(/\s/g, ''))),
    validateZIP: jest.fn((zip) => /^[0-9]{5}$/.test(zip)),
    validateICO: jest.fn((ico) => !ico || /^[0-9]{8}$/.test(ico)),
    validateDIC: jest.fn((dic) => !dic || /^[A-Z]{2}[0-9]{8,10}$/.test(dic)),
    getValidationError: jest.fn((field, value, lang) => {
        const errors = {
            email: 'Invalid email format',
            phone: 'Invalid phone format',
            zip: 'Invalid ZIP code',
            ico: 'Invalid ICO',
            dic: 'Invalid DIC',
        };
        return errors[field] || 'Validation error';
    }),
};

global.ValidationUtils = ValidationUtils;

// Mock langManager
global.langManager = { currentLang: 'cs' };

// Mock document
let mockElements = {};

// We need a fresh mock for each test since mockElements changes
const createDocumentMock = () => ({
    getElementById: (id) => {
        const el = mockElements[id];
        if (!el) return null;
        // Return object with string value that has .trim() method
        return {
            value: el.value || '',
            checked: el.checked || false,
        };
    },
    createElement: (tag) => ({
        textContent: '',
        innerHTML: '',
        style: {},
        appendChild: jest.fn(),
    }),
});

Object.defineProperty(global, 'document', {
    get: () => createDocumentMock(),
    configurable: true
});

// Require the module
const BookingContactForm = require('../../js/shared/BookingContactForm');

describe('BookingContactForm', () => {
    let form;

    beforeEach(() => {
        jest.clearAllMocks();
        mockElements = {};

        // Create a basic form instance
        form = new BookingContactForm({
            containerId: 'testContainer',
            prefix: 'test',
            initialData: {},
            showChristmasCode: false,
        });
    });

    // Helper to set up mock elements for getData/validate testing
    const setupMockElements = (overrides = {}) => {
        const defaults = {
            testName: { value: 'Jan Novák' },
            testEmail: { value: 'jan@example.com' },
            testPhone: { value: '123456789' },
            testPhonePrefix: { value: '+420' },
            testAddress: { value: 'Hlavní 123' },
            testCity: { value: 'Praha' },
            testZip: { value: '12345' },
            testCompany: { value: '' },
            testIco: { value: '' },
            testDic: { value: '' },
            testNotes: { value: '' },
            testChristmasCode: { value: '' },
            testPayFromBenefit: { checked: false },
        };
        mockElements = { ...defaults, ...overrides };
    };

    describe('escapeHtml', () => {
        test('should escape HTML script tags', () => {
            const malicious = '<script>alert("xss")</script>';
            const escaped = form.escapeHtml(malicious);
            expect(escaped).not.toContain('<script>');
            expect(escaped).toContain('&lt;script&gt;');
        });

        test('should escape angle brackets', () => {
            const input = '<div onclick="evil()">Click me</div>';
            const escaped = form.escapeHtml(input);
            expect(escaped).not.toContain('<div');
            expect(escaped).toContain('&lt;div');
        });

        test('should escape ampersands', () => {
            const input = 'foo & bar';
            const escaped = form.escapeHtml(input);
            expect(escaped).toBe('foo &amp; bar');
        });

        test('should escape double quotes', () => {
            const input = 'He said "hello"';
            const escaped = form.escapeHtml(input);
            expect(escaped).toContain('&quot;');
        });

        test('should escape single quotes', () => {
            const input = "It's a test";
            const escaped = form.escapeHtml(input);
            expect(escaped).toContain('&#039;');
        });

        test('should handle null/undefined gracefully', () => {
            expect(form.escapeHtml(null)).toBe('');
            expect(form.escapeHtml(undefined)).toBe('');
            expect(form.escapeHtml('')).toBe('');
        });

        test('should preserve safe text', () => {
            const safeText = 'Hello World 123';
            expect(form.escapeHtml(safeText)).toBe(safeText);
        });

        test('should handle Czech characters', () => {
            const czech = 'Příliš žluťoučký kůň';
            expect(form.escapeHtml(czech)).toBe(czech);
        });
    });

    describe('validate', () => {
        beforeEach(() => {
            // Set up mock form elements with valid data
            setupMockElements();

            // Reset validation mocks
            ValidationUtils.validateEmail.mockReturnValue(true);
            ValidationUtils.validatePhone.mockReturnValue(true);
            ValidationUtils.validateZIP.mockReturnValue(true);
            ValidationUtils.validateICO.mockReturnValue(true);
            ValidationUtils.validateDIC.mockReturnValue(true);
        });

        test('should return valid for complete valid data', () => {
            const result = form.validate();
            expect(result.valid).toBe(true);
        });

        test('should return invalid for missing required name', () => {
            mockElements.testName.value = '';
            const result = form.validate();
            expect(result.valid).toBe(false);
            expect(result.error).toContain('povinná pole');
        });

        test('should return invalid for missing required email', () => {
            mockElements.testEmail.value = '';
            const result = form.validate();
            expect(result.valid).toBe(false);
        });

        test('should return invalid for missing required phone', () => {
            mockElements.testPhone.value = '';
            const result = form.validate();
            expect(result.valid).toBe(false);
        });

        test('should return invalid for missing required address', () => {
            mockElements.testAddress.value = '';
            const result = form.validate();
            expect(result.valid).toBe(false);
        });

        test('should return invalid for missing required city', () => {
            mockElements.testCity.value = '';
            const result = form.validate();
            expect(result.valid).toBe(false);
        });

        test('should return invalid for missing required zip', () => {
            mockElements.testZip.value = '';
            const result = form.validate();
            expect(result.valid).toBe(false);
        });

        test('should call email validation', () => {
            form.validate();
            expect(ValidationUtils.validateEmail).toHaveBeenCalledWith('jan@example.com');
        });

        test('should return invalid for invalid email', () => {
            ValidationUtils.validateEmail.mockReturnValue(false);
            const result = form.validate();
            expect(result.valid).toBe(false);
        });

        test('should call phone validation', () => {
            form.validate();
            expect(ValidationUtils.validatePhone).toHaveBeenCalledWith('+420123456789');
        });

        test('should return invalid for invalid phone', () => {
            ValidationUtils.validatePhone.mockReturnValue(false);
            const result = form.validate();
            expect(result.valid).toBe(false);
        });

        test('should call ZIP validation', () => {
            form.validate();
            expect(ValidationUtils.validateZIP).toHaveBeenCalledWith('12345');
        });

        test('should return invalid for invalid ZIP', () => {
            ValidationUtils.validateZIP.mockReturnValue(false);
            const result = form.validate();
            expect(result.valid).toBe(false);
        });

        test('should validate optional ICO if provided', () => {
            mockElements.testIco.value = '12345678';
            form.validate();
            expect(ValidationUtils.validateICO).toHaveBeenCalledWith('12345678');
        });

        test('should return invalid for invalid ICO', () => {
            mockElements.testIco.value = '123'; // Invalid ICO
            ValidationUtils.validateICO.mockReturnValue(false);
            const result = form.validate();
            expect(result.valid).toBe(false);
        });

        test('should validate optional DIC if provided', () => {
            mockElements.testDic.value = 'CZ12345678';
            form.validate();
            expect(ValidationUtils.validateDIC).toHaveBeenCalledWith('CZ12345678');
        });

        test('should return invalid for invalid DIC', () => {
            mockElements.testDic.value = 'INVALID';
            ValidationUtils.validateDIC.mockReturnValue(false);
            const result = form.validate();
            expect(result.valid).toBe(false);
        });
    });

    describe('validate with Christmas code', () => {
        beforeEach(() => {
            form = new BookingContactForm({
                containerId: 'testContainer',
                prefix: 'test',
                initialData: {},
                showChristmasCode: true, // Enable Christmas code
            });

            setupMockElements();

            // Reset validation mocks
            ValidationUtils.validateEmail.mockReturnValue(true);
            ValidationUtils.validatePhone.mockReturnValue(true);
            ValidationUtils.validateZIP.mockReturnValue(true);
            ValidationUtils.validateICO.mockReturnValue(true);
            ValidationUtils.validateDIC.mockReturnValue(true);
        });

        test('should require Christmas code when showChristmasCode is true', () => {
            mockElements.testChristmasCode.value = '';
            const result = form.validate();
            expect(result.valid).toBe(false);
            expect(result.error).toContain('přístupový kód');
        });

        test('should accept valid Christmas code', () => {
            mockElements.testChristmasCode.value = 'XMAS2024';
            const result = form.validate();
            expect(result.valid).toBe(true);
        });
    });

    describe('isSelectedPrefix', () => {
        test('should return selected for matching prefix', () => {
            expect(form.isSelectedPrefix('+420123456789', '+420')).toBe('selected');
        });

        test('should return empty for non-matching prefix', () => {
            expect(form.isSelectedPrefix('+420123456789', '+421')).toBe('');
        });

        test('should default to +420 when no phone provided', () => {
            expect(form.isSelectedPrefix('', '+420')).toBe('selected');
            expect(form.isSelectedPrefix(null, '+420')).toBe('selected');
        });

        test('should return empty for other prefixes when no phone', () => {
            expect(form.isSelectedPrefix('', '+421')).toBe('');
        });
    });

    describe('formatPhoneNumber', () => {
        test('should strip +420 prefix', () => {
            expect(form.formatPhoneNumber('+420123456789')).toBe('123456789');
        });

        test('should strip +421 prefix', () => {
            expect(form.formatPhoneNumber('+421123456789')).toBe('123456789');
        });

        test('should return empty string for empty input', () => {
            expect(form.formatPhoneNumber('')).toBe('');
            expect(form.formatPhoneNumber(null)).toBe('');
        });

        test('should return number without prefix as is', () => {
            expect(form.formatPhoneNumber('123456789')).toBe('123456789');
        });
    });

    describe('getData', () => {
        beforeEach(() => {
            setupMockElements({
                testName: { value: ' Jan Novák ' },
                testEmail: { value: ' jan@example.com ' },
                testPhone: { value: '123 456 789' },
                testPhonePrefix: { value: '+420' },
                testAddress: { value: 'Hlavní 123' },
                testCity: { value: 'Praha' },
                testZip: { value: '12345' },
                testCompany: { value: 'ACME s.r.o.' },
                testIco: { value: '12345678' },
                testDic: { value: 'CZ12345678' },
                testNotes: { value: 'Test notes' },
                testChristmasCode: { value: 'XMAS2024' },
                testPayFromBenefit: { checked: true },
            });
        });

        test('should collect and trim all form data', () => {
            const data = form.getData();

            expect(data.name).toBe('Jan Novák');
            expect(data.email).toBe('jan@example.com');
            expect(data.phone).toBe('+420123456789'); // Combined with prefix, spaces removed
            expect(data.address).toBe('Hlavní 123');
            expect(data.city).toBe('Praha');
            expect(data.zip).toBe('12345');
            expect(data.company).toBe('ACME s.r.o.');
            expect(data.ico).toBe('12345678');
            expect(data.dic).toBe('CZ12345678');
            expect(data.notes).toBe('Test notes');
            expect(data.christmasCode).toBe('XMAS2024');
            expect(data.payFromBenefit).toBe(true);
        });

        test('should handle missing optional fields', () => {
            mockElements.testCompany.value = '';
            mockElements.testIco.value = '';
            mockElements.testDic.value = '';
            mockElements.testNotes.value = '';

            const data = form.getData();

            expect(data.company).toBe('');
            expect(data.ico).toBe('');
            expect(data.dic).toBe('');
            expect(data.notes).toBe('');
        });

        test('should combine phone prefix and number correctly', () => {
            mockElements.testPhonePrefix.value = '+421';
            mockElements.testPhone.value = '987654321';

            const data = form.getData();

            expect(data.phone).toBe('+421987654321');
        });
    });
});
