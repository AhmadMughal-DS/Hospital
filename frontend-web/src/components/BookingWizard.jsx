import { useState, useEffect } from "react";
import axios from "axios";
import { useTranslation } from "react-i18next";
import { Btn, Alert, Input } from "./ui";
import { loadStripe } from "@stripe/stripe-js";
import { Elements, CardElement, useStripe, useElements } from "@stripe/react-stripe-js";

const API = import.meta.env.VITE_DJANGO_API_BASE || "http://localhost:8000";
const STEPS = ["doctor", "type", "slot", "payment", "done"];

// ── Step Progress Bar ────────────────────────────────────────────────────────
function StepBar({ step }) {
  const labels = ["Doctor", "Type", "Slot", "Payment", "✓"];
  const idx = STEPS.indexOf(step);
  return (
    <div className="flex items-center mb-8 px-1">
      {labels.map((l, i) => {
        const active = i === idx;
        const done = idx > i;
        return (
          <div key={i} className="flex-1 flex flex-col items-center relative">
            {i > 0 && (
              <div className={`absolute top-4 right-1/2 w-full h-0.5 -translate-y-1/2 ${done || active ? "bg-hmsTeal" : "bg-slate-200"}`} />
            )}
            <div className={`relative z-10 w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold mb-1 transition-all ${
              done ? "bg-emerald-500 text-white" : active ? "bg-hmsTeal text-white shadow-lg ring-4 ring-hmsTeal/20" : "bg-slate-200 text-slate-500"
            }`}>{done ? "✓" : i + 1}</div>
            <span className={`text-xs font-semibold ${active ? "text-hmsTeal" : done ? "text-emerald-600" : "text-slate-400"}`}>{l}</span>
          </div>
        );
      })}
    </div>
  );
}

