const express = require('express');
const {asyncHandler} = require('../../middleware/asyncHandler');
const controller = require('./taxonomyController');
const router = express.Router();
router.get('/', asyncHandler(controller.listTags));
module.exports = router;
