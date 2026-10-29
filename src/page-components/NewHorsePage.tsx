"use client";

import Link from "next/link";
import { useHorseUser } from "@/components/horses/HorseShell";
import { Notice } from "@/components/horses/HorseUI";
import { Routes } from "@/routes/Routes";

export default function NewHorsePage() {
  const user = useHorseUser();
  const isManager = user.roleName === "CLUB_MANAGER";
  return (
    <main className="min-h-screen bg-slate-50 p-4 sm:p-6 lg:p-8">
      <div className="mx-auto max-w-[760px] rounded-xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
        <h1 className="font-sans text-2xl font-semibold text-slate-900">Đăng ký hồ sơ ngựa</h1>
        <div className="mt-4">
          <Notice>
            {isManager
              ? "Hồ sơ ngựa mới được tạo sau khi Horse Owner gửi yêu cầu kèm giấy tờ và Club Manager xem xét, phê duyệt."
              : "Horse Owner gửi yêu cầu đăng ký kèm giấy tờ xác minh. Club Manager sẽ xem xét và phản hồi trong hệ thống."}
          </Notice>
        </div>
        <div className="mt-5 flex flex-wrap gap-2">
          {isManager && <Link className="gold-button" href={Routes.dashboardTab(Routes.dashboardRole("club-manager"), "horse-requests")}>Mở yêu cầu chờ duyệt</Link>}
          <Link className="soft-button" href={Routes.horses}>Quay lại danh sách</Link>
        </div>
      </div>
    </main>
  );
}
