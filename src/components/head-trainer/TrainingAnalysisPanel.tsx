"use client";

import { useEffect, useId, useRef, useState, type FormEvent } from "react";
import {
  Activity,
  AlertTriangle,
  ArrowDownRight,
  ArrowRight,
  ArrowUpRight,
  CheckCircle2,
  Clock,
  Flame,
  Gauge,
  HeartPulse,
  Minus,
  Scale,
  Sparkles,
  Target,
} from "lucide-react";
import {
  headTrainerApi,
  headTrainerError,
  type Simulation,
  type TrainingAnalysis,
  type TrainingMetric,
} from "@/api/head-trainer/api";
import SensorTimeline from "./SensorTimeline";

const adviceLabel: Record<string, { text: string; tone: "emerald" | "amber" | "rose" | "slate" }> = {
  AWAIT_RESULTS: { text: "Chờ kết quả buổi tập", tone: "slate" },
  REVIEW_INTERRUPTION: { text: "Bị gián đoạn — kiểm tra trước buổi kế tiếp", tone: "amber" },
  REVIEW_WITH_VET: { text: "Cảnh báo y tế — hội chẩn Bác sĩ thú y", tone: "rose" },
  REVIEW_SHORTFALL: { text: "Chưa đạt cự ly mục tiêu (< 90%)", tone: "amber" },
  REVIEW_EXCESS: { text: "Vượt cự ly mục tiêu (> 110%) — lưu ý quá tải", tone: "amber" },
  TARGET_MET: { text: "Đạt mục tiêu — duy trì tải hiện tại", tone: "emerald" },
};

const statuses: Record<string, string> = {
  Scheduled: "Đã lên lịch",
  InProgress: "Đang tập",
  Completed: "Hoàn thành",
  Cancelled: "Đã hủy",
  Missed: "Bỏ lỡ",
  Blocked: "Khóa y tế",
};

function formatVal(number?: number | null, suffix = "", digits = 1) {
  return number == null || !Number.isFinite(Number(number))
    ? "—"
    : Number(number).toFixed(digits) + suffix;
}

function formatSigned(number?: number | null, suffix = "", digits = 1) {
  if (number == null || !Number.isFinite(Number(number))) return "0" + suffix;
  const n = Number(number);
  const sign = n > 0 ? "+" : "";
  return `${sign}${n.toFixed(digits)}${suffix}`;
}

