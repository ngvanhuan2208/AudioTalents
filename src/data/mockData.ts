import { Story, Genre, CultivationUser, Comment, Playlist } from '../types';

export const GENRES_DATA: Genre[] = [
  { id: 'g1', name: 'Tiên Hiệp', slug: 'tien-hiep', icon: 'swords', count: 1420, audioCount: 8200, isHot: true, rankBadge: 'TOP 1' },
  { id: 'g2', name: 'Huyền Huyễn', slug: 'huyen-huyen', icon: 'auto_fix', count: 2150, audioCount: 11000, isHot: true, rankBadge: 'TOP 2' },
  { id: 'g3', name: 'Xuyên Không', slug: 'xuyen-khong', icon: 'all_inclusive', count: 980, audioCount: 4500, isHot: true, rankBadge: 'HOT' },
  { id: 'g4', name: 'Ngôn Tình', slug: 'ngon-tinh', icon: 'favorite', count: 1840, audioCount: 9800, isHot: true, rankBadge: 'HOT' },
  { id: 'g5', name: 'Kiếm Hiệp', slug: 'kiem-hiep', icon: 'military_tech', count: 760, audioCount: 3100 },
  { id: 'g6', name: 'Mạt Thế', slug: 'mat-the', icon: 'coronavirus', count: 430, audioCount: 1900 },
  { id: 'g7', name: 'Linh Dị', slug: 'linh-di', icon: 'fitbit_push_ups', count: 320, audioCount: 2400 },
  { id: 'g8', name: 'Đô Thị Dị Năng', slug: 'do-thi-di-nang', icon: 'flash_on', count: 890, audioCount: 5100, isHot: true, rankBadge: 'TRENDING' },
  { id: 'g9', name: 'Hệ Thống', slug: 'he-thong', icon: 'settings_suggest', count: 1200, audioCount: 6800 },
  { id: 'g10', name: 'Khoa Huyễn', slug: 'khoa-huyen', icon: 'rocket_launch', count: 540, audioCount: 2900 },
  { id: 'g11', name: 'Đam Mỹ', slug: 'dam-my', icon: 'theater_comedy', count: 620, audioCount: 3800 },
  { id: 'g12', name: 'Hài Hước', slug: 'hai-huoc', icon: 'mood', count: 410, audioCount: 1800 },
];

