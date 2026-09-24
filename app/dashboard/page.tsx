"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { routeForRole } from "@/lib/roles";
import { validateSession } from "@/lib/api";

export default function DashboardPage() {
  const router = useRouter();

  useEffect(() => {
    let active = true;
    validateSession()
      .then((user) => {
        if (active) router.replace(routeForRole(user.roleName));
      })
      .catch(() => {
        if (active) router.replace("/login");
      });
    return () => {
      active = false;
    };
  }, [router]);

  return (
    <main className="grid min-h-screen place-items-center bg-equine-paper text-sm text-slate-600">
      Đang chuyển đến bảng điều khiển...
    </main>
  );
}
