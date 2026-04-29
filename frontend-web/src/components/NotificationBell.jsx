import { useState, useEffect, useRef } from "react";
import axios from "axios";

const API = import.meta.env.VITE_DJANGO_API_BASE || "http://localhost:8000";

export default function NotificationBell({ headers }) {
  const [notifs, setNotifs]   = useState([]);
  const [open, setOpen]       = useState(false);
  const ref                   = useRef(null);

  const load = () => {
    axios.get(`${API}/api/v1/appointments/notifications/`, { headers })
      .then(r => setNotifs(r.data.results || r.data))
      .catch(() => {});
  };

  useEffect(() => {
    load();
    const id = setInterval(load, 30000); // poll every 30s
    return () => clearInterval(id);
  }, []);

  // Close on outside click
  useEffect(() => {
    const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const markAll = async () => {
    await axios.post(`${API}/api/v1/appointments/notifications/mark-read/`, {}, { headers }).catch(()=>{});
    setNotifs(n => n.map(x => ({ ...x, is_read: true })));
  };

  const unread = notifs.filter(n => !n.is_read).length;

  const typeIcon = { APPOINTMENT:"📅", PRESCRIPTION:"💊", PAYMENT:"💳", GENERAL:"🔔", ALERT:"⚠️" };

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => { setOpen(o => !o); if (!open) load(); }}
        className="relative p-2 rounded-xl hover:bg-slate-100 transition text-slate-600"
        aria-label="Notifications"
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9"/>
          <path d="M13.73 21a2 2 0 01-3.46 0"/>
        </svg>
        {unread > 0 && (
          <span className="absolute -top-0.5 -right-0.5 w-5 h-5 bg-red-500 text-white text-xs font-bold rounded-full flex items-center justify-center animate-pulse">
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-12 w-80 bg-white rounded-2xl shadow-2xl border border-slate-100 z-50 overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100">
            <h3 className="font-bold text-hmsNavy text-sm">Notifications</h3>
            {unread > 0 && (
              <button onClick={markAll} className="text-xs text-hmsTeal font-semibold hover:underline">
                Mark all read
              </button>
            )}
          </div>
          <div className="max-h-80 overflow-y-auto">
            {notifs.length === 0 && (
              <div className="text-center py-8 text-slate-400 text-sm">
                <div className="text-3xl mb-2">🔔</div>
                <p>All caught up!</p>
              </div>
            )}
            {notifs.map(n => (
              <div key={n.id}
                className={`flex gap-3 px-4 py-3 border-b border-slate-50 transition ${!n.is_read ? "bg-hmsTeal/5" : "hover:bg-slate-50"}`}>
                <div className="text-xl flex-shrink-0 mt-0.5">{typeIcon[n.type] || "🔔"}</div>
                <div className="min-w-0">
                  <div className={`text-sm font-semibold ${!n.is_read ? "text-hmsNavy" : "text-slate-600"}`}>{n.title}</div>
                  <div className="text-xs text-slate-500 mt-0.5 line-clamp-2">{n.message}</div>
                  <div className="text-xs text-slate-400 mt-1">{new Date(n.created_at).toLocaleString()}</div>
                </div>
                {!n.is_read && <div className="w-2 h-2 rounded-full bg-hmsTeal flex-shrink-0 mt-2"/>}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
