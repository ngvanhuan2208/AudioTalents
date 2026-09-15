import { apiFetch } from './api';

export type AuthorApplicationStatus = 'PENDING' | 'APPROVED' | 'REJECTED' | 'CANCELLED';

export interface AuthorApplicationReview {
  id: string;
  userId: string;
  displayName: string;
  bio: string;
  contentTypes: string[];
  experience: string;
  status: AuthorApplicationStatus;
  submittedAt: string | null;
  reviewedAt: string | null;
  reviewedBy: string | null;
  reviewNote: string | null;
  createdAt?: string;
  updatedAt?: string;
}
export interface AdminTaxonomyItem { id: string; name: string; slug: string; isActive: boolean; }
export interface AdminTaxonomyProposal { id: string; type: 'GENRE' | 'TAG'; proposedName: string; reason: string; storyId: string; proposerId: string; status: 'PENDING' | 'APPROVED' | 'REJECTED'; reviewNote?: string; createdAt?: string; reviewedAt?: string | null; resolvedTaxonomyId?: string | null; }

// Canonical Admin namespace for AuthorApplication review.
// The Admin UI uses ONLY this namespace. It never mixes in the duplicate
// `/author-applications/admin...` namespace.
const ADMIN_AUTHOR_APPLICATIONS_PATH = '/admin/author-applications';

const applicationPath = (id: string) => `${ADMIN_AUTHOR_APPLICATIONS_PATH}/${encodeURIComponent(id)}`;

export const adminService = {
  listAuthorApplications: () => apiFetch<AuthorApplicationReview[]>(ADMIN_AUTHOR_APPLICATIONS_PATH),

  getAuthorApplication: (id: string) => apiFetch<AuthorApplicationReview>(applicationPath(id)),

  approveAuthorApplication: (id: string, reviewNote?: string) =>
    apiFetch<AuthorApplicationReview>(`${applicationPath(id)}/approve`, {
      method: 'PATCH',
      body: JSON.stringify(reviewNote && reviewNote.trim() ? { reviewNote: reviewNote.trim() } : {}),
    }),

  rejectAuthorApplication: (id: string, reviewNote: string) =>
    apiFetch<AuthorApplicationReview>(`${applicationPath(id)}/reject`, {
      method: 'PATCH',
      body: JSON.stringify({ reviewNote: reviewNote.trim() }),
    }),
  listGenres: () => apiFetch<AdminTaxonomyItem[]>('/genres/admin/all'),
  createGenre: (input: {name: string; slug: string; description?: string}) => apiFetch<AdminTaxonomyItem>('/genres', {method: 'POST', body: JSON.stringify(input)}),
  updateGenre: (id: string, input: {name?: string; slug?: string; description?: string}) => apiFetch<AdminTaxonomyItem>(`/genres/${encodeURIComponent(id)}`, {method: 'PATCH', body: JSON.stringify(input)}),
  setGenreActive: (id: string, isActive: boolean) => apiFetch<AdminTaxonomyItem>(`/genres/${encodeURIComponent(id)}/active`, {method: 'PATCH', body: JSON.stringify({isActive})}),
  listTags: () => apiFetch<AdminTaxonomyItem[]>('/tags'),
  listAllTags: () => apiFetch<AdminTaxonomyItem[]>('/admin/tags'),
  createTag: (input: {name: string; slug?: string}) => apiFetch<AdminTaxonomyItem>('/admin/tags', {method: 'POST', body: JSON.stringify(input)}),
  updateTag: (id: string, input: {name?: string; slug?: string}) => apiFetch<AdminTaxonomyItem>(`/admin/tags/${encodeURIComponent(id)}`, {method: 'PATCH', body: JSON.stringify(input)}),
  setTagActive: (id: string, isActive: boolean) => apiFetch<AdminTaxonomyItem>(`/admin/tags/${encodeURIComponent(id)}/active`, {method: 'PATCH', body: JSON.stringify({isActive})}),
  listTaxonomyProposals: () => apiFetch<AdminTaxonomyProposal[]>('/admin/taxonomy-proposals'),
  approveTaxonomyProposal: (id: string, taxonomyId?: string) => apiFetch<AdminTaxonomyProposal>(`/admin/taxonomy-proposals/${encodeURIComponent(id)}/approve`, {method: 'PATCH', body: JSON.stringify(taxonomyId ? {taxonomyId} : {})}),
  rejectTaxonomyProposal: (id: string, reviewNote: string) => apiFetch<AdminTaxonomyProposal>(`/admin/taxonomy-proposals/${encodeURIComponent(id)}/reject`, {method: 'PATCH', body: JSON.stringify({reviewNote})}),
};
