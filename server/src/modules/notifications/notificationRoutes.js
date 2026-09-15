const express = require('express');
const {authMiddleware} = require('../../middleware/auth');
const {asyncHandler} = require('../../middleware/asyncHandler');
const controller = require('./notificationController');

const router = express.Router();
router.use(authMiddleware);
router.get('/', asyncHandler(controller.list));
router.patch('/:id/read', asyncHandler(controller.markRead));
router.patch('/read-all', asyncHandler(controller.markAllRead));

module.exports = router;