export const STORIES_DATA: Story[] = [
  {
    id: 'story-he-thong-vo-dich',
    slug: 'ta-co-mot-he-thong-vo-dich',
    title: 'Ta Có Một Hệ Thống Vô Địch',
    author: 'Dạ Thần Nguyệt',
    authorId: 'auth-da-than-nguyet',
    narrator: 'Hà Tiên Lữ Audio',
    narratorGroup: 'Studio Tiên Phong 8D',
    cover: 'https://lh3.googleusercontent.com/aida-public/AB6AXuDyvTgAT-nqpCd_iaqgcGgZ9tx32hpSzzgka6TkCwVyf58Zf2YToJhU7lF-w7z1OtP7aybIdgy-Kmg6eTHOlT1po4C7HMdJzDxH9ReB_-s3hAM_D21sbAbdMzPDZYFdtO7JrR7b1t36IWOAsdZ5X4_7u9bXYB_XkH38fPKw4QEOAHKOezVw51x4OQDGLjCIzufRUe9bumifvHFSykCrNaRvqQEVUebbyoCYYyCAsDkpn1aBfYOA7zA',
    genres: ['Hệ Thống', 'Huyền Huyễn', 'Tiên Hiệp'],
    tags: ['vô_địch', 'xuyên_không', 'sát_phạt', 'hài_hước'],
    status: 'Đang ra',
    description: 'Xuyên không đến Thương Khung Giới, thiếu niên Giang Thần thu hoạch được Hệ Thống Vô Địch Đăng Nhập. Đăng nhập ngày đầu tiên nhận Hỗn Độn Kiếm Thể, đăng nhập ngày thứ hai nhận Cửu Chuyển Thần Đan... Đứng đầu thiên hạ, chém thần tru ma!',
    rating: 4.9,
    ratingCount: 12400,
    views: '18.5M',
    listeners: '2.8M',
    chaptersCount: 850,
    totalAudioHours: '68h',
    badge: 'TOP 1 TUẦN',
    hasAudio: true,
    audioQuality: 'HQ 320k Lossless',
    currentChapter: 'Chương 128: Kiếm Phá Vạn Pháp',
    chapters: [
      {
        id: 'c-128',
        storyId: 'story-he-thong-vo-dich',
        index: 128,
        title: 'Chương 128: Kiếm Phá Vạn Pháp',
        durationSec: 1320,
        durationFormatted: '22:00',
        isVip: false,
        publishedAt: 'Hôm nay',
        content: `Gió lạnh thấu xương thổi qua đỉnh Tử Tiêu Sơn, hàng ngàn đệ tử tông môn nín thở nhìn về phía trước đài luận kiếm.
Tại trung tâm lôi đài, Giang Thần khoanh tay đứng lặng, tà áo xanh tung bay theo cuồng phong. Đối diện hắn là đệ nhất chân truyền của Kiếm Thần Tông - Lạc Vô Nhai, kẻ vừa lĩnh ngộ được Thiên Bạt Kiếm Quyết tầng thứ chín.
"Giang Thần, ngươi dám một mình lên núi khiêu chiến chín đại kiếm tông? Hôm nay chính là ngày táng thân của ngươi!" Tiếng quát của Lạc Vô Nhai vang dội như sấm sét.
Khóe môi Giang Thần khẽ cong lên một nụ cười nhạt: "Kiếm Thần Tông các ngươi tự xưng thiên hạ vô song, nhưng trong mắt ta, vạn kiếm quy tông cũng chỉ là một kiếm mà thôi."
Trong thức hải, thanh âm cơ giới quen thuộc của hệ thống vang lên:
[Ting! Phát hiện sát ý của Cửu Tinh Kiếm Hoàng, kích hoạt thần thông Kiếm Phá Vạn Pháp!]`,
        transcript: [
          { startSec: 0, endSec: 15, speaker: 'Người dẫn chuyện', text: 'Gió lạnh thấu xương thổi qua đỉnh Tử Tiêu Sơn, hàng ngàn đệ tử tông môn nín thở nhìn về phía trước đài luận kiếm.' },
          { startSec: 15, endSec: 32, speaker: 'Người dẫn chuyện', text: 'Tại trung tâm lôi đài, Giang Thần khoanh tay đứng lặng, tà áo xanh tung bay theo cuồng phong kiếm khí ngút trời.' },
          { startSec: 32, endSec: 48, speaker: 'Lạc Vô Nhai', text: 'Giang Thần, ngươi dám một mình lên núi khiêu chiến chín đại kiếm tông? Hôm nay chính là ngày táng thân của ngươi!' },
          { startSec: 48, endSec: 68, speaker: 'Giang Thần', text: 'Kiếm Thần Tông các ngươi tự xưng thiên hạ vô song, nhưng trong mắt ta, vạn kiếm quy tông cũng chỉ là một kiếm mà thôi!' },
          { startSec: 68, endSec: 90, speaker: 'Hệ Thống AI', text: 'Ting! Phát hiện sát ý của Cửu Tinh Kiếm Hoàng, kích hoạt phần thưởng tuyệt thế: Kiếm Phá Vạn Pháp!' }
        ]
      },
      {
        id: 'c-129',
        storyId: 'story-he-thong-vo-dich',
        index: 129,
        title: 'Chương 129: Một Kiếm Chấn Bát Hoang',
        durationSec: 1450,
        durationFormatted: '24:10',
        isVip: true,
        publishedAt: 'Hôm qua',
        content: 'Khí thế ngập trời bùng nổ, Hỗn Độn Kiếm vừa rút ra, hư không trăm dặm chung quanh rung chuyển dữ dội...',
        transcript: [
          { startSec: 0, endSec: 20, speaker: 'Người dẫn chuyện', text: 'Khí thế ngập trời bùng nổ, Hỗn Độn Kiếm vừa rút ra, hư không trăm dặm chung quanh rung chuyển dữ dội.' }
        ]
      }
    ]
  },
  {
    id: 'story-dau-pha-khung-thuong',
    slug: 'dau-pha-khung-thuong',
    title: 'Đấu Phá Khung Thương - Lồng Tiếng',
    author: 'Thiên Tằm Thổ Đậu',
    authorId: 'auth-thien-tam-tho-dau',
    narrator: 'Diệp Thiên',
    narratorGroup: 'V-Radio Audio',
    cover: 'https://lh3.googleusercontent.com/aida-public/AB6AXuAIhC-8odJEfaNiXWijXjFG44uIDIeWudSyujH0L18vHhJTjZT8cwI6tKRhcBORccrewHqn7YCaKLVEXtAJO3GOU1ii7iJyXJ4ULZyzK9yPzf-zxfIs_-pNCNoMj_rPY-5CYwDNT87guLoSVNFiotJp0g0lnfc4FtJREPPO2ctyT9E9W-2c2nxV2ujqPJMIDknGO42txc0IF5BTN5snkF9ud6xHJLgJbzr5d2DIqs0TTfa4p7Og_fw',
    genres: ['Huyền Huyễn', 'Tiên Hiệp', 'Dị Giới'],
    tags: ['dị_hỏa', 'đấu_khí', 'nhiệt_huyết', 'kinh_điển'],
    status: 'Hoàn thành',
    description: 'Nơi này là thế giới thuộc về đấu khí, không có hoa tiếu ma pháp, chỉ có đấu khí phồn thịnh tới đỉnh cao. Thiếu niên Tiêu Viêm vì nhục nhã năm xưa mà bước lên con đường nghịch thiên...',
    rating: 4.8,
    ratingCount: 38200,
    views: '42.1M',
    listeners: '5.6M',
    chaptersCount: 1648,
    totalAudioHours: '142h',
    badge: 'ĐỘC QUYỀN',
    hasAudio: true,
    audioQuality: '8D Studio Master',
    currentChapter: 'Chương 342: Dị Hỏa Xuất Thế',
    chapters: [
      {
        id: 'c-dp-342',
        storyId: 'story-dau-pha-khung-thuong',
        index: 342,
        title: 'Chương 342: Dị Hỏa Xuất Thế',
        durationSec: 3500,
        durationFormatted: '58:20',
        isVip: false,
        publishedAt: '3 ngày trước',
        content: `Sâu trong sa mạc Tháp Qua Nhĩ, dung nham ngầm cuộn trào sóng nhiệt nghẹt thở. Tiêu Viêm nuốt ực một ngụm nước bọt, mắt chăm chăm nhìn về phía đóa hoa sen thanh sắc đang lơ lửng...`,
        transcript: [
          { startSec: 0, endSec: 25, speaker: 'Diệp Thiên', text: 'Sâu trong sa mạc Tháp Qua Nhĩ, dung nham ngầm cuộn trào sóng nhiệt nghẹt thở, nhiệt độ cao đến mức mắt thường có thể nhìn thấy không gian vặn vẹo.' },
          { startSec: 25, endSec: 50, speaker: 'Dược Lão', text: 'Tiểu tử, Thanh Liên Địa Tâm Hỏa này linh trí sơ khai nhưng cực kỳ hung bạo, hơi bất cẩn một chút là cốt nhục tiêu tan!' },
          { startSec: 50, endSec: 75, speaker: 'Tiêu Viêm', text: 'Sư phụ, con đã đợi ngày này suốt ba năm! Cho dù là núi đao biển lửa con cũng phải nuốt trọn ngọn dị hỏa này!' }
        ]
      }
    ]
  },
  {
    id: 'story-van-co-than-de',
    slug: 'van-co-than-de',
    title: 'Vạn Cổ Thần Đế',
    author: 'Phi Thiên Ngư',
    authorId: 'auth-phi-thien-ngu',
    narrator: 'Minh Quân AI',
    narratorGroup: 'Hyper-Realistic Voice Engine',
    cover: 'https://lh3.googleusercontent.com/aida-public/AB6AXuD8meQcNTtQ3XNtWpgfCVz_STV31K0gPHCRubykbr2uuSg80ANDIlBQqckY0y1N93QQfOOoAKCZHlK_bV16ER4Lt3Q8BxDpgzibpbGsh0VUIB5k6-5of8ZSmYMiSo_LjmqB7O4lNHyfIiqOOGpUEP3WoEfY-bLRIUZ3YKOkZznYLTi7XmUKuV9cAocqxuzUfDUPbn-lQFR0ZoDLAcpO_4iAFDMMDCTPbZLwjVWB_qYCss1EYPCBDLY',
    genres: ['Huyền Huyễn', 'Trọng Sinh', 'Kiếm Đạo'],
    tags: ['báo_thù', 'thời_không', 'đế_vương'],
    status: 'Đang ra',
    description: 'Tám trăm năm trước, Minh Đế chi tử Trương Nhược Trần bị vị hôn thê Trì Dao công chúa sát hại. Tám trăm năm sau, hắn tái sinh trong thân thể một vương tử suy yếu...',
    rating: 4.7,
    ratingCount: 15400,
    views: '22.0M',
    listeners: '3.1M',
    chaptersCount: 3890,
    totalAudioHours: '190h',
    badge: 'CẬP NHẬT',
    hasAudio: true,
    audioQuality: '320k Ultra',
    currentChapter: 'Chương 158: Thần Mộc Kiếm Ý',
    chapters: [
      {
        id: 'c-vc-158',
        storyId: 'story-van-co-than-de',
        index: 158,
        title: 'Chương 158: Thần Mộc Kiếm Ý',
        durationSec: 2710,
        durationFormatted: '45:10',
        isVip: false,
        publishedAt: 'Hôm qua',
        content: 'Trương Nhược Trần ngồi xếp bằng dưới gốc Tiếp Thiên Thần Mộc, từng vệt kiếm quang màu xanh ngọc bích xoay vần quanh thân thể...',
        transcript: [
          { startSec: 0, endSec: 20, speaker: 'Minh Quân AI', text: 'Trương Nhược Trần ngồi xếp bằng dưới gốc Tiếp Thiên Thần Mộc, từng vệt kiếm quang màu xanh ngọc bích xoay vần quanh thân thể.' },
          { startSec: 20, endSec: 45, speaker: 'Trương Nhược Trần', text: 'Thời gian có thể hủy hoại thân xác, nhưng không thể xóa nhòa ý chí kiếm đạo của ta!' }
        ]
      }
    ]
  },
  {
    id: 'story-toan-chuc-cao-thu',
    slug: 'toan-chuc-cao-thu',
    title: 'Toàn Chức Cao Thủ',
    author: 'Hồ Điệp Lam',
    authorId: 'auth-ho-diep-lam',
    narrator: 'Studio V-Radio',
    narratorGroup: 'V-Radio Gaming Cast',
    cover: 'https://lh3.googleusercontent.com/aida-public/AB6AXuBOgII6oRpCOQEdNHNuvfYmUszR8nk0yDnF57ffQ3SzBTBcXNuKap4GPjh0NtYeA8J0g4pC5J6KSNdnrSXxBnyEuZd5C3iyr0D8ZkhxaIKQKjPejZ0Hhw8m4FKY3TJ5yoxLlKhu21Gg7EC-9u-Cl4O0ZjUlEKHO0yuEbPPmKVcfGdVOfOXGhp8e9JMDmw9Vf_8108HB4AivtNS5VQthYj-VAQBxyX7BSQYyqNnbbHwXaOUnkfBGaDk',
    genres: ['Đô Thị Dị Năng', 'Khoa Huyễn', 'Hài Hước'],
    tags: ['esports', 'vinh_quang', 'đỉnh_cao', 'chiến_thuật'],
    status: 'Hoàn thành',
    description: 'Diệp Tu, bách khoa toàn thư của trò chơi Vinh Quang, bị câu lạc bộ trục xuất. Rời khỏi đấu trường chuyên nghiệp, hắn trở thành nhân viên quản lý tiệm net...',
    rating: 4.9,
    ratingCount: 29000,
    views: '35.4M',
    listeners: '4.8M',
    chaptersCount: 1728,
    totalAudioHours: '120h',
    badge: 'SIÊU PHẨM',
    hasAudio: true,
    audioQuality: 'HQ 320k',
    currentChapter: 'Chương 89: Quân Mạc Tiếu Xuất Trận',
    chapters: [
      {
        id: 'c-tc-89',
        storyId: 'story-toan-chuc-cao-thu',
        index: 89,
        title: 'Chương 89: Quân Mạc Tiếu Xuất Trận',
        durationSec: 3120,
        durationFormatted: '52:00',
        isVip: false,
        publishedAt: '3 ngày trước',
        content: 'Tiếng lách cách của bàn phím cơ vang lên rộn rã trong tiệm net Hưng Hân. Diệp Tu nhấp một ngụm trà, ngón tay thoăn thoắt trên Ô Thiên Cơ...',
        transcript: [
          { startSec: 0, endSec: 25, speaker: 'Studio V-Radio', text: 'Tiếng lách cách của bàn phím cơ vang lên rộn rã trong tiệm net Hưng Hân. Màn hình máy tính phản chiếu ánh sáng xanh lạnh lùng.' },
          { startSec: 25, endSec: 50, speaker: 'Diệp Tu', text: 'Nghỉ ngơi một năm, rồi quay trở lại. Đỉnh cao Vinh Quang, ta chưa từng từ bỏ.' }
        ]
      }
    ]
  },
  {
    id: 'story-truong-sinh-bat-tu',
    slug: 'truong-sinh-bat-tu',
    title: 'Trường Sinh Bất Tử',
    author: 'Huyễn Đạo Chân Nhân',
    authorId: 'auth-huyen-dao',
    narrator: 'Khánh An Voice',
    narratorGroup: 'Thính Giác Studio',
    cover: 'https://lh3.googleusercontent.com/aida-public/AB6AXuAWxSWYcRi1T1qYrOlb2LVJkNkutTHaRrFDTPJbBQkM38xViuTFpfBBzaUEVQsZAX7SXxYSPjqMlF53V2te9IE4IH7Zne2tuZDfT831jwkzCOENZn2tpm6YZAjGcmXBPyc68xu4WjVf-WDEUA345p2jxVXf3cb-I9ERMcMiGEDLEWQXHD4agmL8u8xteowLYz72jQdFYSZni9M2bxTStrLL6uo0MZ1TC-ob0W4KoYvnNJGaf4xt1sg',
    genres: ['Tiên Hiệp', 'Tu Chân', 'Mưu Lược'],
    tags: ['vương_triều', 'tu_tiên', 'mưu_kế'],
    status: 'Đang ra',
    description: 'Chung Sơn mang theo ký ức kiếp trước, lấy thân phận phàm nhân thành lập vương triều, hội tụ số mệnh bát phương, nghịch thiên cầu trường sinh!',
    rating: 4.8,
    ratingCount: 8400,
    views: '12.0M',
    listeners: '410k',
    chaptersCount: 520,
    totalAudioHours: '38h audio',
    badge: 'NEW',
    hasAudio: true,
    audioQuality: 'HQ 320k',
    currentChapter: 'Chương 520: Ngộ Đạo Thiên Môn',
    chapters: [
      {
        id: 'c-ts-520',
        storyId: 'story-truong-sinh-bat-tu',
        index: 520,
        title: 'Chương 520: Ngộ Đạo Thiên Môn',
        durationSec: 1560,
        durationFormatted: '26:00',
        isVip: false,
        publishedAt: '2 giờ trước',
        content: 'Chung Sơn đứng trước điện Thái Hòa, ánh mắt nhìn thẳng về phía cổng trời hư ảo nơi biển mây...',
        transcript: [
          { startSec: 0, endSec: 20, speaker: 'Khánh An Voice', text: 'Chung Sơn đứng trước điện Thái Hòa, ánh mắt nhìn thẳng về phía cổng trời hư ảo nơi biển mây ngút ngàn.' }
        ]
      }
    ]
  },
  {
    id: 'story-thon-phe-tinh-khong',
    slug: 'thon-phe-tinh-khong',
    title: 'Thôn Phệ Tinh Không',
    author: 'Ngã Cật Tây Hồng Thị',
    authorId: 'auth-nga-cat',
    narrator: 'Bá Đạt Voice',
    narratorGroup: 'Sci-Fi Soundlab',
    cover: 'https://lh3.googleusercontent.com/aida-public/AB6AXuDuIt69ML-KwDhHH7SvZjEEBkj2N9MJNDgKUrrPW1BMAblU49jT_FYmwr9JgLlfIR6NMMFxj39wBYQ6iLP1aFjnPwbrKm8AQNIk49Zw2jE2PH5f4bA76IeRb2F1UzkTh_JfuRDNM3hgbZfoQySaAdqx8yImmAXHP9P6Yh1rRKdZ4ZoVIMwmCxKpzH3Ie8TS2EoP02yhg2cxTrGsiYsrZozMy9GxTfvKsCafJep-DZ1zz6vUtoPa86o',
    genres: ['Khoa Huyễn', 'Dị Giới', 'Mạt Thế'],
    tags: ['vũ_trụ', 'cơ_giáp', 'thôn_phệ'],
    status: 'Đang ra',
    description: 'Năm Đại Niết Bàn biến đổi Địa Cầu, La Phong từ một học sinh nghèo khổ vươn lên thành cường giả tinh không vũ trụ, đoạt xá Kim Giác Cự Thú!',
    rating: 4.9,
    ratingCount: 19800,
    views: '28.9M',
    listeners: '1.2M',
    chaptersCount: 980,
    totalAudioHours: '92h audio',
    badge: 'MỚI RA',
    hasAudio: true,
    audioQuality: 'HQ 320k',
    currentChapter: 'Chương 980: Tinh Hệ Trụ Cột',
    chapters: [
      {
        id: 'c-tp-980',
        storyId: 'story-thon-phe-tinh-khong',
        index: 980,
        title: 'Chương 980: Tinh Hệ Trụ Cột',
        durationSec: 1800,
        durationFormatted: '30:00',
        isVip: false,
        publishedAt: '4 giờ trước',
        content: 'Phi thuyền vũ trụ xé toạc không gian, tiến vào tinh hệ Nguyên Thủy...',
        transcript: [
          { startSec: 0, endSec: 20, speaker: 'Bá Đạt Voice', text: 'Phi thuyền vũ trụ xé toạc không gian, tiến vào tinh hệ Nguyên Thủy với trường lực khổng lồ.' }
        ]
      }
    ]
  },
  {
    id: 'story-ma-dao-to-su',
    slug: 'ma-dao-to-su',
    title: 'Ma Đạo Tổ Sư - Audio',
    author: 'Mặc Hương Đồng Khứu',
    authorId: 'auth-mac-huong',
    narrator: 'Kịch Truyền Thanh Ánh Dương',
    narratorGroup: 'Full Cast Radio Drama',
    cover: 'https://lh3.googleusercontent.com/aida-public/AB6AXuCmNd5EsKjDlGrHm2nmicyzTZo34P6GcnhGDmsZAVqAKJxeCrHfmyT8oIN8BCF9XLagcGZ3ku7ES1bntnvSW4oPIwmxd3ghuQRpDavn3JS1_qXnPTYJEij8yuB-h3FRR1oqLnNN4eqY_7Y5klp230nzoW5Ev7kqnJB8OLzpDT9uqmikXMFDs5WDaNUUe0zzSiDwp1wax6NfW5ecCBFGi8kSvxQT5k9YEIjvMwyudPzdRqHTqyRJYCI',
    genres: ['Đam Mỹ', 'Tiên Hiệp', 'Linh Dị'],
    tags: ['kịch_truyền_thanh', 'sáo_trúc', 'cổ_phong'],
    status: 'Hoàn thành',
    description: 'Di Lăng Lão Tổ Ngụy Vô Tiện trùng sinh vào thân xác Mạc Huyền Vũ, hội ngộ Hàm Quang Quân Lam Vong Cơ giải mã bí ẩn âm mưu tu tiên giới.',
    rating: 5.0,
    ratingCount: 52000,
    views: '45.0M',
    listeners: '3.4M',
    chaptersCount: 112,
    totalAudioHours: 'Trọn bộ',
    badge: 'KỊCH THANH',
    hasAudio: true,
    audioQuality: 'Dolby Atmos Spatial',
    currentChapter: 'Tập 1: Trùng Sinh Mạc Gia Trang',
    chapters: [
      {
        id: 'c-md-1',
        storyId: 'story-ma-dao-to-su',
        index: 1,
        title: 'Tập 1: Trùng Sinh Mạc Gia Trang',
        durationSec: 2100,
        durationFormatted: '35:00',
        isVip: false,
        publishedAt: 'Trọn bộ',
        content: 'Tiếng chuông ngân vang trong đêm khuya, Mạc Huyền Vũ hiến xá triệu hoán Di Lăng Lão Tổ...',
        transcript: [
          { startSec: 0, endSec: 25, speaker: 'Ánh Dương Voice', text: 'Tiếng chuông ngân vang trong đêm khuya, khói nhang nghi ngút quanh trận pháp hiến xá đẫm máu.' }
        ]
      }
    ]
  },
  {
    id: 'story-nhat-niem-vinh-hang',
    slug: 'nhat-niem-vinh-hang',
    title: 'Nhất Niệm Vĩnh Hằng',
    author: 'Nhĩ Căn',
    authorId: 'auth-nhi-can',
    narrator: 'Văn Hiệp Voice',
    narratorGroup: 'Hài Kịch Audio',
    cover: 'https://lh3.googleusercontent.com/aida-public/AB6AXuB2jvHGjd5xf3CXJN_mbzKEm06i7RseDS1q2ylMgfWD8c9iZuzck_3yXrXvIFd-5Uz3vMJMF-OdCTb28EYPgiyhmjPS6Qga_Cpw0jRP-fiyHxjhFkSp2aLJ4uwI25279lTK899hczxGTlflaj-3acWiZCqeoPUx6fqJ8M0uIDNi40wjxpBhmmb5faE_z81-XPJGKVGb52HXjGyrQa4sXsxBnkPYooAOEkIhHPNKasu5O4sj80e2IRQ',
    genres: ['Hài Hước', 'Tu Chân', 'Tiên Hiệp'],
    tags: ['sợ_chết', 'bạch_tiểu_thuần', 'luyện_đan'],
    status: 'Đang ra',
    description: 'Bạch Tiểu Thuần, thiếu niên sợ chết nhất thiên hạ, thắp hương cầu tiên cốt, bước vào Linh Khê Tông quậy long trời lở đất!',
    rating: 4.7,
    ratingCount: 16200,
    views: '19.4M',
    listeners: '890k',
    chaptersCount: 740,
    totalAudioHours: '54h audio',
    badge: 'CẬP NHẬT',
    hasAudio: true,
    audioQuality: 'HQ 320k',
    currentChapter: 'Chương 740: Bạch Tiểu Thuần Đại Náo',
    chapters: [
      {
        id: 'c-nn-740',
        storyId: 'story-nhat-niem-vinh-hang',
        index: 740,
        title: 'Chương 740: Bạch Tiểu Thuần Đại Náo Bắc Hàn',
        durationSec: 1620,
        durationFormatted: '27:00',
        isVip: false,
        publishedAt: 'Hôm qua',
        content: 'Bạch Tiểu Thuần vuốt nhẹ cằm, mắt lim dim: Ta chỉ là một thiếu niên thuần khiết hiền lành, sao các ngươi cứ sợ ta thế?',
        transcript: [
          { startSec: 0, endSec: 20, speaker: 'Văn Hiệp Voice', text: 'Bạch Tiểu Thuần vuốt nhẹ cằm, mắt lim dim nhìn lò đan khói đen bốc ngùn ngụt.' }
        ]
      }
    ]
  },
  {
    id: 'story-quy-bi-chi-chu',
    slug: 'quy-bi-chi-chu',
    title: 'Quỷ Bí Chi Chủ',
    author: 'Mực Thích Lặn Nước',
    authorId: 'auth-muc-thich',
    narrator: 'Voice Master Group',
    narratorGroup: 'Gothic Audio Studio',
    cover: 'https://lh3.googleusercontent.com/aida-public/AB6AXuCYF2OwfCZ_PITjuxYT7-rBIR23YrCg6L8ZVkCrJR7dbIH3X3mbHGYQRvrzqCABC4s4HV09_L5R6OkXGHMb6Khtih5nilaPsFfeldxtOsSNyyNQqdksGO-cDUBr1MEc2G63GarklCoAhbKDEatmG7WaNb8qmPdL0CGnS0Ak1tuUdz2CvoSEDe9zsn88x2cC47_2utCACtCLCxIEM7F6GSxysXc_65nTnXj_LTMiVtg6mX1I2vRtROg',
    genres: ['Dị Năng', 'Bí Ẩn', 'Khoa Huyễn'],
    tags: ['tarot', 'steampunk', 'cthulhu', 'huyền_bí'],
    status: 'Hoàn thành',
    description: 'Chu Minh Thụy xuyên không thành Klein Moretti trong một thế giới hơi nước máy móc ma pháp steampunk. Hội Tarot thần bí, ma dược chuỗi tuần tự...',
    rating: 4.95,
    ratingCount: 68400,
    views: '54.0M',
    listeners: '4.1M',
    chaptersCount: 1420,
    totalAudioHours: 'Đầy đủ',
    badge: 'SIÊU PHẨM',
    hasAudio: true,
    audioQuality: 'HQ 320k Lossless',
    currentChapter: 'Chương 1: Bắt Đầu Từ Chú Đỏ',
    chapters: [
      {
        id: 'c-qb-1',
        storyId: 'story-quy-bi-chi-chu',
        index: 1,
        title: 'Chương 1: Bắt Đầu Từ Chú Đỏ',
        durationSec: 1980,
        durationFormatted: '33:00',
        isVip: false,
        publishedAt: 'Hoàn thành',
        content: `Cơn đau nhức dữ dội lan tràn trong hộp sọ, như thể có ai đó vừa dùng búa bổ củi giáng mạnh vào thái dương...`,
        transcript: [
          { startSec: 0, endSec: 25, speaker: 'Voice Master', text: 'Cơn đau nhức dữ dội lan tràn trong hộp sọ, như thể có ai đó vừa dùng búa bổ củi giáng mạnh vào thái dương.' },
          { startSec: 25, endSec: 50, speaker: 'Klein Moretti', text: 'Mùi máu tanh nồng... vết thương do đạn bắn? Mình không phải vừa mới kết thúc nghi thức chúc phúc thời vận hay sao?' }
        ]
      }
    ]
  },
  {
    id: 'story-dai-phung-da-canh-nhan',
    slug: 'dai-phung-da-canh-nhan',
    title: 'Đại Phụng Đả Canh Nhân',
    author: 'Mại Báo Tiểu Lang Quân',
    authorId: 'auth-mai-bao',
    narrator: 'Hùng Sơn',
    narratorGroup: 'Thính Lực Đài',
    cover: 'https://lh3.googleusercontent.com/aida-public/AB6AXuCiETjmESKBZFD1PkUIoIixAV_s5xv8_Kfy1Y6l-XfUU9a453C5snNA9-5UoiOWUxOhbE9Xqps4IFdygr9uStplmN-P21CVYUMbESJwMlpr_H-FxnPmmNi8hul3ylAxiHyG1xWCt7J8sQCChxSdm_aivBG0p2BzEoHYbnp7zEKxOBJ0Lkw5rvFE-QsNsACwSATG9zgB9ZFHllknJfuscuoPIUR8ZZv5Yow2NPxjSDaVH1vgAi-BiZA',
    genres: ['Kiếm Hiệp', 'Xuyên Không', 'Hài Hước'],
    tags: ['phá_án', 'đả_canh_nhân', 'thi_ từ'],
    status: 'Hoàn thành',
    description: 'Hứa Thất An tốt nghiệp trường cảnh sát xuyên không đến vương triều Đại Phụng, làm một đả canh nhân tay cầm đao gõ mõ canh giữ công lý.',
    rating: 4.9,
    ratingCount: 42100,
    views: '38.0M',
    listeners: '3.9M',
    chaptersCount: 932,
    totalAudioHours: '86h',
    badge: 'ĐỘC QUYỀN',
    hasAudio: true,
    audioQuality: 'HQ 320k',
    currentChapter: 'Chương 482: Trảm Ma Kiếm',
    chapters: [
      {
        id: 'c-dpdcn-482',
        storyId: 'story-dai-phung-da-canh-nhan',
        index: 482,
        title: 'Chương 482: Trảm Ma Kiếm',
        durationSec: 2100,
        durationFormatted: '35:00',
        isVip: false,
        publishedAt: 'Hôm qua',
        content: 'Trấn Bắc Vương cấu kết Vu Thần Giáo đồ sát ba mươi vạn sinh linh Sở Châu. Hứa Thất An cầm Trảm Mã Đao đứng sừng sững trên tường thành...',
        transcript: [
          { startSec: 0, endSec: 20, speaker: 'Hùng Sơn', text: 'Trấn Bắc Vương cấu kết Vu Thần Giáo đồ sát ba mươi vạn sinh linh Sở Châu luyện hóa Huyết Đan.' },
          { startSec: 20, endSec: 45, speaker: 'Hứa Thất An', text: 'Thần đao dưới trướng Đả Canh Nhân, hôm nay trảm bạt vương tộc phản quốc!' }
        ]
      }
    ]
  }
];

