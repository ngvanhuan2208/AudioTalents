const express = require('express');
const controller = require('./searchController');
const {asyncHandler} = require('../../middleware/asyncHandler');
const router = express.Router();
router.get('/', asyncHandler(controller.query));
module.exports = router;
