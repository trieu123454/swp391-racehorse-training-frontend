export type SearchableHorse = {
  id: string;
  horse_name: string;
  image_url?: string | null;
  image_signed_url?: string | null;
  breed?: string | null;
  box_code?: string | null;
  section?: string | null;
  stable_box?: { id?: string; box_code?: string | null; section?: string | null } | null;
  microchip_number?: string | null;
  passport_number?: string | null;
  current_status?: string | null;
  readiness_status?: string | null;
  is_training_locked?: boolean | null;
};

export function normalizeHorseSearchText(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "D")
    .toLowerCase();
}

export function horseBoxCode(horse: SearchableHorse): string | null {
  return horse.box_code ?? horse.stable_box?.box_code ?? null;
}

export function horseSection(horse: SearchableHorse): string | null {
  return horse.section ?? horse.stable_box?.section ?? null;
}

export function normalizedHorseStatus(status: string | null | undefined): string {
  if (!status) return "";
  return status === "Under Observation" ? "Monitoring" : status;
}

export function normalizedHorseReadiness(
  readiness: string | null | undefined,
): "Ready" | "NotReady" | "Unknown" {
  if (readiness === "Ready") return "Ready";
  if (readiness === "NotReady") return "NotReady";
  return "Unknown";
}

export function extractStableOptions(horses: SearchableHorse[]): { value: string; label: string }[] {
  const seen = new Map<string, string>();
  let hasUnassigned = false;
  for (const horse of horses) {
    const code = horseBoxCode(horse);
    if (!code) {
      hasUnassigned = true;
      continue;
    }
    if (!seen.has(code)) {
      const section = horseSection(horse);
      seen.set(code, section ? `${code} · ${section}` : code);
    }
  }
  const options = Array.from(seen.entries())
    .sort((a, b) => a[0].localeCompare(b[0], "vi"))
    .map(([value, label]) => ({ value, label }));
  if (hasUnassigned) {
    options.push({ value: "__UNASSIGNED__", label: "Chưa xếp chuồng" });
  }
  return options;
}

export function filterSearchableHorses<T extends SearchableHorse>(
  horses: T[],
  filters: { query?: string; status?: string; stable?: string; readiness?: string },
): T[] {
  const query = normalizeHorseSearchText((filters.query ?? "").trim());
  const status = filters.status ?? "ALL";
  const stable = filters.stable ?? "ALL";
  const readiness = filters.readiness ?? "ALL";
  return horses.filter((horse) => {
    if (status !== "ALL" && normalizedHorseStatus(horse.current_status) !== status) {
      return false;
    }
    if (readiness !== "ALL" && normalizedHorseReadiness(horse.readiness_status) !== readiness) {
      return false;
    }
    const code = horseBoxCode(horse);
    if (stable === "__UNASSIGNED__" && code) return false;
    if (stable !== "ALL" && stable !== "__UNASSIGNED__" && code !== stable) return false;
    if (!query) return true;
    const haystack = normalizeHorseSearchText(
      [
        horse.horse_name,
        horse.breed,
        code,
        horseSection(horse),
        horse.microchip_number,
        horse.passport_number,
        horse.id,
      ]
        .filter(Boolean)
        .join(" "),
    );
    return haystack.includes(query);
  });
}
