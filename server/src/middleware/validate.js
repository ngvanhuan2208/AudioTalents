const {AppError} = require('../utils/AppError');

function validate(schema) {
  return (req, res, next) => {
    const errors = schema(req.body, req.query, req.params);
    if (errors.length) return next(new AppError('Validation failed', 422, 'VALIDATION_ERROR', {fields: errors}));
    next();
  };
}

function required(fields) {
  return body => fields.filter(field => body[field] === undefined || body[field] === null || body[field] === '');
}

module.exports = {validate, required};
