"use client";

import Link from "next/link";
import Image from "next/image";
import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import {
  AlertCircle,
  ArrowRight,
  CheckCircle2,
  ClipboardList,
  Clock,
  ExternalLink,
  Eye,
  FileCheck2,
  FilePlus2,
  FileText,
  ImagePlus,
  MessageSquare,
  Pencil,
  XCircle,
} from "lucide-react";
import { errorMessage, type Horse } from "@/api/horses/api";
import { HorseImage, Notice } from "@/components/horses/HorseUI";
import {
  getHorseRegistrationRequests,
  getOwnershipTransferRequests,
  respondToOwnershipTransfer,
  resubmitHorseRegistrationRequest,
  submitHorseRegistrationRequest,
  type OwnershipTransferRequest,
  type HorseRegistrationRequest,
  type HorseRegistrationSubmission,
} from "@/api/horse-owner/api";
import { Routes } from "@/routes/Routes";

const statusLabel: Record<HorseRegistrationRequest["status"], string> = {
  PENDING: "Chờ Club Manager duyệt",
  NEEDS_INFORMATION: "Cần bổ sung thông tin",
  AWAITING_OWNER_CONSENT: "Chờ chủ hiện tại xác nhận",
  APPROVED: "Đã duyệt",
  REJECTED: "Chưa được duyệt",
};

const documentLabels: Record<string, string> = {
  OWNERSHIP_PROOF: "Chứng minh sở hữu",
  HORSE_CERTIFICATE: "Chứng nhận ngựa",
  HEALTH_DOCUMENT: "Hồ sơ sức khỏe",
  OTHER: "Khác",
};

