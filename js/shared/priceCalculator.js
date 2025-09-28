class PriceCalculator {
  static calculateRoomPrice(roomType, guestType, adults, children, nights, settings) {
    const prices = settings.prices[guestType][roomType];

    const adultsPrice = prices.base + Math.max(0, adults - 1) * prices.adult;
    const childrenPrice = children * prices.child;
    const nightPrice = adultsPrice + childrenPrice;

    return nightPrice * nights;
  }

  static calculateBulkPrice(nights, utiaAdults, utiaChildren, externalAdults, externalChildren) {
    const basePrice = 2000;
    const utiaAdultPrice = 100;
    const utiaChildPrice = 0;
    const externalAdultPrice = 250;
    const externalChildPrice = 50;

    const nightlyPrice =
      basePrice +
      utiaAdults * utiaAdultPrice +
      utiaChildren * utiaChildPrice +
      externalAdults * externalAdultPrice +
      externalChildren * externalChildPrice;

    return nightlyPrice * nights;
  }

  static calculateTotalPrice(rooms, guestType, adults, children, nights, settings) {
    let totalPrice = 0;

    rooms.forEach((roomId) => {
      const room = settings.rooms.find((r) => r.id === roomId);
      if (room) {
        const roomType = room.type;
        const roomAdults = Math.min(adults, room.beds);
        const roomChildren = Math.max(0, Math.min(children, room.beds - roomAdults));

        totalPrice += this.calculateRoomPrice(
          roomType,
          guestType,
          roomAdults,
          roomChildren,
          nights,
          settings
        );

        adults -= roomAdults;
        children -= roomChildren;
      }
    });

    return totalPrice;
  }

  static formatPrice(price, lang = 'cs') {
    return new Intl.NumberFormat(lang === 'cs' ? 'cs-CZ' : 'en-US', {
      style: 'currency',
      currency: 'CZK',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(price);
  }

  static getPriceBreakdown(rooms, guestType, adults, children, nights, settings, lang = 'cs') {
    const breakdown = [];
    let remainingAdults = adults;
    let remainingChildren = children;

    rooms.forEach((roomId) => {
      const room = settings.rooms.find((r) => r.id === roomId);
      if (room) {
        const roomAdults = Math.min(remainingAdults, room.beds);
        const roomChildren = Math.max(0, Math.min(remainingChildren, room.beds - roomAdults));

        const roomPrice = this.calculateRoomPrice(
          room.type,
          guestType,
          roomAdults,
          roomChildren,
          nights,
          settings
        );

        breakdown.push({
          roomName: room.name,
          adults: roomAdults,
          children: roomChildren,
          price: roomPrice,
          priceFormatted: this.formatPrice(roomPrice, lang),
        });

        remainingAdults -= roomAdults;
        remainingChildren -= roomChildren;
      }
    });

    return breakdown;
  }
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = PriceCalculator;
}
