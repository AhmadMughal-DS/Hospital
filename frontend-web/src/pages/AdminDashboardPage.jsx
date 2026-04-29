import { useState, useEffect } from "react";
import axios from "axios";
import { useTranslation } from "react-i18next";
import Sidebar, { MobileMenuBtn } from "../components/Sidebar";
import { StatCard, Card, Badge, Btn, Alert, EmptyState, TableWrap } from "../components/ui";
import { useSEO } from "../hooks/useSEO";
import AdminDoctorsSection from "../components/admin/AdminDoctorsSection";
import AdminPharmacySection from "../components/admin/AdminPharmacySection";
import AdminOPDXRaySection from "../components/admin/AdminOPDXRaySection";
import PatientRecordModal from "../components/PatientRecordModal";


const API = import.meta.env.VITE_DJANGO_API_BASE || "http://localhost:8000";

export default function AdminDashboardPage({ session, onLogout }) {
  const { i18n } = useTranslation();
  const isAr = i18n.language === "ar";
  const [active, setActive] = useState("overview");
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const headers = { Authorization: `Bearer ${session.access}` };

  const [appointments, setAppointments] = useState([]);
  const [invoices, setInvoices] = useState([]);
  const [drugs, setDrugs] = useState([]);
  const [doctors, setDoctors] = useState([]);
  const [specialties, setSpecialties] = useState([]);
  const [queue, setQueue] = useState({ current: null, waiting_count: 0, queue: [] });
  const [billingSummary, setBillingSummary] = useState(null);
  const [aptFilter, setAptFilter] = useState("ALL");
  const [allPatients, setAllPatients] = useState([]);
  const [patientSearch, setPatientSearch] = useState("");
  const [viewPatientId, setViewPatientId] = useState(null);

  const load = async () => {
    try {
      const [appts, invs, drugsRes, queueRes, summary, docsRes, specsRes, patientsRes] = await Promise.all([
        axios.get(`${API}/api/v1/appointments/`, { headers }),
        axios.get(`${API}/api/v1/billing/invoices/`, { headers }),
        axios.get(`${API}/api/v1/pharmacy/drugs/`, { headers }),
        axios.get(`${API}/api/v1/queue/tokens/current`),
        axios.get(`${API}/api/v1/billing/summary/`, { headers }),
        axios.get(`${API}/api/v1/doctors/admin-all/`, { headers }),
        axios.get(`${API}/api/v1/doctors/specialties/`, { headers }),
        axios.get(`${API}/api/v1/auth/patients/`, { headers }),
      ]);
      setAppointments(appts.data.results || appts.data);
      setInvoices(invs.data.results || invs.data);
      setDrugs(drugsRes.data.results || drugsRes.data);
      setQueue(queueRes.data);
      setBillingSummary(summary.data);
      setDoctors(docsRes.data.results || docsRes.data);
      setSpecialties(specsRes.data.results || specsRes.data);
      setAllPatients(patientsRes.data.results || patientsRes.data);
    } catch {}
  };

  useEffect(() => { load(); const id = setInterval(load, 15000); return () => clearInterval(id); }, []);

  const callNext = async () => { try { await axios.post(`${API}/api/v1/queue/tokens/call-next/`, {}, { headers }); load(); } catch {} };
  const payInvoice = async (id) => { try { await axios.post(`${API}/api/v1/billing/invoices/${id}/pay/`, { payment_method: "CASH" }, { headers }); load(); } catch {} };
  const updateAptStatus = async (id, status) => { try { await axios.patch(`${API}/api/v1/appointments/${id}/`, { status }, { headers }); load(); } catch {} };

  // Stats computed from data
  const today = new Date().toISOString().split("T")[0];
  const todayApts = appointments.filter(a => a.appointment_date === today);
  const teleCount = appointments.filter(a => a.appointment_type === "TELE_HEALTH").length;
  const inPersonCount = appointments.filter(a => a.appointment_type === "IN_PERSON").length;
  const completedCount = appointments.filter(a => a.status === "COMPLETED").length;
  const cancelledCount = appointments.filter(a => a.status === "CANCELLED").length;
  const lowStockCount = drugs.filter(d => d.is_low_stock).length;
  const totalRevenue = billingSummary?.total_revenue || 0;
  const pendingInvoices = invoices.filter(i => i.status === "PENDING");

  // Monthly revenue from invoices (last 6 months)
  const monthlyRevenue = (() => {
    const months = {};
    invoices.filter(i => i.status === "PAID").forEach(i => {
      const m = i.created_at?.slice(0, 7) || "";
      months[m] = (months[m] || 0) + parseFloat(i.total || 0);
    });
    return Object.entries(months).sort().slice(-6);
  })();
  const maxRev = Math.max(...monthlyRevenue.map(([,v]) => v), 1);

  const filteredApts = aptFilter === "ALL" ? appointments :
    aptFilter === "TODAY" ? todayApts :
    appointments.filter(a => a.status === aptFilter);

  const sections = {
    overview: (
      <div className="space-y-6">
        {/* Stat grid */}
        <div className="grid grid-cols-2 xl:grid-cols-4 gap-3">
          <StatCard icon="💰" title="Total Revenue" value={`AED ${parseFloat(totalRevenue).toFixed(0)}`} color="emerald"/>
          <StatCard icon="📅" title="Total Appointments" value={appointments.length} color="teal"/>
          <StatCard icon="🏥" title="Today's OPD" value={todayApts.length} color="blue"/>
          <StatCard icon="⏳" title="Pending Invoices" value={billingSummary?.pending_count || 0} color="amber"/>
        </div>

        <div className="grid lg:grid-cols-3 gap-4">
          {/* Queue */}
          <Card title="🔢 Live Queue" className="lg:col-span-1">
            <div className="text-center py-4">
              <div className="inline-flex w-20 h-20 rounded-full bg-gradient-to-br from-hmsTeal to-hmsMint text-white text-3xl font-black items-center justify-center mb-3">
                {queue.current?.token_number || "—"}
              </div>
              <div className="text-sm text-slate-500 mb-1">Now Serving</div>
              <div className="text-xs text-slate-400 mb-4">{queue.waiting_count} waiting</div>
              <Btn onClick={callNext} className="w-full justify-center">📢 Call Next</Btn>
            </div>
          </Card>

          {/* Revenue Chart */}
          <Card title="📊 Monthly Revenue (AED)" className="lg:col-span-2">
            {monthlyRevenue.length === 0 ? <EmptyState icon="📊" message="No revenue data yet"/> : (
              <div className="flex items-end gap-2 h-36 px-2">
                {monthlyRevenue.map(([month, rev]) => (
                  <div key={month} className="flex-1 flex flex-col items-center gap-1">
                    <span className="text-xs text-slate-500 font-semibold">{parseFloat(rev).toFixed(0)}</span>
                    <div className="w-full bg-gradient-to-t from-hmsTeal to-hmsMint rounded-t-lg transition-all"
                      style={{height: `${(rev/maxRev)*100}%`, minHeight:"4px"}}/>
                    <span className="text-xs text-slate-400">{month.slice(5)}</span>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </div>

        {/* Appointment type breakdown */}
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card title="Appointment Types">
            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-sm text-slate-600">🏥 In-Person</span>
                <span className="font-bold text-hmsNavy">{inPersonCount}</span>
              </div>
              <div className="w-full bg-slate-100 rounded-full h-2">
                <div className="bg-hmsTeal h-2 rounded-full" style={{width:`${appointments.length?inPersonCount/appointments.length*100:0}%`}}/>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-slate-600">📹 TeleHealth</span>
                <span className="font-bold text-blue-600">{teleCount}</span>
              </div>
              <div className="w-full bg-slate-100 rounded-full h-2">
                <div className="bg-blue-500 h-2 rounded-full" style={{width:`${appointments.length?teleCount/appointments.length*100:0}%`}}/>
              </div>
            </div>
          </Card>

          <Card title="Appointment Status">
            <div className="space-y-2">
              {[["COMPLETED","✅",completedCount,"emerald"],["SCHEDULED","📅",appointments.filter(a=>a.status==="SCHEDULED").length,"blue"],["CANCELLED","❌",cancelledCount,"red"]].map(([s,ico,cnt,col])=>(
                <div key={s} className="flex justify-between items-center py-1 border-b border-slate-50">
                  <span className="text-sm text-slate-600">{ico} {s}</span>
                  <span className={`font-bold text-${col}-600`}>{cnt}</span>
                </div>
              ))}
            </div>
          </Card>

          <Card title="💊 Pharmacy">
            <div className="space-y-2">
              <div className="flex justify-between"><span className="text-sm text-slate-600">Total Medicines</span><span className="font-bold">{drugs.length}</span></div>
              <div className="flex justify-between"><span className="text-sm text-orange-600">⚠️ Low Stock</span><span className="font-bold text-orange-600">{lowStockCount}</span></div>
              <div className="flex justify-between"><span className="text-sm text-red-600">❌ Expired</span><span className="font-bold text-red-600">{drugs.filter(d=>d.is_expired).length}</span></div>
            </div>
          </Card>

          <Card title="👨‍⚕️ Doctors">
            <div className="space-y-2">
              <div className="flex justify-between"><span className="text-sm text-slate-600">Active Doctors</span><span className="font-bold">{doctors.filter(d=>d.is_active).length}</span></div>
              <div className="flex justify-between"><span className="text-sm text-slate-600">Specialties</span><span className="font-bold">{specialties.length}</span></div>
              <div className="flex justify-between"><span className="text-sm text-blue-600">📹 TeleHealth</span><span className="font-bold text-blue-600">{doctors.filter(d=>d.is_tele_health_enabled).length}</span></div>
            </div>
          </Card>
        </div>

        {/* Low stock alerts */}
        {lowStockCount > 0 && (
          <Card title="⚠️ Low Stock Alerts">
            <div className="grid sm:grid-cols-2 gap-2">
              {drugs.filter(d=>d.is_low_stock).slice(0,6).map(d=>(
                <div key={d.id} className="flex items-center justify-between p-3 rounded-xl bg-orange-50 border border-orange-100">
                  <span className="text-sm font-semibold text-orange-800">{d.name}</span>
                  <span className="text-xs font-bold text-orange-600">{d.stock_quantity} left</span>
                </div>
              ))}
            </div>
          </Card>
        )}
      </div>
    ),

    appointments: (
      <div className="space-y-4">
        {/* Filter tabs */}
        <div className="flex gap-2 flex-wrap">
          {[["ALL","All"],["TODAY","Today"],["SCHEDULED","Scheduled"],["COMPLETED","Completed"],["CANCELLED","Cancelled"]].map(([val,lbl])=>(
            <button key={val} onClick={()=>setAptFilter(val)}
              className={`px-3 py-1.5 rounded-full text-xs font-semibold transition ${aptFilter===val?"bg-hmsTeal text-white":"bg-slate-100 text-slate-600"}`}>
              {lbl} {val==="ALL"?appointments.length:val==="TODAY"?todayApts.length:appointments.filter(a=>a.status===val).length}
            </button>
          ))}
        </div>
        <Card title={`Appointments (${filteredApts.length})`}>
          {filteredApts.length===0 ? <EmptyState icon="📅" message="No appointments"/> : (
            <TableWrap>
              <table className="hms-table w-full text-sm">
                <thead><tr>
                  <th>Ref</th><th>Patient</th><th className="hidden sm:table-cell">Doctor</th>
                  <th>Date/Time</th><th className="hidden md:table-cell">Type</th>
                  <th>Status</th><th>Action</th>
                </tr></thead>
                <tbody>
                  {filteredApts.map(apt=>(
                    <tr key={apt.id}>
                      <td className="font-mono text-xs">{apt.appointment_ref}</td>
                      <td className="font-semibold whitespace-nowrap">{apt.patient_name}</td>
                      <td className="hidden sm:table-cell whitespace-nowrap">{apt.doctor_detail?.full_name}</td>
                      <td className="whitespace-nowrap text-xs">{apt.appointment_date} {apt.appointment_time?.slice(0,5)}</td>
                      <td className="hidden md:table-cell text-xs">{apt.appointment_type}</td>
                      <td><Badge status={apt.status}/></td>
                      <td>
                        <select value={apt.status} onChange={e=>updateAptStatus(apt.id,e.target.value)}
                          className="text-xs border border-slate-200 rounded-lg px-2 py-1">
                          {["SCHEDULED","CONFIRMED","IN_PROGRESS","COMPLETED","CANCELLED","NO_SHOW"].map(s=><option key={s}>{s}</option>)}
                        </select>
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

    billing: (
      <div className="space-y-4">
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          <StatCard icon="✅" title="Paid" value={billingSummary?.paid_count||0} color="emerald"/>
          <StatCard icon="⏳" title="Pending" value={billingSummary?.pending_count||0} color="amber"/>
          <StatCard icon="💰" title="Revenue" value={`AED ${parseFloat(totalRevenue).toFixed(0)}`} color="teal" className="col-span-2 sm:col-span-1"/>
        </div>
        <Card title="All Invoices">
          {invoices.length===0 ? <EmptyState icon="💳" message="No invoices"/> : (
            <TableWrap>
              <table className="hms-table w-full text-sm">
                <thead><tr>
                  <th>Invoice #</th><th>Patient</th><th>Total</th>
                  <th className="hidden sm:table-cell">Paid</th>
                  <th>Status</th><th>Action</th>
                </tr></thead>
                <tbody>
                  {invoices.map(inv=>(
                    <tr key={inv.id}>
                      <td className="font-mono text-xs font-semibold">{inv.invoice_number}</td>
                      <td>{inv.patient_name}</td>
                      <td className="font-bold">{inv.currency} {inv.total}</td>
                      <td className="hidden sm:table-cell">{inv.amount_paid}</td>
                      <td><Badge status={inv.status}/></td>
                      <td>{inv.status==="PENDING"&&<Btn size="sm" onClick={()=>payInvoice(inv.id)}>Mark Paid</Btn>}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </TableWrap>
          )}
        </Card>
      </div>
    ),

    doctors: <AdminDoctorsSection headers={headers} specialties={specialties} doctors={doctors} onRefresh={load}/>,
    pharmacy: <AdminPharmacySection headers={headers} drugs={drugs} onRefresh={load}/>,
    opd: <AdminOPDXRaySection headers={headers} doctors={doctors}/>,

    queue: (
      <div className="grid gap-4 lg:grid-cols-2">
        <Card title="Queue Control">
          <div className="text-center py-6">
            <div className="inline-flex w-24 h-24 rounded-full bg-gradient-to-br from-hmsTeal to-hmsMint text-white text-3xl font-black items-center justify-center mb-4 shadow-xl">
              {queue.current?.token_number || "—"}
            </div>
            <div className="text-sm font-semibold text-slate-600 mb-1">Now Serving</div>
            <div className="text-xs text-slate-400 mb-6">{queue.waiting_count} waiting</div>
            <Btn onClick={callNext} size="lg" className="w-full justify-center">📢 Call Next Patient</Btn>
          </div>
        </Card>
        <Card title="Queue List">
          {queue.queue.length===0 ? <EmptyState icon="🔢" message="Queue empty"/> : (
            <div className="space-y-2 max-h-80 overflow-y-auto">
              {queue.queue.map(t=>(
                <div key={t.id} className="flex items-center justify-between p-2 rounded-lg border border-slate-100 gap-2">
                  <div className="flex items-center gap-3">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm ${t.is_priority?"bg-amber-100 text-amber-700":"bg-slate-100 text-slate-700"}`}>
                      #{t.token_number}
                    </div>
                    <div>
                      <div className="text-sm font-medium text-hmsNavy">{t.patient_display}</div>
                      {t.is_priority && <span className="text-xs text-amber-600 font-semibold">⭐ Priority</span>}
                    </div>
                  </div>
                  <Badge status={t.status}/>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>
    ),

    patients: (
      <div className="space-y-4">
        <div className="flex items-center gap-3 flex-wrap">
          <input placeholder="🔍 Search by name, email or Patient ID..."
            value={patientSearch} onChange={e=>setPatientSearch(e.target.value)}
            className="border border-slate-200 rounded-xl px-4 py-2 text-sm flex-1 min-w-[200px]"/>
          <span className="text-xs text-slate-400 font-semibold">{allPatients.length} total patient(s)</span>
        </div>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
          {allPatients
            .filter(p => `${p.first_name} ${p.last_name} ${p.email} ${p.patient_id}`.toLowerCase().includes(patientSearch.toLowerCase()))
            .map(p => (
              <div key={p.id} onClick={()=>setViewPatientId(p.patient_id)}
                className="p-4 rounded-2xl border-2 border-slate-100 hover:border-hmsTeal/40 cursor-pointer transition group">
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-9 h-9 rounded-full bg-gradient-to-br from-hmsTeal to-hmsMint flex items-center justify-center text-white font-bold text-sm flex-shrink-0">
                    {(p.first_name?.[0]||p.email?.[0]||"P").toUpperCase()}
                  </div>
                  <div className="min-w-0">
                    <div className="font-semibold text-hmsNavy text-sm truncate">{p.first_name} {p.last_name}</div>
                    <div className="font-mono text-xs text-slate-400">{p.patient_id}</div>
                  </div>
                </div>
                <div className="text-xs text-slate-500 truncate mb-2">{p.email}</div>
                {p.profile?.blood_group && p.profile.blood_group !== "UNKNOWN" && (
                  <span className="text-xs bg-red-50 text-red-600 font-bold px-2 py-0.5 rounded-full">🩸 {p.profile.blood_group}</span>
                )}
                {p.profile?.allergies && (
                  <div className="mt-1 text-xs text-orange-600 truncate">⚠️ {p.profile.allergies}</div>
                )}
                <div className="mt-3 text-xs text-hmsTeal font-semibold group-hover:underline">View Full Record →</div>
              </div>
            ))}
          {allPatients.length === 0 && (
            <div className="col-span-4 text-center py-16 text-slate-400">
              <div className="text-4xl mb-2">👥</div>
              <p>No patients registered yet.</p>
            </div>
          )}
        </div>
      </div>
    ),
  };

  return (
    <div className="relative z-10 flex min-h-screen">
      <Sidebar role="ADMIN" active={active} onSelect={setActive} user={session.user} onLogout={onLogout} mobileOpen={sidebarOpen} onMobileClose={()=>setSidebarOpen(false)}/>
      <main className="flex-1 overflow-auto min-w-0">
        <header className="sticky top-0 z-20 bg-white/90 backdrop-blur border-b border-slate-200 px-4 sm:px-6 py-3 sm:py-4">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center min-w-0">
              <MobileMenuBtn onClick={()=>setSidebarOpen(true)}/>
              <h1 className="font-heading text-lg sm:text-xl font-bold text-hmsNavy truncate">Admin Control Center</h1>
            </div>
            <div className="flex items-center gap-2 text-xs font-semibold flex-shrink-0">
              <span className="bg-emerald-50 text-emerald-700 px-3 py-1 rounded-full">🟢 All Systems OK</span>
            </div>
          </div>
        </header>
        <div className="p-4 sm:p-6">{sections[active] || sections.overview}</div>
      </main>
      {viewPatientId && (
        <PatientRecordModal
          patientId={viewPatientId}
          headers={headers}
          onClose={() => setViewPatientId(null)}
        />
      )}
    </div>
  );
}
