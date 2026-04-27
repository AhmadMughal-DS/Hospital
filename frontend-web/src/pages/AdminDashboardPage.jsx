import { useState, useEffect } from "react";
import axios from "axios";
import { useTranslation } from "react-i18next";
import Sidebar from "../components/Sidebar";
import { StatCard, Card, Badge, Btn, Input, Select, Alert, Spinner, EmptyState } from "../components/ui";
import { useSEO } from "../hooks/useSEO";

const API = import.meta.env.VITE_DJANGO_API_BASE || "http://localhost:8000";

export default function AdminDashboardPage({ session, onLogout }) {
  const { i18n } = useTranslation();
  const isAr = i18n.language === "ar";
  const [active, setActive] = useState("overview");
  const headers = { Authorization: `Bearer ${session.access}` };

  const [appointments, setAppointments] = useState([]);
  const [invoices, setInvoices] = useState([]);
  const [drugs, setDrugs] = useState([]);
  const [queue, setQueue] = useState({ current: null, waiting_count: 0, queue: [] });
  const [billingSummary, setBillingSummary] = useState(null);

  const load = async () => {
    try {
      const [appts, invs, drugsRes, queueRes, summary] = await Promise.all([
        axios.get(`${API}/api/v1/appointments/`, { headers }),
        axios.get(`${API}/api/v1/billing/invoices/`, { headers }),
        axios.get(`${API}/api/v1/pharmacy/drugs/`, { headers }),
        axios.get(`${API}/api/v1/queue/tokens/current`),
        axios.get(`${API}/api/v1/billing/summary/`, { headers }),
      ]);
      setAppointments(appts.data.results || appts.data);
      setInvoices(invs.data.results || invs.data);
      setDrugs(drugsRes.data.results || drugsRes.data);
      setQueue(queueRes.data);
      setBillingSummary(summary.data);
    } catch {}
  };

  useEffect(() => { load(); const id = setInterval(load, 15000); return () => clearInterval(id); }, []);

  const callNext = async () => {
    try {
      await axios.post(`${API}/api/v1/queue/tokens/call-next/`, {}, { headers });
      load();
    } catch {}
  };

  const payInvoice = async (id) => {
    try {
      await axios.post(`${API}/api/v1/billing/invoices/${id}/pay/`, { payment_method: "CASH" }, { headers });
      load();
    } catch {}
  };

  const sections = {
    overview: (
      <div className="space-y-6">
        <div className="grid sm:grid-cols-2 xl:grid-cols-4 gap-4">
          <StatCard icon="💰" title={isAr ? "الإيرادات الكلية" : "Total Revenue"} value={`AED ${billingSummary?.total_revenue?.toFixed(0) || 0}`} color="emerald" />
          <StatCard icon="📅" title={isAr ? "المواعيد" : "Appointments"} value={appointments.length} color="teal" />
          <StatCard icon="⏳" title={isAr ? "فواتير معلقة" : "Pending Invoices"} value={billingSummary?.pending_count || 0} color="amber" />
          <StatCard icon="🔢" title={isAr ? "الطابور" : "Queue Waiting"} value={queue.waiting_count} color="navy" />
        </div>

        {/* Live queue widget */}
        <div className="grid lg:grid-cols-3 gap-4">
          <Card title={isAr ? "الطابور المباشر" : "Live Queue"} className="lg:col-span-1">
            <div className="text-center py-4">
              <div className="inline-flex w-20 h-20 rounded-full bg-gradient-to-br from-hmsTeal to-hmsMint text-white text-3xl font-black items-center justify-center pulse-ring mb-3">
                {queue.current?.token_number || "-"}
              </div>
              <div className="text-sm text-slate-500">{isAr ? "الرقم الحالي" : "Now Serving"}</div>
              <div className="text-xs text-slate-400 mb-4">{isAr ? `${queue.waiting_count} في الانتظار` : `${queue.waiting_count} waiting`}</div>
              <Btn onClick={callNext} className="w-full justify-center">{isAr ? "استدعاء التالي" : "Call Next"}</Btn>
            </div>
          </Card>

          <Card title={isAr ? "أحدث المواعيد" : "Recent Appointments"} className="lg:col-span-2">
            {appointments.length === 0 ? <EmptyState icon="📅" message="No appointments" /> : (
              <div className="space-y-2">
                {appointments.slice(0, 5).map(apt => (
                  <div key={apt.id} className="flex items-center justify-between py-2 border-b border-slate-100">
                    <div>
                      <div className="text-sm font-semibold text-hmsNavy">{apt.patient_name}</div>
                      <div className="text-xs text-slate-500">{apt.doctor_detail?.full_name} • {apt.appointment_date}</div>
                    </div>
                    <Badge status={apt.status} />
                  </div>
                ))}
              </div>
            )}
          </Card>
        </div>

        {/* Low stock alerts */}
        {drugs.filter(d => d.is_low_stock).length > 0 && (
          <Card title={`⚠️ ${isAr ? "تنبيهات المخزون" : "Low Stock Alerts"}`}>
            <div className="space-y-2">
              {drugs.filter(d => d.is_low_stock).slice(0, 4).map(d => (
                <div key={d.id} className="low-stock flex items-center justify-between p-3 rounded-xl">
                  <div className="text-sm font-semibold text-orange-800">{d.name}</div>
                  <div className="text-xs font-bold text-orange-600">{d.stock_quantity} {isAr ? "متبقية" : "remaining"}</div>
                </div>
              ))}
            </div>
          </Card>
        )}
      </div>
    ),

    appointments: (
      <Card title={isAr ? "جميع المواعيد" : "All Appointments"}>
        {appointments.length === 0 ? <EmptyState icon="📅" message="No appointments" /> : (
          <div className="overflow-x-auto">
            <table className="hms-table w-full text-sm">
              <thead>
                <tr>
                  <th>Ref</th>
                  <th>{isAr ? "المريض" : "Patient"}</th>
                  <th>{isAr ? "الطبيب" : "Doctor"}</th>
                  <th>{isAr ? "التاريخ" : "Date"}</th>
                  <th>{isAr ? "النوع" : "Type"}</th>
                  <th>{isAr ? "الحالة" : "Status"}</th>
                  <th>{isAr ? "الرسوم" : "Fee"}</th>
                </tr>
              </thead>
              <tbody>
                {appointments.map(apt => (
                  <tr key={apt.id}>
                    <td className="font-mono text-xs">{apt.appointment_ref}</td>
                    <td className="font-semibold">{apt.patient_name}</td>
                    <td>{apt.doctor_detail?.full_name}</td>
                    <td>{apt.appointment_date} {apt.appointment_time?.slice(0, 5)}</td>
                    <td className="text-xs">{apt.appointment_type}</td>
                    <td><Badge status={apt.status} /></td>
                    <td>{apt.currency} {apt.fee}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    ),

    billing: (
      <div className="space-y-4">
        <div className="grid sm:grid-cols-3 gap-4">
          <StatCard icon="✅" title={isAr ? "مدفوعة" : "Paid"} value={billingSummary?.paid_count || 0} color="emerald" />
          <StatCard icon="⏳" title={isAr ? "معلقة" : "Pending"} value={billingSummary?.pending_count || 0} color="amber" />
          <StatCard icon="💰" title={isAr ? "الإيرادات" : "Revenue"} value={`AED ${billingSummary?.total_revenue?.toFixed(0) || 0}`} color="teal" />
        </div>
        <Card title={isAr ? "جميع الفواتير" : "All Invoices"}>
          {invoices.length === 0 ? <EmptyState icon="💳" message="No invoices" /> : (
            <table className="hms-table w-full text-sm">
              <thead>
                <tr>
                  <th>{isAr ? "رقم الفاتورة" : "Invoice #"}</th>
                  <th>{isAr ? "المريض" : "Patient"}</th>
                  <th>{isAr ? "الإجمالي" : "Total"}</th>
                  <th>{isAr ? "المدفوع" : "Paid"}</th>
                  <th>{isAr ? "العملة" : "Currency"}</th>
                  <th>{isAr ? "الحالة" : "Status"}</th>
                  <th>{isAr ? "إجراء" : "Action"}</th>
                </tr>
              </thead>
              <tbody>
                {invoices.map(inv => (
                  <tr key={inv.id}>
                    <td className="font-mono font-semibold text-xs">{inv.invoice_number}</td>
                    <td>{inv.patient_name}</td>
                    <td className="font-bold">{inv.total}</td>
                    <td>{inv.amount_paid}</td>
                    <td>{inv.currency}</td>
                    <td><Badge status={inv.status} /></td>
                    <td>
                      {inv.status === "PENDING" && (
                        <Btn size="sm" onClick={() => payInvoice(inv.id)}>{isAr ? "تسجيل دفع" : "Mark Paid"}</Btn>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Card>
      </div>
    ),

    pharmacy: (
      <Card title={isAr ? "المخزون الدوائي" : "Drug Inventory"}>
        {drugs.length === 0 ? <EmptyState icon="💊" message="No drugs" /> : (
          <table className="hms-table w-full text-sm">
            <thead>
              <tr>
                <th>{isAr ? "الدواء" : "Drug"}</th>
                <th>SKU</th>
                <th>{isAr ? "الفئة" : "Category"}</th>
                <th>{isAr ? "المخزون" : "Stock"}</th>
                <th>{isAr ? "السعر" : "Price AED"}</th>
                <th>{isAr ? "الانتهاء" : "Expiry"}</th>
                <th>{isAr ? "الحالة" : "Status"}</th>
              </tr>
            </thead>
            <tbody>
              {drugs.map(d => (
                <tr key={d.id} className={d.is_expired ? "expired" : d.is_low_stock ? "low-stock" : ""}>
                  <td className="font-semibold">{d.name}</td>
                  <td className="font-mono text-xs">{d.sku}</td>
                  <td>{d.category}</td>
                  <td className={`font-bold ${d.is_low_stock ? "text-orange-600" : "text-emerald-600"}`}>{d.stock_quantity}</td>
                  <td>{d.unit_price_aed}</td>
                  <td>{d.expiry_date}</td>
                  <td>
                    {d.is_expired ? <span className="text-xs font-bold text-red-600">❌ Expired</span> :
                      d.is_low_stock ? <span className="text-xs font-bold text-orange-600">⚠️ Low Stock</span> :
                        <span className="text-xs font-bold text-emerald-600">✅ OK</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>
    ),

    queue: (
      <div className="grid gap-4 lg:grid-cols-2">
        <Card title={isAr ? "التحكم في الطابور" : "Queue Control"}>
          <div className="text-center py-6">
            <div className="inline-flex w-24 h-24 rounded-full bg-gradient-to-br from-hmsTeal to-hmsMint text-white text-3xl font-black items-center justify-center pulse-ring mb-4 shadow-xl">
              {queue.current?.token_number || "-"}
            </div>
            <div className="text-sm font-semibold text-slate-600 mb-1">{isAr ? "الرقم الحالي" : "Now Serving"}</div>
            <div className="text-xs text-slate-400 mb-6">{queue.waiting_count} {isAr ? "في الانتظار" : "waiting"}</div>
            <Btn onClick={callNext} size="lg" className="w-full justify-center">
              📢 {isAr ? "استدعاء التالي" : "Call Next Patient"}
            </Btn>
          </div>
        </Card>

        <Card title={isAr ? "قائمة الانتظار" : "Queue List"}>
          {queue.queue.length === 0 ? <EmptyState icon="🔢" message="Queue empty" /> : (
            <div className="space-y-2 max-h-80 overflow-y-auto">
              {queue.queue.map(t => (
                <div key={t.id} className="flex items-center justify-between p-2 rounded-lg border border-slate-100">
                  <div className="flex items-center gap-3">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm ${t.is_priority ? "bg-amber-100 text-amber-700" : "bg-slate-100 text-slate-700"}`}>
                      #{t.token_number}
                    </div>
                    <div>
                      <div className="text-sm font-medium text-hmsNavy">{t.patient_display}</div>
                      {t.is_priority && <span className="text-xs text-amber-600 font-semibold">⭐ Priority</span>}
                    </div>
                  </div>
                  <Badge status={t.status} />
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>
    ),

    doctors: (
      <Card title={isAr ? "إدارة الأطباء" : "Doctors Management"}>
        <EmptyState icon="👨‍⚕️" message={isAr ? "إدارة الأطباء - قريباً" : "Doctor management panel — coming in next sprint"} />
      </Card>
    ),

    patients: (
      <Card title={isAr ? "إدارة المرضى" : "Patient Management"}>
        <EmptyState icon="👥" message={isAr ? "إدارة المرضى - قريباً" : "Patient management panel — coming in next sprint"} />
      </Card>
    ),
  };

  return (
    <div className="relative z-10 flex min-h-screen">
      <Sidebar role="ADMIN" active={active} onSelect={setActive} user={session.user} onLogout={onLogout} />
      <main className="flex-1 overflow-auto">
        <header className="sticky top-0 z-20 bg-white/80 backdrop-blur border-b border-slate-200 px-6 py-4">
          <div className="flex items-center justify-between">
            <h1 className="font-heading text-xl font-bold text-hmsNavy">
              {isAr ? "لوحة تحكم المدير" : "Admin Control Center"}
            </h1>
            <div className="flex items-center gap-3 text-xs font-semibold">
              <span className="bg-emerald-50 text-emerald-700 px-3 py-1 rounded-full">🟢 {isAr ? "النظام يعمل" : "All Systems Operational"}</span>
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
