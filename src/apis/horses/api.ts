import { APP_MUTATION_COMPLETED_EVENT, ApiRequestError, authenticatedRequest, authenticatedUploadWithProgress } from "@/api/client";

const HORSE_CACHE_TTL_MS = 45_000;
const horseListCache = new Map<string, { data: HorsePage; expiresAt: number }>();
const horseDetailCache = new Map<string, { data: Horse; expiresAt: number }>();
const horseStablesCache = new Map<string, { data: Stable[]; expiresAt: number }>();
const horseImageUrlCache = new Map<string, { url?: string; expiresAt: number }>();

export function invalidateHorseCaches() {
  horseListCache.clear();
  horseDetailCache.clear();
  horseStablesCache.clear();
}

if (typeof window !== "undefined") {
  window.addEventListener(APP_MUTATION_COMPLETED_EVENT, () => {
    invalidateHorseCaches();
  });
}

export type HorseStatus =
  | "Healthy"
  | "Monitoring"
  | "Injured"
  | "Quarantine"
  | "Under Observation"
  | "Sick";

export type HorseRegistrationDocument = {
  id: string;
  name: string;
  content_type: string;
  file_size: number;
  document_type: "OWNERSHIP_PROOF" | "HORSE_CERTIFICATE" | "HEALTH_DOCUMENT" | "OTHER";
  revision_no: number;
  uploaded_at: string;
  url: string;
  download_url: string;
  expires_in: number;
};

export type Horse = {
  id: string;
  horse_name: string;
  breed: string | null;
  gender?: string | null;
  birth_year: number | null;
  height_cm: number | null;
  current_weight_kg: number | null;
  pedigree_father: string | null;
  pedigree_mother: string | null;
  microchip_number: string | null;
  passport_number: string | null;
  image_url: string | null;
  image_signed_url?: string | null;
  stable_box_id: string;
  box_code: string | null;
  section: string | null;
  owner_id: number | null;
  owner_name?: string | null;
  registration_documents?: HorseRegistrationDocument[];
  current_status: HorseStatus | string;
  readiness_status?: "Ready" | "NotReady" | "Unknown";
  is_training_locked: boolean;
  created_at: string;
  deleted_at?: string | null;
};

export type Stable = {
  id: string;
  box_code: string;
  section: string;
  capacity: number;
  occupied: number;
};

export type Owner = { user_id: number; full_name: string; email: string; phone: string | null };
export type OwnerPage = { items: Owner[]; hasMore: boolean; page: number; size: number };
export type HorseInput = {
  horseName: string;
  breed: string | null;
  gender?: string | null;
  birthYear: number | null;
  heightCm: number | null;
  currentWeightKg: number | null;
  pedigreeFather: string | null;
  pedigreeMother: string | null;
  microchipNumber: string | null;
  passportNumber: string | null;
  stableBoxId: string;
  ownerId: number | null;
  imagePath: string | null;
  confirmOwnerChange: boolean;
};
export type HorsePage = { items: Horse[]; total: number; page: number; size: number };
export type Warnings = {
  scheduledTraining: number;
  medicalRecords: number;
  activePrescriptions: number;
};

export type OwnershipHistoryEntry = {
  id: string;
  previous_owner_id: number | null;
  previous_owner_name: string | null;
  new_owner_id: number | null;
  new_owner_name: string | null;
  changed_by: number | null;
  changed_by_name: string | null;
  change_reason: string;
  changed_at: string;
};

export async function horseRequest<T>(path: string, options: RequestInit = {}): Promise<T> {
  return authenticatedRequest<T>(`/api/horses${path}`, options);
}

export async function listHorses(params: {
  search?: string;
  breed?: string;
  currentStatus?: string;
  stableBoxId?: string;
  isTrainingLocked?: boolean;
  page?: number;
  size?: number;
} = {}) {
  const query = new URLSearchParams({ page: String(params.page ?? 1), size: String(params.size ?? 100) });
  if (params.search) query.set("search", params.search);
  if (params.breed) query.set("breed", params.breed);
  if (params.currentStatus) query.set("currentStatus", params.currentStatus);
  if (params.stableBoxId) query.set("stableBoxId", params.stableBoxId);
  if (params.isTrainingLocked !== undefined) query.set("isTrainingLocked", String(params.isTrainingLocked));
  const key = query.toString();
  const cached = horseListCache.get(key);
  const now = Date.now();
  if (cached && now < cached.expiresAt) {
    return cached.data;
  }
  const res = await horseRequest<HorsePage>(`?${key}`);
  horseListCache.set(key, { data: res, expiresAt: now + HORSE_CACHE_TTL_MS });
  res.items?.forEach((item) => {
    if (item.image_signed_url) {
      horseImageUrlCache.set(item.id, { url: item.image_signed_url, expiresAt: now + 240_000 });
    }
  });
  return res;
}

export function peekCachedHorse(id: string): Horse | null {
  if (!id) return null;
  const detail = horseDetailCache.get(id);
  if (detail) return detail.data;
  for (const entry of horseListCache.values()) {
    const found = entry.data.items?.find((item) => item.id === id);
    if (found) return found;
  }
  return null;
}

export function peekCachedStables(): Stable[] | null {
  return horseStablesCache.get("all")?.data ?? null;
}

export async function getHorse(id: string) {
  const now = Date.now();
  const cached = horseDetailCache.get(id);
  if (cached && now < cached.expiresAt) {
    return cached.data;
  }
  const res = await horseRequest<Horse>(`/${id}`);
  horseDetailCache.set(id, { data: res, expiresAt: now + HORSE_CACHE_TTL_MS });
  if (res.image_signed_url) {
    horseImageUrlCache.set(id, { url: res.image_signed_url, expiresAt: now + 240_000 });
  }
  return res;
}

