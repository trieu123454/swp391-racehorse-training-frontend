"use client";

import { formatDisplayDate } from "@/lib/display-format";

import Link from "next/link";
import Image from "next/image";
import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import { useAutoRefresh } from "@/shared/hooks/use-auto-refresh";
import {
  AlertCircle,
  ArrowRight,
  CheckCircle2,
  ChevronDown,
  ClipboardList,
  Clock,
  ExternalLink,
  Eye,
  FileCheck2,
  FilePlus2,
  FileText,
  ImagePlus,
  Loader2,
  MessageSquare,
  Pencil,
  RotateCcw,
  Trash2,
  Upload,
  X,
  XCircle,
} from "lucide-react";
import { errorMessage, horseGender, openFreshDocument, type Horse } from "@/api/horses/api";
import { HorseImage, Modal, Notice } from "@/components/horses/HorseUI";
import {
  getHorseRegistrationRequests,
  getOwnerRegistrationDocumentUrl,
  getOwnershipTransferRequests,
  respondToOwnershipTransfer,
  resubmitHorseRegistrationRequest,
  submitHorseRegistrationRequest,
  type OwnershipTransferRequest,
  type HorseRegistrationRequest,
  type HorseRegistrationSubmission,
} from "@/api/horse-owner/api";
import { Routes } from "@/routes/Routes";

type DocumentCategory = "OWNERSHIP_PROOF" | "HORSE_CERTIFICATE" | "HEALTH_DOCUMENT" | "OTHER";
type SelectedDocument = { id: string; file: File; type: DocumentCategory };
type RegistrationFieldKey =
  | "horseName"
  | "birthYear"
  | "heightCm"
  | "currentWeightKg"
  | "horseImage"
  | "OWNERSHIP_PROOF"
  | "HEALTH_DOCUMENT"
  | "documents";
type RegistrationFieldErrors = Partial<Record<RegistrationFieldKey, string>>;
type UploadStage = "compressing" | "uploading" | "saving" | "done";

const MAX_PRECOMPRESS_BYTES = 25 * 1024 * 1024;
const ALLOWED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"] as const;
const ALLOWED_DOC_TYPES = ["application/pdf", "image/jpeg", "image/png", "image/webp"] as const;

const statusLabel: Record<HorseRegistrationRequest["status"], string> = {
  PENDING: "Chờ Club Manager duyệt",
  NEEDS_INFORMATION: "Cần bổ sung thông tin",
  AWAITING_OWNER_CONSENT: "Chờ chủ hiện tại xác nhận",
  APPROVED: "Đã duyệt",
  REJECTED: "Chưa được duyệt",
};

const documentLabels: Record<string, string> = {
  OWNERSHIP_PROOF: "Chứng minh sở hữu",
  HORSE_CERTIFICATE: "Chứng nhận ngựa",
  HEALTH_DOCUMENT: "Hồ sơ sức khỏe",
  OTHER: "Khác",
};

function formatFileSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

async function compressImageIfLarge(file: File): Promise<File> {
  if (typeof window === "undefined" || typeof document === "undefined") return file;
  if (!ALLOWED_IMAGE_TYPES.includes(file.type as (typeof ALLOWED_IMAGE_TYPES)[number])) return file;
  if (file.size <= 350 * 1024) return file;
  try {
    const bitmap = await createImageBitmap(file);
    const maxDim = 1500;
    const scale = Math.min(1, maxDim / Math.max(bitmap.width || 1, bitmap.height || 1));
    const width = Math.max(1, Math.round(bitmap.width * scale));
    const height = Math.max(1, Math.round(bitmap.height * scale));
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (!ctx) return file;
    const targetType = file.type === "image/png" ? "image/jpeg" : file.type;
    if (targetType === "image/jpeg") {
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, width, height);
    }
    ctx.drawImage(bitmap, 0, 0, width, height);
    bitmap.close?.();
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, targetType, 0.82));
    if (!blob || blob.size >= file.size) return file;
    const actualType = blob.type || targetType;
    if (!ALLOWED_IMAGE_TYPES.includes(actualType as (typeof ALLOWED_IMAGE_TYPES)[number])) return file;
    const ext = actualType === "image/jpeg" ? ".jpg" : actualType === "image/webp" ? ".webp" : ".png";
    const baseName = file.name.replace(/\.[^.]+$/, "");
    return new File([blob], `${baseName}${ext}`, { type: actualType, lastModified: Date.now() });
  } catch {
    return file;
  }
}

