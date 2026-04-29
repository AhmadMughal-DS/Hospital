import { useState, useEffect } from "react";
import axios from "axios";
import { useTranslation } from "react-i18next";
import Sidebar, { MobileMenuBtn } from "../components/Sidebar";
import { StatCard, Card, Badge, Btn, Input, Select, Alert, Spinner, EmptyState, TableWrap } from "../components/ui";
import { Calendar, FileText, Video } from "lucide-react";
import { useSEO } from "../hooks/useSEO";
import BookingWizard from "../components/BookingWizard";
import VideoCallModal from "../components/VideoCallModal";
import NotificationBell from "../components/NotificationBell";
import RatingModal from "../components/RatingModal";
import { useAppointmentAlerts, getCallStatus } from "../hooks/useAppointmentAlerts";

const API = import.meta.env.VITE_DJANGO_API_BASE || "http://localhost:8000";
const QUEUE_API = import.meta.env.VITE_QUEUE_API_BASE || "http://localhost:8000";
const CURRENCIES = [["AED","AED - UAE Dirham"],["SAR","SAR - Saudi Riyal"],["EUR","EUR - Euro"]];

export default function PatientDashboardPage({ session, onLogout }) {
  useSEO({ title: "Patient Dashboard — MediCore HMS" });
  const { i18n } = useTranslation();
  const isAr = i18n.language === "ar";
  const [active, setActive] = useState("overview");
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const headers = { Authorization: `Bearer ${session.access}` };

  // State
  const [appointments, setAppointments] = useState([]);
  const [doctors, setDoctors]           = useState([]);
  const [invoices, setInvoices]         = useState([]);
  const [queue, setQueue]               = useState({ current: null, waiting_count: 0, queue: [] });
  const [currency, setCurrency]         = useState("AED");
  const [specialtyFilter, setSpecialtyFilter] = useState("");

  // Profile editing
  const [profileEdit, setProfileEdit] = useState(false);
  const [profileData, setProfileData] = useState({
    first_name:"", last_name:"", phone_number:"", date_of_birth:"",
    gender:"", nationality:"", address:"", emergency_contact:"", emergency_phone:"",
    blood_group:"", allergies:"", chronic_conditions:"", current_medications:"",
    insurance_provider:"", insurance_number:"", insurance_expiry:"",
  });
  const [profileSaving, setProfileSaving] = useState(false);
  const [profileMsg, setProfileMsg]       = useState(null);

  // Rating
  const [ratingAppt, setRatingAppt] = useState(null);

  // Video call
  const [videoCall, setVideoCall] = useState(null);

  // Appointment alerts
  const openCall = (apt) => setVideoCall({ roomId: apt.tele_room_id, displayName: session.user.first_name || session.user.email });
  useAppointmentAlerts(appointments, openCall);

  const loadAppointments = async () => {
    try {
      const { data } = await axios.get(`${API}/api/v1/appointments/`, { headers });
      setAppointments(data.results || data);
    } catch {}
  };
  const loadDoctors = async () => {
    try { const { data } = await axios.get(`${API}/api/v1/doctors/`, { headers }); setDoctors(data.results || data); } catch {}
  };
  const loadInvoices = async () => {
    try { const { data } = await axios.get(`${API}/api/v1/billing/invoices/`, { headers }); setInvoices(data.results || data); } catch {}
  };
  const loadQueue = async () => {
    try { const { data } = await axios.get(`${QUEUE_API}/api/v1/queue/tokens/current`); setQueue(data); } catch {}
  };
  const loadMe = async () => {
    try {
      const { data } = await axios.get(`${API}/api/v1/auth/me`, { headers });
      setProfileData(prev => ({
        ...prev,
        first_name: data.first_name || "",
        last_name:  data.last_name  || "",
        phone_number: data.phone_number || "",
        ...(data.profile || {}),
      }));
    } catch {}
  };

  useEffect(() => {
    loadAppointments(); loadDoctors(); loadInvoices(); loadQueue(); loadMe();
    const id = setInterval(loadQueue, 5000);
    return () => clearInterval(id);
  }, []);

  const genToken = async () => {
    try {
      await axios.post(`${QUEUE_API}/api/v1/queue/tokens/`, { patient: session.user.id, is_priority: false }, { headers });
      loadQueue();
    } catch { alert("Queue service unavailable."); }
  };

  const cancelAppointment = async (id) => {
    if (!confirm("Are you sure you want to cancel this appointment?")) return;
    try {
      await axios.patch(`${API}/api/v1/appointments/${id}/`, { status: "CANCELLED" }, { headers });
      loadAppointments();
    } catch (e) {
      alert(e.response?.data?.detail || "Could not cancel appointment.");
    }
  };

  const downloadInvoicePDF = (id, number) => {
    const url = `${API}/api/v1/billing/invoices/${id}/pdf/`;
    const a = document.createElement("a");
    a.href = url;
    a.download = `Invoice-${number}.pdf`;
    // use fetch with auth header
    fetch(url, { headers: { Authorization: `Bearer ${session.access}` } })
      .then(r => r.blob())
      .then(blob => {
        const burl = URL.createObjectURL(blob);
        a.href = burl; a.click(); URL.revokeObjectURL(burl);
      });
  };

  const saveProfile = async () => {
    setProfileSaving(true); setProfileMsg(null);
    try {
      await axios.patch(`${API}/api/v1/auth/me`, profileData, { headers });
      setProfileMsg({ ok: true, text: "Profile updated successfully! ✅" });
      setProfileEdit(false);
      loadMe();
    } catch (e) {
      setProfileMsg({ ok: false, text: "Could not update profile. Please try again." });
    } finally { setProfileSaving(false); }
  };

  const pending    = appointments.filter(a => a.status === "SCHEDULED" || a.status === "CONFIRMED");
  const completed  = appointments.filter(a => a.status === "COMPLETED");
  const totalPaid  = invoices.filter(i => i.status === "PAID").reduce((s,i) => s + parseFloat(i.total||0), 0);

  // ── Overview ─────────────────────────────────────────────────────────────────
  const overviewSection = (
    <div className="space-y-6">
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-3 sm:gap-4">
        <StatCard icon="👤" title="Patient" value={`${session.user.first_name||""} ${session.user.last_name||""}`.trim()||"Patient"} sub={session.user.patient_id} color="navy"/>
        <StatCard icon="📅" title="Upcoming" value={pending.length} color="teal"/>
        <StatCard icon="💳" title="Total Paid" value={`${totalPaid.toFixed(0)} AED`} color="emerald"/>
        <StatCard icon="✅" title="Completed" value={completed.length} color="amber"/>
      </div>

      {/* Upcoming appointments */}
      <Card title="Upcoming Appointments" action={<Btn size="sm" onClick={()=>setActive("booking")}>+ Book</Btn>}>
        {appointments.length === 0
          ? <EmptyState icon="📅" message="No appointments yet"/>
          : <div className="space-y-2">
              {appointments.filter(a=>a.status!=="CANCELLED").slice(0,5).map(apt=>(
                <div key={apt.id} className="flex items-center justify-between py-2 border-b border-slate-100 last:border-0 gap-2">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-8 h-8 rounded-full bg-hmsTeal/10 flex items-center justify-center text-hmsTeal flex-shrink-0"><Calendar size={14}/></div>
                    <div className="min-w-0">
                      <div className="text-sm font-semibold text-hmsNavy truncate">{apt.doctor_detail?.full_name||"Doctor"}</div>
                      <div className="text-xs text-slate-500">{apt.appointment_date} · {apt.appointment_time?.slice(0,5)}</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <Badge status={apt.status}/>
                    <JoinCallBtn apt={apt} onJoin={openCall}/>
                    {(apt.status==="SCHEDULED"||apt.status==="CONFIRMED") && (
                      <button onClick={()=>cancelAppointment(apt.id)}
                        className="text-xs text-red-500 hover:text-red-700 font-semibold px-2 py-1 hover:bg-red-50 rounded-lg transition">
                        Cancel
                      </button>
                    )}
                    {apt.status==="COMPLETED" && !apt.rating && (
                      <button onClick={()=>setRatingAppt(apt)}
                        className="text-xs text-amber-600 hover:text-amber-700 font-semibold px-2 py-1 hover:bg-amber-50 rounded-lg transition">
                        ⭐ Rate
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>}
      </Card>

      {/* Recent invoices */}
      <Card title="Recent Invoices" action={<Btn size="sm" variant="ghost" onClick={()=>setActive("payments")}>View All →</Btn>}>
        {invoices.length === 0
          ? <EmptyState icon="💳" message="No invoices yet"/>
          : <div className="space-y-2">
              {invoices.slice(0,3).map(inv=>(
                <div key={inv.id} className="flex items-center justify-between py-2 border-b border-slate-100 last:border-0 gap-2">
                  <div>
                    <div className="font-mono text-xs text-slate-400">{inv.invoice_number}</div>
                    <div className="font-semibold text-hmsNavy text-sm">{inv.currency} {parseFloat(inv.total).toFixed(2)}</div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge status={inv.status}/>
                    <button onClick={()=>downloadInvoicePDF(inv.id,inv.invoice_number)}
                      className="text-xs text-hmsTeal hover:underline font-semibold">PDF ⬇</button>
                  </div>
                </div>
              ))}
            </div>}
      </Card>
    </div>
  );

  // ── Profile Section ───────────────────────────────────────────────────────────
  const BLOOD_GROUPS = [["","Select"],["A+","A+"],["A-","A-"],["B+","B+"],["B-","B-"],["AB+","AB+"],["AB-","AB-"],["O+","O+"],["O-","O-"],["UNKNOWN","Unknown"]];
  const GENDERS      = [["","Select"],["MALE","Male"],["FEMALE","Female"],["OTHER","Other"]];
  const F = (label, key, type="text", opts=null) => (
    <div key={key}>
      <label className="text-xs font-semibold text-slate-500 block mb-1">{label}</label>
      {opts
        ? <select value={profileData[key]||""} onChange={e=>setProfileData(p=>({...p,[key]:e.target.value}))}
            className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-hmsTeal">
            {opts.map(([v,l])=><option key={v} value={v}>{l}</option>)}
          </select>
        : <input type={type} value={profileData[key]||""} onChange={e=>setProfileData(p=>({...p,[key]:e.target.value}))}
            className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-hmsTeal"/>
      }
    </div>
  );

  const profileSection = (
    <div className="max-w-2xl mx-auto space-y-4">
      {profileMsg && (
        <div className={`p-3 rounded-xl text-sm font-semibold ${profileMsg.ok?"bg-emerald-50 text-emerald-700":"bg-red-50 text-red-600"}`}>
          {profileMsg.text}
        </div>
      )}
      <Card title="Personal Information" action={
        profileEdit
          ? <div className="flex gap-2">
              <Btn size="sm" onClick={saveProfile} disabled={profileSaving}>{profileSaving?"Saving...":"Save Changes"}</Btn>
              <Btn size="sm" variant="ghost" onClick={()=>{setProfileEdit(false);setProfileMsg(null);}}>Cancel</Btn>
            </div>
          : <Btn size="sm" onClick={()=>setProfileEdit(true)}>✏️ Edit Profile</Btn>
      }>
        <div className="grid sm:grid-cols-2 gap-3">
          {profileEdit ? <>
            {F("First Name","first_name")}
            {F("Last Name","last_name")}
            {F("Phone","phone_number","tel")}
            {F("Date of Birth","date_of_birth","date")}
            {F("Gender","gender","text",GENDERS)}
            {F("Nationality","nationality")}
            {F("National ID","national_id")}
            {F("Address","address")}
          </> : <>
            {[["First Name","first_name"],["Last Name","last_name"],["Phone","phone_number"],["DOB","date_of_birth"],["Gender","gender"],["Nationality","nationality"],["Address","address"]].map(([l,k])=>(
              <div key={k}><div className="text-xs text-slate-400">{l}</div><div className="text-sm font-semibold text-hmsNavy">{profileData[k]||"—"}</div></div>
            ))}
          </>}
        </div>
      </Card>

      <Card title="Emergency Contact">
        <div className="grid sm:grid-cols-2 gap-3">
          {profileEdit ? <>
            {F("Emergency Contact Name","emergency_contact")}
            {F("Emergency Phone","emergency_phone","tel")}
          </> : <>
            <div><div className="text-xs text-slate-400">Emergency Contact</div><div className="text-sm font-semibold text-hmsNavy">{profileData.emergency_contact||"—"}</div></div>
            <div><div className="text-xs text-slate-400">Emergency Phone</div><div className="text-sm font-semibold text-hmsNavy">{profileData.emergency_phone||"—"}</div></div>
          </>}
        </div>
      </Card>

      <Card title="🩺 Clinical Information">
        <div className="grid sm:grid-cols-2 gap-3">
          {profileEdit ? <>
            {F("Blood Group","blood_group","text",BLOOD_GROUPS)}
            {F("Allergies","allergies")}
            {F("Chronic Conditions","chronic_conditions")}
            {F("Current Medications","current_medications")}
          </> : <>
            <div className="col-span-2 sm:col-span-1">
              <div className="text-xs text-slate-400">Blood Group</div>
              <div className="text-lg font-black text-red-600">{profileData.blood_group||"—"}</div>
            </div>
            {[["Allergies","allergies"],["Chronic Conditions","chronic_conditions"],["Current Medications","current_medications"]].map(([l,k])=>(
              <div key={k}><div className="text-xs text-slate-400">{l}</div><div className="text-sm font-semibold text-hmsNavy">{profileData[k]||"—"}</div></div>
            ))}
          </>}
        </div>
      </Card>

      <Card title="🏥 Insurance">
        <div className="grid sm:grid-cols-2 gap-3">
          {profileEdit ? <>
            {F("Insurance Provider","insurance_provider")}
            {F("Policy Number","insurance_number")}
            {F("Expiry Date","insurance_expiry","date")}
          </> : <>
            {[["Provider","insurance_provider"],["Policy #","insurance_number"],["Expiry","insurance_expiry"]].map(([l,k])=>(
              <div key={k}><div className="text-xs text-slate-400">{l}</div><div className="text-sm font-semibold text-hmsNavy">{profileData[k]||"—"}</div></div>
            ))}
          </>}
        </div>
      </Card>
    </div>
  );

  // ── Records Section ───────────────────────────────────────────────────────────
  const recordsSection = (
    <div className="space-y-4">
      <Card title="Medical History Timeline">
        {appointments.length === 0
          ? <EmptyState icon="📋" message="No medical records yet"/>
          : <div className="space-y-3">
              {appointments.map(apt=>(
                <div key={apt.id} className="p-4 rounded-2xl border border-slate-200 hover:border-hmsTeal/30 transition">
                  <div className="flex items-start justify-between gap-3 flex-wrap">
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-mono text-xs text-slate-400">{apt.appointment_ref}</span>
                        <Badge status={apt.status}/>
                        <span className="text-xs text-slate-400">{apt.appointment_type}</span>
                      </div>
                      <div className="font-semibold text-hmsNavy mt-1">{apt.doctor_detail?.full_name}</div>
                      <div className="text-xs text-slate-500">{apt.appointment_date} · {apt.appointment_time?.slice(0,5)}</div>
                      {apt.chief_complaint && <div className="text-xs text-slate-600 mt-1">Complaint: {apt.chief_complaint}</div>}
                      {apt.diagnosis && <div className="text-xs text-emerald-700 font-semibold mt-1">✅ Diagnosis: {apt.diagnosis}</div>}
                      {apt.follow_up_required && <div className="text-xs text-blue-600 mt-1">📅 Follow-up: {apt.follow_up_date||"Scheduled"}</div>}
                    </div>
                    <div className="flex flex-col items-end gap-1">
                      <div className="font-bold text-hmsNavy">{apt.currency} {parseFloat(apt.fee||0).toFixed(0)}</div>
                      {apt.status==="COMPLETED" && !apt.rating && (
                        <button onClick={()=>setRatingAppt(apt)} className="text-xs text-amber-600 font-semibold hover:underline">⭐ Rate Doctor</button>
                      )}
                    </div>
                  </div>
                  {apt.prescription && (
                    <div className="mt-3 pt-3 border-t border-slate-100">
                      <div className="text-xs font-bold text-slate-500 mb-2">💊 Prescription</div>
                      <div className="flex flex-wrap gap-2">
                        {apt.prescription.items?.map(item=>(
                          <div key={item.id} className="text-xs bg-blue-50 text-blue-700 px-2 py-1 rounded-lg">
                            {item.drug_name} {item.dosage} × {item.duration_days}d
                          </div>
                        ))}
                      </div>
                      <div className={`mt-2 text-xs font-semibold ${apt.prescription.is_dispensed?"text-emerald-600":"text-amber-600"}`}>
                        {apt.prescription.is_dispensed ? "✅ Dispensed" : "⏳ Pending pharmacy"}
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>}
      </Card>
    </div>
  );

  // ── Payments Section ──────────────────────────────────────────────────────────
  const paymentsSection = (
    <div className="space-y-4">
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 sm:gap-4">
        <StatCard icon="💳" title="Total Paid" value={`${totalPaid.toFixed(0)} AED`} color="emerald"/>
        <StatCard icon="⏳" title="Pending" value={invoices.filter(i=>i.status==="PENDING").length} color="amber"/>
        <StatCard icon="📄" title="Invoices" value={invoices.length} color="navy" className="col-span-2 sm:col-span-1"/>
      </div>
      <Card title="Invoice History">
        {invoices.length === 0
          ? <EmptyState icon="💳" message="No invoices yet"/>
          : <div className="space-y-3">
              {invoices.map(inv=>(
                <div key={inv.id} className="flex items-center justify-between p-4 rounded-2xl border border-slate-200 hover:border-hmsTeal/30 transition gap-3 flex-wrap">
                  <div>
                    <div className="font-mono text-xs text-slate-400">{inv.invoice_number}</div>
                    <div className="font-bold text-hmsNavy">{inv.currency} {parseFloat(inv.total).toFixed(2)}</div>
                    <div className="text-xs text-slate-500">{inv.notes?.slice(0,40)} · {inv.created_at?.slice(0,10)}</div>
                    {parseFloat(inv.balance_due)>0 && (
                      <div className="text-xs text-red-500 font-semibold">Due: {inv.currency} {parseFloat(inv.balance_due).toFixed(2)}</div>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge status={inv.status}/>
                    <button onClick={()=>downloadInvoicePDF(inv.id,inv.invoice_number)}
                      className="flex items-center gap-1 text-xs bg-hmsTeal/10 text-hmsTeal hover:bg-hmsTeal hover:text-white font-semibold px-3 py-1.5 rounded-xl transition">
                      ⬇ PDF
                    </button>
                  </div>
                </div>
              ))}
            </div>}
      </Card>
    </div>
  );

  // ── Queue Section ─────────────────────────────────────────────────────────────
  const queueSection = (
    <div className="grid gap-4 lg:grid-cols-2">
      <Card title="Live Queue" subtitle="Updates every 5s">
        <div className="text-center py-6">
          <div className="inline-flex items-center justify-center w-24 h-24 rounded-full bg-gradient-to-br from-hmsTeal to-hmsMint text-white text-3xl font-extrabold font-heading pulse-ring shadow-xl mb-4">
            {queue.current?.token_number||"—"}
          </div>
          <div className="text-sm font-semibold text-slate-600 mb-1">Now Serving</div>
          <div className="text-xs text-slate-400 mb-4">{queue.waiting_count} waiting</div>
        </div>
        <Btn onClick={genToken} className="w-full justify-center" size="lg">🎫 Get Queue Token</Btn>
      </Card>
      <Card title="Queue List">
        {queue.queue.length===0
          ? <EmptyState icon="🔢" message="Queue is empty"/>
          : <div className="space-y-2 max-h-80 overflow-y-auto">
              {queue.queue.map(t=>(
                <div key={t.id} className="flex items-center justify-between p-2 rounded-lg border border-slate-100 gap-2">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center font-bold text-sm text-hmsNavy">#{t.token_number}</div>
                    <div className="font-medium text-hmsNavy text-sm">{t.patient_display}</div>
                  </div>
                  <Badge status={t.status}/>
                </div>
              ))}
            </div>}
      </Card>
    </div>
  );

  const sections = {
    overview: overviewSection,
    booking:  (
      <div className="max-w-2xl mx-auto space-y-4">
        <div className="flex gap-3 flex-wrap">
          <Select label="Currency" value={currency} onChange={e=>setCurrency(e.target.value)} options={CURRENCIES} className="flex-1 min-w-[140px]"/>
          <Select label="Filter Specialty" value={specialtyFilter} onChange={e=>setSpecialtyFilter(e.target.value)}
            options={[["","All Specialties"],...Array.from(new Set(doctors.map(d=>d.specialty?.name).filter(Boolean))).map(s=>[s,s])]}
            className="flex-1 min-w-[140px]"/>
        </div>
        <Card title="Book an Appointment">
          <BookingWizard session={session} doctors={specialtyFilter?doctors.filter(d=>d.specialty?.name===specialtyFilter):doctors} currency={currency} onDone={loadAppointments}/>
        </Card>
      </div>
    ),
    profile:  profileSection,
    records:  recordsSection,
    payments: paymentsSection,
    queue:    queueSection,
  };

  const headerTitle = {
    overview:"Patient Dashboard", booking:"Book Appointment", profile:"My Profile",
    records:"Medical Records", payments:"Payments & Invoices", queue:"Queue",
  };

  return (
    <div className="relative z-10 flex min-h-screen">
      {videoCall && <VideoCallModal roomId={videoCall.roomId} displayName={videoCall.displayName} role="PATIENT" onClose={()=>setVideoCall(null)}/>}
      {ratingAppt && <RatingModal appointment={ratingAppt} headers={headers} onClose={()=>setRatingAppt(null)} onDone={loadAppointments}/>}

      <Sidebar role="PATIENT" active={active} onSelect={setActive} user={session.user} onLogout={onLogout} mobileOpen={sidebarOpen} onMobileClose={()=>setSidebarOpen(false)}/>
      <main className="flex-1 overflow-auto min-w-0">
        <header className="sticky top-0 z-20 bg-white/90 backdrop-blur border-b border-slate-200 px-4 sm:px-6 py-3 sm:py-4">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center min-w-0 gap-2">
              <MobileMenuBtn onClick={()=>setSidebarOpen(true)}/>
              <h1 className="font-heading text-lg sm:text-xl font-bold text-hmsNavy truncate">
                {headerTitle[active]||"Dashboard"}
              </h1>
            </div>
            <div className="flex items-center gap-2">
              <NotificationBell headers={headers}/>
            </div>
          </div>
        </header>
        <div className="p-4 sm:p-6">{sections[active]}</div>
      </main>
    </div>
  );
}

function JoinCallBtn({ apt, onJoin }) {
  const [, forceUpdate] = useState(0);
  useEffect(() => { const id = setInterval(() => forceUpdate(n=>n+1), 30_000); return () => clearInterval(id); }, []);
  const cs = getCallStatus(apt);
  if (cs.state === "na") return null;
  const styles = { upcoming:"bg-slate-100 text-slate-500 cursor-not-allowed", soon:"bg-amber-500 hover:bg-amber-600 text-white animate-pulse", now:"bg-emerald-500 hover:bg-emerald-600 text-white shadow-lg shadow-emerald-500/40 animate-pulse", ended:"bg-slate-200 text-slate-400 cursor-not-allowed" };
  return (
    <button disabled={!cs.canJoin} onClick={()=>cs.canJoin&&onJoin(apt)}
      className={`flex items-center gap-1 text-xs px-2.5 py-1.5 rounded-lg font-semibold transition ${styles[cs.state]}`}>
      <Video size={11}/>{cs.label}
    </button>
  );
}
