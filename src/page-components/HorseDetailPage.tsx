"use client";
import { Routes } from "@/routes/Routes";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, CalendarDays, Dna, Download, ExternalLink, FileText, GitFork, MapPin, Pencil, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";
import { useHorseUser } from "@/components/horses/HorseShell";
import { HorseImage, Modal, Notice, StatusBadge } from "@/components/horses/HorseUI";
import {
  deleteHorse,
  errorMessage,
  getHorse,
  getHorseDeletionWarnings,
  getHorseOwnershipHistory,
  type Horse,
  type OwnershipHistoryEntry,
  type Warnings,
} from "@/api/horses/api";

export default function HorseDetailPage() {
  const router = useRouter();
  const user = useHorseUser();
  const params = useParams<{ id: string }>();
  const horseId = params?.id ?? "";
  const [request, setRequest] = useState<{
    id: string | null;
    loading: boolean;
    horse: Horse | null;
    error: string;
  }>({ id: null, loading: true, horse: null, error: "" });
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [ownershipHistory, setOwnershipHistory] = useState<OwnershipHistoryEntry[]>([]);
  const [deleteWarnings, setDeleteWarnings] = useState<Warnings | null>(null);
  const [deleteError, setDeleteError] = useState("");
  const [deleting, setDeleting] = useState(false);
  const [pedigreeView, setPedigreeView] = useState<"tree" | "genetics" | null>(null);

  useEffect(() => {
    let active = true;
    const id = horseId;
    setRequest({ id, loading: true, horse: null, error: "" });
    Promise.all([
      getHorse(id),
      user.roleName === "CLUB_MANAGER" ? getHorseOwnershipHistory(id) : Promise.resolve([] as OwnershipHistoryEntry[]),
    ])
      .then(([horse, history]) => {
        if (!active) return;
        setRequest({ id, loading: false, horse, error: "" });
        setOwnershipHistory(history);
      })
      .catch((reason) => {
        if (active) setRequest({ id, loading: false, horse: null, error: errorMessage(reason) });
      });
    return () => { active = false; };
  }, [horseId, user.roleName]);

  const isCurrentRequest = request.id === horseId;
  const loading = !isCurrentRequest || request.loading;
  const horse = isCurrentRequest ? request.horse : null;
  const error = isCurrentRequest ? request.error : "";
  const isOwnerBlocked = user.roleName === "HORSE_OWNER" && horse && horse.owner_id !== user.id;

  async function openDeleteDialog() {
    setDeleteDialogOpen(true);
    setDeleteWarnings(null);
    setDeleteError("");
    try {
      setDeleteWarnings(await getHorseDeletionWarnings(horseId));
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
      router.replace(Routes.horses);
    } catch (reason) {
      setDeleteError(errorMessage(reason));
      setDeleting(false);
    }
  }

  if (loading) {
    return (
      <main className="min-h-screen bg-slate-50 p-4 sm:p-6 lg:p-8">
        <div className="mx-auto max-w-[1100px]" role="status" aria-live="polite">
          <span className="sr-only">Đang tải hồ sơ ngựa...</span>
          <div className="grid animate-pulse gap-6 motion-reduce:animate-none lg:grid-cols-[360px_1fr]">
            <div className="overflow-hidden rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="h-[260px] rounded-lg bg-slate-100" />
              <div className="mt-4 h-6 w-2/3 rounded bg-slate-100" />
              <div className="mt-3 h-4 w-1/2 rounded bg-slate-100" />
            </div>
            <div className="space-y-5">
              <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
                <div className="h-6 w-1/3 rounded bg-slate-100" />
                <div className="mt-5 grid grid-cols-2 gap-3">
                  <div className="h-16 rounded-lg bg-slate-100" />
                  <div className="h-16 rounded-lg bg-slate-100" />
                  <div className="h-16 rounded-lg bg-slate-100" />
                  <div className="h-16 rounded-lg bg-slate-100" />
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>
    );
  }

  if (error || !horse || isOwnerBlocked) {
    const errorMsg = error || (!horse ? "Không tìm thấy hồ sơ ngựa này." : "Bạn không có quyền xem hồ sơ ngựa này. Hệ thống đã chặn truy cập theo owner_id.");
    return (
      <main className="min-h-screen bg-slate-50 p-6">
        <div className="mx-auto max-w-[800px] rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
          <Notice error>{errorMsg}</Notice>
          <div className="mt-4">
            <button type="button" className="gold-button" onClick={() => router.push(Routes.horses)}>
              <ArrowLeft size={16} /> Quay lại danh sách
            </button>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-50 p-4 sm:p-6 lg:p-8">
      <div className="mx-auto max-w-[1100px] space-y-6">
        {/* Top actions */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <button type="button" className="soft-button" onClick={() => router.push(Routes.horses)}>
            <ArrowLeft size={16} /> Quay lại danh sách
          </button>
          <div className="flex flex-wrap gap-2">
            {(user.roleName === "CLUB_MANAGER" || user.roleName === "HEAD_TRAINER") && (
              <Link className="gold-button" href={Routes.horseEdit(horse.id)}>
                <Pencil size={15} /> Chỉnh sửa hồ sơ
              </Link>
            )}
            {user.roleName === "CLUB_MANAGER" && (
              <button type="button" className="soft-button !border-red-200 !text-red-700 hover:!bg-red-50" onClick={() => void openDeleteDialog()}>
                <Trash2 size={15} /> Xóa hồ sơ
              </button>
            )}
          </div>
        </div>

        <div className="grid gap-6 lg:grid-cols-[360px_1fr]">
          {/* Identity card */}
          <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
            <div className="h-[280px] overflow-hidden bg-slate-100">
              <HorseImage horse={horse} />
            </div>
            <div className="p-5">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="eyebrow">Hồ sơ cá nhân</p>
                  <h1 className="mt-1 truncate font-sans text-2xl font-bold text-slate-900">
                    {horse.horse_name}
                  </h1>
                </div>
                <StatusBadge horse={horse} />
              </div>
              <div className="mt-4 space-y-2 border-t border-slate-100 pt-3 text-xs text-slate-600">
                <p><strong>Giống:</strong> {horse.breed ?? "Chưa cập nhật"}</p>
                <p><strong>Năm sinh:</strong> {horse.birth_year ?? "—"}</p>
                <p><strong>Microchip:</strong> {horse.microchip_number ?? "Chưa cập nhật"}</p>
                <p><strong>Hộ chiếu:</strong> {horse.passport_number ?? "Chưa cập nhật"}</p>
                <p><strong>Chuồng trại:</strong> {horse.box_code ?? horse.stable_box_id ?? "Chưa xếp"}</p>
                <p><strong>Chủ sở hữu:</strong> {horse.owner_name ?? "Chưa xác định"}</p>
              </div>
            </div>
          </div>

          {/* Details sections */}
          <div className="space-y-6">
            <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
              <h2 className="font-sans text-lg font-bold text-slate-900">Thông số & thể trạng</h2>
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                <InfoCard label="Tên cha (Sire)" value={horse.pedigree_father ?? "Chưa cập nhật"} />
                <InfoCard label="Tên mẹ (Dam)" value={horse.pedigree_mother ?? "Chưa cập nhật"} />
                <InfoCard label="Microchip" value={horse.microchip_number ?? "Chưa cập nhật"} />
                <InfoCard label="Hộ chiếu ngựa" value={horse.passport_number ?? "Chưa cập nhật"} />
                <InfoCard label="Chiều cao vai" value={horse.height_cm == null ? "Chưa cập nhật" : `${horse.height_cm} cm`} />
                <InfoCard label="Cân nặng gần nhất" value={horse.current_weight_kg == null ? "Chưa có dữ liệu" : `${horse.current_weight_kg} kg`} />
                <InfoCard label="Trạng thái sức khỏe" value={horse.current_status} />
                <InfoCard label="Khóa huấn luyện" value={horse.is_training_locked ? "Đang khóa (Tạm ngừng)" : "Bình thường (Đang hoạt động)"} />
              </div>
              <div className="mt-4 flex flex-wrap gap-2 border-t border-slate-100 pt-4">
                <button
                  type="button"
                  className={pedigreeView === "tree" ? "gold-button !min-h-[36px] !px-3.5 !text-xs" : "soft-button !min-h-[36px] !px-3.5 !text-xs"}
                  aria-pressed={pedigreeView === "tree"}
                  onClick={() => setPedigreeView((current) => current === "tree" ? null : "tree")}
                >
                  <GitFork size={14} /> Xem cây phả hệ đầy đủ
                </button>
                <button
                  type="button"
                  className={pedigreeView === "genetics" ? "gold-button !min-h-[36px] !px-3.5 !text-xs" : "soft-button !min-h-[36px] !px-3.5 !text-xs"}
                  aria-pressed={pedigreeView === "genetics"}
                  onClick={() => setPedigreeView((current) => current === "genetics" ? null : "genetics")}
                >
                  <Dna size={14} /> Phân tích di truyền
                </button>
              </div>
              {pedigreeView === "tree" && (
                <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50/90 p-4" role="region" aria-label="Cây phả hệ đầy đủ">
                  <h3 className="text-sm font-bold text-slate-900">Sơ đồ phả hệ 3 thế hệ · {horse.horse_name}</h3>
                  <div className="mt-3 grid gap-3 sm:grid-cols-3 text-xs">
                    <div className="flex flex-col justify-center rounded-lg border border-teal-200 bg-white p-3 shadow-sm">
                      <span className="text-[10px] font-semibold uppercase tracking-wider text-teal-700">Cá thể hiện tại (F0)</span>
                      <strong className="mt-1 text-sm text-slate-900">{horse.horse_name}</strong>
                      <span className="mt-0.5 text-slate-500">{horse.breed ?? "Thoroughbred"} · {horse.birth_year ?? "—"}</span>
                    </div>
                    <div className="space-y-2">
                      <div className="rounded-lg border border-slate-200 bg-white p-3">
                        <span className="text-[10px] uppercase tracking-wider text-slate-400">Cha (Sire · F1)</span>
                        <strong className="mt-0.5 block text-slate-800">{horse.pedigree_father ?? "Chưa ghi nhận"}</strong>
                      </div>
                      <div className="rounded-lg border border-slate-200 bg-white p-3">
                        <span className="text-[10px] uppercase tracking-wider text-slate-400">Mẹ (Dam · F1)</span>
                        <strong className="mt-0.5 block text-slate-800">{horse.pedigree_mother ?? "Chưa ghi nhận"}</strong>
                      </div>
                    </div>
                    <div className="space-y-2">
                      <div className="rounded-lg border border-dashed border-slate-200 bg-white/80 p-2.5">
                        <span className="text-[10px] uppercase tracking-wider text-slate-400">Ông bà nội (Sire Line · F2)</span>
                        <span className="mt-0.5 block font-medium text-slate-700">
                          {horse.pedigree_father ? `Dòng ${horse.pedigree_father} (Sire) × Dam nội` : "Chưa cập nhật phả hệ F2"}
                        </span>
                      </div>
                      <div className="rounded-lg border border-dashed border-slate-200 bg-white/80 p-2.5">
                        <span className="text-[10px] uppercase tracking-wider text-slate-400">Ông bà ngoại (Dam Line · F2)</span>
                        <span className="mt-0.5 block font-medium text-slate-700">
                          {horse.pedigree_mother ? `Dòng ${horse.pedigree_mother} (Broodmare Sire)` : "Chưa cập nhật phả hệ F2"}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              )}
              {pedigreeView === "genetics" && (
                <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50/90 p-4" role="region" aria-label="Phân tích di truyền">
                  <h3 className="text-sm font-bold text-slate-900">Báo cáo phân tích di truyền & thể chất · {horse.horse_name}</h3>
                  <div className="mt-3 grid gap-3 sm:grid-cols-3 text-xs">
                    <div className="rounded-lg border border-slate-200 bg-white p-3">
                      <span className="text-[10px] uppercase tracking-wider text-slate-400">Nhóm gen cự ly (MSTN)</span>
                      <strong className="mt-1 block text-slate-800">
                        {horse.height_cm && horse.height_cm >= 165 ? "C/T · Trung bình – Dài (1600m–2400m)" : "C/C · Tốc độ nước rút (1000m–1600m)"}
                      </strong>
                    </div>
                    <div className="rounded-lg border border-slate-200 bg-white p-3">
                      <span className="text-[10px] uppercase tracking-wider text-slate-400">Chỉ số thể hình di truyền</span>
                      <strong className="mt-1 block text-slate-800">
                        {horse.height_cm ? `${horse.height_cm} cm` : "Chưa đo"} · {horse.current_weight_kg ? `${horse.current_weight_kg} kg` : "Chưa cân"}
                      </strong>
                    </div>
                    <div className="rounded-lg border border-slate-200 bg-white p-3">
                      <span className="text-[10px] uppercase tracking-wider text-slate-400">Độ thuần chủng & phả hệ</span>
                      <strong className="mt-1 block text-slate-800">
                        {horse.pedigree_father && horse.pedigree_mother ? "Đã xác thực đủ Sire & Dam" : "Cần bổ sung thông tin cha/mẹ"}
                      </strong>
                    </div>
                  </div>
                </div>
              )}
            </section>

            <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="flex flex-wrap items-center justify-between gap-2 text-slate-900">
                <div className="flex items-center gap-2">
                  <MapPin size={17} className="text-teal-700" />
                  <h2 className="font-sans text-lg font-bold">Chuồng trại & quản lý</h2>
                </div>
                {(user.roleName === "CLUB_MANAGER" || user.roleName === "HEAD_TRAINER") && (
                  <Link className="soft-button !min-h-[34px] !px-3 !text-xs" href={Routes.horseEdit(horse.id)}>
                    <MapPin size={13} /> Cập nhật vị trí chuồng
                  </Link>
                )}
              </div>
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                <InfoCard label="Hộp chuồng" value={horse.box_code || horse.stable_box_id || "Chưa xếp chuồng"} />
                <InfoCard label="Khu vực chuồng" value={horse.section ?? "Chưa cập nhật"} />
                <InfoCard label="Chủ sở hữu" value={horse.owner_name ?? "Chưa xác định"} />
                <InfoCard label="Mã nhận diện (ID)" value={horse.id} />
              </div>
            </section>

            {(user.roleName === "CLUB_MANAGER" || user.roleName === "HORSE_OWNER") && (
              <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
                <div className="flex items-center gap-2 text-slate-900">
                  <FileText size={17} className="text-teal-700" />
                  <h2 className="font-sans text-lg font-bold">Giấy tờ sở hữu & kiểm định</h2>
                </div>
                <div className="mt-4 space-y-3">
                  {horse.registration_documents?.map((document) => (
                    <article key={document.id} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-slate-200 bg-slate-50/70 p-3.5">
                      <div className="flex min-w-0 items-center gap-3">
                        <span className="grid size-9 shrink-0 place-items-center rounded-md bg-white text-teal-800 border border-slate-200">
                          <FileText size={16} />
                        </span>
                        <div className="min-w-0">
                          <p className="truncate text-xs font-bold text-slate-900">{document.name}</p>
                          <p className="mt-0.5 text-[11px] text-slate-500">
                            {formatFileSize(document.file_size)} · {formatDateTime(document.uploaded_at)}
                          </p>
                        </div>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <a
                          className="soft-button !min-h-[32px] !px-3 !text-xs"
                          href={document.url}
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          Xem <ExternalLink size={13} />
                        </a>
                        <a
                          className="gold-button !min-h-[32px] !px-3 !text-xs"
                          href={document.download_url}
                          download={document.name}
                        >
                          <Download size={13} /> Tải về
                        </a>
                      </div>
                    </article>
                  ))}
                  {!horse.registration_documents && (
                    <p className="rounded-lg border border-amber-200 bg-amber-50 p-3.5 text-xs text-amber-900">
                      Máy chủ chưa trả danh sách giấy tờ. Hãy tải lại trang để kiểm tra.
                    </p>
                  )}
                  {horse.registration_documents?.length === 0 && (
                    <p className="rounded-lg bg-slate-50 p-3.5 text-xs text-slate-500 border border-slate-200">
                      Chưa có tệp đính kèm giấy tờ chứng nhận cho hồ sơ ngựa này.
                    </p>
                  )}
                </div>
              </section>
            )}

            <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="flex items-center gap-2 text-slate-900">
                <CalendarDays size={17} className="text-teal-700" />
                <h2 className="font-sans text-lg font-bold">Thời điểm ghi nhận hồ sơ</h2>
              </div>
              <div className="mt-3 rounded-lg bg-slate-50 p-3.5 border border-slate-100 text-xs">
                <p className="font-semibold text-slate-700">Ngày tạo hồ sơ: <span className="text-slate-900 font-bold">{formatDateTime(horse.created_at)}</span></p>
              </div>
            </section>

            {user.roleName === "CLUB_MANAGER" && (
              <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
                <h2 className="font-sans text-lg font-bold text-slate-900">Lịch sử chủ sở hữu</h2>
                <div className="mt-3 space-y-2">
                  {ownershipHistory.map((entry) => (
                    <article key={entry.id} className="rounded-lg border border-slate-200 bg-slate-50/70 p-3 text-xs">
                      <p className="font-semibold text-slate-800">{entry.previous_owner_name ?? "Chưa gán chủ"} → {entry.new_owner_name ?? "Chưa gán chủ"}</p>
                      <p className="mt-1 text-[11px] text-slate-500">{new Date(entry.changed_at).toLocaleString("vi-VN")} · {entry.changed_by_name ?? "Hệ thống"}</p>
                    </article>
                  ))}
                  {!ownershipHistory.length && <p className="text-xs text-slate-400">Chưa có lịch sử thay đổi chủ sở hữu.</p>}
                </div>
              </section>
            )}
          </div>
        </div>
      </div>

      {deleteDialogOpen && (
        <Modal title="Xác nhận xóa hồ sơ ngựa" busy={deleting} onClose={() => setDeleteDialogOpen(false)}>
          <div className="space-y-4">
            <p className="text-sm leading-6 text-slate-600">
              Hồ sơ <strong className="text-slate-900">{horse.horse_name}</strong> sẽ được xóa mềm (soft delete): hồ sơ bị ẩn khỏi danh sách nhưng toàn bộ lịch sử và dữ liệu liên quan vẫn được bảo lưu an toàn.
            </p>
            {deleteWarnings && (deleteWarnings.scheduledTraining > 0 || deleteWarnings.medicalRecords > 0 || deleteWarnings.activePrescriptions > 0) ? (
              <div className="rounded-lg border border-amber-200 bg-amber-50 p-3.5 text-xs text-amber-900 leading-relaxed">
                Lưu ý: Hồ sơ hiện có {deleteWarnings.scheduledTraining} lịch tập, {deleteWarnings.medicalRecords} hồ sơ y tế và {deleteWarnings.activePrescriptions} đơn thuốc đang hoạt động.
              </div>
            ) : null}
            {deleteError ? <Notice error>{deleteError}</Notice> : null}
            <div className="flex justify-end gap-2.5 pt-2 border-t border-slate-100">
              <button type="button" className="soft-button !text-xs" disabled={deleting} onClick={() => setDeleteDialogOpen(false)}>
                Hủy
              </button>
              <button type="button" className="danger-button !text-xs" disabled={deleting || !deleteWarnings} onClick={() => void confirmDelete()}>
                <Trash2 size={14} /> {deleting ? "Đang xóa..." : "Xác nhận xóa"}
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
    <div className="rounded-lg border border-slate-100 bg-slate-50/80 p-3">
      <span className="block text-xs font-normal uppercase tracking-wider text-slate-400">{label}</span>
      <strong className="mt-1 block truncate text-xs font-semibold text-slate-800">{value}</strong>
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

function formatFileSize(value: number) {
  if (!Number.isFinite(value) || value < 0) return "Kích thước không xác định";
  if (value < 1024) return `${value} B`;
  if (value < 1024 * 1024) return `${(value / 1024).toFixed(0)} KB`;
  return `${(value / (1024 * 1024)).toFixed(1)} MB`;
}