export async function getHorseImageUrl(id: string, imagePath?: string | null): Promise<string | undefined> {
  if (!imagePath) return undefined;
  if (imagePath.startsWith("http://") || imagePath.startsWith("https://") || imagePath.startsWith("/") || imagePath.startsWith("blob:")) {
    return imagePath;
  }
  const cacheKey = `${id}|${imagePath}`;
  const now = Date.now();
  const cached = horseImageUrlCache.get(cacheKey) ?? horseImageUrlCache.get(id);
  if (cached && now < cached.expiresAt) {
    return cached.url;
  }
  const data = await horseRequest<{ hasImage: boolean; url?: string }>(`/${id}/image`);
  horseImageUrlCache.set(cacheKey, { url: data.url, expiresAt: now + 240_000 });
  return data.url;
}

export function getHorseOwnershipHistory(id: string) {
  return horseRequest<OwnershipHistoryEntry[]>(`/${id}/ownership-history`);
}

export function getHorseDocumentUrl(horseId: string, docId: string, download = false) {
  return horseRequest<{ url: string; expiresIn: number }>(
    `/${encodeURIComponent(horseId)}/documents/${encodeURIComponent(docId)}/url?download=${download ? "true" : "false"}`,
  );
}

export async function openFreshDocument(
  fetchUrl: () => Promise<{ url: string }>,
  fallbackUrl: string,
  downloadFilename?: string,
) {
  if (downloadFilename) {
    let targetUrl = fallbackUrl;
    try {
      const result = await fetchUrl();
      if (result.url) targetUrl = result.url;
    } catch {
      // Fallback to existing signed URL if fresh signing fails.
    }
    if (!targetUrl) return;
    const anchor = document.createElement("a");
    anchor.href = targetUrl;
    anchor.download = downloadFilename;
    anchor.rel = "noopener noreferrer";
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    return;
  }

  const win = window.open("", "_blank");
  if (win) win.opener = null;
  let targetUrl = fallbackUrl;
  try {
    const result = await fetchUrl();
    if (result.url) targetUrl = result.url;
  } catch {
    // Fallback to existing signed URL if fresh signing fails.
  }
  if (!targetUrl) {
    win?.close();
    return;
  }
  if (win && !win.closed) {
    win.location.replace(targetUrl);
  } else {
    window.open(targetUrl, "_blank", "noopener,noreferrer");
  }
}

export async function getHorseStables() {
  const now = Date.now();
  const cached = horseStablesCache.get("all");
  if (cached && now < cached.expiresAt) {
    return cached.data;
  }
  const res = await horseRequest<Stable[]>("/options/stables");
  horseStablesCache.set("all", { data: res, expiresAt: now + HORSE_CACHE_TTL_MS });
  return res;
}

export function getHorseOwners(query: string, page = 0, signal?: AbortSignal) {
  const params = new URLSearchParams({ q: query, page: String(page), size: "20" });
  return horseRequest<OwnerPage>(`/options/owners?${params.toString()}`, { signal });
}

export async function saveHorse(input: HorseInput, id?: string) {
  const res = await horseRequest<Horse>(id ? `/${id}` : "", {
    method: id ? "PUT" : "POST",
    body: JSON.stringify(input),
  });
  invalidateHorseCaches();
  if (res?.id) {
    const now = Date.now();
    horseDetailCache.set(res.id, { data: res, expiresAt: now + HORSE_CACHE_TTL_MS });
    if (res.image_signed_url) {
      horseImageUrlCache.set(res.id, { url: res.image_signed_url, expiresAt: now + 240_000 });
    }
  }
  return res;
}

export function getHorseDeletionWarnings(id: string) {
  return horseRequest<Warnings>(`/${id}/deletion-warnings`);
}

export async function deleteHorse(id: string) {
  const res = await horseRequest<void>(`/${id}?confirmed=true`, { method: "DELETE" });
  invalidateHorseCaches();
  return res;
}

export async function uploadHorseImage(
  file: File,
  progress: (value: number) => void,
  signal: AbortSignal,
): Promise<string> {
  const data = new FormData();
  data.append("file", file);
  const body = await authenticatedUploadWithProgress<{ imagePath?: string }>(
    "/api/horses/images",
    "POST",
    data,
    (fraction) => progress(Math.round(fraction * 100)),
    signal,
  );
  if (!body?.imagePath) {
    throw new ApiRequestError("Không tải được ảnh. Bạn vẫn có thể lưu hồ sơ.", 500);
  }
  return body.imagePath;
}

export const statusLabels: Record<string, string> = {
  Monitoring: "Cần theo dõi",
  Healthy: "Khỏe mạnh",
  Injured: "Chấn thương",
  Quarantine: "Cách ly",
  "Under Observation": "Cần theo dõi",
  Sick: "Đang bệnh",
};

export const genderLabels: Record<string, string> = {
  Male: "Đực",
  Stallion: "Đực",
  Colt: "Đực",
  Female: "Cái",
  Mare: "Cái",
  Filly: "Cái",
  Gelding: "Đực thiến",
};

export const horseGender = (value?: string | null) =>
  value ? (genderLabels[value] || value) : null;

export const horseStatus = (value: string) => statusLabels[value] || value;
export const errorMessage = (error: unknown) =>
  error instanceof Error ? error.message : "Có lỗi xảy ra. Vui lòng thử lại.";
