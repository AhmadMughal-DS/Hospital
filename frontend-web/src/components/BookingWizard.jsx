import { useState, useEffect } from "react";
import axios from "axios";
import { useTranslation } from "react-i18next";
import { Btn, Alert, Select, Input } from "./ui";

const API = import.meta.env.VITE_DJANGO_API_BASE || "http://localhost:8000";

const STEPS = ["doctor", "type", "slot", "payment", "done"];

function StepBar({ step }) {
  const labels = ["Doctor", "Type", "Slot", "Payment", "✓"];
  return (
    <div className="flex items-center justify-between mb-8 px-1">
      {labels.map((l, i) => {
        const active = i === STEPS.indexOf(step);
        const done = STEPS.indexOf(step) > i;
        return (
          <div key={i} className="flex-1 flex flex-col items-center">
            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold mb-1 transition-all ${
              done ? "bg-emerald-500 text-white" : active ? "bg-hmsTeal text-white shadow-lg ring-4 ring-hmsTeal/20" : "bg-slate-200 text-slate-500"
            }`}>{done ? "✓" : i + 1}</div>
            <span className={`text-xs font-semibold ${active ? "text-hmsTeal" : "text-slate-400"}`}>{l}</span>
            {i < 4 && <div className={`hidden sm:block h-0.5 w-full mt-[-20px] mb-1 ${done ? "bg-emerald-400" : "bg-slate-200"}`} />}
          </div>
        );
      })}
    </div>
  );
}

export default function BookingWizard({ session, doctors, specialties, currency, onDone }) {
  const { i18n } = useTranslation();
  const isAr = i18n.language === "ar";
  const headers = { Authorization: `Bearer ${session.access}` };

  const [step, setStep] = useState("doctor");
  const [selectedDoctor, setSelectedDoctor] = useState(null);
  const [aptType, setAptType] = useState("IN_PERSON");
  const [bookDate, setBookDate] = useState("");
  const [slots, setSlots] = useState([]);
  const [slotsLoading, setSlotsLoading] = useState(false);
  const [selectedSlot, setSelectedSlot] = useState("");
  const [payMethod, setPayMethod] = useState("CARD");
  const [complaint, setComplaint] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [result, setResult] = useState(null); // { appointment, invoice }

  // Load slots when doctor + date chosen
  useEffect(() => {
    if (!selectedDoctor || !bookDate) return;
    setSlotsLoading(true);
    setSlots([]);
    setSelectedSlot("");
    axios.get(`${API}/api/v1/doctors/${selectedDoctor.id}/slots/?date=${bookDate}`, { headers })
      .then(r => setSlots(r.data.slots || []))
      .catch(() => setSlots([]))
      .finally(() => setSlotsLoading(false));
  }, [selectedDoctor, bookDate]);

  const fee = selectedDoctor
    ? currency === "SAR" ? selectedDoctor.consultation_fee_sar
    : currency === "EUR" ? selectedDoctor.consultation_fee_eur
    : selectedDoctor.consultation_fee_aed
    : 0;

  const handleBook = async () => {
    setLoading(true); setError(null);
    try {
      // Step 1: create appointment (auto-creates PENDING invoice)
      const { data: apt } = await axios.post(`${API}/api/v1/appointments/`, {
        doctor: selectedDoctor.id,
        appointment_date: bookDate,
        appointment_time: selectedSlot,
        appointment_type: aptType,
        currency,
        chief_complaint: complaint || "Patient self-booking",
      }, { headers });

      // Step 2: find the invoice (noted in apt.notes as INV:INV-XXXXXXXX)
      const invs = await axios.get(`${API}/api/v1/billing/invoices/`, { headers });
      const allInvoices = invs.data.results || invs.data;
      const inv = allInvoices.find(i => apt.notes?.includes(i.invoice_number));

      if (inv) {
        // Step 3: pay the invoice
        const { data: paidInv } = await axios.post(
          `${API}/api/v1/billing/invoices/${inv.id}/pay/`,
          { payment_method: payMethod },
          { headers }
        );
        setResult({ appointment: apt, invoice: paidInv });
      } else {
        setResult({ appointment: apt, invoice: null });
      }
      setStep("done");
      if (onDone) onDone();
    } catch (err) {
      setError(err?.response?.data?.non_field_errors?.[0] || err?.response?.data?.detail || "Booking failed.");
    } finally { setLoading(false); }
  };

  // ── DONE ────────────────────────────────────────────
  if (step === "done" && result) {
    return (
      <div className="text-center py-8 space-y-4">
        <div className="w-20 h-20 rounded-full bg-emerald-100 flex items-center justify-center text-4xl mx-auto">✅</div>
        <h3 className="font-heading text-xl font-bold text-hmsNavy">{isAr ? "تم الحجز بنجاح!" : "Booking Confirmed!"}</h3>
        <div className="bg-slate-50 rounded-2xl p-5 text-left space-y-2 max-w-sm mx-auto">
          <Row label="Ref" value={result.appointment.appointment_ref} />
          <Row label="Doctor" value={result.appointment.doctor_detail?.full_name} />
          <Row label="Date" value={`${result.appointment.appointment_date} ${result.appointment.appointment_time?.slice(0,5)}`} />
          <Row label="Type" value={result.appointment.appointment_type} />
          <Row label="Status" value={<span className="text-emerald-600 font-bold">CONFIRMED ✓</span>} />
          {result.invoice && <Row label="Invoice" value={result.invoice.invoice_number} />}
          {result.invoice && <Row label="Paid" value={`${result.invoice.total} ${result.invoice.currency}`} />}
        </div>
        <Btn onClick={() => { setStep("doctor"); setSelectedDoctor(null); setBookDate(""); setSelectedSlot(""); setResult(null); }}>
          + {isAr ? "حجز جديد" : "New Booking"}
        </Btn>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <StepBar step={step} />

      {/* ── STEP 1: Choose Doctor ─────────────────────── */}
      {step === "doctor" && (
        <div className="space-y-4">
          <h3 className="font-heading text-lg font-bold text-hmsNavy">{isAr ? "اختر الطبيب" : "Select a Doctor"}</h3>
          {doctors.length === 0 && (
            <div className="text-center py-10 text-slate-400">
              <div className="text-4xl mb-2">👨‍⚕️</div>
              <p className="text-sm">{isAr ? "لا يوجد أطباء" : "No doctors available"}</p>
            </div>
          )}
          <div className="grid sm:grid-cols-2 gap-3">
            {doctors.map(doc => (
              <div key={doc.id}
                onClick={() => setSelectedDoctor(doc)}
                className={`rounded-2xl border-2 p-4 cursor-pointer transition hover:shadow-md ${
                  selectedDoctor?.id === doc.id ? "border-hmsTeal bg-hmsTeal/5 shadow-md" : "border-slate-200 hover:border-hmsTeal/40"
                }`}
              >
                <div className="flex items-start gap-3">
                  <div className="w-11 h-11 rounded-full bg-gradient-to-br from-hmsTeal to-hmsMint flex items-center justify-center text-white font-bold text-lg flex-shrink-0">
                    {doc.user?.first_name?.[0] || "D"}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-semibold text-hmsNavy truncate">{doc.full_name}</div>
                    <div className="text-xs text-slate-500">{doc.specialty?.name}</div>
                    <div className="text-xs text-hmsTeal font-medium mt-1">
                      {currency === "SAR" ? `SAR ${doc.consultation_fee_sar}`
                        : currency === "EUR" ? `EUR ${doc.consultation_fee_eur}`
                        : `AED ${doc.consultation_fee_aed}`}
                    </div>
                    <div className="flex gap-2 mt-2 flex-wrap">
                      <span className="text-xs bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full">
                        🕐 {doc.available_from?.slice(0,5)} – {doc.available_to?.slice(0,5)}
                      </span>
                      {doc.is_tele_health_enabled && (
                        <span className="text-xs bg-blue-50 text-blue-600 px-2 py-0.5 rounded-full">📹 TeleHealth</span>
                      )}
                    </div>
                  </div>
                  {selectedDoctor?.id === doc.id && (
                    <div className="w-5 h-5 rounded-full bg-hmsTeal flex items-center justify-center text-white text-xs flex-shrink-0">✓</div>
                  )}
                </div>
              </div>
            ))}
          </div>
          <Btn className="w-full justify-center" disabled={!selectedDoctor} onClick={() => setStep("type")}>
            {isAr ? "التالي" : "Next"} →
          </Btn>
        </div>
      )}

      {/* ── STEP 2: Appointment Type ───────────────────── */}
      {step === "type" && (
        <div className="space-y-5">
          <h3 className="font-heading text-lg font-bold text-hmsNavy">{isAr ? "نوع الزيارة" : "Appointment Type"}</h3>
          <div className="grid grid-cols-2 gap-4">
            {[
              { id: "IN_PERSON", icon: "🏥", label: "In Person", labelAr: "حضوري", desc: "Visit the clinic", descAr: "زيارة العيادة", always: true },
              { id: "TELE_HEALTH", icon: "📹", label: "TeleHealth", labelAr: "عبر الإنترنت", desc: "Video consultation", descAr: "استشارة مرئية", tele: true },
            ].map(opt => {
              const disabled = opt.tele && !selectedDoctor?.is_tele_health_enabled;
              return (
                <div key={opt.id}
                  onClick={() => !disabled && setAptType(opt.id)}
                  className={`rounded-2xl border-2 p-5 text-center transition cursor-pointer ${
                    disabled ? "border-slate-100 opacity-40 cursor-not-allowed"
                    : aptType === opt.id ? "border-hmsTeal bg-hmsTeal/5 shadow-md"
                    : "border-slate-200 hover:border-hmsTeal/40"
                  }`}
                >
                  <div className="text-4xl mb-2">{opt.icon}</div>
                  <div className="font-bold text-hmsNavy text-sm">{isAr ? opt.labelAr : opt.label}</div>
                  <div className="text-xs text-slate-500 mt-1">{isAr ? opt.descAr : opt.desc}</div>
                  {disabled && <div className="text-xs text-red-400 mt-1">{isAr ? "غير متاح" : "Not available"}</div>}
                </div>
              );
            })}
          </div>
          <div className="bg-blue-50 rounded-xl p-4 text-sm text-blue-700 flex gap-3">
            <span className="text-lg">💡</span>
            <div>
              <strong>{isAr ? "الرسوم:" : "Consultation fee:"}</strong>{" "}
              {currency === "SAR" ? `SAR ${selectedDoctor?.consultation_fee_sar}`
                : currency === "EUR" ? `EUR ${selectedDoctor?.consultation_fee_eur}`
                : `AED ${selectedDoctor?.consultation_fee_aed}`}
            </div>
          </div>
          <div className="flex gap-3">
            <Btn variant="secondary" onClick={() => setStep("doctor")}>← {isAr ? "السابق" : "Back"}</Btn>
            <Btn className="flex-1 justify-center" onClick={() => setStep("slot")}>{isAr ? "التالي" : "Next"} →</Btn>
          </div>
        </div>
      )}

      {/* ── STEP 3: Date & Slot ───────────────────────── */}
      {step === "slot" && (
        <div className="space-y-5">
          <h3 className="font-heading text-lg font-bold text-hmsNavy">{isAr ? "اختر الموعد" : "Choose Date & Slot"}</h3>
          <Input
            label={isAr ? "التاريخ" : "Date"}
            type="date"
            value={bookDate}
            onChange={e => setBookDate(e.target.value)}
          />
          {bookDate && (
            <>
              {slotsLoading && (
                <div className="flex items-center justify-center py-6 gap-2 text-slate-500">
                  <div className="w-5 h-5 border-2 border-hmsTeal border-t-transparent rounded-full animate-spin" />
                  <span className="text-sm">{isAr ? "جاري تحميل المواعيد..." : "Loading slots..."}</span>
                </div>
              )}
              {!slotsLoading && slots.length > 0 && (
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-2">
                    {isAr ? "الأوقات المتاحة" : "Available Slots"}
                  </label>
                  <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                    {slots.map(s => (
                      <button
                        key={s.time}
                        disabled={!s.available}
                        onClick={() => setSelectedSlot(s.time)}
                        className={`py-2 px-3 rounded-xl text-sm font-semibold border-2 transition ${
                          !s.available ? "border-slate-100 bg-slate-50 text-slate-300 cursor-not-allowed line-through"
                          : selectedSlot === s.time ? "border-hmsTeal bg-hmsTeal text-white shadow-md"
                          : "border-slate-200 hover:border-hmsTeal text-slate-700"
                        }`}
                      >
                        {s.time}
                        {!s.available && <div className="text-xs opacity-70">{isAr ? "محجوز" : "Booked"}</div>}
                      </button>
                    ))}
                  </div>
                </div>
              )}
              {!slotsLoading && slots.length === 0 && (
                <div className="text-center py-6 text-slate-400 text-sm">
                  {isAr ? "لا مواعيد متاحة في هذا اليوم" : "No slots available for this date"}
                </div>
              )}
            </>
          )}
          {selectedSlot && (
            <Input
              label={isAr ? "سبب الزيارة (اختياري)" : "Chief Complaint (optional)"}
              value={complaint}
              onChange={e => setComplaint(e.target.value)}
              placeholder={isAr ? "وصف موجز..." : "Brief description..."}
            />
          )}
          <div className="flex gap-3">
            <Btn variant="secondary" onClick={() => setStep("type")}>← {isAr ? "السابق" : "Back"}</Btn>
            <Btn className="flex-1 justify-center" disabled={!selectedSlot} onClick={() => setStep("payment")}>
              {isAr ? "التالي" : "Next"} →
            </Btn>
          </div>
        </div>
      )}

      {/* ── STEP 4: Payment ──────────────────────────── */}
      {step === "payment" && (
        <div className="space-y-5">
          <h3 className="font-heading text-lg font-bold text-hmsNavy">{isAr ? "الدفع" : "Payment"}</h3>

          {/* Summary card */}
          <div className="bg-gradient-to-br from-hmsNavy to-blue-900 text-white rounded-2xl p-5 space-y-3">
            <div className="text-sm font-semibold opacity-70">{isAr ? "ملخص الحجز" : "Booking Summary"}</div>
            <Row label={isAr ? "الطبيب" : "Doctor"} value={selectedDoctor?.full_name} white />
            <Row label={isAr ? "التاريخ" : "Date"} value={bookDate} white />
            <Row label={isAr ? "الوقت" : "Time"} value={selectedSlot} white />
            <Row label={isAr ? "النوع" : "Type"} value={aptType === "TELE_HEALTH" ? "📹 TeleHealth" : "🏥 In Person"} white />
            <div className="border-t border-white/20 pt-3 flex justify-between items-center">
              <span className="font-bold text-lg">{isAr ? "الإجمالي" : "Total"}</span>
              <span className="text-2xl font-black">{fee} {currency}</span>
            </div>
          </div>

          {/* Payment method */}
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-2">{isAr ? "طريقة الدفع" : "Payment Method"}</label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {[
                { id: "CARD", icon: "💳", label: "Card" },
                { id: "CASH", icon: "💵", label: "Cash" },
                { id: "INSURANCE", icon: "🛡️", label: "Insurance" },
                { id: "PAYPAL", icon: "🅿️", label: "PayPal" },
              ].map(pm => (
                <button key={pm.id} onClick={() => setPayMethod(pm.id)}
                  className={`py-3 rounded-xl border-2 flex flex-col items-center gap-1 transition text-sm font-semibold ${
                    payMethod === pm.id ? "border-hmsTeal bg-hmsTeal/5 text-hmsTeal shadow" : "border-slate-200 text-slate-600 hover:border-hmsTeal/40"
                  }`}
                >
                  <span className="text-xl">{pm.icon}</span>
                  <span className="text-xs">{pm.label}</span>
                </button>
              ))}
            </div>
          </div>

          {error && <Alert type="error">{error}</Alert>}

          <div className="flex gap-3">
            <Btn variant="secondary" onClick={() => setStep("slot")}>← {isAr ? "السابق" : "Back"}</Btn>
            <Btn className="flex-1 justify-center" size="lg" disabled={loading} onClick={handleBook}>
              {loading
                ? <><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> {isAr ? "جاري الدفع..." : "Processing..."}</>
                : `💳 ${isAr ? "ادفع الآن" : "Pay"} ${fee} ${currency}`
              }
            </Btn>
          </div>
        </div>
      )}
    </div>
  );
}

function Row({ label, value, white }) {
  return (
    <div className={`flex justify-between items-center text-sm gap-2 ${white ? "text-white" : "text-slate-700"}`}>
      <span className={white ? "opacity-70" : "text-slate-500"}>{label}</span>
      <span className="font-semibold text-right">{value}</span>
    </div>
  );
}
