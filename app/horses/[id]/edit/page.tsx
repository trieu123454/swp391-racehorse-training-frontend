"use client";
/* eslint-disable @next/next/no-img-element */

import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { ImagePlus, Save, Upload, X } from "lucide-react";
import { Notice } from "@/components/HorseUI";
import { errorMessage, getHorse, getHorseOwners, getHorseStables, saveHorse, uploadHorseImage, type Owner, type Stable } from "@/lib/horses";

export default function EditHorsePage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const [horse, setHorse] = useState<Awaited<ReturnType<typeof getHorse>> | null>(null);
  const [form, setForm] = useState({ horseName: "", breed: "", birthYear: 2024, pedigreeFather: "", pedigreeMother: "", stableBoxId: "", ownerId: 0 });
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [imagePath, setImagePath] = useState<string | null>(null);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploading, setUploading] = useState(false);
  const [stables, setStables] = useState<Stable[]>([]);
  const [owners, setOwners] = useState<Owner[]>([]);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    Promise.all([getHorse(params.id), getHorseStables(), getHorseOwners()]).then(([currentHorse, nextStables, nextOwners]) => {
      setHorse(currentHorse);
      setStables(nextStables);
      setOwners(nextOwners);
      setForm({ horseName: currentHorse.horse_name, breed: currentHorse.breed ?? "", birthYear: currentHorse.birth_year ?? 2024, pedigreeFather: currentHorse.pedigree_father ?? "", pedigreeMother: currentHorse.pedigree_mother ?? "", stableBoxId: currentHorse.stable_box_id, ownerId: currentHorse.owner_id ?? 0 });
      setImagePath(currentHorse.image_url);
    }).catch((reason) => setError(errorMessage(reason)));
  }, [params.id]);

  if (!horse && !error) {
    return (
      <main className="min-h-screen bg-equine-paper p-6">
        <div className="mx-auto max-w-[800px] rounded-2xl border border-equine-line bg-white p-6">
          <Notice>Đang tải hồ sơ ngựa...</Notice>
        </div>
      </main>
    );
  }

  if (!horse) {
    return <main className="min-h-screen bg-equine-paper p-6"><div className="mx-auto max-w-[800px] rounded-2xl border border-equine-line bg-white p-6"><Notice error>{error}</Notice><div className="mt-4"><button type="button" className="gold-button" onClick={() => router.push("/horses")}>Quay lại danh sách</button></div></div></main>;
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

    void saveHorse({ horseName: form.horseName, breed: form.breed || null, birthYear: form.birthYear || null, pedigreeFather: form.pedigreeFather || null, pedigreeMother: form.pedigreeMother || null, stableBoxId: form.stableBoxId, ownerId: form.ownerId || null, imagePath, confirmOwnerChange: form.ownerId !== safeHorse.owner_id }).then(() => {
      setSaving(false);
      router.push(`/horses/${safeHorse.id}`);
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
    <main className="min-h-screen bg-equine-paper p-4 sm:p-6 lg:p-8">
      <div className="mx-auto max-w-[900px] rounded-3xl border border-equine-line bg-white p-4 shadow-sm sm:p-6">
        <div className="mb-6 flex items-center justify-between gap-3">
          <div>
            <p className="eyebrow">UC-03</p>
            <h1 className="mt-2 font-sans text-3xl font-semibold text-equine-navy">
              Cập nhật hồ sơ ngựa
            </h1>
          </div>
          <button type="button" className="soft-button border-equine-line bg-[#f7f9ff] text-slate-700" onClick={() => router.push(`/horses/${safeHorse.id}`)}>
            <X size={16} /> Hủy
          </button>
        </div>

        {error && <Notice error>{error}</Notice>}

        <form className="space-y-6" onSubmit={handleSubmit}>
          <div className="grid gap-5 md:grid-cols-2">
            <label className="block">
              <span className="field-label">Tên ngựa</span>
              <input value={form.horseName} onChange={(event) => setForm({ ...form, horseName: event.target.value })} className="field-control" />
            </label>

            <label className="block">
              <span className="field-label">Giống</span>
              <input value={form.breed} onChange={(event) => setForm({ ...form, breed: event.target.value })} className="field-control" />
            </label>

            <label className="block">
              <span className="field-label">Năm sinh</span>
              <input type="number" value={form.birthYear} onChange={(event) => setForm({ ...form, birthYear: Number(event.target.value) || 0 })} className="field-control" />
            </label>

            <label className="block">
              <span className="field-label">Chuồng trại</span>
              <select value={form.stableBoxId} onChange={(event) => setForm({ ...form, stableBoxId: event.target.value })} className="field-control">
                {stables.map((stable) => (
                  <option key={stable.id} value={stable.id}>{stable.box_code} - {stable.section}</option>
                ))}
              </select>
            </label>

            <label className="block">
              <span className="field-label">Tên cha</span>
              <input value={form.pedigreeFather} onChange={(event) => setForm({ ...form, pedigreeFather: event.target.value })} className="field-control" />
            </label>

            <label className="block">
              <span className="field-label">Tên mẹ</span>
              <input value={form.pedigreeMother} onChange={(event) => setForm({ ...form, pedigreeMother: event.target.value })} className="field-control" />
            </label>
          </div>

          <label className="block">
            <span className="field-label">Chủ sở hữu</span>
            <select value={form.ownerId} onChange={(event) => setForm({ ...form, ownerId: Number(event.target.value) })} className="field-control">
              <option value={0}>Không gán chủ sở hữu</option>
              {owners.map((owner) => (
                <option key={owner.user_id} value={owner.user_id}>{owner.full_name}</option>
              ))}
            </select>
          </label>

          <div className="rounded-2xl border border-dashed border-equine-line bg-[#f7f9ff] p-4">
            <span className="field-label">Ảnh ngựa</span>
            {imagePreview && <><span className="sr-only">Ảnh xem trước</span><img src={imagePreview} alt="Preview" className="horse-preview-image mb-3 h-40 w-full rounded-xl object-cover" /></>}
            <label className="flex cursor-pointer items-center justify-center gap-2 rounded-xl border border-equine-line bg-white px-3 py-2.5 text-sm font-medium text-equine-navy">
              {imagePreview ? <ImagePlus size={16} /> : <Upload size={16} />} Đổi ảnh
              <input type="file" accept="image/png,image/jpeg,image/webp" className="hidden" onChange={onFileChange} />
            </label>
            {imagePreview && <progress className="mt-3 h-2 w-full accent-equine-gold" max="100" value={uploadProgress} />}
          </div>

          <div className="flex justify-end gap-3 border-t border-equine-line pt-5">
            <button type="button" className="soft-button border-equine-line bg-white text-slate-700" onClick={() => router.push(`/horses/${safeHorse.id}`)}>
              Quay lại
            </button>
            <button type="submit" disabled={saving || uploading} className="gold-button">
              <Save size={16} /> {saving ? "Đang lưu..." : "Lưu thay đổi"}
            </button>
          </div>
        </form>
      </div>
    </main>
  );
}
