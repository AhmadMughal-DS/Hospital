// Shared UI primitives used across all dashboards

export function Card({ title, subtitle, children, className = "", action }) {
  return (
    <div className={`glass-card rounded-2xl p-5 hover-lift ${className}`}>
      {(title || action) && (
        <div className="flex items-center justify-between mb-4">
          <div>
            {title && <h3 className="font-heading text-lg font-bold text-hmsNavy">{title}</h3>}
            {subtitle && <p className="text-xs text-slate-500 mt-0.5">{subtitle}</p>}
          </div>
          {action}
        </div>
      )}
      {children}
    </div>
  );
}

export function StatCard({ icon, title, value, sub, color = "teal", trend }) {
  const colors = {
    teal: "from-hmsTeal to-hmsMint",
    navy: "from-hmsNavy to-blue-800",
    amber: "from-amber-500 to-orange-500",
    emerald: "from-emerald-500 to-teal-600",
    rose: "from-rose-500 to-pink-600",
  };
  return (
    <div className={`rounded-2xl bg-gradient-to-br ${colors[color]} p-5 text-white shadow-lg hover-lift`}>
      <div className="flex items-start justify-between">
        <div className="text-3xl">{icon}</div>
        {trend && (
          <span className={`text-xs font-semibold px-2 py-1 rounded-full ${trend > 0 ? "bg-white/20" : "bg-black/20"}`}>
            {trend > 0 ? "↑" : "↓"} {Math.abs(trend)}%
          </span>
        )}
      </div>
      <div className="mt-3 text-2xl font-extrabold font-heading">{value}</div>
      <div className="text-sm font-semibold opacity-80 mt-1">{title}</div>
      {sub && <div className="text-xs opacity-60 mt-1">{sub}</div>}
    </div>
  );
}

export function Badge({ status }) {
  const map = {
    SCHEDULED: ["badge-scheduled", "Scheduled"],
    CONFIRMED: ["badge-confirmed", "Confirmed"],
    COMPLETED: ["badge-completed", "Completed"],
    CANCELLED: ["badge-cancelled", "Cancelled"],
    NO_SHOW: ["badge-cancelled", "No Show"],
    IN_PROGRESS: ["badge-in-progress", "In Progress"],
    PENDING: ["badge-pending", "Pending"],
    PAID: ["badge-paid", "Paid"],
    PARTIALLY_PAID: ["badge-pending", "Partial"],
    REFUNDED: ["badge-cancelled", "Refunded"],
    WAITING: ["badge-waiting", "Waiting"],
    CALLED: ["badge-called", "Called"],
    DRAFT: ["badge-pending", "Draft"],
  };
  const [cls, label] = map[status] || ["badge-pending", status];
  return (
    <span className={`inline-block px-2.5 py-0.5 rounded-full text-xs font-bold ${cls}`}>{label}</span>
  );
}

export function Btn({ children, onClick, variant = "primary", type = "button", disabled, className = "", size = "md" }) {
  const sizes = { sm: "px-3 py-1.5 text-xs", md: "px-4 py-2 text-sm", lg: "px-6 py-3 text-base" };
  return (
    <button
      type={type}
      disabled={disabled}
      onClick={onClick}
      className={`${sizes[size]} rounded-xl font-semibold transition-all btn-${variant} disabled:opacity-50 disabled:cursor-not-allowed ${className}`}
    >
      {children}
    </button>
  );
}

export function Input({ label, type = "text", value, onChange, required, placeholder, className = "" }) {
  return (
    <label className={`block ${className}`}>
      {label && <span className="block text-sm font-semibold text-slate-700 mb-1">{label}</span>}
      <input
        type={type}
        required={required}
        placeholder={placeholder}
        value={value}
        onChange={onChange}
        className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm transition"
      />
    </label>
  );
}

export function Select({ label, value, onChange, options, className = "" }) {
  return (
    <label className={`block ${className}`}>
      {label && <span className="block text-sm font-semibold text-slate-700 mb-1">{label}</span>}
      <select
        value={value}
        onChange={onChange}
        className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm transition"
      >
        {options.map(([val, lbl]) => (
          <option key={val} value={val}>{lbl}</option>
        ))}
      </select>
    </label>
  );
}

export function Alert({ type = "info", children }) {
  const styles = {
    info: "bg-blue-50 border-blue-200 text-blue-800",
    success: "bg-emerald-50 border-emerald-200 text-emerald-800",
    error: "bg-rose-50 border-rose-200 text-rose-800",
    warning: "bg-amber-50 border-amber-200 text-amber-800",
  };
  return (
    <div className={`rounded-xl border p-3 text-sm ${styles[type]}`}>{children}</div>
  );
}

export function Spinner() {
  return (
    <div className="flex items-center justify-center py-8">
      <div className="w-8 h-8 border-4 border-hmsTeal border-t-transparent rounded-full animate-spin" />
    </div>
  );
}

export function EmptyState({ icon = "📋", message }) {
  return (
    <div className="flex flex-col items-center py-10 text-slate-400">
      <div className="text-5xl mb-3">{icon}</div>
      <p className="text-sm">{message}</p>
    </div>
  );
}
