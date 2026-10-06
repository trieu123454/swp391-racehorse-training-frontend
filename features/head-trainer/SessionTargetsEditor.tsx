"use client";

import { useEffect, useState, type FormEvent } from "react";
import { headTrainerApi, headTrainerError, type TrainingPlan, type TrainingSession } from "./api";

const commonDistances = Array.from({ length: 15 }, (_, index) => String((index + 2) * 200));

export default function SessionTargetsEditor({ session, onSaved }: {
  session: TrainingSession; onSaved: () => Promise<void>;
}) {
  const [open, setOpen] = useState(false);
  const [plans, setPlans] = useState<TrainingPlan[]>([]);
  const [planId, setPlanId] = useState(session.training_plan_id ?? "");
  const [distance, setDistance] = useState(String(session.plan_target_distance_meters ?? ""));
  const [intensity, setIntensity] = useState(session.plan_target_intensity ?? "");
  const [surface, setSurface] = useState(session.track_surface ?? "");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (!open) return;
    let active = true;
    headTrainerApi.plans(session.horse_id).then(result => { if (active) setPlans(result.data); })
      .catch(reason => { if (active) setError(headTrainerError(reason)); });
    return () => { active = false; };
  }, [open, session.horse_id]);
  function selectPlan(id: string) {
    setPlanId(id);
    const plan = plans.find(item => item.id === id);
    if (plan) {
      setDistance(String(plan.target_distance_meters ?? ""));
      setIntensity(plan.target_intensity ?? ""); setSurface(plan.target_track_surface ?? "");
    }
  }
  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setError(""); setBusy(true);
    try {
      await headTrainerApi.updateSchedule(session.training_schedule_id, {
        ...(planId !== session.training_plan_id || !session.plan_stage_name ? { training_plan_id: planId } : {}),
        target_distance_meters: Number(distance), target_intensity: intensity, track_surface: surface,
      });
      await onSaved(); setOpen(false);
    } catch (reason) { setError(headTrainerError(reason)); } finally { setBusy(false); }
  }
  if (!open) return <button type="button" className="soft-button mt-3" onClick={() => setOpen(true)}>Sửa mục tiêu buổi tập</button>;
  return <form onSubmit={save} className="mt-4 grid gap-3 border-t border-equine-line pt-4 sm:grid-cols-2">
    <p className="text-sm text-slate-500 sm:col-span-2">Chỉ sửa trước khi bắt đầu. Đổi giáo án sẽ áp dụng bản hiện tại cho buổi này; kết quả buổi đã tập được giữ nguyên.</p>
    <label><span className="field-label">Giáo án</span><select required className="field-control px-3" value={planId} onChange={event => selectPlan(event.target.value)}><option value="">Chọn giáo án</option>{plans.map(plan => <option key={plan.id} value={plan.id}>{plan.stage_name}</option>)}</select></label>
    <label><span className="field-label">Cự ly (m)</span><select className="field-control px-3" required value={distance} onChange={event => setDistance(event.target.value)}><option value="">Chọn cự ly</option>{!commonDistances.includes(distance) && distance && <option value={distance}>{Number(distance).toLocaleString("vi-VN")} m (hiện tại)</option>}{commonDistances.map(value => <option key={value} value={value}>{Number(value).toLocaleString("vi-VN")} m</option>)}</select></label>
    <label><span className="field-label">Cường độ</span><select className="field-control px-3" required value={intensity} onChange={event => setIntensity(event.target.value as typeof intensity)}><option value="">Chọn cường độ</option><option value="Low">Thấp</option><option value="Medium">Vừa</option><option value="High">Cao</option></select></label>
    <label><span className="field-label">Mặt sân</span><input className="field-control px-3" required maxLength={50} value={surface} onChange={event => setSurface(event.target.value)}/></label>
    {error && <p role="alert" className="text-sm text-rose-700 sm:col-span-2">{error}</p>}
    <div className="flex gap-2 sm:col-span-2"><button className="gold-button" disabled={busy}>Lưu mục tiêu</button><button type="button" className="soft-button" disabled={busy} onClick={() => setOpen(false)}>Đóng</button></div>
  </form>;
}
