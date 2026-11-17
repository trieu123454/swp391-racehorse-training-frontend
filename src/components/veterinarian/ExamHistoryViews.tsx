"use client";

import { useId, useMemo, useState } from "react";
import type { HealthExam, InjuryMarker, MedicalRecord } from "@/api/veterinarian/api";

export default function ExamHistoryViews({ exams, diagnosesByExam, onOpen, injuries, onOpenInjuries }: {
  exams: HealthExam[];
  diagnosesByExam: Map<string, MedicalRecord[]>;
  onOpen: (id: string) => void;
  injuries: InjuryMarker[];
  onOpenInjuries: () => void;
}) {
  const [tab, setTab] = useState<"records" | "history">("records");
  const id = useId();
  const sorted = useMemo(() => [...exams].sort((a, b) =>
    (Date.parse(b.exam_date) || 0) - (Date.parse(a.exam_date) || 0)), [exams]);
  const events = [
    ...sorted.map((exam) => ({ kind: "exam" as const, date: exam.exam_date, exam })),
    ...injuries.map((injury) => ({ kind: "injury" as const, date: injury.marked_at, injury })),
  ].sort((a, b) => (Date.parse(b.date) || 0) - (Date.parse(a.date) || 0));
  const injuryStatus = { Active: "Đang chấn thương", Recovering: "Đang hồi phục", Recovered: "Đã hồi phục" };
  const linkedInjuries = (exam: HealthExam) => {
    const recordIds = new Set((diagnosesByExam.get(exam.id) ?? []).map((record) => record.id));
    return injuries.filter((injury) => injury.medical_record_id && recordIds.has(injury.medical_record_id));
  };
  const date = (value: string) => {
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? "Chưa ghi nhận" : parsed.toLocaleString("vi-VN");
  };
  const conclusion = (exam: HealthExam) =>
    (diagnosesByExam.get(exam.id) ?? []).map((record) => record.diagnosis).join("; ")
    || exam.conclusion || exam.notes || "Chưa có kết luận";
  const tabs = [{ key: "records", label: "Hồ sơ khám bệnh" }, { key: "history", label: "Lịch sử theo ngựa" }] as const;

  return <div>
    <div role="tablist" aria-label="Hồ sơ và lịch sử khám" className="mb-4 flex gap-1 border-b border-equine-line">
      {tabs.map(({ key, label }, index) => <button key={key} type="button" role="tab"
        id={`${id}-${key}-tab`} aria-controls={`${id}-${key}-panel`} aria-selected={tab === key}
        tabIndex={tab === key ? 0 : -1}
        onClick={() => setTab(key)}
        onKeyDown={(event) => {
          let next: number;
          if (event.key === "ArrowRight" || event.key === "ArrowLeft") next = 1 - index;
          else if (event.key === "Home") next = 0;
          else if (event.key === "End") next = 1;
          else return;
          event.preventDefault();
          setTab(tabs[next].key);
          document.getElementById(`${id}-${tabs[next].key}-tab`)?.focus();
        }}
        className={`border-b-2 px-3 py-3 text-sm font-semibold transition ${tab === key ? "border-equine-navy text-equine-navy" : "border-transparent text-slate-500 hover:text-equine-navy"}`}>
        {label}
      </button>)}
    </div>
    <div role="tabpanel" id={`${id}-${tab}-panel`} aria-labelledby={`${id}-${tab}-tab`} tabIndex={0}>
      {(tab === "records" ? sorted.length === 0 : events.length === 0) ? <p className="py-6 text-center text-sm text-slate-500">{tab === "records" ? "Ngựa chưa có hồ sơ khám bệnh. Chuyển sang Lịch sử theo ngựa để xem chấn thương đã ghi nhận." : "Ngựa chưa có lần khám hoặc chấn thương được ghi nhận."}</p>
        : tab === "records" ? <div className="overflow-x-auto rounded-lg border border-equine-line">
          <table className="w-full min-w-[640px] text-left text-sm">
            <thead className="bg-slate-50 text-equine-navy"><tr>{["Ngày khám", "Loại khám", "Bác sĩ", "Kết luận"].map((label) => <th key={label} scope="col" className="px-4 py-3 font-semibold">{label}</th>)}</tr></thead>
            <tbody className="divide-y divide-equine-line">{sorted.map((exam) => <tr key={exam.id} className="hover:bg-slate-50">
              <td className="px-4 py-3"><button type="button" className="text-left font-medium text-equine-navy underline-offset-4 hover:underline" onClick={() => onOpen(exam.id)}>{date(exam.exam_date)}</button></td>
              <td className="px-4 py-3">{exam.exam_type || "Chưa ghi nhận"}</td>
              <td className="px-4 py-3">{exam.doctor?.name || "Chưa ghi nhận"}</td>
              <td className="max-w-md whitespace-pre-wrap px-4 py-3">{conclusion(exam)}{linkedInjuries(exam).length > 0 && <button type="button" className="mt-2 block text-xs font-medium text-rose-800 underline" onClick={onOpenInjuries}>Chấn thương: {linkedInjuries(exam).map((injury) => injury.body_part).join(", ")}</button>}</td>
            </tr>)}</tbody>
          </table>
        </div> : <ol className="ml-2 border-l border-equine-line pl-6">{events.map((event) => {
          if (event.kind === "injury") {
            const injury = event.injury;
            const record = [...diagnosesByExam.values()].flat().find((item) => item.id === injury.medical_record_id);
            return <li key={`injury-${injury.id}`} className="relative pb-6 last:pb-0">
              <span aria-hidden="true" className="absolute -left-[29px] top-1.5 h-2.5 w-2.5 rounded-full bg-rose-500 ring-4 ring-white" />
              <time dateTime={injury.marked_at} className="text-xs text-slate-500">{date(injury.marked_at)}</time>
              <div className="mt-2 rounded-lg border border-rose-100 bg-rose-50/30 p-4"><h4 className="font-semibold text-rose-900">Chấn thương · {injury.body_part}</h4><p className="mt-1 text-sm">{injuryStatus[injury.recovery_status]} · {({ Mild: "Nhẹ", Moderate: "Trung bình", Severe: "Nặng" })[injury.severity]}</p>
                {record && <p className="mt-2 text-sm text-slate-700">{record.diagnosis}</p>}
                <div className="mt-3 flex flex-wrap gap-3">{record?.health_exam_id && <button type="button" className="text-sm font-medium text-equine-navy underline" onClick={() => onOpen(record.health_exam_id!)}>Mở lần khám liên quan</button>}<button type="button" className="text-sm font-medium text-rose-800 underline" onClick={onOpenInjuries}>Xem hồ sơ chấn thương</button></div>
              </div>
            </li>;
          }
          const exam = event.exam;
          return <li key={`exam-${exam.id}`} className="relative pb-6 last:pb-0">
          <span aria-hidden="true" className="absolute -left-[29px] top-1.5 h-2.5 w-2.5 rounded-full bg-equine-teal ring-4 ring-white" />
          <time dateTime={exam.exam_date} className="text-xs text-slate-500">{date(exam.exam_date)}</time>
          <div className="mt-2 rounded-lg border border-equine-line p-4">
            <div className="flex flex-wrap items-center justify-between gap-2"><h4 className="font-semibold text-equine-navy">{exam.exam_type || "Lần khám"}</h4><button type="button" className="soft-button h-9 px-3 text-xs" onClick={() => onOpen(exam.id)}>Mở chi tiết</button></div>
            <p className="mt-1 text-xs text-slate-500">Bác sĩ: {exam.doctor?.name || "Chưa ghi nhận"}</p>
            <p className="mt-3 whitespace-pre-wrap text-sm text-slate-700">{conclusion(exam)}</p>
          </div>
        </li>; })}</ol>}
    </div>
  </div>;
}
