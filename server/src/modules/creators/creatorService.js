const {AppError} = require('../../utils/AppError');
const {creatorRepository} = require('../../repositories/creatorRepository');
function list() { return creatorRepository.findMany(); }
function getBySlug(slug) { const creator = creatorRepository.findBySlug(slug); if (!creator) throw new AppError('Creator not found', 404, 'NOT_FOUND'); return creator; }
function getById(id) { const creator = creatorRepository.findById(id); if (!creator) throw new AppError('Creator not found', 404, 'NOT_FOUND'); return creator; }

module.exports = {list, getBySlug, getById};
