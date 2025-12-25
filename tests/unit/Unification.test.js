/**
 * @jest-environment jsdom
 */

// Mock dependencies
global.fetch = jest.fn(() =>
  Promise.resolve({
    ok: true,
    json: () => Promise.resolve({}),
  })
);

// FIX 2025-12-23: Mock DOMUtils which is used by NotificationManager
global.DOMUtils = {
  escapeHtml: (text) => {
    if (text === null || text === undefined) return 'null';
    return String(text)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  },
};

// Load classes
const { NotificationManager } = require('../../js/shared/NotificationManager.js');
const { ModalDialog } = require('../../js/shared/ModalDialog.js');

describe('Unification Verification', () => {
  let notificationManager;
  let modalDialog;

  beforeEach(() => {
    document.body.innerHTML = '';
    notificationManager = new NotificationManager();
    modalDialog = new ModalDialog();
    jest.clearAllMocks();
  });

  test('NotificationManager should show toast', () => {
    notificationManager.show('Test message', 'success');
    const toast = document.querySelector('.notification-toast');
    expect(toast).toBeTruthy();
    expect(toast.textContent).toContain('Test message');
    expect(toast.classList.contains('success')).toBe(true);
  });

  test('ModalDialog should open custom content', () => {
    const content = document.createElement('div');
    content.textContent = 'Custom Content';
    modalDialog.open({
      title: 'Test Modal',
      content: content,
    });

    const modal = document.querySelector('.modal-dialog');
    expect(modal).toBeTruthy();
    expect(modal.textContent).toContain('Test Modal');
    expect(modal.textContent).toContain('Custom Content');
  });

  test('ModalDialog.confirm should show confirmation dialog', async () => {
    const promise = modalDialog.confirm({
      title: 'Confirm',
      message: 'Are you sure?',
    });

    const modal = document.querySelector('.modal-dialog');
    expect(modal).toBeTruthy();
    expect(modal.textContent).toContain('Confirm');
    expect(modal.textContent).toContain('Are you sure?');

    // Simulate click
    const confirmBtn = document.querySelector('.modal-confirm-btn');
    confirmBtn.click();

    const result = await promise;
    expect(result).toBe(true);
  });
});
