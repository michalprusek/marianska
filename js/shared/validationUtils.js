class ValidationUtils {
  static validateEmail(email) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }

  static validatePhone(phone) {
    const cleanPhone = phone.replace(/\s/g, '');

    if (!cleanPhone.startsWith('+420') && !cleanPhone.startsWith('+421')) {
      return false;
    }

    const numberPart = cleanPhone.slice(4);
    return numberPart.length === 9 && /^\d+$/.test(numberPart);
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
    if (cleanPhone.startsWith('+420') || cleanPhone.startsWith('+421')) {
      const prefix = cleanPhone.slice(0, 4);
      const number = cleanPhone.slice(4);
      if (number.length === 9) {
        return `${prefix} ${number.slice(0, 3)} ${number.slice(3, 6)} ${number.slice(6)}`;
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
