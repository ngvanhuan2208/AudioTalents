import React, { useState } from 'react';
import { STORIES_DATA } from '../data/mockData';

export const AdminPortalView: React.FC = () => {
  const [stories, setStories] = useState(STORIES_DATA);
  const [auditFilter, setAuditFilter] = useState<'all' | 'pending' | 'approved'>('all');

  return (
    <div className="max-w-7xl mx-auto px-4 lg:px-8 py-8 w-full text-left">
      <div className="flex flex-col gap-1 pb-6 border-b border-white/10">
        <div className="flex items-center gap-2">
          <span className="p-1 rounded bg-error/15 text-error">
            <span className="material-symbols-outlined text-base">admin_panel_settings</span>
          </span>
          <span className="text-xs uppercase tracking-widest text-error font-bold">Hệ Thống Quản Trị</span>
        </div>
        <h1 className="text-3xl font-extrabold text-[#dfe2ee] tracking-tight">AudioVerse Admin Portal</h1>
        <p className="text-xs text-[#908fa0]">Kiểm duyệt tác phẩm, giám sát pipeline xử lý âm thanh 8D và quản lý AudioCoin</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 my-6">
        <div className="p-4 rounded-2xl bg-[#1c2028] border border-white/5">
          <span className="text-xs text-[#908fa0]">Chương chờ duyệt audio</span>
          <p className="text-2xl font-bold text-tertiary">28 chương</p>
          <span className="text-[11px] text-tertiary">Đang xử lý qua mô hình AI 8D</span>
        </div>
        <div className="p-4 rounded-2xl bg-[#1c2028] border border-white/5">
          <span className="text-xs text-[#908fa0]">Báo cáo lỗi từ độc giả</span>
          <p className="text-2xl font-bold text-error">3 báo cáo</p>
          <span className="text-[11px] text-[#908fa0]">Cần xử lý trong 24h</span>
        </div>
        <div className="p-4 rounded-2xl bg-[#1c2028] border border-white/5">
          <span className="text-xs text-[#908fa0]">Băng thông streaming</span>
          <p className="text-2xl font-bold text-primary">1.4 TB / ngày</p>
          <span className="text-[11px] text-[#908fa0]">Server Uptime 99.98%</span>
        </div>
      </div>

      {/* Novel Management Table */}
      <div className="bg-[#1c2028] border border-white/10 rounded-2xl p-6">
        <div className="flex items-center justify-between pb-4 border-b border-white/5">
          <h3 className="text-base font-bold text-[#dfe2ee]">Danh Sách Tác Phẩm Hệ Thống</h3>
          <span className="text-xs text-[#908fa0]">Tổng cộng: {stories.length} tiểu thuyết</span>
        </div>

        <div className="overflow-x-auto pt-2">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="text-[#908fa0] border-b border-white/5">
                <th className="py-3 px-2">Tên Tác Phẩm</th>
                <th className="py-3 px-2">Tác Giả</th>
                <th className="py-3 px-2">Studio Diễn Đọc</th>
                <th className="py-3 px-2">Số Chương</th>
                <th className="py-3 px-2">Âm Thanh</th>
                <th className="py-3 px-2 text-right">Trạng Thái</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5 text-[#dfe2ee]">
              {stories.map(s => (
                <tr key={s.id} className="hover:bg-[#262a33]/50 transition-colors">
                  <td className="py-3 px-2 font-semibold flex items-center gap-2">
                    <img src={s.cover} alt={s.title} className="w-8 h-10 object-cover rounded" />
                    <span>{s.title}</span>
                  </td>
                  <td className="py-3 px-2 text-[#908fa0]">{s.author}</td>
                  <td className="py-3 px-2 text-primary font-medium">{s.narrator}</td>
                  <td className="py-3 px-2">{s.chaptersCount}</td>
                  <td className="py-3 px-2">
                    <span className="px-2 py-0.5 rounded bg-primary/20 text-primary text-[10px] font-bold">
                      {s.audioQuality}
                    </span>
                  </td>
                  <td className="py-3 px-2 text-right">
                    <span className="px-2 py-0.5 rounded bg-tertiary/20 text-tertiary text-[10px] font-bold">
                      Đang phát hành
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
