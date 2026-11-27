import type { InjuryMarker, veterinarianApi } from "@/api/veterinarian/api";

type InjuryApi = Pick<typeof veterinarianApi, "createInjury" | "updateInjury" | "injuries" | "updateHealthStatus" | "unlockTraining" | "lockTraining">;
export type InjurySnapshot = { latest: InjuryMarker[]; history: InjuryMarker[]; saved: InjuryMarker };

// One runner per panel: the synchronous guard also catches clicks before React rerenders.
export function createInjuryWorkflow(api: InjuryApi) {
  let busy = false;
  return async function save(
    horse: { id: string; horse_name: string },
    markerId: string | null,
    input: Record<string, unknown>,
    onSaved: (saved: InjuryMarker) => void,
    onReload: (snapshot: InjurySnapshot) => void,
  ): Promise<{ syncError?: unknown } | null> {
    if (busy) return null;
    busy = true;
    try {
      const saved = markerId
        ? await api.updateInjury(markerId, input)
        : await api.createInjury(horse.id, input);
      onSaved(saved);
      const latest = (await api.injuries(horse.id, true)).data;
      const history = (await api.injuries(horse.id, false)).data;
      const assessment = latest.find((marker) => marker.id === saved.id) ?? history.find((marker) => marker.id === saved.id);
      if (!assessment) throw new Error("Chưa tải được đánh giá vừa lưu. Vui lòng tải lại hồ sơ trước khi cập nhật sức khỏe.");
      onReload({ latest, history, saved: assessment });
      const allResolved = latest.length > 0 && latest.every((marker) => marker.recovery_status === "Recovered");
      // A recovered position does not imply that the other positions have recovered.
      if (assessment.recovery_status === "Recovered" && !allResolved) return {};
      const reason = allResolved
        ? `Đã hồi phục các vị trí chấn thương của ngựa ${horse.horse_name}.`
        : `Cần hạn chế vận động do chấn thương tại ${assessment.body_part}.`;
      try {
        if (allResolved) {
          await api.updateHealthStatus(horse.id, "Healthy", "Ready", reason);
          await api.unlockTraining(horse.id, reason);
        } else {
          const health = await api.updateHealthStatus(horse.id, "Injured", "NotReady", reason);
          if (!health.is_training_locked) await api.lockTraining(horse.id, {
            lock_level: assessment.severity === "Severe" ? "Critical" : "Warning", lock_reason: reason,
          });
        }
        return {};
      } catch (syncError) {
        // The assessment is already persisted. Never roll it back or retry a conflict.
        return { syncError };
      }
    } finally {
      busy = false;
    }
  };
}
