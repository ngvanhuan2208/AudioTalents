const {AppError} = require('../utils/AppError');

function requireOwnership(getResource) {
  return async (req, res, next) => {
    try {
      if (req.user.role === 'ADMIN') return next();
      const resource = await getResource(req);
      if (!resource || resource.creatorId !== req.user.id) return next(new AppError('You do not own this content', 403, 'FORBIDDEN'));
      req.resource = resource;
      next();
    } catch (error) {
      next(error);
    }
  };
}

module.exports = {requireOwnership};
