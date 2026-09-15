const express = require('express');
const {getHealth} = require('../controllers/healthController');
const {success} = require('../utils/response');
const {asyncHandler} = require('../middleware/asyncHandler');
const {authMiddleware, optionalAuth} = require('../middleware/auth');
const {roleMiddleware} = require('../middleware/roles');
const {ROLES} = require('../constants/roles');
const authRoutes = require('../modules/auth/authRoutes');
const userRoutes = require('../modules/users/userRoutes');
const creatorRoutes = require('../modules/creators/creatorRoutes');
const storyRoutes = require('../modules/stories/storyRoutes');
const chapterRoutes = require('../modules/chapters/chapterRoutes');
const genreRoutes = require('../modules/genres/genreRoutes');
const taxonomyRoutes = require('../modules/taxonomy/taxonomyRoutes');
const taxonomyProposalRoutes = require('../modules/taxonomy/taxonomyProposalRoutes');
const audioRoutes = require('../modules/audio/audioRoutes');
const audioController = require('../modules/audio/audioController');
const libraryRoutes = require('../modules/library/libraryRoutes');
const notificationRoutes = require('../modules/notifications/notificationRoutes');
const playlistRoutes = require('../modules/playlists/playlistRoutes');
const communityRoutes = require('../modules/community/communityRoutes');
const searchRoutes = require('../modules/search/searchRoutes');
const authorApplicationRoutes = require('../modules/authorApplications/authorApplicationRoutes');
const adminRoutes = require('../modules/admin/adminRoutes');

const router = express.Router();
router.get('/health', getHealth);
router.use('/auth', authRoutes);
router.use('/author-applications', authorApplicationRoutes);
router.use('/users', userRoutes);
router.use('/creators', creatorRoutes);
router.use('/creator', creatorRoutes);
router.use('/', chapterRoutes);
router.use('/', communityRoutes);
router.use('/stories', storyRoutes);
router.use('/genres', genreRoutes);
router.use('/tags', taxonomyRoutes);
router.use('/taxonomy-proposals', taxonomyProposalRoutes);
router.use('/audio', audioRoutes);
router.get('/chapters/:chapterId/audio', optionalAuth, asyncHandler(audioController.listPublic));
router.use('/library', libraryRoutes);
router.use('/playlists', playlistRoutes);

function modulePlaceholder(moduleName, options = {}) {
  const middleware = options.adminOnly ? [authMiddleware, roleMiddleware(ROLES.ADMIN)] : options.auth ? [authMiddleware] : [];
  return [...middleware, (req, res) => success(res, `${moduleName} module is ready for implementation`, {module: moduleName, implemented: false})];
}

router.use('/notifications', notificationRoutes);
router.use('/search', searchRoutes);
router.get('/analytics', ...modulePlaceholder('analytics', {auth: true}));
router.get('/membership', ...modulePlaceholder('membership', {auth: true}));
router.use('/admin', adminRoutes);

module.exports = router;
