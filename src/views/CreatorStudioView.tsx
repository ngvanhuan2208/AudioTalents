import React, { useState } from 'react';

export const CreatorStudioView: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'overview' | 'new-chapter' | 'royalty'>('overview');
  const [newChapterTitle, setNewChapterTitle] = useState<string>('');
  const [newChapterContent, setNewChapterContent] = useState<string>('');
  const [selectedVoice, setSelectedVoice] = useState<string>('ai-viet-male');
  const [isVipChapter, setIsVipChapter] = useState<boolean>(false);
  const [coinPrice, setCoinPrice] = useState<number>(10);
  const [publishSuccess, setPublishSuccess] = useState<boolean>(false);

  const handlePublish = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newChapterTitle.trim()) return;

    setPublishSuccess(true);
    setTimeout(() => {
      setPublishSuccess(false);
      setNewChapterTitle('');
      setNewChapterContent('');
      setActiveTab('overview');
    }, 2000);
  };

  return (
    <div className="max-w-7xl mx-auto px-4 lg:px-8 py-8 w-full text-left">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 pb-6 border-b border-white/10">
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-2">
            <span className="p-1 rounded bg-secondary-container text-on-secondary-container">
              <span className="material-symbols-outlined text-base">draw</span>
            </span>
            <span className="text-xs uppercase tracking-widest text-secondary font-bold">Studio Sáng Tác</span>
          </div>
          <h1 className="text-3xl font-extrabold text-[#dfe2ee] tracking-tight">AudioVerse Creator Studio</h1>
          <p className="text-xs text-[#908fa0]">Dành cho tác giả văn học mạng và Voice Talent lồng tiếng audio</p>
        </div>

        {/* Tab switch */}
        <div className="flex items-center gap-1 bg-[#1c2028] p-1.5 rounded-2xl border border-white/5 text-xs">
          <button
            onClick={() => setActiveTab('overview')}
            className={`px-4 py-1.5 rounded-xl font-bold transition-all ${
              activeTab === 'overview' ? 'bg-primary text-on-primary' : 'text-[#c7c4d7]'
            }`}
          >
            Tổng Quan Studio
          </button>
          <button
            onClick={() => setActiveTab('new-chapter')}
            className={`px-4 py-1.5 rounded-xl font-bold transition-all ${
              activeTab === 'new-chapter' ? 'bg-primary text-on-primary' : 'text-[#c7c4d7]'
            }`}
          >
            + Đăng Chương Mới
          </button>
          <button
            onClick={() => setActiveTab('royalty')}
            className={`px-4 py-1.5 rounded-xl font-bold transition-all ${
              activeTab === 'royalty' ? 'bg-primary text-on-primary' : 'text-[#c7c4d7]'
            }`}
          >
            Doanh Thu & Nhuận Bút
          </button>
        </div>
      </div>

      {/* TAB 1: OVERVIEW */}
      {activeTab === 'overview' && (
        <div className="py-6 space-y-6">
          {/* Stats Bar */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="p-5 rounded-2xl bg-[#1c2028] border border-white/5 flex flex-col gap-1">
              <span className="text-xs text-[#908fa0]">Tổng lượt nghe audio</span>
              <p className="text-2xl font-black text-[#dfe2ee]">2.850.000</p>
              <span className="text-[11px] text-tertiary flex items-center gap-0.5">
                <span className="material-symbols-outlined text-xs">arrow_upward</span> +14.2% tuần này
              </span>
            </div>

            <div className="p-5 rounded-2xl bg-[#1c2028] border border-white/5 flex flex-col gap-1">
              <span className="text-xs text-[#908fa0]">Độc giả theo dõi</span>
              <p className="text-2xl font-black text-secondary">48.200</p>
              <span className="text-[11px] text-[#908fa0]">Tỷ lệ quay lại 89%</span>
            </div>

            <div className="p-5 rounded-2xl bg-[#1c2028] border border-white/5 flex flex-col gap-1">
              <span className="text-xs text-[#908fa0]">AudioCoin tích lũy</span>
              <p className="text-2xl font-black text-tertiary font-mono">148.500 AC</p>
              <span className="text-[11px] text-tertiary">≈ 29.700.000 VNĐ</span>
            </div>

            <div className="p-5 rounded-2xl bg-[#1c2028] border border-white/5 flex flex-col gap-1">
              <span className="text-xs text-[#908fa0]">Tác phẩm đang ra</span>
              <p className="text-2xl font-black text-primary">3 tác phẩm</p>
              <span className="text-[11px] text-[#908fa0]">Tổng 1.240 chương</span>
            </div>
          </div>

          {/* Published Novels List */}
          <div className="bg-[#1c2028] border border-white/10 rounded-2xl p-6">
            <h3 className="text-base font-bold text-[#dfe2ee] mb-4">Tác Phẩm Của Bạn</h3>
            <div className="space-y-3">
              <div className="p-4 rounded-xl bg-[#181c24] border border-white/5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-16 rounded-lg bg-[#262a33] overflow-hidden">
                    <img
                      src="https://images.unsplash.com/photo-1518709268805-4e9042af9f23?w=600&auto=format&fit=crop&q=80"
                      alt="Ta Có Một Hệ Thống Vô Địch"
                      className="w-full h-full object-cover"
                    />
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-[#dfe2ee]">Ta Có Một Hệ Thống Vô Địch</h4>
                    <p className="text-xs text-[#908fa0]">850 chương • 2.8M lượt nghe • Diễn đọc: Diệp Thiên (V-Studio)</p>
                    <span className="px-2 py-0.5 rounded bg-primary/20 text-primary text-[10px] font-bold mt-1 inline-block">
                      Đang cập nhật
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setActiveTab('new-chapter')}
                    className="px-3 py-1.5 rounded-lg bg-[#262a33] hover:bg-[#31353e] text-xs text-[#dfe2ee] font-semibold"
                  >
                    Viết chương tiếp theo
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: NEW CHAPTER PUBLISH */}
      {activeTab === 'new-chapter' && (
        <form onSubmit={handlePublish} className="py-6 space-y-6 max-w-3xl">
          <div className="bg-[#1c2028] border border-white/10 rounded-2xl p-6 space-y-4">
            <h3 className="text-base font-bold text-[#dfe2ee]">Đăng Tải Chương & Xử Lý Audio</h3>

            <div>
              <label className="text-xs text-[#908fa0] block mb-1 font-semibold">Tên chương:</label>
              <input
                type="text"
                value={newChapterTitle}
                onChange={e => setNewChapterTitle(e.target.value)}
                placeholder="VD: Chương 851: Kiếm Đãng Bát Hoang"
                className="w-full bg-[#181c24] border border-white/10 rounded-xl px-4 py-2.5 text-xs sm:text-sm text-[#dfe2ee] focus:outline-none focus:border-primary"
                required
              />
            </div>

            <div>
              <label className="text-xs text-[#908fa0] block mb-1 font-semibold">Nội dung văn bản:</label>
              <textarea
                rows={8}
                value={newChapterContent}
                onChange={e => setNewChapterContent(e.target.value)}
                placeholder="Dán nội dung chương truyện vào đây..."
                className="w-full bg-[#181c24] border border-white/10 rounded-xl p-4 text-xs sm:text-sm text-[#dfe2ee] focus:outline-none focus:border-primary"
                required
              />
            </div>

            {/* Audio Synthesis / Studio Voice Selection */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
              <div>
                <label className="text-xs text-[#908fa0] block mb-1 font-semibold">Công nghệ chuyển âm:</label>
                <select
                  value={selectedVoice}
                  onChange={e => setSelectedVoice(e.target.value)}
                  className="w-full bg-[#181c24] border border-white/10 rounded-xl px-3 py-2 text-xs text-[#dfe2ee] focus:outline-none"
                >
                  <option value="ai-viet-male">AI Voice Talent Diệp Thiên (Trầm ấm, hào hùng)</option>
                  <option value="ai-viet-female">AI Voice Linh Nhi (Trong trẻo, diễn cảm)</option>
                  <option value="studio-human">Audio Phòng Thu Studio (Tải file .wav / .mp3)</option>
                </select>
              </div>

              <div>
                <label className="text-xs text-[#908fa0] block mb-1 font-semibold">Chế độ phân phối:</label>
                <div className="flex items-center gap-4 pt-1.5">
                  <label className="flex items-center gap-2 cursor-pointer text-xs text-[#dfe2ee]">
                    <input
                      type="radio"
                      name="vip"
                      checked={!isVipChapter}
                      onChange={() => setIsVipChapter(false)}
                      className="accent-primary"
                    />
                    Miễn phí
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer text-xs text-[#dfe2ee]">
                    <input
                      type="radio"
                      name="vip"
                      checked={isVipChapter}
                      onChange={() => setIsVipChapter(true)}
                      className="accent-tertiary"
                    />
                    Khóa VIP (Thu phí AudioCoin)
                  </label>
                </div>
              </div>
            </div>

            {isVipChapter && (
              <div className="p-3 rounded-xl bg-tertiary/10 border border-tertiary/20 flex items-center gap-3">
                <span className="material-symbols-outlined text-tertiary">diamond</span>
                <span className="text-xs text-[#dfe2ee]">Giá mở khóa chương:</span>
                <select
                  value={coinPrice}
                  onChange={e => setCoinPrice(parseInt(e.target.value))}
                  className="bg-[#262a33] border border-white/10 rounded-lg px-2 py-1 text-xs text-tertiary font-bold"
                >
                  <option value={5}>5 AC</option>
                  <option value={10}>10 AC</option>
                  <option value={20}>20 AC</option>
                </select>
              </div>
            )}

            {publishSuccess ? (
              <div className="p-4 rounded-xl bg-primary/20 text-primary text-center text-xs font-bold">
                ✓ Đăng tải chương thành công! Hệ thống đang tự động trích xuất transcript đồng bộ.
              </div>
            ) : (
              <button
                type="submit"
                className="w-full py-3 rounded-full bg-primary text-on-primary text-xs font-bold hover:brightness-110 active:scale-95 transition-all shadow-lg"
              >
                Xuất Bản & Tạo Audio Đồng Bộ
              </button>
            )}
          </div>
        </form>
      )}

      {/* TAB 3: ROYALTY */}
      {activeTab === 'royalty' && (
        <div className="py-6 space-y-6">
          <div className="bg-[#1c2028] border border-white/10 rounded-2xl p-6">
            <h3 className="text-base font-bold text-[#dfe2ee] mb-2">Chính Sách Nhuận Bút Tác Giả</h3>
            <p className="text-xs text-[#908fa0] leading-relaxed mb-4">
              Tác giả hưởng 70% doanh thu từ việc mở khóa chương VIP và 80% giá trị quà tặng trực tiếp từ độc giả. Tiền nhuận bút được kết toán vào ngày 15 hàng tháng qua tài khoản ngân hàng hoặc ví điện tử.
            </p>

            <div className="p-4 rounded-xl bg-[#181c24] border border-white/5 flex items-center justify-between">
              <div>
                <span className="text-xs text-[#908fa0]">Số dư có thể rút</span>
                <p className="text-2xl font-black text-tertiary font-mono">148.500 AC</p>
              </div>
              <button className="px-5 py-2 rounded-full bg-gradient-to-r from-tertiary to-tertiary-container text-on-tertiary text-xs font-bold hover:brightness-110 shadow-md">
                Yêu Cầu Rút Tiền
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
