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

- `app/` contains the required Next.js App Router entry files and layouts. Each `page.tsx` re-exports a page from `page/` so the browser URLs stay the same.
- `page/` contains page implementations.
- `components/` contains shared UI and components grouped by feature.
- `api/` contains the shared HTTP client and feature API clients. The backend endpoint paths are unchanged.
- `public/img/` contains images served from `/img/`; `public/models/` contains 3D assets.
- `styles/` contains global CSS loaded by `app/layout.tsx`.
- `routes/Routes.ts` is the source of browser page links; Next.js still handles routing through `app/`.
- `shared/hooks/` and `lib/` contain reusable hooks, session state, types, and role helpers.
