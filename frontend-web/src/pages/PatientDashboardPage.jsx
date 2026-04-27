import { useState, useEffect } from "react";
import axios from "axios";
import { useTranslation } from "react-i18next";
import Sidebar from "../components/Sidebar";
import { StatCard, Card, Badge, Btn, Input, Select, Alert, Spinner, EmptyState } from "../components/ui";
import { Calendar, Clock, User, FileText } from "lucide-react";
import { useSEO } from "../hooks/useSEO";

const API = import.meta.env.VITE_DJANGO_API_BASE || "http://localhost:8000";
const QUEUE_API = import.meta.env.VITE_QUEUE_API_BASE || "http://localhost:8000";

const SPECIALTIES_STATIC = [
  "Cardiology", "Dermatology", "Orthopedics", "Neurology", "Pediatrics", "Ophthalmology", "General Medicine"
];
const CURRENCIES = [["AED", "AED - UAE Dirham"], ["SAR", "SAR - Saudi Riyal"], ["EUR", "EUR - Euro"]];

export default function PatientDashboardPage({ session, onLogout }) {
  const { i18n } = useTranslation();
  const isAr = i18n.language === "ar";
  const [active, setActive] = useState("overview");
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

  // Booking form
  const [specialty, setSpecialty] = useState("Cardiology");
  const [selectedDoctor, setSelectedDoctor] = useState("");
  const [bookDate, setBookDate] = useState("");
  const [bookTime, setBookTime] = useState("");
  const [currency, setCurrency] = useState("AED");
  const [bookLoading, setBookLoading] = useState(false);
  const [bookResult, setBookResult] = useState(null);

  const [loading, setLoading] = useState(false);

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

  const filteredDoctors = doctors.filter(d => d.specialty?.name === specialty);

  const bookAppointment = async () => {
    if (!bookDate || !bookTime || !selectedDoctor) { setBookResult({ ok: false, msg: "Fill all fields." }); return; }
    setBookLoading(true);
    try {
      await axios.post(`${API}/api/v1/appointments/`, {
        doctor: Number(selectedDoctor),
        appointment_date: bookDate,
        appointment_time: bookTime,
        appointment_type: "IN_PERSON",
        currency,
        chief_complaint: "Patient self-booking",
      }, { headers });
      setBookResult({ ok: true, msg: isAr ? "تم حجز الموعد بنجاح!" : "Appointment booked successfully!" });
      setBookDate(""); setBookTime(""); setSelectedDoctor("");
      loadAppointments();
    } catch (err) {
      setBookResult({ ok: false, msg: err?.response?.data?.non_field_errors?.[0] || "Booking failed." });
    } finally { setBookLoading(false); }
  };

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
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
          <StatCard icon="👤" title={isAr ? "المريض" : "Patient"} value={session.user.first_name || "Patient"} sub={session.user.patient_id} color="navy" />
          <StatCard icon="📅" title={isAr ? "المواعيد القادمة" : "Upcoming Appointments"} value={pending.length} color="teal" />
          <StatCard icon="💳" title={isAr ? "إجمالي المدفوعات" : "Total Paid"} value={`${totalPaid.toFixed(0)} AED`} color="emerald" />
          <StatCard icon="🔢" title={isAr ? "انتظار في الطابور" : "Queue Waiting"} value={queue.waiting_count} color="amber" />
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
                <div key={apt.id} className="flex items-center justify-between py-2 border-b border-slate-100 last:border-0">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-hmsTeal/10 flex items-center justify-center text-hmsTeal text-sm">
                      <Calendar size={14} />
                    </div>
                    <div>
                      <div className="text-sm font-semibold text-hmsNavy">{apt.doctor_detail?.full_name || "Doctor"}</div>
                      <div className="text-xs text-slate-500">{apt.appointment_date} • {apt.appointment_time?.slice(0, 5)}</div>
                    </div>
                  </div>
                  <Badge status={apt.status} />
                </div>
              ))}
            </div>
          )}
        </Card>

        {/* Medical records preview */}
        <Card title={isAr ? "آخر السجلات الطبية" : "Recent Medical Records"}>
          <div className="space-y-2">
            {records.slice(0, 3).map(r => (
              <div key={r.id} className="flex items-center justify-between py-2 border-b border-slate-100 last:border-0">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-blue-50 flex items-center justify-center text-blue-600">
                    <FileText size={14} />
                  </div>
                  <div>
                    <div className="text-sm font-semibold text-hmsNavy">{r.title}</div>
                    <div className="text-xs text-slate-500">{r.type}</div>
                  </div>
                </div>
                <span className="text-xs text-slate-400">{r.date}</span>
              </div>
            ))}
          </div>
        </Card>
      </div>
    ),

    booking: (
      <div className="grid gap-4 lg:grid-cols-2">
        <Card title={isAr ? "حجز موعد جديد" : "Book an Appointment"}>
          <div className="space-y-4">
            <Select
              label={isAr ? "التخصص" : "Specialty"}
              value={specialty}
              onChange={e => { setSpecialty(e.target.value); setSelectedDoctor(""); }}
              options={SPECIALTIES_STATIC.map(s => [s, s])}
            />
            <Select
              label={isAr ? "الطبيب" : "Select Doctor"}
              value={selectedDoctor}
              onChange={e => setSelectedDoctor(e.target.value)}
              options={[["", isAr ? "اختر طبيبًا" : "Choose a doctor"], ...filteredDoctors.map(d => [d.id, d.full_name])]}
            />
            <Input label={isAr ? "التاريخ" : "Date"} type="date" value={bookDate} onChange={e => setBookDate(e.target.value)} />
            <Input label={isAr ? "الوقت" : "Time"} type="time" value={bookTime} onChange={e => setBookTime(e.target.value)} />
            <Select
              label={isAr ? "العملة" : "Currency"}
              value={currency}
              onChange={e => setCurrency(e.target.value)}
              options={CURRENCIES}
            />
            {bookResult && <Alert type={bookResult.ok ? "success" : "error"}>{bookResult.msg}</Alert>}
            <Btn onClick={bookAppointment} disabled={bookLoading} className="w-full justify-center" size="lg">
              {bookLoading ? "..." : isAr ? "تأكيد الحجز" : "Confirm Booking"}
            </Btn>
          </div>
        </Card>

        <Card title={isAr ? "الأطباء المتاحون" : "Available Doctors"}>
          {filteredDoctors.length === 0 ? (
            <EmptyState icon="👨‍⚕️" message={isAr ? "لا يوجد أطباء في هذا التخصص" : "No doctors in this specialty"} />
          ) : (
            <div className="space-y-3">
              {filteredDoctors.map(doc => (
                <div key={doc.id}
                  onClick={() => setSelectedDoctor(String(doc.id))}
                  className={`rounded-xl border p-3 cursor-pointer transition hover:border-hmsTeal ${selectedDoctor === String(doc.id) ? "border-hmsTeal bg-hmsTeal/5" : "border-slate-200"}`}
                >
                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-hmsTeal to-hmsMint flex items-center justify-center text-white text-sm font-bold">
                      {doc.user?.first_name?.[0] || "D"}
                    </div>
                    <div className="flex-1">
                      <div className="font-semibold text-hmsNavy text-sm">{doc.full_name}</div>
                      <div className="text-xs text-slate-500">{doc.specialty?.name}</div>
                      <div className="text-xs text-hmsTeal font-medium mt-1">
                        {currency === "AED" ? `AED ${doc.consultation_fee_aed}` :
                          currency === "SAR" ? `SAR ${doc.consultation_fee_sar}` :
                            `EUR ${doc.consultation_fee_eur}`}
                        {" "}{isAr ? "/ استشارة" : "/ consultation"}
                      </div>
                    </div>
                    {doc.is_tele_health_enabled && (
                      <span className="text-xs bg-blue-50 text-blue-600 px-2 py-0.5 rounded-full">📹 TeleHealth</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>
    ),

    records: (
      <Card title={isAr ? "السجلات الطبية" : "Medical Records"}>
        <div className="space-y-3">
          {records.map(r => (
            <div key={r.id} className="flex items-center justify-between p-4 rounded-xl border border-slate-100 hover:border-hmsTeal/30 hover:bg-slate-50 transition">
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-blue-700 flex items-center justify-center text-white">
                  {r.type === "Prescription" || r.type === "وصفة" ? "💊" : r.type === "Lab Report" || r.type === "مختبر" ? "🧪" : "📋"}
                </div>
                <div>
                  <div className="font-semibold text-hmsNavy">{r.title}</div>
                  <div className="text-xs text-slate-500">{r.id} • {r.type}</div>
                </div>
              </div>
              <div className="text-right">
                <div className="text-xs font-semibold text-slate-600">{r.date}</div>
                <button className="text-xs text-hmsTeal font-medium mt-1">{isAr ? "تحميل" : "Download"}</button>
              </div>
            </div>
          ))}
        </div>
      </Card>
    ),

    payments: (
      <div className="space-y-4">
        <div className="grid sm:grid-cols-3 gap-4">
          <StatCard icon="💳" title={isAr ? "إجمالي مدفوع" : "Total Paid"} value={`${totalPaid.toFixed(0)} AED`} color="emerald" />
          <StatCard icon="⏳" title={isAr ? "معلق" : "Pending"} value={invoices.filter(i => i.status === "PENDING").length} color="amber" />
          <StatCard icon="📄" title={isAr ? "فواتير" : "Invoices"} value={invoices.length} color="navy" />
        </div>
        <Card title={isAr ? "الفواتير" : "Invoice History"}>
          {invoices.length === 0 ? (
            <EmptyState icon="💳" message={isAr ? "لا توجد فواتير" : "No invoices yet"} />
          ) : (
            <table className="hms-table w-full text-sm">
              <thead>
                <tr>
                  <th>{isAr ? "رقم الفاتورة" : "Invoice #"}</th>
                  <th>{isAr ? "المبلغ" : "Total"}</th>
                  <th>{isAr ? "العملة" : "Currency"}</th>
                  <th>{isAr ? "الحالة" : "Status"}</th>
                  <th>{isAr ? "التاريخ" : "Date"}</th>
                </tr>
              </thead>
              <tbody>
                {invoices.map(inv => (
                  <tr key={inv.id}>
                    <td className="font-mono font-semibold">{inv.invoice_number}</td>
                    <td className="font-bold">{inv.total}</td>
                    <td>{inv.currency}</td>
                    <td><Badge status={inv.status} /></td>
                    <td className="text-slate-500">{inv.created_at?.slice(0, 10)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
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
            <div className="text-xs text-slate-400">{isAr ? `${queue.waiting_count} في الانتظار` : `${queue.waiting_count} waiting`}</div>
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
                <div key={t.id} className="flex items-center justify-between p-2 rounded-lg border border-slate-100">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center font-bold text-sm text-hmsNavy">
                      #{t.token_number}
                    </div>
                    <div className="text-sm">
                      <div className="font-medium text-hmsNavy">{t.patient_display}</div>
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

  return (
    <div className="relative z-10 flex min-h-screen">
      <Sidebar role="PATIENT" active={active} onSelect={setActive} user={session.user} onLogout={onLogout} />
      <main className="flex-1 overflow-auto">
        {/* Header */}
        <header className="sticky top-0 z-20 bg-white/80 backdrop-blur border-b border-slate-200 px-6 py-4">
          <h1 className="font-heading text-xl font-bold text-hmsNavy">
            {active === "overview" ? (isAr ? "لوحة التحكم" : "Patient Dashboard") :
              active === "booking" ? (isAr ? "حجز موعد" : "Book Appointment") :
                active === "records" ? (isAr ? "السجلات الطبية" : "Medical Records") :
                  active === "payments" ? (isAr ? "المدفوعات" : "Payments") :
                    (isAr ? "قائمة الانتظار" : "Queue")}
          </h1>
        </header>
        <div className="p-6">
          {sections[active]}
        </div>
      </main>
    </div>
  );
}
