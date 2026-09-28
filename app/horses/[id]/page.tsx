"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, CalendarDays, MapPin, Pencil, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";
import { useHorseUser } from "@/components/HorseShell";
import { HorseImage, Modal, Notice, StatusBadge } from "@/components/HorseUI";
import {
  deleteHorse,
  errorMessage,
  getHorse,
  getHorseDeletionWarnings,
  type Horse,
  type Warnings,
} from "@/lib/horses";

export default function HorseDetailPage() {
  const router = useRouter();
  const user = useHorseUser();
  const params = useParams<{ id: string }>();
  const [request, setRequest] = useState<{
    id: string | null;
    loading: boolean;
    horse: Horse | null;
    error: string;
  }>({ id: null, loading: true, horse: null, error: "" });
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deleteWarnings, setDeleteWarnings] = useState<Warnings | null>(null);
  const [deleteError, setDeleteError] = useState("");
  const [deleting, setDeleting] = useState(false);
  useEffect(() => {
    let active = true;
    const id = params.id;
    setRequest({ id, loading: true, horse: null, error: "" });
    getHorse(id)
      .then((horse) => {
        if (active) setRequest({ id, loading: false, horse, error: "" });
      })
      .catch((reason) => {
        if (active) setRequest({ id, loading: false, horse: null, error: errorMessage(reason) });
      });
    return () => { active = false; };
  }, [params.id]);

  const isCurrentRequest = request.id === params.id;
  const loading = !isCurrentRequest || request.loading;
  const horse = isCurrentRequest ? request.horse : null;
  const error = isCurrentRequest ? request.error : "";
  const isOwnerBlocked = user.roleName === "HORSE_OWNER" && horse && horse.owner_id !== user.id;

  async function openDeleteDialog() {
    setDeleteDialogOpen(true);
    setDeleteWarnings(null);
    setDeleteError("");
    try {
      setDeleteWarnings(await getHorseDeletionWarnings(params.id));
    } catch (reason) {
      setDeleteError(errorMessage(reason));
    }
  }

  async function confirmDelete() {
    if (!horse || user.roleName !== "CLUB_MANAGER") return;
    setDeleting(true);
    setDeleteError("");
    try {
      await deleteHorse(horse.id);
      router.replace("/horses");
    } catch (reason) {
      setDeleteError(errorMessage(reason));
      setDeleting(false);
    }
  }

  if (loading) {
    return (
      <main className="min-h-screen bg-equine-paper p-4 sm:p-6 lg:p-8">
        <div className="mx-auto max-w-[1100px]" role="status" aria-live="polite">
          <span className="sr-only">Đang tải hồ sơ ngựa...</span>
          <div className="grid animate-pulse gap-6 motion-reduce:animate-none lg:grid-cols-[380px_1fr]">
            <div className="overflow-hidden rounded-3xl border border-equine-line bg-white p-5 shadow-sm">
              <div className="h-[280px] rounded-2xl bg-equine-mist" />
              <div className="mt-5 h-6 w-2/3 rounded bg-equine-mist" />
              <div className="mt-4 h-4 w-1/2 rounded bg-equine-mist" />
              <div className="mt-3 h-4 w-3/4 rounded bg-equine-mist" />
            </div>
            <div className="space-y-6">
              <div className="h-56 rounded-3xl border border-equine-line bg-white p-5 shadow-sm">
                <div className="h-6 w-1/3 rounded bg-equine-mist" />
                <div className="mt-6 grid grid-cols-2 gap-4">
                  <div className="h-16 rounded-xl bg-equine-mist" />
                  <div className="h-16 rounded-xl bg-equine-mist" />
                  <div className="h-16 rounded-xl bg-equine-mist" />
                  <div className="h-16 rounded-xl bg-equine-mist" />
                </div>
              </div>
              <div className="h-40 rounded-3xl border border-equine-line bg-white shadow-sm" />
            </div>
          </div>
        </div>
      </main>
    );
  }

  if (error) {
    return <main className="min-h-screen bg-equine-paper p-6"><div className="mx-auto max-w-[900px] rounded-2xl border border-equine-line bg-white p-6"><Notice error>{error}</Notice><div className="mt-4"><button type="button" className="gold-button" onClick={() => router.push("/horses")}><ArrowLeft size={16} /> Quay lại danh sách</button></div></div></main>;
  }

  if (!horse) {
    return (
      <main className="min-h-screen bg-equine-paper p-6">
        <div className="mx-auto max-w-[900px] rounded-2xl border border-equine-line bg-white p-6">
          <Notice error>Không tìm thấy hồ sơ ngựa này.</Notice>
          <div className="mt-4">
            <button type="button" className="gold-button" onClick={() => router.push("/horses")}>
              <ArrowLeft size={16} /> Quay lại danh sách
            </button>
          </div>
        </div>
      </main>
    );
  }

  if (isOwnerBlocked) {
    return (
      <main className="min-h-screen bg-equine-paper p-6">
        <div className="mx-auto max-w-[900px] rounded-2xl border border-equine-line bg-white p-6">
          <Notice error>
            Bạn không có quyền xem hồ sơ ngựa này. Hệ thống đã chặn truy cập theo owner_id.
          </Notice>
          <div className="mt-4">
            <button type="button" className="gold-button" onClick={() => router.push("/horses")}>
              <ArrowLeft size={16} /> Trở về danh sách
            </button>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-equine-paper p-4 sm:p-6 lg:p-8">
      <div className="mx-auto max-w-[1100px] space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <button type="button" className="soft-button border-equine-line bg-white text-slate-700" onClick={() => router.push("/horses")}>
            <ArrowLeft size={16} /> Quay lại
          </button>
          <div className="flex flex-wrap gap-2">
            {user.roleName !== "HORSE_OWNER" && (
              <Link className="gold-button" href={`/horses/${horse.id}/edit`}>
                <Pencil size={16} /> Chỉnh sửa
              </Link>
            )}
            {user.roleName === "CLUB_MANAGER" && (
              <button type="button" className="soft-button border-red-200 bg-red-50 text-red-700" onClick={() => void openDeleteDialog()}>
                <Trash2 size={16} /> Xóa hồ sơ
              </button>
            )}
          </div>
        </div>

        <div className="grid gap-6 lg:grid-cols-[380px_1fr]">
          <div className="overflow-hidden rounded-3xl border border-equine-line bg-white shadow-sm">
            <div className="h-[280px] overflow-hidden rounded-t-3xl bg-[#f7f3ec]">
              <HorseImage horse={horse} />
            </div>
            <div className="p-5">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="eyebrow">Hồ sơ ngựa</p>
                  <h1 className="mt-2 font-sans text-3xl font-semibold text-equine-navy">
                    {horse.horse_name}
                  </h1>
                </div>
                <StatusBadge horse={horse} />
              </div>
              <div className="mt-5 space-y-2 text-sm text-slate-600">
                <p><strong>Giống:</strong> {horse.breed ?? "Chưa cập nhật"}</p>
                <p><strong>Năm sinh:</strong> {horse.birth_year ?? "—"}</p>
                <p><strong>Chuồng:</strong> {horse.box_code ?? horse.stable_box_id}</p>
                <p><strong>Chủ sở hữu:</strong> {horse.owner_name ?? "Chưa xác định"}</p>
              </div>
            </div>
          </div>

          <div className="space-y-6">
            <section className="rounded-3xl border border-equine-line bg-white p-5 shadow-sm">
              <h2 className="font-sans text-2xl font-semibold text-equine-navy">Thông tin cơ bản</h2>
              <div className="mt-5 grid gap-4 sm:grid-cols-2">
                <InfoCard label="Tên cha" value={horse.pedigree_father ?? "Chưa cập nhật"} />
                <InfoCard label="Tên mẹ" value={horse.pedigree_mother ?? "Chưa cập nhật"} />
                <InfoCard label="Trạng thái" value={horse.current_status} />
                <InfoCard label="Khóa huấn luyện" value={horse.is_training_locked ? "Có" : "Không"} />
              </div>
            </section>

            <section className="rounded-3xl border border-equine-line bg-white p-5 shadow-sm">
              <div className="flex items-center gap-2 text-equine-navy">
                <MapPin size={18} />
                <h2 className="font-sans text-2xl font-semibold">Chuồng trại & quản lý</h2>
              </div>
              <div className="mt-4 grid gap-4 sm:grid-cols-2">
                <InfoCard label="Chuồng" value={horse.box_code || horse.stable_box_id || "Chưa xếp chuồng"} />
                <InfoCard label="Khu vực" value={horse.section ?? "Chưa cập nhật"} />
                <InfoCard label="Chủ sở hữu" value={horse.owner_name ?? "Chưa xác định"} />
                <InfoCard label="Mã hồ sơ" value={horse.id} />
              </div>
            </section>

            <section className="rounded-3xl border border-equine-line bg-white p-5 shadow-sm">
              <div className="flex items-center gap-2 text-equine-navy">
                <CalendarDays size={18} />
                <h2 className="font-sans text-2xl font-semibold">Thời điểm ghi nhận</h2>
              </div>
              <div className="mt-4 rounded-2xl bg-[#f7f9ff] p-4">
                <p className="text-[10px] font-bold uppercase tracking-wide text-slate-500">Ngày tạo hồ sơ</p>
                <p className="mt-2 text-sm font-semibold text-equine-navy">{formatDateTime(horse.created_at)}</p>
                <p className="mt-2 text-xs leading-5 text-slate-500">Thời điểm hồ sơ ngựa được ghi nhận trên hệ thống.</p>
              </div>
            </section>
          </div>
        </div>
      </div>
      {deleteDialogOpen && (
        <Modal title="Xác nhận xóa hồ sơ ngựa" busy={deleting} onClose={() => setDeleteDialogOpen(false)}>
          <div className="space-y-4">
            <p className="text-sm leading-6 text-slate-600">
              Hồ sơ <strong>{horse.horse_name}</strong> sẽ được xóa mềm: hồ sơ bị ẩn khỏi danh sách nhưng lịch sử và dữ liệu liên quan vẫn được giữ lại.
            </p>
            {deleteWarnings ? (
              <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
                Hồ sơ hiện có {deleteWarnings.scheduledTraining} lịch tập, {deleteWarnings.medicalRecords} hồ sơ y tế và {deleteWarnings.activePrescriptions} đơn thuốc đang hoạt động.
              </div>
            ) : null}
            {deleteError ? <Notice error>{deleteError}</Notice> : null}
            <div className="flex justify-end gap-3 pt-2">
              <button type="button" className="soft-button border-equine-line bg-white text-slate-700" disabled={deleting} onClick={() => setDeleteDialogOpen(false)}>Hủy</button>
              <button type="button" className="soft-button border-red-200 bg-red-50 text-red-700" disabled={deleting || !deleteWarnings} onClick={() => void confirmDelete()}>
                <Trash2 size={15} /> {deleting ? "Đang xóa..." : "Xác nhận xóa"}
              </button>
            </div>
          </div>
        </Modal>
      )}
    </main>
  );
}

function InfoCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-equine-line bg-[#f7f9ff] p-4">
      <p className="text-[10px] font-bold uppercase tracking-wide text-slate-500">{label}</p>
      <p className="mt-2 text-sm font-semibold text-equine-navy">{value}</p>
    </div>
  );
}

function formatDateTime(value: string | null | undefined) {
  if (!value) return "Chưa cập nhật";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Chưa cập nhật";
  return new Intl.DateTimeFormat("vi-VN", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}
