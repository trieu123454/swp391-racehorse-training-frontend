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

- `src/app/` contains the required Next.js App Router entry files and layouts. Each `page.tsx` re-exports a page implementation so the browser URLs stay the same.
- `src/page-components/` contains page implementations. `src/pages/` is reserved as the requested project grouping name; Next.js treats a folder named `pages` as a router, so implementations live in `src/page-components/` to preserve the App Router.
- `src/components/` contains shared UI and components grouped by feature.
- `src/apis/` contains the shared HTTP client and feature API clients. The backend endpoint paths are unchanged.
- `public/img/` contains images served from `/img/`; `public/models/` contains 3D assets.
- `src/styles/` contains global CSS loaded by `src/app/layout.tsx`.
- `src/routes.tsx` is the source of browser page links; Next.js still handles routing through `src/app/`.
- `src/hooks/` and `src/lib/` contain reusable hooks, session state, types, and role helpers.
