"use client";

import { Fragment, useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import { AlertTriangle, ArrowDownToLine, ArrowUpFromLine, ClipboardList, Eye, History, Package, Pencil, Plus, RefreshCw, Search, type LucideIcon } from "lucide-react";
import {
  adjustInventory,
  createInventoryItem,
  deactivateInventoryItem,
  getInventoryItem,
  listInventoryItems,
  listInventoryTransactions,
  listSupplyRequests,
  receiveInventory,
  reviewSupplyRequest,
  updateInventoryItem,
  type InventoryItem,
  type InventoryItemDetail,
  type InventorySummary,
  type InventoryTransaction,
  type SupplyRequest,
} from "@/api/club-manager/api";

type Section = "catalog" | "transactions" | "requests";
const statusLabels: Record<string, string> = {
  SUFFICIENT: "Còn đủ", LOW_STOCK: "Sắp thiếu", OUT_OF_STOCK: "Hết hàng",
  EXPIRING: "Sắp hết hạn", EXPIRED: "Hết hạn", INACTIVE: "Ngừng sử dụng",
};
const categoryLabels: Record<string, string> = {
  Food: "Thức ăn", Medical: "Vật tư y tế", Medicine: "Thuốc thú y", Equipment: "Thiết bị", Other: "Khác",
};
const transactionLabels: Record<string, string> = {
  OPENING: "Tồn ban đầu", RECEIPT: "Nhập kho", USAGE: "Đã sử dụng", ADJUSTMENT: "Điều chỉnh",
};

function today() {
  const date = new Date();
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

export default function InventoryManagerPanel() {
  const [section, setSection] = useState<Section>("catalog");
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [summary, setSummary] = useState<InventorySummary>({ total_items: 0, low_stock: 0, expiring_soon: 0, pending_requests: 0, expired: 0, out_of_stock: 0 });
  const [transactions, setTransactions] = useState<InventoryTransaction[]>([]);
  const [requests, setRequests] = useState<SupplyRequest[]>([]);
  const [detail, setDetail] = useState<InventoryItemDetail | null>(null);
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("ALL");
  const [status, setStatus] = useState("ALL");
  const [requestStatus, setRequestStatus] = useState("Pending");
  const [showAdd, setShowAdd] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [receiptItemId, setReceiptItemId] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const load = useCallback(async () => {
    const [inventoryPage, transactionPage, requestPage] = await Promise.all([
      listInventoryItems(), listInventoryTransactions(), listSupplyRequests("All"),
    ]);
    setItems(inventoryPage.data);
    setSummary(inventoryPage.summary);
    setTransactions(transactionPage.data);
    setRequests(requestPage.data);
  }, []);

  useEffect(() => { void load().catch((reason: unknown) => setError(reason instanceof Error ? reason.message : "Không tải được dữ liệu kho.")); }, [load]);

  async function mutate(action: () => Promise<unknown>, success: string): Promise<boolean> {
    setBusy(true); setError(""); setNotice("");
    try { await action(); await load(); setNotice(success); return true; }
    catch (reason) { setError(reason instanceof Error ? reason.message : "Thao tác không thành công."); return false; }
    finally { setBusy(false); }
  }

  async function addItem(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget; const values = new FormData(form);
    if (await mutate(() => createInventoryItem({
      item_name: String(values.get("item_name")), category: String(values.get("category")), unit: String(values.get("unit")),
      quantity_in_stock: Number(values.get("quantity_in_stock") || 0), reorder_threshold: Number(values.get("reorder_threshold") || 0),
      description: String(values.get("description") ?? "").trim() || null,
      initial_lot_number: String(values.get("initial_lot_number") ?? "").trim() || null,
      initial_expiry_date: String(values.get("initial_expiry_date") ?? "").trim() || null,
    }), "Đã thêm vật tư vào danh mục.")) { form.reset(); setShowAdd(false); }
  }

  async function editItem(event: FormEvent<HTMLFormElement>, id: string) {
    event.preventDefault(); const values = new FormData(event.currentTarget);
    if (await mutate(() => updateInventoryItem(id, {
      item_name: String(values.get("item_name")), category: String(values.get("category")), unit: String(values.get("unit")),
      reorder_threshold: Number(values.get("reorder_threshold") || 0), description: String(values.get("description") ?? "").trim() || null,
    }), "Đã cập nhật thông tin vật tư.")) setEditingId(null);
  }

  async function receive(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); const form = event.currentTarget; const values = new FormData(form);
    if (await mutate(() => receiveInventory(String(values.get("item_id")), {
      quantity: Number(values.get("quantity")), received_date: String(values.get("received_date")),
      lot_number: String(values.get("lot_number") ?? "").trim() || null,
      expiry_date: String(values.get("expiry_date") ?? "").trim() || null,
      reason: String(values.get("reason") ?? "").trim() || null,
    }), "Đã ghi phiếu nhập kho.")) { form.reset(); setReceiptItemId(""); }
  }

  async function adjust(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); const form = event.currentTarget; const values = new FormData(form);
    if (await mutate(() => adjustInventory(String(values.get("item_id")), {
      quantity_change: Number(values.get("quantity_change")), reason: String(values.get("reason") ?? "").trim(),
      lot_number: String(values.get("lot_number") ?? "").trim() || null,
      expiry_date: String(values.get("expiry_date") ?? "").trim() || null,
    }), "Đã điều chỉnh tồn kho và lưu lý do.")) form.reset();
  }

  async function inspect(id: string) {
    setError("");
    try { setDetail(await getInventoryItem(id)); }
    catch (reason) { setError(reason instanceof Error ? reason.message : "Không tải được chi tiết vật tư."); }
  }

  const activeItems = items.filter((item) => item.is_active);
  const filteredItems = useMemo(() => items.filter((item) => {
    const query = search.trim().toLocaleLowerCase("vi-VN");
    return (!query || `${item.item_code} ${item.item_name}`.toLocaleLowerCase("vi-VN").includes(query))
      && (category === "ALL" || item.category === category)
      && (status === "ALL" || item.status === status);
  }), [items, search, category, status]);
  const filteredRequests = requests.filter((item) => requestStatus === "All" || item.status === requestStatus);

  const sections: [Section, string, LucideIcon][] = [
    ["catalog", "Danh mục vật tư", Package], ["transactions", "Nhập / Xuất kho", ArrowDownToLine], ["requests", "Yêu cầu bổ sung", ClipboardList],
  ];
  const stats = [
    ["Tổng vật tư", summary.total_items, Package, "text-equine-navy"],
    ["Sắp hết hàng", summary.low_stock, AlertTriangle, "text-amber-700"],
    ["Sắp hết hạn", summary.expiring_soon, History, "text-orange-700"],
    ["Yêu cầu bổ sung đang chờ", summary.pending_requests, ClipboardList, "text-blue-700"],
  ] as const;

  return <div className="space-y-4">
    <div className="flex flex-wrap items-center justify-between gap-3"><h2 className="font-sans text-xl font-semibold text-equine-navy sm:text-2xl">Vật tư & thức ăn</h2><button type="button" className="soft-button h-10 px-3 text-sm" disabled={busy} onClick={() => void load()}><RefreshCw size={15} /> Làm mới</button></div>
    {error && <p role="alert" className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800">{error}</p>}
    {notice && <p role="status" className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">{notice}</p>}
    <div className="grid gap-2.5 sm:grid-cols-2 xl:grid-cols-4">{stats.map(([label, value, Icon, color]) => <article key={label} className="flex min-h-[76px] items-center gap-3 rounded-xl border border-equine-line bg-white px-3.5 py-3"><span className={`grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-slate-50 ${color}`}><Icon size={17} /></span><div className="min-w-0"><p className="text-xs font-medium leading-4 text-slate-500">{label}</p><p className="mt-0.5 text-xl font-semibold leading-6 text-equine-navy">{value}</p></div></article>)}</div>
    <div role="tablist" aria-label="Chức năng quản lý vật tư" className="flex gap-1 overflow-x-auto rounded-xl border border-equine-line bg-white p-1.5">{sections.map(([key, label, Icon]) => <button key={key} type="button" role="tab" aria-selected={section === key} onClick={() => setSection(key)} className={`flex shrink-0 items-center gap-2 rounded-lg px-3.5 py-2 text-sm font-semibold transition-colors ${section === key ? "bg-equine-navy text-white" : "text-slate-600 hover:bg-slate-50"}`}><Icon size={16} />{label}{key === "requests" && summary.pending_requests > 0 && <span className={`rounded-full px-2 py-0.5 text-xs ${section === key ? "bg-white/15 text-white" : "bg-amber-100 text-amber-900"}`}>{summary.pending_requests}</span>}</button>)}</div>

    {section === "catalog" && <section className="rounded-2xl border border-equine-line bg-white p-3.5 shadow-sm sm:p-4">
      <div className="mb-3 grid gap-2.5 xl:grid-cols-[minmax(0,1fr)_auto]"><div className="grid min-w-0 gap-2 sm:grid-cols-2 xl:grid-cols-[minmax(240px,1.35fr)_minmax(170px,1fr)_minmax(180px,1fr)]"><label className="relative block"><span className="sr-only">Tìm vật tư</span><Search size={16} className="absolute left-3 top-3 text-slate-400" /><input className="field-control w-full pl-9 pr-3" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Tìm theo mã hoặc tên" /></label><select aria-label="Lọc theo nhóm" className="field-control min-w-0 px-3" value={category} onChange={(event) => setCategory(event.target.value)}><option value="ALL">Tất cả nhóm</option><option value="Food">Thức ăn</option><option value="Medical">Vật tư y tế</option><option value="Medicine">Thuốc thú y</option><option value="Equipment">Thiết bị</option><option value="Other">Khác</option></select><select aria-label="Lọc theo trạng thái kho" className="field-control min-w-0 px-3 sm:col-span-2 xl:col-span-1" value={status} onChange={(event) => setStatus(event.target.value)}><option value="ALL">Tất cả trạng thái</option>{Object.entries(statusLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></div><button type="button" className="gold-button justify-center whitespace-nowrap px-4" onClick={() => setShowAdd((value) => !value)}><Plus size={16} /> Thêm vật tư</button></div>
      {showAdd && <form onSubmit={(event) => void addItem(event)} className="mb-5 grid gap-3 rounded-2xl border border-equine-line bg-slate-50 p-4 sm:grid-cols-2 xl:grid-cols-3"><label className="block"><span className="field-label">Tên vật tư</span><input className="field-control px-3" name="item_name" maxLength={100} required /></label><label className="block"><span className="field-label">Nhóm</span><select className="field-control px-3" name="category"><option value="Food">Thức ăn</option><option value="Medical">Vật tư y tế</option><option value="Medicine">Thuốc thú y</option><option value="Equipment">Thiết bị</option><option value="Other">Khác</option></select></label><label className="block"><span className="field-label">Đơn vị</span><select className="field-control px-3" name="unit"><option value="kg">kg</option><option value="bao">bao</option><option value="hộp">hộp</option><option value="chai">chai</option><option value="gói">gói</option><option value="cuộn">cuộn</option><option value="cái">cái</option><option value="lít">lít</option><option value="viên">viên</option><option value="liều">liều</option></select></label><label className="block"><span className="field-label">Số lượng tồn ban đầu</span><input className="field-control px-3" name="quantity_in_stock" type="number" min="0" step="0.01" defaultValue="0" /></label><label className="block"><span className="field-label">Mức tồn tối thiểu (cảnh báo)</span><input className="field-control px-3" name="reorder_threshold" type="number" min="0" step="0.01" defaultValue="0" required /><span className="mt-1 block text-xs text-slate-500">Hệ thống cảnh báo khi số lượng tồn bằng hoặc thấp hơn mức này.</span></label><label className="block"><span className="field-label">Lô tồn ban đầu (nếu có)</span><input className="field-control px-3" name="initial_lot_number" maxLength={80} /></label><label className="block"><span className="field-label">Hạn dùng lô tồn ban đầu (nếu có)</span><input className="field-control px-3" name="initial_expiry_date" type="date" /></label><label className="block sm:col-span-2"><span className="field-label">Mô tả / cách bảo quản</span><textarea className="field-control min-h-20 px-3 py-2" name="description" maxLength={2000} /></label><div className="flex items-end gap-2"><button className="gold-button" disabled={busy}><Plus size={15} /> Lưu vật tư</button><button type="button" className="soft-button" onClick={() => setShowAdd(false)}>Đóng</button></div></form>}
      <div className="overflow-x-auto rounded-xl border border-equine-line"><table className="min-w-[1000px] w-full text-left text-sm"><thead className="bg-slate-50 text-[11px] uppercase tracking-wide text-slate-500"><tr><th className="whitespace-nowrap px-2.5 py-2.5">Mã vật tư</th><th className="px-2.5 py-2.5">Tên vật tư</th><th className="px-2.5 py-2.5">Nhóm</th><th className="px-2.5 py-2.5">Đơn vị</th><th className="whitespace-nowrap px-2.5 py-2.5">Tồn kho</th><th className="whitespace-nowrap px-2.5 py-2.5">Mức tối thiểu</th><th className="whitespace-nowrap px-2.5 py-2.5">Hạn gần nhất</th><th className="px-2.5 py-2.5">Trạng thái</th><th className="px-2.5 py-2.5">Thao tác</th></tr></thead><tbody className="divide-y divide-equine-line bg-white">{filteredItems.map((item) => <Fragment key={item.id}><tr className={item.status === "LOW_STOCK" || item.status === "OUT_OF_STOCK" ? "bg-amber-50/40" : ""}><td className="whitespace-nowrap px-2.5 py-2.5 font-mono text-[11px] text-slate-600">{item.item_code}</td><td className="px-2.5 py-2.5 font-semibold text-equine-navy">{item.item_name}</td><td className="px-2.5 py-2.5">{categoryLabels[item.category] ?? item.category}</td><td className="px-2.5 py-2.5">{item.unit}</td><td className="px-2.5 py-2.5 font-semibold tabular-nums">{item.quantity_in_stock}</td><td className="px-2.5 py-2.5 tabular-nums">{item.reorder_threshold}</td><td className="whitespace-nowrap px-2.5 py-2.5">{item.nearest_expiry_date ?? "—"}</td><td className="px-2.5 py-2.5"><span className={`rounded-full px-2 py-1 text-xs font-semibold ${item.status === "SUFFICIENT" ? "bg-emerald-50 text-emerald-800" : item.status === "INACTIVE" ? "bg-slate-100 text-slate-600" : "bg-amber-50 text-amber-800"}`}>{statusLabels[item.status] ?? item.status}</span></td><td className="px-2.5 py-2.5"><div className="flex gap-1"><button type="button" className="soft-button h-8 px-2 text-xs" title="Xem chi tiết" onClick={() => detail?.id === item.id ? setDetail(null) : void inspect(item.id)}><Eye size={14} /></button><button type="button" className="soft-button h-8 px-2 text-xs" title="Sửa danh mục" onClick={() => setEditingId(editingId === item.id ? null : item.id)}><Pencil size={14} /></button>{item.is_active && <button type="button" className="soft-button h-8 px-2 text-xs" title="Nhập kho" onClick={() => { setReceiptItemId(item.id); setSection("transactions"); }}><ArrowDownToLine size={14} /></button>}</div></td></tr>
        {detail?.id === item.id && <tr><td colSpan={9} className="bg-slate-50 px-4 py-3"><p className="font-semibold text-equine-navy">Chi tiết · {item.item_name}</p><p className="mt-1 whitespace-pre-wrap text-sm text-slate-600">{detail.description || "Chưa có mô tả hoặc hướng dẫn bảo quản."}</p><div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">{(detail.lots ?? []).map((lot) => <div key={lot.id} className="rounded-lg border border-equine-line bg-white p-3 text-xs"><p className="font-semibold">Lô {lot.lot_number}</p><p className="mt-1">Còn {lot.quantity_remaining} / {lot.quantity_received} {item.unit}</p><p>Hạn dùng: {lot.expiry_date ?? "Không ghi hạn"}</p></div>)}{!detail.lots?.length && <p className="text-xs text-slate-500">Chưa có lô nhập.</p>}</div></td></tr>}
        {editingId === item.id && <tr><td colSpan={9} className="bg-slate-50 p-3"><form onSubmit={(event) => void editItem(event, item.id)} className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3"><label className="block"><span className="field-label">Tên</span><input className="field-control px-3" name="item_name" defaultValue={item.item_name} required maxLength={100} /></label><label className="block"><span className="field-label">Nhóm</span><select className="field-control px-3" name="category" defaultValue={item.category}><option value="Food">Thức ăn</option><option value="Medical">Vật tư y tế</option><option value="Medicine">Thuốc thú y</option><option value="Equipment">Thiết bị</option><option value="Other">Khác</option></select></label><label className="block"><span className="field-label">Đơn vị</span><input className="field-control px-3" name="unit" defaultValue={item.unit} required maxLength={20} /></label><label className="block"><span className="field-label">Mức tồn tối thiểu (cảnh báo)</span><input className="field-control px-3" name="reorder_threshold" type="number" min="0" step="0.01" defaultValue={item.reorder_threshold} required /></label><label className="block sm:col-span-2"><span className="field-label">Mô tả / cách bảo quản</span><input className="field-control px-3" name="description" defaultValue={item.description ?? ""} maxLength={2000} /></label><div className="flex items-end gap-2"><button className="gold-button" disabled={busy}>Lưu thông tin</button><button type="button" className="soft-button" onClick={() => setEditingId(null)}>Hủy</button>{item.is_active && <button type="button" className="soft-button text-rose-700" disabled={busy} onClick={() => void mutate(() => deactivateInventoryItem(item.id), "Đã chuyển vật tư sang trạng thái ngừng sử dụng.")}>Ngừng sử dụng</button>}</div></form></td></tr>}</Fragment>)}{!filteredItems.length && <tr><td colSpan={9} className="px-4 py-8 text-center text-sm text-slate-500">Không tìm thấy vật tư phù hợp bộ lọc.</td></tr>}</tbody></table></div>
    </section>}

    {section === "transactions" && <div className="space-y-5"><div className="grid gap-5 xl:grid-cols-2">
      <section className="rounded-2xl border border-equine-line bg-white p-4 shadow-sm sm:p-5"><h3 className="mb-4 flex items-center gap-2 font-sans text-lg font-semibold text-equine-navy"><ArrowDownToLine size={18} /> Phiếu nhập kho</h3><form onSubmit={(event) => void receive(event)} className="grid gap-3 sm:grid-cols-2"><label className="block sm:col-span-2"><span className="field-label">Vật tư</span><select className="field-control px-3" name="item_id" defaultValue={receiptItemId || activeItems[0]?.id || ""} required>{activeItems.map((item) => <option value={item.id} key={item.id}>{item.item_code} · {item.item_name} ({item.quantity_in_stock} {item.unit})</option>)}</select></label><label className="block"><span className="field-label">Số lượng nhận</span><input className="field-control px-3" name="quantity" type="number" min="0.01" step="0.01" required /></label><label className="block"><span className="field-label">Ngày nhận</span><input className="field-control px-3" name="received_date" type="date" defaultValue={today()} required /></label><label className="block"><span className="field-label">Số lô</span><input className="field-control px-3" name="lot_number" maxLength={80} /></label><label className="block"><span className="field-label">Ngày hết hạn</span><input className="field-control px-3" name="expiry_date" type="date" /></label><label className="block sm:col-span-2"><span className="field-label">Ghi chú</span><input className="field-control px-3" name="reason" maxLength={500} placeholder="Nhà cung cấp hoặc thông tin nhận hàng" /></label><button className="gold-button sm:col-span-2" disabled={busy || activeItems.length === 0}><ArrowDownToLine size={15} /> Ghi phiếu nhập</button></form><p className="mt-3 text-xs text-slate-500">Hàng có hạn sử dụng cần lưu số lô và ngày hết hạn. Duyệt yêu cầu bổ sung không làm tăng tồn kho.</p></section>
      <section className="rounded-2xl border border-equine-line bg-white p-4 shadow-sm sm:p-5"><h3 className="mb-4 flex items-center gap-2 font-sans text-lg font-semibold text-equine-navy"><ArrowUpFromLine size={18} /> Điều chỉnh tồn kho</h3><form onSubmit={(event) => void adjust(event)} className="grid gap-3 sm:grid-cols-2"><label className="block sm:col-span-2"><span className="field-label">Vật tư</span><select className="field-control px-3" name="item_id" required>{activeItems.map((item) => <option value={item.id} key={item.id}>{item.item_code} · {item.item_name} (tồn {item.quantity_in_stock} {item.unit})</option>)}</select></label><label className="block"><span className="field-label">Lượng thay đổi (+/-)</span><input className="field-control px-3" name="quantity_change" type="number" step="0.01" required /></label><label className="block"><span className="field-label">Lý do bắt buộc</span><input className="field-control px-3" name="reason" maxLength={500} required /></label><label className="block"><span className="field-label">Số lô (khi tăng tồn thuốc)</span><input className="field-control px-3" name="lot_number" maxLength={80} /></label><label className="block"><span className="field-label">Hạn dùng (khi tăng tồn thuốc)</span><input className="field-control px-3" name="expiry_date" type="date" /></label><button className="soft-button sm:col-span-2" disabled={busy || activeItems.length === 0}>Lưu điều chỉnh</button><p className="text-xs text-slate-500 sm:col-span-2">Tăng tồn thuốc thú y cần lưu số lô và hạn dùng. Mọi điều chỉnh đều được ghi vào nhật ký.</p></form></section>
    </div><section className="rounded-2xl border border-equine-line bg-white p-4 shadow-sm sm:p-5"><h3 className="mb-4 flex items-center gap-2 font-sans text-lg font-semibold text-equine-navy"><History size={18} /> Lịch sử giao dịch kho</h3><div className="overflow-x-auto"><table className="min-w-[850px] w-full text-left text-sm"><thead className="bg-slate-50 text-xs uppercase text-slate-500"><tr><th className="px-3 py-3">Thời điểm</th><th className="px-3 py-3">Vật tư</th><th className="px-3 py-3">Giao dịch</th><th className="px-3 py-3">Thay đổi</th><th className="px-3 py-3">Tồn sau</th><th className="px-3 py-3">Lô</th><th className="px-3 py-3">Người thao tác</th><th className="px-3 py-3">Lý do</th></tr></thead><tbody className="divide-y divide-equine-line">{transactions.map((entry) => <tr key={entry.id}><td className="whitespace-nowrap px-3 py-3">{new Date(entry.created_at).toLocaleString("vi-VN")}</td><td className="px-3 py-3"><span className="font-mono text-xs">{entry.item_code}</span><br />{entry.item_name}</td><td className="px-3 py-3">{transactionLabels[entry.transaction_type]}</td><td className={`px-3 py-3 font-semibold ${entry.quantity_change < 0 ? "text-rose-700" : "text-emerald-700"}`}>{entry.quantity_change > 0 ? "+" : ""}{entry.quantity_change}</td><td className="px-3 py-3">{entry.quantity_after}</td><td className="px-3 py-3">{entry.lot_number ?? "—"}{entry.expiry_date ? <><br /><span className="text-xs text-slate-500">HSD {entry.expiry_date}</span></> : null}</td><td className="px-3 py-3">{entry.actor_name}</td><td className="max-w-48 px-3 py-3">{entry.reason ?? "—"}</td></tr>)}{!transactions.length && <tr><td colSpan={8} className="px-4 py-8 text-center text-slate-500">Chưa có giao dịch kho.</td></tr>}</tbody></table></div></section></div>}

    {section === "requests" && <section className="rounded-2xl border border-equine-line bg-white p-4 shadow-sm sm:p-5"><div className="mb-4 flex flex-wrap items-center justify-between gap-3"><div><h3 className="font-sans text-lg font-semibold text-equine-navy">Yêu cầu bổ sung từ nhân viên</h3><p className="mt-1 text-sm text-slate-600">Duyệt toàn bộ, duyệt một phần hoặc từ chối. Tồn kho chỉ tăng khi hàng được nhận và ghi phiếu nhập.</p></div><select className="field-control px-3" aria-label="Trạng thái yêu cầu" value={requestStatus} onChange={(event) => setRequestStatus(event.target.value)}><option value="Pending">Đang chờ</option><option value="Approved">Đã duyệt</option><option value="PartiallyApproved">Duyệt một phần</option><option value="Rejected">Đã từ chối</option><option value="All">Tất cả</option></select></div><div className="space-y-3">{filteredRequests.map((request) => <article key={request.id} className="rounded-xl border border-equine-line p-4"><div className="flex flex-wrap justify-between gap-2"><div><p className="font-semibold text-equine-navy">{request.item_code} · {request.item_name}</p><p className="mt-1 text-xs text-slate-500">{request.groom_name ?? "Groom"} · {new Date(request.created_at).toLocaleString("vi-VN")}</p></div><span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold">{request.status === "PartiallyApproved" ? "Duyệt một phần" : request.status === "Pending" ? "Đang chờ" : request.status === "Approved" ? "Đã duyệt" : "Đã từ chối"}</span></div><p className="mt-3 text-sm">Đề xuất: <strong>{request.quantity_requested}</strong></p>{request.reason && <p className="mt-1 whitespace-pre-wrap text-sm text-slate-600">Lý do: {request.reason}</p>}
      {request.status === "Pending" ? <form className="mt-3 grid gap-2 sm:grid-cols-3" onSubmit={(event) => { event.preventDefault(); const values = new FormData(event.currentTarget); void mutate(() => reviewSupplyRequest(request.id, { action: "APPROVE", quantity_approved: Number(values.get("quantity_approved")), review_note: String(values.get("review_note") ?? "").trim() || undefined }), "Đã ghi nhận số lượng duyệt; tồn kho chỉ tăng khi nhập hàng."); }}><label className="block"><span className="field-label">Số lượng duyệt</span><input className="field-control px-3" name="quantity_approved" type="number" min="0.01" max={request.quantity_requested} step="0.01" defaultValue={request.quantity_requested} required /></label><label className="block sm:col-span-2"><span className="field-label">Ghi chú xử lý</span><input className="field-control px-3" name="review_note" maxLength={1000} /></label><div className="flex gap-2 sm:col-span-3"><button className="soft-button border-emerald-200 bg-emerald-50 text-emerald-800" disabled={busy}>Duyệt số lượng trên</button><button type="button" className="soft-button border-rose-200 bg-rose-50 text-rose-800" disabled={busy} onClick={(event) => { const values = new FormData(event.currentTarget.form ?? undefined); void mutate(() => reviewSupplyRequest(request.id, { action: "REJECT", review_note: String(values.get("review_note") ?? "").trim() || undefined }), "Đã từ chối đề xuất vật tư."); }}>Từ chối</button></div></form> : <div className="mt-2 text-sm text-slate-600">{request.quantity_approved != null && <span>Đã duyệt: {request.quantity_approved} · </span>}{request.review_note ?? "Không có ghi chú xử lý."}</div>}</article>)}{!filteredRequests.length && <p className="rounded-xl bg-slate-50 p-6 text-center text-sm text-slate-500">Không có yêu cầu ở trạng thái này.</p>}</div></section>}
  </div>;
}
