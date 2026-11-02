"use client";
import { Routes } from "@/routes/Routes";
/* eslint-disable @next/next/no-img-element */

import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { ImagePlus, Save, Upload, X } from "lucide-react";
import { useHorseUser } from "@/components/horses/HorseShell";
import { Notice } from "@/components/horses/HorseUI";
import { errorMessage, getHorse, getHorseStables, saveHorse, uploadHorseImage, type Stable } from "@/api/horses/api";

export default function EditHorsePage() {
  const router = useRouter();
  const user = useHorseUser();
  const params = useParams<{ id: string }>();
  const horseId = params?.id ?? "";
  const [horse, setHorse] = useState<Awaited<ReturnType<typeof getHorse>> | null>(null);
  const [form, setForm] = useState<{ horseName: string; breed: string; birthYear: number; heightCm: string; currentWeightKg: string; pedigreeFather: string; pedigreeMother: string; microchipNumber: string; passportNumber: string; stableBoxId: string }>({ horseName: "", breed: "", birthYear: 2024, heightCm: "", currentWeightKg: "", pedigreeFather: "", pedigreeMother: "", microchipNumber: "", passportNumber: "", stableBoxId: "" });
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [imagePath, setImagePath] = useState<string | null>(null);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploading, setUploading] = useState(false);
  const [stables, setStables] = useState<Stable[]>([]);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    Promise.all([getHorse(horseId), getHorseStables()]).then(([currentHorse, nextStables]) => {
      setHorse(currentHorse);
      setStables(nextStables);
      setForm({ horseName: currentHorse.horse_name, breed: currentHorse.breed ?? "", birthYear: currentHorse.birth_year ?? 2024, heightCm: currentHorse.height_cm == null ? "" : String(currentHorse.height_cm), currentWeightKg: currentHorse.current_weight_kg == null ? "" : String(currentHorse.current_weight_kg), pedigreeFather: currentHorse.pedigree_father ?? "", pedigreeMother: currentHorse.pedigree_mother ?? "", microchipNumber: currentHorse.microchip_number ?? "", passportNumber: currentHorse.passport_number ?? "", stableBoxId: currentHorse.stable_box_id });
      setImagePath(currentHorse.image_url);
    }).catch((reason) => setError(errorMessage(reason)));
  }, [horseId]);

  if (!horse && !error) {
    return (
      <main className="min-h-screen bg-slate-50 p-6">
        <div className="mx-auto max-w-[800px] rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
          <Notice>Đang tải hồ sơ ngựa...</Notice>
        </div>
      </main>
    );
  }

  if (!horse) {
    return (
      <main className="min-h-screen bg-slate-50 p-6">
        <div className="mx-auto max-w-[800px] rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
          <Notice error>{error}</Notice>
          <div className="mt-4">
            <button type="button" className="gold-button" onClick={() => router.push(Routes.horses)}>
              Quay lại danh sách
            </button>
          </div>
        </div>
      </main>
    );
  }

  if (user && user.roleName !== "CLUB_MANAGER" && user.roleName !== "HEAD_TRAINER") {
    return (
      <main className="min-h-screen bg-slate-50 p-6">
        <div className="mx-auto max-w-[800px] rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
          <Notice error>Chỉ Club Manager hoặc HLV Trưởng mới có quyền chỉnh sửa hồ sơ ngựa.</Notice>
          <div className="mt-4">
            <button type="button" className="gold-button" onClick={() => router.push(Routes.horse(horseId))}>
              Quay lại chi tiết
            </button>
          </div>
        </div>
      </main>
    );
  }

  const safeHorse = horse;

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!form.horseName.trim()) {
      setError("Tên ngựa không được để trống.");
      return;
    }
    setSaving(true);
    setError("");

    void saveHorse({ horseName: form.horseName, breed: form.breed || null, birthYear: form.birthYear || null, heightCm: form.heightCm ? Number(form.heightCm) : null, currentWeightKg: form.currentWeightKg ? Number(form.currentWeightKg) : null, pedigreeFather: form.pedigreeFather || null, pedigreeMother: form.pedigreeMother || null, microchipNumber: form.microchipNumber || null, passportNumber: form.passportNumber || null, stableBoxId: form.stableBoxId, ownerId: safeHorse.owner_id, imagePath, confirmOwnerChange: false }, safeHorse.id).then(() => {
      setSaving(false);
      router.push(Routes.horse(safeHorse.id));
    }).catch((reason) => { setSaving(false); setError(errorMessage(reason)); });
  }

  function onFileChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type) || file.size > 5 * 1024 * 1024) { setError("Ảnh phải là .jpg, .png hoặc .webp và không vượt quá 5MB."); return; }
    const reader = new FileReader();
    reader.onload = () => setImagePreview(String(reader.result));
    reader.readAsDataURL(file);
    setUploading(true);
    void uploadHorseImage(file, setUploadProgress, new AbortController().signal).then(setImagePath).catch((reason) => setError(errorMessage(reason))).finally(() => setUploading(false));
  }

  return (
    <main className="min-h-screen bg-slate-50 p-4 sm:p-6 lg:p-8">
      <div className="mx-auto max-w-[900px] rounded-xl border border-slate-200 bg-white p-5 shadow-sm sm:p-7">
        <div className="mb-6 flex items-center justify-between gap-3 border-b border-slate-100 pb-4">
          <div>
            <p className="eyebrow">Cập nhật thông tin</p>
            <h1 className="mt-1 font-sans text-2xl font-bold tracking-tight text-slate-900">
              Cập nhật hồ sơ ngựa: {safeHorse.horse_name}
            </h1>
          </div>
          <button type="button" className="soft-button" onClick={() => router.push(Routes.horse(safeHorse.id))}>
            <X size={15} /> Hủy
          </button>
        </div>

        {error && <div className="mb-5"><Notice error>{error}</Notice></div>}

        <form className="space-y-5" onSubmit={handleSubmit}>
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block">
              <span className="field-label">Tên ngựa</span>
              <input value={form.horseName} onChange={(event) => setForm({ ...form, horseName: event.target.value })} className="field-control w-full" />
            </label>

            <label className="block">
              <span className="field-label">Giống ngựa</span>
              <input value={form.breed} onChange={(event) => setForm({ ...form, breed: event.target.value })} className="field-control w-full" />
            </label>

            <label className="block">
              <span className="field-label">Năm sinh</span>
              <input type="number" value={form.birthYear} onChange={(event) => setForm({ ...form, birthYear: Number(event.target.value) || 0 })} className="field-control w-full" />
            </label>

            <label className="block">
              <span className="field-label">Chiều cao đến vai (cm)</span>
              <input type="number" min={50} max={250} step="0.1" value={form.heightCm} onChange={(event) => setForm({ ...form, heightCm: event.target.value })} className="field-control w-full" placeholder="Ví dụ: 162.5" />
            </label>

            <label className="block">
              <span className="field-label">Cân nặng hiện tại (kg)</span>
              <input type="number" min={100} max={900} step="0.01" value={form.currentWeightKg} onChange={(event) => setForm({ ...form, currentWeightKg: event.target.value })} className="field-control w-full" placeholder="Ví dụ: 452" />
            </label>

            <label className="block">
              <span className="field-label">Hộp chuồng</span>
              <select value={form.stableBoxId} onChange={(event) => setForm({ ...form, stableBoxId: event.target.value })} className="field-control w-full cursor-pointer">
                {stables.map((stable) => (
                  <option key={stable.id} value={stable.id}>{stable.box_code} - {stable.section}</option>
                ))}
              </select>
            </label>

            <label className="block">
              <span className="field-label">Tên cha (Sire)</span>
              <input value={form.pedigreeFather} onChange={(event) => setForm({ ...form, pedigreeFather: event.target.value })} className="field-control w-full" />
            </label>

            <label className="block">
              <span className="field-label">Tên mẹ (Dam)</span>
              <input value={form.pedigreeMother} onChange={(event) => setForm({ ...form, pedigreeMother: event.target.value })} className="field-control w-full" />
            </label>
            <label className="block">
              <span className="field-label">Số microchip (nếu có)</span>
              <input maxLength={100} value={form.microchipNumber} onChange={(event) => setForm({ ...form, microchipNumber: event.target.value })} className="field-control w-full" />
            </label>
            <label className="block">
              <span className="field-label">Số hộ chiếu (nếu có)</span>
              <input maxLength={100} value={form.passportNumber} onChange={(event) => setForm({ ...form, passportNumber: event.target.value })} className="field-control w-full" />
            </label>
          </div>

          <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm text-slate-600">
            Chủ sở hữu: <strong className="text-slate-900">{safeHorse.owner_name ?? "Chưa liên kết"}</strong>
            <p className="mt-1 text-xs">Thay đổi chủ sở hữu cần yêu cầu liên kết và sự đồng ý của chủ hiện tại.</p>
          </div>

          <div className="rounded-lg border border-slate-200 bg-slate-50/70 p-4">
            <span className="field-label">Ảnh đại diện ngựa</span>
            {imagePreview && (
              <div className="mb-3 overflow-hidden rounded-lg border border-slate-200">
                <span className="sr-only">Ảnh xem trước</span>
                <img src={imagePreview} alt="Preview" className="h-44 w-full object-cover" />
              </div>
            )}
            <label className="flex cursor-pointer items-center justify-center gap-2 rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-800 hover:bg-slate-50">
              {imagePreview ? <ImagePlus size={15} /> : <Upload size={15} />} Chọn ảnh mới
              <input type="file" accept="image/png,image/jpeg,image/webp" className="hidden" onChange={onFileChange} />
            </label>
            {imagePreview && <progress className="mt-2.5 h-1.5 w-full accent-teal-700" max="100" value={uploadProgress} />}
          </div>

          <div className="flex justify-end gap-2.5 border-t border-slate-100 pt-4">
            <button type="button" className="soft-button" onClick={() => router.push(Routes.horse(safeHorse.id))}>
              Quay lại
            </button>
            <button type="submit" disabled={saving || uploading} className="gold-button">
              <Save size={15} /> {saving ? "Đang lưu..." : "Lưu thay đổi"}
            </button>
          </div>
        </form>
      </div>
    </main>
  );
}
