"use client";

import HorseShell from "@/components/horses/HorseShell";

/** HorseShell preserves this legacy entry point and redirects to the role home + bell. */
export default function LegacyNotificationsPage() {
  return <HorseShell><p role="status" className="text-sm text-slate-500">Đang mở thông báo…</p></HorseShell>;
}
