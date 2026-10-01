# SWP391 - Hệ thống quản lý huấn luyện ngựa đua - Frontend

Frontend Next.js cho đề tài **Hệ thống quản lý huấn luyện ngựa đua**, môn **SWP391**.

Tên dự án: `swp391-racehorse-training-frontend`.

## Chay local

Mở terminal tại thư mục `swp391-racehorse-training-frontend` trước khi chạy các lệnh bên dưới.

```powershell
copy .env.local.example .env.local
npm.cmd install
npm.cmd run dev
```

Mo:

```text
http://localhost:3000
```

Backend mac dinh:

```text
http://localhost:8080
```

## Code layout

- `app/` contains Next.js routes, route layouts, and global styles.
- `features/<actor>/` keeps each actor workspace beside its API client (`api.ts`). Actor folders are `club-manager`, `groom`, `head-trainer`, `horse-owner`, and `veterinarian`.
- `features/horses/` contains horse pages' shared UI, owner selection, and horse API client.
- `features/auth/` contains sign-in and registration UI.
- `shared/components/` and `shared/hooks/` contain UI and hooks used by multiple features.
- `lib/` contains app-wide authentication, session, role, and API infrastructure.
