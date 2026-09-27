# AudioTalents — Local Development Status

## Mục tiêu hiện tại

AudioTalents ưu tiên hoàn thiện và acceptance sản phẩm trên máy local. Deployment, CI/CD, production Docker/cloud và hạ tầng production chưa thuộc checkpoint này.

## Module đã có

- Identity/Auth: đăng ký, OTP email, xác minh email, login, JWT access/refresh, logout, quên/đặt lại mật khẩu, profile và trạng thái tài khoản.
- Creator access: nộp đơn Creator, Admin duyệt/từ chối, `authorStatus`; không có role `AUTHOR`.
- Content: Genre, Tag, Taxonomy Proposal, Story, Chapter, moderation và soft delete theo các contract hiện hành.
- Audio/media: part ordering V2.1, upload grant, MinIO upload/inspection/confirm, playback signing, soft-delete retention, restore và cleanup foundation.
- Personalization/community: Library, Favorites, ListenHistory/progress, Playlist, Notification, Comment, Rating và Report foundation.
- Admin/Audit: Creator application review, content moderation, taxonomy management và AuditLog append-only.
- Client: auth UI, Home/Explore/Genres/Rankings, Story Detail, Reader, player, Library, Creator Studio và Admin UI ở các mức hoàn thiện khác nhau.
- Payment foundation models/helpers vẫn được giữ nguyên nhưng Payment runtime chưa phải ưu tiên.

Production repository runtime dùng MongoDB cho Identity, Content, Personalization, Community và Audit. Creator discovery vẫn dùng InMemory và cần migration riêng; InMemory test adapters vẫn cần thiết cho unit test.

## Baseline kiểm thử

- Server unit: `164/164 PASS` sau Auth/Identity acceptance.
- Player unit: `6/6 PASS` sau Auth/Identity acceptance.
- Client lint: `PASS` sau Auth/Identity acceptance.
- Client build: `PASS` sau Auth/Identity acceptance.
- D1 real media pipeline: checkpoint gần nhất `1/1 PASS`; lần kiểm tra sau cleanup bị `ENVIRONMENT_BLOCKED` vì MongoDB và MinIO local không chạy.
- D2 real media lifecycle: checkpoint gần nhất `1/1 PASS`; không chạy lại sau cleanup vì cùng dependency local đang tắt.

Các kết quả này không thay thế local browser acceptance. D1/D2 phải được chạy lại khi MongoDB và MinIO sẵn sàng.

## Auth / Identity checkpoint

Trạng thái: **PARTIAL / SMTP_BLOCKED**.

- Runtime local đã xác nhận: MongoDB `127.0.0.1:27017`, backend `http://127.0.0.1:5000`, frontend `http://127.0.0.1:3000`, API client `http://localhost:5000/api` và CORS cho `http://localhost:3000` hoạt động.
- Database acceptance dùng đúng DB phát triển `audiotalents`, chỉ kiểm tra read-only. Không drop/reset/seed và không sửa trực tiếp trạng thái Auth. Trước và sau kiểm thử đều có `0` User và `0` OtpToken.
- SMTP local đang `MISSING`; đăng ký trả lỗi cấu hình có kiểm soát và rollback cả User/OTP. Forgot password cho email không tồn tại trả phản hồi chung để tránh account enumeration.
- SMTP dùng Nodemailer generic, không khóa vào một nhà cung cấp. Tên biến contract là `MAIL_HOST`, `MAIL_PORT`, `MAIL_USER`, `MAIL_PASSWORD`, `MAIL_FROM`; port mặc định là `587`, `MAIL_FROM` fallback về `MAIL_USER`, và port `465` tự bật secure transport. `server/.env` đã được Git ignore nhưng hiện chưa có các biến mail này, nên connectivity và delivery không thể chạy hợp lệ.
- Contract đã xác nhận: đăng ký tạo `USER`, `authorStatus: NONE`, `accountStatus: ACTIVE`, chưa xác minh; password dùng bcrypt; OTP chỉ lưu hash, có purpose, expiry, cooldown, giới hạn số lần thử và single-use.
- JWT access chứa định danh, role, loại token và tokenVersion; refresh token có định danh, loại token và tokenVersion. `authorStatus` không nằm trong JWT. Client hiện lưu access/refresh token trong `localStorage` và khôi phục phiên bằng `/auth/me` cùng cơ chế refresh khi gặp 401.
- Sửa lỗi tối thiểu: chuẩn hóa email trước validation; ghi `lastLoginAt` khi login thành công; thu hẹp public User DTO để không lộ email/trạng thái nội bộ; ẩn thông báo lỗi SMTP bất ngờ sau lỗi 500; Auth UI hiển thị rõ trường hợp SMTP local chưa cấu hình.
- Browser automation không khả dụng trong môi trường công cụ hiện tại, nên chưa thể xác nhận trực tiếp loading/navigation/refresh persistence bằng browser. Source audit xác nhận form có required/email/minLength/confirm-password, trạng thái loading/disabled, thông báo lỗi/thành công và password visibility.
- Các flow cần email thật gồm nhận OTP, verify, login tài khoản đã verify, resend, reset password và profile sau login chưa thể acceptance end-to-end. Không giả lập để tuyên bố PASS.
- Lần chạy `LOCAL SMTP / AUTH COMPLETION V1` xác nhận practical API an toàn: register `503 SMTP_NOT_CONFIGURED`, forgot-password cho email không tồn tại trả generic `200`, login email không tồn tại trả `401 INVALID_CREDENTIALS`, refresh token sai trả `401`, và `/auth/me` không xác thực trả `401`. Mongo trước/sau vẫn có `0` User và `0` OtpToken.
- Regression sau lần chạy này: server `164/164 PASS`, player `6/6 PASS`, client lint `PASS`, client build `PASS`. D1/D2 giữ nguyên baseline đã biết và không khởi động MinIO cho Auth.
- Rủi ro còn lại: logout phía server hiện stateless, không có per-session refresh-token revocation; chuỗi consume OTP rồi cập nhật User chưa có transaction xuyên hai thao tác. Cần quyết định hardening riêng, không thay đổi contract trong checkpoint này.

