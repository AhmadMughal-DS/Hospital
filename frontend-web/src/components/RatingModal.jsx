import { useState } from "react";
import axios from "axios";

const API = import.meta.env.VITE_DJANGO_API_BASE || "http://localhost:8000";

const STARS = [1, 2, 3, 4, 5];

export default function RatingModal({ appointment, headers, onClose, onDone }) {
  const [stars, setStars]     = useState(5);
  const [hover, setHover]     = useState(null);
  const [comment, setComment] = useState("");
  const [loading, setLoading] = useState(false);
  const [msg, setMsg]         = useState(null);

  const submit = async () => {
    setLoading(true);
    try {
      await axios.post(
        `${API}/api/v1/appointments/${appointment.id}/rate/`,
        { stars, comment },
        { headers }
      );
      setMsg({ ok: true, text: "Thank you for your feedback! ⭐" });
      setTimeout(() => { onDone && onDone(); onClose(); }, 1500);
    } catch (e) {
      setMsg({ ok: false, text: e.response?.data?.detail || "Could not submit rating." });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md p-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-bold text-hmsNavy text-lg">Rate Your Experience</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 text-2xl font-bold">×</button>
        </div>

        {/* Doctor info */}
        <div className="flex items-center gap-3 p-3 bg-slate-50 rounded-2xl mb-5">
          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-hmsTeal to-hmsMint flex items-center justify-center text-white font-bold">
            {appointment.doctor_detail?.full_name?.[4] || "D"}
          </div>
          <div>
            <div className="font-semibold text-hmsNavy text-sm">{appointment.doctor_detail?.full_name}</div>
            <div className="text-xs text-slate-400">{appointment.appointment_date} · {appointment.appointment_type}</div>
          </div>
        </div>

        {/* Star selector */}
        <div className="text-center mb-4">
          <p className="text-sm text-slate-500 mb-3">How was your consultation?</p>
          <div className="flex justify-center gap-2">
            {STARS.map(s => (
              <button
                key={s}
                onClick={() => setStars(s)}
                onMouseEnter={() => setHover(s)}
                onMouseLeave={() => setHover(null)}
                className={`text-3xl transition-transform hover:scale-110 ${(hover || stars) >= s ? "text-amber-400" : "text-slate-200"}`}
              >
                ★
              </button>
            ))}
          </div>
          <div className="text-xs text-slate-400 mt-1">
            {["","Poor","Fair","Good","Very Good","Excellent"][(hover || stars)]}
          </div>
        </div>

        {/* Comment */}
        <textarea
          placeholder="Share your experience (optional)..."
          value={comment} onChange={e => setComment(e.target.value)}
          rows={3}
          className="w-full border border-slate-200 rounded-xl px-4 py-2 text-sm resize-none focus:outline-none focus:border-hmsTeal mb-4"
        />

        {msg && (
          <div className={`p-3 rounded-xl text-sm font-semibold mb-3 ${msg.ok ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-600"}`}>
            {msg.text}
          </div>
        )}

        <button
          onClick={submit}
          disabled={loading}
          className="w-full bg-gradient-to-r from-hmsTeal to-hmsMint text-white font-bold py-3 rounded-xl transition disabled:opacity-50"
        >
          {loading ? "Submitting..." : "Submit Rating ⭐"}
        </button>
      </div>
    </div>
  );
}
