const {getContentRepositories} = require('../../repositories/contentRuntime');

async function search(filters = {}) {
  const query = typeof filters === 'string' ? filters : filters.keyword || '';
  const keyword = String(query).trim();
  const genre = filters.genre || filters.genres || null;
  const author = filters.author || null;
  const status = filters.status || null;
  const page = Number(filters.page) || 1;
  const limit = Number(filters.limit) || 10;
  const sort = filters.sort || 'newest';

  const repositories = getContentRepositories();
  let genreId = genre || undefined;
  if (genre && repositories.runtime === 'MONGO') {
    const genreRecord = await repositories.genre.findById(String(genre)).catch(() => null) || await repositories.genre.findBySlug(String(genre));
    if (!genreRecord) return {items: [], pagination: {page, limit, total: 0, pages: 1}};
    genreId = genreRecord.id;
  }
  const result = keyword
    ? await repositories.story.searchPublic(keyword, {page: 1, limit: 100, genreId, sort})
    : await repositories.story.listPublic({page: 1, limit: 100, genreId, sort: sort === 'newest' ? 'latest' : sort});
  let stories = result.items.filter(item => (!author || item.creatorId === author) && (!status || item.status === status || item.reviewStatus === status));

  if (sort === 'popular') stories.sort((a, b) => (b.listenCount ?? b.listens ?? 0) - (a.listenCount ?? a.listens ?? 0));
  if (sort === 'oldest') stories.sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
  if (sort === 'newest' || !sort) stories.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

  const total = stories.length;
  const skip = (page - 1) * limit;
  const items = stories.slice(skip, skip + limit);

  return {
    items,
    pagination: {page, limit, total, pages: Math.max(1, Math.ceil(total / limit))}
  };
}

module.exports = {search};