export const CULTIVATION_LEADERBOARD: CultivationUser[] = [
  {
    rank: 1,
    name: 'Thanh Vân Đạo Tổ',
    realm: 'Hóa Thần 9',
    avatar: 'https://lh3.googleusercontent.com/aida-public/AB6AXuCiETjmESKBZFD1PkUIoIixAV_s5xv8_Kfy1Y6l-XfUU9a453C5snNA9-5UoiOWUxOhbE9Xqps4IFdygr9uStplmN-P21CVYUMbESJwMlpr_H-FxnPmmNi8hul3ylAxiHyG1xWCt7J8sQCChxSdm_aivBG0p2BzEoHYbnp7zEKxOBJ0Lkw5rvFE-QsNsACwSATG9zgB9ZFHllknJfuscuoPIUR8ZZv5Yow2NPxjSDaVH1vgAi-BiZA',
    listeningHours: 184,
    chaptersCompleted: 3240,
    xp: 148500,
    title: 'Quán Quân'
  },
  {
    rank: 2,
    name: 'Bạch Thiển Dạ',
    realm: 'Nguyên Anh 4',
    avatar: 'https://lh3.googleusercontent.com/aida-public/AB6AXuD7-L5YlJ4y0DDKAkDJbuQjgQbnpFgWDuJGgFT5ZLyKkNuo3tU7KoJYD6WiUZg63JrjNCy98qiiWJkvQTBHWycnMffLvBqlwxGa4bMHplKszX-49vGUFmvqTG5SFFqWd922FibJWgVhZ6oCZr1sp6jhqLY1mxka3M4xAL9xhOiN2HIoRdKuQd3m7B9Ix-UQE8plkKPKCeKzWWZIhJqZ5d-U4D-JWFn6M-leR8zI_p4ZXM7GdRAaXvQ',
    listeningHours: 142,
    chaptersCompleted: 2890,
    xp: 122100,
    title: 'Á Quân'
  },
  {
    rank: 3,
    name: 'Mạc Vô Kỵ',
    realm: 'Kim Đan 8',
    avatar: 'https://lh3.googleusercontent.com/aida-public/AB6AXuD4Z2EwlaGhZi2IeHKj8w5ZeN5FC4j0WNzpTGPKh7QR7xgqRgIv92VWntVTXipBeTot6ww3stN2ewrpmCs6KhEXdSx4XmDD_QJYc8XU46AqGaAWlsYvHDyMUWOwrbaALGdHn7YEwS1Jb5XTelDMnfTz1MlNi3r5EJahkiqOE0J7g4kCNMTdyEcCzIXC3HOVddufDJwEWMLBephZ4nIdBH12yPW8TX585kerq9IvZLI8B1QpDJnhDLU',
    listeningHours: 118,
    chaptersCompleted: 2120,
    xp: 98400,
    title: 'Quý Quân'
  },
  {
    rank: 4,
    name: 'Diệp Thần Tông Chủ',
    realm: 'Kim Đan 5',
    avatar: 'https://lh3.googleusercontent.com/aida-public/AB6AXuAIhC-8odJEfaNiXWijXjFG44uIDIeWudSyujH0L18vHhJTjZT8cwI6tKRhcBORccrewHqn7YCaKLVEXtAJO3GOU1ii7iJyXJ4ULZyzK9yPzf-zxfIs_-pNCNoMj_rPY-5CYwDNT87guLoSVNFiotJp0g0lnfc4FtJREPPO2ctyT9E9W-2c2nxV2ujqPJMIDknGO42txc0IF5BTN5snkF9ud6xHJLgJbzr5d2DIqs0TTfa4p7Og_fw',
    listeningHours: 96,
    chaptersCompleted: 1850,
    xp: 75200,
    title: 'Hộ Pháp'
  }
];

