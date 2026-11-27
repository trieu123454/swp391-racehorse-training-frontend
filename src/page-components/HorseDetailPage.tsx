"use client";

import { formatDisplayDate } from "@/lib/display-format";
import { Routes } from "@/routes/Routes";

/* eslint-disable @next/next/no-img-element */
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, CalendarDays, Download, ExternalLink, FileText, MapPin, Pencil, Plus, RotateCcw, Trash2, Upload, X } from "lucide-react";
import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import { useAutoRefresh } from "@/shared/hooks/use-auto-refresh";
import { useHorseUser } from "@/components/horses/HorseShell";
import { HorseImage, Modal, Notice, StatusBadge } from "@/components/horses/HorseUI";
import {
  deleteHorse,
  errorMessage,
  getHorse,
  getHorseDocumentUrl,
  getHorseDeletionWarnings,
  getHorseOwnershipHistory,
  horseGender,
  horseStatus,
  openFreshDocument,
  peekCachedHorse,
  revokeHorseSupplementDocument,
  uploadHorseSupplementDocument,
  type Horse,
  type HorseRegistrationDocument,
  type OwnershipHistoryEntry,
  type SupplementDocumentType,
  type Warnings,
} from "@/api/horses/api";

const ALLOWED_DOC_TYPES = ["application/pdf", "image/jpeg", "image/png", "image/webp"] as const;
const MAX_DOC_BYTES = 10 * 1024 * 1024;
const DOCUMENT_TYPE_LABELS: Record<string, string> = {
  OWNERSHIP_PROOF: "Chứng minh sở hữu",
  HORSE_CERTIFICATE: "Giấy chứng nhận / Hộ chiếu",
  HEALTH_DOCUMENT: "Hồ sơ sức khỏe / Kiểm dịch",
  OTHER: "Giấy tờ khác",
};