export default function HorseRegistrationPanel() {
  const [requests, setRequests] = useState<HorseRegistrationRequest[]>([]);
  const [transferRequests, setTransferRequests] = useState<OwnershipTransferRequest[]>([]);
  const [editingRequest, setEditingRequest] = useState<HorseRegistrationRequest | null>(null);
  const [transferNotes, setTransferNotes] = useState<Record<string, string>>({});
  const [transferBusy, setTransferBusy] = useState("");
  const [requestType, setRequestType] = useState<HorseRegistrationSubmission["requestType"]>("REGISTER");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [historyError, setHistoryError] = useState("");
  const [notice, setNotice] = useState("");
  const [horseImage, setHorseImage] = useState<File | null>(null);
  const [horseImagePreview, setHorseImagePreview] = useState<string | null>(null);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (!horseImage) {
      setHorseImagePreview(null);
      return;
    }
    const preview = URL.createObjectURL(horseImage);
    setHorseImagePreview(preview);
    return () => URL.revokeObjectURL(preview);
  }, [horseImage]);

  const load = useCallback(async () => {
    try {
      const [nextRequests, nextTransfers] = await Promise.all([
        getHorseRegistrationRequests(),
        getOwnershipTransferRequests(),
      ]);
      setRequests(nextRequests);
      setTransferRequests(nextTransfers);
      setHistoryError("");
    } catch (reason) {
      setHistoryError(errorMessage(reason));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const values = new FormData(form);
    const imageValue = values.get("horseImage");
    const image = imageValue instanceof File && imageValue.size > 0 ? imageValue : null;
    if (image && (image.size > 5 * 1024 * 1024 || !["image/jpeg", "image/png", "image/webp"].includes(image.type))) {
      setError("Ảnh ngựa phải là JPG, PNG hoặc WebP và không quá 5 MB.");
      return;
    }
    const documentFields = [
      ["ownershipDocuments", "OWNERSHIP_PROOF"],
      ["certificateDocuments", "HORSE_CERTIFICATE"],
      ["healthDocuments", "HEALTH_DOCUMENT"],
      ["otherDocuments", "OTHER"],
    ] as const;
    const files: File[] = [];
    const documentTypes: string[] = [];
    for (const [field, type] of documentFields) {
      const selected = values.getAll(field).filter((value): value is File => value instanceof File && value.size > 0);
      selected.forEach((file) => { files.push(file); documentTypes.push(type); });
    }
    if (!editingRequest && files.length === 0) {
      setError("Đính kèm ít nhất một giấy tờ hỗ trợ hồ sơ.");
      return;
    }
    if (files.length > 5) {
      setError("Mỗi lần gửi tối đa 5 giấy tờ xác minh.");
      return;
    }
    const oversizedDocument = files.find((file) => file.size > 10 * 1024 * 1024);
    if (oversizedDocument) {
      setError(`Tệp “${oversizedDocument.name}” vượt quá giới hạn 10 MB.`);
      return;
    }
    const numberValue = (key: string) => {
      const value = String(values.get(key) ?? "").trim();
      return value ? Number(value) : null;
    };
    const input: HorseRegistrationSubmission = {
      requestType,
      horseName: String(values.get("horseName") ?? "").trim(),
      breed: String(values.get("breed") ?? "").trim() || null,
      birthYear: numberValue("birthYear"),
      heightCm: numberValue("heightCm"),
      currentWeightKg: numberValue("currentWeightKg"),
      pedigreeFather: String(values.get("pedigreeFather") ?? "").trim() || null,
      pedigreeMother: String(values.get("pedigreeMother") ?? "").trim() || null,
      microchipNumber: String(values.get("microchipNumber") ?? "").trim() || null,
      passportNumber: String(values.get("passportNumber") ?? "").trim() || null,
      ownerNote: String(values.get("ownerNote") ?? "").trim() || null,
    };
    setSaving(true);
    setError("");
    setNotice("");
    try {
      const submittedRequest = editingRequest
        ? await resubmitHorseRegistrationRequest(editingRequest.id, input, image, files, documentTypes)
        : await submitHorseRegistrationRequest(input, image, files, documentTypes);
      setRequests((current) => [submittedRequest, ...current.filter((item) => item.id !== submittedRequest.id)]);
      form.reset();
      setHorseImage(null);
      setRequestType("REGISTER");
      setEditingRequest(null);
      setNotice(editingRequest ? "Đã gửi bổ sung hồ sơ cho Club Manager xem xét." : "Đã gửi hồ sơ ngựa cho Club Manager xác minh.");
    } catch (reason) {
      setError(errorMessage(reason));
    } finally {
      setSaving(false);
    }
  }

  function startCorrection(request: HorseRegistrationRequest) {
    setEditingRequest(request);
    setRequestType(request.request_type);
    setHorseImage(null);
    setError("");
    setNotice("");
    formRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function cancelCorrection() {
    setEditingRequest(null);
    setRequestType("REGISTER");
    setHorseImage(null);
    formRef.current?.reset();
  }

  async function answerTransfer(request: OwnershipTransferRequest, action: "CONSENT" | "DECLINE") {
    const prompt = action === "CONSENT"
      ? `Đồng ý chuyển quyền sở hữu ${request.horse_name} cho ${request.requester_name ?? "Horse Owner này"}?`
      : `Từ chối yêu cầu chuyển quyền sở hữu ${request.horse_name}?`;
    if (!window.confirm(prompt)) return;
    setTransferBusy(request.id);
    setError("");
    setNotice("");
    try {
      await respondToOwnershipTransfer(request.id, action, transferNotes[request.id]?.trim() || undefined);
      setNotice(action === "CONSENT" ? "Đã xác nhận chuyển quyền sở hữu." : "Đã từ chối yêu cầu chuyển quyền sở hữu.");
      window.dispatchEvent(new Event("horse-owner-horses-changed"));
      await load();
    } catch (reason) {
      setError(errorMessage(reason));
    } finally {
      setTransferBusy("");
    }
  }

  return (
    <section className="overflow-hidden rounded-lg border border-equine-line bg-white shadow-sm" aria-labelledby="horse-registration-title">
      <header className="border-b border-equine-line bg-slate-50 p-5 sm:p-6">
        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_310px] lg:items-center">
          <div className="py-2">
            <h2 id="horse-registration-title" className="font-sans text-2xl font-semibold tracking-tight text-equine-navy sm:text-3xl">Gửi yêu cầu hồ sơ ngựa</h2>
          </div>
          <div className="relative h-32 overflow-hidden rounded-lg sm:h-36">
            <Image src="/img/hero-racehorse.webp" alt="Ngựa đua trên đường tập" fill priority sizes="(max-width: 1024px) 100vw, 310px" className="object-cover object-center" />
          </div>
        </div>
      </header>

      <div className="p-4 sm:p-6">
        {error && <div className="mb-4"><Notice error>{error}</Notice></div>}
        {notice && <div className="mb-4"><Notice>{notice}</Notice></div>}
        {historyError && <div className="mb-4"><Notice error>
          {historyError.toLowerCase().includes("authentication required")
            ? <>Đăng nhập bằng Horse Owner để gửi hồ sơ. <Link href={Routes.login} className="font-semibold underline underline-offset-2">Đăng nhập</Link>.</>
            : historyError}
        </Notice></div>}

        {transferRequests.length > 0 && <section className="mb-5 rounded-lg border border-amber-200 bg-amber-50/70 p-4" aria-labelledby="ownership-consent-title">
          <h3 id="ownership-consent-title" className="font-semibold text-equine-navy">Yêu cầu chuyển quyền cần bạn xác nhận</h3>
          <div className="mt-3 space-y-3">
            {transferRequests.map((request) => <article key={request.id} className="rounded-lg border border-amber-200 bg-white p-4">
              <p className="font-semibold text-equine-navy">{request.horse_name}</p>
              <p className="mt-1 text-sm text-slate-600">Mã ngựa {request.horse_id.slice(0, 8)} · {request.requester_name ?? "Horse Owner"} đề nghị nhận quyền sở hữu. Club Manager đã xem xét hồ sơ.</p>
              {request.owner_note && <p className="mt-2 whitespace-pre-wrap text-sm text-slate-600">Ghi chú: {request.owner_note}</p>}
              <label className="mt-3 block"><span className="field-label">Ghi chú (không bắt buộc)</span>
                <textarea className="field-control min-h-20 px-3 py-2" maxLength={1000} value={transferNotes[request.id] ?? ""} onChange={(event) => setTransferNotes((current) => ({ ...current, [request.id]: event.target.value }))} />
              </label>
              <div className="mt-3 flex flex-wrap gap-2">
                <button type="button" className="gold-button" disabled={Boolean(transferBusy)} onClick={() => void answerTransfer(request, "CONSENT")}>{transferBusy === request.id ? "Đang lưu…" : "Đồng ý chuyển quyền"}</button>
                <button type="button" className="soft-button border-rose-200 bg-rose-50 text-rose-800" disabled={Boolean(transferBusy)} onClick={() => void answerTransfer(request, "DECLINE")}>Từ chối</button>
              </div>
            </article>)}
          </div>
        </section>}

        <form ref={formRef} key={editingRequest?.id ?? "new-registration"} onSubmit={(event) => void submit(event)}>
          <div className="space-y-4">
            {editingRequest && <Notice>Đang bổ sung yêu cầu {editingRequest.horse_name}. Gửi lại sẽ giữ lịch sử các lần nộp trước.</Notice>}
            <section className="space-y-4 pt-1">
              <div className="flex items-center gap-2.5 pb-2 border-b border-slate-100">
                <span className="grid h-8 w-8 place-items-center rounded-md bg-teal-50 text-equine-teal"><ClipboardList size={17} /></span>
                <h3 className="font-sans text-base font-semibold text-equine-navy">Thông tin ngựa</h3>
              </div>
              <label className="mb-4 block rounded-md border border-equine-line bg-slate-50 p-3">
                <span className="field-label">Loại yêu cầu</span>
                <select className="field-control mt-1 bg-white px-3" value={requestType} disabled={Boolean(editingRequest)} onChange={(event) => setRequestType(event.target.value as HorseRegistrationSubmission["requestType"])}>
                  <option value="REGISTER">Đăng ký ngựa mới</option>
                  <option value="LINK">Liên kết hồ sơ có sẵn</option>
                </select>
              </label>
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="block sm:col-span-2"><span className="field-label">Tên ngựa <span className="text-rose-600">*</span></span><input className="field-control px-3" name="horseName" maxLength={100} placeholder="Ví dụ: Golden Wind" defaultValue={editingRequest?.horse_name ?? ""} required /></label>
                <label className="block"><span className="field-label">Giống</span><input className="field-control px-3" name="breed" maxLength={50} placeholder="Thoroughbred, Arab…" defaultValue={editingRequest?.breed ?? ""} /></label>
                <label className="block"><span className="field-label">Năm sinh</span><input className="field-control px-3" name="birthYear" type="number" min="1900" max={new Date().getFullYear()} placeholder="2021" defaultValue={editingRequest?.birth_year ?? ""} /></label>
                <label className="block"><span className="field-label">Chiều cao (cm)</span><input className="field-control px-3" name="heightCm" type="number" min="50" max="250" step="0.1" placeholder="165" defaultValue={editingRequest?.height_cm ?? ""} /></label>
                <label className="block"><span className="field-label">Cân nặng (kg)</span><input className="field-control px-3" name="currentWeightKg" type="number" min="100" max="900" step="0.01" placeholder="480" defaultValue={editingRequest?.current_weight_kg ?? ""} /></label>
                <label className="block"><span className="field-label">Số microchip</span><input className="field-control px-3" name="microchipNumber" maxLength={100} placeholder="Nếu có" defaultValue={editingRequest?.microchip_number ?? ""} /></label>
                <label className="block"><span className="field-label">Số hộ chiếu ngựa</span><input className="field-control px-3" name="passportNumber" maxLength={100} placeholder="Nếu có" defaultValue={editingRequest?.passport_number ?? ""} /></label>
                <label className="block"><span className="field-label">Tên ngựa cha</span><input className="field-control px-3" name="pedigreeFather" maxLength={100} defaultValue={editingRequest?.pedigree_father ?? ""} /></label>
                <label className="block"><span className="field-label">Tên ngựa mẹ</span><input className="field-control px-3" name="pedigreeMother" maxLength={100} defaultValue={editingRequest?.pedigree_mother ?? ""} /></label>
              </div>
            </section>

            <section className="mt-6 border-t border-slate-100 pt-6 space-y-4">
              <div className="flex items-center gap-2.5 pb-2 border-b border-slate-100">
                <span className="grid h-8 w-8 place-items-center rounded-md bg-teal-50 text-equine-teal"><ImagePlus size={17} /></span>
                <h3 className="font-sans text-base font-semibold text-equine-navy">Ảnh & giấy tờ</h3>
              </div>
              {editingRequest && <p className="mb-3 text-xs text-slate-500">Giấy tờ các lần gửi trước được giữ trong lịch sử; mỗi lần bổ sung có thể tải lên tối đa 5 tệp mới.</p>}
              <div className="grid gap-3.5 sm:grid-cols-2">
                <div className="rounded-lg bg-slate-50/80 p-3.5">
                  <label className="block">
                    <span className="flex items-center gap-2 text-sm font-semibold text-equine-navy">
                      <ImagePlus size={16} className="text-equine-teal shrink-0" />
                      Ảnh ngựa (không bắt buộc)
                    </span>
                    <span className="mt-0.5 block text-xs text-slate-500">JPG, PNG hoặc WebP · tối đa 5 MB</span>
                    <input className="mt-2.5 block w-full cursor-pointer text-xs text-slate-600 file:mr-2.5 file:rounded-md file:border-0 file:bg-equine-navy file:px-3 file:py-1.5 file:text-xs file:font-semibold file:text-white hover:file:bg-[#1e3a5f]" type="file" name="horseImage" accept="image/jpeg,image/png,image/webp" onChange={(event) => setHorseImage(event.currentTarget.files?.[0] ?? null)} />
                  </label>
                  {horseImagePreview && <div className="mt-3 h-36 overflow-hidden rounded-md border border-equine-line bg-white"><HorseImage horse={{ id: "horse-registration-preview", horse_name: "Ảnh ngựa xem trước", image_url: horseImagePreview } as Horse} preview={horseImagePreview} /></div>}
                </div>

                <div className="rounded-lg bg-slate-50/80 p-3.5">
                  <label className="block">
                    <span className="flex items-center gap-2 text-sm font-semibold text-equine-navy">
                      <FileCheck2 size={16} className="text-equine-teal shrink-0" />
                      Giấy tờ chứng minh quyền sở hữu
                    </span>
                    <span className="mt-0.5 block text-xs text-slate-500">PDF hoặc ảnh · tối đa 5 tệp, 10 MB/tệp</span>
                    <input className="mt-2.5 block w-full cursor-pointer text-xs text-slate-600 file:mr-2.5 file:rounded-md file:border file:border-slate-300 file:bg-white file:px-3 file:py-1.5 file:text-xs file:font-medium file:text-slate-700 hover:file:bg-slate-50" type="file" name="ownershipDocuments" accept="application/pdf,image/jpeg,image/png,image/webp" multiple />
                  </label>
                </div>

                <div className="rounded-lg bg-slate-50/80 p-3.5">
                  <label className="block">
                    <span className="flex items-center gap-2 text-sm font-semibold text-equine-navy">
                      <FileCheck2 size={16} className="text-equine-teal shrink-0" />
                      Chứng nhận ngựa (nếu có)
                    </span>
                    <span className="mt-0.5 block text-xs text-slate-500">Giấy chứng nhận giống hoặc đăng ký</span>
                    <input className="mt-2.5 block w-full cursor-pointer text-xs text-slate-600 file:mr-2.5 file:rounded-md file:border file:border-slate-300 file:bg-white file:px-3 file:py-1.5 file:text-xs file:font-medium file:text-slate-700 hover:file:bg-slate-50" type="file" name="certificateDocuments" accept="application/pdf,image/jpeg,image/png,image/webp" multiple />
                  </label>
                </div>

                <div className="rounded-lg bg-slate-50/80 p-3.5">
                  <label className="block">
                    <span className="flex items-center gap-2 text-sm font-semibold text-equine-navy">
                      <FileCheck2 size={16} className="text-equine-teal shrink-0" />
                      Hồ sơ sức khỏe (nếu có)
                    </span>
                    <span className="mt-0.5 block text-xs text-slate-500">Tệp hồ sơ để Club Manager xem xét</span>
                    <input className="mt-2.5 block w-full cursor-pointer text-xs text-slate-600 file:mr-2.5 file:rounded-md file:border file:border-slate-300 file:bg-white file:px-3 file:py-1.5 file:text-xs file:font-medium file:text-slate-700 hover:file:bg-slate-50" type="file" name="healthDocuments" accept="application/pdf,image/jpeg,image/png,image/webp" multiple />
                  </label>
                </div>

                <div className="rounded-lg bg-slate-50/80 p-3.5 sm:col-span-2">
                  <label className="block">
                    <span className="flex items-center gap-2 text-sm font-semibold text-equine-navy">
                      <FileCheck2 size={16} className="text-equine-teal shrink-0" />
                      Tài liệu khác (nếu có)
                    </span>
                    <span className="mt-0.5 block text-xs text-slate-500">PDF hoặc ảnh · tối đa 5 tệp mỗi lần gửi</span>
                    <input className="mt-2.5 block w-full cursor-pointer text-xs text-slate-600 file:mr-2.5 file:rounded-md file:border file:border-slate-300 file:bg-white file:px-3 file:py-1.5 file:text-xs file:font-medium file:text-slate-700 hover:file:bg-slate-50" type="file" name="otherDocuments" accept="application/pdf,image/jpeg,image/png,image/webp" multiple />
                  </label>
                </div>
              </div>
              <label className="mt-4 block"><span className="field-label">Ghi chú thêm</span><textarea className="field-control min-h-24 px-3 py-2" name="ownerNote" maxLength={1000} placeholder="Thông tin bổ sung (nếu có)." defaultValue={editingRequest?.owner_note ?? ""} /></label>
            </section>

            <div className="flex flex-col items-end gap-2 border-t border-equine-line pt-4">
              {editingRequest && <button type="button" className="soft-button w-full justify-center sm:w-auto" disabled={saving} onClick={cancelCorrection}>Hủy bổ sung</button>}
              <button className="gold-button w-full justify-center px-5 py-3 sm:w-auto" disabled={saving}><FilePlus2 size={16} />{saving ? "Đang gửi…" : editingRequest ? "Gửi bổ sung" : "Gửi yêu cầu"}<ArrowRight size={16} /></button>
              {saving && <p className="text-right text-xs text-equine-muted" role="status" aria-live="polite">Đang tải tệp…</p>}
            </div>
          </div>

        </form>

        <section className="mt-5 border-t border-equine-line pt-5" aria-labelledby="horse-request-history-title">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-3"><span className="grid h-9 w-9 place-items-center rounded-xl bg-equine-paper text-equine-navy"><ClipboardList size={17} /></span><h3 id="horse-request-history-title" className="font-sans text-base font-semibold text-equine-navy">Yêu cầu của tôi</h3></div>
            <span className="rounded-full border border-equine-line bg-equine-paper px-3 py-1 text-xs font-semibold text-equine-muted">{requests.length} yêu cầu</span>
          </div>
          <div className="space-y-4">
            {requests.map((request) => (
              <article key={request.id} className="rounded-xl border border-slate-200 bg-white p-5 sm:p-6 shadow-sm transition hover:shadow-md">
                {/* Header */}
                <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-4">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2.5">
                      <h4 className="font-sans text-xl font-bold text-slate-900">{request.horse_name}</h4>
                      <span className="rounded-md bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-700">
                        {request.request_type === "LINK" ? "Liên kết hồ sơ" : "Đăng ký mới"}
                      </span>
                    </div>
                    <p className="mt-1 flex items-center gap-1.5 text-xs text-slate-500">
                      <Clock size={12} className="text-slate-400" />
                      Ngày gửi: {new Date(request.created_at).toLocaleDateString("vi-VN")} · {new Date(request.created_at).toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" })}
                    </p>
                  </div>

                  {/* Status Badge & Actions */}
                  <div className="flex flex-wrap items-center gap-2.5">
                    {request.status === "APPROVED" && (
                      <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-3.5 py-1.5 text-xs font-semibold text-emerald-700 border border-emerald-200">
                        <CheckCircle2 size={14} /> {statusLabel.APPROVED}
                      </span>
                    )}
                    {request.status === "NEEDS_INFORMATION" && (
                      <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-50 px-3.5 py-1.5 text-xs font-semibold text-amber-800 border border-amber-200">
                        <AlertCircle size={14} /> {statusLabel.NEEDS_INFORMATION}
                      </span>
                    )}
                    {request.status === "REJECTED" && (
                      <span className="inline-flex items-center gap-1.5 rounded-full bg-rose-50 px-3.5 py-1.5 text-xs font-semibold text-rose-700 border border-rose-200">
                        <XCircle size={14} /> {statusLabel.REJECTED}
                      </span>
                    )}
                    {request.status === "PENDING" && (
                      <span className="inline-flex items-center gap-1.5 rounded-full bg-sky-50 px-3.5 py-1.5 text-xs font-semibold text-sky-700 border border-sky-200">
                        <Clock size={14} /> {statusLabel.PENDING}
                      </span>
                    )}
                    {request.status === "AWAITING_OWNER_CONSENT" && (
                      <span className="inline-flex items-center gap-1.5 rounded-full bg-purple-50 px-3.5 py-1.5 text-xs font-semibold text-purple-700 border border-purple-200">
                        <Clock size={14} /> {statusLabel.AWAITING_OWNER_CONSENT}
                      </span>
                    )}

                    {request.status === "NEEDS_INFORMATION" && (
                      <button
                        type="button"
                        className="gold-button !min-h-[34px] !px-3.5 !text-xs shadow-xs"
                        onClick={() => startCorrection(request)}
                      >
                        <Pencil size={13} /> Sửa và gửi lại hồ sơ
                      </button>
                    )}
                    {request.status === "APPROVED" && request.approved_horse_id && (
                      <Link
                        href={Routes.horse(request.approved_horse_id)}
                        className="gold-button !min-h-[34px] !px-3.5 !text-xs shadow-xs"
                      >
                        <Eye size={13} /> Mở hồ sơ chiến mã
                      </Link>
                    )}
                  </div>
                </div>

                {/* Body Content */}
                <div className="mt-4 flex flex-col gap-4">
                  {/* Review Note from Manager */}
                  {request.review_note && (
                    <div className={`rounded-lg p-3.5 text-xs border ${
                      request.status === "NEEDS_INFORMATION"
                        ? "bg-amber-50/90 border-amber-200 text-amber-900"
                        : request.status === "REJECTED"
                        ? "bg-rose-50/90 border-rose-200 text-rose-900"
                        : "bg-slate-50 border-slate-200 text-slate-700"
                    }`}>
                      <div className="flex items-start gap-2.5">
                        {request.status === "NEEDS_INFORMATION" ? (
                          <AlertCircle size={16} className="mt-0.5 shrink-0 text-amber-600" />
                        ) : request.status === "REJECTED" ? (
                          <XCircle size={16} className="mt-0.5 shrink-0 text-rose-600" />
                        ) : (
                          <MessageSquare size={16} className="mt-0.5 shrink-0 text-slate-500" />
                        )}
                        <div className="min-w-0 flex-1">
                          <p className="font-bold text-[12px]">
                            {request.status === "NEEDS_INFORMATION"
                              ? "Yêu cầu bổ sung từ Club Manager:"
                              : request.status === "REJECTED"
                              ? "Lý do từ chối hồ sơ:"
                              : "Ghi chú từ Club Manager:"}
                          </p>
                          <p className="mt-1 leading-relaxed whitespace-pre-wrap font-medium">{request.review_note}</p>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Info Row: Image + Specs */}
                  <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
                    {request.horse_image_url && (
                      <div className="h-36 w-full overflow-hidden rounded-lg border border-slate-200 bg-slate-50 sm:w-44 shrink-0">
                        <HorseImage
                          horse={{ id: request.id, horse_name: request.horse_name, image_url: request.horse_image_url } as Horse}
                          preview={request.horse_image_url}
                        />
                      </div>
                    )}

                    {/* Specs Chips */}
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap gap-2 text-xs">
                        {request.breed && (
                          <span className="rounded-md bg-slate-50 px-2.5 py-1 text-slate-600 border border-slate-200">
                            Giống: <strong className="font-semibold text-slate-800">{request.breed}</strong>
                          </span>
                        )}
                        {request.birth_year && (
                          <span className="rounded-md bg-slate-50 px-2.5 py-1 text-slate-600 border border-slate-200">
                            Năm sinh: <strong className="font-semibold text-slate-800">{request.birth_year}</strong>
                          </span>
                        )}
                        {request.height_cm && (
                          <span className="rounded-md bg-slate-50 px-2.5 py-1 text-slate-600 border border-slate-200">
                            Chiều cao: <strong className="font-semibold text-slate-800">{request.height_cm} cm</strong>
                          </span>
                        )}
                        {request.current_weight_kg && (
                          <span className="rounded-md bg-slate-50 px-2.5 py-1 text-slate-600 border border-slate-200">
                            Cân nặng: <strong className="font-semibold text-slate-800">{request.current_weight_kg} kg</strong>
                          </span>
                        )}
                        {request.microchip_number && (
                          <span className="rounded-md bg-slate-50 px-2.5 py-1 text-slate-600 border border-slate-200">
                            Số chip: <strong className="font-semibold text-slate-800">{request.microchip_number}</strong>
                          </span>
                        )}
                        {request.passport_number && (
                          <span className="rounded-md bg-slate-50 px-2.5 py-1 text-slate-600 border border-slate-200">
                            Hộ chiếu: <strong className="font-semibold text-slate-800">{request.passport_number}</strong>
                          </span>
                        )}
                        {request.pedigree_father && (
                          <span className="rounded-md bg-slate-50 px-2.5 py-1 text-slate-600 border border-slate-200">
                            Cha: <strong className="font-semibold text-slate-800">{request.pedigree_father}</strong>
                          </span>
                        )}
                        {request.pedigree_mother && (
                          <span className="rounded-md bg-slate-50 px-2.5 py-1 text-slate-600 border border-slate-200">
                            Mẹ: <strong className="font-semibold text-slate-800">{request.pedigree_mother}</strong>
                          </span>
                        )}
                      </div>

                      {request.owner_note && (
                        <p className="mt-2.5 text-xs text-slate-500 bg-slate-50/70 p-2.5 rounded-lg border border-slate-200/60">
                          <span className="font-semibold text-slate-700">Ghi chú của bạn:</span> {request.owner_note}
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Attached Documents */}
                  {request.documents.length > 0 && (
                    <div className="space-y-2">
                      <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                        Tài liệu đính kèm ({request.documents.length})
                      </span>
                      <div className="grid gap-2.5 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4">
                        {request.documents.map((document) => (
                          <div key={document.id} className="flex items-center justify-between gap-2.5 rounded-lg border border-slate-200 bg-slate-50/70 p-2.5 text-xs hover:bg-slate-100/70 transition">
                            <div className="flex min-w-0 items-center gap-2.5">
                              <span className="grid size-7 shrink-0 place-items-center rounded bg-white text-teal-700 border border-slate-200 shadow-xs">
                                <FileText size={14} />
                              </span>
                              <div className="min-w-0">
                                <p className="truncate font-semibold text-slate-800" title={document.name}>{document.name}</p>
                                <p className="text-[11px] text-slate-500">
                                  {documentLabels[document.document_type] ?? "Tài liệu"} · Lần {document.revision_no}
                                </p>
                              </div>
                            </div>
                            <a
                              href={document.url}
                              target="_blank"
                              rel="noreferrer"
                              className="shrink-0 soft-button !min-h-[28px] !px-2.5 !text-[11px]"
                            >
                              Xem <ExternalLink size={11} />
                            </a>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Timeline History */}
                  {request.history?.length > 0 && (
                    <details className="group rounded-lg border border-slate-200/80 bg-slate-50/50 p-2.5 text-xs">
                      <summary className="flex cursor-pointer items-center justify-between font-medium text-slate-700 select-none">
                        <span className="flex items-center gap-1.5">
                          <Clock size={13} className="text-slate-400" />
                          Lịch sử xử lý ({request.history.length} bước)
                        </span>
                        <span className="text-[11px] text-slate-400 transition-transform group-open:rotate-180">▼</span>
                      </summary>
                      <ol className="relative ml-2 mt-3 space-y-2.5 border-l border-slate-200 pl-3">
                        {request.history.map((entry) => (
                          <li key={entry.id} className="relative">
                            <span className="absolute -left-[17px] top-1 size-2 rounded-full bg-teal-600 ring-2 ring-white" />
                            <p className="font-semibold text-slate-800">{historyActionLabel(entry.action)}</p>
                            <p className="text-[11px] text-slate-400">{new Date(entry.created_at).toLocaleString("vi-VN")}</p>
                            {entry.note && (
                              <p className="mt-1 rounded bg-white p-2 border border-slate-100 text-slate-600 leading-relaxed whitespace-pre-wrap">
                                {entry.note}
                              </p>
                            )}
                          </li>
                        ))}
                      </ol>
                    </details>
                  )}
                </div>
              </article>
            ))}
            {!loading && requests.length === 0 && <div className="rounded-lg bg-slate-50/80 px-4 py-8 text-center"><span className="mx-auto grid h-10 w-10 place-items-center rounded-full bg-white text-slate-400 shadow-xs"><FileCheck2 size={18} /></span><p className="mt-2 text-sm font-semibold text-slate-700">Chưa có yêu cầu nào</p><p className="mt-1 text-xs text-slate-400">Các yêu cầu đăng ký hồ sơ ngựa bạn gửi sẽ được theo dõi tại đây.</p></div>}
          </div>
        </section>
      </div>
    </section>
  );
}

function historyActionLabel(action: string) {
  switch (action) {
    case "SUBMITTED": return "Đã gửi hồ sơ";
    case "RESUBMITTED": return "Đã gửi bổ sung";
    case "NEEDS_INFORMATION": return "Club Manager yêu cầu bổ sung";
    case "REVIEW_APPROVED": return "Club Manager đã xác minh";
    case "REJECTED": return "Club Manager từ chối";
    case "OWNER_CONSENT": return "Đã đồng ý chuyển quyền";
    case "OWNER_DECLINED": return "Đã từ chối chuyển quyền";
    default: return action;
  }
}