export default function HorseRegistrationPanel() {
  const [requests, setRequests] = useState<HorseRegistrationRequest[]>([]);
  const [transferRequests, setTransferRequests] = useState<OwnershipTransferRequest[]>([]);
  const [editingRequest, setEditingRequest] = useState<HorseRegistrationRequest | null>(null);
  const [transferNotes, setTransferNotes] = useState<Record<string, string>>({});
  const [transferBusy, setTransferBusy] = useState("");
  const [pendingTransfer, setPendingTransfer] = useState<{ request: OwnershipTransferRequest; action: "CONSENT" | "DECLINE" } | null>(null);
  const [requestType, setRequestType] = useState<HorseRegistrationSubmission["requestType"]>("REGISTER");
  const [activeTab, setActiveTab] = useState<"form" | "history">("form");
  const [showExtraSpecs, setShowExtraSpecs] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<{
    percent: number;
    stage: UploadStage;
    label: string;
  } | null>(null);
  const [error, setError] = useState("");
  const [fieldErrors, setFieldErrors] = useState<RegistrationFieldErrors>({});
  const [historyError, setHistoryError] = useState("");
  const [notice, setNotice] = useState("");
  const [horseImage, setHorseImage] = useState<File | null>(null);
  const [horseImagePreview, setHorseImagePreview] = useState<string | null>(null);
  const [removeExistingImage, setRemoveExistingImage] = useState(false);
  const [removedDocIds, setRemovedDocIds] = useState<string[]>([]);
  const [selectedDocs, setSelectedDocs] = useState<SelectedDocument[]>([]);
  const formRef = useRef<HTMLFormElement>(null);
  const feedbackRef = useRef<HTMLDivElement>(null);
  const horseImageInputRef = useRef<HTMLInputElement>(null);
  const processingTimerRef = useRef<number | null>(null);

  const clearProcessingTimer = useCallback(() => {
    if (processingTimerRef.current !== null) {
      window.clearInterval(processingTimerRef.current);
      processingTimerRef.current = null;
    }
  }, []);

  useEffect(() => () => clearProcessingTimer(), [clearProcessingTimer]);

  useEffect(() => {
    if (!horseImage) {
      setHorseImagePreview(null);
      return;
    }
    const preview = URL.createObjectURL(horseImage);
    setHorseImagePreview(preview);
    return () => URL.revokeObjectURL(preview);
  }, [horseImage]);

  const load = useCallback(async () => {
    try {
      const [nextRequests, nextTransfers] = await Promise.all([
        getHorseRegistrationRequests(),
        getOwnershipTransferRequests(),
      ]);
      setRequests(nextRequests);
      setTransferRequests(nextTransfers);
      setHistoryError("");
    } catch (reason) {
      setHistoryError(errorMessage(reason));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);
  useAutoRefresh(load, { enabled: !saving, intervalMs: 25_000 });

  function clearFieldError(...keys: RegistrationFieldKey[]) {
    setFieldErrors((current) => {
      if (!keys.some((key) => current[key])) return current;
      const next = { ...current };
      keys.forEach((key) => delete next[key]);
      return next;
    });
  }

  function showFormError(message: string) {
    setError(message);
    setNotice("");
    feedbackRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }

  function handleHorseImageChange(fileList: FileList | null) {
    const picked = fileList?.[0] ?? null;
    if (!picked) return;
    if (!ALLOWED_IMAGE_TYPES.includes(picked.type as (typeof ALLOWED_IMAGE_TYPES)[number])) {
      const message = "Ảnh ngựa chỉ chấp nhận định dạng JPG, PNG hoặc WebP.";
      setFieldErrors((current) => ({ ...current, horseImage: message }));
      showFormError(message);
      if (horseImageInputRef.current) horseImageInputRef.current.value = "";
      return;
    }
    if (picked.size > MAX_PRECOMPRESS_BYTES) {
      const message = "Ảnh ngựa gốc vượt quá 25 MB. Vui lòng chọn ảnh nhẹ hơn.";
      setFieldErrors((current) => ({ ...current, horseImage: message }));
      showFormError(message);
      if (horseImageInputRef.current) horseImageInputRef.current.value = "";
      return;
    }
    clearFieldError("horseImage");
    setError("");
    setHorseImage(picked);
    setRemoveExistingImage(false);
  }

  function clearSelectedHorseImage() {
    clearFieldError("horseImage");
    setHorseImage(null);
    if (horseImageInputRef.current) horseImageInputRef.current.value = "";
  }

  function handleAddDocuments(category: DocumentCategory, fileList: FileList | null, inputElement: HTMLInputElement) {
    const incoming = Array.from(fileList ?? []).filter((file) => file.size > 0);
    inputElement.value = "";
    if (!incoming.length) return;

    const targetKey: RegistrationFieldKey =
      category === "OWNERSHIP_PROOF" || category === "HEALTH_DOCUMENT" ? category : "documents";
    const invalidType = incoming.find((file) => !ALLOWED_DOC_TYPES.includes(file.type as (typeof ALLOWED_DOC_TYPES)[number]));
    if (invalidType) {
      const message = `Tệp “${invalidType.name}” không đúng định dạng PDF, JPG, PNG hoặc WebP.`;
      setFieldErrors((current) => ({ ...current, [targetKey]: message }));
      showFormError(message);
      return;
    }
    const tooLarge = incoming.find((file) => file.size > MAX_PRECOMPRESS_BYTES);
    if (tooLarge) {
      const message = `Tệp “${tooLarge.name}” vượt quá 25 MB.`;
      setFieldErrors((current) => ({ ...current, [targetKey]: message }));
      showFormError(message);
      return;
    }
    const activeExistingDocCount = editingRequest
      ? editingRequest.documents.filter((doc) => !removedDocIds.includes(doc.id)).length
      : 0;
    if (activeExistingDocCount + selectedDocs.length + incoming.length > 5) {
      const currentTotal = activeExistingDocCount + selectedDocs.length;
      const message = editingRequest
        ? `Tổng số giấy tờ hiện hành tối đa 5 tệp (hiện có ${currentTotal}/5 tệp; hãy gỡ bớt tệp cũ hoặc tệp mới nếu muốn tải thêm).`
        : `Mỗi lần gửi tối đa 5 tệp giấy tờ cho cả 4 mục (hiện đã chọn ${selectedDocs.length}/5 tệp).`;
      setFieldErrors((current) => ({ ...current, [targetKey]: message }));
      showFormError(message);
      return;
    }
    clearFieldError(
      "documents",
      ...(category === "OWNERSHIP_PROOF" || category === "HEALTH_DOCUMENT" ? [category] : []),
    );
    setError("");
    setSelectedDocs((current) => [
      ...current,
      ...incoming.map((file, idx) => ({
        id: `${Date.now()}-${idx}-${Math.random().toString(36).slice(2, 8)}`,
        file,
        type: category,
      })),
    ]);
  }

  function removeSelectedDocument(id: string) {
    clearFieldError("documents");
    setSelectedDocs((current) => current.filter((item) => item.id !== id));
  }

  function toggleRemoveExistingDoc(docId: string, category: DocumentCategory) {
    const isCurrentlyRemoved = removedDocIds.includes(docId);
    const activeExistingDocCount = editingRequest
      ? editingRequest.documents.filter((doc) => !removedDocIds.includes(doc.id)).length
      : 0;
    if (isCurrentlyRemoved && activeExistingDocCount + selectedDocs.length >= 5) {
      const message = "Tổng số giấy tờ hiện hành tối đa 5 tệp. Hãy bỏ bớt tệp mới hoặc gỡ tệp khác trước khi giữ lại.";
      setFieldErrors((current) => ({ ...current, documents: message }));
      showFormError(message);
      return;
    }
    setRemovedDocIds((current) =>
      isCurrentlyRemoved ? current.filter((id) => id !== docId) : [...current, docId],
    );
    clearFieldError(
      "documents",
      ...(category === "OWNERSHIP_PROOF" || category === "HEALTH_DOCUMENT" ? [category] : []),
    );
    setError("");
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const values = new FormData(form);
    const horseName = String(values.get("horseName") ?? "").trim();
    const isRegister = requestType === "REGISTER";
    const rawBirthYear = isRegister ? String(values.get("birthYear") ?? "").trim() : "";
    const rawHeight = isRegister ? String(values.get("heightCm") ?? "").trim() : "";
    const rawWeight = isRegister ? String(values.get("currentWeightKg") ?? "").trim() : "";
    const currentYear = new Date().getFullYear();
    const isBadInput = (name: string) =>
      Boolean((form.elements.namedItem(name) as HTMLInputElement | null)?.validity?.badInput);

    const nextErrors: RegistrationFieldErrors = {};
    if (!horseName) {
      nextErrors.horseName = "Vui lòng nhập tên ngựa.";
    } else if (horseName.length < 2) {
      nextErrors.horseName = "Tên ngựa phải có ít nhất 2 ký tự.";
    } else if (horseName.length > 100) {
      nextErrors.horseName = "Tên ngựa không được vượt quá 100 ký tự.";
    }

    let birthYear: number | null = null;
    if (isRegister) {
      if (isBadInput("birthYear")) {
        nextErrors.birthYear = "Năm sinh phải là số nguyên hợp lệ.";
      } else if (rawBirthYear) {
        birthYear = Number(rawBirthYear);
        if (!Number.isInteger(birthYear) || birthYear < 1900 || birthYear > currentYear) {
          nextErrors.birthYear = `Năm sinh phải nằm trong khoảng 1900 đến ${currentYear}.`;
        }
      }
    }

    let heightCm: number | null = null;
    if (isRegister) {
      if (isBadInput("heightCm")) {
        nextErrors.heightCm = "Chiều cao phải là số hợp lệ.";
      } else if (rawHeight) {
        heightCm = Number(rawHeight);
        if (!Number.isFinite(heightCm) || heightCm < 50 || heightCm > 250 || !/^\d+(\.\d)?$/.test(rawHeight)) {
          nextErrors.heightCm = "Chiều cao phải nằm trong khoảng 50–250 cm và tối đa 1 chữ số thập phân.";
        }
      }
    }

    let currentWeightKg: number | null = null;
    if (isRegister) {
      if (isBadInput("currentWeightKg")) {
        nextErrors.currentWeightKg = "Cân nặng phải là số hợp lệ.";
      } else if (rawWeight) {
        currentWeightKg = Number(rawWeight);
        if (!Number.isFinite(currentWeightKg) || currentWeightKg < 100 || currentWeightKg > 900 || !/^\d+(\.\d{1,2})?$/.test(rawWeight)) {
          nextErrors.currentWeightKg = "Cân nặng phải nằm trong khoảng 100–900 kg và tối đa 2 chữ số thập phân.";
        }
      }
    }

    const activeExisting = editingRequest
      ? editingRequest.documents.filter((doc) => !removedDocIds.includes(doc.id))
      : [];
    const hasOwnershipProof =
      activeExisting.some((doc) => doc.document_type === "OWNERSHIP_PROOF") ||
      selectedDocs.some((item) => item.type === "OWNERSHIP_PROOF");
    const hasHealthDocument =
      activeExisting.some((doc) => doc.document_type === "HEALTH_DOCUMENT") ||
      selectedDocs.some((item) => item.type === "HEALTH_DOCUMENT");
    if (!hasOwnershipProof) {
      nextErrors.OWNERSHIP_PROOF = editingRequest
        ? "Hồ sơ cần ít nhất 1 Giấy tờ chứng minh quyền sở hữu. Hãy giữ lại tệp cũ hoặc tải tệp thay thế."
        : isRegister
          ? "Vui lòng đính kèm ít nhất 1 Giấy tờ chứng minh quyền sở hữu."
          : "Vui lòng đính kèm ít nhất 1 Giấy tờ chứng minh quyền sở hữu để liên kết hồ sơ.";
    }
    if (isRegister && !hasHealthDocument) {
      nextErrors.HEALTH_DOCUMENT = editingRequest
        ? "Đăng ký ngựa mới cần ít nhất 1 Hồ sơ sức khỏe. Hãy giữ lại tệp cũ hoặc tải tệp thay thế."
        : "Vui lòng đính kèm ít nhất 1 Hồ sơ sức khỏe trước khi nhập chuồng.";
    }
    if (activeExisting.length + selectedDocs.length > 5) {
      nextErrors.documents = editingRequest
        ? "Tổng số giấy tờ hiện hành tối đa 5 tệp cho cả 4 mục."
        : "Mỗi lần gửi tối đa 5 giấy tờ xác minh cho cả 4 mục.";
    }

    if (Object.keys(nextErrors).length > 0) {
      if (nextErrors.heightCm || nextErrors.currentWeightKg) {
        setShowExtraSpecs(true);
      }
      setFieldErrors(nextErrors);
      setError("Vui lòng kiểm tra và hoàn thiện các mục được đánh dấu đỏ bên dưới.");
      setNotice("");
      const fieldOrder: RegistrationFieldKey[] = [
        "horseName",
        "birthYear",
        "heightCm",
        "currentWeightKg",
        "horseImage",
        "OWNERSHIP_PROOF",
        "HEALTH_DOCUMENT",
        "documents",
      ];
      const firstKey = fieldOrder.find((key) => Boolean(nextErrors[key]));
      if (firstKey) {
        window.requestAnimationFrame(() => {
          const named = form.elements.namedItem(firstKey);
          const target =
            named instanceof HTMLElement
              ? named
              : form.querySelector<HTMLElement>(`[data-field-key="${firstKey}"]`);
          if (target) {
            target.scrollIntoView({ behavior: "smooth", block: "center" });
            const focusTarget =
              target instanceof HTMLInputElement ||
              target instanceof HTMLTextAreaElement ||
              target instanceof HTMLSelectElement
                ? target
                : target.querySelector<HTMLElement>("input, textarea, select");
            focusTarget?.focus({ preventScroll: true });
          }
        });
      }
      return;
    }

    setFieldErrors({});

    const normText = (value: string | null | undefined) => (value ?? "").trim() || null;
    const sameOptionalNum = (left: number | null | undefined, right: number | null | undefined) =>
      left == null && right == null ? true : left != null && right != null && Number(left) === Number(right);

    const input: HorseRegistrationSubmission = {
      requestType,
      horseName,
      breed: isRegister ? String(values.get("breed") ?? "").trim() || null : null,
      gender: isRegister ? String(values.get("gender") ?? "").trim() || null : null,
      birthYear,
      heightCm,
      currentWeightKg,
      pedigreeFather: isRegister ? String(values.get("pedigreeFather") ?? "").trim() || null : null,
      pedigreeMother: isRegister ? String(values.get("pedigreeMother") ?? "").trim() || null : null,
      microchipNumber: String(values.get("microchipNumber") ?? "").trim() || null,
      passportNumber: String(values.get("passportNumber") ?? "").trim() || null,
      ownerNote: String(values.get("ownerNote") ?? "").trim() || null,
      removeHorseImage: editingRequest ? removeExistingImage && !horseImage : undefined,
      removeDocumentIds: editingRequest && removedDocIds.length > 0 ? removedDocIds : undefined,
    };

    if (editingRequest) {
      const textChanged =
        input.horseName !== editingRequest.horse_name.trim() ||
        normText(input.microchipNumber) !== normText(editingRequest.microchip_number) ||
        normText(input.passportNumber) !== normText(editingRequest.passport_number) ||
        normText(input.ownerNote) !== normText(editingRequest.owner_note) ||
        (isRegister &&
          (normText(input.breed) !== normText(editingRequest.breed) ||
            normText(input.gender) !== normText(editingRequest.gender) ||
            !sameOptionalNum(input.birthYear, editingRequest.birth_year) ||
            !sameOptionalNum(input.heightCm, editingRequest.height_cm) ||
            !sameOptionalNum(input.currentWeightKg, editingRequest.current_weight_kg) ||
            normText(input.pedigreeFather) !== normText(editingRequest.pedigree_father) ||
            normText(input.pedigreeMother) !== normText(editingRequest.pedigree_mother)));
      const imageChanged =
        Boolean(horseImage) || (removeExistingImage && Boolean(editingRequest.horse_image_url));
      const docsChanged = removedDocIds.length > 0 || selectedDocs.length > 0;
      if (!textChanged && !imageChanged && !docsChanged) {
        showFormError("Bạn chưa thay đổi thông tin hoặc bổ sung/thay thế giấy tờ nào theo yêu cầu của Club Manager.");
        return;
      }
    }

    setSaving(true);
    setError("");
    setNotice("");
    clearProcessingTimer();
    const totalToCompress = (horseImage ? 1 : 0) + selectedDocs.length;
    setUploadProgress({
      percent: totalToCompress > 0 ? 8 : 25,
      stage: totalToCompress > 0 ? "compressing" : "uploading",
      label:
        totalToCompress > 0
          ? "Đang kiểm tra và tối ưu hình ảnh…"
          : "Đang tải hồ sơ lên máy chủ…",
    });
    try {
      let compressedCount = 0;
      const trackCompression = <T,>(promise: Promise<T>): Promise<T> =>
        promise.then((result) => {
          compressedCount += 1;
          if (totalToCompress > 0) {
            setUploadProgress({
              percent: Math.round(8 + (compressedCount / totalToCompress) * 17),
              stage: "compressing",
              label: "Đang kiểm tra và tối ưu hình ảnh…",
            });
          }
          return result;
        });

      const [compressedImage, compressedFiles] = await Promise.all([
        horseImage ? trackCompression(compressImageIfLarge(horseImage)) : Promise.resolve(null),
        Promise.all(selectedDocs.map((item) => trackCompression(compressImageIfLarge(item.file)))),
      ]);
      if (compressedImage && (compressedImage.size > 5 * 1024 * 1024 || !ALLOWED_IMAGE_TYPES.includes(compressedImage.type as (typeof ALLOWED_IMAGE_TYPES)[number]))) {
        const message = "Ảnh ngựa sau tối ưu vẫn vượt quá 5 MB hoặc sai định dạng JPG, PNG, WebP.";
        clearProcessingTimer();
        setUploadProgress(null);
        setFieldErrors({ horseImage: message });
        showFormError(message);
        setSaving(false);
        return;
      }
      const oversizedDoc = compressedFiles.find((file) => file.size > 10 * 1024 * 1024);
      if (oversizedDoc) {
        const message = `Tệp “${oversizedDoc.name}” vượt quá giới hạn 10 MB.`;
        clearProcessingTimer();
        setUploadProgress(null);
        setFieldErrors({ documents: message });
        showFormError(message);
        setSaving(false);
        return;
      }

      setUploadProgress({
        percent: 25,
        stage: "uploading",
        label: "Đang tải hồ sơ và giấy tờ lên máy chủ…",
      });
      const handleNetworkProgress = (fraction: number) => {
        if (fraction >= 1) {
          setUploadProgress((current) =>
            current && current.stage === "done"
              ? current
              : {
                  percent: Math.max(85, current?.percent ?? 85),
                  stage: "saving",
                  label: "Đang lưu tệp lên hệ thống lưu trữ và gửi Club Manager…",
                },
          );
          if (processingTimerRef.current === null) {
            processingTimerRef.current = window.setInterval(() => {
              setUploadProgress((current) => {
                if (!current || current.stage !== "saving" || current.percent >= 96) return current;
                return {
                  ...current,
                  percent: Math.min(96, current.percent + Math.max(1, Math.ceil((96 - current.percent) * 0.2))),
                };
              });
            }, 320);
          }
          return;
        }
        setUploadProgress({
          percent: Math.min(85, Math.round(25 + fraction * 60)),
          stage: "uploading",
          label: "Đang tải hồ sơ và giấy tờ lên máy chủ…",
        });
      };

      const documentTypes = selectedDocs.map((item) => item.type);
      const submittedRequest = editingRequest
        ? await resubmitHorseRegistrationRequest(
            editingRequest.id,
            input,
            compressedImage,
            compressedFiles,
            documentTypes,
            handleNetworkProgress,
          )
        : await submitHorseRegistrationRequest(
            input,
            compressedImage,
            compressedFiles,
            documentTypes,
            handleNetworkProgress,
          );
      clearProcessingTimer();
      setUploadProgress({
        percent: 100,
        stage: "done",
        label: editingRequest ? "Đã gửi bổ sung thành công!" : "Đã gửi hồ sơ thành công!",
      });
      await new Promise((resolve) => window.setTimeout(resolve, 550));

      const wasEditing = Boolean(editingRequest);
      setRequests((current) => [submittedRequest, ...current.filter((item) => item.id !== submittedRequest.id)]);
      form.reset();
      clearSelectedHorseImage();
      setRemoveExistingImage(false);
      setRemovedDocIds([]);
      setSelectedDocs([]);
      setFieldErrors({});
      setShowExtraSpecs(false);
      setRequestType("REGISTER");
      setEditingRequest(null);
      setUploadProgress(null);
      setActiveTab("history");
      setNotice(wasEditing ? "Đã gửi bổ sung hồ sơ cho Club Manager xem xét." : "Đã gửi hồ sơ ngựa cho Club Manager xác minh.");
      feedbackRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
    } catch (reason) {
      clearProcessingTimer();
      setUploadProgress(null);
      showFormError(errorMessage(reason));
    } finally {
      clearProcessingTimer();
      setSaving(false);
    }
  }

  function startCorrection(request: HorseRegistrationRequest) {
    setEditingRequest(request);
    setRequestType(request.request_type);
    setActiveTab("form");
    setShowExtraSpecs(
      Boolean(
        request.height_cm != null ||
          request.current_weight_kg != null ||
          request.pedigree_father ||
          request.pedigree_mother,
      ),
    );
    clearSelectedHorseImage();
    setRemoveExistingImage(false);
    setRemovedDocIds([]);
    setSelectedDocs([]);
    setFieldErrors({});
    setError("");
    setNotice("");
    window.requestAnimationFrame(() => {
      formRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  }

  function cancelCorrection() {
    setEditingRequest(null);
    setRequestType("REGISTER");
    setShowExtraSpecs(false);
    clearSelectedHorseImage();
    setRemoveExistingImage(false);
    setRemovedDocIds([]);
    setSelectedDocs([]);
    setFieldErrors({});
    setError("");
    setNotice("");
    formRef.current?.reset();
  }

  async function confirmTransferAnswer() {
    if (!pendingTransfer) return;
    const { request, action } = pendingTransfer;
    setTransferBusy(request.id);
    setError("");
    setNotice("");
    try {
      await respondToOwnershipTransfer(request.id, action, transferNotes[request.id]?.trim() || undefined);
      setPendingTransfer(null);
      setNotice(action === "CONSENT" ? "Đã xác nhận chuyển quyền sở hữu." : "Đã từ chối yêu cầu chuyển quyền sở hữu.");
      window.dispatchEvent(new Event("horse-owner-horses-changed"));
      await load();
    } catch (reason) {
      setPendingTransfer(null);
      showFormError(errorMessage(reason));
    } finally {
      setTransferBusy("");
    }
  }

  const activePreviewUrl = horseImagePreview ?? (!removeExistingImage ? editingRequest?.horse_image_url ?? null : null);
  const activeExistingDocs = editingRequest
    ? editingRequest.documents.filter((doc) => !removedDocIds.includes(doc.id))
    : [];
  const activeExistingCountByCategory = (category: DocumentCategory) =>
    activeExistingDocs.filter((doc) => doc.document_type === category).length;
  const existingDocsByCategory = (category: DocumentCategory) =>
    editingRequest ? editingRequest.documents.filter((doc) => doc.document_type === category) : [];
  const isOwnershipRequired = !editingRequest || activeExistingCountByCategory("OWNERSHIP_PROOF") === 0;
  const isHealthRequired =
    requestType === "REGISTER" && (!editingRequest || activeExistingCountByCategory("HEALTH_DOCUMENT") === 0);
  const totalActiveDocCount = activeExistingDocs.length + selectedDocs.length;
  const needsInfoCount = requests.filter((item) => item.status === "NEEDS_INFORMATION").length;

  function renderExistingCategoryDocs(category: DocumentCategory) {
    const docs = existingDocsByCategory(category);
    if (!editingRequest || docs.length === 0) return null;
    return (
      <ul className="mt-2.5 space-y-1.5">
        {docs.map((doc) => {
          const markedRemoved = removedDocIds.includes(doc.id);
          if (markedRemoved) {
            return (
              <li
                key={doc.id}
                className="flex items-center justify-between gap-2 rounded border border-amber-200 bg-amber-50 px-2.5 py-1.5 text-xs text-amber-900"
              >
                <span className="truncate" title={doc.name}>
                  Sẽ gỡ “{doc.name}” khi gửi bổ sung.
                </span>
                <button
                  type="button"
                  className="shrink-0 font-semibold underline"
                  onClick={() => toggleRemoveExistingDoc(doc.id, category)}
                >
                  <RotateCcw size={12} className="inline mr-1" />
                  Giữ lại
                </button>
              </li>
            );
          }
          return (
            <li
              key={doc.id}
              className="flex items-center justify-between gap-2 rounded-md border border-slate-200 bg-white px-2.5 py-1.5 text-xs"
            >
              <div className="min-w-0 flex items-center gap-1.5">
                <FileText size={13} className="shrink-0 text-teal-700" />
                <span className="truncate font-medium text-slate-800" title={doc.name}>
                  {doc.name}
                </span>
                <span className="shrink-0 text-[11px] text-slate-400">· Lần {doc.revision_no}</span>
              </div>
              <div className="flex shrink-0 items-center gap-1">
                <button
                  type="button"
                  className="rounded px-1.5 py-0.5 text-[11px] font-medium text-teal-700 hover:bg-teal-50"
                  onClick={() =>
                    void openFreshDocument(() => getOwnerRegistrationDocumentUrl(editingRequest.id, doc.id), doc.url)
                  }
                >
                  <Eye size={12} className="inline mr-0.5" />
                  Xem
                </button>
                <button
                  type="button"
                  className="rounded px-1.5 py-0.5 text-[11px] font-medium text-rose-700 hover:bg-rose-50"
                  onClick={() => toggleRemoveExistingDoc(doc.id, category)}
                >
                  <Trash2 size={12} className="inline mr-0.5" />
                  Gỡ
                </button>
              </div>
            </li>
          );
        })}
      </ul>
    );
  }

  function renderDocumentCard(
    category: DocumentCategory,
    title: string,
    hint: string,
    options: { required?: boolean } = {},
  ) {
    const existingCount = activeExistingCountByCategory(category);
    const addedDocs = selectedDocs.filter((item) => item.type === category);
    const fieldError =
      category === "OWNERSHIP_PROOF" || category === "HEALTH_DOCUMENT" ? fieldErrors[category] : undefined;
    const showOptionalTag = !options.required && !(editingRequest && existingCount > 0);
    const fieldKey =
      category === "OWNERSHIP_PROOF" || category === "HEALTH_DOCUMENT" ? category : undefined;

    return (
      <div
        key={category}
        data-field-key={fieldKey}
        className={`rounded-lg border p-3 transition ${
          fieldError ? "border-rose-300 bg-rose-50/50" : "border-slate-200 bg-white"
        }`}
      >
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-1.5 text-sm font-semibold text-equine-navy">
              <FileCheck2 size={15} className="shrink-0 text-equine-teal" />
              <span>
                {title}
                {options.required ? (
                  <span className="ml-1 text-rose-600">*</span>
                ) : showOptionalTag ? (
                  <span className="font-normal text-slate-500"> (nếu có)</span>
                ) : null}
              </span>
              {editingRequest && existingCount > 0 && (
                <span className="rounded-full border border-teal-200 bg-teal-50 px-2 py-0.5 text-[11px] font-medium text-teal-800">
                  Đã có {existingCount} tệp
                </span>
              )}
            </div>
            <p className="mt-0.5 text-[11px] text-slate-500">{hint}</p>
          </div>
          <label className="inline-flex shrink-0 cursor-pointer items-center gap-1.5 rounded-md border border-slate-300 bg-slate-50 px-2.5 py-1.5 text-xs font-medium text-slate-700 transition hover:bg-slate-100 focus-within:ring-2 focus-within:ring-equine-blue">
            <Upload size={13} className="text-slate-600" />
            <span>Chọn tệp</span>
            <input
              className="sr-only"
              type="file"
              accept="application/pdf,image/jpeg,image/png,image/webp"
              multiple
              aria-invalid={Boolean(fieldError)}
              onChange={(event) => handleAddDocuments(category, event.currentTarget.files, event.currentTarget)}
            />
          </label>
        </div>

        {renderExistingCategoryDocs(category)}

        {addedDocs.length > 0 && (
          <ul className="mt-2.5 space-y-1.5">
            {addedDocs.map((item) => (
              <li
                key={item.id}
                className="es-pop-in flex items-center justify-between gap-2 rounded-md border border-sky-200 bg-sky-50/60 px-2.5 py-1.5 text-xs"
              >
                <div className="flex min-w-0 items-center gap-1.5">
                  <FileText size={13} className="shrink-0 text-equine-blue" />
                  <span className="truncate font-medium text-slate-800" title={item.file.name}>
                    {item.file.name}
                  </span>
                  <span className="shrink-0 text-[11px] text-slate-500">· {formatFileSize(item.file.size)}</span>
                  <span className="shrink-0 rounded bg-sky-100 px-1.5 py-0.5 text-[10px] font-semibold text-sky-800">
                    Mới
                  </span>
                </div>
                <button
                  type="button"
                  className="shrink-0 rounded p-1 text-slate-400 hover:bg-rose-50 hover:text-rose-700"
                  aria-label={`Xóa tệp ${item.file.name}`}
                  onClick={() => removeSelectedDocument(item.id)}
                >
                  <X size={13} />
                </button>
              </li>
            ))}
          </ul>
        )}

        {fieldError && (
          <p className="mt-2 text-xs font-medium text-rose-600" role="alert">
            {fieldError}
          </p>
        )}
      </div>
    );
  }

  return (
    <section className="overflow-hidden rounded-lg border border-equine-line bg-white shadow-sm" aria-labelledby="horse-registration-title">
      <header className="border-b border-equine-line bg-slate-50 p-4 sm:p-5">
        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_240px] lg:items-center">
          <div>
            <h2 id="horse-registration-title" className="font-sans text-xl font-semibold tracking-tight text-equine-navy sm:text-2xl">
              {editingRequest ? `Bổ sung hồ sơ: ${editingRequest.horse_name}` : "Hồ sơ & đăng ký ngựa"}
            </h2>
            <p className="mt-1 text-sm text-slate-600">
              {editingRequest
                ? `Thông tin cũ đã được điền sẵn. Hãy chỉnh sửa mục cần thiết hoặc bổ sung/thay thế giấy tờ theo yêu cầu của Club Manager (Lần ${editingRequest.revision_no + 1}).`
                : "Đăng ký ngựa mới vào câu lạc bộ, liên kết hồ sơ có sẵn hoặc theo dõi trạng thái xử lý."}
            </p>
          </div>
          <div className="relative hidden h-24 overflow-hidden rounded-lg sm:block lg:h-24">
            <Image src="/img/hero-racehorse.webp" alt="Ngựa đua trên đường tập" fill priority sizes="240px" className="object-cover object-center" />
          </div>
        </div>
      </header>

      <div className="p-4 sm:p-6">
        <div ref={feedbackRef}>
          {error && <div className="mb-4"><Notice error>{error}</Notice></div>}
          {notice && <div className="mb-4"><Notice variant="success">{notice}</Notice></div>}
          {historyError && <div className="mb-4"><Notice error>
            {historyError.toLowerCase().includes("authentication required")
              ? <>Đăng nhập bằng Horse Owner để gửi hồ sơ. <Link href={Routes.login} className="font-semibold underline underline-offset-2">Đăng nhập</Link>.</>
              : historyError}
          </Notice></div>}
        </div>

        {transferRequests.length > 0 && <section className="mb-5 rounded-lg border border-amber-200 bg-amber-50/70 p-4" aria-labelledby="ownership-consent-title">
          <h3 id="ownership-consent-title" className="font-semibold text-equine-navy">Yêu cầu chuyển quyền cần bạn xác nhận</h3>
          <div className="mt-3 space-y-3">
            {transferRequests.map((request) => <article data-notification-target={request.id} key={request.id} className="rounded-lg border border-amber-200 bg-white p-4">
              <p className="font-semibold text-equine-navy">{request.horse_name}</p>
              <p className="mt-1 text-sm text-slate-600">Mã ngựa {request.horse_id.slice(0, 8)} · {request.requester_name ?? "Horse Owner"} đề nghị nhận quyền sở hữu. Club Manager đã xem xét hồ sơ.</p>
              {request.owner_note && <p className="mt-2 whitespace-pre-wrap text-sm text-slate-600">Ghi chú: {request.owner_note}</p>}
              <label className="mt-3 block"><span className="field-label">Ghi chú (không bắt buộc)</span>
                <textarea className="field-control min-h-20 px-3 py-2" maxLength={1000} value={transferNotes[request.id] ?? ""} onChange={(event) => setTransferNotes((current) => ({ ...current, [request.id]: event.target.value }))} />
              </label>
              <div className="mt-3 flex flex-wrap gap-2">
                <button type="button" className="gold-button" disabled={Boolean(transferBusy)} onClick={() => setPendingTransfer({ request, action: "CONSENT" })}>{transferBusy === request.id ? "Đang lưu…" : "Đồng ý chuyển quyền"}</button>
                <button type="button" className="soft-button border-rose-200 bg-rose-50 text-rose-800" disabled={Boolean(transferBusy)} onClick={() => setPendingTransfer({ request, action: "DECLINE" })}>Từ chối</button>
              </div>
            </article>)}
          </div>
        </section>}

        <div className="mb-5 flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 pb-3" role="tablist" aria-label="Khu vực hồ sơ ngựa">
          <div className="inline-flex rounded-lg border border-slate-200 bg-slate-100/80 p-1">
            <button
              type="button"
              role="tab"
              aria-selected={activeTab === "form"}
              className={`inline-flex items-center gap-1.5 rounded-md px-3.5 py-1.5 text-xs font-semibold transition ${
                activeTab === "form"
                  ? "bg-white text-equine-navy shadow-xs"
                  : "text-slate-600 hover:text-equine-navy"
              }`}
              onClick={() => setActiveTab("form")}
            >
              <FilePlus2 size={14} />
              {editingRequest ? `Bổ sung: ${editingRequest.horse_name}` : "Gửi yêu cầu mới"}
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={activeTab === "history"}
              className={`inline-flex items-center gap-1.5 rounded-md px-3.5 py-1.5 text-xs font-semibold transition ${
                activeTab === "history"
                  ? "bg-white text-equine-navy shadow-xs"
                  : "text-slate-600 hover:text-equine-navy"
              }`}
              onClick={() => setActiveTab("history")}
            >
              <ClipboardList size={14} />
              Yêu cầu của tôi
              <span className="rounded-full bg-slate-200/80 px-2 py-0.5 text-[11px] font-bold text-slate-700">
                {requests.length}
              </span>
              {needsInfoCount > 0 && (
                <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold text-amber-800">
                  <span className="size-1.5 rounded-full bg-amber-500 animate-pulse" />
                  {needsInfoCount} cần bổ sung
                </span>
              )}
            </button>
          </div>
          {editingRequest && activeTab === "form" && (
            <button type="button" className="soft-button !min-h-[32px] !px-3 !text-xs" onClick={cancelCorrection}>
              Hủy bổ sung
            </button>
          )}
        </div>

        <form
          ref={formRef}
          key={editingRequest ? `${editingRequest.id}-${editingRequest.revision_no}` : "new-registration"}
          className={activeTab === "form" ? "es-panel-in space-y-4" : "hidden"}
          noValidate
          onSubmit={(event) => void submit(event)}
        >
          {editingRequest && (
            <div className="rounded-lg border border-amber-200 bg-amber-50/80 p-3.5 text-xs text-amber-950 space-y-2">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="font-semibold text-sm">Đang bổ sung hồ sơ: {editingRequest.horse_name} · Lần {editingRequest.revision_no + 1}</p>
                <span className="text-[11px] text-amber-800">
                  {editingRequest.documents.length > 0
                    ? `Đã giữ ${editingRequest.documents.length} tệp cũ trong từng mục bên phải`
                    : "Có thể chỉnh sửa thông tin và đính kèm tệp"}
                </span>
              </div>
              {editingRequest.review_note && (
                <p className="rounded-md border border-amber-200 bg-white p-2.5 whitespace-pre-wrap">
                  <strong className="block text-amber-900 mb-0.5">Yêu cầu bổ sung từ Club Manager:</strong>
                  {editingRequest.review_note}
                </p>
              )}
            </div>
          )}

          <div className="grid gap-6 lg:grid-cols-12 lg:items-start">
            {/* Left column: Horse details */}
            <section className="lg:col-span-7 rounded-xl border border-slate-200/90 bg-white p-4 sm:p-5 space-y-4">
              <div className="flex items-center gap-2.5 pb-2 border-b border-slate-100">
                <span className="grid h-8 w-8 place-items-center rounded-md bg-teal-50 text-equine-teal"><ClipboardList size={17} /></span>
                <h3 className="font-sans text-base font-semibold text-equine-navy">Thông tin ngựa</h3>
              </div>

              <div>
                <span className="field-label">Loại yêu cầu</span>
                <div className="grid grid-cols-2 gap-2">
                  {(
                    [
                      { value: "REGISTER", title: "Đăng ký ngựa mới", desc: "Tạo hồ sơ và xếp chuồng" },
                      { value: "LINK", title: "Liên kết hồ sơ có sẵn", desc: "Nhận/chuyển quyền ngựa trong CLB" },
                    ] as const
                  ).map((option) => {
                    const active = requestType === option.value;
                    return (
                      <button
                        key={option.value}
                        type="button"
                        disabled={Boolean(editingRequest)}
                        onClick={() => {
                          setRequestType(option.value);
                          setFieldErrors({});
                          setError("");
                        }}
                        className={`rounded-lg border px-3 py-2.5 text-left transition ${
                          active
                            ? "border-equine-blue bg-blue-50/70 ring-1 ring-equine-blue/30"
                            : "border-slate-200 bg-slate-50/70 hover:border-slate-300 hover:bg-white"
                        } ${editingRequest ? "cursor-not-allowed opacity-70" : ""}`}
                      >
                        <p className={`text-xs font-semibold ${active ? "text-equine-navy" : "text-slate-700"}`}>
                          {option.title}
                        </p>
                        <p className="mt-0.5 text-[11px] text-slate-500">{option.desc}</p>
                      </button>
                    );
                  })}
                </div>
              </div>

              {requestType === "LINK" && (
                <Notice>
                  Để liên kết với hồ sơ ngựa đã có trong CLB, hãy nhập đúng <strong>Tên ngựa</strong>, kèm <strong>Số microchip</strong> hoặc <strong>Số hộ chiếu</strong> (nếu đã biết) và đính kèm giấy tờ chứng minh quyền sở hữu để Club Manager đối chiếu.
                </Notice>
              )}

              <div className="grid gap-3 sm:grid-cols-2">
                <label className="block sm:col-span-2">
                  <span className="field-label">Tên ngựa <span className="text-rose-600">*</span></span>
                  <input
                    className={`field-control px-3 ${fieldErrors.horseName ? "!border-rose-400 bg-rose-50/40 focus:!border-rose-500" : ""}`}
                    name="horseName"
                    minLength={2}
                    maxLength={100}
                    placeholder="Ví dụ: Golden Wind (tối thiểu 2 ký tự)"
                    defaultValue={editingRequest?.horse_name ?? ""}
                    aria-invalid={Boolean(fieldErrors.horseName)}
                    onChange={() => clearFieldError("horseName")}
                    required
                  />
                  {fieldErrors.horseName && <span className="mt-1 block text-xs font-medium text-rose-600" role="alert">{fieldErrors.horseName}</span>}
                </label>

                {requestType === "REGISTER" && (
                  <>
                    <label className="block"><span className="field-label">Giống</span><input className="field-control px-3" name="breed" maxLength={50} placeholder="Thoroughbred, Arab…" defaultValue={editingRequest?.breed ?? ""} /></label>
                    <label className="block">
                      <span className="field-label">Giới tính</span>
                      <select className="field-control px-3 cursor-pointer" name="gender" defaultValue={editingRequest?.gender ?? ""}>
                        <option value="">Chưa chọn</option>
                        <option value="Male">Đực</option>
                        <option value="Female">Cái</option>
                        <option value="Gelding">Đực thiến</option>
                      </select>
                    </label>
                    <label className="block">
                      <span className="field-label">Năm sinh</span>
                      <input
                        className={`field-control px-3 ${fieldErrors.birthYear ? "!border-rose-400 bg-rose-50/40 focus:!border-rose-500" : ""}`}
                        name="birthYear"
                        type="number"
                        min="1900"
                        max={new Date().getFullYear()}
                        placeholder="2021"
                        defaultValue={editingRequest?.birth_year ?? ""}
                        aria-invalid={Boolean(fieldErrors.birthYear)}
                        onChange={() => clearFieldError("birthYear")}
                      />
                      {fieldErrors.birthYear && <span className="mt-1 block text-xs font-medium text-rose-600" role="alert">{fieldErrors.birthYear}</span>}
                    </label>
                  </>
                )}

                <label className="block"><span className="field-label">Số microchip</span><input className="field-control px-3" name="microchipNumber" maxLength={100} placeholder="Nếu có" defaultValue={editingRequest?.microchip_number ?? ""} /></label>
                <label className="block"><span className="field-label">Số hộ chiếu ngựa</span><input className="field-control px-3" name="passportNumber" maxLength={100} placeholder="Nếu có" defaultValue={editingRequest?.passport_number ?? ""} /></label>
              </div>

              {requestType === "REGISTER" && (
                <div className="rounded-lg border border-slate-200/80 bg-slate-50/60 p-3">
                  <button
                    type="button"
                    aria-expanded={showExtraSpecs}
                    onClick={() => setShowExtraSpecs((current) => !current)}
                    className="flex w-full items-center justify-between text-xs font-semibold text-equine-navy"
                  >
                    <span>Thông số thể chất & phả hệ (không bắt buộc)</span>
                    <ChevronDown
                      size={15}
                      className={`text-slate-500 transition-transform duration-200 ${showExtraSpecs ? "rotate-180" : ""}`}
                    />
                  </button>
                  <div className={showExtraSpecs ? "mt-3 grid gap-3 sm:grid-cols-2 es-panel-in" : "hidden"}>
                    <label className="block">
                      <span className="field-label">Chiều cao (cm)</span>
                      <input
                        className={`field-control px-3 ${fieldErrors.heightCm ? "!border-rose-400 bg-rose-50/40 focus:!border-rose-500" : ""}`}
                        name="heightCm"
                        type="number"
                        min="50"
                        max="250"
                        step="0.1"
                        placeholder="165"
                        defaultValue={editingRequest?.height_cm ?? ""}
                        aria-invalid={Boolean(fieldErrors.heightCm)}
                        onChange={() => clearFieldError("heightCm")}
                      />
                      {fieldErrors.heightCm && <span className="mt-1 block text-xs font-medium text-rose-600" role="alert">{fieldErrors.heightCm}</span>}
                    </label>
                    <label className="block">
                      <span className="field-label">Cân nặng (kg)</span>
                      <input
                        className={`field-control px-3 ${fieldErrors.currentWeightKg ? "!border-rose-400 bg-rose-50/40 focus:!border-rose-500" : ""}`}
                        name="currentWeightKg"
                        type="number"
                        min="100"
                        max="900"
                        step="0.01"
                        placeholder="480"
                        defaultValue={editingRequest?.current_weight_kg ?? ""}
                        aria-invalid={Boolean(fieldErrors.currentWeightKg)}
                        onChange={() => clearFieldError("currentWeightKg")}
                      />
                      {fieldErrors.currentWeightKg && <span className="mt-1 block text-xs font-medium text-rose-600" role="alert">{fieldErrors.currentWeightKg}</span>}
                    </label>
                    <label className="block"><span className="field-label">Tên ngựa cha</span><input className="field-control px-3" name="pedigreeFather" maxLength={100} defaultValue={editingRequest?.pedigree_father ?? ""} /></label>
                    <label className="block"><span className="field-label">Tên ngựa mẹ</span><input className="field-control px-3" name="pedigreeMother" maxLength={100} defaultValue={editingRequest?.pedigree_mother ?? ""} /></label>
                  </div>
                </div>
              )}

              <label className="block">
                <span className="field-label">Ghi chú thêm</span>
                <textarea className="field-control min-h-[76px] px-3 py-2" name="ownerNote" maxLength={1000} placeholder="Thông tin bổ sung (nếu có)." defaultValue={editingRequest?.owner_note ?? ""} />
              </label>
            </section>

            {/* Right column: Photo & documents */}
            <section className="lg:col-span-5 rounded-xl border border-slate-200/90 bg-slate-50/50 p-4 sm:p-5 space-y-3.5">
              <div className="flex flex-wrap items-center justify-between gap-2 pb-2 border-b border-slate-200/80">
                <div className="flex items-center gap-2">
                  <span className="grid h-8 w-8 place-items-center rounded-md bg-teal-50 text-equine-teal"><ImagePlus size={17} /></span>
                  <h3 className="font-sans text-base font-semibold text-equine-navy">
                    Ảnh & giấy tờ {(!editingRequest || isOwnershipRequired || isHealthRequired) && <span className="text-rose-600">*</span>}
                  </h3>
                </div>
                <span className={`rounded-full px-2.5 py-0.5 text-[11px] font-semibold border ${totalActiveDocCount >= 5 ? "bg-amber-50 border-amber-200 text-amber-800" : "bg-white border-slate-200 text-slate-700"}`}>
                  {editingRequest ? `Đang có ${totalActiveDocCount}/5 tệp` : `Đã chọn ${selectedDocs.length}/5 tệp`}
                </span>
              </div>

              <p className="text-[11px] leading-relaxed text-slate-500">
                {editingRequest
                  ? "Tệp đã nộp nằm trong từng mục bên dưới (tối đa 5 tệp hiện hành, PDF hoặc ảnh ≤ 10 MB)."
                  : requestType === "REGISTER"
                    ? "Cần ít nhất 1 Giấy tờ chứng minh quyền sở hữu và 1 Hồ sơ sức khỏe (tổng tối đa 5 tệp, ≤ 10 MB/tệp)."
                    : "Cần ít nhất 1 Giấy tờ chứng minh quyền sở hữu (tổng tối đa 5 tệp, ≤ 10 MB/tệp)."}
              </p>

              {/* Compact horse photo row */}
              <div
                data-field-key="horseImage"
                className={`rounded-lg border p-3 transition ${
                  fieldErrors.horseImage ? "border-rose-300 bg-rose-50/50" : "border-slate-200 bg-white"
                }`}
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="flex min-w-0 items-center gap-3">
                    {activePreviewUrl ? (
                      <div className="h-12 w-12 shrink-0 overflow-hidden rounded-md border border-equine-line bg-slate-50">
                        <HorseImage
                          horse={{ id: "horse-registration-preview", horse_name: "Ảnh ngựa xem trước", image_url: activePreviewUrl } as Horse}
                          preview={activePreviewUrl}
                        />
                      </div>
                    ) : (
                      <span className="grid h-10 w-10 shrink-0 place-items-center rounded-md bg-slate-100 text-slate-400">
                        <ImagePlus size={18} />
                      </span>
                    )}
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-equine-navy">Ảnh ngựa <span className="font-normal text-slate-500">(không bắt buộc)</span></p>
                      <p className="text-[11px] text-slate-500">JPG, PNG, WebP · tự tối ưu dưới 5 MB</p>
                    </div>
                  </div>
                  <div className="flex shrink-0 items-center gap-1.5">
                    {horseImage ? (
                      <button type="button" className="soft-button !min-h-[30px] !px-2.5 !text-xs" onClick={clearSelectedHorseImage}>
                        <Trash2 size={12} /> Bỏ
                      </button>
                    ) : editingRequest?.horse_image_url && !removeExistingImage ? (
                      <button type="button" className="soft-button !min-h-[30px] !px-2.5 !text-xs text-rose-700" onClick={() => setRemoveExistingImage(true)}>
                        <Trash2 size={12} /> Xóa
                      </button>
                    ) : null}
                    <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-md border border-equine-navy bg-equine-navy px-2.5 py-1.5 text-xs font-semibold text-white transition hover:bg-[#1e3a5f] focus-within:ring-2 focus-within:ring-equine-blue">
                      <Upload size={12} />
                      <span>{activePreviewUrl ? "Đổi" : "Chọn ảnh"}</span>
                      <input
                        ref={horseImageInputRef}
                        className="sr-only"
                        type="file"
                        accept="image/jpeg,image/png,image/webp"
                        aria-invalid={Boolean(fieldErrors.horseImage)}
                        onChange={(event) => handleHorseImageChange(event.currentTarget.files)}
                      />
                    </label>
                  </div>
                </div>
                {editingRequest?.horse_image_url && removeExistingImage && !horseImage && (
                  <div className="mt-2 flex items-center justify-between gap-2 rounded border border-amber-200 bg-amber-50 px-2.5 py-1.5 text-xs text-amber-900">
                    <span>Ảnh cũ sẽ được gỡ khi gửi bổ sung.</span>
                    <button type="button" className="font-semibold underline" onClick={() => setRemoveExistingImage(false)}>
                      <RotateCcw size={12} className="inline mr-1" />Giữ lại
                    </button>
                  </div>
                )}
                {fieldErrors.horseImage && <p className="mt-2 text-xs font-medium text-rose-600" role="alert">{fieldErrors.horseImage}</p>}
              </div>

              <div className="space-y-2.5">
                {renderDocumentCard(
                  "OWNERSHIP_PROOF",
                  "Giấy tờ chứng minh quyền sở hữu",
                  "Hợp đồng mua bán, giấy chuyển nhượng hoặc ủy quyền sở hữu",
                  { required: isOwnershipRequired },
                )}
                {requestType === "REGISTER" &&
                  renderDocumentCard(
                    "HEALTH_DOCUMENT",
                    "Hồ sơ sức khỏe",
                    "Sổ tiêm phòng, giấy khám thú y đầu vào trước khi nhập chuồng",
                    { required: isHealthRequired },
                  )}
              </div>

              <div className="space-y-2.5 pt-1">
                <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                  Giấy tờ tùy chọn (nếu có)
                </p>
                {renderDocumentCard(
                  "HORSE_CERTIFICATE",
                  "Chứng nhận ngựa",
                  "Giấy chứng nhận giống, phả hệ hoặc giấy đăng ký hiệp hội",
                )}
                {requestType === "LINK" &&
                  renderDocumentCard(
                    "HEALTH_DOCUMENT",
                    "Hồ sơ sức khỏe",
                    "Sổ tiêm phòng hoặc giấy khám thú y để Club Manager tham khảo",
                  )}
                {renderDocumentCard(
                  "OTHER",
                  "Tài liệu khác",
                  "PDF hoặc ảnh bổ sung khác (tối đa 10 MB/tệp)",
                )}
              </div>

              {fieldErrors.documents && (
                <p data-field-key="documents" className="text-xs font-medium text-rose-600" role="alert">
                  {fieldErrors.documents}
                </p>
              )}
            </section>
          </div>

          <div className="flex flex-wrap items-center justify-end gap-2 border-t border-equine-line pt-4">
            {editingRequest && <button type="button" className="soft-button w-full justify-center sm:w-auto" disabled={saving} onClick={cancelCorrection}>Hủy bổ sung</button>}
            <button className="gold-button w-full justify-center px-5 py-3 sm:w-auto" disabled={saving}>
              {saving ? <Loader2 size={16} className="animate-spin" /> : <FilePlus2 size={16} />}
              {saving && uploadProgress
                ? `Đang gửi (${uploadProgress.percent}%)…`
                : editingRequest
                  ? "Gửi bổ sung"
                  : "Gửi yêu cầu"}
              {!saving && <ArrowRight size={16} />}
            </button>
          </div>
        </form>

        <section
          className={activeTab === "history" ? "es-panel-in" : "hidden"}
          aria-labelledby="horse-request-history-title"
        >
          <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-3"><span className="grid h-9 w-9 place-items-center rounded-xl bg-equine-paper text-equine-navy"><ClipboardList size={17} /></span><h3 id="horse-request-history-title" className="font-sans text-base font-semibold text-equine-navy">Danh sách yêu cầu đã gửi</h3></div>
            <span className="rounded-full border border-equine-line bg-equine-paper px-3 py-1 text-xs font-semibold text-equine-muted">{requests.length} yêu cầu</span>
          </div>
          <div className="space-y-4">
            {requests.map((request) => (
              <article data-notification-target={request.id} key={request.id} className="rounded-xl border border-slate-200 bg-white p-5 sm:p-6 shadow-sm transition hover:shadow-md">
                {/* Header */}
                <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-4">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2.5">
                      <h4 className="font-sans text-xl font-bold text-slate-900">{request.horse_name}</h4>
                      <span className="rounded-md bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-700">
                        {request.request_type === "LINK" ? "Liên kết hồ sơ" : "Đăng ký mới"}
                      </span>
                    </div>
                    <p className="mt-1 flex items-center gap-1.5 text-xs text-slate-500">
                      <Clock size={12} className="text-slate-400" />
                      Ngày gửi: {new Date(request.created_at).toLocaleDateString("vi-VN", { day: "2-digit", month: "2-digit", year: "numeric" })} · {new Date(request.created_at).toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" })}
                    </p>
                  </div>

                  {/* Status Badge & Actions */}
                  <div className="flex flex-wrap items-center gap-2.5">
                    {request.status === "APPROVED" && (
                      <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-3.5 py-1.5 text-xs font-semibold text-emerald-700 border border-emerald-200">
                        <CheckCircle2 size={14} /> {statusLabel.APPROVED}
                      </span>
                    )}
                    {request.status === "NEEDS_INFORMATION" && (
                      <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-50 px-3.5 py-1.5 text-xs font-semibold text-amber-800 border border-amber-200">
                        <AlertCircle size={14} /> {statusLabel.NEEDS_INFORMATION}
                      </span>
                    )}
                    {request.status === "REJECTED" && (
                      <span className="inline-flex items-center gap-1.5 rounded-full bg-rose-50 px-3.5 py-1.5 text-xs font-semibold text-rose-700 border border-rose-200">
                        <XCircle size={14} /> {statusLabel.REJECTED}
                      </span>
                    )}
                    {request.status === "PENDING" && (
                      <span className="inline-flex items-center gap-1.5 rounded-full bg-sky-50 px-3.5 py-1.5 text-xs font-semibold text-sky-700 border border-sky-200">
                        <Clock size={14} /> {statusLabel.PENDING}
                      </span>
                    )}
                    {request.status === "AWAITING_OWNER_CONSENT" && (
                      <span className="inline-flex items-center gap-1.5 rounded-full bg-purple-50 px-3.5 py-1.5 text-xs font-semibold text-purple-700 border border-purple-200">
                        <Clock size={14} /> {statusLabel.AWAITING_OWNER_CONSENT}
                      </span>
                    )}

                    {request.status === "NEEDS_INFORMATION" && (
                      <button
                        type="button"
                        className="gold-button !min-h-[34px] !px-3.5 !text-xs shadow-xs"
                        onClick={() => startCorrection(request)}
                      >
                        <Pencil size={13} /> Sửa và gửi lại hồ sơ
                      </button>
                    )}
                    {request.status === "APPROVED" && request.approved_horse_id && (
                      <Link
                        href={Routes.horse(request.approved_horse_id)}
                        className="gold-button !min-h-[34px] !px-3.5 !text-xs shadow-xs"
                      >
                        <Eye size={13} /> Mở hồ sơ chiến mã
                      </Link>
                    )}
                  </div>
                </div>

                {/* Body Content */}
                <div className="mt-4 flex flex-col gap-4">
                  {/* Review Note from Manager */}
                  {request.review_note && (
                    <div className={`rounded-lg p-3.5 text-xs border ${
                      request.status === "NEEDS_INFORMATION"
                        ? "bg-amber-50/90 border-amber-200 text-amber-900"
                        : request.status === "REJECTED"
                        ? "bg-rose-50/90 border-rose-200 text-rose-900"
                        : "bg-slate-50 border-slate-200 text-slate-700"
                    }`}>
                      <div className="flex items-start gap-2.5">
                        {request.status === "NEEDS_INFORMATION" ? (
                          <AlertCircle size={16} className="mt-0.5 shrink-0 text-amber-600" />
                        ) : request.status === "REJECTED" ? (
                          <XCircle size={16} className="mt-0.5 shrink-0 text-rose-600" />
                        ) : (
                          <MessageSquare size={16} className="mt-0.5 shrink-0 text-slate-500" />
                        )}
                        <div className="min-w-0 flex-1">
                          <p className="font-bold text-[12px]">
                            {request.status === "NEEDS_INFORMATION"
                              ? "Yêu cầu bổ sung từ Club Manager:"
                              : request.status === "REJECTED"
                              ? "Lý do từ chối hồ sơ:"
                              : "Ghi chú từ Club Manager:"}
                          </p>
                          <p className="mt-1 leading-relaxed whitespace-pre-wrap font-medium">{request.review_note}</p>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Info Row: Image + Specs */}
                  <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
                    {request.horse_image_url && (
                      <div className="h-36 w-full overflow-hidden rounded-lg border border-slate-200 bg-slate-50 sm:w-44 shrink-0">
                        <HorseImage
                          horse={{ id: request.id, horse_name: request.horse_name, image_url: request.horse_image_url } as Horse}
                          preview={request.horse_image_url}
                        />
                      </div>
                    )}

                    {/* Specs Chips */}
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap gap-2 text-xs">
                        {request.breed && (
                          <span className="rounded-md bg-slate-50 px-2.5 py-1 text-slate-600 border border-slate-200">
                            Giống: <strong className="font-semibold text-slate-800">{request.breed}</strong>
                          </span>
                        )}
                        {horseGender(request.gender) && (
                          <span className="rounded-md bg-slate-50 px-2.5 py-1 text-slate-600 border border-slate-200">
                            Giới tính: <strong className="font-semibold text-slate-800">{horseGender(request.gender)}</strong>
                          </span>
                        )}
                        {request.birth_year && (
                          <span className="rounded-md bg-slate-50 px-2.5 py-1 text-slate-600 border border-slate-200">
                            Năm sinh: <strong className="font-semibold text-slate-800">{request.birth_year}</strong>
                          </span>
                        )}
                        {request.height_cm && (
                          <span className="rounded-md bg-slate-50 px-2.5 py-1 text-slate-600 border border-slate-200">
                            Chiều cao: <strong className="font-semibold text-slate-800">{request.height_cm} cm</strong>
                          </span>
                        )}
                        {request.current_weight_kg && (
                          <span className="rounded-md bg-slate-50 px-2.5 py-1 text-slate-600 border border-slate-200">
                            Cân nặng: <strong className="font-semibold text-slate-800">{request.current_weight_kg} kg</strong>
                          </span>
                        )}
                        {request.microchip_number && (
                          <span className="rounded-md bg-slate-50 px-2.5 py-1 text-slate-600 border border-slate-200">
                            Số chip: <strong className="font-semibold text-slate-800">{request.microchip_number}</strong>
                          </span>
                        )}
                        {request.passport_number && (
                          <span className="rounded-md bg-slate-50 px-2.5 py-1 text-slate-600 border border-slate-200">
                            Hộ chiếu: <strong className="font-semibold text-slate-800">{request.passport_number}</strong>
                          </span>
                        )}
                        {request.pedigree_father && (
                          <span className="rounded-md bg-slate-50 px-2.5 py-1 text-slate-600 border border-slate-200">
                            Cha: <strong className="font-semibold text-slate-800">{request.pedigree_father}</strong>
                          </span>
                        )}
                        {request.pedigree_mother && (
                          <span className="rounded-md bg-slate-50 px-2.5 py-1 text-slate-600 border border-slate-200">
                            Mẹ: <strong className="font-semibold text-slate-800">{request.pedigree_mother}</strong>
                          </span>
                        )}
                      </div>

                      {request.owner_note && (
                        <p className="mt-2.5 text-xs text-slate-500 bg-slate-50/70 p-2.5 rounded-lg border border-slate-200/60">
                          <span className="font-semibold text-slate-700">Ghi chú của bạn:</span> {request.owner_note}
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Attached Documents */}
                  {request.documents.length > 0 && (
                    <div className="space-y-2">
                      <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                        Tài liệu đính kèm ({request.documents.length})
                      </span>
                      <div className="grid gap-2.5 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4">
                        {request.documents.map((document) => (
                          <div key={document.id} className="flex items-center justify-between gap-2.5 rounded-lg border border-slate-200 bg-slate-50/70 p-2.5 text-xs hover:bg-slate-100/70 transition">
                            <div className="flex min-w-0 items-center gap-2.5">
                              <span className="grid size-7 shrink-0 place-items-center rounded bg-white text-teal-700 border border-slate-200 shadow-xs">
                                <FileText size={14} />
                              </span>
                              <div className="min-w-0">
                                <p className="truncate font-semibold text-slate-800" title={document.name}>{document.name}</p>
                                <p className="text-[11px] text-slate-500">
                                  {documentLabels[document.document_type] ?? "Tài liệu"} · Lần {document.revision_no}
                                </p>
                              </div>
                            </div>
                            <button
                              type="button"
                              onClick={() => void openFreshDocument(() => getOwnerRegistrationDocumentUrl(request.id, document.id), document.url)}
                              className="shrink-0 soft-button !min-h-[28px] !px-2.5 !text-[11px]"
                            >
                              Xem <ExternalLink size={11} />
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Timeline History */}
                  {request.history?.length > 0 && (
                    <details className="group rounded-lg border border-slate-200/80 bg-slate-50/50 p-2.5 text-xs">
                      <summary className="flex cursor-pointer items-center justify-between font-medium text-slate-700 select-none">
                        <span className="flex items-center gap-1.5">
                          <Clock size={13} className="text-slate-400" />
                          Lịch sử xử lý ({request.history.length} bước)
                        </span>
                        <span className="text-[11px] text-slate-400 transition-transform group-open:rotate-180">▼</span>
                      </summary>
                      <ol className="relative ml-2 mt-3 space-y-2.5 border-l border-slate-200 pl-3">
                        {request.history.map((entry) => (
                          <li key={entry.id} className="relative">
                            <span className="absolute -left-[17px] top-1 size-2 rounded-full bg-teal-600 ring-2 ring-white" />
                            <p className="font-semibold text-slate-800">{historyActionLabel(entry.action)}</p>
                            <p className="text-[11px] text-slate-400">{formatDisplayDate(entry.created_at, true)}</p>
                            {entry.note && (
                              <p className="mt-1 rounded bg-white p-2 border border-slate-100 text-slate-600 leading-relaxed whitespace-pre-wrap">
                                {entry.note}
                              </p>
                            )}
                          </li>
                        ))}
                      </ol>
                    </details>
                  )}
                </div>
              </article>
            ))}
            {!loading && requests.length === 0 && <div className="rounded-lg bg-slate-50/80 px-4 py-8 text-center"><span className="mx-auto grid h-10 w-10 place-items-center rounded-full bg-white text-slate-400 shadow-xs"><FileCheck2 size={18} /></span><p className="mt-2 text-sm font-semibold text-slate-700">Chưa có yêu cầu nào</p><p className="mt-1 text-xs text-slate-400">Các yêu cầu đăng ký hồ sơ ngựa bạn gửi sẽ được theo dõi tại đây.</p></div>}
          </div>
        </section>
      </div>

      {uploadProgress && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/35 p-4 backdrop-blur-[2px]"
          role="dialog"
          aria-modal="true"
          aria-label="Tiến trình gửi hồ sơ"
        >
          <div className="es-panel-in w-full max-w-md rounded-2xl border border-equine-line bg-white/95 p-6 shadow-xl backdrop-blur-sm">
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                {uploadProgress.stage === "done" ? (
                  <span className="es-pop-in grid h-11 w-11 shrink-0 place-items-center rounded-full bg-emerald-100 text-emerald-700">
                    <CheckCircle2 size={22} />
                  </span>
                ) : (
                  <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-blue-50 text-equine-blue shadow-xs">
                    <Loader2 size={22} className="animate-spin" />
                  </span>
                )}
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-equine-navy">
                    {uploadProgress.stage === "done"
                      ? "Hoàn tất gửi hồ sơ"
                      : editingRequest
                        ? "Đang gửi bổ sung hồ sơ"
                        : "Đang gửi hồ sơ ngựa"}
                  </p>
                  <p className="mt-0.5 text-xs text-slate-600" role="status" aria-live="polite">
                    {uploadProgress.label}
                  </p>
                </div>
              </div>
              <span className="shrink-0 text-2xl font-bold tabular-nums text-equine-navy">
                {uploadProgress.percent}%
              </span>
            </div>

            <div
              className="mt-4 h-3 w-full overflow-hidden rounded-full bg-slate-100"
              role="progressbar"
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={uploadProgress.percent}
            >
              <div
                className={`h-full rounded-full transition-all duration-300 ease-out ${
                  uploadProgress.stage === "done"
                    ? "bg-gradient-to-r from-emerald-500 to-teal-500"
                    : "es-progress-shimmer bg-gradient-to-r from-equine-navy via-blue-600 to-equine-teal"
                }`}
                style={{ width: `${uploadProgress.percent}%` }}
              />
            </div>

            <div className="mt-4 grid grid-cols-3 gap-2 text-[11px]">
              {(
                [
                  { id: "compressing", text: "1. Tối ưu tệp", doneWhen: ["uploading", "saving", "done"] },
                  { id: "uploading", text: "2. Tải lên", doneWhen: ["done"] },
                  { id: "done", text: "3. Hoàn tất", doneWhen: ["done"] },
                ] as const
              ).map((step) => {
                const isDone = (step.doneWhen as readonly string[]).includes(uploadProgress.stage);
                const isActive =
                  uploadProgress.stage === step.id ||
                  (step.id === "uploading" && uploadProgress.stage === "saving");
                return (
                  <div
                    key={step.id}
                    className={`flex items-center justify-center gap-1 rounded-md border px-2 py-1.5 font-medium transition ${
                      isDone
                        ? "border-emerald-200 bg-emerald-50 text-emerald-800"
                        : isActive
                          ? "border-blue-200 bg-blue-50 text-equine-blue"
                          : "border-slate-200 bg-slate-50 text-slate-400"
                    }`}
                  >
                    {isDone && <CheckCircle2 size={12} className="shrink-0" />}
                    <span>{step.text}</span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
      {pendingTransfer && (
        <Modal
          title={pendingTransfer.action === "CONSENT" ? "Xác nhận chuyển quyền sở hữu" : "Từ chối chuyển quyền sở hữu"}
          busy={Boolean(transferBusy)}
          onClose={() => setPendingTransfer(null)}
        >
          <div className="space-y-4">
            <p className="text-sm leading-relaxed text-slate-600">
              {pendingTransfer.action === "CONSENT" ? (
                <>
                  Bạn đồng ý chuyển quyền sở hữu ngựa <strong className="text-slate-900">{pendingTransfer.request.horse_name}</strong> cho{" "}
                  <strong className="text-slate-900">{pendingTransfer.request.requester_name ?? "Chủ ngựa đề nghị"}</strong>?
                </>
              ) : (
                <>
                  Bạn chắc chắn muốn từ chối yêu cầu chuyển quyền sở hữu ngựa <strong className="text-slate-900">{pendingTransfer.request.horse_name}</strong>?
                </>
              )}
            </p>
            <div className="flex justify-end gap-2.5 border-t border-slate-100 pt-3">
              <button type="button" className="soft-button !text-xs" disabled={Boolean(transferBusy)} onClick={() => setPendingTransfer(null)}>
                Hủy
              </button>
              <button
                type="button"
                className={pendingTransfer.action === "CONSENT" ? "gold-button !text-xs" : "danger-button !text-xs"}
                disabled={Boolean(transferBusy)}
                onClick={() => void confirmTransferAnswer()}
              >
                {transferBusy ? "Đang lưu…" : pendingTransfer.action === "CONSENT" ? "Đồng ý chuyển quyền" : "Xác nhận từ chối"}
              </button>
            </div>
          </div>
        </Modal>
      )}
    </section>
  );
}

function historyActionLabel(action: string) {
  switch (action) {
    case "SUBMITTED": return "Đã gửi hồ sơ";
    case "RESUBMITTED": return "Đã gửi bổ sung";
    case "NEEDS_INFORMATION": return "Club Manager yêu cầu bổ sung";
    case "REVIEW_APPROVED": return "Club Manager đã xác minh";
    case "REJECTED": return "Club Manager từ chối";
    case "OWNER_CONSENT": return "Đã đồng ý chuyển quyền";
    case "OWNER_DECLINED": return "Đã từ chối chuyển quyền";
    default: return action;
  }
}
