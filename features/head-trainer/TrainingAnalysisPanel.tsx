"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import {
  headTrainerApi,
  headTrainerError,
  type TrainingAnalysis,
  type TrainingMetric,
  type Simulation,
} from "./api";
import SensorTimeline from "./SensorTimeline";

const advice: Record<string, string> = {
  AWAIT_RESULTS: "Chờ kết quả buổi tập.",
  REVIEW_INTERRUPTION: "Xem lý do gián đoạn trước khi xếp buổi tiếp theo.",
  REVIEW_WITH_VET: "Trao đổi với Vet trước khi tăng tải.",
  REVIEW_SHORTFALL: "Chưa đạt cự ly; xem lại buổi tập trước khi tăng tải.",
  REVIEW_EXCESS: "Vượt cự ly mục tiêu; xem lại khối lượng buổi tập.",
  TARGET_MET: "Đạt cự ly mục tiêu; cân nhắc giữ tải sau khi xem xét hồi phục.",
};
const statuses: Record<string, string> = {
  Scheduled: "Đã lên lịch",
  InProgress: "Đang tập",
  Completed: "Hoàn thành",
  Cancelled: "Đã hủy",
  Missed: "Bỏ lỡ",
  Blocked: "Chờ xử lý y tế",
};

function value(number?: number | null, suffix = "") {
  return number == null || !Number.isFinite(Number(number)) ? "—" : Number(number).toFixed(1) + suffix;
}

function metricDate(date?: string | null) {
  if (!date) return "Chưa có dữ liệu";
  const parsed = new Date(date);
  return Number.isNaN(parsed.getTime())
    ? date
    : parsed.toLocaleString("vi-VN", { dateStyle: "medium", timeStyle: "short" });
}

function shortDate(date: string) {
  const parsed = new Date(date);
  return Number.isNaN(parsed.getTime())
    ? date
    : parsed.toLocaleDateString("vi-VN", { day: "2-digit", month: "2-digit" });
}

function numberLabel(number: number) {
  return new Intl.NumberFormat("vi-VN", { maximumFractionDigits: 1 }).format(number);
}

type Week = TrainingAnalysis["weeks"][number];

