import { useState, useEffect } from "react";
import axios from "axios";
import { useTranslation } from "react-i18next";
import Sidebar, { MobileMenuBtn } from "../components/Sidebar";
import { StatCard, Card, Badge, Btn, Input, Select, Alert, Spinner, EmptyState, TableWrap } from "../components/ui";
import { Calendar, FileText, Video } from "lucide-react";
import { useSEO } from "../hooks/useSEO";
import BookingWizard from "../components/BookingWizard";
import VideoCallModal from "../components/VideoCallModal";
import { useAppointmentAlerts, getCallStatus } from "../hooks/useAppointmentAlerts";

const API = import.meta.env.VITE_DJANGO_API_BASE || "http://localhost:8000";
const QUEUE_API = import.meta.env.VITE_QUEUE_API_BASE || "http://localhost:8000";

const CURRENCIES = [["AED", "AED - UAE Dirham"], ["SAR", "SAR - Saudi Riyal"], ["EUR", "EUR - Euro"]];

export default function PatientDashboardPage({ session, onLogout }) {
  const { i18n } = useTranslation();
  const isAr = i18n.language === "ar";
  const [active, setActive] = useState("overview");
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const headers = { Authorization: `Bearer ${session.access}` };

  // State
  const [appointments, setAppointments] = useState([]);
  const [doctors, setDoctors] = useState([]);
  const [invoices, setInvoices] = useState([]);
  const [records] = useState([
    { id: "RX-1001", type: isAr ? "وصفة" : "Prescription", title: isAr ? "متابعة ضغط الدم" : "Hypertension follow-up", date: "2026-04-10" },
    { id: "LAB-2001", type: isAr ? "مختبر" : "Lab Report", title: isAr ? "صورة دم كاملة" : "Complete Blood Count", date: "2026-04-04" },
    { id: "VIS-3001", type: isAr ? "زيارة" : "Visit", title: isAr ? "استشارة عامة" : "General Consultation", date: "2026-03-20" },
  ]);
  const [queue, setQueue] = useState({ current: null, waiting_count: 0, queue: [] });

  // Booking
  const [currency, setCurrency] = useState("AED");
  const [specialtyFilter, setSpecialtyFilter] = useState("");

  const [loading, setLoading] = useState(false);

  // Video call state
  const [videoCall, setVideoCall] = useState(null);

  // Appointment alerts — browser notification + countdown
  const openCall = (apt) => setVideoCall({ roomId: apt.tele_room_id, displayName: session.user.first_name || session.user.email });
  useAppointmentAlerts(appointments, openCall);

  const loadAppointments = async () => {
    try {
      const { data } = await axios.get(`${API}/api/v1/appointments/`, { headers });
      setAppointments(data.results || data);
    } catch {}
  };

  const loadDoctors = async () => {
    try {
      const { data } = await axios.get(`${API}/api/v1/doctors/`, { headers });
      setDoctors(data.results || data);
    } catch {}
  };

  const loadInvoices = async () => {
    try {
      const { data } = await axios.get(`${API}/api/v1/billing/invoices/`, { headers });
      setInvoices(data.results || data);
    } catch {}
  };

  const loadQueue = async () => {
    try {
      const { data } = await axios.get(`${QUEUE_API}/api/v1/queue/tokens/current`);
      setQueue(data);
    } catch {}
  };

  useEffect(() => {
    loadAppointments();
    loadDoctors();
    loadInvoices();
    loadQueue();
    const id = setInterval(loadQueue, 5000);
    return () => clearInterval(id);
  }, []);




  const genToken = async () => {
    try {
      await axios.post(`${QUEUE_API}/api/v1/queue/tokens/`, {
        patient: session.user.id,
        is_priority: false,
      }, { headers });
      loadQueue();
    } catch (err) {
      alert("Queue service unavailable.");
    }
  };

  const pending = appointments.filter(a => a.status === "SCHEDULED" || a.status === "CONFIRMED");
  const totalPaid = invoices.filter(i => i.status === "PAID").reduce((s, i) => s + parseFloat(i.total || 0), 0);

  const sections = {
    overview: (
      <div className="space-y-6">
        <div className="grid grid-cols-2 xl:grid-cols-4 gap-3 sm:gap-4">
          <StatCard icon="👤" title={isAr ? "المريض" : "Patient"} value={session.user.first_name || "Patient"} sub={session.user.patient_id} color="navy" />
          <StatCard icon="📅" title={isAr ? "المواعيد القادمة" : "Upcoming"} value={pending.length} color="teal" />
          <StatCard icon="💳" title={isAr ? "إجمالي المدفوعات" : "Total Paid"} value={`${totalPaid.toFixed(0)} AED`} color="emerald" />
          <StatCard icon="🔢" title={isAr ? "انتظار" : "Queue"} value={queue.waiting_count} color="amber" />
        </div>

        {/* Upcoming appointments preview */}
        <Card title={isAr ? "المواعيد القادمة" : "Upcoming Appointments"} action={
          <Btn size="sm" onClick={() => setActive("booking")}>{isAr ? "+ حجز" : "+ Book"}</Btn>
        }>
          {appointments.length === 0 ? (
            <EmptyState icon="📅" message={isAr ? "لا توجد مواعيد حتى الآن" : "No appointments yet"} />
          ) : (
            <div className="space-y-2">
              {appointments.slice(0, 4).map(apt => (
                <div key={apt.id} className="flex items-center justify-between py-2 border-b border-slate-100 last:border-0 gap-2">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-8 h-8 rounded-full bg-hmsTeal/10 flex items-center justify-center text-hmsTeal flex-shrink-0">
                      <Calendar size={14} />
                    </div>
                    <div className="min-w-0">
                      <div className="text-sm font-semibold text-hmsNavy truncate">{apt.doctor_detail?.full_name || "Doctor"}</div>
                      <div className="text-xs text-slate-500 truncate">{apt.appointment_date} • {apt.appointment_time?.slice(0, 5)}</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <Badge status={apt.status} />
                    <JoinCallBtn apt={apt} onJoin={openCall} />
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>

        {/* Medical records preview */}
        <Card title={isAr ? "آخر السجلات الطبية" : "Recent Medical Records"}>
          <div className="space-y-2">
            {records.slice(0, 3).map(r => (
              <div key={r.id} className="flex items-center justify-between py-2 border-b border-slate-100 last:border-0 gap-2">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-8 h-8 rounded-full bg-blue-50 flex items-center justify-center text-blue-600 flex-shrink-0">
                    <FileText size={14} />
                  </div>
                  <div className="min-w-0">
                    <div className="text-sm font-semibold text-hmsNavy truncate">{r.title}</div>
                    <div className="text-xs text-slate-500">{r.type}</div>
                  </div>
                </div>
                <span className="text-xs text-slate-400 flex-shrink-0">{r.date}</span>
              </div>
            ))}
          </div>
        </Card>
      </div>
    ),

    booking: (
      <div className="max-w-2xl mx-auto space-y-4">
        {/* Currency & Specialty filter above wizard */}
        <div className="flex gap-3 flex-wrap">
          <Select
            label={isAr ? "العملة" : "Currency"}
            value={currency}
            onChange={e => setCurrency(e.target.value)}
            options={CURRENCIES}
            className="flex-1 min-w-[140px]"
          />
          <Select
            label={isAr ? "فلترة التخصص" : "Filter Specialty"}
            value={specialtyFilter}
            onChange={e => setSpecialtyFilter(e.target.value)}
            options={[["", isAr ? "الكل" : "All Specialties"], ...Array.from(new Set(doctors.map(d => d.specialty?.name).filter(Boolean))).map(s => [s, s])]}
            className="flex-1 min-w-[140px]"
          />
        </div>
        <Card title={isAr ? "حجز موعد" : "Book an Appointment"}>
          <BookingWizard
            session={session}
            doctors={specialtyFilter ? doctors.filter(d => d.specialty?.name === specialtyFilter) : doctors}
            currency={currency}
            onDone={loadAppointments}
          />
        </Card>
      </div>
    ),


    records: (
      <Card title={isAr ? "السجلات الطبية" : "Medical Records"}>
        <div className="space-y-3">
          {records.map(r => (
            <div key={r.id} className="flex items-center justify-between p-3 sm:p-4 rounded-xl border border-slate-100 hover:border-hmsTeal/30 hover:bg-slate-50 transition gap-3">
              <div className="flex items-center gap-3 sm:gap-4 min-w-0">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-blue-700 flex items-center justify-center text-white flex-shrink-0">
                  {r.type === "Prescription" || r.type === "وصفة" ? "💊" : r.type === "Lab Report" || r.type === "مختبر" ? "🧪" : "📋"}
                </div>
                <div className="min-w-0">
                  <div className="font-semibold text-hmsNavy text-sm truncate">{r.title}</div>
                  <div className="text-xs text-slate-500">{r.id} • {r.type}</div>
                </div>
              </div>
              <div className="text-right flex-shrink-0">
                <div className="text-xs font-semibold text-slate-600">{r.date}</div>
                <button className="text-xs text-hmsTeal font-medium mt-1 hover:underline">{isAr ? "تحميل" : "Download"}</button>
              </div>
            </div>
          ))}
        </div>
      </Card>
    ),

    payments: (
      <div className="space-y-4">
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 sm:gap-4">
          <StatCard icon="💳" title={isAr ? "إجمالي مدفوع" : "Total Paid"} value={`${totalPaid.toFixed(0)} AED`} color="emerald" />
          <StatCard icon="⏳" title={isAr ? "معلق" : "Pending"} value={invoices.filter(i => i.status === "PENDING").length} color="amber" />
          <StatCard icon="📄" title={isAr ? "فواتير" : "Invoices"} value={invoices.length} color="navy" className="col-span-2 sm:col-span-1" />
        </div>
        <Card title={isAr ? "الفواتير" : "Invoice History"}>
          {invoices.length === 0 ? (
            <EmptyState icon="💳" message={isAr ? "لا توجد فواتير" : "No invoices yet"} />
          ) : (
            <TableWrap>
              <table className="hms-table w-full text-sm">
                <thead>
                  <tr>
                    <th>{isAr ? "رقم الفاتورة" : "Invoice #"}</th>
                    <th>{isAr ? "المبلغ" : "Total"}</th>
                    <th className="hidden sm:table-cell">{isAr ? "العملة" : "Currency"}</th>
                    <th>{isAr ? "الحالة" : "Status"}</th>
                    <th className="hidden md:table-cell">{isAr ? "التاريخ" : "Date"}</th>
                  </tr>
                </thead>
                <tbody>
                  {invoices.map(inv => (
                    <tr key={inv.id}>
                      <td className="font-mono font-semibold text-xs whitespace-nowrap">{inv.invoice_number}</td>
                      <td className="font-bold whitespace-nowrap">{inv.total}</td>
                      <td className="hidden sm:table-cell">{inv.currency}</td>
                      <td><Badge status={inv.status} /></td>
                      <td className="text-slate-500 hidden md:table-cell">{inv.created_at?.slice(0, 10)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </TableWrap>
          )}
        </Card>
      </div>
    ),

    queue: (
      <div className="grid gap-4 lg:grid-cols-2">
        <Card title={isAr ? "الطابور المباشر" : "Live Queue"} subtitle={isAr ? "يتحدث كل 5 ثوانٍ" : "Updates every 5s"}>
          {/* Current token */}
          <div className="text-center py-6">
            <div className="inline-flex items-center justify-center w-24 h-24 rounded-full bg-gradient-to-br from-hmsTeal to-hmsMint text-white text-3xl font-extrabold font-heading pulse-ring shadow-xl mb-4">
              {queue.current?.token_number || "-"}
            </div>
            <div className="text-sm font-semibold text-slate-600 mb-1">{isAr ? "الرقم الحالي" : "Now Serving"}</div>
            <div className="text-xs text-slate-400 mb-4">{isAr ? `${queue.waiting_count} في الانتظار` : `${queue.waiting_count} waiting`}</div>
          </div>
          <Btn onClick={genToken} className="w-full justify-center" size="lg">
            🎫 {isAr ? "احصل على رقم انتظار" : "Get Queue Token"}
          </Btn>
        </Card>

        <Card title={isAr ? "قائمة الانتظار" : "Queue List"}>
          {queue.queue.length === 0 ? (
            <EmptyState icon="🔢" message={isAr ? "الطابور فارغ" : "Queue is empty"} />
          ) : (
            <div className="space-y-2 max-h-80 overflow-y-auto">
              {queue.queue.map(t => (
                <div key={t.id} className="flex items-center justify-between p-2 rounded-lg border border-slate-100 gap-2">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center font-bold text-sm text-hmsNavy flex-shrink-0">
                      #{t.token_number}
                    </div>
                    <div className="min-w-0">
                      <div className="font-medium text-hmsNavy text-sm truncate">{t.patient_display}</div>
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
  };

  const headerTitle = {
    overview: isAr ? "لوحة التحكم" : "Patient Dashboard",
    booking: isAr ? "حجز موعد" : "Book Appointment",
    records: isAr ? "السجلات الطبية" : "Medical Records",
    payments: isAr ? "المدفوعات" : "Payments",
    queue: isAr ? "قائمة الانتظار" : "Queue",
  };

  return (
    <div className="relative z-10 flex min-h-screen">
      {/* Video Call Modal */}
      {videoCall && (
        <VideoCallModal
          roomId={videoCall.roomId}
          displayName={videoCall.displayName}
          role="PATIENT"
          onClose={() => setVideoCall(null)}
        />
      )}
      <Sidebar
        role="PATIENT"
        active={active}
        onSelect={setActive}
        user={session.user}
        onLogout={onLogout}
        mobileOpen={sidebarOpen}
        onMobileClose={() => setSidebarOpen(false)}
      />
      <main className="flex-1 overflow-auto min-w-0">
        {/* Header */}
        <header className="sticky top-0 z-20 bg-white/90 backdrop-blur border-b border-slate-200 px-4 sm:px-6 py-3 sm:py-4">
          <div className="flex items-center gap-2">
            <MobileMenuBtn onClick={() => setSidebarOpen(true)} />
            <h1 className="font-heading text-lg sm:text-xl font-bold text-hmsNavy truncate">
              {headerTitle[active] || "Dashboard"}
            </h1>
          </div>
        </header>
        <div className="p-4 sm:p-6">
          {sections[active]}
        </div>
      </main>
    </div>
  );
}

// ── Smart time-aware Join Call Button ─────────────────────────────────────────
function JoinCallBtn({ apt, onJoin }) {
  const [, forceUpdate] = useState(0);
  // Re-render every 30 seconds so countdown stays fresh
  useEffect(() => {
    const id = setInterval(() => forceUpdate(n => n + 1), 30_000);
    return () => clearInterval(id);
  }, []);

  const cs = getCallStatus(apt);
  if (cs.state === "na") return null;

  const styles = {
    upcoming: "bg-slate-100 text-slate-500 cursor-not-allowed",
    soon:     "bg-amber-500 hover:bg-amber-600 text-white animate-pulse",
    now:      "bg-emerald-500 hover:bg-emerald-600 text-white shadow-lg shadow-emerald-500/40 animate-pulse",
    ended:    "bg-slate-200 text-slate-400 cursor-not-allowed",
  };

  return (
    <button
      disabled={!cs.canJoin}
      onClick={() => cs.canJoin && onJoin(apt)}
      title={cs.state === "upcoming" ? `Video call unlocks 10 min before appointment` : "Join TeleHealth video call"}
      className={`flex items-center gap-1 text-xs px-2.5 py-1.5 rounded-lg font-semibold transition ${styles[cs.state]}`}
    >
      <Video size={11} />
      {cs.label}
    </button>
  );
}
