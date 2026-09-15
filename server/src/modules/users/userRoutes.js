const express = require('express');
const {authMiddleware} = require('../../middleware/auth');
const {asyncHandler} = require('../../middleware/asyncHandler');
const controller = require('./userController');
const router = express.Router();
router.get('/me', authMiddleware, asyncHandler(controller.getMe));
router.patch('/me', authMiddleware, asyncHandler(controller.me));
router.get('/:id', asyncHandler(controller.getById));
module.exports = router;
