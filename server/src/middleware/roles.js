const {AppError} = require('../utils/AppError');

function roleMiddleware(...roles) {
  return (req, res, next) => {
    if (!req.user || !roles.includes(req.user.role)) return next(new AppError('Insufficient permissions', 403, 'FORBIDDEN'));
    next();
  };
}

module.exports = {roleMiddleware};
