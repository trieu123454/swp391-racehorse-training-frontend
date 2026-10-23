"use client";
import { Routes } from "@/routes/Routes";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { ImagePlus, Plus, Upload, X } from "lucide-react";
import { Notice } from "@/components/horses/HorseUI";
import { OwnerCombobox } from "@/components/horses/OwnerCombobox";
import { errorMessage, getHorseStables, saveHorse, uploadHorseImage, type Stable } from "@/api/horses/api";

export default function NewHorsePage() {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [form, setForm] = useState<{
    horseName: string;
    breed: string;
    birthYear: number;
    heightCm: string;
    currentWeightKg: string;
    pedigreeFather: string;
    pedigreeMother: string;
    stableBoxId: string;
    ownerId: number | null;
  }>({
    horseName: "",
    breed: "",
    birthYear: 2024,
    heightCm: "",
    currentWeightKg: "",
    pedigreeFather: "",
    pedigreeMother: "",
    stableBoxId: "box-005",
    ownerId: null,
  });
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [imagePath, setImagePath] = useState<string | null>(null);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploading, setUploading] = useState(false);
  const [stables, setStables] = useState<Stable[]>([]);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    getHorseStables().then((nextStables) => {
      setStables(nextStables);
      if (nextStables[0]) setForm((current) => ({ ...current, stableBoxId: nextStables[0].id }));
    }).catch((reason) => setError(errorMessage(reason)));
  }, []);

  function onFileChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
      setError("File không đúng định dạng ảnh. Chỉ chấp nhận .jpg, .png, .webp");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setError("Ảnh không được vượt quá 5MB.");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => setImagePreview(String(reader.result));
    reader.readAsDataURL(file);
    setUploadProgress(0);
    setError("");
    setUploading(true);
    const controller = new AbortController();
    void uploadHorseImage(file, setUploadProgress, controller.signal)
      .then((path) => setImagePath(path))
      .catch((reason) => setError(errorMessage(reason)))
      .finally(() => setUploading(false));
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!form.horseName.trim()) {
      setError("Tên ngựa không được để trống.");
      return;
    }
    if (!form.ownerId) {
      setError("Mỗi hồ sơ ngựa cần một chủ sở hữu chính.");
      return;
    }

    setSaving(true);
    setError("");

    try {
      await saveHorse({
        horseName: form.horseName,
        breed: form.breed || null,
        birthYear: form.birthYear || null,
        heightCm: form.heightCm ? Number(form.heightCm) : null,
        currentWeightKg: form.currentWeightKg ? Number(form.currentWeightKg) : null,
        pedigreeFather: form.pedigreeFather || null,
        pedigreeMother: form.pedigreeMother || null,
        stableBoxId: form.stableBoxId,
        ownerId: form.ownerId || null,
        imagePath,
        confirmOwnerChange: false,
      });
      router.push(Routes.horses);
    } catch (reason) {
      setError(errorMessage(reason));
    } finally {
      setSaving(false);
    }
  }

  return (
    <main className="min-h-screen bg-slate-50 p-4 sm:p-6 lg:p-8">
      <div className="mx-auto max-w-[900px] rounded-xl border border-slate-200 bg-white p-5 shadow-sm sm:p-7">
        <div className="mb-6 flex items-center justify-between gap-3 border-b border-slate-100 pb-4">
          <div>
            <p className="eyebrow">Tạo mới</p>
            <h1 className="mt-1 font-sans text-2xl font-bold tracking-tight text-slate-900">
              Đăng ký hồ sơ ngựa mới
            </h1>
          </div>
          <button type="button" className="soft-button" onClick={() => router.push(Routes.horses)}>
            <X size={15} /> Hủy
          </button>
        </div>

        {error && <div className="mb-5"><Notice error>{error}</Notice></div>}

        <form className="space-y-5" onSubmit={handleSubmit}>
          <div className="grid gap-5 md:grid-cols-[1.1fr_0.9fr]">
            <div className="space-y-4">
              <label className="block">
                <span className="field-label">Tên ngựa</span>
                <input
                  value={form.horseName}
                  onChange={(event) => setForm({ ...form, horseName: event.target.value })}
                  className="field-control w-full"
                  placeholder="Ví dụ: Aurora Peak"
                  required
                />
              </label>

              <label className="block">
                <span className="field-label">Giống ngựa</span>
                <input
                  value={form.breed}
                  onChange={(event) => setForm({ ...form, breed: event.target.value })}
                  className="field-control w-full"
                  placeholder="Ví dụ: Thoroughbred"
                />
              </label>

              <label className="block">
                <span className="field-label">Năm sinh</span>
                <input
                  type="number"
                  min={2000}
                  max={2035}
                  value={form.birthYear}
                  onChange={(event) => setForm({ ...form, birthYear: Number(event.target.value) || 0 })}
                  className="field-control w-full"
                />
              </label>

              <div className="grid gap-3 sm:grid-cols-2">
                <label className="block">
                  <span className="field-label">Chiều cao vai (cm)</span>
                  <input type="number" min={50} max={250} step="0.1" value={form.heightCm} onChange={(event) => setForm({ ...form, heightCm: event.target.value })} className="field-control w-full" placeholder="Ví dụ: 162.5" />
                </label>

                <label className="block">
                  <span className="field-label">Cân nặng (kg)</span>
                  <input type="number" min={100} max={900} step="0.01" value={form.currentWeightKg} onChange={(event) => setForm({ ...form, currentWeightKg: event.target.value })} className="field-control w-full" placeholder="Ví dụ: 452" />
                </label>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <label className="block">
                  <span className="field-label">Tên cha (Sire)</span>
                  <input
                    value={form.pedigreeFather}
                    onChange={(event) => setForm({ ...form, pedigreeFather: event.target.value })}
                    className="field-control w-full"
                    placeholder="Sire"
                  />
                </label>

                <label className="block">
                  <span className="field-label">Tên mẹ (Dam)</span>
                  <input
                    value={form.pedigreeMother}
                    onChange={(event) => setForm({ ...form, pedigreeMother: event.target.value })}
                    className="field-control w-full"
                    placeholder="Dam"
                  />
                </label>
              </div>
            </div>

            <div className="space-y-4">
              <label className="block">
                <span className="field-label">Hộp chuồng trại</span>
                <select
                  value={form.stableBoxId}
                  onChange={(event) => setForm({ ...form, stableBoxId: event.target.value })}
                  className="field-control w-full cursor-pointer"
                >
                  {stables.map((stable) => (
                    <option key={stable.id} value={stable.id}>
                      {stable.box_code} - {stable.section}
                    </option>
                  ))}
                </select>
              </label>

              <OwnerCombobox required value={form.ownerId} onChange={(ownerId) => setForm({ ...form, ownerId })} />

              <div className="rounded-lg border border-slate-200 bg-slate-50/70 p-4">
                <span className="field-label">Ảnh đại diện ngựa</span>
                {imagePreview && (
                  <div className="mb-3 overflow-hidden rounded-lg border border-slate-200">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={imagePreview} alt="Preview" className="h-44 w-full object-cover" />
                  </div>
                )}
                <label className="flex cursor-pointer items-center justify-center gap-2 rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-800 hover:bg-slate-50">
                  {imagePreview ? <ImagePlus size={15} /> : <Upload size={15} />}
                  <span>{imagePreview ? "Đổi ảnh khác" : "Tải ảnh hồ sơ"}</span>
                  <input
                    ref={inputRef}
                    type="file"
                    accept="image/png,image/jpeg,image/webp"
                    className="hidden"
                    onChange={onFileChange}
                  />
                </label>
                {imagePreview && (
                  <progress className="mt-2.5 h-1.5 w-full accent-teal-700" max="100" value={uploadProgress} />
                )}
              </div>
            </div>
          </div>

          <div className="flex justify-end gap-2.5 border-t border-slate-100 pt-4">
            <button type="button" className="soft-button" onClick={() => router.push(Routes.horses)}>
              Hủy
            </button>
            <button type="submit" disabled={saving || uploading} className="gold-button">
              <Plus size={15} /> {saving ? "Đang tạo..." : "Tạo hồ sơ ngựa"}
            </button>
          </div>
        </form>
      </div>
    </main>
  );
}
