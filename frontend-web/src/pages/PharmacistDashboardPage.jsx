import { useState, useEffect } from "react";
import axios from "axios";
import { useTranslation } from "react-i18next";
import Sidebar from "../components/Sidebar";
import { StatCard, Card, Badge, Btn, Input, Select, Alert, EmptyState } from "../components/ui";
import { useSEO } from "../hooks/useSEO";

const API = import.meta.env.VITE_DJANGO_API_BASE || "http://localhost:8000";

export default function PharmacistDashboardPage({ session, onLogout }) {
  const { i18n } = useTranslation();
  const isAr = i18n.language === "ar";
  const [active, setActive] = useState("overview");
  const headers = { Authorization: `Bearer ${session.access}` };

  const [drugs, setDrugs] = useState([]);
  const [movements, setMovements] = useState([]);
  const [lowStock, setLowStock] = useState([]);
  const [loading, setLoading] = useState(false);

  // Add drug form
  const [showAddDrug, setShowAddDrug] = useState(false);
  const [drugForm, setDrugForm] = useState({ name: "", sku: "", category: "", stock_quantity: 0, low_stock_threshold: 10, unit_price_aed: 0, expiry_date: "" });
  const [drugResult, setDrugResult] = useState(null);

  // Stock movement form
  const [movForm, setMovForm] = useState({ drug: "", movement_type: "IN", quantity: 1, reference: "", notes: "" });
  const [movResult, setMovResult] = useState(null);

  const loadAll = async () => {
    try {
      const [d, m, l] = await Promise.all([
        axios.get(`${API}/api/v1/pharmacy/drugs/`, { headers }),
        axios.get(`${API}/api/v1/pharmacy/stock-movements/`, { headers }),
        axios.get(`${API}/api/v1/pharmacy/alerts/low-stock/`, { headers }),
      ]);
      setDrugs(d.data.results || d.data);
      setMovements(m.data.results || m.data);
      setLowStock(l.data.results || l.data);
    } catch {}
  };

  useEffect(() => { loadAll(); }, []);

  const submitDrug = async () => {
    setLoading(true);
    try {
      await axios.post(`${API}/api/v1/pharmacy/drugs/`, drugForm, { headers });
      setDrugResult({ ok: true, msg: isAr ? "تم إضافة الدواء" : "Drug added successfully!" });
      setShowAddDrug(false);
      setDrugForm({ name: "", sku: "", category: "", stock_quantity: 0, low_stock_threshold: 10, unit_price_aed: 0, expiry_date: "" });
      loadAll();
    } catch (err) {
      setDrugResult({ ok: false, msg: JSON.stringify(err?.response?.data) });
    } finally { setLoading(false); }
  };

  const submitMovement = async () => {
    try {
      await axios.post(`${API}/api/v1/pharmacy/stock-movements/`, movForm, { headers });
      setMovResult({ ok: true, msg: isAr ? "تم تسجيل الحركة" : "Stock movement recorded!" });
      setMovForm({ drug: "", movement_type: "IN", quantity: 1, reference: "", notes: "" });
      loadAll();
    } catch (err) {
      setMovResult({ ok: false, msg: JSON.stringify(err?.response?.data) });
    }
  };

  const expiredDrugs = drugs.filter(d => d.is_expired);

  const sections = {
    overview: (
      <div className="space-y-6">
        <div className="grid sm:grid-cols-2 xl:grid-cols-4 gap-4">
          <StatCard icon="💊" title={isAr ? "إجمالي الأدوية" : "Total Drugs"} value={drugs.length} color="teal" />
          <StatCard icon="⚠️" title={isAr ? "مخزون منخفض" : "Low Stock"} value={lowStock.length} color="amber" />
          <StatCard icon="❌" title={isAr ? "منتهية الصلاحية" : "Expired"} value={expiredDrugs.length} color="rose" />
          <StatCard icon="📦" title={isAr ? "حركات اليوم" : "Today's Movements"} value={movements.slice(0, 10).length} color="navy" />
        </div>

        {lowStock.length > 0 && (
          <Card title={`⚠️ ${isAr ? "تنبيهات مخزون منخفض" : "Low Stock Alerts"}`}>
            <div className="space-y-2">
              {lowStock.map(d => (
                <div key={d.id} className="low-stock flex items-center justify-between p-3 rounded-xl">
                  <div>
                    <div className="text-sm font-bold text-orange-800">{d.name}</div>
                    <div className="text-xs text-orange-600">{d.sku} • {d.category}</div>
                  </div>
                  <div className="text-right">
                    <div className="text-lg font-black text-orange-600">{d.stock_quantity}</div>
                    <div className="text-xs text-orange-500">{isAr ? "متبقية" : "remaining"} / {d.low_stock_threshold} min</div>
                  </div>
                </div>
              ))}
            </div>
          </Card>
        )}

        {expiredDrugs.length > 0 && (
          <Card title={`❌ ${isAr ? "أدوية منتهية الصلاحية" : "Expired Drugs"}`}>
            {expiredDrugs.map(d => (
              <div key={d.id} className="expired flex items-center justify-between p-3 rounded-xl mb-2">
                <div className="text-sm font-bold text-red-800">{d.name}</div>
                <div className="text-xs text-red-600">{isAr ? "انتهت في" : "Expired"}: {d.expiry_date}</div>
              </div>
            ))}
          </Card>
        )}

        <Card title={isAr ? "كل الأدوية" : "All Drugs"} action={
          <Btn size="sm" onClick={() => setShowAddDrug(!showAddDrug)}>+ {isAr ? "إضافة دواء" : "Add Drug"}</Btn>
        }>
          {showAddDrug && (
            <div className="mb-4 p-4 bg-slate-50 rounded-xl space-y-3 border border-slate-200">
              <h4 className="font-semibold text-hmsNavy text-sm">{isAr ? "إضافة دواء جديد" : "Add New Drug"}</h4>
              <div className="grid sm:grid-cols-2 gap-3">
                <Input label={isAr ? "اسم الدواء" : "Drug Name"} value={drugForm.name} onChange={e => setDrugForm(p => ({ ...p, name: e.target.value }))} />
                <Input label="SKU" value={drugForm.sku} onChange={e => setDrugForm(p => ({ ...p, sku: e.target.value }))} />
                <Input label={isAr ? "الفئة" : "Category"} value={drugForm.category} onChange={e => setDrugForm(p => ({ ...p, category: e.target.value }))} />
                <Input label={isAr ? "السعر (درهم)" : "Price AED"} type="number" value={drugForm.unit_price_aed} onChange={e => setDrugForm(p => ({ ...p, unit_price_aed: e.target.value }))} />
                <Input label={isAr ? "المخزون الأولي" : "Initial Stock"} type="number" value={drugForm.stock_quantity} onChange={e => setDrugForm(p => ({ ...p, stock_quantity: Number(e.target.value) }))} />
                <Input label={isAr ? "حد التنبيه" : "Low Stock Threshold"} type="number" value={drugForm.low_stock_threshold} onChange={e => setDrugForm(p => ({ ...p, low_stock_threshold: Number(e.target.value) }))} />
                <Input label={isAr ? "تاريخ الانتهاء" : "Expiry Date"} type="date" value={drugForm.expiry_date} onChange={e => setDrugForm(p => ({ ...p, expiry_date: e.target.value }))} className="sm:col-span-2" />
              </div>
              {drugResult && <Alert type={drugResult.ok ? "success" : "error"}>{drugResult.msg}</Alert>}
              <Btn onClick={submitDrug} disabled={loading} className="w-full justify-center">{isAr ? "حفظ" : "Save Drug"}</Btn>
            </div>
          )}
          {drugs.length === 0 ? <EmptyState icon="💊" message="No drugs in inventory" /> : (
            <table className="hms-table w-full text-sm">
              <thead>
                <tr>
                  <th>{isAr ? "الدواء" : "Drug"}</th>
                  <th>SKU</th>
                  <th>{isAr ? "المخزون" : "Stock"}</th>
                  <th>{isAr ? "السعر" : "Price"}</th>
                  <th>{isAr ? "الانتهاء" : "Expiry"}</th>
                  <th>{isAr ? "الحالة" : "Status"}</th>
                </tr>
              </thead>
              <tbody>
                {drugs.map(d => (
                  <tr key={d.id} className={d.is_expired ? "expired" : d.is_low_stock ? "low-stock" : ""}>
                    <td className="font-semibold">{d.name}</td>
                    <td className="font-mono text-xs">{d.sku}</td>
                    <td className={`font-bold ${d.is_low_stock ? "text-orange-600" : "text-emerald-700"}`}>{d.stock_quantity}</td>
                    <td>AED {d.unit_price_aed}</td>
                    <td>{d.expiry_date}</td>
                    <td>
                      {d.is_expired ? <span className="text-xs font-bold text-red-600">❌ Expired</span> :
                        d.is_low_stock ? <span className="text-xs font-bold text-orange-600">⚠️ Low</span> :
                          <span className="text-xs font-bold text-emerald-600">✅ OK</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Card>
      </div>
    ),

    movements: (
      <div className="grid gap-4 lg:grid-cols-3">
        <Card title={isAr ? "تسجيل حركة مخزون" : "Record Stock Movement"}>
          <div className="space-y-3">
            <Select
              label={isAr ? "الدواء" : "Drug"}
              value={movForm.drug}
              onChange={e => setMovForm(p => ({ ...p, drug: e.target.value }))}
              options={[["", isAr ? "اختر..." : "Select drug..."], ...drugs.map(d => [d.id, d.name])]}
            />
            <Select
              label={isAr ? "نوع الحركة" : "Movement Type"}
              value={movForm.movement_type}
              onChange={e => setMovForm(p => ({ ...p, movement_type: e.target.value }))}
              options={[["IN", "Stock In"], ["OUT", "Stock Out"], ["ADJUSTMENT", "Adjustment"], ["EXPIRED", "Remove Expired"]]}
            />
            <Input label={isAr ? "الكمية" : "Quantity"} type="number" value={movForm.quantity} onChange={e => setMovForm(p => ({ ...p, quantity: Number(e.target.value) }))} />
            <Input label={isAr ? "المرجع" : "Reference"} value={movForm.reference} onChange={e => setMovForm(p => ({ ...p, reference: e.target.value }))} placeholder="Invoice # / PO #" />
            <Input label={isAr ? "ملاحظات" : "Notes"} value={movForm.notes} onChange={e => setMovForm(p => ({ ...p, notes: e.target.value }))} />
            {movResult && <Alert type={movResult.ok ? "success" : "error"}>{movResult.msg}</Alert>}
            <Btn onClick={submitMovement} className="w-full justify-center">{isAr ? "تسجيل" : "Record Movement"}</Btn>
          </div>
        </Card>

        <Card title={isAr ? "سجل الحركات" : "Movement History"} className="lg:col-span-2">
          {movements.length === 0 ? <EmptyState icon="📦" message="No movements recorded" /> : (
            <table className="hms-table w-full text-sm">
              <thead>
                <tr>
                  <th>{isAr ? "الدواء" : "Drug"}</th>
                  <th>{isAr ? "النوع" : "Type"}</th>
                  <th>{isAr ? "الكمية" : "Qty"}</th>
                  <th>{isAr ? "المرجع" : "Ref"}</th>
                  <th>{isAr ? "التاريخ" : "Date"}</th>
                </tr>
              </thead>
              <tbody>
                {movements.slice(0, 20).map(m => (
                  <tr key={m.id}>
                    <td className="font-semibold">{m.drug_name}</td>
                    <td>
                      <span className={`text-xs font-semibold ${m.movement_type === "IN" ? "text-emerald-600" : m.movement_type === "OUT" ? "text-rose-600" : "text-amber-600"}`}>
                        {m.movement_type}
                      </span>
                    </td>
                    <td className="font-bold">{m.quantity}</td>
                    <td className="text-slate-500 text-xs">{m.reference || "—"}</td>
                    <td className="text-xs text-slate-500">{m.created_at?.slice(0, 16)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Card>
      </div>
    ),

    prescriptions: (
      <Card title={isAr ? "وصفات للصرف" : "Prescriptions to Dispense"}>
        <EmptyState icon="💊" message={isAr ? "عرض الوصفات الطبية — قريباً" : "Prescription dispensing view — coming soon"} />
      </Card>
    ),

    alerts: (
      <div className="space-y-4">
        <Card title={`⚠️ ${isAr ? "مخزون منخفض" : "Low Stock Drugs"} (${lowStock.length})`}>
          {lowStock.length === 0 ? <EmptyState icon="✅" message={isAr ? "لا توجد تحذيرات" : "No low stock items"} /> : (
            <div className="space-y-3">
              {lowStock.map(d => (
                <div key={d.id} className="low-stock flex items-center justify-between p-4 rounded-xl">
                  <div>
                    <div className="font-bold text-orange-800">{d.name}</div>
                    <div className="text-sm text-orange-600">{d.sku} • {d.category}</div>
                  </div>
                  <div className="text-right">
                    <div className="text-2xl font-black text-orange-600">{d.stock_quantity}</div>
                    <div className="text-xs text-orange-500">/ {d.low_stock_threshold} {isAr ? "الحد الأدنى" : "minimum"}</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>
        <Card title={`❌ ${isAr ? "أدوية منتهية" : "Expired Drugs"} (${expiredDrugs.length})`}>
          {expiredDrugs.length === 0 ? <EmptyState icon="✅" message={isAr ? "لا توجد أدوية منتهية" : "No expired drugs"} /> : (
            <div className="space-y-2">
              {expiredDrugs.map(d => (
                <div key={d.id} className="expired flex items-center justify-between p-3 rounded-xl">
                  <div className="text-sm font-bold text-red-800">{d.name}</div>
                  <div className="text-xs text-red-600">Expired: {d.expiry_date}</div>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>
    ),
  };

  return (
    <div className="relative z-10 flex min-h-screen">
      <Sidebar role="PHARMACIST" active={active} onSelect={setActive} user={session.user} onLogout={onLogout} />
      <main className="flex-1 overflow-auto">
        <header className="sticky top-0 z-20 bg-white/80 backdrop-blur border-b border-slate-200 px-6 py-4">
          <div className="flex items-center justify-between">
            <h1 className="font-heading text-xl font-bold text-hmsNavy">
              {isAr ? "لوحة الصيدلية" : "Pharmacy Management System"}
            </h1>
            <div className="flex gap-2">
              {lowStock.length > 0 && (
                <span className="text-xs bg-orange-50 text-orange-700 px-3 py-1 rounded-full font-semibold animate-pulse">
                  ⚠️ {lowStock.length} {isAr ? "تنبيه" : "alerts"}
                </span>
              )}
            </div>
          </div>
        </header>
        <div className="p-6">
          {sections[active]}
        </div>
      </main>
    </div>
  );
}
