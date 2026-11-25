"use client";
import { Routes } from "@/routes/Routes";
/* eslint-disable @next/next/no-img-element */

import { useParams, useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { ImagePlus, Save, Upload, X } from "lucide-react";
import { useHorseUser } from "@/components/horses/HorseShell";
import { Notice } from "@/components/horses/HorseUI";
import { FormSkeleton } from "@/components/shared/LoadingSkeletons";
import { errorMessage, getHorse, getHorseStables, peekCachedHorse, peekCachedStables, saveHorse, uploadHorseImage, type Horse, type Stable } from "@/api/horses/api";

function formFromHorse(currentHorse: Horse, nextStables: Stable[]) {
  return {
    horseName: currentHorse.horse_name,
    breed: currentHorse.breed ?? "",
    gender: currentHorse.gender ?? "",
    birthYear: currentHorse.birth_year == null ? "" : String(currentHorse.birth_year),
    heightCm: currentHorse.height_cm == null ? "" : String(currentHorse.height_cm),
    currentWeightKg: currentHorse.current_weight_kg == null ? "" : String(currentHorse.current_weight_kg),
    pedigreeFather: currentHorse.pedigree_father ?? "",
    pedigreeMother: currentHorse.pedigree_mother ?? "",
    microchipNumber: currentHorse.microchip_number ?? "",
    passportNumber: currentHorse.passport_number ?? "",
    stableBoxId: currentHorse.stable_box_id ?? nextStables[0]?.id ?? "",
  };
}

export default function EditHorsePage() {
  const router = useRouter();
  const user = useHorseUser();
  const params = useParams<{ id: string }>();
  const horseId = params?.id ?? "";
  const initialHorse = peekCachedHorse(horseId);
  const initialStables = peekCachedStables() ?? [];
  const hydratedFromCacheRef = useRef(Boolean(initialHorse));
  const [horse, setHorse] = useState<Horse | null>(initialHorse);
  const [form, setForm] = useState(() => initialHorse ? formFromHorse(initialHorse, initialStables) : { horseName: "", breed: "", gender: "", birthYear: "", heightCm: "", currentWeightKg: "", pedigreeFather: "", pedigreeMother: "", microchipNumber: "", passportNumber: "", stableBoxId: "" });
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [imagePath, setImagePath] = useState<string | null>(initialHorse?.image_url ?? null);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploading, setUploading] = useState(false);
  const [stables, setStables] = useState<Stable[]>(initialStables);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const isManager = !user || user.roleName === "CLUB_MANAGER";

  useEffect(() => {
    if (!isManager) return;
    let active = true;
    const cachedHorse = peekCachedHorse(horseId);
    const cachedStables = peekCachedStables() ?? [];
    if (cachedHorse) {
      setHorse(cachedHorse);
      setStables(cachedStables);
      setForm(formFromHorse(cachedHorse, cachedStables));
      setImagePath(cachedHorse.image_url);
      hydratedFromCacheRef.current = true;
    }
    Promise.all([getHorse(horseId), getHorseStables()]).then(([currentHorse, nextStables]) => {
      if (!active) return;
      setHorse(currentHorse);
      setStables(nextStables);
      if (!hydratedFromCacheRef.current) {
        setForm(formFromHorse(currentHorse, nextStables));
        setImagePath(currentHorse.image_url);
      }
    }).catch((reason) => {
      if (active && !cachedHorse) setError(errorMessage(reason));
    });
    return () => { active = false; };
  }, [horseId, isManager]);

  if (user && user.roleName !== "CLUB_MANAGER") {
    return (
      <main className="min-h-screen bg-slate-50 p-6">
        <div className="mx-auto max-w-[800px] rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
          <Notice error>Chỉ Club Manager mới có quyền chỉnh sửa hồ sơ ngựa.</Notice>
          <div className="mt-4">
            <button type="button" className="gold-button" onClick={() => router.push(Routes.horse(horseId))}>
              Quay lại chi tiết
            </button>
          </div>
        </div>
      </main>
    );
  }

  if (!horse && !error) {
    return <FormSkeleton />;
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

  const safeHorse = horse;
  const stableOptions: (Stable & { isCurrentUnavailable?: boolean })[] =
    safeHorse.stable_box_id && !stables.some((item) => item.id === safeHorse.stable_box_id)
      ? [
          {
            id: safeHorse.stable_box_id,
            box_code: safeHorse.box_code ?? safeHorse.stable_box_id,
            section: safeHorse.section ?? "Chuồng hiện tại",
            capacity: 0,
            occupied: 0,
            isCurrentUnavailable: true,
          },
          ...stables,
        ]
      : stables;

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmedName = form.horseName.trim();
    if (trimmedName.length < 2) {
      setError("Tên ngựa phải có ít nhất 2 ký tự.");
      return;
    }
    const currentYear = new Date().getFullYear();
    const parsedBirthYear = form.birthYear.trim() ? Number(form.birthYear.trim()) : null;
    if (parsedBirthYear !== null && (!Number.isInteger(parsedBirthYear) || parsedBirthYear < 1900 || parsedBirthYear > currentYear)) {
      setError(`Năm sinh phải là số nguyên từ 1900 đến ${currentYear}.`);
      return;
    }
    if (!form.stableBoxId) {
      setError("Vui lòng chọn chuồng trại cho ngựa.");
      return;
    }
    setSaving(true);
    setError("");

    void saveHorse({
      horseName: trimmedName,
      breed: form.breed.trim() || null,
      gender: form.gender.trim() || null,
      birthYear: parsedBirthYear,
      heightCm: form.heightCm.trim() ? Number(form.heightCm.trim()) : null,
      currentWeightKg: form.currentWeightKg.trim() ? Number(form.currentWeightKg.trim()) : null,
      pedigreeFather: form.pedigreeFather.trim() || null,
      pedigreeMother: form.pedigreeMother.trim() || null,
      microchipNumber: form.microchipNumber.trim() || null,
      passportNumber: form.passportNumber.trim() || null,
      stableBoxId: form.stableBoxId,
      ownerId: safeHorse.owner_id,
      imagePath,
      confirmOwnerChange: false,
    }, safeHorse.id).then(() => {
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
              <input maxLength={100} value={form.horseName} onChange={(event) => setForm({ ...form, horseName: event.target.value })} className="field-control w-full" />
            </label>

            <label className="block">
              <span className="field-label">Giống ngựa</span>
              <input maxLength={50} value={form.breed} onChange={(event) => setForm({ ...form, breed: event.target.value })} className="field-control w-full" />
            </label>

            <label className="block">
              <span className="field-label">Giới tính</span>
              <select value={form.gender} onChange={(event) => setForm({ ...form, gender: event.target.value })} className="field-control w-full cursor-pointer">
                <option value="">Chưa cập nhật</option>
                <option value="Male">Đực</option>
                <option value="Female">Cái</option>
                <option value="Gelding">Đực thiến</option>
              </select>
            </label>

            <label className="block">
              <span className="field-label">Năm sinh</span>
              <input type="number" min={1900} max={new Date().getFullYear()} placeholder="Ví dụ: 2021" value={form.birthYear} onChange={(event) => setForm({ ...form, birthYear: event.target.value })} className="field-control w-full" />
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
                {stableOptions.map((stable) => (
                  <option key={stable.id} value={stable.id}>
                    {stable.box_code} - {stable.section}{stable.isCurrentUnavailable ? " (Chuồng hiện tại)" : ` (${stable.occupied}/${stable.capacity})`}
                  </option>
                ))}
              </select>
            </label>

            <label className="block">
              <span className="field-label">Tên cha (Sire)</span>
              <input maxLength={100} value={form.pedigreeFather} onChange={(event) => setForm({ ...form, pedigreeFather: event.target.value })} className="field-control w-full" />
            </label>

            <label className="block">
              <span className="field-label">Tên mẹ (Dam)</span>
              <input maxLength={100} value={form.pedigreeMother} onChange={(event) => setForm({ ...form, pedigreeMother: event.target.value })} className="field-control w-full" />
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
