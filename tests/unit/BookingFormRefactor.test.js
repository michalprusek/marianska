/**
 * @jest-environment jsdom
 */

const BookingFormModule = require('../../js/booking-form.js');
const BookingContactForm = require('../../js/shared/BookingContactForm.js');

// Mock dependencies
global.BookingContactForm = BookingContactForm;
global.ValidationUtils = {
    validateEmail: jest.fn().mockReturnValue(true),
    validatePhoneNumber: jest.fn().mockReturnValue(true),
    getValidationError: jest.fn().mockReturnValue('Error')
};
global.dataManager = {
    getSettings: jest.fn().mockResolvedValue({ christmasPeriod: { start: '2025-12-20' } }),
    isChristmasPeriod: jest.fn().mockResolvedValue(false),
    checkChristmasAccessRequirement: jest.fn().mockReturnValue({ showCodeField: false, blockBulk: false }),
    formatDate: jest.fn(d => d.toISOString().split('T')[0])
};

describe('BookingFormModule Refactor', () => {
    let bookingForm;
    let appMock;

    beforeEach(() => {
        document.body.innerHTML = `
      <div id="bookingFormModal">
        <form id="bookingForm">
          <div id="bookingContactFormContainer"></div>
          <button id="bookingFormCancelBtn">Cancel</button>
        </form>
      </div>
    `;

        appMock = {
            showNotification: jest.fn(),
            currentLanguage: 'cs',
            tempReservations: [],
            isFinalizingReservations: true
        };

        bookingForm = new BookingFormModule(appMock);

        // Mock NotificationManager
        window.notificationManager = {
            show: jest.fn()
        };
    });

    test('renderContactForm initializes BookingContactForm', () => {
        bookingForm.renderContactForm();

        expect(bookingForm.contactForm).toBeDefined();
        expect(bookingForm.contactForm).toBeInstanceOf(BookingContactForm);

        const container = document.getElementById('bookingContactFormContainer');
        expect(container.innerHTML).toContain('booking-contact-form');
    });

    test('submitBooking uses BookingContactForm validation', async () => {
        bookingForm.renderContactForm();

        // Mock validate to return false
        jest.spyOn(bookingForm.contactForm, 'validate').mockReturnValue({ valid: false, error: 'Validation Error' });

        await bookingForm.submitBooking();

        expect(appMock.showNotification).toHaveBeenCalledWith('Validation Error', 'error');
    });

    test('submitBooking collects data from BookingContactForm', async () => {
        bookingForm.renderContactForm();

        // Mock validate to return true
        jest.spyOn(bookingForm.contactForm, 'validate').mockReturnValue({ valid: true });

        // Mock getData
        const mockData = {
            name: 'John Doe',
            email: 'john@example.com',
            phone: '+420123456789',
            address: 'Main St 1',
            city: 'Prague',
            zip: '11000'
        };
        jest.spyOn(bookingForm.contactForm, 'getData').mockReturnValue(mockData);

        // Mock dataManager.createBooking to succeed
        global.dataManager.createBooking = jest.fn().mockResolvedValue('booking-id');

        // Setup temp reservation
        appMock.tempReservations = [{
            roomId: 'room1',
            startDate: '2025-01-01',
            endDate: '2025-01-02',
            guests: { adults: 1 },
            guestType: 'utia'
        }];

        await bookingForm.submitBooking();

        expect(global.dataManager.createBooking).toHaveBeenCalled();
        const bookingArg = global.dataManager.createBooking.mock.calls[0][0];
        expect(bookingArg.name).toBe('John Doe');
        expect(bookingArg.email).toBe('john@example.com');
    });
});
