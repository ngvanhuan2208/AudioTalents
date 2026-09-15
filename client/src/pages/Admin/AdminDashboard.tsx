import React, {useEffect, useState} from 'react';
import {getStories} from '../../services/contentService';
import {adminService, type AdminTaxonomyItem, type AdminTaxonomyProposal} from '../../services/adminService';
import type {Story} from '../../types';
import {AuthorApplicationReviewSection} from './AuthorApplicationReviewSection';
import {AdminMobileNav, AdminOverview, AdminSidebar, AdminTopbar, ModuleUnavailable, StoryTable, TaxonomyPanel, type AdminSection} from './adminComponents';

export const AdminDashboard: React.FC = () => {
  const [section, setSection] = useState<AdminSection>('overview');
  const [stories, setStories] = useState<Story[]>([]);
  const [genres, setGenres] = useState<AdminTaxonomyItem[]>([]);
  const [tags, setTags] = useState<AdminTaxonomyItem[]>([]);
  const [proposals, setProposals] = useState<AdminTaxonomyProposal[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const reload = async () => { const [storyRows, genreRows, tagRows, proposalRows] = await Promise.all([getStories(), adminService.listGenres(), adminService.listAllTags(), adminService.listTaxonomyProposals()]); setStories(storyRows); setGenres(genreRows); setTags(tagRows); setProposals(proposalRows); };
  useEffect(() => { void reload().catch(reason => setError(reason instanceof Error ? reason.message : 'Không thể tải dữ liệu quản trị.')).finally(() => setLoading(false)); }, []);
  const pendingCount = proposals.filter(item => item.status === 'PENDING').length;
  const content = loading ? <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">{Array.from({length: 4}).map((_, index) => <div key={index} className="h-28 animate-pulse rounded-xl border border-white/10 bg-[#1b202a]" />)}</div> : error ? <section role="alert" className="rounded-xl border border-[#8b4f45]/40 bg-[#8b4f45]/10 p-5 text-sm text-[#e3b0a7]">{error}<button type="button" onClick={() => {setError(''); void reload();}} className="ml-3 underline">Thử lại</button></section> : section === 'overview' ? <AdminOverview stories={stories} pendingCount={pendingCount} /> : section === 'moderation' ? <><AuthorApplicationReviewSection /><TaxonomyPanel genres={genres} tags={tags} proposals={proposals} onReload={reload} /></> : section === 'stories' ? <StoryTable stories={stories} /> : section === 'catalog' ? <TaxonomyPanel genres={genres} tags={tags} proposals={proposals} onReload={reload} /> : section === 'authors' ? <AuthorApplicationReviewSection /> : <ModuleUnavailable title={section === 'chapters' ? 'Chương' : section === 'audio' ? 'Audio' : section === 'users' ? 'Người dùng' : section === 'reports' ? 'Báo cáo' : section === 'audit' ? 'Nhật ký hệ thống' : 'Cài đặt'} />;
  return <div className="min-h-screen bg-[#11151d] text-[#eee8dc]"><div className="flex"><AdminSidebar active={section} onChange={setSection} pendingCount={pendingCount} /><main className="min-w-0 flex-1"><AdminTopbar active={section} /><div className="px-4 py-4 lg:hidden"><AdminMobileNav active={section} onChange={setSection} /></div><div className="mx-auto max-w-[1500px] px-4 pb-10 lg:px-8">{content}</div></main></div></div>;
};
