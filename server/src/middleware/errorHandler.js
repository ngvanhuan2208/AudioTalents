function notFound(req, res) {
  res.status(404).json({
    success: false,
    error: {
      code: 'NOT_FOUND',
      message: 'Route not found',
      details: {path: req.path}
    }
  });
}

function errorHandler(err, req, res, next) {
  const statusCode = err.statusCode || err.status || 500;
  const code = err.code || (statusCode === 500 ? 'INTERNAL_SERVER_ERROR' : 'REQUEST_ERROR');
  const message = err.message || 'Internal server error';
  if (statusCode >= 500) console.error(err);
  res.status(statusCode).json({
    success: false,
    error: {
      code,
      message,
      details: err.details || {}
    }
  });
}

module.exports = {notFound, errorHandler};
