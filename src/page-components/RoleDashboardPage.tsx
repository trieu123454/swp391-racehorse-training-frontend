"use client";

import { Routes } from "@/routes/Routes";

import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import HorseShell, { useHorseUser } from "@/components/horses/HorseShell";
import { ApiRequestError, validateSession } from "@/api/client";
import { roleForSlug, routeForRole } from "@/lib/roles";
import VeterinarianWorkspace from "@/components/veterinarian/VeterinarianWorkspace";
import HorseOwnerWorkspace from "@/components/horse-owner/HorseOwnerWorkspace";
import HeadTrainerWorkspace from "@/components/head-trainer/HeadTrainerWorkspace";
import GroomWorkspace from "@/components/groom/GroomWorkspace";
import ClubManagerWorkspace from "@/components/club-manager/ClubManagerWorkspace";

export default function RoleDashboardPage() {
  const role = useParams<{ role: string }>()?.role ?? "";
  const router = useRouter();
  const [attempt, setAttempt] = useState(0);
  const [validationError, setValidationError] = useState("");

  useEffect(() => {
    let active = true;
    validateSession(attempt > 0)
      .then((current) => {
        if (!active) return;
        setValidationError("");
        if (current.mustChangePassword) {
          router.replace(Routes.changePassword);
          return;
        }
        if (roleForSlug(role) !== current.roleName) {
          router.replace(routeForRole(current.roleName));
        }
      })
      .catch((reason: unknown) => {
        if (!active) return;
        if (reason instanceof ApiRequestError && reason.status === 401) {
          router.replace(Routes.login);
          return;
        }
        setValidationError(
          "Không thể xác thực phiên với máy chủ. Hãy kiểm tra kết nối backend rồi thử lại.",
        );
      });
    return () => {
      active = false;
    };
  }, [attempt, role, router]);

  return (
    <HorseShell>
      {validationError && (
        <div
          role="alert"
          className="mb-5 flex flex-wrap items-center justify-between gap-3 rounded-md border border-red-200 bg-red-50 p-4 text-sm text-red-800"
        >
          <span>{validationError}</span>
          <button
            type="button"
            className="font-semibold underline underline-offset-2"
            onClick={() => {
              setValidationError("");
              setAttempt((value) => value + 1);
            }}
          >
            Thử lại
          </button>
        </div>
      )}
      <RoleDashboardContent />
    </HorseShell>
  );
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
