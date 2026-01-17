const validateVpa = (vpa) => {
    // Pattern: ^[a-zA-Z0-9._-]+@[a-zA-Z0-9]+$
    const regex = /^[a-zA-Z0-9._-]+@[a-zA-Z0-9]+$/;
    if (!regex.test(vpa)) return false;
    // Check for double @ or space (already covered by regex but being explicit based on reqs)
    if (vpa.includes(' ') || (vpa.match(/@/g) || []).length !== 1) return false;
    return true;
};

const validateLuhn = (cardNumber) => {
    // Remove spaces and dashes
    const cleanNum = cardNumber.replace(/[\s-]/g, '');

    // Check length 13-19 digits
    if (!/^\d{13,19}$/.test(cleanNum)) return false;

    let sum = 0;
    let shouldDouble = false;
    // Loop from right to left
    for (let i = cleanNum.length - 1; i >= 0; i--) {
        let digit = parseInt(cleanNum.charAt(i));

        if (shouldDouble) {
            digit *= 2;
            if (digit > 9) digit -= 9;
        }

        sum += digit;
        shouldDouble = !shouldDouble;
    }
    return (sum % 10) === 0;
};

const getCardNetwork = (cardNumber) => {
    const cleanNum = cardNumber.replace(/[\s-]/g, '');
    if (cleanNum.startsWith('4')) return 'visa';

    // Mastercard: 51-55
    const firstTwo = parseInt(cleanNum.substring(0, 2));
    if (firstTwo >= 51 && firstTwo <= 55) return 'mastercard';

    // Amex: 34, 37
    if (cleanNum.startsWith('34') || cleanNum.startsWith('37')) return 'amex';

    // RuPay: 60, 65, 81-89
    if (cleanNum.startsWith('60') || cleanNum.startsWith('65') || (firstTwo >= 81 && firstTwo <= 89)) return 'rupay';

    return 'unknown';
};

const validateExpiry = (month, year) => {
    // Convert to integers
    const m = parseInt(month, 10);
    let y = parseInt(year, 10);

    // Validate month range
    if (isNaN(m) || m < 1 || m > 12) return false;
    if (isNaN(y)) return false;

    // Convert 2-digit year to 4-digit year (assume 20xx)
    if (y < 100) y += 2000;

    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth() + 1; // 0-indexed

    // Check expiry
    if (y < currentYear) return false;
    if (y === currentYear && m < currentMonth) return false;

    return true;
};

module.exports = {
    validateVpa,
    validateLuhn,
    getCardNetwork,
    validateExpiry
};
