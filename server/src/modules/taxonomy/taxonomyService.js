const {AppError} = require('../../utils/AppError');
const {ROLES} = require('../../constants/roles');
const {getContentRepositories} = require('../../repositories/contentRuntime');

const TYPES = new Set(['GENRE', 'TAG']);
const normalizeName = value => String(value || '').trim().replace(/\s+/g, ' ').toLowerCase();
const slugify = value => normalizeName(value).replace(/[^a-z0-9\u00c0-\u024f]+/gi, '-').replace(/^-|-$/g, '');
const assertAdmin = user => { if (user.role !== ROLES.ADMIN) throw new AppError('Admin permission is required', 403, 'FORBIDDEN'); };
const assertApprovedCreator = user => { if (user.role !== ROLES.ADMIN && user.authorStatus !== 'APPROVED') throw new AppError('Approved author permission is required', 403, 'FORBIDDEN'); };

function proposalDto(row) {
  if (!row) return row;
  const {id, type, proposedName, normalizedName, reason, proposerId, storyId, status, reviewedBy, reviewedAt, reviewNote, resolvedTaxonomyId, createdAt, updatedAt} = row;
  return {id, type, proposedName, normalizedName, reason, proposerId, storyId, status, reviewedBy, reviewedAt, reviewNote, resolvedTaxonomyId, createdAt, updatedAt};
}

async function listTags({all = false} = {}) { const repos = getContentRepositories(); return (all ? await repos.tag.listAll() : await repos.tag.listActive()).map(item => ({id: item.id, name: item.name, slug: item.slug, isActive: item.isActive, createdAt: item.createdAt, updatedAt: item.updatedAt})); }
async function createTag(data, user) { assertAdmin(user); const name = String(data?.name || '').trim(); if (name.length < 2) throw new AppError('Tag name is required', 422, 'VALIDATION_ERROR'); const repos = getContentRepositories(); if (await repos.tag.findByNormalizedName(normalizeName(name))) throw new AppError('Tag already exists', 409, 'CONFLICT'); try { return await repos.tag.createTag({name, normalizedName: normalizeName(name), slug: data.slug || slugify(name)}); } catch (error) { if (error.code === 'TAG_EXISTS') throw new AppError('Tag already exists', 409, 'CONFLICT'); throw error; } }
async function updateTag(id, data, user) { assertAdmin(user); const repos = getContentRepositories(); const current = await repos.tag.findById(id); if (!current) throw new AppError('Tag not found', 404, 'NOT_FOUND'); const name = data.name === undefined ? current.name : String(data.name).trim(); const duplicate = await repos.tag.findByNormalizedName(normalizeName(name)); if (duplicate && duplicate.id !== current.id) throw new AppError('Tag already exists', 409, 'CONFLICT'); return repos.tag.updateTag(id, {name, normalizedName: normalizeName(name), slug: data.slug || slugify(name)}); }
async function setTagActive(id, active, user) { assertAdmin(user); const row = await getContentRepositories().tag.findById(id); if (!row) throw new AppError('Tag not found', 404, 'NOT_FOUND'); return getContentRepositories().tag.setActive(id, active); }

