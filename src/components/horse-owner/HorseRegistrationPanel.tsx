"use client";

import Link from "next/link";
import Image from "next/image";
import { useCallback, useEffect, useState, type FormEvent } from "react";
import { ArrowRight, ClipboardList, ExternalLink, FileCheck2, FilePlus2, ImagePlus } from "lucide-react";
import { errorMessage, type Horse } from "@/api/horses/api";
import { HorseImage, Notice } from "@/components/horses/HorseUI";
import {
  getHorseRegistrationRequests,
  submitHorseRegistrationRequest,
  type HorseRegistrationRequest,
  type HorseRegistrationSubmission,
} from "@/api/horse-owner/api";
import { Routes } from "@/routes/Routes";

const statusLabel: Record<HorseRegistrationRequest["status"], string> = {
  PENDING: "Chờ Club Manager duyệt",
  APPROVED: "Đã duyệt",
  REJECTED: "Chưa được duyệt",
};

export default function HorseRegistrationPanel() {
  const [requests, setRequests] = useState<HorseRegistrationRequest[]>([]);
  const [requestType, setRequestType] = useState<HorseRegistrationSubmission["requestType"]>("REGISTER");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [historyError, setHistoryError] = useState("");
  const [notice, setNotice] = useState("");
  const [horseImage, setHorseImage] = useState<File | null>(null);
  const [horseImagePreview, setHorseImagePreview] = useState<string | null>(null);

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
      setRequests(await getHorseRegistrationRequests());
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
    const image = values.get("horseImage");
    const files = values.getAll("documents").filter((value): value is File => value instanceof File && value.size > 0);
    if (!(image instanceof File) || image.size === 0) {
      setError("Tải ảnh ngựa lên để gửi kèm hồ sơ.");
      return;
    }
    if (image.size > 5 * 1024 * 1024 || !["image/jpeg", "image/png", "image/webp"].includes(image.type)) {
      setError("Ảnh ngựa phải là JPG, PNG hoặc WebP và không quá 5 MB.");
      return;
    }
    if (files.length < 1 || files.length > 5) {
      setError("Đính kèm từ 1 đến 5 giấy tờ xác minh.");
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
      const submittedRequest = await submitHorseRegistrationRequest(input, image, files);
      setRequests((current) => [submittedRequest, ...current.filter((item) => item.id !== submittedRequest.id)]);
      form.reset();
      setHorseImage(null);
      setRequestType("REGISTER");
      setNotice("Đã gửi hồ sơ ngựa cho Club Manager xác minh.");
    } catch (reason) {
      setError(errorMessage(reason));
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="overflow-hidden rounded-[26px] border border-[#eadfd2] bg-white shadow-[0_20px_55px_-35px_rgba(73,48,30,0.4)]" aria-labelledby="horse-registration-title">
      <header className="border-b border-[#eee2d6] bg-gradient-to-br from-[#fff8ef] via-white to-[#fbf0e6] p-5 sm:p-6">
        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_310px] lg:items-center">
          <div className="py-2">
            <h2 id="horse-registration-title" className="font-sans text-2xl font-semibold tracking-tight text-equine-navy sm:text-3xl">Gửi yêu cầu</h2>
          </div>
          <div className="relative h-32 overflow-hidden rounded-2xl shadow-[0_14px_30px_-18px_rgba(32,26,20,0.6)] sm:h-36">
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

        <form onSubmit={(event) => void submit(event)}>
          <div className="space-y-4">
            <section className="rounded-2xl border border-equine-line bg-[#fffdfa] p-4 sm:p-5">
              <div className="mb-4 flex items-center gap-3">
                <span className="grid h-10 w-10 place-items-center rounded-xl bg-[#f8e7d8] text-[#a44e24]"><ClipboardList size={19} /></span>
                <h4 className="font-sans text-lg font-semibold text-equine-navy">Thông tin ngựa</h4>
              </div>
              <label className="mb-4 block rounded-xl border border-[#f0dfd1] bg-[#fff7f0] p-3">
                <span className="field-label">Loại yêu cầu</span>
                <select className="field-control mt-1 bg-white px-3" value={requestType} onChange={(event) => setRequestType(event.target.value as HorseRegistrationSubmission["requestType"])}>
                  <option value="REGISTER">Đăng ký ngựa mới</option>
                  <option value="LINK">Liên kết hồ sơ có sẵn</option>
                </select>
              </label>
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="block sm:col-span-2"><span className="field-label">Tên ngựa <span className="text-[#bf5d31]">*</span></span><input className="field-control px-3" name="horseName" maxLength={100} placeholder="Ví dụ: Golden Wind" required /></label>
                <label className="block"><span className="field-label">Giống</span><input className="field-control px-3" name="breed" maxLength={50} placeholder="Thoroughbred, Arab…" /></label>
                <label className="block"><span className="field-label">Năm sinh</span><input className="field-control px-3" name="birthYear" type="number" min="1900" max={new Date().getFullYear()} placeholder="2021" /></label>
                <label className="block"><span className="field-label">Chiều cao (cm)</span><input className="field-control px-3" name="heightCm" type="number" min="50" max="250" step="0.1" placeholder="165" /></label>
                <label className="block"><span className="field-label">Cân nặng (kg)</span><input className="field-control px-3" name="currentWeightKg" type="number" min="100" max="900" step="0.01" placeholder="480" /></label>
                <label className="block"><span className="field-label">Số microchip</span><input className="field-control px-3" name="microchipNumber" maxLength={100} placeholder="Nếu có" /></label>
                <label className="block"><span className="field-label">Số hộ chiếu ngựa</span><input className="field-control px-3" name="passportNumber" maxLength={100} placeholder="Nếu có" /></label>
                <label className="block"><span className="field-label">Tên ngựa cha</span><input className="field-control px-3" name="pedigreeFather" maxLength={100} /></label>
                <label className="block"><span className="field-label">Tên ngựa mẹ</span><input className="field-control px-3" name="pedigreeMother" maxLength={100} /></label>
              </div>
            </section>

            <section className="rounded-2xl border border-equine-line bg-white p-4 sm:p-5">
              <div className="mb-4 flex items-center gap-3">
                <span className="grid h-10 w-10 place-items-center rounded-xl bg-[#f8e7d8] text-[#a44e24]"><ImagePlus size={19} /></span>
                <h4 className="font-sans text-lg font-semibold text-equine-navy">Ảnh & giấy tờ</h4>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="block rounded-xl border border-dashed border-[#dfc8b5] bg-[#fffaf5] p-3 transition hover:border-[#bd754b]">
                  <span className="flex items-start gap-2"><ImagePlus size={17} className="mt-0.5 shrink-0 text-[#a45a34]" /><span><span className="block text-sm font-semibold text-equine-navy">Ảnh ngựa <span className="text-[#bf5d31]">*</span></span><span className="mt-1 block text-xs leading-5 text-slate-500">JPG, PNG hoặc WebP · tối đa 5 MB</span></span></span>
                  <input className="mt-3 block w-full cursor-pointer text-xs text-slate-600 file:mr-2 file:rounded-lg file:border-0 file:bg-equine-navy file:px-3 file:py-2 file:text-xs file:font-semibold file:text-white hover:file:bg-[#354954]" type="file" name="horseImage" accept="image/jpeg,image/png,image/webp" required onChange={(event) => setHorseImage(event.currentTarget.files?.[0] ?? null)} />
                  {horseImagePreview && <div className="mt-3 h-36 overflow-hidden rounded-lg border border-equine-line bg-equine-paper"><HorseImage horse={{ id: "horse-registration-preview", horse_name: "Ảnh ngựa xem trước", image_url: horseImagePreview } as Horse} preview={horseImagePreview} /></div>}
                </label>
                <label className="block rounded-xl border border-dashed border-[#dfc8b5] bg-[#fffaf5] p-3 transition hover:border-[#bd754b]">
                  <span className="flex items-start gap-2"><FileCheck2 size={17} className="mt-0.5 shrink-0 text-[#a45a34]" /><span><span className="block text-sm font-semibold text-equine-navy">Giấy tờ sở hữu <span className="text-[#bf5d31]">*</span></span><span className="mt-1 block text-xs leading-5 text-slate-500">PDF hoặc ảnh · tối đa 5 tệp, 10 MB mỗi tệp</span></span></span>
                  <input className="mt-3 block w-full cursor-pointer text-xs text-slate-600 file:mr-2 file:rounded-lg file:border-0 file:bg-white file:px-3 file:py-2 file:text-xs file:font-semibold file:text-equine-navy file:ring-1 file:ring-equine-line hover:file:bg-equine-paper" type="file" name="documents" accept="application/pdf,image/jpeg,image/png,image/webp" multiple required />
                </label>
              </div>
              <label className="mt-4 block"><span className="field-label">Ghi chú thêm</span><textarea className="field-control min-h-24 px-3 py-2" name="ownerNote" maxLength={1000} placeholder="Thông tin bổ sung (nếu có)." /></label>
            </section>

            <div className="flex flex-col items-end gap-2 border-t border-equine-line pt-4">
              <button className="gold-button w-full justify-center px-5 py-3 sm:w-auto" disabled={saving}><FilePlus2 size={16} />{saving ? "Đang gửi…" : "Gửi yêu cầu"}<ArrowRight size={16} /></button>
              {saving && <p className="text-right text-xs text-equine-muted" role="status" aria-live="polite">Đang tải ảnh và giấy tờ lên. Vui lòng đợi.</p>}
            </div>
          </div>

        </form>

        <section className="mt-5 border-t border-equine-line pt-5" aria-labelledby="horse-request-history-title">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-3"><span className="grid h-9 w-9 place-items-center rounded-xl bg-equine-paper text-equine-navy"><ClipboardList size={17} /></span><h4 id="horse-request-history-title" className="font-sans text-lg font-semibold text-equine-navy">Yêu cầu của tôi</h4></div>
            <span className="rounded-full border border-equine-line bg-equine-paper px-3 py-1 text-xs font-semibold text-equine-muted">{requests.length} yêu cầu</span>
          </div>
          <div className="grid gap-3 lg:grid-cols-2">
            {requests.map((request) => <article key={request.id} className="rounded-2xl border border-equine-line bg-white p-4 shadow-[0_8px_24px_-22px_rgba(44,36,28,0.45)]">
              <div className="flex items-start justify-between gap-3">
                <div><p className="font-semibold text-equine-navy">{request.horse_name}</p><p className="mt-1 text-xs text-slate-500">{request.request_type === "LINK" ? "Liên kết hồ sơ" : "Đăng ký mới"} · {new Date(request.created_at).toLocaleDateString("vi-VN")}</p></div>
                <span className={`shrink-0 rounded-full px-2.5 py-1 text-[11px] font-semibold ${request.status === "APPROVED" ? "bg-emerald-50 text-emerald-800" : request.status === "REJECTED" ? "bg-rose-50 text-rose-800" : "bg-amber-50 text-amber-900"}`}>{statusLabel[request.status]}</span>
              </div>
              {(request.microchip_number || request.passport_number) && <p className="mt-3 text-xs text-slate-500">{request.microchip_number ? `Chip ${request.microchip_number}` : ""}{request.microchip_number && request.passport_number ? " · " : ""}{request.passport_number ? `Hộ chiếu ${request.passport_number}` : ""}</p>}
              {request.review_note && <p className="mt-3 rounded-lg bg-equine-paper px-3 py-2 text-sm text-slate-600">{request.review_note}</p>}
              {request.horse_image_url && <div className="mt-3 h-36 w-full overflow-hidden rounded-xl border border-equine-line bg-equine-paper sm:w-56"><HorseImage horse={{ id: request.id, horse_name: request.horse_name, image_url: request.horse_image_url } as Horse} preview={request.horse_image_url} /></div>}
              <div className="mt-3 flex flex-wrap gap-3">
                {request.documents.map((document) => <a key={document.id} href={document.url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-xs font-medium text-equine-navy underline underline-offset-2"><ExternalLink size={13} />{document.name}</a>)}
                {request.status === "APPROVED" && request.approved_horse_id && <Link href={Routes.horse(request.approved_horse_id)} className="text-xs font-semibold text-[#a45a34] underline underline-offset-2">Mở hồ sơ ngựa</Link>}
              </div>
            </article>)}
            {!loading && requests.length === 0 && <div className="rounded-2xl border border-dashed border-equine-line bg-equine-paper/60 px-4 py-6 text-center lg:col-span-2"><span className="mx-auto grid h-10 w-10 place-items-center rounded-full bg-white text-equine-muted"><FileCheck2 size={18} /></span><p className="mt-2 text-sm font-semibold text-equine-navy">Chưa có yêu cầu nào</p></div>}
          </div>
        </section>
      </div>
    </section>
  );
}
