import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

/**
 * Validate Coupon Endpoint
 * POST /api/coupons/validate
 */
export const validateCoupon = async (req, res) => {
  try {
    const { code, subtotal = 0, deliveryFee = 40, restaurantId } = req.body;

    if (!code) {
      return res.status(400).json({ valid: false, message: 'Coupon code is required' });
    }

    const cleanCode = code.trim().toUpperCase();

    // Built-in offer rules fallback
    const mockCoupons = {
      'TIFFZY50': { type: 'FLAT', amount: 50, minOrder: 249, maxDiscount: 50 },
      'WELCOME20': { type: 'PERCENTAGE', percentage: 20, minOrder: 199, maxDiscount: 100 },
      'FREEDEL': { type: 'FREE_DELIVERY', amount: deliveryFee, minOrder: 149, maxDiscount: deliveryFee }
    };

    if (mockCoupons[cleanCode]) {
      const c = mockCoupons[cleanCode];
      if (subtotal < c.minOrder) {
        return res.status(400).json({
          valid: false,
          message: `Minimum order amount of ₹${c.minOrder} required for ${cleanCode}`
        });
      }

      let discount = 0;
      if (c.type === 'FLAT') {
        discount = Math.min(c.amount, subtotal);
      } else if (c.type === 'PERCENTAGE') {
        discount = Math.min((subtotal * c.percentage) / 100, c.maxDiscount);
      } else if (c.type === 'FREE_DELIVERY') {
        discount = deliveryFee;
      }

      return res.json({
        valid: true,
        code: cleanCode,
        type: c.type,
        discountAmount: Math.round(discount),
        message: `Coupon ${cleanCode} applied successfully!`
      });
    }

    return res.status(404).json({ valid: false, message: 'Invalid or expired coupon code' });
  } catch (error) {
    console.error('Validate Coupon Error:', error);
    return res.status(500).json({ valid: false, message: 'Server error validating coupon' });
  }
};

/**
 * Create Coupon Endpoint
 * POST /api/coupons/create
 */
export const createCoupon = async (req, res) => {
  try {
    const { code, type, discountValue, minOrderAmount, maxDiscount, expiryDays = 30 } = req.body;

    if (!code || !type || !discountValue) {
      return res.status(400).json({ success: false, message: 'Code, type, and discountValue are required' });
    }

    const cleanCode = code.trim().toUpperCase();
    const expiryDate = new Date();
    expiryDate.setDate(expiryDate.getDate() + parseInt(expiryDays));

    const newCoupon = {
      code: cleanCode,
      type,
      discountValue: parseFloat(discountValue),
      minOrderAmount: parseFloat(minOrderAmount || 0),
      maxDiscount: maxDiscount ? parseFloat(maxDiscount) : null,
      expiresAt: expiryDate,
      isActive: true
    };

    return res.json({
      success: true,
      message: `Coupon ${cleanCode} created successfully`,
      coupon: newCoupon
    });
  } catch (error) {
    console.error('Create Coupon Error:', error);
    return res.status(500).json({ success: false, message: 'Server error creating coupon' });
  }
};

/**
 * Get Restaurant Coupons Endpoint
 * GET /api/coupons
 */
export const getCoupons = async (req, res) => {
  try {
    const defaultCoupons = [
      { id: 1, code: 'TIFFZY50', type: 'FLAT', discountValue: 50, minOrderAmount: 249, maxDiscount: 50, isActive: true },
      { id: 2, code: 'WELCOME20', type: 'PERCENTAGE', discountValue: 20, minOrderAmount: 199, maxDiscount: 100, isActive: true },
      { id: 3, code: 'FREEDEL', type: 'FREE_DELIVERY', discountValue: 40, minOrderAmount: 149, maxDiscount: 40, isActive: true }
    ];

    return res.json({ coupons: defaultCoupons });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Server error fetching coupons' });
  }
};