export default function HorseDetailPage() {
  const router = useRouter();
  const user = useHorseUser();
  const params = useParams<{ id: string }>();
  const horseId = params?.id ?? "";
  const initialHorse = peekCachedHorse(horseId);
  const [request, setRequest] = useState<{
    id: string | null;
    loading: boolean;
    horse: Horse | null;
    error: string;
  }>({ id: initialHorse ? horseId : null, loading: !initialHorse, horse: initialHorse, error: "" });
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [ownershipHistory, setOwnershipHistory] = useState<OwnershipHistoryEntry[]>([]);
  const [deleteWarnings, setDeleteWarnings] = useState<Warnings | null>(null);
  const [deleteError, setDeleteError] = useState("");
  const [deleting, setDeleting] = useState(false);

  const [addDocOpen, setAddDocOpen] = useState(false);
  const [docType, setDocType] = useState<SupplementDocumentType>("HORSE_CERTIFICATE");
  const [docNote, setDocNote] = useState("");
  const [docFile, setDocFile] = useState<File | null>(null);
  const [docPreviewUrl, setDocPreviewUrl] = useState<string | null>(null);
  const [docProgress, setDocProgress] = useState(0);
  const [docSaving, setDocSaving] = useState(false);
  const [docError, setDocError] = useState("");
  const docInputRef = useRef<HTMLInputElement>(null);

  const [revokingDoc, setRevokingDoc] = useState<HorseRegistrationDocument | null>(null);
  const [revokeReason, setRevokeReason] = useState("");
  const [revokeError, setRevokeError] = useState("");
  const [revokeSaving, setRevokeSaving] = useState(false);

  useEffect(() => {
    if (!docFile || !docFile.type.startsWith("image/")) {
      setDocPreviewUrl(null);
      return;
    }
    const url = URL.createObjectURL(docFile);
    setDocPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [docFile]);

  const loadHorse = useCallback(async (force = false) => {
    const id = horseId;
    if (!id) return;
    const cached = !force ? peekCachedHorse(id) : null;
    try {
      const nextHorse = await getHorse(id, { force });
      setRequest({ id, loading: false, horse: nextHorse, error: "" });
    } catch (reason) {
      if (!cached && !force) {
        setRequest({ id, loading: false, horse: null, error: errorMessage(reason) });
      }
    }
    if (user.roleName === "CLUB_MANAGER") {
      getHorseOwnershipHistory(id)
        .then((history) => setOwnershipHistory(history))
        .catch(() => {});
    } else {
      setOwnershipHistory([]);
    }
  }, [horseId, user.roleName]);

  useEffect(() => {
    const id = horseId;
    const cached = peekCachedHorse(id);
    setRequest({ id, loading: !cached, horse: cached, error: "" });
    void loadHorse(false);
  }, [horseId, loadHorse]);

  useAutoRefresh(() => loadHorse(true), { enabled: Boolean(horseId), intervalMs: 20_000, minGapMs: 2_000 });

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

  function resetAddDocModal() {
    setDocType("HORSE_CERTIFICATE");
    setDocNote("");
    setDocFile(null);
    setDocProgress(0);
    setDocError("");
    if (docInputRef.current) docInputRef.current.value = "";
  }

  function onSelectSupplementFile(fileList: FileList | null) {
    const picked = fileList?.[0] ?? null;
    if (!picked) return;
    if (!ALLOWED_DOC_TYPES.includes(picked.type as (typeof ALLOWED_DOC_TYPES)[number])) {
      setDocError("Chỉ chấp nhận tệp PDF, JPG, PNG hoặc WebP.");
      if (docInputRef.current) docInputRef.current.value = "";
      return;
    }
    if (picked.size > MAX_DOC_BYTES) {
      setDocError("Dung lượng mỗi tệp không được vượt quá 10 MB.");
      if (docInputRef.current) docInputRef.current.value = "";
      return;
    }
    setDocError("");
    setDocFile(picked);
  }

  async function submitSupplementDoc(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!horse || user.roleName !== "CLUB_MANAGER") return;
    if (!docFile) {
      setDocError("Vui lòng chọn tệp giấy tờ trước khi lưu.");
      return;
    }
    setDocSaving(true);
    setDocError("");
    setDocProgress(0);
    try {
      await uploadHorseSupplementDocument(
        horse.id,
        { file: docFile, documentType: docType, note: docNote },
        setDocProgress,
      );
      setAddDocOpen(false);
      resetAddDocModal();
      await loadHorse(true);
    } catch (reason) {
      setDocError(errorMessage(reason));
    } finally {
      setDocSaving(false);
    }
  }

  async function submitRevokeDoc(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!horse || !revokingDoc || user.roleName !== "CLUB_MANAGER") return;
    const trimmed = revokeReason.trim();
    if (trimmed.length < 3) {
      setRevokeError("Vui lòng nhập lý do thu hồi tối thiểu 3 ký tự.");
      return;
    }
    setRevokeSaving(true);
    setRevokeError("");
    try {
      await revokeHorseSupplementDocument(horse.id, revokingDoc.id, trimmed);
      setRevokingDoc(null);
      setRevokeReason("");
      await loadHorse(true);
    } catch (reason) {
      setRevokeError(errorMessage(reason));
    } finally {
      setRevokeSaving(false);
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
            {user.roleName === "CLUB_MANAGER" && (
              <>
                <Link className="gold-button" href={Routes.horseEdit(horse.id)}>
                  <Pencil size={15} /> Chỉnh sửa hồ sơ
                </Link>
                <button type="button" className="soft-button !border-red-200 !text-red-700 hover:!bg-red-50" onClick={() => void openDeleteDialog()}>
                  <Trash2 size={15} /> Xóa hồ sơ
                </button>
              </>
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
                <p><strong>Giới tính:</strong> {horseGender(horse.gender) ?? "Chưa cập nhật"}</p>
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
                <InfoCard label="Giới tính" value={horseGender(horse.gender) ?? "Chưa cập nhật"} />
                <InfoCard label="Năm sinh" value={horse.birth_year == null ? "Chưa cập nhật" : String(horse.birth_year)} />
                <InfoCard label="Microchip" value={horse.microchip_number ?? "Chưa cập nhật"} />
                <InfoCard label="Hộ chiếu ngựa" value={horse.passport_number ?? "Chưa cập nhật"} />
                <InfoCard label="Chiều cao vai" value={horse.height_cm == null ? "Chưa cập nhật" : `${horse.height_cm} cm`} />
                <InfoCard label="Cân nặng gần nhất" value={horse.current_weight_kg == null ? "Chưa có dữ liệu" : `${horse.current_weight_kg} kg`} />
                <InfoCard label="Trạng thái sức khỏe" value={horseStatus(horse.current_status)} />
                <InfoCard label="Khóa huấn luyện" value={horse.is_training_locked ? "Đang khóa (Tạm ngừng)" : "Bình thường (Đang hoạt động)"} />
              </div>
            </section>

            <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="flex flex-wrap items-center justify-between gap-2 text-slate-900">
                <div className="flex items-center gap-2">
                  <MapPin size={17} className="text-teal-700" />
                  <h2 className="font-sans text-lg font-bold">Chuồng trại & quản lý</h2>
                </div>
                {user.roleName === "CLUB_MANAGER" && (
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

            {(user.roleName === "CLUB_MANAGER" || user.roleName === "HORSE_OWNER") && (() => {
              const allDocs = horse.registration_documents ?? [];
              const activeDocs = allDocs.filter((document) => !document.revoked_at);
              const revokedDocs = allDocs.filter((document) => Boolean(document.revoked_at));
              return (
                <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
                  <div className="flex flex-wrap items-center justify-between gap-2 text-slate-900">
                    <div className="flex items-center gap-2">
                      <FileText size={17} className="text-teal-700" />
                      <h2 className="font-sans text-lg font-bold">Giấy tờ sở hữu & kiểm định</h2>
                    </div>
                    {user.roleName === "CLUB_MANAGER" && (
                      <button
                        type="button"
                        className="soft-button !min-h-[34px] !px-3 !text-xs"
                        onClick={() => {
                          resetAddDocModal();
                          setAddDocOpen(true);
                        }}
                      >
                        <Plus size={14} /> Bổ sung giấy tờ
                      </button>
                    )}
                  </div>
                  <p className="mt-1 text-xs text-slate-500">
                    Giấy tờ đăng ký gốc được khóa cố định; Quản lý CLB chỉ có thể bổ sung giấy tờ mới hoặc thu hồi có lý do các tệp do CLB tải lên.
                  </p>
                  <div className="mt-4 space-y-3">
                    {activeDocs.map((document) => {
                      const isSupplement = document.source === "MANAGER_SUPPLEMENT";
                      return (
                        <article key={document.id} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-slate-200 bg-slate-50/70 p-3.5">
                          <div className="flex min-w-0 items-center gap-3">
                            <span className="grid size-9 shrink-0 place-items-center rounded-md bg-white text-teal-800 border border-slate-200">
                              <FileText size={16} />
                            </span>
                            <div className="min-w-0">
                              <div className="flex flex-wrap items-center gap-1.5">
                                <p className="truncate text-xs font-bold text-slate-900">{document.name}</p>
                                <span className={`rounded px-1.5 py-0.5 text-[10px] font-semibold ${isSupplement ? "bg-sky-100 text-sky-900" : "bg-slate-200 text-slate-700"}`}>
                                  {isSupplement ? "CLB bổ sung" : "Hồ sơ đăng ký gốc"}
                                </span>
                              </div>
                              <p className="mt-0.5 text-[11px] text-slate-500">
                                {DOCUMENT_TYPE_LABELS[document.document_type] ?? document.document_type} · {formatFileSize(document.file_size)} · {formatDateTime(document.uploaded_at)}
                                {document.uploaded_by_name ? ` · ${document.uploaded_by_name}` : ""}
                              </p>
                              {document.note && (
                                <p className="mt-1 text-[11px] text-slate-600">Ghi chú: {document.note}</p>
                              )}
                            </div>
                          </div>
                          <div className="flex flex-wrap gap-2">
                            <button
                              type="button"
                              className="soft-button !min-h-[32px] !px-3 !text-xs"
                              onClick={() => void openFreshDocument(() => getHorseDocumentUrl(horse.id, document.id, false), document.url)}
                            >
                              Xem <ExternalLink size={13} />
                            </button>
                            <button
                              type="button"
                              className="gold-button !min-h-[32px] !px-3 !text-xs"
                              onClick={() => void openFreshDocument(() => getHorseDocumentUrl(horse.id, document.id, true), document.download_url, document.name)}
                            >
                              <Download size={13} /> Tải về
                            </button>
                            {user.roleName === "CLUB_MANAGER" && document.can_revoke && (
                              <button
                                type="button"
                                className="soft-button !min-h-[32px] !border-rose-200 !px-3 !text-xs !text-rose-700 hover:!bg-rose-50"
                                onClick={() => {
                                  setRevokingDoc(document);
                                  setRevokeReason("");
                                  setRevokeError("");
                                }}
                              >
                                <RotateCcw size={13} /> Thu hồi
                              </button>
                            )}
                          </div>
                        </article>
                      );
                    })}
                    {!horse.registration_documents && (
                      <p className="rounded-lg border border-amber-200 bg-amber-50 p-3.5 text-xs text-amber-900">
                        Máy chủ chưa trả danh sách giấy tờ. Hãy tải lại trang để kiểm tra.
                      </p>
                    )}
                    {horse.registration_documents && activeDocs.length === 0 && (
                      <p className="rounded-lg bg-slate-50 p-3.5 text-xs text-slate-500 border border-slate-200">
                        Chưa có tệp đính kèm giấy tờ chứng nhận còn hiệu lực cho hồ sơ ngựa này.
                      </p>
                    )}
                    {user.roleName === "CLUB_MANAGER" && revokedDocs.length > 0 && (
                      <details className="rounded-lg border border-slate-200 bg-slate-50/50 p-3 text-xs">
                        <summary className="cursor-pointer font-semibold text-slate-600">
                          Giấy tờ bổ sung đã thu hồi ({revokedDocs.length})
                        </summary>
                        <div className="mt-2.5 space-y-2">
                          {revokedDocs.map((doc) => (
                            <div key={doc.id} className="rounded-md border border-slate-200 bg-white p-2.5 text-[11px] text-slate-600">
                              <p className="font-semibold text-slate-800 line-through">{doc.name}</p>
                              <p className="mt-0.5">Lý do thu hồi: <strong className="text-rose-700">{doc.revoke_reason}</strong></p>
                              <p className="mt-0.5 text-slate-500">
                                Thu hồi lúc {formatDateTime(doc.revoked_at)}{doc.revoked_by_name ? ` bởi ${doc.revoked_by_name}` : ""}
                              </p>
                            </div>
                          ))}
                        </div>
                      </details>
                    )}
                  </div>
                </section>
              );
            })()}

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
                      <p className="mt-1 text-[11px] text-slate-500">{formatDisplayDate(entry.changed_at, true)} · {entry.changed_by_name ?? "Hệ thống"}</p>
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

      {addDocOpen && (
        <Modal title="Bổ sung giấy tờ cho hồ sơ ngựa" busy={docSaving} onClose={() => { if (!docSaving) { setAddDocOpen(false); resetAddDocModal(); } }}>
          <form className="space-y-4" onSubmit={(event) => void submitSupplementDoc(event)}>
            <p className="text-xs leading-5 text-slate-600">
              Giấy tờ gốc từ đăng ký ban đầu được giữ nguyên. Tệp bổ sung sau khi lưu không thể sửa đè; kiểm tra kỹ bản xem trước bên dưới trước khi bấm lưu.
            </p>
            <label className="block">
              <span className="field-label">Loại giấy tờ</span>
              <select
                className="field-control w-full cursor-pointer"
                value={docType}
                disabled={docSaving}
                onChange={(event) => setDocType(event.target.value as SupplementDocumentType)}
              >
                <option value="HORSE_CERTIFICATE">Giấy chứng nhận / Hộ chiếu</option>
                <option value="HEALTH_DOCUMENT">Hồ sơ sức khỏe / Kiểm dịch</option>
                <option value="OTHER">Giấy tờ khác</option>
              </select>
            </label>
            <label className="block">
              <span className="field-label">Ghi chú (không bắt buộc)</span>
              <input
                maxLength={500}
                placeholder="Ví dụ: Hộ chiếu ngựa gia hạn năm 2026"
                className="field-control w-full px-3"
                value={docNote}
                disabled={docSaving}
                onChange={(event) => setDocNote(event.target.value)}
              />
            </label>
            <div className="rounded-lg border border-slate-200 bg-slate-50/70 p-3.5 space-y-2.5">
              <span className="field-label">Tệp đính kèm (PDF, JPG, PNG, WebP · tối đa 10 MB)</span>
              {docFile ? (
                <div className="space-y-2 rounded-md border border-slate-200 bg-white p-3">
                  {docPreviewUrl && (
                    <img src={docPreviewUrl} alt="Xem trước tệp" className="max-h-44 w-full rounded object-contain bg-slate-50" />
                  )}
                  <div className="flex items-center justify-between gap-2 text-xs">
                    <div className="min-w-0">
                      <p className="truncate font-semibold text-slate-900">{docFile.name}</p>
                      <p className="text-[11px] text-slate-500">{formatFileSize(docFile.size)}</p>
                    </div>
                    <button
                      type="button"
                      disabled={docSaving}
                      className="soft-button !min-h-[30px] !px-2.5 !text-xs"
                      onClick={() => {
                        setDocFile(null);
                        if (docInputRef.current) docInputRef.current.value = "";
                      }}
                    >
                      <X size={13} /> Chọn tệp khác
                    </button>
                  </div>
                </div>
              ) : (
                <label className="flex cursor-pointer items-center justify-center gap-2 rounded-lg border border-dashed border-slate-300 bg-white px-3 py-4 text-xs font-semibold text-slate-700 hover:bg-slate-50">
                  <Upload size={15} /> Chọn tệp từ máy tính
                  <input
                    ref={docInputRef}
                    type="file"
                    accept="application/pdf,image/jpeg,image/png,image/webp"
                    className="hidden"
                    disabled={docSaving}
                    onChange={(event) => onSelectSupplementFile(event.target.files)}
                  />
                </label>
              )}
              {docSaving && <progress className="h-1.5 w-full accent-teal-700" max="100" value={docProgress} />}
            </div>
            {docError ? <Notice error>{docError}</Notice> : null}
            <div className="flex justify-end gap-2.5 pt-2 border-t border-slate-100">
              <button type="button" className="soft-button !text-xs" disabled={docSaving} onClick={() => { setAddDocOpen(false); resetAddDocModal(); }}>
                Hủy
              </button>
              <button type="submit" className="gold-button !text-xs" disabled={docSaving || !docFile}>
                <Upload size={14} /> {docSaving ? "Đang tải lên..." : "Lưu giấy tờ bổ sung"}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {revokingDoc && (
        <Modal title="Thu hồi giấy tờ bổ sung" busy={revokeSaving} onClose={() => { if (!revokeSaving) setRevokingDoc(null); }}>
          <form className="space-y-4" onSubmit={(event) => void submitRevokeDoc(event)}>
            <p className="text-xs leading-5 text-slate-600">
              Tệp <strong className="text-slate-900">{revokingDoc.name}</strong> sẽ được ẩn khỏi danh sách hiệu lực và phía Chủ ngựa, nhưng vẫn giữ lịch sử kiểm toán trong hệ thống.
            </p>
            <label className="block">
              <span className="field-label">Lý do thu hồi <span className="text-rose-600">*</span></span>
              <textarea
                rows={3}
                maxLength={500}
                required
                placeholder="Ví dụ: Tải nhầm tệp của ngựa khác / ảnh bị mờ"
                className="field-control w-full px-3 py-2"
                value={revokeReason}
                disabled={revokeSaving}
                onChange={(event) => {
                  setRevokeReason(event.target.value);
                  setRevokeError("");
                }}
              />
            </label>
            {revokeError ? <Notice error>{revokeError}</Notice> : null}
            <div className="flex justify-end gap-2.5 pt-2 border-t border-slate-100">
              <button type="button" className="soft-button !text-xs" disabled={revokeSaving} onClick={() => setRevokingDoc(null)}>
                Đóng
              </button>
              <button type="submit" className="danger-button !text-xs" disabled={revokeSaving}>
                <RotateCcw size={14} /> {revokeSaving ? "Đang thu hồi..." : "Xác nhận thu hồi"}
              </button>
            </div>
          </form>
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
    day: "2-digit", month: "2-digit", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  }).format(date);
}

function formatFileSize(value: number) {
  if (!Number.isFinite(value) || value < 0) return "Kích thước không xác định";
  if (value < 1024) return `${value} B`;
  if (value < 1024 * 1024) return `${(value / 1024).toFixed(0)} KB`;
  return `${(value / (1024 * 1024)).toFixed(1)} MB`;
}
