function success(res, message, data = {}, statusCode = 200) {
  return res.status(statusCode).json({success: true, message, data});
}

function paginated(res, message, items, pagination) {
  return success(res, message, {items, pagination});
}

module.exports = {success, paginated};
