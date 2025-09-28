class ValidationUtils {
  static validateEmail(email) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }

  static validatePhone(phone) {
    const cleanPhone = phone.replace(/\s/g, '');

    // Check if phone starts with + and some country code (1-4 digits)
    if (!cleanPhone.startsWith('+')) {
      return false;
    }

    // Extract the number part after the country code
    // Support various country code lengths (1-4 digits)
    const withoutPlus = cleanPhone.slice(1);

    // For Czech (+420) and Slovak (+421) - 3 digit country code + 9 digit number = 12 total
    if (cleanPhone.startsWith('+420') || cleanPhone.startsWith('+421')) {
      const numberPart = cleanPhone.slice(4);
      return numberPart.length === 9 && /^\d+$/.test(numberPart);
    }

    // For other country codes, just check that we have a reasonable phone length
    // Most international numbers are 7-15 digits total (including country code)
    return withoutPlus.length >= 7 && withoutPlus.length <= 15 && /^\d+$/.test(withoutPlus);
  }

  static validateZIP(zip) {
    const cleanZip = zip.replace(/\s/g, '');
    return cleanZip.length === 5 && /^\d+$/.test(cleanZip);
  }

  static validateICO(ico) {
    if (!ico) {
      return true;
    }
    const cleanIco = ico.replace(/\s/g, '');
    return cleanIco.length === 8 && /^\d+$/.test(cleanIco);
  }

  static validateDIC(dic) {
    if (!dic) {
      return true;
    }
    const cleanDic = dic.replace(/\s/g, '');
    return /^CZ\d{8,10}$/.test(cleanDic);
  }

  static formatPhone(phone) {
    const cleanPhone = phone.replace(/\s/g, '');

    // For Czech and Slovak numbers
    if (cleanPhone.startsWith('+420') || cleanPhone.startsWith('+421')) {
      const prefix = cleanPhone.slice(0, 4);
      const number = cleanPhone.slice(4);
      if (number.length === 9) {
        return `${prefix} ${number.slice(0, 3)} ${number.slice(3, 6)} ${number.slice(6)}`;
      }
    }

    // For other country codes, format based on detected prefix length
    if (cleanPhone.startsWith('+')) {
      // Find where the country code ends (usually 1-4 digits after +)
      let prefixLength = 1; // Start after '+'

      // Common country code patterns
      if (cleanPhone.startsWith('+1') || cleanPhone.startsWith('+7')) {
        prefixLength = 2; // USA, Canada, Russia
      } else if (cleanPhone.startsWith('+4') || cleanPhone.startsWith('+3')) {
        prefixLength = 3; // Most European countries
      } else if (
        cleanPhone.startsWith('+43') ||
        cleanPhone.startsWith('+48') ||
        cleanPhone.startsWith('+386')
      ) {
        prefixLength = cleanPhone.startsWith('+386') ? 4 : 3; // Austria, Poland, Slovenia
      } else {
        prefixLength = 3; // Default to 3 digits
      }

      const prefix = cleanPhone.slice(0, prefixLength);
      const number = cleanPhone.slice(prefixLength);

      // Format the number part in groups of 3
      if (number.length >= 6) {
        const formatted = number.match(/.{1,3}/g)?.join(' ') || number;
        return `${prefix} ${formatted}`;
      }
    }

    return phone;
  }

  static formatZIP(zip) {
    const cleanZip = zip.replace(/\s/g, '');
    if (cleanZip.length === 5) {
      return `${cleanZip.slice(0, 3)} ${cleanZip.slice(3)}`;
    }
    return zip;
  }

  static getValidationError(field, value, lang = 'cs') {
    const errors = {
      cs: {
        email: 'Neplatný formát emailu',
        phone: 'Telefon musí být ve formátu +420 nebo +421 následovaný 9 číslicemi',
        zip: 'PSČ musí obsahovat přesně 5 číslic',
        ico: 'IČO musí obsahovat přesně 8 číslic',
        dic: 'DIČ musí být ve formátu CZ následované 8-10 číslicemi',
        required: 'Toto pole je povinné',
      },
      en: {
        email: 'Invalid email format',
        phone: 'Phone must be in format +420 or +421 followed by 9 digits',
        zip: 'ZIP code must contain exactly 5 digits',
        ico: 'Company ID must contain exactly 8 digits',
        dic: 'VAT ID must be in format CZ followed by 8-10 digits',
        required: 'This field is required',
      },
    };

    switch (field) {
      case 'email':
        return !this.validateEmail(value) ? errors[lang].email : null;
      case 'phone':
        return !this.validatePhone(value) ? errors[lang].phone : null;
      case 'zip':
        return !this.validateZIP(value) ? errors[lang].zip : null;
      case 'ico':
        return !this.validateICO(value) ? errors[lang].ico : null;
      case 'dic':
        return !this.validateDIC(value) ? errors[lang].dic : null;
      default:
        return value ? null : errors[lang].required;
    }
  }
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = ValidationUtils;
}
