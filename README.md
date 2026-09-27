# AudioTalents

AudioTalents là ứng dụng web local-first để xuất bản, kiểm duyệt và nghe truyện Audio. Workspace gồm React/Vite client và Node.js/Express server dùng MongoDB. MinIO là dependency local tùy chọn cho upload, playback và các bài kiểm thử media thật.

## Yêu cầu local

- Git
- Node.js và npm (workspace hiện được kiểm thử với Node.js 24)
- MongoDB lắng nghe tại `127.0.0.1:27017`
- MinIO tại `127.0.0.1:9000`, console `9001`, khi kiểm thử hoặc phát media thật

Trên PowerShell của máy hiện tại, dùng `npm.cmd` để tránh `npm.ps1` bị ExecutionPolicy chặn. Không cần thay đổi ExecutionPolicy.

## Cài dependency

```powershell
cd server
npm.cmd install
cd ..\client
npm.cmd install
```

## Khởi động MongoDB

Nếu MongoDB đã được cài như Windows service:

```powershell
Start-Service MongoDB
```

Hoặc chạy trực tiếp với một thư mục dữ liệu local đã tạo trước:

```powershell
mongod --dbpath <local-data-directory> --bind_ip 127.0.0.1 --port 27017
```

## Cấu hình và chạy server

```powershell
cd server
Copy-Item .env.example .env
# Điền secret/SMTP/storage local trong .env; không commit file này.
npm.cmd run dev
```

Server mặc định chạy tại `http://localhost:5000`; health check là `GET /api/health`. `MONGODB_URI` local mặc định nên trỏ tới `mongodb://127.0.0.1:27017/audiotalents`.

SMTP là dependency bên ngoài phục vụ OTP thật. Nếu chưa cấu hình `MAIL_*`, các flow gửi email không được xem là đã acceptance.

## Cấu hình và chạy client

```powershell
cd client
Copy-Item .env.example .env
npm.cmd run dev
```

Client chạy tại `http://localhost:3000` và dùng `VITE_API_URL=http://localhost:5000/api`.

## MinIO local tùy chọn

Ví dụ chạy MinIO binary local:

```powershell
minio server <local-media-directory> --address 127.0.0.1:9000 --console-address 127.0.0.1:9001
```

Media test dùng file `server/.env.phase41d1.local` đã được Git ignore, DB `audiotalents_phase41d1_test` và bucket `audiotalents-phase41d1-test`. Không dùng DB chính `audiotalents` cho integration test và không commit credential.

## Kiểm thử local

```powershell
cd server
npm.cmd test
npm.cmd run test:integration:media
npm.cmd run test:integration:media-lifecycle

cd ..\client
npm.cmd run test:player
npm.cmd run lint
npm.cmd run build
```

D1/D2 cần MongoDB và MinIO local. Các integration suite Mongo khác dùng `MONGODB_TEST_URI`; luôn xác nhận URI test trước khi chạy vì suite có cleanup database.

## Tài liệu còn hiệu lực

- [Trạng thái phát triển local](./AUDIOTALENTS_LOCAL_DEVELOPMENT_STATUS.md)
- [Database Core V1](./server/AUDIOTALENTS_DATABASE_CORE_V1.md)
- [Audio Part Ordering V2.1](./server/AUDIOTALENTS_CREATOR_CONTENT_V2_1.md)
- [Taxonomy V2.2](./server/AUDIOTALENTS_CREATOR_CONTENT_V2_2_TAXONOMY.md)
- [Player Stability V1](./client/AUDIOTALENTS_PLAYER_STABILITY_V1.md)

Deployment, production Docker/cloud, Payment runtime, Premium, Analytics và AI đang được hoãn cho tới khi sản phẩm local ổn định.