async function createProposal(data, user) {
  assertApprovedCreator(user); const repos = getContentRepositories(); const type = String(data?.type || '').toUpperCase(); const proposedName = String(data?.proposedName || '').trim().replace(/\s+/g, ' '); const reason = String(data?.reason || '').trim();
  if (!TYPES.has(type) || proposedName.length < 2 || reason.length < 5) throw new AppError('Proposal type, name and meaningful reason are required', 422, 'VALIDATION_ERROR');
  const story = await repos.story.findById(data.storyId); if (!story || (user.role !== ROLES.ADMIN && String(story.creatorId) !== String(user.id))) throw new AppError('You do not own this story', 403, 'FORBIDDEN');
  return proposalDto(await repos.proposal.createProposal({type, proposedName, normalizedName: normalizeName(proposedName), reason, proposerId: user.id, storyId: story.id, status: 'PENDING', reviewNote: ''}));
}
async function listProposals(query, user) { const repos = getContentRepositories(); const rows = await repos.proposal.list(query?.status ? {status: query.status} : {}); return rows.filter(row => user.role === ROLES.ADMIN || String(row.proposerId) === String(user.id)).map(proposalDto); }
async function getProposal(id, user) { const row = await getContentRepositories().proposal.findById(id); if (!row) throw new AppError('Proposal not found', 404, 'NOT_FOUND'); if (user.role !== ROLES.ADMIN && String(row.proposerId) !== String(user.id)) throw new AppError('Proposal not found', 404, 'NOT_FOUND'); return proposalDto(row); }
async function resolveTaxonomy(proposal, taxonomyId, repos) {
  if (proposal.type === 'GENRE') {
    if (taxonomyId) { const genre = await repos.genre.findById(taxonomyId); if (!genre) throw new AppError('Genre not found', 404, 'NOT_FOUND'); return genre; }
    const existing = (await repos.genre.listAll()).find(item => normalizeName(item.name) === proposal.normalizedName || normalizeName(item.slug) === proposal.normalizedName);
    if (existing) return existing;
    return repos.genre.createGenre({name: proposal.proposedName, slug: slugify(proposal.proposedName), description: proposal.reason, isActive: true});
  }
  if (taxonomyId) { const tag = await repos.tag.findById(taxonomyId); if (!tag) throw new AppError('Tag not found', 404, 'NOT_FOUND'); return tag; }
  const existing = await repos.tag.findByNormalizedName(proposal.normalizedName); return existing || repos.tag.createTag({name: proposal.proposedName, normalizedName: proposal.normalizedName, slug: slugify(proposal.proposedName)});
}
async function approveProposal(id, data, user) {
  assertAdmin(user); const repos = getContentRepositories(); const proposal = await repos.proposal.findById(id); if (!proposal) throw new AppError('Proposal not found', 404, 'NOT_FOUND'); if (proposal.status !== 'PENDING') throw new AppError('Proposal has already been reviewed', 409, 'PROPOSAL_REVIEWED'); const taxonomy = await resolveTaxonomy(proposal, data?.taxonomyId, repos); const story = await repos.story.findById(proposal.storyId); if (!story) throw new AppError('Story not found', 404, 'NOT_FOUND'); if (proposal.type === 'GENRE') { const ids = [...new Set([...(story.genreIds || story.genres || []), taxonomy.id])]; await repos.story.updateEditable(story.id, {genres: ids}); } else { const names = [...new Set([...(story.tags || []), taxonomy.name])]; await repos.story.updateEditable(story.id, {tags: names}); } const reviewed = await repos.proposal.review(id, {status: 'PENDING'}, {status: 'APPROVED', reviewedBy: user.id, reviewedAt: new Date(), resolvedTaxonomyId: taxonomy.id, reviewNote: String(data?.reviewNote || '')}); if (!reviewed) throw new AppError('Proposal has already been reviewed', 409, 'PROPOSAL_REVIEWED'); return proposalDto(reviewed);
}
async function rejectProposal(id, data, user) { assertAdmin(user); const note = String(data?.reviewNote || '').trim(); if (note.length < 1) throw new AppError('Review note is required', 422, 'VALIDATION_ERROR'); const repos = getContentRepositories(); const reviewed = await repos.proposal.review(id, {status: 'PENDING'}, {status: 'REJECTED', reviewedBy: user.id, reviewedAt: new Date(), reviewNote: note}); if (!reviewed) throw new AppError('Proposal has already been reviewed', 409, 'PROPOSAL_REVIEWED'); return proposalDto(reviewed); }

module.exports = {listTags, createTag, updateTag, setTagActive, createProposal, listProposals, getProposal, approveProposal, rejectProposal, normalizeName};