export const MOCK_COMMENTS: Comment[] = [
  {
    id: 'comm-1',
    userName: 'Lạc Anh Thần',
    userAvatar: 'https://lh3.googleusercontent.com/aida-public/AB6AXuCiETjmESKBZFD1PkUIoIixAV_s5xv8_Kfy1Y6l-XfUU9a453C5snNA9-5UoiOWUxOhbE9Xqps4IFdygr9uStplmN-P21CVYUMbESJwMlpr_H-FxnPmmNi8hul3ylAxiHyG1xWCt7J8sQCChxSdm_aivBG0p2BzEoHYbnp7zEKxOBJ0Lkw5rvFE-QsNsACwSATG9zgB9ZFHllknJfuscuoPIUR8ZZv5Yow2NPxjSDaVH1vgAi-BiZA',
    userRealm: 'Hóa Thần 2',
    content: 'Giọng đọc diễn cảm xuất sắc quá, hiệu ứng âm thanh 8D nghe qua tai nghe cực kỳ đã tai! Đỉnh chóp!',
    timestamp: '15 phút trước',
    likes: 42,
    chapterIndex: 128
  },
  {
    id: 'comm-2',
    userName: 'Tử Nguyệt Cô Nương',
    userAvatar: 'https://lh3.googleusercontent.com/aida-public/AB6AXuD7-L5YlJ4y0DDKAkDJbuQjgQbnpFgWDuJGgFT5ZLyKkNuo3tU7KoJYD6WiUZg63JrjNCy98qiiWJkvQTBHWycnMffLvBqlwxGa4bMHplKszX-49vGUFmvqTG5SFFqWd922FibJWgVhZ6oCZr1sp6jhqLY1mxka3M4xAL9xhOiN2HIoRdKuQd3m7B9Ix-UQE8plkKPKCeKzWWZIhJqZ5d-U4D-JWFn6M-leR8zI_p4ZXM7GdRAaXvQ',
    userRealm: 'Nguyên Anh 5',
    content: 'Đoạn kiếm khí bộc phát nghe nổi da gà. Vừa nghe vừa theo dõi transcript đồng bộ rất tiện lợi.',
    timestamp: '1 giờ trước',
    likes: 19,
    chapterIndex: 128
  },
  {
    id: 'comm-3',
    userName: 'Tiêu Dao Tử',
    userAvatar: 'https://lh3.googleusercontent.com/aida-public/AB6AXuD4Z2EwlaGhZi2IeHKj8w5ZeN5FC4j0WNzpTGPKh7QR7xgqRgIv92VWntVTXipBeTot6ww3stN2ewrpmCs6KhEXdSx4XmDD_QJYc8XU46AqGaAWlsYvHDyMUWOwrbaALGdHn7YEwS1Jb5XTelDMnfTz1MlNi3r5EJahkiqOE0J7g4kCNMTdyEcCzIXC3HOVddufDJwEWMLBephZ4nIdBH12yPW8TX585kerq9IvZLI8B1QpDJnhDLU',
    userRealm: 'Kim Đan 3',
    content: 'Hóng chương mới từng ngày. Đã nạp VIP để ủng hộ đội ngũ sản xuất và tác giả!',
    timestamp: '3 giờ trước',
    likes: 8,
    chapterIndex: 128
  }
];

export const DEFAULT_PLAYLISTS: Playlist[] = [
  {
    id: 'pl-sleep',
    name: 'Nghe trước khi ngủ',
    icon: 'bedtime',
    description: 'Âm giọng trầm ấm, tiết tấu thư giãn êm dịu',
    storyIds: ['story-he-thong-vo-dich', 'story-truong-sinh-bat-tu', 'story-ma-dao-to-su'],
    createdAt: '2025-01-10'
  },
  {
    id: 'pl-cultivation',
    name: 'Tu Tiên Cày Đêm',
    icon: 'swords',
    description: 'Những trận chiến oanh liệt, đột phá cảnh giới nghẹt thở',
    storyIds: ['story-dau-pha-khung-thuong', 'story-van-co-than-de', 'story-thon-phe-tinh-khong'],
    createdAt: '2025-02-01'
  },
  {
    id: 'pl-favorites',
    name: 'Siêu phẩm tâm đắc',
    icon: 'favorite',
    description: 'Tuyển tập kiệt tác cốt truyện sâu sắc',
    storyIds: ['story-quy-bi-chi-chu', 'story-toan-chuc-cao-thu', 'story-dai-phung-da-canh-nhan'],
    createdAt: '2025-02-15'
  }
];