function metricDate(date?: string | null) {
  if (!date) return "—";
  const parsed = new Date(date);
  return Number.isNaN(parsed.getTime())
    ? date
    : parsed.toLocaleString("vi-VN", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
}

function shortDate(date?: string | null) {
  if (!date) return "—";
  const parsed = new Date(date);
  return Number.isNaN(parsed.getTime())
    ? date.slice(5)
    : parsed.toLocaleDateString("vi-VN", { day: "2-digit", month: "2-digit" });
}

function numberLabel(number: number, digits = 1) {
  return new Intl.NumberFormat("vi-VN", { maximumFractionDigits: digits }).format(number);
}

function isoDateDaysAgo(days: number) {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d.toISOString().slice(0, 10);
}

type Week = TrainingAnalysis["weeks"][number];
type TrainingSessionAnalysis = TrainingAnalysis["sessions"][number];

type DevelopmentKey = "avg_speed_kmh" | "stamina_score" | "max_heart_rate" | "body_weight_kg";

const developmentMeasures: {
  key: DevelopmentKey;
  title: string;
  shortTitle: string;
  unit: string;
  color: string;
  bgSoft: string;
  higherIsBetter: boolean | null;
  icon: typeof Gauge;
}[] = [
  {
    key: "avg_speed_kmh",
    title: "Tốc độ trung bình",
    shortTitle: "Tốc độ TB",
    unit: "km/h",
    color: "#0284C7",
    bgSoft: "bg-sky-50 border-sky-200 text-sky-900",
    higherIsBetter: true,
    icon: Gauge,
  },
  {
    key: "stamina_score",
    title: "Điểm thể lực & bền bỉ",
    shortTitle: "Thể lực",
    unit: "/10",
    color: "#059669",
    bgSoft: "bg-emerald-50 border-emerald-200 text-emerald-900",
    higherIsBetter: true,
    icon: Flame,
  },
  {
    key: "max_heart_rate",
    title: "Nhịp tim tối đa",
    shortTitle: "Nhịp tim đỉnh",
    unit: "bpm",
    color: "#E11D48",
    bgSoft: "bg-rose-50 border-rose-200 text-rose-900",
    higherIsBetter: false,
    icon: HeartPulse,
  },
  {
    key: "body_weight_kg",
    title: "Cân nặng thể trạng",
    shortTitle: "Cân nặng",
    unit: "kg",
    color: "#4F46E5",
    bgSoft: "bg-indigo-50 border-indigo-200 text-indigo-900",
    higherIsBetter: null,
    icon: Scale,
  },
];

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
  const [reviewPage, setReviewPage] = useState(1);
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

  useEffect(() => {
    setReviewPage(1);
  }, [horseId, from, to, revision, localRevision]);

  const reviewPageSize = 4;
  const reviewSessions = (report?.sessions ?? []).slice().sort((left, right) => {
    const leftTime = Date.parse(`${left.event_date}T${left.start_time?.slice(0, 5) || "00:00"}:00`);
    const rightTime = Date.parse(`${right.event_date}T${right.start_time?.slice(0, 5) || "00:00"}:00`);
    return rightTime - leftTime;
  });
  const reviewTotalPages = Math.max(1, Math.ceil(reviewSessions.length / reviewPageSize));
  const visibleReviewSessions = reviewSessions.slice(
    (reviewPage - 1) * reviewPageSize,
    reviewPage * reviewPageSize,
  );

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
      {/* THANH ĐIỀU KHIỂN KHOẢNG NGÀY & TÓM TẮT NHANH */}
      <section className="rounded-xl border border-equine-line bg-white p-4 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-equine-navy text-white">
              <Activity size={18} />
            </span>
            <div>
              <h3 className="text-base font-bold text-equine-navy">Báo cáo Phân tích & Biến chuyển Thể lực</h3>
              <p className="text-xs text-slate-500">
                So sánh trực tiếp chỉ số <strong>Đầu kỳ → Hiện tại</strong> và mức hoàn thành cự ly từng buổi tập
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div className="inline-flex rounded-lg border border-slate-200 bg-slate-50 p-0.5 text-xs font-semibold">
              {[
                { label: "7 ngày", days: 7 },
                { label: "30 ngày", days: 30 },
                { label: "90 ngày", days: 90 },
              ].map((preset) => {
                const targetFrom = isoDateDaysAgo(preset.days);
                const active = from === targetFrom;
                return (
                  <button
                    key={preset.days}
                    type="button"
                    onClick={() => {
                      setFrom(targetFrom);
                      setTo(isoDateDaysAgo(0));
                    }}
                    className={`rounded-md px-2.5 py-1 transition ${
                      active ? "bg-equine-navy text-white shadow-sm" : "text-slate-600 hover:text-slate-900"
                    }`}
                  >
                    {preset.label}
                  </button>
                );
              })}
            </div>

            <div className="flex items-center gap-1.5 text-xs">
              <input
                type="date"
                aria-label="Từ ngày"
                className="field-control h-8 px-2.5 text-xs"
                value={from}
                onChange={(event) => setFrom(event.target.value)}
              />
              <span className="text-slate-400">→</span>
              <input
                type="date"
                aria-label="Đến ngày"
                className="field-control h-8 px-2.5 text-xs"
                value={to}
                onChange={(event) => setTo(event.target.value)}
              />
            </div>

            <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-xs font-medium text-slate-700">
              <input
                type="checkbox"
                checked={includeSimulated}
                onChange={(event) => setIncludeSimulated(event.target.checked)}
              />
              Gồm mô phỏng
            </label>
          </div>
        </div>

        {error && (
          <p role="alert" className="mt-3 rounded-lg bg-rose-50 px-3 py-2 text-xs font-medium text-rose-700">
            {error}
          </p>
        )}
        {loading && <p className="mt-3 text-xs text-slate-500">Đang tổng hợp dữ liệu phân tích…</p>}
        {!horseId && <p className="mt-3 text-xs text-slate-500">Chọn một ngựa ở trên để xem phân tích.</p>}
      </section>

      {/* KHỐI 1: SỰ PHÁT TRIỂN CỦA NGỰA (SO SÁNH ĐẦU KỲ -> HIỆN TẠI & BIỂU ĐỒ BIẾN ĐỘNG) */}
      <HorseDevelopment metrics={metrics} loading={loading} />

      {/* KHỐI 2: TIẾN ĐỘ KHỐI LƯỢNG TUẦN & BIỂU ĐỒ CỰ LY TỪNG BUỔI */}
      {report && (
        <section className="rounded-xl border border-blue-200 bg-white p-5 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <Target size={18} className="text-blue-700" />
              <h3 className="font-bold text-equine-navy">Tiến độ Giáo án & Cự ly Thực hiện</h3>
            </div>
            <span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-800">
              {report.sessions.length} buổi tập trong kỳ
            </span>
          </div>

          <WorkloadSummary weeks={report.weeks} sessions={report.sessions} />
          <RecentTrainingSessionsChart sessions={report.sessions} />

          {report.trial_runs.length > 0 && (
            <div className="mt-6 border-t border-slate-100 pt-5">
              <div className="mb-3 flex items-center justify-between">
                <h4 className="text-sm font-bold text-violet-950">So sánh các lượt Chạy thử (Trial Run)</h4>
                <span className="text-xs text-slate-500">{report.trial_runs.length} lượt</span>
              </div>
              <TrialRunCharts runs={report.trial_runs} />
            </div>
          )}
        </section>
      )}

      {/* KHỐI 3: ĐÁNH GIÁ TỪNG BUỔI TẬP & NHẬN XÉT CỦA HLV */}
      {report && (
        <section className="rounded-xl border border-equine-line bg-white p-5 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h3 className="font-bold text-equine-navy">Nhật ký & Đánh giá từng buổi tập</h3>
              <p className="text-xs text-slate-500">
                Xem mức đạt cự ly, chuỗi cảm biến và lưu quyết định điều chỉnh cho buổi kế tiếp
              </p>
            </div>
            {reviewSessions.length > 0 && (
              <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-700">
                Trang {reviewPage}/{reviewTotalPages} · {reviewSessions.length} buổi
              </span>
            )}
          </div>

          <div className="mt-4 grid gap-3 lg:grid-cols-2">
            {visibleReviewSessions.map((session) => {
              const rec = adviceLabel[session.recommendation] ?? {
                text: session.recommendation,
                tone: "slate" as const,
              };
              const pct = session.distance_achievement_percent;
              return (
                <article
                  key={session.id}
                  className={`flex flex-col justify-between rounded-xl border-l-4 bg-slate-50/60 p-4 ring-1 ring-slate-200/80 ${sessionStatusCardClass(
                    session.effective_status,
                  )}`}
                >
                  <div>
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <strong className="text-sm text-slate-950">
                          {shortDate(session.event_date)} · {session.start_time?.slice(0, 5)}
                        </strong>
                        <span className="rounded-md bg-white px-2 py-0.5 text-xs font-semibold text-slate-700 ring-1 ring-slate-200">
                          {sessionTypeLabel(session.session_type)}
                        </span>
                      </div>
                      <span
                        className={`rounded-full px-2.5 py-0.5 text-xs font-bold ${sessionStatusBadgeClass(
                          session.effective_status,
                        )}`}
                      >
                        {statuses[session.effective_status] ?? session.effective_status}
                      </span>
                    </div>

                    <p className="mt-1.5 truncate text-xs text-slate-500">
                      {session.snapshot_stage_name ?? "Chưa gắn giáo án"} · Sân {session.track_surface ?? "—"} · Groom:{" "}
                      <strong className="text-slate-700">{session.groom_name ?? "Chưa phân công"}</strong>
                    </p>

                    {/* THANH SO SÁNH CỰ LY TRỰC QUAN */}
                    <div className="mt-3 rounded-lg bg-white p-3 ring-1 ring-slate-200/70">
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-slate-500">
                          Cự ly: <strong className="text-slate-900">{formatVal(session.actual_distance_meters, "m", 0)}</strong> /{" "}
                          {formatVal(session.target_distance_meters, "m", 0)}
                        </span>
                        <span
                          className={`font-bold ${
                            pct == null
                              ? "text-slate-400"
                              : pct >= 90 && pct <= 110
                                ? "text-emerald-700"
                                : "text-amber-700"
                          }`}
                        >
                          {pct == null ? "Chưa đo" : `Đạt ${numberLabel(pct, 0)}%`}
                        </span>
                      </div>
                      <div className="mt-1.5 h-2 w-full overflow-hidden rounded-full bg-slate-100">
                        <div
                          className={`h-full rounded-full transition-all ${
                            pct == null
                              ? "w-0"
                              : pct >= 90 && pct <= 110
                                ? "bg-emerald-500"
                                : pct < 90
                                  ? "bg-amber-500"
                                  : "bg-rose-500"
                          }`}
                          style={{ width: `${Math.min(100, Math.max(0, pct ?? 0))}%` }}
                        />
                      </div>

                      <div className="mt-2.5 grid grid-cols-3 gap-2 border-t border-slate-100 pt-2 text-center text-xs">
                        <div>
                          <span className="block text-[10px] text-slate-400">Tốc độ TB</span>
                          <strong className="text-slate-800">{formatVal(session.avg_speed_kmh, " km/h")}</strong>
                        </div>
                        <div>
                          <span className="block text-[10px] text-slate-400">Nhịp tim đỉnh</span>
                          <strong className="text-slate-800">{formatVal(session.max_heart_rate, " bpm", 0)}</strong>
                        </div>
                        <div>
                          <span className="block text-[10px] text-slate-400">Điểm thể lực</span>
                          <strong className="text-slate-800">{formatVal(session.estimated_stamina_score, "/10")}</strong>
                        </div>
                      </div>
                    </div>

                    {session.stop_reason && (
                      <p className="mt-2 text-xs font-medium text-rose-700">Lý do dừng: {session.stop_reason}</p>
                    )}

                    <div className="mt-2.5 flex flex-wrap items-center justify-between gap-2">
                      <span
                        className={`inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-semibold ${
                          rec.tone === "emerald"
                            ? "bg-emerald-50 text-emerald-800"
                            : rec.tone === "rose"
                              ? "bg-rose-50 text-rose-800"
                              : rec.tone === "amber"
                                ? "bg-amber-50 text-amber-800"
                                : "bg-slate-100 text-slate-600"
                        }`}
                      >
                        {session.session_type === "Rest" ? "Buổi nghỉ hồi phục" : rec.text}
                      </span>

                      <div className="flex flex-wrap gap-1.5">
                        {session.simulation_attempts?.map((attempt, index) => (
                          <button
                            key={attempt.id}
                            className="soft-button h-7 px-2.5 text-xs"
                            type="button"
                            onClick={() => void showReadings(attempt.id)}
                          >
                            Cảm biến #{index + 1}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>

                  {["Completed", "Cancelled", "Missed", "Blocked"].includes(session.effective_status) && (
                    <form
                      onSubmit={(event) => void review(event, session.id)}
                      className="mt-3 flex gap-2 border-t border-slate-200/80 pt-3"
                    >
                      <input
                        name="trainer_review"
                        aria-label="Nhận xét Head Trainer"
                        className="field-control h-9 flex-1 bg-white px-3 text-xs"
                        defaultValue={session.trainer_review ?? ""}
                        placeholder="Ghi nhận xét / điều chỉnh cho buổi kế tiếp..."
                        maxLength={4000}
                      />
                      <button disabled={saving} className="gold-button h-9 px-3 text-xs">
                        Lưu
                      </button>
                    </form>
                  )}
                </article>
              );
            })}
          </div>

          {reviewTotalPages > 1 && (
            <nav
              className="mt-4 flex flex-wrap items-center justify-center gap-1.5"
              aria-label="Phân trang đánh giá buổi tập"
            >
              <button
                type="button"
                className="soft-button min-w-8 justify-center px-2.5 py-1 text-xs"
                onClick={() => setReviewPage((page) => Math.max(1, page - 1))}
                disabled={reviewPage === 1}
              >
                ‹ Trước
              </button>
              {Array.from({ length: reviewTotalPages }, (_, index) => index + 1).map((page) => (
                <button
                  key={page}
                  type="button"
                  className={
                    page === reviewPage
                      ? "gold-button min-w-8 justify-center px-2.5 py-1 text-xs"
                      : "soft-button min-w-8 justify-center px-2.5 py-1 text-xs"
                  }
                  onClick={() => setReviewPage(page)}
                >
                  {page}
                </button>
              ))}
              <button
                type="button"
                className="soft-button min-w-8 justify-center px-2.5 py-1 text-xs"
                onClick={() => setReviewPage((page) => Math.min(reviewTotalPages, page + 1))}
                disabled={reviewPage === reviewTotalPages}
              >
                Sau ›
              </button>
            </nav>
          )}

          {report.sessions.length === 0 && (
            <p className="mt-3 text-center text-sm text-slate-500">Chưa có buổi tập trong khoảng ngày này.</p>
          )}
        </section>
      )}

      {detail && (
        <section className="rounded-xl border border-equine-line bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <h3 className="font-bold text-equine-navy">
              Chuỗi cảm biến theo giây · {detail.horses[0]?.horse_name}
            </h3>
            <button
              type="button"
              className="soft-button"
              onClick={() => {
                ++detailRequestRef.current;
                setDetail(null);
              }}
            >
              Đóng
            </button>
          </div>
          <SensorTimeline readings={detail.readings ?? []} />
        </section>
      )}
    </div>
  );
}

function sessionStatusCardClass(status: string) {
  if (status === "Completed") return "border-emerald-500";
  if (status === "InProgress") return "border-cyan-500";
  if (status === "Blocked") return "border-rose-500";
  if (status === "Cancelled" || status === "Missed") return "border-amber-400";
  return "border-blue-400";
}

function sessionStatusBadgeClass(status: string) {
  if (status === "Completed") return "bg-emerald-100 text-emerald-800";
  if (status === "InProgress") return "bg-cyan-100 text-cyan-800";
  if (status === "Blocked") return "bg-rose-100 text-rose-800";
  if (status === "Cancelled" || status === "Missed") return "bg-amber-100 text-amber-800";
  return "bg-blue-100 text-blue-800";
}

function sessionTypeLabel(value: string) {
  return ({ Training: "Huấn luyện", TrialRun: "Chạy thử", Rest: "Nghỉ" } as Record<string, string>)[value] ?? value;
}

function WorkloadSummary({ weeks, sessions }: { weeks: Week[]; sessions: TrainingSessionAnalysis[] }) {
  const totals = weeks.reduce(
    (result, week) => ({
      target: result.target + (week.target_minutes ?? 0),
      planned: result.planned + (week.planned_minutes ?? 0),
      actual: result.actual + (week.actual_minutes ?? 0),
    }),
    { target: 0, planned: 0, actual: 0 },
  );
  const completedCount = sessions.filter((s) => s.effective_status === "Completed").length;
  const totalActiveSessions = sessions.filter((s) => s.session_type !== "Rest" && s.effective_status !== "Cancelled").length;
  const achievement = totals.target > 0 ? (totals.actual / totals.target) * 100 : null;
  const plannedPct = totals.target > 0 ? Math.min(100, (totals.planned / totals.target) * 100) : 0;
  const actualPct = totals.target > 0 ? Math.min(100, (totals.actual / totals.target) * 100) : 0;

  return (
    <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50/80 p-4">
      <div className="grid gap-3 sm:grid-cols-4">
        <div className="rounded-lg bg-white p-3 ring-1 ring-slate-200/70">
          <span className="flex items-center gap-1.5 text-xs text-slate-500">
            <Target size={14} className="text-slate-500" /> Mục tiêu giáo án
          </span>
          <strong className="mt-1 block text-lg font-extrabold text-equine-navy">
            {numberLabel(totals.target, 0)} phút
          </strong>
        </div>
        <div className="rounded-lg bg-white p-3 ring-1 ring-slate-200/70">
          <span className="flex items-center gap-1.5 text-xs text-slate-500">
            <Clock size={14} className="text-sky-600" /> Đã lên lịch
          </span>
          <strong className="mt-1 block text-lg font-extrabold text-sky-700">
            {numberLabel(totals.planned, 0)} phút
          </strong>
        </div>
        <div className="rounded-lg bg-white p-3 ring-1 ring-slate-200/70">
          <span className="flex items-center gap-1.5 text-xs text-slate-500">
            <CheckCircle2 size={14} className="text-emerald-600" /> Thực tế đã tập
          </span>
          <strong className="mt-1 block text-lg font-extrabold text-emerald-700">
            {numberLabel(totals.actual, 1)} phút
          </strong>
        </div>
        <div className="rounded-lg bg-white p-3 ring-1 ring-slate-200/70">
          <span className="text-xs text-slate-500">Buổi hoàn thành</span>
          <strong className="mt-1 block text-lg font-extrabold text-equine-navy">
            {completedCount}/{totalActiveSessions} buổi
          </strong>
        </div>
      </div>

      {/* Thanh so sánh trực quan Mục tiêu vs Lên lịch vs Thực hiện */}
      <div className="mt-3 space-y-1.5">
        <div className="flex items-center justify-between text-xs">
          <span className="font-medium text-slate-600">Tỷ lệ hoàn thành khối lượng giáo án</span>
          <strong className="text-equine-navy">
            {achievement == null ? "Chưa có mục tiêu" : `${numberLabel(achievement, 1)}%`}
          </strong>
        </div>
        <div className="relative h-3 w-full overflow-hidden rounded-full bg-slate-200">
          <div
            className="absolute inset-y-0 left-0 rounded-full bg-sky-300/70 transition-all"
            style={{ width: `${plannedPct}%` }}
            title={`Đã xếp lịch: ${numberLabel(totals.planned, 0)} phút`}
          />
          <div
            className="absolute inset-y-0 left-0 rounded-full bg-emerald-600 transition-all"
            style={{ width: `${actualPct}%` }}
            title={`Thực tế: ${numberLabel(totals.actual, 1)} phút`}
          />
        </div>
        <div className="flex flex-wrap gap-4 text-[11px] text-slate-500">
          <span className="inline-flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full bg-emerald-600" /> Thực tế đã tập
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full bg-sky-300" /> Đã xếp lịch
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full bg-slate-200" /> Mục tiêu toàn kỳ (100%)
          </span>
        </div>
      </div>
    </div>
  );
}

function RecentTrainingSessionsChart({ sessions }: { sessions: TrainingSessionAnalysis[] }) {
  const recentSessions = sessions
    .filter((session) => session.session_type !== "Rest" && Number.isFinite(new Date(`${session.event_date}T${session.start_time ?? "00:00"}`).getTime()))
    .slice()
    .sort((left, right) => {
      const leftTime = new Date(`${left.event_date}T${left.start_time ?? "00:00"}`).getTime();
      const rightTime = new Date(`${right.event_date}T${right.start_time ?? "00:00"}`).getTime();
      return rightTime - leftTime;
    })
    .slice(0, 10)
    .reverse();

  if (recentSessions.length === 0) {
    return (
      <p className="mt-4 rounded-xl border border-dashed border-equine-line p-5 text-center text-sm text-slate-500">
        Chưa có buổi tập vận động trong khoảng ngày này.
      </p>
    );
  }

  const chart = { left: 54, top: 32, bottom: 182, height: 224, groupWidth: 88, right: 20 };
  const width = Math.max(660, chart.left + recentSessions.length * chart.groupWidth + chart.right);
  const effectiveGroupWidth = (width - chart.left - chart.right) / recentSessions.length;
  const maximum = Math.max(
    100,
    ...recentSessions.flatMap((s) => [s.target_distance_meters ?? 0, s.actual_distance_meters ?? 0]),
  );
  const y = (amount: number) => chart.bottom - (amount / maximum) * (chart.bottom - chart.top);
  const ticks = [maximum, Math.round(maximum / 2), 0];
  const barWidth = 22;

  return (
    <div className="mt-5">
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2 text-xs">
        <span className="font-bold text-slate-700">
          So sánh Cự ly Mục tiêu vs Thực hiện (10 buổi gần nhất)
        </span>
        <div className="flex flex-wrap items-center gap-4 text-slate-600">
          <span className="inline-flex items-center gap-1.5">
            <span className="h-3 w-3 rounded-sm bg-slate-300" /> Mục tiêu (m)
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="h-3 w-3 rounded-sm bg-emerald-600" /> Đạt mục tiêu (≥90%)
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="h-3 w-3 rounded-sm bg-amber-500" /> Chưa đạt (&lt;90%)
          </span>
        </div>
      </div>

      <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white p-3">
        <svg
          viewBox={`0 0 ${width} ${chart.height}`}
          className="block h-[224px] w-full"
          style={{ minWidth: 620 }}
          role="img"
          aria-label="Cự ly mục tiêu và cự ly thực hiện của 10 buổi tập gần nhất"
        >
          {ticks.map((tick, index) => {
            const tickY = y(tick);
            return (
              <g key={index}>
                <line x1={chart.left} x2={width - chart.right} y1={tickY} y2={tickY} stroke="#F1F5F9" strokeDasharray={index === 2 ? undefined : "4 4"} />
                <text x={chart.left - 8} y={tickY + 4} textAnchor="end" fill="#64748B" fontSize="10" fontWeight="600">
                  {numberLabel(tick, 0)}m
                </text>
              </g>
            );
          })}

          {recentSessions.map((session, index) => {
            const center = chart.left + index * effectiveGroupWidth + effectiveGroupWidth / 2;
            const target = session.target_distance_meters ?? 0;
            const actual = session.actual_distance_meters ?? 0;
            const pct = session.distance_achievement_percent;
            const targetH = target > 0 ? Math.max(2, chart.bottom - y(target)) : 0;
            const actualH = actual > 0 ? Math.max(2, chart.bottom - y(actual)) : 0;
            const actualColor =
              actual <= 0
                ? "#CBD5E1"
                : pct != null && pct < 90
                  ? "#F59E0B"
                  : pct != null && pct > 115
                    ? "#E11D48"
                    : "#059669";

            return (
              <g key={session.id}>
                {/* Cột Mục tiêu */}
                <rect
                  x={center - barWidth - 2}
                  y={chart.bottom - targetH}
                  width={barWidth}
                  height={targetH}
                  rx="4"
                  fill="#CBD5E1"
                >
                  <title>{`${session.event_date} · Mục tiêu: ${numberLabel(target, 0)} m`}</title>
                </rect>

                {/* Cột Thực hiện */}
                <rect
                  x={center + 2}
                  y={chart.bottom - actualH}
                  width={barWidth}
                  height={actualH}
                  rx="4"
                  fill={actualColor}
                >
                  <title>{`${session.event_date} · Thực hiện: ${numberLabel(actual, 0)} m (${pct == null ? "Chưa chạy" : numberLabel(pct, 0) + "%"})`}</title>
                </rect>

                {/* Nhãn số liệu trực tiếp trên đỉnh cột */}
                {actual > 0 ? (
                  <text
                    x={center + 2 + barWidth / 2}
                    y={Math.max(14, chart.bottom - actualH - 6)}
                    textAnchor="middle"
                    fill={actualColor}
                    fontSize="10"
                    fontWeight="700"
                  >
                    {pct != null ? `${Math.round(pct)}%` : `${Math.round(actual)}m`}
                  </text>
                ) : (
                  <text
                    x={center}
                    y={Math.max(14, chart.bottom - targetH - 6)}
                    textAnchor="middle"
                    fill="#94A3B8"
                    fontSize="9"
                  >
                    {statuses[session.effective_status] ?? "Chờ"}
                  </text>
                )}

                <text x={center} y={chart.bottom + 16} textAnchor="middle" fill="#334155" fontSize="10" fontWeight="600">
                  {shortDate(session.event_date)}
                </text>
                <text x={center} y={chart.bottom + 30} textAnchor="middle" fill="#64748B" fontSize="9">
                  {numberLabel(actual, 0)}/{numberLabel(target, 0)}m
                </text>
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
    <div className="grid gap-4 lg:grid-cols-2">
      {speedPoints.length > 0 && (
        <TrendChart
          title="Tốc độ trung bình khi Chạy thử"
          unit="km/h"
          color="#4F46E5"
          higherIsBetter={true}
          points={speedPoints}
        />
      )}
      {recoveryPoints.length > 0 && (
        <TrendChart
          title="Nhịp tim hồi phục sau Chạy thử"
          unit="bpm"
          color="#0284C7"
          higherIsBetter={false}
          points={recoveryPoints}
        />
      )}
    </div>
  );
}

type TrendPoint = { recorded_at: string; value: number };

function TrendChart({
  title,
  unit,
  color,
  higherIsBetter = true,
  points: sourcePoints,
}: {
  title: string;
  unit: string;
  color: string;
  higherIsBetter?: boolean | null;
  points: TrendPoint[];
}) {
  const gradId = useId().replace(/:/g, "");
  const points = sourcePoints
    .filter((point) => Number.isFinite(point.value) && Number.isFinite(new Date(point.recorded_at).getTime()))
    .slice()
    .sort((left, right) => new Date(left.recorded_at).getTime() - new Date(right.recorded_at).getTime());

  if (points.length === 0) return null;

  const values = points.map((point) => point.value);
  const low = Math.min(...values);
  const high = Math.max(...values);
  const avg = values.reduce((a, b) => a + b, 0) / values.length;
  const padding = Math.max((high - low) * 0.28, Math.abs(high) * 0.05, 1);
  const domainMin = low - padding;
  const domainMax = high + padding;

  const chart = { left: 48, right: 24, top: 28, bottom: 152, width: 620, height: 188 };
  const x = (index: number) =>
    points.length === 1
      ? (chart.left + chart.width - chart.right) / 2
      : chart.left + (index / (points.length - 1)) * (chart.width - chart.left - chart.right);
  const y = (amount: number) =>
    chart.bottom - ((amount - domainMin) / (domainMax - domainMin)) * (chart.bottom - chart.top);

  const line = points.map((point, index) => `${index === 0 ? "M" : "L"}${x(index).toFixed(1)} ${y(point.value).toFixed(1)}`).join(" ");
  const area =
    points.length > 1
      ? `${line} L${x(points.length - 1).toFixed(1)} ${chart.bottom} L${x(0).toFixed(1)} ${chart.bottom} Z`
      : "";

  const first = points[0];
  const latest = points[points.length - 1];
  const prev = points.length >= 2 ? points[points.length - 2] : first;
  const totalDelta = latest.value - first.value;
  const stepDelta = latest.value - prev.value;

  const isPositiveChange =
    Math.abs(totalDelta) < 0.05
      ? null
      : higherIsBetter === null
        ? null
        : higherIsBetter
          ? totalDelta > 0
          : totalDelta < 0;

  return (
    <article className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h4 className="text-sm font-bold text-equine-navy">{title}</h4>
          <p className="mt-0.5 text-xs text-slate-500">
            Đầu kỳ: <strong>{numberLabel(first.value)}</strong> → Hiện tại:{" "}
            <strong className="text-slate-900">
              {numberLabel(latest.value)} {unit}
            </strong>
          </p>
        </div>

        <div className="flex flex-col items-end">
          <span
            className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-bold ${
              isPositiveChange === true
                ? "bg-emerald-100 text-emerald-800"
                : isPositiveChange === false
                  ? "bg-rose-100 text-rose-800"
                  : "bg-slate-100 text-slate-700"
            }`}
          >
            {totalDelta > 0.05 ? (
              <ArrowUpRight size={13} />
            ) : totalDelta < -0.05 ? (
              <ArrowDownRight size={13} />
            ) : (
              <Minus size={13} />
            )}
            {formatSigned(totalDelta, ` ${unit}`)} (toàn kỳ)
          </span>
          {points.length >= 2 && (
            <span className="mt-1 text-[11px] text-slate-500">
              So với lần đo liền trước: <strong>{formatSigned(stepDelta, ` ${unit}`)}</strong>
            </span>
          )}
        </div>
      </div>

      <svg
        viewBox={`0 0 ${chart.width} ${chart.height}`}
        role="img"
        aria-label={`${title} theo thời gian`}
        className="mt-2 block h-[188px] w-full"
      >
        <defs>
          <linearGradient id={`grad-${gradId}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity="0.26" />
            <stop offset="100%" stopColor={color} stopOpacity="0.02" />
          </linearGradient>
        </defs>

        {[0, 1, 2].map((index) => {
          const amount = domainMax - ((domainMax - domainMin) * index) / 2;
          const tickY = y(amount);
          return (
            <g key={index}>
              <line x1={chart.left} x2={chart.width - chart.right} y1={tickY} y2={tickY} stroke="#F1F5F9" />
              <text x={chart.left - 8} y={tickY + 4} textAnchor="end" fill="#64748B" fontSize="10">
                {numberLabel(amount)}
              </text>
            </g>
          );
        })}

        {/* Đường trung bình (Average reference line) */}
        {points.length >= 2 && (
          <g>
            <line
              x1={chart.left}
              x2={chart.width - chart.right}
              y1={y(avg)}
              y2={y(avg)}
              stroke="#94A3B8"
              strokeWidth="1"
              strokeDasharray="4 4"
            />
            <text x={chart.width - chart.right} y={y(avg) - 4} textAnchor="end" fill="#64748B" fontSize="9">
              TB: {numberLabel(avg)}
            </text>
          </g>
        )}

        {area && <path d={area} fill={`url(#grad-${gradId})`} />}
        <path d={line} fill="none" stroke={color} strokeWidth="2.75" strokeLinejoin="round" strokeLinecap="round" />

        {points.map((point, index) => {
          const cx = x(index);
          const cy = y(point.value);
          const isEdgeOrChanged =
            points.length <= 8 ||
            index === 0 ||
            index === points.length - 1 ||
            Math.abs(point.value - points[index - 1].value) >= (high - low) * 0.15;
          const prevVal = index > 0 ? points[index - 1].value : null;
          const diff = prevVal != null ? point.value - prevVal : null;

          return (
            <g key={`${point.recorded_at}-${index}`}>
              <circle cx={cx} cy={cy} r={index === points.length - 1 ? 5.5 : 4} fill="#FFFFFF" stroke={color} strokeWidth="2.5">
                <title>
                  {`${metricDate(point.recorded_at)} · ${numberLabel(point.value)} ${unit}${
                    diff != null ? ` (${formatSigned(diff, " " + unit)} so với lần trước)` : ""
                  }`}
                </title>
              </circle>
              {isEdgeOrChanged && (
                <text
                  x={cx}
                  y={Math.max(14, cy - 9)}
                  textAnchor="middle"
                  fill="#0F172A"
                  fontSize="10"
                  fontWeight="700"
                >
                  {numberLabel(point.value)}
                </text>
              )}
            </g>
          );
        })}

        <text x={chart.left} y={chart.height - 6} fill="#64748B" fontSize="10" fontWeight="600">
          {shortDate(first.recorded_at)} (Đầu)
        </text>
        {points.length > 2 && (
          <text
            x={(chart.left + chart.width - chart.right) / 2}
            y={chart.height - 6}
            textAnchor="middle"
            fill="#94A3B8"
            fontSize="10"
          >
            {points.length} lần ghi nhận
          </text>
        )}
        <text x={chart.width - chart.right} y={chart.height - 6} textAnchor="end" fill="#0F172A" fontSize="10" fontWeight="700">
          {shortDate(latest.recorded_at)} (Mới nhất)
        </text>
      </svg>
    </article>
  );
}

function HorseDevelopment({
  metrics,
  loading,
}: {
  metrics: TrainingMetric[];
  loading: boolean;
}) {
  const ordered = metrics
    .slice()
    .sort((left, right) => new Date(left.recorded_at).getTime() - new Date(right.recorded_at).getTime());
  const latest = ordered[ordered.length - 1];
  const alertCount = ordered.filter((metric) => metric.has_injury_alert).length;

  return (
    <section className="rounded-xl border border-emerald-200 bg-emerald-50/40 p-5 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Sparkles size={18} className="text-emerald-700" />
          <h3 className="font-bold text-equine-navy">Sự thay đổi Thể chất & Phong độ của Ngựa</h3>
        </div>
        {ordered.length > 0 && (
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <span className="rounded-full bg-white px-3 py-1 font-semibold text-slate-700 ring-1 ring-slate-200">
              {ordered.length} lần đo ({shortDate(ordered[0]?.recorded_at)} → {shortDate(latest?.recorded_at)})
            </span>
            {alertCount > 0 && (
              <span className="inline-flex items-center gap-1 rounded-full bg-rose-100 px-3 py-1 font-bold text-rose-800">
                <AlertTriangle size={13} /> {alertCount} lần có cảnh báo
              </span>
            )}
          </div>
        )}
      </div>

      {!loading && ordered.length === 0 && (
        <p className="mt-4 rounded-xl border border-dashed border-equine-line bg-white p-5 text-center text-sm text-slate-500">
          Chưa có chỉ số thể lực trong khoảng ngày này. Hãy mở rộng khoảng ngày hoặc chạy mô phỏng buổi tập.
        </p>
      )}

      {ordered.length > 0 && (
        <>
          {/* 4 THẺ SO SÁNH TRỰC TIẾP: ĐẦU KỲ -> HIỆN TẠI (DELTA CARDS) */}
          <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {developmentMeasures.map((measure) => {
              const pts = ordered.flatMap((m) => {
                const v = m[measure.key];
                return typeof v === "number" && Number.isFinite(v)
                  ? [{ recorded_at: m.recorded_at, value: v }]
                  : [];
              });
              const firstPt = pts[0];
              const lastPt = pts[pts.length - 1];
              const prevPt = pts.length >= 2 ? pts[pts.length - 2] : firstPt;
              const delta = firstPt && lastPt ? lastPt.value - firstPt.value : null;
              const stepDelta = prevPt && lastPt ? lastPt.value - prevPt.value : null;
              const Icon = measure.icon;

              const isGood =
                delta == null || Math.abs(delta) < 0.05 || measure.higherIsBetter === null
                  ? null
                  : measure.higherIsBetter
                    ? delta > 0
                    : delta < 0;

              return (
                <article
                  key={measure.key}
                  className="rounded-xl border border-slate-200 bg-white p-3.5 shadow-sm"
                >
                  <div className="flex items-center justify-between">
                    <span className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-600">
                      <Icon size={15} style={{ color: measure.color }} />
                      {measure.shortTitle}
                    </span>
                    {delta != null && (
                      <span
                        className={`inline-flex items-center gap-0.5 rounded-full px-2 py-0.5 text-xs font-extrabold ${
                          isGood === true
                            ? "bg-emerald-100 text-emerald-800"
                            : isGood === false
                              ? "bg-rose-100 text-rose-800"
                              : "bg-slate-100 text-slate-700"
                        }`}
                      >
                        {delta > 0.05 ? "▲ " : delta < -0.05 ? "▼ " : ""}
                        {formatSigned(delta, ` ${measure.unit}`)}
                      </span>
                    )}
                  </div>

                  <div className="mt-2 flex items-baseline justify-between gap-2">
                    <div>
                      <span className="block text-[10px] uppercase tracking-wider text-slate-400">Hiện tại</span>
                      <strong className="text-xl font-black text-equine-navy">
                        {lastPt ? `${numberLabel(lastPt.value)} ${measure.unit}` : "—"}
                      </strong>
                    </div>

                    {firstPt && lastPt && pts.length > 1 && (
                      <div className="text-right">
                        <span className="block text-[10px] text-slate-400">Đầu kỳ → Nay</span>
                        <span className="inline-flex items-center gap-1 text-xs font-semibold text-slate-600">
                          {numberLabel(firstPt.value)} <ArrowRight size={11} className="text-slate-400" />{" "}
                          <strong className="text-slate-900">{numberLabel(lastPt.value)}</strong>
                        </span>
                      </div>
                    )}
                  </div>

                  {stepDelta != null && pts.length >= 2 && (
                    <p className="mt-1.5 border-t border-slate-100 pt-1.5 text-[11px] text-slate-500">
                      So với buổi liền trước:{" "}
                      <strong className="text-slate-700">{formatSigned(stepDelta, ` ${measure.unit}`)}</strong>
                    </p>
                  )}
                </article>
              );
            })}
          </div>

          {/* 4 BIỂU ĐỒ AREA HIỂN THỊ RÕ CON SỐ TỪNG BUỔI */}
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
                    <TrendChart
                      title={measure.title}
                      unit={measure.unit}
                      color={measure.color}
                      higherIsBetter={measure.higherIsBetter}
                      points={points}
                    />
                  ) : (
                    <div className="rounded-xl border border-dashed border-equine-line bg-white p-4 text-sm text-slate-500">
                      {measure.title}: chưa có dữ liệu đo.
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* BẢNG CHI TIẾT THU GỌN ĐỂ TRÁNH NHIỀU CHỮ, KÈM CỘT CHÊNH LỆCH (Δ) */}
          <details className="mt-4 rounded-xl border border-slate-200 bg-white p-3">
            <summary className="cursor-pointer select-none text-xs font-bold text-equine-navy">
              📋 Xem bảng đối chiếu số liệu chi tiết từng lần đo ({ordered.length} bản ghi)
            </summary>
            <div className="mt-3 overflow-x-auto">
              <table className="w-full min-w-[760px] text-left text-xs">
                <thead>
                  <tr className="border-b border-slate-200 text-slate-500">
                    <th className="py-2">Thời điểm</th>
                    <th>Tốc độ TB (Δ)</th>
                    <th>Thể lực (Δ)</th>
                    <th>Nhịp tim đỉnh (Δ)</th>
                    <th>Cân nặng</th>
                    <th>Trạng thái</th>
                  </tr>
                </thead>
                <tbody>
                  {ordered
                    .slice()
                    .reverse()
                    .slice(0, 20)
                    .map((metric, revIdx, arr) => {
                      const prevMetric = arr[revIdx + 1];
                      const speedDiff =
                        metric.avg_speed_kmh != null && prevMetric?.avg_speed_kmh != null
                          ? metric.avg_speed_kmh - prevMetric.avg_speed_kmh
                          : null;
                      const staminaDiff =
                        metric.stamina_score != null && prevMetric?.stamina_score != null
                          ? metric.stamina_score - prevMetric.stamina_score
                          : null;
                      const hrDiff =
                        metric.max_heart_rate != null && prevMetric?.max_heart_rate != null
                          ? metric.max_heart_rate - prevMetric.max_heart_rate
                          : null;

                      return (
                        <tr key={metric.id ?? `${metric.recorded_at}-${revIdx}`} className="border-t border-slate-100">
                          <td className="py-2.5 font-medium whitespace-nowrap text-slate-800">
                            {metricDate(metric.recorded_at)}
                            {metric.is_simulated && (
                              <span className="ml-1.5 rounded bg-violet-50 px-1.5 py-0.5 text-[10px] font-semibold text-violet-700">
                                Mô phỏng
                              </span>
                            )}
                          </td>
                          <td>
                            <strong>{formatVal(metric.avg_speed_kmh, " km/h")}</strong>
                            {speedDiff != null && Math.abs(speedDiff) >= 0.1 && (
                              <span
                                className={`ml-1.5 font-bold ${
                                  speedDiff > 0 ? "text-emerald-600" : "text-rose-600"
                                }`}
                              >
                                ({formatSigned(speedDiff)})
                              </span>
                            )}
                          </td>
                          <td>
                            <strong>{formatVal(metric.stamina_score, "/10")}</strong>
                            {staminaDiff != null && Math.abs(staminaDiff) >= 0.1 && (
                              <span
                                className={`ml-1.5 font-bold ${
                                  staminaDiff > 0 ? "text-emerald-600" : "text-rose-600"
                                }`}
                              >
                                ({formatSigned(staminaDiff)})
                              </span>
                            )}
                          </td>
                          <td>
                            <strong>{formatVal(metric.max_heart_rate, " bpm", 0)}</strong>
                            {hrDiff != null && Math.abs(hrDiff) >= 1 && (
                              <span
                                className={`ml-1.5 font-bold ${
                                  hrDiff < 0 ? "text-emerald-600" : "text-rose-600"
                                }`}
                              >
                                ({formatSigned(hrDiff, "", 0)})
                              </span>
                            )}
                          </td>
                          <td>{formatVal(metric.body_weight_kg, " kg")}</td>
                          <td>
                            {metric.has_injury_alert ? (
                              <span className="font-semibold text-rose-700">Cảnh báo sức khỏe</span>
                            ) : (
                              <span className="text-emerald-700">Bình thường</span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                </tbody>
              </table>
            </div>
          </details>
        </>
      )}
    </section>
  );
}
