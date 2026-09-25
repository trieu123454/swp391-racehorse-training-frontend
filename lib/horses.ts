import { ApiRequestError, validateSession } from "./api";
import { getAccessToken } from "./session";

const base = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8080";

export type HorseStatus =
  | "Healthy"
  | "Injured"
  | "Quarantine"
  | "Under Observation"
  | "Sick";

export type Horse = {
  id: string;
  horse_name: string;
  breed: string | null;
  birth_year: number | null;
  pedigree_father: string | null;
  pedigree_mother: string | null;
  image_url: string | null;
  stable_box_id: string;
  box_code: string | null;
  section: string | null;
  owner_id: number | null;
  owner_name?: string | null;
  current_status: HorseStatus | string;
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

export type Owner = { user_id: number; full_name: string };
export type HorseInput = {
  horseName: string;
  breed: string | null;
  birthYear: number | null;
  pedigreeFather: string | null;
  pedigreeMother: string | null;
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

export async function horseRequest<T>(path: string, options: RequestInit = {}): Promise<T> {
  const send = () => fetch(`${base}/api/horses${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(options.headers ?? {}),
      Authorization: `Bearer ${getAccessToken()}`,
    },
  });

  let response = await send();
  if (response.status === 401) {
    await validateSession();
    response = await send();
  }
  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new ApiRequestError(
      body.message || "Không thể thực hiện yêu cầu. Vui lòng thử lại.",
      response.status,
    );
  }
  return response.status === 204 ? (undefined as T) : response.json();
}

export async function listHorses(params: {
  search?: string;
  breed?: string;
  currentStatus?: string;
  stableBoxId?: string;
  isTrainingLocked?: boolean;
} = {}) {
  const query = new URLSearchParams({ page: "0", size: "100" });
  if (params.search) query.set("search", params.search);
  if (params.breed) query.set("breed", params.breed);
  if (params.currentStatus) query.set("currentStatus", params.currentStatus);
  if (params.stableBoxId) query.set("stableBoxId", params.stableBoxId);
  if (params.isTrainingLocked !== undefined) query.set("isTrainingLocked", String(params.isTrainingLocked));
  return horseRequest<HorsePage>(`?${query.toString()}`);
}

export function getHorse(id: string) {
  return horseRequest<Horse>(`/${id}`);
}

export function getHorseStables() {
  return horseRequest<Stable[]>("/options/stables");
}

export function getHorseOwners() {
  return horseRequest<Owner[]>("/options/owners");
}

export function saveHorse(input: HorseInput, id?: string) {
  return horseRequest<Horse>(id ? `/${id}` : "", {
    method: id ? "PUT" : "POST",
    body: JSON.stringify(input),
  });
}

export function getHorseDeletionWarnings(id: string) {
  return horseRequest<Warnings>(`/${id}/deletion-warnings`);
}

export function deleteHorse(id: string) {
  return horseRequest<void>(`/${id}?confirmed=true`, { method: "DELETE" });
}

export async function uploadHorseImage(
  file: File,
  progress: (value: number) => void,
  signal: AbortSignal,
): Promise<string> {
  await validateSession();
  if (signal.aborted) throw new DOMException("Đã hủy tải ảnh", "AbortError");
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    const abort = () => xhr.abort();
    signal.addEventListener("abort", abort, { once: true });
    xhr.open("POST", `${base}/api/horses/images`);
    xhr.setRequestHeader("Authorization", `Bearer ${getAccessToken()}`);
    xhr.timeout = 60000;
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) progress(Math.round((e.loaded / e.total) * 100));
    };
    xhr.onloadend = () => signal.removeEventListener("abort", abort);
    xhr.onerror = () =>
      reject(
        new Error(
          "Không kết nối được máy chủ. Bạn có thể lưu hồ sơ và bổ sung ảnh sau.",
        ),
      );
    xhr.ontimeout = () =>
      reject(new Error("Tải ảnh quá thời gian chờ. Vui lòng thử lại."));
    xhr.onabort = () =>
      reject(new DOMException("Đã hủy tải ảnh", "AbortError"));
    xhr.onload = () => {
      let body: { imagePath?: string; message?: string } = {};
      try {
        body = JSON.parse(xhr.responseText);
      } catch {
        // Use the safe fallback below.
      }
      if (xhr.status >= 200 && xhr.status < 300 && body.imagePath)
        resolve(body.imagePath);
      else
        reject(
          new ApiRequestError(
            body.message || "Không tải được ảnh. Bạn vẫn có thể lưu hồ sơ.",
            xhr.status,
          ),
        );
    };
    const data = new FormData();
    data.append("file", file);
    xhr.send(data);
  });
}

export const statusLabels: Record<string, string> = {
  Healthy: "Khỏe mạnh",
  Injured: "Chấn thương",
  Quarantine: "Cách ly",
  "Under Observation": "Cần theo dõi",
  Sick: "Đang bệnh",
};

export const horseStatus = (value: string) => statusLabels[value] || value;
export const errorMessage = (error: unknown) =>
  error instanceof Error ? error.message : "Có lỗi xảy ra. Vui lòng thử lại.";
