/** Browser routes only. API endpoint paths remain in the api/ clients. */
export const Routes = {
  home: "/",
  login: "/login",
  register: "/register",
  changePassword: "/change-password",
  dashboard: "/dashboard",
  dashboardRole: (slug: string) => `/dashboard/${slug}`,
  dashboardTab: (roleRoute: string, tab: string) =>
    tab === "overview" ? roleRoute : `${roleRoute}?tab=${encodeURIComponent(tab)}`,
  clubManagerUsers: "/club-manager/users",
  horses: "/horses",
  horseNew: "/horses/new",
  horse: (id: string) => `/horses/${encodeURIComponent(id)}`,
  horseEdit: (id: string) => `/horses/${encodeURIComponent(id)}/edit`,
  homeSection: (id: string) => `/#${encodeURIComponent(id)}`,
} as const;
