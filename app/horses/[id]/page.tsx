"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, Pencil, ShieldAlert, Tag } from "lucide-react";
import { useEffect, useState } from "react";
import { useHorseUser } from "@/components/HorseShell";
import { HorseImage, Notice, StatusBadge } from "@/components/HorseUI";
import { errorMessage, getHorse, type Horse } from "@/lib/horses";

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
          {user.roleName !== "HORSE_OWNER" && (
            <Link className="gold-button" href={`/horses/${horse.id}/edit`}>
              <Pencil size={16} /> Chỉnh sửa
            </Link>
          )}
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
                <ShieldAlert size={18} />
                <h2 className="font-sans text-2xl font-semibold">Cảnh báo & ràng buộc</h2>
              </div>
              <div className="mt-4 space-y-3 text-sm text-slate-600">
                <p>• Bảo mật dữ liệu theo role: Horse Owner chỉ có quyền xem hồ sơ thuộc sở hữu của mình.</p>
                <p>• Phải thực hiện soft delete thay vì hard delete để giữ lịch sử và dữ liệu liên quan.</p>
                <p>• Nếu ảnh không có, hệ thống hiển thị placeholder thay vì lỗi vỡ ảnh.</p>
              </div>
            </section>

            <section className="rounded-3xl border border-equine-line bg-white p-5 shadow-sm">
              <div className="flex items-center gap-2 text-equine-navy">
                <Tag size={18} />
                <h2 className="font-sans text-2xl font-semibold">Lịch sử & chi tiết</h2>
              </div>
              <div className="mt-4 rounded-2xl bg-[#f7f9ff] p-4 text-sm text-slate-600">
                - Khung hiện đang thể hiện UC-02: xem danh sách & chi tiết hồ sơ ngựa.\n- Khi Flow 5 triển khai, phần lịch sử thi đấu có thể bổ sung tab riêng cho Horse Owner.
              </div>
            </section>
          </div>
        </div>
      </div>
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
