const express = require('express');
const {authMiddleware} = require('../../middleware/auth');
const {asyncHandler} = require('../../middleware/asyncHandler');
const controller = require('./taxonomyController');

const router = express.Router();
router.use(authMiddleware);
router.post('/', asyncHandler(controller.createProposal));
router.get('/', asyncHandler(controller.listProposals));
router.get('/:id', asyncHandler(controller.getProposal));
module.exports = router;
