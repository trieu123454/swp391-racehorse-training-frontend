"use client";

import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import { Activity, AlertTriangle, CalendarDays, Check, ClipboardCheck, Package, Plus, RefreshCw, Utensils } from "lucide-react";
import { Notice } from "@/features/horses/HorseUI";
import IncidentPhoto from "@/features/groom/IncidentPhoto";
import NotificationCenter from "@/shared/components/NotificationCenter";
import {
  completeGroomTrainingSession,
  completeGroomTask,
  createGroomSupplyRequest,
  getGroomCalendar,
  getGroomDietRecords,
  getGroomIncidents,
  getGroomInventory,
  getMyGroomHorses,
  getGroomSupplyRequests,
  reportGroomIncident,
  uploadGroomIncidentImage,
  type GroomCalendar,
  type GroomDietRecord,
  type GroomIncident,
  type GroomInventoryItem,
  type GroomHorse,
  type GroomSupplyRequest,
} from "@/features/groom/api";

function dateKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

export default function GroomWorkspace() {
  const [date, setDate] = useState(dateKey(new Date()));
  const [horses, setHorses] = useState<GroomHorse[]>([]);
  const [calendar, setCalendar] = useState<GroomCalendar | null>(null);
  const [diets, setDiets] = useState<(GroomDietRecord & { horse_name: string; box_code: string | null })[]>([]);
  const [inventory, setInventory] = useState<GroomInventoryItem[]>([]);
  const [incidents, setIncidents] = useState<GroomIncident[]>([]);
  const [supplyRequests, setSupplyRequests] = useState<GroomSupplyRequest[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const horseById = useMemo(() => new Map(horses.map((horse) => [horse.id, horse])), [horses]);
  const trainingEvents = calendar?.events.filter((event) => event.type === "training") ?? [];
  const careTasks = calendar?.events.filter((event) => event.type === "care_task") ?? [];

  const load = useCallback(async () => {
    setError("");
    try {
      const assigned = await getMyGroomHorses();
      const [dailyCalendar, dietPages, inventoryPage, incidentPage, requestPage] = await Promise.all([
        getGroomCalendar(date),
        Promise.all(assigned.data.map((horse) => getGroomDietRecords(horse.id, date))),
        getGroomInventory(), getGroomIncidents(), getGroomSupplyRequests(),
      ]);
      setHorses(assigned.data);
      setCalendar(dailyCalendar);
      setDiets(dietPages.flatMap((page, index) => page.data.map((diet) => ({
        ...diet, horse_name: assigned.data[index].horse_name,
        box_code: assigned.data[index].stable_box?.box_code ?? null,
      }))));
      setInventory(inventoryPage.data);
      setIncidents(incidentPage.data);
      setSupplyRequests(requestPage.data);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Không thể tải lịch chăm sóc.");
    }
  }, [date]);

  useEffect(() => { void load(); }, [load]);

  async function markTaskComplete(id: string) {
    setBusy(true); setError(""); setNotice("");
    try {
      const result = await completeGroomTask(id);
      setNotice(result.already_completed ? "Công việc này đã được hoàn thành." : "Đã xác nhận hoàn thành công việc chăm sóc.");
      await load();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Không thể hoàn thành công việc.");
    } finally {
      setBusy(false);
    }
  }

  async function markTrainingComplete(id: string) {
    setBusy(true); setError(""); setNotice("");
    try {
      const result = await completeGroomTrainingSession(id);
      setNotice(result.already_completed ? "Buổi tập này đã được xác nhận hoàn thành." : "Đã xác nhận buổi tập đã thực hiện và gửi cập nhật cho Head Trainer.");
      await load();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Không thể xác nhận buổi tập.");
    } finally { setBusy(false); }
  }

  async function incident(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const values = new FormData(form);
    setBusy(true); setError(""); setNotice("");
    try {
      const selectedFile = values.get("image_file");
      const imagePath = selectedFile instanceof File && selectedFile.size > 0
        ? (await uploadGroomIncidentImage(selectedFile)).imagePath
        : undefined;
      await reportGroomIncident(
        String(values.get("horse_id")),
        String(values.get("issue_description")),
        imagePath,
      );
      form.reset();
      setNotice("Đã gửi báo cáo sự cố cho bác sĩ thú y và Club Manager.");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Không thể gửi báo cáo sự cố.");
    } finally {
      setBusy(false);
    }
  }

  async function requestSupply(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const values = new FormData(form);
    setBusy(true); setError(""); setNotice("");
    try {
      await createGroomSupplyRequest({
        item_id: String(values.get("item_id")),
        quantity_requested: Number(values.get("quantity_requested")),
        reason: String(values.get("reason") ?? "").trim() || undefined,
      });
      form.reset();
      setNotice("Đã gửi đề xuất bổ sung vật tư cho Club Manager.");
      await load();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Không thể gửi đề xuất vật tư.");
    } finally { setBusy(false); }
  }

  return <section className="mt-10 space-y-5" aria-labelledby="groom-workspace-title">
    <div className="flex flex-col gap-3 border-b border-equine-line pb-4 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <p className="eyebrow">Chăm sóc chuồng trại</p>
        <h2 id="groom-workspace-title" className="mt-2 font-sans text-3xl font-semibold text-equine-navy">Groom workspace</h2>
        <p className="mt-2 text-sm text-slate-600">Xem ngựa được phân công, lịch trong ngày và ghi nhận công việc chăm sóc.</p>
      </div>
      <div className="flex gap-2">
        <input aria-label="Ngày công việc" type="date" className="field-control px-3" value={date} onChange={(event) => setDate(event.target.value)} />
        <button type="button" className="soft-button" onClick={() => void load()} disabled={busy}><RefreshCw size={15} /> Làm mới</button>
      </div>
    </div>
    {error && <Notice error>{error}</Notice>}{notice && <Notice>{notice}</Notice>}
    <NotificationCenter />
    <nav aria-label="Các mục Groom" className="flex gap-2 overflow-x-auto rounded-2xl border border-equine-line bg-white p-2 shadow-sm">
      {[["groom-horses", "Ngựa được giao"], ["care-tasks", "Việc chăm sóc"], ["training-support", "Buổi tập"], ["incident-report", "Báo sự cố"], ["diet-records", "Khẩu phần"], ["inventory", "Vật tư"], ["reported-incidents", "Lịch sử sự cố"]].map(([id, label]) => <a key={id} href={`#${id}`} className="inline-flex shrink-0 items-center rounded-xl px-3 py-2 text-sm font-semibold text-slate-600 hover:bg-equine-mist hover:text-equine-navy">{label}</a>)}
    </nav>
    <section id="groom-horses" className="scroll-mt-24 rounded-2xl border border-equine-line bg-white p-4 shadow-sm sm:p-5">
      <h3 className="mb-3 font-sans text-lg font-semibold text-equine-navy">Vị trí chuồng ngựa được phân công</h3>
      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">{horses.map((horse) => <article key={horse.id} className="rounded-xl border border-equine-line bg-slate-50 p-3">
        <p className="text-xs font-bold uppercase tracking-wide text-slate-500">{horse.stable_box ? `Khu ${horse.stable_box.section ?? "—"} · Chuồng ${horse.stable_box.box_code}` : "Chưa xếp chuồng"}</p>
        <p className="mt-2 font-semibold text-equine-navy">{horse.horse_name}</p>
        <p className="mt-1 text-xs text-slate-600">{horse.current_status}{horse.is_training_locked ? " · Đang khóa huấn luyện" : ""}</p>
      </article>)}{!horses.length && <p className="text-sm text-slate-500">Chưa có ngựa được phân công trong phạm vi lịch hiện tại.</p>}</div>
    </section>
    <div className="grid gap-5 xl:grid-cols-2">
      <section id="care-tasks" className="scroll-mt-24 rounded-2xl border border-equine-line bg-white p-4 shadow-sm sm:p-5">
        <h3 className="mb-4 flex items-center gap-2 font-sans text-lg font-semibold text-equine-navy"><ClipboardCheck size={18} /> Việc chăm sóc · {date}</h3>
        <div className="space-y-3">
          {careTasks.map((task) => {
            if (task.type !== "care_task") return null;
            const horse = horseById.get(task.horse.id);
            return <article key={task.task_id} className="flex flex-col gap-3 rounded-xl border border-equine-line p-4 sm:flex-row sm:items-center">
              <div className="min-w-0 flex-1">
                <p className="font-semibold text-equine-navy">{task.task_type} · {task.horse.horse_name}</p>
                <p className="mt-1 text-xs text-slate-500">{horse?.stable_box?.box_code ? `Chuồng ${horse.stable_box.box_code} · ` : ""}{date} · {task.status}</p>
              </div>
              {task.status === "Pending" && date <= dateKey(new Date()) && <button type="button" className="soft-button" disabled={busy} onClick={() => void markTaskComplete(task.task_id)}><Check size={14} /> Hoàn thành</button>}
            </article>;
          })}
          {!careTasks.length && <p className="rounded-xl bg-slate-50 p-5 text-center text-sm text-slate-500">Không có việc chăm sóc được giao trong ngày này.</p>}
        </div>
      </section>
      <section id="training-support" className="scroll-mt-24 rounded-2xl border border-equine-line bg-white p-4 shadow-sm sm:p-5">
        <h3 className="mb-4 flex items-center gap-2 font-sans text-lg font-semibold text-equine-navy"><CalendarDays size={18} /> Buổi tập cần hỗ trợ</h3>
        <div className="space-y-3">
          {trainingEvents.map((event) => event.type === "training" && <article key={event.event_id} className="rounded-xl border border-equine-line p-4">
            <p className="font-semibold text-equine-navy">{event.horse.horse_name}</p>
            <p className="mt-1 text-xs text-slate-500">{event.start_time ?? "Chưa đặt giờ"}{event.end_time ? `–${event.end_time}` : ""} · {event.status}{horseById.get(event.horse.id)?.stable_box?.box_code ? ` · Chuồng ${horseById.get(event.horse.id)?.stable_box?.box_code}` : ""}</p>
            {event.note && <p className="mt-2 text-sm text-slate-600">{event.note}</p>}
            {event.status === "Completed" ? <p className="mt-3 text-xs font-semibold text-emerald-700">Buổi tập đã được xác nhận.</p>
              : ["Scheduled", "InProgress"].includes(event.status)
                && new Date(`${event.event_date}T${event.end_time ?? "00:00"}:00`) <= new Date()
                && <button type="button" className="soft-button mt-3" disabled={busy} onClick={() => void markTrainingComplete(event.training_schedule_id)}><Check size={14} /> Xác nhận đã tập</button>}
          </article>)}
          {!trainingEvents.length && <p className="rounded-xl bg-slate-50 p-5 text-center text-sm text-slate-500">Không có buổi tập được phân công trong ngày này.</p>}
        </div>
      </section>
    </div>
    <section id="incident-report" className="scroll-mt-24 rounded-2xl border border-amber-200 bg-white p-4 shadow-sm sm:p-5">
      <h3 className="mb-3 flex items-center gap-2 font-sans text-lg font-semibold text-equine-navy"><AlertTriangle size={18} /> Báo cáo sự cố</h3>
      {horses.length === 0 ? <p className="text-sm text-slate-500">Chỉ có thể báo cáo sự cố cho ngựa được phân công.</p> : <form onSubmit={incident} className="grid gap-3 sm:grid-cols-[1fr_2fr_2fr_auto] sm:items-end">
        <label className="block"><span className="field-label">Ngựa được phân công</span><select className="field-control px-3" name="horse_id" required>{horses.map((horse) => <option key={horse.id} value={horse.id}>{horse.horse_name}</option>)}</select></label>
        <label className="block"><span className="field-label">Mô tả sự cố</span><textarea className="field-control min-h-12 px-3 py-2" name="issue_description" maxLength={1000} required /></label>
        <label className="block"><span className="field-label">Ảnh sự cố (JPG, PNG, WebP · tối đa 5 MB)</span><input className="field-control px-3" name="image_file" type="file" accept="image/jpeg,image/png,image/webp" /></label>
        <button className="gold-button" disabled={busy}><Activity size={15} /> Gửi báo cáo</button>
      </form>}
    </section>
    <div className="grid gap-5 xl:grid-cols-2">
      <section id="diet-records" className="scroll-mt-24 rounded-2xl border border-equine-line bg-white p-4 shadow-sm sm:p-5">
        <h3 className="mb-4 flex items-center gap-2 font-sans text-lg font-semibold text-equine-navy"><Utensils size={18} /> Khẩu phần đang áp dụng · {date}</h3>
        <div className="space-y-2">{diets.map((diet) => <article key={diet.id} className="rounded-xl border border-equine-line p-3">
          <div className="flex flex-wrap justify-between gap-2"><p className="font-semibold text-equine-navy">{diet.horse_name}{diet.box_code ? ` · Chuồng ${diet.box_code}` : ""}</p><span className="text-xs text-slate-500">{diet.effective_date ?? "—"} → {diet.end_date ?? "Đang áp dụng"}</span></div>
          <p className="mt-1 text-sm text-slate-700">{diet.feed_type} · {diet.quantity_kg} kg · {diet.feeding_frequency || "Chưa ghi giờ ăn"}</p>
          {diet.special_instructions && <p className="mt-1 whitespace-pre-wrap text-xs text-slate-500">{diet.special_instructions}</p>}
        </article>)}{!diets.length && <p className="rounded-xl bg-slate-50 p-4 text-center text-sm text-slate-500">Không có khẩu phần được duyệt áp dụng cho ngày này.</p>}</div>
      </section>
      <section id="inventory" className="scroll-mt-24 rounded-2xl border border-equine-line bg-white p-4 shadow-sm sm:p-5">
        <h3 className="mb-4 flex items-center gap-2 font-sans text-lg font-semibold text-equine-navy"><Package size={18} /> Vật tư khu vực</h3>
        <div className="mb-4 space-y-2">{inventory.map((item) => <article key={item.id} className={`flex flex-wrap justify-between gap-2 rounded-lg border p-3 text-sm ${item.is_low_stock ? "border-amber-200 bg-amber-50" : "border-equine-line"}`}>
          <span className="font-medium text-equine-navy">{item.item_name} · {item.category ?? "Khác"}</span><span>{item.quantity_in_stock} {item.unit ?? "đơn vị"}{item.is_low_stock ? " · Sắp hết" : ""}</span>
        </article>)}{!inventory.length && <p className="text-sm text-slate-500">Chưa có danh mục vật tư.</p>}</div>
        {inventory.length > 0 && <form onSubmit={requestSupply} className="grid gap-2 sm:grid-cols-2">
          <label className="block"><span className="field-label">Vật tư cần bổ sung</span><select className="field-control px-3" name="item_id" required>{inventory.map((item) => <option key={item.id} value={item.id}>{item.item_name} · còn {item.quantity_in_stock} {item.unit ?? ""}</option>)}</select></label>
          <label className="block"><span className="field-label">Số lượng</span><input className="field-control px-3" name="quantity_requested" type="number" min="0.01" step="0.01" required /></label>
          <label className="block sm:col-span-2"><span className="field-label">Lý do</span><input className="field-control px-3" name="reason" maxLength={2000} /></label>
          <button className="gold-button sm:col-span-2" disabled={busy}><Plus size={15} /> Đề xuất bổ sung</button>
        </form>}
        <div className="mt-4 space-y-2">{supplyRequests.slice(0, 5).map((request) => <p key={request.id} className="rounded-lg bg-slate-50 p-3 text-xs text-slate-600">{request.item_name} · {request.quantity_requested} · {request.status}</p>)}</div>
      </section>
    </div>
    <section id="reported-incidents" className="scroll-mt-24 rounded-2xl border border-equine-line bg-white p-4 shadow-sm sm:p-5">
      <h3 className="mb-4 flex items-center gap-2 font-sans text-lg font-semibold text-equine-navy"><AlertTriangle size={18} /> Báo cáo sự cố đã gửi</h3>
      <div className="grid gap-3 sm:grid-cols-2">{incidents.map((item) => <article key={item.id} className="rounded-xl border border-equine-line p-3">
        <div className="flex justify-between gap-2"><p className="font-semibold text-equine-navy">{item.horse_name}</p><span className="text-xs text-slate-500">{item.status}</span></div>
        <p className="mt-1 whitespace-pre-wrap text-sm text-slate-700">{item.issue_description}</p>
        <IncidentPhoto incidentId={item.id} imageUrl={item.image_url} />
        <p className="mt-2 text-[11px] text-slate-400">{new Date(item.created_at).toLocaleString("vi-VN")}</p>
      </article>)}{!incidents.length && <p className="text-sm text-slate-500">Chưa gửi báo cáo sự cố nào.</p>}</div>
    </section>
  </section>;
}
