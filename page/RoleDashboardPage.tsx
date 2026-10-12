"use client";

import { Routes } from "@/routes/Routes";

import { useParams, useRouter } from "next/navigation";
import { useEffect } from "react";
import HorseShell, { useHorseUser } from "@/components/horses/HorseShell";
import { validateSession } from "@/api/client";
import { roleForSlug, routeForRole } from "@/lib/roles";
import VeterinarianWorkspace from "@/components/veterinarian/VeterinarianWorkspace";
import HorseOwnerWorkspace from "@/components/horse-owner/HorseOwnerWorkspace";
import HeadTrainerWorkspace from "@/components/head-trainer/HeadTrainerWorkspace";
import GroomWorkspace from "@/components/groom/GroomWorkspace";
import ClubManagerWorkspace from "@/components/club-manager/ClubManagerWorkspace";

export default function RoleDashboardPage() {
  const { role } = useParams<{ role: string }>();
  const router = useRouter();
  useEffect(() => {
    let active = true;
    validateSession()
      .then((current) => {
        if (!active) return;
        if (current.mustChangePassword) {
          router.replace(Routes.changePassword);
          return;
        }
        if (roleForSlug(role) !== current.roleName) {
          router.replace(routeForRole(current.roleName));
        }
      })
      .catch(() => {
        if (active) router.replace(Routes.login);
      });
    return () => {
      active = false;
    };
  }, [role, router]);

  return <HorseShell><RoleDashboardContent /></HorseShell>;
}

function RoleDashboardContent() {
  const user = useHorseUser();

  return (
    <section className="dashboard-workspace">
      {user.roleName === "VETERINARIAN" ? <VeterinarianWorkspace /> : user.roleName === "HORSE_OWNER" ? <HorseOwnerWorkspace /> : user.roleName === "HEAD_TRAINER" ? <HeadTrainerWorkspace /> : user.roleName === "GROOM" ? <GroomWorkspace /> : user.roleName === "CLUB_MANAGER" ? <ClubManagerWorkspace /> : (
        <div className="mt-10 rounded-md border border-equine-gold/25 bg-white p-5 text-sm text-slate-600">
          Chức năng chuyên môn của vai trò này sẽ xuất hiện tại đây khi phân hệ tương ứng được triển khai.
        </div>
      )}
    </section>
  );
}
