const express = require('express');
const router = express.Router();
const couponController = require('../controllers/coupon.controller');

router.post('/validate', couponController.validateCoupon);
router.post('/create', couponController.createCoupon);
router.get('/', couponController.getCoupons);

module.exports = router;
