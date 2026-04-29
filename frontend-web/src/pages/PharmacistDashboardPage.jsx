import { useState, useEffect } from "react";
import axios from "axios";
import { useTranslation } from "react-i18next";
import Sidebar, { MobileMenuBtn } from "../components/Sidebar";
import { StatCard, Card, Badge, Btn, Input, Select, Alert, EmptyState, TableWrap } from "../components/ui";
import { useSEO } from "../hooks/useSEO";

const API = import.meta.env.VITE_DJANGO_API_BASE || "http://localhost:8000";

export default function PharmacistDashboardPage({ session, onLogout }) {
  const { i18n } = useTranslation();
  const isAr = i18n.language === "ar";
  const [active, setActive] = useState("overview");
  const [sidebarOpen, setSidebarOpen] = useState(false);
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
        <div className="grid grid-cols-2 xl:grid-cols-4 gap-3 sm:gap-4">
          <StatCard icon="💊" title={isAr ? "إجمالي الأدوية" : "Total Drugs"} value={drugs.length} color="teal" />
          <StatCard icon="⚠️" title={isAr ? "مخزون منخفض" : "Low Stock"} value={lowStock.length} color="amber" />
          <StatCard icon="❌" title={isAr ? "منتهية الصلاحية" : "Expired"} value={expiredDrugs.length} color="rose" />
          <StatCard icon="📦" title={isAr ? "حركات اليوم" : "Movements"} value={movements.slice(0, 10).length} color="navy" />
        </div>

        {lowStock.length > 0 && (
          <Card title={`⚠️ ${isAr ? "تنبيهات مخزون منخفض" : "Low Stock Alerts"}`}>
            <div className="space-y-2">
              {lowStock.map(d => (
                <div key={d.id} className="low-stock flex items-center justify-between p-3 rounded-xl gap-2">
                  <div className="min-w-0">
                    <div className="text-sm font-bold text-orange-800 truncate">{d.name}</div>
                    <div className="text-xs text-orange-600 truncate">{d.sku} • {d.category}</div>
                  </div>
                  <div className="text-right flex-shrink-0">
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
              <div key={d.id} className="expired flex items-center justify-between p-3 rounded-xl mb-2 gap-2">
                <div className="text-sm font-bold text-red-800 truncate">{d.name}</div>
                <div className="text-xs text-red-600 flex-shrink-0">{isAr ? "انتهت في" : "Expired"}: {d.expiry_date}</div>
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
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
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
            <TableWrap>
              <table className="hms-table w-full text-sm">
                <thead>
                  <tr>
                    <th>{isAr ? "الدواء" : "Drug"}</th>
                    <th className="hidden sm:table-cell">SKU</th>
                    <th>{isAr ? "المخزون" : "Stock"}</th>
                    <th className="hidden sm:table-cell">{isAr ? "السعر" : "Price"}</th>
                    <th className="hidden md:table-cell">{isAr ? "الانتهاء" : "Expiry"}</th>
                    <th>{isAr ? "الحالة" : "Status"}</th>
                  </tr>
                </thead>
                <tbody>
                  {drugs.map(d => (
                    <tr key={d.id} className={d.is_expired ? "expired" : d.is_low_stock ? "low-stock" : ""}>
                      <td className="font-semibold whitespace-nowrap">{d.name}</td>
                      <td className="font-mono text-xs hidden sm:table-cell">{d.sku}</td>
                      <td className={`font-bold whitespace-nowrap ${d.is_low_stock ? "text-orange-600" : "text-emerald-700"}`}>{d.stock_quantity}</td>
                      <td className="hidden sm:table-cell whitespace-nowrap">AED {d.unit_price_aed}</td>
                      <td className="hidden md:table-cell">{d.expiry_date}</td>
                      <td>
                        {d.is_expired ? <span className="text-xs font-bold text-red-600 whitespace-nowrap">❌ Expired</span> :
                          d.is_low_stock ? <span className="text-xs font-bold text-orange-600 whitespace-nowrap">⚠️ Low</span> :
                            <span className="text-xs font-bold text-emerald-600 whitespace-nowrap">✅ OK</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </TableWrap>
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
            <TableWrap>
              <table className="hms-table w-full text-sm">
                <thead>
                  <tr>
                    <th>{isAr ? "الدواء" : "Drug"}</th>
                    <th>{isAr ? "النوع" : "Type"}</th>
                    <th>{isAr ? "الكمية" : "Qty"}</th>
                    <th className="hidden sm:table-cell">{isAr ? "المرجع" : "Ref"}</th>
                    <th className="hidden md:table-cell">{isAr ? "التاريخ" : "Date"}</th>
                  </tr>
                </thead>
                <tbody>
                  {movements.slice(0, 20).map(m => (
                    <tr key={m.id}>
                      <td className="font-semibold whitespace-nowrap">{m.drug_name}</td>
                      <td>
                        <span className={`text-xs font-semibold whitespace-nowrap ${m.movement_type === "IN" ? "text-emerald-600" : m.movement_type === "OUT" ? "text-rose-600" : "text-amber-600"}`}>
                          {m.movement_type}
                        </span>
                      </td>
                      <td className="font-bold">{m.quantity}</td>
                      <td className="text-slate-500 text-xs hidden sm:table-cell">{m.reference || "—"}</td>
                      <td className="text-xs text-slate-500 hidden md:table-cell whitespace-nowrap">{m.created_at?.slice(0, 16)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </TableWrap>
          )}
        </Card>
      </div>
    ),

    prescriptions: (
      <PrescriptionDispense headers={headers} drugs={drugs} onRefresh={loadAll}/>
    ),

    alerts: (
      <div className="space-y-4">
        <Card title={`⚠️ ${isAr ? "مخزون منخفض" : "Low Stock Drugs"} (${lowStock.length})`}>
          {lowStock.length === 0 ? <EmptyState icon="✅" message={isAr ? "لا توجد تحذيرات" : "No low stock items"} /> : (
            <div className="space-y-3">
              {lowStock.map(d => (
                <div key={d.id} className="low-stock flex items-center justify-between p-3 sm:p-4 rounded-xl gap-2">
                  <div className="min-w-0">
                    <div className="font-bold text-orange-800 truncate">{d.name}</div>
                    <div className="text-sm text-orange-600 truncate">{d.sku} • {d.category}</div>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <div className="text-xl sm:text-2xl font-black text-orange-600">{d.stock_quantity}</div>
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
                <div key={d.id} className="expired flex items-center justify-between p-3 rounded-xl gap-2">
                  <div className="text-sm font-bold text-red-800 truncate">{d.name}</div>
                  <div className="text-xs text-red-600 flex-shrink-0">Expired: {d.expiry_date}</div>
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
      <Sidebar
        role="PHARMACIST"
        active={active}
        onSelect={setActive}
        user={session.user}
        onLogout={onLogout}
        mobileOpen={sidebarOpen}
        onMobileClose={() => setSidebarOpen(false)}
      />
      <main className="flex-1 overflow-auto min-w-0">
        <header className="sticky top-0 z-20 bg-white/90 backdrop-blur border-b border-slate-200 px-4 sm:px-6 py-3 sm:py-4">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center min-w-0">
              <MobileMenuBtn onClick={() => setSidebarOpen(true)} />
              <h1 className="font-heading text-lg sm:text-xl font-bold text-hmsNavy truncate">
                {isAr ? "لوحة الصيدلية" : "Pharmacy Management"}
              </h1>
            </div>
            <div className="flex gap-2 flex-shrink-0">
              {lowStock.length > 0 && (
                <span className="text-xs bg-orange-50 text-orange-700 px-2 sm:px-3 py-1 rounded-full font-semibold animate-pulse">
                  ⚠️ {lowStock.length} <span className="hidden sm:inline">{isAr ? "تنبيه" : "alerts"}</span>
                </span>
              )}
            </div>
          </div>
        </header>
        <div className="p-4 sm:p-6">
          {sections[active]}
        </div>
      </main>
    </div>
  );
}

// ── Prescription Dispensing Component ────────────────────────────────────────
function PrescriptionDispense({ headers, drugs, onRefresh }) {
  const [prescriptions, setPrescriptions] = useState([]);
  const [selected, setSelected] = useState(null);
  const [dispensed, setDispensed] = useState({}); // {itemId: qty}
  const [msg, setMsg] = useState(null);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");

  const API = import.meta.env.VITE_DJANGO_API_BASE || "http://localhost:8000";

  useEffect(() => {
    axios.get(`${API}/api/v1/appointments/prescriptions/`, { headers })
      .then(r => setPrescriptions(r.data.results || r.data))
      .catch(() => {});
  }, []);

  const matchedDrug = (drugName) =>
    drugs.find(d => d.name.toLowerCase().includes(drugName.toLowerCase()));

  const calcQty = (item) => {
    const parts = item.frequency?.toLowerCase() || "";
    let timesPerDay = 1;
    if (parts.includes("twice") || parts.includes("2")) timesPerDay = 2;
    if (parts.includes("three") || parts.includes("3")) timesPerDay = 3;
    if (parts.includes("four") || parts.includes("4")) timesPerDay = 4;
    return (item.duration_days || 7) * timesPerDay;
  };

  const totalBill = (rx) => {
    if (!rx?.items) return 0;
    return rx.items.reduce((sum, item) => {
      const drug = matchedDrug(item.drug_name);
      const qty = dispensed[item.id] ?? calcQty(item);
      return sum + (drug ? parseFloat(drug.unit_price_aed) * qty : 0);
    }, 0);
  };

  const dispense = async () => {
    if (!selected) return;
    setLoading(true); setMsg(null);
    try {
      for (const item of selected.items) {
        const drug = matchedDrug(item.drug_name);
        if (!drug) continue;
        const qty = dispensed[item.id] ?? calcQty(item);
        await axios.post(`${API}/api/v1/pharmacy/stock-movements/`, {
          drug: drug.id, movement_type: "OUT", quantity: qty,
          reference: `RX-${selected.id}`,
          notes: `Dispensed for ${selected.appointment?.patient_name || "patient"}: ${item.drug_name} ${item.dosage}`,
        }, { headers });
      }
      setMsg({ ok: true, text: `✅ Dispensed successfully! Bill: AED ${totalBill(selected).toFixed(2)}` });
      setSelected(null); setDispensed({});
      onRefresh();
      setPrescriptions(p => p.filter(rx => rx.id !== selected.id));
    } catch { setMsg({ ok: false, text: "Error during dispensing" }); }
    finally { setLoading(false); }
  };

  const filtered = prescriptions.filter(rx =>
    (rx.appointment?.patient_name || "").toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="grid gap-4 lg:grid-cols-5">
      {/* Prescription list */}
      <div className="lg:col-span-2 space-y-3">
        <input placeholder="🔍 Search patient..." value={search} onChange={e=>setSearch(e.target.value)}
          className="w-full border border-slate-200 rounded-xl px-4 py-2 text-sm"/>
        {filtered.length === 0 && (
          <div className="text-center py-10 text-slate-400"><div className="text-4xl mb-2">💊</div><p className="text-sm">No prescriptions pending</p></div>
        )}
        {filtered.map(rx => (
          <div key={rx.id} onClick={() => { setSelected(rx); setDispensed({}); setMsg(null); }}
            className={`p-4 rounded-2xl border-2 cursor-pointer transition ${selected?.id===rx.id?"border-hmsTeal bg-hmsTeal/5":"border-slate-100 hover:border-hmsTeal/30"}`}>
            <div className="font-semibold text-hmsNavy">{rx.appointment?.patient_name || "Patient"}</div>
            <div className="text-xs text-slate-500 mt-1">{rx.appointment?.appointment_date} • {rx.items?.length} item(s)</div>
            {rx.is_dispensed && <span className="text-xs text-emerald-600 font-semibold">✅ Dispensed</span>}
          </div>
        ))}
      </div>

      {/* Dispense panel */}
      <div className="lg:col-span-3">
        {!selected ? (
          <div className="text-center py-20 text-slate-400"><div className="text-5xl mb-3">👈</div><p>Select a prescription to dispense</p></div>
        ) : (
          <div className="space-y-4">
            <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200">
              <div className="font-bold text-hmsNavy">{selected.appointment?.patient_name}</div>
              <div className="text-sm text-slate-500">{selected.appointment?.appointment_date} • {selected.notes}</div>
            </div>

            {/* Medicine calculator */}
            <div className="space-y-3">
              {selected.items?.map(item => {
                const drug = matchedDrug(item.drug_name);
                const suggestedQty = calcQty(item);
                const qty = dispensed[item.id] ?? suggestedQty;
                const price = drug ? parseFloat(drug.unit_price_aed) * qty : 0;
                return (
                  <div key={item.id} className={`p-4 rounded-2xl border-2 ${drug?"border-slate-200":"border-red-100 bg-red-50/30"}`}>
                    <div className="flex items-start justify-between gap-2 flex-wrap">
                      <div>
                        <div className="font-semibold text-hmsNavy">{item.drug_name}</div>
                        <div className="text-xs text-slate-500">{item.dosage} • {item.frequency} • {item.duration_days} days</div>
                        {drug
                          ? <div className="text-xs text-emerald-600 mt-1">✅ Matched: {drug.name} (Stock: {drug.stock_quantity}) • AED {drug.unit_price_aed}/{drug.unit}</div>
                          : <div className="text-xs text-red-500 mt-1">⚠️ No match found in inventory</div>
                        }
                      </div>
                      <div className="text-right">
                        <div className="text-xs text-slate-500 mb-1">Qty to dispense</div>
                        <input type="number" min="0" value={qty}
                          onChange={e => setDispensed(p=>({...p,[item.id]:parseInt(e.target.value)||0}))}
                          className="w-20 border border-slate-200 rounded-lg px-2 py-1 text-sm text-center font-bold"/>
                        {drug && <div className="text-xs font-semibold text-hmsTeal mt-1">AED {price.toFixed(2)}</div>}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Total bill */}
            <div className="flex items-center justify-between p-4 bg-gradient-to-r from-hmsTeal/10 to-hmsMint/10 rounded-2xl border border-hmsTeal/20">
              <div>
                <div className="text-xs text-slate-500">Total Patient Bill</div>
                <div className="text-2xl font-black text-hmsNavy">AED {totalBill(selected).toFixed(2)}</div>
              </div>
              <button onClick={dispense} disabled={loading}
                className="bg-hmsTeal hover:bg-hmsTeal/90 text-white font-bold px-6 py-3 rounded-xl transition disabled:opacity-50">
                {loading ? "Dispensing..." : "💊 Dispense All"}
              </button>
            </div>

            {msg && <div className={`p-3 rounded-xl text-sm font-semibold ${msg.ok?"bg-emerald-50 text-emerald-700":"bg-red-50 text-red-600"}`}>{msg.text}</div>}
          </div>
        )}
      </div>
    </div>
  );
}