// ── Stripe Card Form (inner component that uses stripe hooks) ────────────────
function StripeCardForm({ clientSecret, amount, currency, onSuccess, onError, loading, setLoading }) {
  const stripe = useStripe();
  const elements = useElements();

  const handlePay = async () => {
    if (!stripe || !elements) return;
    setLoading(true);
    onError(null);
    try {
      const result = await stripe.confirmCardPayment(clientSecret, {
        payment_method: { card: elements.getElement(CardElement) },
      });
      if (result.error) {
        onError(result.error.message);
      } else if (result.paymentIntent.status === "succeeded") {
        onSuccess(result.paymentIntent.id);
      }
    } catch (e) {
      onError("Payment failed. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="border-2 border-slate-200 rounded-xl p-4 bg-white focus-within:border-hmsTeal transition">
        <CardElement options={{
          style: {
            base: { fontSize: "16px", color: "#1e293b", fontFamily: "Inter, sans-serif", "::placeholder": { color: "#94a3b8" } },
            invalid: { color: "#ef4444" },
          },
          hidePostalCode: true,
        }} />
      </div>
      <div className="bg-blue-50 rounded-xl p-3 text-xs text-blue-700 flex gap-2 items-start">
        <span>💡</span>
        <div>
          <strong>Test card:</strong> 4242 4242 4242 4242 · Any future date · Any 3-digit CVC
        </div>
      </div>
      <Btn className="w-full justify-center" size="lg" disabled={loading || !stripe} onClick={handlePay}>
        {loading
          ? <><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> Processing...</>
          : `💳 Pay ${amount} ${currency}`}
      </Btn>
    </div>
  );
}

// ── Main Wizard ──────────────────────────────────────────────────────────────
export default function BookingWizard({ session, doctors, currency, onDone }) {
  const { i18n } = useTranslation();
  const isAr = i18n.language === "ar";
  const headers = { Authorization: `Bearer ${session.access}` };

  const [step, setStep] = useState("doctor");
  const [selectedDoctor, setSelectedDoctor] = useState(null);
  const [aptType, setAptType] = useState("IN_PERSON");
  const [bookDate, setBookDate] = useState("");
  const [slots, setSlots] = useState([]);
  const [slotInfo, setSlotInfo] = useState(null); // { available_from, available_to }
  const [slotsLoading, setSlotsLoading] = useState(false);
  const [selectedSlot, setSelectedSlot] = useState("");
  const [payMethod, setPayMethod] = useState("CARD");
  const [complaint, setComplaint] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [result, setResult] = useState(null);

  // Stripe state
  const [stripePromise, setStripePromise] = useState(null);
  const [clientSecret, setClientSecret] = useState(null);
  const [invoiceId, setInvoiceId] = useState(null);

  // Computed fees
  const baseFee = selectedDoctor
    ? currency === "SAR" ? parseFloat(selectedDoctor.consultation_fee_sar)
    : currency === "EUR" ? parseFloat(selectedDoctor.consultation_fee_eur)
    : parseFloat(selectedDoctor.consultation_fee_aed)
    : 0;

  const discountPct = selectedDoctor?.telehealth_discount_percent ?? 20;
  const teleHealthFee = parseFloat((baseFee * (1 - discountPct / 100)).toFixed(2));
  const fee = aptType === "TELE_HEALTH" ? teleHealthFee : baseFee;

  // Load slots when doctor + date chosen, or when returning to slot step
  useEffect(() => {
    if (!selectedDoctor || !bookDate || step !== "slot") return;
    setSlotsLoading(true);
    setSlots([]);
    setSlotInfo(null);
    axios.get(`${API}/api/v1/doctors/${selectedDoctor.id}/slots/?date=${bookDate}`, { headers })
      .then(r => {
        setSlots(r.data.slots || []);
        setSlotInfo({ from: r.data.available_from, to: r.data.available_to });
      })
      .catch(() => setSlots([]))
      .finally(() => setSlotsLoading(false));
  }, [selectedDoctor, bookDate, step]);

  // Step 1: Create appointment + invoice, then handle payment method
  const handleConfirmBooking = async () => {
    setLoading(true); setError(null);
    try {
      const { data: apt } = await axios.post(`${API}/api/v1/appointments/`, {
        doctor: selectedDoctor.id,
        appointment_date: bookDate,
        appointment_time: selectedSlot,
        appointment_type: aptType,
        currency,
        chief_complaint: complaint || "Patient self-booking",
      }, { headers });

      // Find invoice
      const invRes = await axios.get(`${API}/api/v1/billing/invoices/`, { headers });
      const allInvoices = invRes.data.results || invRes.data;
      const inv = allInvoices.find(i => apt.notes?.includes(i.invoice_number));

      if (!inv) {
        setResult({ appointment: apt, invoice: null });
        setStep("done");
        if (onDone) onDone();
        return;
      }

      setInvoiceId(inv.id);

      if (payMethod === "CARD") {
        // Create Stripe PaymentIntent
        const { data: intentData } = await axios.post(
          `${API}/api/v1/billing/stripe/create-intent/`,
          { invoice_id: inv.id },
          { headers }
        );
        const pubKey = intentData.publishable_key;
        if (pubKey && pubKey !== "pk_test_placeholder_replace_with_real_key") {
          setStripePromise(loadStripe(pubKey));
        } else {
          // No real Stripe key — simulate success
          await completePay(inv.id, "SIMULATED_" + Date.now(), apt);
          return;
        }
        setClientSecret(intentData.client_secret);
        setResult({ appointment: apt, invoice: inv });
        // Don't move to done yet — stay on payment for card entry
      } else {
        // Non-card payment — pay immediately
        const { data: paidInv } = await axios.post(
          `${API}/api/v1/billing/invoices/${inv.id}/pay/`,
          { payment_method: payMethod },
          { headers }
        );
        setResult({ appointment: apt, invoice: paidInv });
        setStep("done");
        if (onDone) onDone();
      }
    } catch (err) {
      const data = err?.response?.data;
      const rawMsg =
        data?.non_field_errors?.[0] ||
        data?.detail ||
        (typeof data === "object" ? JSON.stringify(data) : data) ||
        "Booking failed. Please try again.";

      // Slot conflict — send user back to slot step to pick another time
      const isSlotConflict =
        rawMsg.toLowerCase().includes("already booked") ||
        rawMsg.toLowerCase().includes("unique set") ||
        rawMsg.toLowerCase().includes("unique_together");

      if (isSlotConflict) {
        setSelectedSlot("");
        setStep("slot");
        setError("⚠️ This time slot was just taken. Please choose a different slot.");
      } else {
        setError(rawMsg);
      }
    } finally {
      setLoading(false);
    }
  };

  const completePay = async (invId, paymentIntentId, apt) => {
    try {
      const { data: paidInv } = await axios.post(
        `${API}/api/v1/billing/invoices/${invId}/pay/`,
        { payment_method: "STRIPE", payment_reference: paymentIntentId },
        { headers }
      );
      setResult(prev => ({ appointment: prev?.appointment || apt, invoice: paidInv }));
      setStep("done");
      if (onDone) onDone();
    } catch {
      setError("Payment succeeded but confirmation failed. Please contact support.");
    }
  };

  const handleStripeSuccess = async (paymentIntentId) => {
    await completePay(invoiceId, paymentIntentId, result?.appointment);
  };

  const reset = () => {
    setStep("doctor"); setSelectedDoctor(null); setBookDate("");
    setSelectedSlot(""); setResult(null); setClientSecret(null);
    setInvoiceId(null); setStripePromise(null); setError(null); setComplaint("");
  };

  // ── DONE SCREEN ─────────────────────────────────────────────────────────────
  if (step === "done" && result) {
    return (
      <div className="space-y-5">
        <div className="text-center">
          <div className="w-20 h-20 rounded-full bg-emerald-100 flex items-center justify-center text-4xl mx-auto mb-3 animate-bounce">✅</div>
          <h3 className="font-heading text-xl font-bold text-hmsNavy">Booking Confirmed!</h3>
          <p className="text-sm text-slate-500 mt-1">A confirmation email has been sent to <strong>{session.user.email}</strong></p>
        </div>

        {/* Ticket */}
        <div className="border-2 border-dashed border-hmsTeal/40 rounded-2xl overflow-hidden">
          <div className="bg-gradient-to-br from-hmsNavy to-blue-900 text-white px-5 py-4 flex items-center justify-between">
            <div>
              <div className="text-xs opacity-60 mb-1">APPOINTMENT TICKET</div>
              <div className="font-mono font-bold text-lg tracking-wider">{result.appointment?.appointment_ref}</div>
            </div>
            <div className="text-4xl">🏥</div>
          </div>
          <div className="bg-white px-5 py-4 space-y-2.5">
            <TicketRow icon="👨‍⚕️" label="Doctor" value={result.appointment?.doctor_detail?.full_name} />
            <TicketRow icon="📅" label="Date" value={result.appointment?.appointment_date} />
            <TicketRow icon="🕐" label="Time" value={result.appointment?.appointment_time?.slice(0,5)} />
            <TicketRow icon={result.appointment?.appointment_type === "TELE_HEALTH" ? "📹" : "🏥"} label="Type" value={result.appointment?.appointment_type === "TELE_HEALTH" ? "TeleHealth (Online)" : "In-Person Visit"} />
            <div className="border-t border-slate-100 pt-2.5 mt-2.5">
              <TicketRow icon="🧾" label="Invoice" value={result.invoice?.invoice_number} />
              <TicketRow icon="💳" label="Amount Paid" value={`${result.invoice?.total} ${result.invoice?.currency}`} highlight />
              <TicketRow icon="✅" label="Status" value={<span className="text-emerald-600 font-bold">CONFIRMED</span>} />
            </div>
          </div>
          <div className="bg-slate-50 px-5 py-3 text-xs text-slate-500 text-center">
            Please arrive 10 minutes early · MediCore HMS
          </div>
        </div>

        <Btn className="w-full justify-center" onClick={reset}>+ Book Another Appointment</Btn>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <StepBar step={step} />

      {/* ── STEP 1: Choose Doctor ──────────────────────────────────────────── */}
      {step === "doctor" && (
        <div className="space-y-4">
          <h3 className="font-heading text-lg font-bold text-hmsNavy">Select a Doctor</h3>
          {doctors.length === 0 && (
            <div className="text-center py-10 text-slate-400">
              <div className="text-4xl mb-2">👨‍⚕️</div>
              <p className="text-sm">No doctors available</p>
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
                    <div className="flex gap-2 mt-2 flex-wrap">
                      <span className="text-xs bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full">
                        🕐 {doc.available_from?.slice(0,5)} – {doc.available_to?.slice(0,5)}
                      </span>
                      <span className="text-xs bg-green-50 text-green-700 px-2 py-0.5 rounded-full font-semibold">
                        {currency === "SAR" ? `SAR ${doc.consultation_fee_sar}` : currency === "EUR" ? `EUR ${doc.consultation_fee_eur}` : `AED ${doc.consultation_fee_aed}`}
                      </span>
                      {doc.is_tele_health_enabled && (
                        <span className="text-xs bg-blue-50 text-blue-600 px-2 py-0.5 rounded-full">📹 Online available</span>
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
            Next →
          </Btn>
        </div>
      )}

      {/* ── STEP 2: Appointment Type ───────────────────────────────────────── */}
      {step === "type" && (
        <div className="space-y-5">
          <h3 className="font-heading text-lg font-bold text-hmsNavy">Appointment Type</h3>
          <div className="grid grid-cols-2 gap-4">
            {[
              {
                id: "IN_PERSON",
                icon: "🏥",
                label: "In-Person",
                desc: "Visit the clinic",
                feeLabel: "Full consultation fee",
                fee: baseFee,
                badge: null,
                disabled: false,
              },
              {
                id: "TELE_HEALTH",
                icon: "📹",
                label: "TeleHealth",
                desc: "Video consultation",
                feeLabel: `${discountPct}% discount applied`,
                fee: teleHealthFee,
                badge: `${discountPct}% OFF`,
                disabled: !selectedDoctor?.is_tele_health_enabled,
              },
            ].map(opt => (
              <div key={opt.id}
                onClick={() => !opt.disabled && setAptType(opt.id)}
                className={`rounded-2xl border-2 p-5 text-center transition cursor-pointer relative ${
                  opt.disabled ? "border-slate-100 opacity-40 cursor-not-allowed"
                  : aptType === opt.id ? "border-hmsTeal bg-hmsTeal/5 shadow-md"
                  : "border-slate-200 hover:border-hmsTeal/40"
                }`}
              >
                {opt.badge && !opt.disabled && (
                  <div className="absolute -top-2 -right-2 bg-emerald-500 text-white text-xs font-bold px-2 py-0.5 rounded-full shadow">
                    {opt.badge}
                  </div>
                )}
                <div className="text-4xl mb-2">{opt.icon}</div>
                <div className="font-bold text-hmsNavy text-sm">{opt.label}</div>
                <div className="text-xs text-slate-500 mt-1">{opt.desc}</div>
                <div className="mt-3 pt-3 border-t border-slate-100">
                  <div className="text-lg font-black text-hmsNavy">{currency} {opt.fee}</div>
                  <div className="text-xs text-slate-400">{opt.feeLabel}</div>
                </div>
                {opt.disabled && <div className="text-xs text-red-400 mt-1">Not available</div>}
              </div>
            ))}
          </div>
          <div className="flex gap-3">
            <Btn variant="secondary" onClick={() => setStep("doctor")}>← Back</Btn>
            <Btn className="flex-1 justify-center" onClick={() => setStep("slot")}>Next →</Btn>
          </div>
        </div>
      )}

      {/* ── STEP 3: Date & Slot ────────────────────────────────────────────── */}
      {step === "slot" && (
        <div className="space-y-5">
          <h3 className="font-heading text-lg font-bold text-hmsNavy">Choose Date & Time Slot</h3>
          <Input
            label="Date"
            type="date"
            value={bookDate}
            min={new Date().toISOString().split("T")[0]}
            onChange={e => setBookDate(e.target.value)}
          />

          {bookDate && (
            <>
              {/* Doctor hours banner */}
              {slotInfo && (
                <div className="flex items-center gap-3 bg-blue-50 rounded-xl px-4 py-3 text-sm text-blue-700">
                  <span className="text-xl">🕐</span>
                  <div>
                    <strong>Dr. {selectedDoctor?.full_name?.replace("Dr. ", "")}'s hours:</strong>{" "}
                    {slotInfo.from} – {slotInfo.to}
                  </div>
                </div>
              )}

              {slotsLoading && (
                <div className="flex items-center justify-center py-6 gap-2 text-slate-500">
                  <div className="w-5 h-5 border-2 border-hmsTeal border-t-transparent rounded-full animate-spin" />
                  <span className="text-sm">Loading slots...</span>
                </div>
              )}

              {!slotsLoading && slots.length > 0 && (
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <label className="text-sm font-semibold text-slate-700">Available Slots</label>
                    <div className="flex gap-3 text-xs">
                      <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-full bg-emerald-500 inline-block" /> Available</span>
                      <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-full bg-red-400 inline-block" /> Booked</span>
                    </div>
                  </div>
                  <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                    {slots.map(s => (
                      <button
                        key={s.time}
                        disabled={!s.available}
                        onClick={() => setSelectedSlot(s.time)}
                        className={`py-2.5 px-2 rounded-xl text-sm font-semibold border-2 transition text-center ${
                          !s.available
                            ? "border-red-200 bg-red-50 text-red-400 cursor-not-allowed"
                            : selectedSlot === s.time
                            ? "border-hmsTeal bg-hmsTeal text-white shadow-md scale-105"
                            : "border-emerald-200 bg-emerald-50 text-emerald-700 hover:border-hmsTeal hover:bg-hmsTeal/10"
                        }`}
                      >
                        {s.time}
                        {!s.available && <div className="text-xs opacity-80">Booked</div>}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {!slotsLoading && slots.length === 0 && (
                <div className="text-center py-6 text-slate-400 text-sm bg-slate-50 rounded-xl">
                  No slots available for this date
                </div>
              )}
            </>
          )}

          {selectedSlot && (
            <Input
              label="Chief Complaint (optional)"
              value={complaint}
              onChange={e => setComplaint(e.target.value)}
              placeholder="Brief description..."
            />
          )}

          {error && <Alert type="error">{error}</Alert>}

          <div className="flex gap-3">
            <Btn variant="secondary" onClick={() => { setStep("type"); setError(null); }}>← Back</Btn>
            <Btn className="flex-1 justify-center" disabled={!selectedSlot} onClick={() => { setStep("payment"); setError(null); }}>
              Next →
            </Btn>
          </div>
        </div>
      )}

      {/* ── STEP 4: Payment ────────────────────────────────────────────────── */}
      {step === "payment" && (
        <div className="space-y-5">
          <h3 className="font-heading text-lg font-bold text-hmsNavy">Payment</h3>

          {/* Booking summary */}
          <div className="bg-gradient-to-br from-hmsNavy to-blue-900 text-white rounded-2xl p-5 space-y-2.5">
            <div className="text-xs font-semibold opacity-60 mb-2">BOOKING SUMMARY</div>
            <SummaryRow label="Doctor" value={selectedDoctor?.full_name} />
            <SummaryRow label="Specialty" value={selectedDoctor?.specialty?.name} />
            <SummaryRow label="Date" value={bookDate} />
            <SummaryRow label="Time" value={selectedSlot} />
            <SummaryRow label="Type" value={aptType === "TELE_HEALTH" ? "📹 TeleHealth (Online)" : "🏥 In-Person"} />
            {aptType === "TELE_HEALTH" && (
              <SummaryRow label="Discount" value={`${discountPct}% off`} highlight />
            )}
            <div className="border-t border-white/20 pt-3 flex justify-between items-center">
              <span className="font-bold text-lg">Total</span>
              <span className="text-2xl font-black">{fee} {currency}</span>
            </div>
          </div>

          {/* Payment method selection */}
          {!clientSecret && (
            <>
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2">Payment Method</label>
                <div className="grid grid-cols-3 gap-3">
                  {[
                    { id: "CARD", icon: "💳", label: "Card (Stripe)" },
                    { id: "CASH", icon: "💵", label: "Cash" },
                    { id: "INSURANCE", icon: "🛡️", label: "Insurance" },
                  ].map(pm => (
                    <button key={pm.id} onClick={() => setPayMethod(pm.id)}
                      className={`py-3 rounded-xl border-2 flex flex-col items-center gap-1 transition text-sm font-semibold ${
                        payMethod === pm.id ? "border-hmsTeal bg-hmsTeal/5 text-hmsTeal shadow" : "border-slate-200 text-slate-600 hover:border-hmsTeal/40"
                      }`}
                    >
                      <span className="text-2xl">{pm.icon}</span>
                      <span className="text-xs">{pm.label}</span>
                    </button>
                  ))}
                </div>
              </div>

              {error && <Alert type="error">{error}</Alert>}

              <div className="flex gap-3">
                <Btn variant="secondary" onClick={() => setStep("slot")}>← Back</Btn>
                <Btn className="flex-1 justify-center" size="lg" disabled={loading} onClick={handleConfirmBooking}>
                  {loading
                    ? <><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> Processing...</>
                    : payMethod === "CARD"
                    ? `Continue to Card Payment →`
                    : `✅ Confirm Booking — ${fee} ${currency}`}
                </Btn>
              </div>
            </>
          )}

          {/* Stripe card form — shown after PaymentIntent created */}
          {clientSecret && stripePromise && (
            <Elements stripe={stripePromise} options={{ clientSecret }}>
              <div className="space-y-4">
                <div className="text-sm font-semibold text-slate-700">Enter Card Details</div>
                {error && <Alert type="error">{error}</Alert>}
                <StripeCardForm
                  clientSecret={clientSecret}
                  amount={fee}
                  currency={currency}
                  onSuccess={handleStripeSuccess}
                  onError={setError}
                  loading={loading}
                  setLoading={setLoading}
                />
                <button onClick={() => { setClientSecret(null); setError(null); }} className="text-xs text-slate-400 hover:text-slate-600 w-full text-center">
                  ← Change payment method
                </button>
              </div>
            </Elements>
          )}
        </div>
      )}
    </div>
  );
}

function SummaryRow({ label, value, highlight }) {
  return (
    <div className="flex justify-between items-center text-sm gap-2 text-white">
      <span className="opacity-60">{label}</span>
      <span className={`font-semibold text-right ${highlight ? "text-emerald-300" : ""}`}>{value}</span>
    </div>
  );
}

function TicketRow({ icon, label, value, highlight }) {
  return (
    <div className="flex items-center justify-between py-1 text-sm gap-2">
      <div className="flex items-center gap-2 text-slate-500">
        <span>{icon}</span>
        <span>{label}</span>
      </div>
      <span className={`font-semibold text-right ${highlight ? "text-emerald-600 text-base" : "text-hmsNavy"}`}>{value}</span>
    </div>
  );
}
