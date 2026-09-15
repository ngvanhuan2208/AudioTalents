const {success} = require('../../utils/response');
const {search} = require('./searchService');
async function query(req, res) { return success(res, 'Search results retrieved', await search({...req.query, keyword: req.query.q || req.query.keyword || ''})); }
module.exports = {query};
