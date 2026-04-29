import { useState, useEffect } from "react";
import axios from "axios";

const API = import.meta.env.VITE_DJANGO_API_BASE || "http://localhost:8000";

const BG = {
  SCHEDULED:"bg-blue-100 text-blue-700", CONFIRMED:"bg-teal-100 text-teal-700",
  IN_PROGRESS:"bg-amber-100 text-amber-700", COMPLETED:"bg-emerald-100 text-emerald-700",
  CANCELLED:"bg-red-100 text-red-700", NO_SHOW:"bg-slate-100 text-slate-600",
  PENDING:"bg-amber-100 text-amber-700", PAID:"bg-emerald-100 text-emerald-700",
};

function Section({ title, children }) {
  return (
    <div className="mb-5">
      <h4 className="text-xs font-bold uppercase tracking-widest text-slate-400 mb-3 border-b border-slate-100 pb-1">{title}</h4>
      {children}
    </div>
  );
}

function Field({ label, value, highlight }) {
  if (!value && value !== 0) return null;
  return (
    <div className="flex flex-col">
      <span className="text-xs text-slate-400">{label}</span>
      <span className={`text-sm font-semibold ${highlight ? "text-red-600" : "text-slate-800"}`}>{value || "—"}</span>
    </div>
  );
}

export default function PatientRecordModal({ patientId, headers, onClose }) {
  const [record, setRecord] = useState(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState("overview");
  const [error, setError] = useState(null);

  useEffect(() => {
    setLoading(true);
    axios.get(`${API}/api/v1/accounts/patients/${patientId}/`, { headers })
      .then(r => { setRecord(r.data); setLoading(false); })
      .catch(() => { setError("Could not load patient record."); setLoading(false); });
  }, [patientId]);

  if (!patientId) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/60 backdrop-blur-sm p-4 overflow-y-auto">
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-3xl my-4 flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-hmsTeal to-hmsMint flex items-center justify-center text-white font-bold text-lg">
              {record?.user?.full_name?.[0] || "P"}
            </div>
            <div>
              <h2 className="font-bold text-hmsNavy">{record?.user?.full_name || "Loading..."}</h2>
              <p className="text-xs text-slate-400 font-mono">{record?.patient_id}</p>
            </div>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 text-2xl font-bold w-8 h-8 flex items-center justify-center rounded-full hover:bg-slate-100">×</button>
        </div>

        {loading && <div className="flex-1 flex items-center justify-center py-20 text-slate-400">Loading patient record...</div>}
        {error  && <div className="flex-1 flex items-center justify-center py-20 text-red-500">{error}</div>}

        {record && !loading && (
          <>
            {/* Tabs */}
            <div className="flex gap-1 px-6 pt-3 border-b border-slate-100 flex-shrink-0 overflow-x-auto">
              {[["overview","📋 Overview"],["appointments","📅 Appointments"],["prescriptions","💊 Prescriptions"],["billing","💳 Billing"]].map(([id,lbl])=>(
                <button key={id} onClick={()=>setTab(id)}
                  className={`px-3 py-2 text-xs font-semibold rounded-t-lg whitespace-nowrap transition ${tab===id?"bg-hmsTeal/10 text-hmsTeal border-b-2 border-hmsTeal":"text-slate-500 hover:text-slate-700"}`}>
                  {lbl}
                </button>
              ))}
            </div>

            {/* Summary bar */}
            <div className="flex gap-4 px-6 py-3 bg-slate-50 border-b border-slate-100 flex-shrink-0 overflow-x-auto">
              {[
                ["Total Visits", record.summary?.total_appointments],
                ["Completed",    record.summary?.completed],
                ["Total Billed", `AED ${parseFloat(record.summary?.total_billed||0).toFixed(0)}`],
                ["Total Paid",   `AED ${parseFloat(record.summary?.total_paid||0).toFixed(0)}`],
              ].map(([k,v])=>(
                <div key={k} className="text-center min-w-[70px]">
                  <div className="text-lg font-black text-hmsNavy">{v}</div>
                  <div className="text-xs text-slate-400">{k}</div>
                </div>
              ))}

              {/* Clinical alerts */}
              {record.profile?.blood_group && record.profile.blood_group !== "UNKNOWN" && (
                <div className="ml-auto bg-red-50 border border-red-200 rounded-xl px-3 py-1 text-center">
                  <div className="text-sm font-black text-red-600">🩸 {record.profile.blood_group}</div>
                  <div className="text-xs text-red-400">Blood Group</div>
                </div>
              )}
              {record.profile?.allergies && (
                <div className="bg-orange-50 border border-orange-200 rounded-xl px-3 py-1">
                  <div className="text-xs font-bold text-orange-600">⚠️ Allergies</div>
                  <div className="text-xs text-orange-500 max-w-[120px] truncate">{record.profile.allergies}</div>
                </div>
              )}
            </div>

            {/* Tab content */}
            <div className="flex-1 overflow-y-auto px-6 py-4">
              {tab === "overview" && (
                <div className="grid sm:grid-cols-2 gap-6">
                  <div>
                    <Section title="Demographics">
                      <div className="grid grid-cols-2 gap-3">
                        <Field label="Full Name"    value={record.user?.full_name}/>
                        <Field label="Email"        value={record.user?.email}/>
                        <Field label="Phone"        value={record.user?.phone}/>
                        <Field label="Gender"       value={record.profile?.gender}/>
                        <Field label="Date of Birth" value={record.profile?.date_of_birth}/>
                        <Field label="Nationality"  value={record.profile?.nationality}/>
                        <Field label="National ID"  value={record.profile?.national_id}/>
                        <Field label="Address"      value={record.profile?.address}/>
                      </div>
                    </Section>
                    <Section title="Emergency Contact">
                      <div className="grid grid-cols-2 gap-3">
                        <Field label="Name"  value={record.profile?.emergency_contact}/>
                        <Field label="Phone" value={record.profile?.emergency_phone}/>
                      </div>
                    </Section>
                    <Section title="Insurance">
                      <div className="grid grid-cols-2 gap-3">
                        <Field label="Provider" value={record.profile?.insurance_provider}/>
                        <Field label="Number"   value={record.profile?.insurance_number}/>
                        <Field label="Expiry"   value={record.profile?.insurance_expiry}/>
                      </div>
                    </Section>
                  </div>
                  <div>
                    <Section title="Clinical Profile">
                      <div className="grid grid-cols-2 gap-3">
                        <Field label="Blood Group" value={record.profile?.blood_group} highlight={true}/>
                        <Field label="Allergies"   value={record.profile?.allergies} highlight={!!record.profile?.allergies}/>
                        <Field label="Chronic Conditions" value={record.profile?.chronic_conditions} highlight={!!record.profile?.chronic_conditions}/>
                        <Field label="Current Medications" value={record.profile?.current_medications}/>
                      </div>
                    </Section>
                  </div>
                </div>
              )}

              {tab === "appointments" && (
                <div className="space-y-3">
                  {record.appointments?.length === 0 && <div className="text-center py-10 text-slate-400">No appointments</div>}
                  {record.appointments?.map(apt => (
                    <div key={apt.id} className="p-4 rounded-2xl border border-slate-200 hover:border-hmsTeal/30 transition">
                      <div className="flex items-start justify-between gap-3 flex-wrap">
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-mono text-xs text-slate-400">{apt.appointment_ref}</span>
                            <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${BG[apt.status]||""}`}>{apt.status}</span>
                            <span className="text-xs text-slate-400">{apt.appointment_type}</span>
                          </div>
                          <div className="font-semibold text-hmsNavy mt-1">{apt.doctor_detail?.full_name}</div>
                          <div className="text-xs text-slate-500">{apt.appointment_date} at {apt.appointment_time?.slice(0,5)}</div>
                          {apt.chief_complaint && <div className="text-xs text-slate-600 mt-1">Complaint: {apt.chief_complaint}</div>}
                          {apt.diagnosis && <div className="text-xs text-emerald-700 font-semibold mt-1">Diagnosis: {apt.diagnosis}</div>}
                          {apt.follow_up_required && <div className="text-xs text-blue-600 mt-1">📅 Follow-up: {apt.follow_up_date||"Scheduled"}</div>}
                        </div>
                        <div className="text-right">
                          <div className="font-bold text-hmsNavy">{apt.currency} {parseFloat(apt.fee).toFixed(0)}</div>
                        </div>
                      </div>
                      {apt.prescription && (
                        <div className="mt-3 pt-3 border-t border-slate-100">
                          <div className="text-xs font-bold text-slate-500 mb-2">💊 Prescription</div>
                          <div className="flex flex-wrap gap-2">
                            {apt.prescription.items?.map(item => (
                              <div key={item.id} className="text-xs bg-blue-50 text-blue-700 px-2 py-1 rounded-lg">
                                {item.drug_name} {item.dosage} × {item.duration_days}d
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}

              {tab === "prescriptions" && (
                <div className="space-y-4">
                  {record.appointments?.filter(a => a.prescription).length === 0 && (
                    <div className="text-center py-10 text-slate-400">No prescriptions issued</div>
                  )}
                  {record.appointments?.filter(a => a.prescription).map(apt => (
                    <div key={apt.id} className="p-4 rounded-2xl border border-slate-200">
                      <div className="flex items-center justify-between mb-3">
                        <div>
                          <div className="font-semibold text-hmsNavy">{apt.doctor_detail?.full_name}</div>
                          <div className="text-xs text-slate-400">{apt.appointment_date}</div>
                        </div>
                        <span className={`text-xs font-bold px-2 py-1 rounded-full ${apt.prescription.is_dispensed?"bg-emerald-100 text-emerald-700":"bg-amber-100 text-amber-700"}`}>
                          {apt.prescription.is_dispensed ? "✅ Dispensed" : "⏳ Pending"}
                        </span>
                      </div>
                      {apt.prescription.diagnosis && <div className="text-sm text-slate-700 mb-2"><strong>Diagnosis:</strong> {apt.prescription.diagnosis}</div>}
                      <div className="space-y-2">
                        {apt.prescription.items?.map(item => (
                          <div key={item.id} className="flex items-center justify-between bg-slate-50 rounded-xl px-3 py-2">
                            <div>
                              <div className="text-sm font-semibold text-hmsNavy">{item.drug_name}</div>
                              <div className="text-xs text-slate-500">{item.dosage} · {item.frequency} · {item.duration_days} days</div>
                              {item.instructions && <div className="text-xs text-slate-400">{item.instructions}</div>}
                            </div>
                            <div className="text-xs font-bold text-hmsTeal">Qty: {item.quantity}</div>
                          </div>
                        ))}
                      </div>
                      {apt.prescription.notes && <div className="mt-2 text-xs text-slate-500">Notes: {apt.prescription.notes}</div>}
                    </div>
                  ))}
                </div>
              )}

              {tab === "billing" && (
                <div className="space-y-3">
                  {record.invoices?.length === 0 && <div className="text-center py-10 text-slate-400">No invoices</div>}
                  {record.invoices?.map(inv => (
                    <div key={inv.id} className="p-4 rounded-2xl border border-slate-200 flex items-center justify-between gap-3 flex-wrap">
                      <div>
                        <div className="font-mono text-xs text-slate-400">{inv.invoice_number}</div>
                        <div className="font-semibold text-hmsNavy">{inv.currency} {parseFloat(inv.total).toFixed(2)}</div>
                        <div className="text-xs text-slate-500">{inv.notes} · {inv.created_at?.slice(0,10)}</div>
                      </div>
                      <div className="text-right">
                        <span className={`text-xs font-bold px-2 py-1 rounded-full ${BG[inv.status]||""}`}>{inv.status}</span>
                        {parseFloat(inv.balance_due) > 0 && (
                          <div className="text-xs text-red-500 mt-1">Due: {inv.currency} {parseFloat(inv.balance_due).toFixed(2)}</div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
