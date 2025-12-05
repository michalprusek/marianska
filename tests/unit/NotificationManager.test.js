/**
 * Unit tests for NotificationManager
 * Tests the escapeHtml method for XSS prevention
 */

// Helper function to simulate browser's HTML escaping
const simulateHtmlEscape = (text) => {
    return text
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
};

// Mock document.createElement to simulate browser's textContent -> innerHTML conversion
const createDocumentMock = () => {
    return {
        createElement: (tagName) => {
            let _textContent = '';
            let _innerHTML = '';

            return {
                id: '',
                className: '',
                style: {},
                appendChild: jest.fn(),
                querySelector: jest.fn(),
                remove: jest.fn(),
                get textContent() {
                    return _textContent;
                },
                set textContent(val) {
                    _textContent = val;
                    // Simulate browser's HTML escaping when setting textContent
                    _innerHTML = simulateHtmlEscape(val);
                },
                get innerHTML() {
                    return _innerHTML;
                },
                set innerHTML(val) {
                    _innerHTML = val;
                },
            };
        },
        getElementById: () => null,
        head: {
            appendChild: jest.fn(),
        },
        body: {
            appendChild: jest.fn(),
        },
    };
};

Object.defineProperty(global, 'document', {
    get: () => createDocumentMock(),
    configurable: true,
});

// Now require the module
const { NotificationManager } = require('../../js/shared/NotificationManager');

describe('NotificationManager', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    describe('escapeHtml', () => {
        test('should escape HTML script tags', () => {
            const malicious = '<script>alert("xss")</script>';
            const escaped = NotificationManager.escapeHtml(malicious);
            expect(escaped).not.toContain('<script>');
            expect(escaped).not.toContain('</script>');
            expect(escaped).toContain('&lt;script&gt;');
        });

        test('should escape HTML angle brackets', () => {
            const input = '<div onclick="evil()">Click me</div>';
            const escaped = NotificationManager.escapeHtml(input);
            expect(escaped).not.toContain('<div');
            expect(escaped).not.toContain('</div>');
            expect(escaped).toContain('&lt;div');
        });

        test('should escape ampersands', () => {
            const input = 'foo & bar & baz';
            const escaped = NotificationManager.escapeHtml(input);
            expect(escaped).toContain('&amp;');
        });

        test('should escape double quotes', () => {
            const input = 'He said "hello"';
            const escaped = NotificationManager.escapeHtml(input);
            expect(escaped).toContain('&quot;');
        });

        test('should escape single quotes', () => {
            const input = "It's a test";
            const escaped = NotificationManager.escapeHtml(input);
            expect(escaped).toContain('&#039;');
        });

        test('should handle null and undefined gracefully', () => {
            expect(NotificationManager.escapeHtml(null)).toBe('null');
            expect(NotificationManager.escapeHtml(undefined)).toBe('undefined');
        });

        test('should convert non-string values to strings', () => {
            expect(NotificationManager.escapeHtml(123)).toBe('123');
            expect(NotificationManager.escapeHtml(true)).toBe('true');
            expect(NotificationManager.escapeHtml({ foo: 'bar' })).toBe('[object Object]');
        });

        test('should handle empty string', () => {
            expect(NotificationManager.escapeHtml('')).toBe('');
        });

        test('should preserve safe text without special characters', () => {
            const safeText = 'Hello World 123';
            expect(NotificationManager.escapeHtml(safeText)).toBe(safeText);
        });

        test('should escape complex XSS payloads', () => {
            const payloads = [
                '<img src=x onerror=alert(1)>',
                '"><script>alert(document.cookie)</script>',
                "javascript:alert('XSS')",
                '<svg onload=alert(1)>',
                '<body onload=alert(1)>',
            ];

            payloads.forEach((payload) => {
                const escaped = NotificationManager.escapeHtml(payload);
                // Should not contain unescaped angle brackets
                expect(escaped).not.toMatch(/<[a-z]/i);
            });
        });

        test('should handle Czech characters correctly', () => {
            const czech = 'Příliš žluťoučký kůň úpěl ďábelské ódy';
            const escaped = NotificationManager.escapeHtml(czech);
            expect(escaped).toBe(czech);
        });

        test('should handle emoji correctly', () => {
            const emoji = 'Hello 👋 World 🌍';
            const escaped = NotificationManager.escapeHtml(emoji);
            expect(escaped).toBe(emoji);
        });
    });

    describe('Static constants', () => {
        test('escapeHtml should be a static method', () => {
            expect(typeof NotificationManager.escapeHtml).toBe('function');
        });
    });
});
