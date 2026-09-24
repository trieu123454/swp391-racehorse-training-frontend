"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { routeForRole } from "@/lib/roles";
import { getUser } from "@/lib/session";

export default function DashboardPage() {
  const router = useRouter();

  useEffect(() => {
    const currentUser = getUser();
    if (!currentUser) {
      router.replace("/login");
      return;
    }
    router.replace(routeForRole(currentUser.roleName));
  }, [router]);

  return (
    <main className="grid min-h-screen place-items-center bg-equine-paper text-sm text-slate-600">
      Đang chuyển đến bảng điều khiển...
    </main>
  );
}