export default function TrainingAnalysisPanel({
  horseId,
  from,
  to,
  setFrom,
  setTo,
  revision,
}: {
  horseId: string;
  from: string;
  to: string;
  setFrom: (value: string) => void;
  setTo: (value: string) => void;
  revision: number;
}) {
  const [report, setReport] = useState<TrainingAnalysis | null>(null);
  const [metrics, setMetrics] = useState<TrainingMetric[]>([]);
  const [includeSimulated, setIncludeSimulated] = useState(true);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [localRevision, setLocalRevision] = useState(0);
  const [saving, setSaving] = useState(false);
  const [detail, setDetail] = useState<Simulation | null>(null);
  const detailRequestRef = useRef(0);

  useEffect(() => {
    let active = true;
    ++detailRequestRef.current;
    setReport(null);
    setMetrics([]);
    setDetail(null);
    setError("");
    if (!horseId) {
      setLoading(false);
      return;
    }

    setLoading(true);
    Promise.all([
      headTrainerApi.analysis(horseId, from, to),
      headTrainerApi.metrics(horseId, from, to, includeSimulated),
    ])
      .then(([analysis, history]) => {
        if (active) {
          setReport(analysis);
          setMetrics(history);
        }
      })
      .catch((reason) => {
        if (active) setError(headTrainerError(reason));
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [horseId, from, to, revision, localRevision, includeSimulated]);

  async function review(event: FormEvent<HTMLFormElement>, id: string) {
    event.preventDefault();
    setSaving(true);
    setError("");
    try {
      await headTrainerApi.updateSchedule(id, {
        trainer_review: String(new FormData(event.currentTarget).get("trainer_review")),
      });
      setLocalRevision((current) => current + 1);
    } catch (reason) {
      setError(headTrainerError(reason));
    } finally {
      setSaving(false);
    }
  }

  async function showReadings(id: string) {
    const request = ++detailRequestRef.current;
    setError("");
    try {
      const snapshot = await headTrainerApi.simulation(id);
      if (request === detailRequestRef.current) setDetail(snapshot);
    } catch (reason) {
      if (request === detailRequestRef.current) setError(headTrainerError(reason));
    }
  }

  return (
    <div className="space-y-5">
      <section className="rounded-2xl border border-equine-line bg-white p-5">
        <h3 className="font-semibold text-equine-navy">Mức đạt giáo án và khối lượng tuần</h3>
        <p className="mt-2 text-sm text-slate-500">
          Khối lượng thực hiện gồm cả thời gian đã tập của phiên bị dừng. Mục tiêu tuần được phân bổ theo số ngày của giai đoạn trong khoảng báo cáo.
        </p>
        <div className="mt-4 grid max-w-lg grid-cols-2 gap-3">
          <label>
            <span className="field-label">Từ ngày</span>
            <input type="date" className="field-control px-3" value={from} onChange={(event) => setFrom(event.target.value)} />
          </label>
          <label>
            <span className="field-label">Đến ngày</span>
            <input type="date" className="field-control px-3" value={to} onChange={(event) => setTo(event.target.value)} />
          </label>
        </div>
        {error && <p role="alert" className="mt-3 text-sm text-rose-700">{error}</p>}
        {loading && <p className="mt-3 text-sm text-slate-500">Đang tải báo cáo…</p>}
        {!horseId && <p className="mt-4 text-sm text-slate-500">Chọn một ngựa để xem phân tích.</p>}
        {report && (
          <>
            <WorkloadSummary weeks={report.weeks} />
            <WeeklyWorkloadChart weeks={report.weeks} />
            <div className="mt-5 overflow-x-auto">
              <table className="w-full min-w-[650px] text-left text-sm">
                <thead>
                  <tr>
                    <th>Tuần bắt đầu</th><th>Mục tiêu</th><th>Đã xếp lịch</th><th>Thực hiện</th><th>Đạt</th><th>Hoàn thành / bỏ lỡ / hủy</th>
                  </tr>
                </thead>
                <tbody>
                  {report.weeks.map((week) => (
                    <tr key={week.week_start} className="border-t border-equine-line">
                      <td className="py-3">{week.week_start}</td>
                      <td>{value(week.target_minutes, " phút")}</td>
                      <td>{value(week.planned_minutes, " phút")}</td>
                      <td>{value(week.actual_minutes, " phút")}</td>
                      <td>{value(week.workload_achievement_percent, "%")}</td>
                      <td>{week.completed} / {week.missed} / {week.cancelled}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </section>

      <section className="rounded-2xl border border-equine-line bg-white p-5">
        <h3 className="font-semibold text-equine-navy">Lịch sử chạy thử</h3>
        <p className="mt-2 text-sm text-slate-500">
          So với lần trước có cùng cự ly mục tiêu, cường độ và mặt sân trong khoảng báo cáo. Thời lượng gồm khởi động và hồi phục; điểm hồi phục là ước tính của mô hình.
        </p>
        {report && <TrialRunCharts runs={report.trial_runs} />}
        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[700px] text-left text-sm">
            <thead>
              <tr>
                <th>Ngày</th><th>Trạng thái</th><th>Cự ly mục tiêu / thực hiện</th><th>Tốc độ TB</th><th>Nhịp tim hồi phục</th><th>Thay đổi tốc độ</th>
              </tr>
            </thead>
            <tbody>
              {report?.trial_runs.map((run) => (
                <tr key={run.id} className="border-t border-equine-line">
                  <td className="py-3">{run.event_date}</td>
                  <td>{statuses[run.effective_status] ?? run.effective_status}</td>
                  <td>{value(run.target_distance_meters)} / {value(run.actual_distance_meters)} m</td>
                  <td>{value(run.avg_speed_kmh, " km/h")}</td>
                  <td>{value(run.recovery_heart_rate, " bpm")}</td>
                  <td>{value(run.speed_change_kmh, " km/h")}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {report && report.trial_runs.length === 0 && (
          <p className="mt-3 text-sm text-slate-500">Chưa có lượt chạy thử trong khoảng ngày này.</p>
        )}
      </section>

      <HorseDevelopment
        metrics={metrics}
        includeSimulated={includeSimulated}
        setIncludeSimulated={setIncludeSimulated}
        loading={loading}
      />

      <section className="rounded-2xl border border-equine-line bg-white p-5">
        <h3 className="font-semibold text-equine-navy">Đánh giá từng buổi</h3>
        <div className="mt-4 space-y-4">
          {report?.sessions.map((session) => (
            <article key={session.id} className="rounded-xl border border-equine-line p-4">
              <div className="flex flex-wrap justify-between gap-2">
                <strong>
                  {session.event_date} · {session.start_time?.slice(0, 5)} · {session.session_type === "TrialRun" ? "Chạy thử" : session.session_type === "Rest" ? "Nghỉ" : "Huấn luyện"}
                </strong>
                <span>{statuses[session.effective_status] ?? session.effective_status}</span>
              </div>
              <p className="mt-2 text-sm text-slate-600">
                Giai đoạn: {session.snapshot_stage_name ?? "—"} · Groom: {session.groom_name ?? "Chưa phân công"} · Mặt sân: {session.track_surface ?? "—"}
              </p>
              <p className="mt-1 text-sm">
                Cự ly: {value(session.actual_distance_meters)} / {value(session.target_distance_meters)} m · Đạt {value(session.distance_achievement_percent, "%")}
              </p>
              <p className="mt-1 text-sm">
                Nhịp tim tối đa: {value(session.max_heart_rate, " bpm")} · Điểm hồi phục ước tính: {value(session.estimated_stamina_score)} / 10
              </p>
              {session.stop_reason && <p className="mt-2 text-sm text-rose-700">Phiên bị dừng: {session.stop_reason}</p>}
              <p className="mt-2 text-sm text-equine-navy">
                {session.session_type === "Rest" ? "Buổi nghỉ không chạy bài vận động." : advice[session.recommendation]}
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                {session.simulation_attempts?.map((attempt, index) => (
                  <button key={attempt.id} className="soft-button" type="button" onClick={() => void showReadings(attempt.id)}>
                    Cảm biến lần {index + 1} · {attempt.status === "Interrupted" ? "Đã dừng" : attempt.status === "Completed" ? "Hoàn thành" : "Đang tập"}
                  </button>
                ))}
              </div>
              {["Completed", "Cancelled", "Missed", "Blocked"].includes(session.effective_status) && (
                <form onSubmit={(event) => void review(event, session.id)} className="mt-3 flex flex-wrap gap-2">
                  <textarea
                    name="trainer_review"
                    aria-label="Nhận xét Head Trainer"
                    className="field-control min-w-48 flex-1 px-3 py-2"
                    defaultValue={session.trainer_review ?? ""}
                    placeholder="Nhận xét và quyết định cho buổi tiếp theo"
                    maxLength={4000}
                  />
                  <button disabled={saving} className="gold-button">Lưu nhận xét</button>
                </form>
              )}
            </article>
          ))}
        </div>
        {report && report.sessions.length === 0 && <p className="mt-3 text-sm text-slate-500">Chưa có buổi tập trong khoảng ngày này.</p>}
      </section>

      {detail && (
        <section className="rounded-2xl border border-equine-line bg-white p-5">
          <div className="flex justify-between">
            <h3 className="font-semibold text-equine-navy">Chuỗi cảm biến · {detail.horses[0]?.horse_name}</h3>
            <button type="button" className="soft-button" onClick={() => { ++detailRequestRef.current; setDetail(null); }}>Đóng</button>
          </div>
          <SensorTimeline readings={detail.readings ?? []} />
        </section>
      )}
    </div>
  );
}

function WorkloadSummary({ weeks }: { weeks: Week[] }) {
  const totals = weeks.reduce(
    (result, week) => ({
      target: result.target + (week.target_minutes ?? 0),
      planned: result.planned + (week.planned_minutes ?? 0),
      actual: result.actual + (week.actual_minutes ?? 0),
    }),
    { target: 0, planned: 0, actual: 0 },
  );
  const achievement = totals.target > 0 ? totals.actual / totals.target * 100 : null;
  const entries = [
    { label: "Mục tiêu", amount: totals.target, color: "#64748b" },
    { label: "Đã xếp lịch", amount: totals.planned, color: "#d49a38" },
    { label: "Thực hiện", amount: totals.actual, color: "#287765" },
  ];
  return (
    <div className="mt-4 grid gap-2 sm:grid-cols-3">
      {entries.map((entry) => (
        <div key={entry.label} className="rounded-xl border border-equine-line bg-slate-50 px-3 py-2">
          <p className="text-xs text-slate-500">{entry.label} · toàn kỳ</p>
          <p className="mt-1 text-lg font-semibold text-equine-navy">{numberLabel(entry.amount)} phút</p>
        </div>
      ))}
      <p className="text-xs text-slate-500 sm:col-span-3">
        Mức đạt tổng kỳ: <strong className="text-equine-navy">{achievement == null ? "Chưa có mục tiêu" : numberLabel(achievement) + "%"}</strong>
      </p>
    </div>
  );
}

function WeeklyWorkloadChart({ weeks }: { weeks: Week[] }) {
  if (weeks.length === 0) {
    return <p className="mt-4 rounded-xl border border-dashed border-equine-line p-5 text-center text-sm text-slate-500">Chưa có dữ liệu tuần trong khoảng ngày này.</p>;
  }
  const series = [
    { key: "target_minutes" as const, label: "Mục tiêu", color: "#64748b" },
    { key: "planned_minutes" as const, label: "Đã xếp lịch", color: "#d49a38" },
    { key: "actual_minutes" as const, label: "Thực hiện", color: "#287765" },
  ];
  const chart = { left: 48, top: 18, bottom: 174, height: 220, groupWidth: 64, right: 16 };
  const width = chart.left + weeks.length * chart.groupWidth + chart.right;
  const maximum = Math.max(1, ...weeks.flatMap((week) => series.map((item) => week[item.key] ?? 0)));
  const y = (amount: number) => chart.bottom - amount / maximum * (chart.bottom - chart.top);
  const ticks = [maximum, maximum / 2, 0];
  const barWidth = Math.min(13, (chart.groupWidth - 14) / 3);
  return (
    <div className="mt-5">
      <div className="mb-2 flex flex-wrap gap-x-5 gap-y-2 text-xs text-slate-600">
        {series.map((item) => (
          <span key={item.key} className="inline-flex items-center gap-2">
            <span className="h-3 w-3 rounded-sm" style={{ backgroundColor: item.color }} />{item.label}
          </span>
        ))}
        <span className="text-slate-500">Đơn vị: phút / tuần</span>
      </div>
      <div className="overflow-x-auto rounded-xl border border-equine-line bg-white px-2 py-3">
        <svg
          viewBox={"0 0 " + width + " " + chart.height}
          className="block h-[220px] w-full"
          style={{ minWidth: Math.max(620, width) }}
          role="img"
          aria-label="Biểu đồ cột so sánh mục tiêu, lịch tập và thời lượng thực hiện theo từng tuần"
        >
          <desc>So sánh khối lượng mục tiêu, đã lên lịch và thực hiện trong mỗi tuần của khoảng báo cáo.</desc>
          {ticks.map((tick, index) => {
            const tickY = y(tick);
            return (
              <g key={index}>
                <line x1={chart.left} x2={width - 8} y1={tickY} y2={tickY} stroke="#e5e7eb" />
                <text x={chart.left - 7} y={tickY + 4} textAnchor="end" fill="#64748b" fontSize="10">{numberLabel(tick)}</text>
              </g>
            );
          })}
          {weeks.map((week, index) => {
            const center = chart.left + index * chart.groupWidth + chart.groupWidth / 2;
            const firstX = center - (barWidth * 3 + 6) / 2;
            return (
              <g key={week.week_start}>
                {series.map((item, seriesIndex) => {
                  const amount = week[item.key] ?? 0;
                  const barHeight = amount > 0 ? Math.max(1, chart.bottom - y(amount)) : 0;
                  const x = firstX + seriesIndex * (barWidth + 3);
                  return (
                    <rect key={item.key} x={x} y={chart.bottom - barHeight} width={barWidth} height={barHeight} rx="2" fill={item.color}>
                      <title>{week.week_start + " · " + item.label + ": " + numberLabel(amount) + " phút"}</title>
                    </rect>
                  );
                })}
                <text x={center} y={chart.bottom + 18} textAnchor="middle" fill="#64748b" fontSize="9">{shortDate(week.week_start)}</text>
              </g>
            );
          })}
        </svg>
      </div>
    </div>
  );
}

function TrialRunCharts({ runs }: { runs: TrainingAnalysis["trial_runs"] }) {
  const completed = runs.filter((run) => run.effective_status === "Completed");
  const speedPoints = completed.flatMap((run) =>
    typeof run.avg_speed_kmh === "number" && Number.isFinite(run.avg_speed_kmh)
      ? [{ recorded_at: run.event_date, value: run.avg_speed_kmh }]
      : [],
  );
  const recoveryPoints = completed.flatMap((run) =>
    typeof run.recovery_heart_rate === "number" && Number.isFinite(run.recovery_heart_rate)
      ? [{ recorded_at: run.event_date, value: run.recovery_heart_rate }]
      : [],
  );
  if (speedPoints.length === 0 && recoveryPoints.length === 0) return null;
  return (
    <div className="mt-4 grid gap-4 lg:grid-cols-2">
      {speedPoints.length > 0 && <TrendChart title="Tốc độ trung bình khi chạy thử" unit="km/h" color="#287765" points={speedPoints} />}
      {recoveryPoints.length > 0 && <TrendChart title="Nhịp tim hồi phục sau chạy thử" unit="bpm" color="#c56545" points={recoveryPoints} />}
    </div>
  );
}

type TrendPoint = { recorded_at: string; value: number };

function TrendChart({ title, unit, color, points: sourcePoints }: { title: string; unit: string; color: string; points: TrendPoint[] }) {
  const points = sourcePoints
    .filter((point) => Number.isFinite(point.value) && Number.isFinite(new Date(point.recorded_at).getTime()))
    .slice()
    .sort((left, right) => new Date(left.recorded_at).getTime() - new Date(right.recorded_at).getTime());
  if (points.length === 0) return null;

  const values = points.map((point) => point.value);
  const low = Math.min(...values);
  const high = Math.max(...values);
  const padding = Math.max((high - low) * 0.18, Math.abs(high) * 0.04, 0.5);
  const domainMin = low - padding;
  const domainMax = high + padding;
  const chart = { left: 48, right: 12, top: 20, bottom: 144, width: 620, height: 190 };
  const x = (index: number) => points.length === 1 ? (chart.left + chart.width - chart.right) / 2 : chart.left + index / (points.length - 1) * (chart.width - chart.left - chart.right);
  const y = (amount: number) => chart.bottom - (amount - domainMin) / (domainMax - domainMin) * (chart.bottom - chart.top);
  const line = points.map((point, index) => (index === 0 ? "M" : "L") + x(index) + " " + y(point.value)).join(" ");
  const latest = points[points.length - 1];
  const first = points[0];
  const change = latest.value - first.value;

  return (
    <article className="rounded-xl border border-equine-line p-3">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <h4 className="text-sm font-semibold text-equine-navy">{title}</h4>
        <p className="text-right text-sm font-semibold text-equine-navy">{numberLabel(latest.value)} {unit}</p>
      </div>
      <svg
        viewBox={"0 0 " + chart.width + " " + chart.height}
        role="img"
        aria-label={title + " theo thời gian"}
        className="mt-2 block h-[190px] w-full"
      >
        {[0, 1, 2].map((index) => {
          const amount = domainMax - (domainMax - domainMin) * index / 2;
          const tickY = y(amount);
          return (
            <g key={index}>
              <line x1={chart.left} x2={chart.width - chart.right} y1={tickY} y2={tickY} stroke="#e5e7eb" />
              <text x={chart.left - 7} y={tickY + 4} textAnchor="end" fill="#64748b" fontSize="10">{numberLabel(amount)}</text>
            </g>
          );
        })}
        <path d={line} fill="none" stroke={color} strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" />
        {points.map((point, index) => (
          <circle key={point.recorded_at + "-" + index} cx={x(index)} cy={y(point.value)} r="4" fill={color}>
            <title>{metricDate(point.recorded_at) + " · " + numberLabel(point.value) + " " + unit}</title>
          </circle>
        ))}
        <text x={chart.left} y={chart.height - 6} fill="#64748b" fontSize="10">{shortDate(first.recorded_at)}</text>
        <text x={chart.width - chart.right} y={chart.height - 6} textAnchor="end" fill="#64748b" fontSize="10">{shortDate(latest.recorded_at)}</text>
      </svg>
      <p className="mt-1 text-xs text-slate-500">
        {points.length} lần chạy · thay đổi từ lần đầu: {change > 0 ? "+" : ""}{numberLabel(change)} {unit}
      </p>
    </article>
  );
}

type DevelopmentKey = "body_weight_kg" | "avg_speed_kmh" | "stamina_score" | "max_heart_rate";
const developmentMeasures: { key: DevelopmentKey; title: string; unit: string; color: string }[] = [
  { key: "body_weight_kg", title: "Cân nặng", unit: "kg", color: "#b87936" },
  { key: "avg_speed_kmh", title: "Tốc độ trung bình", unit: "km/h", color: "#287765" },
  { key: "stamina_score", title: "Điểm thể lực", unit: "/10", color: "#5475a8" },
  { key: "max_heart_rate", title: "Nhịp tim tối đa", unit: "bpm", color: "#c56545" },
];

function HorseDevelopment({
  metrics,
  includeSimulated,
  setIncludeSimulated,
  loading,
}: {
  metrics: TrainingMetric[];
  includeSimulated: boolean;
  setIncludeSimulated: (include: boolean) => void;
  loading: boolean;
}) {
  const ordered = metrics
    .slice()
    .sort((left, right) => new Date(left.recorded_at).getTime() - new Date(right.recorded_at).getTime());
  const latest = ordered[ordered.length - 1];
  const alertCount = ordered.filter((metric) => metric.has_injury_alert).length;
  const latestReview = ordered.slice().reverse().find((metric) => metric.trainer_review?.trim())?.trainer_review;

  return (
    <section className="rounded-2xl border border-equine-line bg-white p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="font-semibold text-equine-navy">Sự phát triển của ngựa</h3>
          <p className="mt-2 text-sm text-slate-500">
            Theo dõi thay đổi cân nặng, tốc độ, thể lực và nhịp tim qua các lần ghi nhận trong khoảng ngày đã chọn.
          </p>
        </div>
        <label className="inline-flex items-center gap-2 text-sm text-slate-600">
          <input type="checkbox" checked={includeSimulated} onChange={(event) => setIncludeSimulated(event.target.checked)} />
          Gồm dữ liệu mô phỏng
        </label>
      </div>
      {loading && <p className="mt-4 text-sm text-slate-500">Đang tải lịch sử chỉ số…</p>}
      {!loading && ordered.length === 0 && (
        <p className="mt-4 rounded-xl border border-dashed border-equine-line p-5 text-center text-sm text-slate-500">
          Chưa có chỉ số phát triển trong khoảng ngày này. Có thể mở rộng khoảng ngày hoặc ghi chỉ số sau buổi tập.
        </p>
      )}
      {ordered.length > 0 && (
        <>
          <div className="mt-4 grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
            <DevelopmentStat label="Lần ghi nhận" value={String(ordered.length)} detail={metricDate(ordered[0].recorded_at) + " → " + metricDate(latest?.recorded_at)} />
            <DevelopmentStat label="Cân nặng gần nhất" value={value(latest?.body_weight_kg, " kg")} detail={latest ? metricDate(latest.recorded_at) : ""} />
            <DevelopmentStat label="Điểm thể lực gần nhất" value={value(latest?.stamina_score, " / 10")} detail={latest ? metricDate(latest.recorded_at) : ""} />
            <DevelopmentStat label="Lần đo có cảnh báo" value={String(alertCount)} detail={alertCount > 0 ? "Cần xem lại các lần ghi nhận được đánh dấu" : "Không có cảnh báo trong khoảng này"} warning={alertCount > 0} />
          </div>
          <div className="mt-4 grid gap-4 lg:grid-cols-2">
            {developmentMeasures.map((measure) => {
              const points = ordered.flatMap((metric) => {
                const amount = metric[measure.key];
                return typeof amount === "number" && Number.isFinite(amount)
                  ? [{ recorded_at: metric.recorded_at, value: amount }]
                  : [];
              });
              return (
                <div key={measure.key}>
                  {points.length > 0 ? (
                    <TrendChart title={measure.title} unit={measure.unit} color={measure.color} points={points} />
                  ) : (
                    <div className="rounded-xl border border-dashed border-equine-line p-4 text-sm text-slate-500">{measure.title}: chưa có lần đo.</div>
                  )}
                </div>
              );
            })}
          </div>
          {latestReview && (
            <p className="mt-4 rounded-xl bg-slate-50 p-3 text-sm text-slate-600">
              Nhận xét gần nhất của HLV: <span className="text-equine-navy">{latestReview}</span>
            </p>
          )}
          <div className="mt-5 overflow-x-auto">
            <h4 className="mb-2 text-sm font-semibold text-equine-navy">Chi tiết từng lần ghi nhận</h4>
            <table className="w-full min-w-[800px] text-left text-sm">
              <thead>
                <tr>
                  <th>Thời điểm</th><th>Cân nặng</th><th>Tốc độ TB</th><th>Thể lực</th><th>Nhịp tim tối đa</th><th>Huyết áp</th><th>Ghi chú</th>
                </tr>
              </thead>
              <tbody>
                {ordered.slice().reverse().slice(0, 24).map((metric, index) => (
                  <tr key={metric.id ?? metric.recorded_at + "-" + index} className="border-t border-equine-line">
                    <td className="py-3 whitespace-nowrap">{metricDate(metric.recorded_at)}{metric.is_simulated && <small className="ml-1 text-violet-700">· Mô phỏng</small>}</td>
                    <td>{value(metric.body_weight_kg, " kg")}</td>
                    <td>{value(metric.avg_speed_kmh, " km/h")}</td>
                    <td>{value(metric.stamina_score, " / 10")}</td>
                    <td>{value(metric.max_heart_rate, " bpm")}</td>
                    <td>{metric.bp_systolic == null && metric.bp_diastolic == null ? "—" : String(metric.bp_systolic ?? "—") + "/" + String(metric.bp_diastolic ?? "—") + " mmHg"}</td>
                    <td>
                      {metric.has_injury_alert ? <span className="text-rose-700">Cảnh báo sức khỏe</span> : "—"}
                      {metric.trainer_review && <p className="mt-1 max-w-xs whitespace-normal text-xs text-slate-500">{metric.trainer_review}</p>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {ordered.length > 24 && <p className="mt-2 text-xs text-slate-500">Đang hiển thị 24 lần gần nhất trong tổng số {ordered.length} lần đo.</p>}
          </div>
        </>
      )}
    </section>
  );
}

function DevelopmentStat({ label, value: amount, detail, warning = false }: { label: string; value: string; detail: string; warning?: boolean }) {
  return (
    <article className={"rounded-xl border p-3 " + (warning ? "border-rose-200 bg-rose-50" : "border-equine-line bg-slate-50")}>
      <p className="text-xs text-slate-500">{label}</p>
      <p className={"mt-1 text-lg font-semibold " + (warning ? "text-rose-800" : "text-equine-navy")}>{amount}</p>
      <p className="mt-1 text-xs text-slate-500">{detail}</p>
    </article>
  );
}
