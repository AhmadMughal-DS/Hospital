import { useState, useEffect } from "react";
import axios from "axios";
import { useTranslation } from "react-i18next";
import Sidebar from "../components/Sidebar";
import { StatCard, Card, Badge, Btn, Input, Alert, Spinner, EmptyState } from "../components/ui";
import { Calendar, Clock, Users, FileText, Video } from "lucide-react";
import { useSEO } from "../hooks/useSEO";

const API = import.meta.env.VITE_DJANGO_API_BASE || "http://localhost:8000";

export default function DoctorDashboardPage({ session, onLogout }) {
  const { i18n } = useTranslation();
  const isAr = i18n.language === "ar";
  const [active, setActive] = useState("overview");
  const headers = { Authorization: `Bearer ${session.access}` };

  const [todayAppts, setTodayAppts] = useState([]);
  const [allAppts, setAllAppts] = useState([]);
  const [loading, setLoading] = useState(false);

  // Prescription writer state
  const [selectedAppt, setSelectedAppt] = useState(null);
  const [rxNotes, setRxNotes] = useState("");
  const [rxItems, setRxItems] = useState([{ drug_name: "", dosage: "", frequency: "Twice daily", duration_days: 7, quantity: 1, instructions: "" }]);
  const [rxResult, setRxResult] = useState(null);
  const [rxLoading, setRxLoading] = useState(false);

  const loadTodayQueue = async () => {
    try {
      const { data } = await axios.get(`${API}/api/v1/appointments/today-queue/`, { headers });
      setTodayAppts(Array.isArray(data) ? data : data.results || []);
    } catch {}
  };

  const loadAllAppts = async () => {
    try {
      const { data } = await axios.get(`${API}/api/v1/appointments/`, { headers });
      setAllAppts(Array.isArray(data) ? data : data.results || []);
    } catch {}
  };

  useEffect(() => {
    loadTodayQueue();
    loadAllAppts();
    const id = setInterval(loadTodayQueue, 10000);
    return () => clearInterval(id);
  }, []);

  const updateStatus = async (id, status) => {
    try {
      await axios.patch(`${API}/api/v1/appointments/${id}/`, { status }, { headers });
      loadTodayQueue(); loadAllAppts();
    } catch {}
  };

  const addRxItem = () => setRxItems(p => [...p, { drug_name: "", dosage: "", frequency: "Twice daily", duration_days: 7, quantity: 1, instructions: "" }]);
  const removeRxItem = (i) => setRxItems(p => p.filter((_, idx) => idx !== i));
  const setRxItem = (i, key, val) => setRxItems(p => p.map((item, idx) => idx === i ? { ...item, [key]: val } : item));

  const submitPrescription = async () => {
    if (!selectedAppt) return;
    setRxLoading(true);
    try {
      await axios.post(`${API}/api/v1/appointments/${selectedAppt.id}/prescription/`, {
        notes: rxNotes,
        items: rxItems,
      }, { headers });
      setRxResult({ ok: true, msg: isAr ? "تم إصدار الوصفة بنجاح" : "Prescription issued successfully!" });
      setRxItems([{ drug_name: "", dosage: "", frequency: "Twice daily", duration_days: 7, quantity: 1, instructions: "" }]);
      setRxNotes("");
      loadAllAppts();
    } catch (err) {
      setRxResult({ ok: false, msg: err?.response?.data?.detail || "Failed." });
    } finally { setRxLoading(false); }
  };

  const scheduled = todayAppts.filter(a => a.status === "SCHEDULED" || a.status === "CONFIRMED");
  const completed = allAppts.filter(a => a.status === "COMPLETED").length;

  const sections = {
    overview: (
      <div className="space-y-6">
        <div className="grid sm:grid-cols-2 xl:grid-cols-4 gap-4">
          <StatCard icon="📅" title={isAr ? "مواعيد اليوم" : "Today's Appointments"} value={todayAppts.length} color="teal" />
          <StatCard icon="⏳" title={isAr ? "في الانتظار" : "Waiting"} value={scheduled.length} color="amber" />
          <StatCard icon="✅" title={isAr ? "مكتملة" : "Completed"} value={completed} color="emerald" />
          <StatCard icon="👥" title={isAr ? "إجمالي المرضى" : "Total Patients"} value={allAppts.length} color="navy" />
        </div>

        <Card title={isAr ? "طابور اليوم" : "Today's Queue"}>
          {todayAppts.length === 0 ? (
            <EmptyState icon="📅" message={isAr ? "لا مواعيد اليوم" : "No appointments today"} />
          ) : (
            <div className="space-y-3">
              {todayAppts.map((apt, idx) => (
                <div key={apt.id} className="flex items-center justify-between p-3 rounded-xl border border-slate-100 hover:border-hmsTeal/30 hover:bg-slate-50 transition">
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-hmsTeal to-hmsMint flex items-center justify-center text-white font-bold">
                      #{idx + 1}
                    </div>
                    <div>
                      <div className="font-semibold text-hmsNavy text-sm">{apt.patient_name}</div>
                      <div className="text-xs text-slate-500">{apt.appointment_time?.slice(0, 5)} • {apt.chief_complaint || "Checkup"}</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge status={apt.status} />
                    {apt.appointment_type === "TELE_HEALTH" && (
                      <span className="text-xs bg-blue-50 text-blue-600 px-2 py-0.5 rounded-full flex items-center gap-1">
                        <Video size={10} /> Tele
                      </span>
                    )}
                    {apt.status === "SCHEDULED" && (
                      <Btn size="sm" onClick={() => updateStatus(apt.id, "IN_PROGRESS")}>
                        {isAr ? "بدء" : "Start"}
                      </Btn>
                    )}
                    {apt.status === "IN_PROGRESS" && (
                      <Btn size="sm" variant="secondary" onClick={() => updateStatus(apt.id, "COMPLETED")}>
                        {isAr ? "إنهاء" : "Complete"}
                      </Btn>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>
    ),

    queue: (
      <Card title={isAr ? "طابور المرضى المباشر" : "Live Patient Queue"} subtitle={isAr ? "يتجدد تلقائيًا" : "Auto-refreshes every 10s"}>
        {todayAppts.length === 0 ? (
          <EmptyState icon="🔢" message={isAr ? "لا مرضى في الطابور" : "Queue is empty"} />
        ) : (
          <table className="hms-table w-full text-sm">
            <thead>
              <tr>
                <th>#</th>
                <th>{isAr ? "المريض" : "Patient"}</th>
                <th>{isAr ? "الوقت" : "Time"}</th>
                <th>{isAr ? "النوع" : "Type"}</th>
                <th>{isAr ? "الحالة" : "Status"}</th>
                <th>{isAr ? "إجراء" : "Action"}</th>
              </tr>
            </thead>
            <tbody>
              {todayAppts.map((apt, i) => (
                <tr key={apt.id}>
                  <td className="font-bold text-hmsNavy">#{i + 1}</td>
                  <td className="font-semibold">{apt.patient_name}</td>
                  <td>{apt.appointment_time?.slice(0, 5)}</td>
                  <td><span className={`text-xs font-semibold ${apt.appointment_type === "TELE_HEALTH" ? "text-blue-600" : "text-slate-600"}`}>{apt.appointment_type}</span></td>
                  <td><Badge status={apt.status} /></td>
                  <td className="flex gap-2">
                    {apt.status === "SCHEDULED" && <Btn size="sm" onClick={() => updateStatus(apt.id, "IN_PROGRESS")}>Start</Btn>}
                    {apt.status === "IN_PROGRESS" && <Btn size="sm" variant="secondary" onClick={() => updateStatus(apt.id, "COMPLETED")}>Done</Btn>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>
    ),

    patients: (
      <Card title={isAr ? "مرضاي" : "My Patients"}>
        {allAppts.length === 0 ? (
          <EmptyState icon="👥" message={isAr ? "لا مرضى حتى الآن" : "No patients yet"} />
        ) : (
          <table className="hms-table w-full text-sm">
            <thead>
              <tr>
                <th>{isAr ? "المريض" : "Patient"}</th>
                <th>{isAr ? "الموعد" : "Appointment"}</th>
                <th>{isAr ? "الحالة" : "Status"}</th>
                <th>{isAr ? "الرسوم" : "Fee"}</th>
                <th>{isAr ? "وصفة" : "Rx"}</th>
              </tr>
            </thead>
            <tbody>
              {allAppts.map(apt => (
                <tr key={apt.id}>
                  <td className="font-semibold">{apt.patient_name}</td>
                  <td>{apt.appointment_date} {apt.appointment_time?.slice(0, 5)}</td>
                  <td><Badge status={apt.status} /></td>
                  <td>{apt.currency} {apt.fee}</td>
                  <td>
                    {apt.prescription ? (
                      <span className="text-xs text-emerald-600 font-semibold">✅ Issued</span>
                    ) : apt.status === "COMPLETED" ? (
                      <button className="text-xs text-hmsTeal font-semibold hover:underline" onClick={() => { setSelectedAppt(apt); setActive("prescriptions"); }}>
                        {isAr ? "كتابة وصفة" : "Write Rx"}
                      </button>
                    ) : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>
    ),

    prescriptions: (
      <div className="grid gap-4 lg:grid-cols-3">
        {/* Appointment picker */}
        <Card title={isAr ? "اختر الموعد" : "Select Appointment"}>
          <div className="space-y-2 max-h-[400px] overflow-y-auto">
            {allAppts.filter(a => a.status === "COMPLETED").map(apt => (
              <div
                key={apt.id}
                onClick={() => setSelectedAppt(apt)}
                className={`p-3 rounded-xl border cursor-pointer transition ${selectedAppt?.id === apt.id ? "border-hmsTeal bg-hmsTeal/5" : "border-slate-100 hover:border-hmsTeal/30"}`}
              >
                <div className="font-semibold text-sm text-hmsNavy">{apt.patient_name}</div>
                <div className="text-xs text-slate-500">{apt.appointment_date}</div>
                {apt.prescription && <span className="text-xs text-emerald-600">✅ Rx Issued</span>}
              </div>
            ))}
          </div>
        </Card>

        {/* Prescription writer */}
        <Card title={isAr ? "كتابة الوصفة الطبية" : "E-Prescription Writer"} className="lg:col-span-2">
          {!selectedAppt ? (
            <EmptyState icon="💊" message={isAr ? "اختر موعدًا من القائمة" : "Select an appointment to write a prescription"} />
          ) : selectedAppt.prescription ? (
            <Alert type="info">
              {isAr ? "تم إصدار وصفة لهذا الموعد" : "Prescription already issued for this appointment"}
            </Alert>
          ) : (
            <div className="space-y-4">
              <div className="p-3 bg-slate-50 rounded-xl text-sm">
                <div className="font-semibold text-hmsNavy">{selectedAppt.patient_name}</div>
                <div className="text-slate-500">{selectedAppt.appointment_date} • {selectedAppt.chief_complaint}</div>
              </div>

              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2">{isAr ? "ملاحظات" : "Prescription Notes"}</label>
                <textarea
                  value={rxNotes}
                  onChange={e => setRxNotes(e.target.value)}
                  rows={2}
                  placeholder="Doctor's notes..."
                  className="w-full rounded-xl border border-slate-200 px-4 py-2 text-sm transition"
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-sm font-semibold text-slate-700">{isAr ? "الأدوية" : "Medications"}</label>
                  <Btn size="sm" onClick={addRxItem}>+ {isAr ? "إضافة دواء" : "Add Drug"}</Btn>
                </div>
                {rxItems.map((item, i) => (
                  <div key={i} className="border border-slate-200 rounded-xl p-3 mb-2 space-y-2">
                    <div className="grid grid-cols-2 gap-2">
                      <input placeholder="Drug name" value={item.drug_name} onChange={e => setRxItem(i, "drug_name", e.target.value)} className="rounded-lg border border-slate-200 px-3 py-1.5 text-sm" />
                      <input placeholder="Dosage (e.g. 500mg)" value={item.dosage} onChange={e => setRxItem(i, "dosage", e.target.value)} className="rounded-lg border border-slate-200 px-3 py-1.5 text-sm" />
                      <input placeholder="Frequency" value={item.frequency} onChange={e => setRxItem(i, "frequency", e.target.value)} className="rounded-lg border border-slate-200 px-3 py-1.5 text-sm" />
                      <input type="number" placeholder="Days" value={item.duration_days} onChange={e => setRxItem(i, "duration_days", Number(e.target.value))} className="rounded-lg border border-slate-200 px-3 py-1.5 text-sm" />
                      <input type="number" placeholder="Qty" value={item.quantity} onChange={e => setRxItem(i, "quantity", Number(e.target.value))} className="rounded-lg border border-slate-200 px-3 py-1.5 text-sm" />
                      <button onClick={() => removeRxItem(i)} className="text-rose-500 text-xs font-semibold hover:text-rose-700">✕ Remove</button>
                    </div>
                  </div>
                ))}
              </div>

              {rxResult && <Alert type={rxResult.ok ? "success" : "error"}>{rxResult.msg}</Alert>}
              <Btn onClick={submitPrescription} disabled={rxLoading} className="w-full justify-center" size="lg">
                {rxLoading ? "..." : isAr ? "إصدار الوصفة الطبية" : "Issue Prescription"}
              </Btn>
            </div>
          )}
        </Card>
      </div>
    ),
  };

  return (
    <div className="relative z-10 flex min-h-screen">
      <Sidebar role="DOCTOR" active={active} onSelect={setActive} user={session.user} onLogout={onLogout} />
      <main className="flex-1 overflow-auto">
        <header className="sticky top-0 z-20 bg-white/80 backdrop-blur border-b border-slate-200 px-6 py-4">
          <div className="flex items-center justify-between">
            <h1 className="font-heading text-xl font-bold text-hmsNavy">
              {isAr ? "لوحة الطبيب" : "Doctor Command Center"}
            </h1>
            <div className="flex items-center gap-3">
              <span className="text-xs bg-emerald-50 text-emerald-700 px-3 py-1 rounded-full font-semibold">
                🟢 {isAr ? "متصل" : "Online"}
              </span>
              <span className="text-xs bg-blue-50 text-blue-700 px-3 py-1 rounded-full font-semibold">
                📹 {isAr ? "استشارة مرئية متاحة" : "TeleHealth Ready"}
              </span>
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
