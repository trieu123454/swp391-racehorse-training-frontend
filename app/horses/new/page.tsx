"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { ImagePlus, Save, Upload, X } from "lucide-react";
import { Notice } from "@/components/HorseUI";
import { errorMessage, getHorseOwners, getHorseStables, saveHorse, uploadHorseImage, type Owner, type Stable } from "@/lib/horses";

export default function NewHorsePage() {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [form, setForm] = useState({
    horseName: "",
    breed: "",
    birthYear: 2024,
    pedigreeFather: "",
    pedigreeMother: "",
    stableBoxId: "box-005",
    ownerId: 101,
  });
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [imagePath, setImagePath] = useState<string | null>(null);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploading, setUploading] = useState(false);
  const [stables, setStables] = useState<Stable[]>([]);
  const [owners, setOwners] = useState<Owner[]>([]);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    Promise.all([getHorseStables(), getHorseOwners()]).then(([nextStables, nextOwners]) => {
      setStables(nextStables);
      setOwners(nextOwners);
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

    setSaving(true);
    setError("");

    try {
      await saveHorse({
        horseName: form.horseName,
        breed: form.breed || null,
        birthYear: form.birthYear || null,
        pedigreeFather: form.pedigreeFather || null,
        pedigreeMother: form.pedigreeMother || null,
        stableBoxId: form.stableBoxId,
        ownerId: form.ownerId || null,
        imagePath,
        confirmOwnerChange: false,
      });
      router.push("/horses");
    } catch (reason) {
      setError(errorMessage(reason));
    } finally {
      setSaving(false);
    }
  }

  return (
    <main className="min-h-screen bg-equine-paper p-4 sm:p-6 lg:p-8">
      <div className="mx-auto max-w-[900px] rounded-3xl border border-equine-line bg-white p-4 shadow-sm sm:p-6">
        <div className="mb-6 flex items-center justify-between gap-3">
          <div>
            <p className="eyebrow">UC-01</p>
            <h1 className="mt-2 font-sans text-3xl font-semibold text-equine-navy">
              Tạo mới hồ sơ ngựa
            </h1>
          </div>
          <button type="button" className="soft-button border-equine-line bg-[#f7f9ff] text-slate-700" onClick={() => router.push("/horses")}>
            <X size={16} /> Hủy
          </button>
        </div>

        {error && <Notice error>{error}</Notice>}

        <form className="space-y-6" onSubmit={handleSubmit}>
          <div className="grid gap-5 md:grid-cols-[1.1fr_0.9fr]">
            <div className="space-y-5">
              <label className="block">
                <span className="field-label">Tên ngựa</span>
                <input
                  value={form.horseName}
                  onChange={(event) => setForm({ ...form, horseName: event.target.value })}
                  className="field-control"
                  placeholder="Ví dụ: Aurora Peak"
                />
              </label>

              <label className="block">
                <span className="field-label">Giống</span>
                <input
                  value={form.breed}
                  onChange={(event) => setForm({ ...form, breed: event.target.value })}
                  className="field-control"
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
                  className="field-control"
                />
              </label>

              <div className="grid gap-5 md:grid-cols-2">
                <label className="block">
                  <span className="field-label">Tên cha</span>
                  <input
                    value={form.pedigreeFather}
                    onChange={(event) => setForm({ ...form, pedigreeFather: event.target.value })}
                    className="field-control"
                    placeholder="Sire"
                  />
                </label>
                <label className="block">
                  <span className="field-label">Tên mẹ</span>
                  <input
                    value={form.pedigreeMother}
                    onChange={(event) => setForm({ ...form, pedigreeMother: event.target.value })}
                    className="field-control"
                    placeholder="Dam"
                  />
                </label>
              </div>
            </div>

            <div className="space-y-5">
              <div className="rounded-2xl border border-dashed border-equine-line bg-[#f7f9ff] p-4">
                <div className="mb-3 flex items-center justify-between">
                  <span className="field-label mb-0">Ảnh ngựa</span>
                  {imagePreview && (
                    <button type="button" className="text-xs font-medium text-red-600" onClick={() => { setImagePreview(null); setImagePath(null); setUploadProgress(0); }}>
                      Xóa ảnh
                    </button>
                  )}
                </div>

                {imagePreview ? (
                  <div className="space-y-3">
                    {/* Local data URLs are preview-only and should not use Next image optimization. */}
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={imagePreview} alt="Preview" className="horse-preview-image h-48 w-full rounded-xl object-cover" />
                      <p className="text-xs text-slate-500">Đã tải ảnh {uploadProgress}%.</p>
                      <progress className="h-2 w-full accent-equine-gold" max="100" value={uploadProgress} />
                  </div>
                ) : (
                  <div className="grid h-48 place-items-center rounded-xl border border-dashed border-[#d8dff6] bg-white text-center">
                    <div className="space-y-2">
                      <div className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-[#eef2ff] text-equine-navy">
                        <ImagePlus size={20} />
                      </div>
                      <p className="text-sm text-slate-500">Chưa có ảnh hồ sơ</p>
                    </div>
                  </div>
                )}

                <label className="mt-4 flex cursor-pointer items-center justify-center gap-2 rounded-xl border border-equine-line bg-white px-3 py-2.5 text-sm font-medium text-equine-navy">
                  <Upload size={16} />
                  Chọn ảnh từ máy tính
                  <input ref={inputRef} type="file" accept="image/png,image/jpeg,image/webp" className="hidden" onChange={onFileChange} />
                </label>
              </div>

              <label className="block">
                <span className="field-label">Chuồng trại</span>
                <select
                  value={form.stableBoxId}
                  onChange={(event) => setForm({ ...form, stableBoxId: event.target.value })}
                  className="field-control"
                >
                  {stables.map((stable) => (
                    <option key={stable.id} value={stable.id}>
                      {stable.box_code} - {stable.section}
                    </option>
                  ))}
                </select>
              </label>

              <label className="block">
                <span className="field-label">Chủ sở hữu</span>
                <select
                  value={form.ownerId}
                  onChange={(event) => setForm({ ...form, ownerId: Number(event.target.value) })}
                  className="field-control"
                >
                  <option value={0}>Không gán chủ sở hữu</option>
                  {owners.map((owner) => (
                    <option key={owner.user_id} value={owner.user_id}>
                      {owner.full_name}
                    </option>
                  ))}
                </select>
              </label>
            </div>
          </div>

          <div className="flex justify-end gap-3 border-t border-equine-line pt-5">
            <button type="button" className="soft-button border-equine-line bg-white text-slate-700" onClick={() => router.push("/horses")}>
              Quay lại
            </button>
            <button type="submit" disabled={saving || uploading || !stables.length} className="gold-button">
              <Save size={16} />
              {uploading ? "Đang tải ảnh..." : saving ? "Đang lưu..." : "Lưu hồ sơ"}
            </button>
          </div>
        </form>
      </div>
    </main>
  );
}