## Khoảng trống đã biết

- Chưa hoàn tất canonical browser E2E Creator → Admin → Listener với dữ liệu local thật.
- Auth/Identity đã audit và regression đầy đủ nhưng practical browser/API/Mongo acceptance còn bị SMTP local và browser automation chặn.
- SMTP local thật cần credential hợp lệ; không được giả lập để tuyên bố acceptance.
- Creator discovery còn là runtime InMemory.
- Player vẫn cần browser acceptance cho chuyển trạng thái, playback redirect và lỗi media thật.
- D2 chưa chứng minh qua browser/API đầy đủ các nhánh delete/playback/restore/partNumber.
- Một số UI Wallet/VIP/Gift đang hiện diện nhưng Payment/Premium runtime bị hoãn.
- Admin Users/Reports/Catalog và listener features cần phân loại PASS/PARTIAL/BROKEN/NOT_IMPLEMENTED bằng acceptance local.
- Database Core V1 còn một số mô tả lịch sử migration; giữ làm contract và cần reconciliation riêng, không sửa trong cleanup này.

## Thiết lập local chuẩn

1. MongoDB chạy bằng Windows Service `AudioTalentsMongoDB` (`Automatic`) trên `127.0.0.1:27017`, dùng data path hiện có `C:\Users\PC\AppData\Local\AudioTalentsData\MongoDB`. Auto-start sau reboot vẫn là `PENDING_REBOOT_TEST` cho đến khi kiểm tra thực tế sau một lần restart Windows.
2. Tạo `server/.env` từ `.env.example`, dùng DB local `audiotalents` và secret local không commit.
3. Sau khi port `27017` sẵn sàng, chạy server bằng `npm.cmd run dev` trong `server`. Backend chỉ mở port `5000` sau khi kết nối Mongo thành công.
4. Tạo `client/.env` từ `.env.example`, đặt `VITE_API_URL=http://localhost:5000/api`.
5. Chạy client bằng `npm.cmd run dev` trong `client`.
6. Chỉ chạy MinIO local khi kiểm thử/upload/playback media thật.

Runtime connection contract: backend luôn nạp chính xác `server/.env` bất kể working directory; CORS lấy `CLIENT_URL` qua config trung tâm; frontend dùng `buildApiUrl` làm nguồn ghép API URL chung. PowerShell trên máy này có ExecutionPolicy `Restricted`, vì vậy dùng `npm.cmd`, không thay đổi policy hệ thống.

Chi tiết lệnh và biến môi trường nằm trong [README](./README.md).

## Roadmap local-first

### A. Local Runtime Stability

Chuẩn hóa startup MongoDB, server và client; kiểm tra health/config; dùng MinIO tùy chọn cho media. Không xây Docker orchestration.

### B. Auth / Identity

Acceptance Register → OTP → Verify → Login → Refresh/session → Logout → Forgot/Reset password → Profile/Account status. Đối chiếu Mongo sau từng hành động, không bao giờ đọc hoặc lưu plaintext password.

### C. Creator Access

Acceptance USER → Creator application → Admin approval → `authorStatus: APPROVED` → Creator Studio, kèm xác minh Mongo.

### D. Taxonomy / Content

Acceptance Genre, Tag, Taxonomy Proposal, Story và Chapter qua flow UI/API canonical; đối chiếu persistence và moderation.

### E. Audio Browser Acceptance

Dùng media foundation đã PASS để kiểm tra upload thật → READY → Admin moderation → public playback → player → part ordering trên browser local.

### F. Listener

Phân loại Home, Explore, Genre, Story Detail, Reader, Player, Library, Favorites, History, Playlist, Notification, Comment, Rating và Report thành PASS/PARTIAL/BROKEN/NOT_IMPLEMENTED.

### G. Admin

Acceptance Creator applications, Story/Chapter/Audio moderation, Users, Reports, AuditLog và Catalog. Không tạo analytics giả.

### H. Security Hardening

Sau khi core local ổn định, audit JWT/refresh/revocation, password reset, OTP, rate limits, brute force, account status, validation, CORS local, headers, XSS/CSRF, DTO leakage và media capability.

## Đang hoãn

Payment runtime, Premium, Analytics, AI, creator earnings, wallet, gifts, deployment, CI/CD, production Docker/cloud/R2/SMTP và monitoring.

## Giai đoạn kế tiếp

**LOCAL SMTP CONFIGURATION RESOLUTION**.
