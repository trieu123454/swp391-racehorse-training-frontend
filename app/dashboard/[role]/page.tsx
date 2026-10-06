"use client";

import { useParams, useRouter } from "next/navigation";
import { useEffect } from "react";
import HorseShell, { useHorseUser } from "@/features/horses/HorseShell";
import { validateSession } from "@/lib/api";
import { roleForSlug, routeForRole } from "@/lib/roles";
import VeterinarianWorkspace from "@/features/veterinarian/VeterinarianWorkspace";
import HorseOwnerWorkspace from "@/features/horse-owner/HorseOwnerWorkspace";
import HeadTrainerWorkspace from "@/features/head-trainer/HeadTrainerWorkspace";
import GroomWorkspace from "@/features/groom/GroomWorkspace";
import ClubManagerWorkspace from "@/features/club-manager/ClubManagerWorkspace";

export default function RoleDashboardPage() {
  const { role } = useParams<{ role: string }>();
  const router = useRouter();
  useEffect(() => {
    let active = true;
    validateSession()
      .then((current) => {
        if (!active) return;
        if (current.mustChangePassword) {
          router.replace("/change-password");
          return;
        }
        if (roleForSlug(role) !== current.roleName) {
          router.replace(routeForRole(current.roleName));
        }
      })
      .catch(() => {
        if (active) router.replace("/login");
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
