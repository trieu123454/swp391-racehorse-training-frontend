"use client";

import { Routes } from "@/routes/Routes";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { routeForRole } from "@/lib/roles";
import { validateSession } from "@/api/client";
import { getUser } from "@/lib/session";

export default function DashboardPage() {
  const router = useRouter();

  useEffect(() => {
    let active = true;
    try {
      const cached = getUser();
      if (cached && cached.status === "APPROVED") {
        router.replace(
          cached.mustChangePassword
            ? Routes.changePassword
            : routeForRole(cached.roleName),
        );
        return () => {
          active = false;
        };
      }
    } catch {
      // Fallback to validateSession
    }
    validateSession()
      .then((user) => {
        if (active)
          router.replace(
            user.mustChangePassword
              ? Routes.changePassword
              : routeForRole(user.roleName),
          );
      })
      .catch(() => {
        if (active) router.replace(Routes.login);
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
