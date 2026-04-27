import { useTranslation } from "react-i18next";
import {
  LayoutDashboard, Calendar, FileText, CreditCard,
  Pill, Users, Stethoscope, ClipboardList, LogOut,
  Bell, Settings, ChevronRight
} from "lucide-react";

const roleNavs = {
  PATIENT: [
    { id: "overview", label: "Overview", labelAr: "نظرة عامة", icon: LayoutDashboard },
    { id: "booking", label: "Book Appointment", labelAr: "حجز موعد", icon: Calendar },
    { id: "records", label: "Medical Records", labelAr: "السجلات الطبية", icon: FileText },
    { id: "payments", label: "Payments", labelAr: "المدفوعات", icon: CreditCard },
    { id: "queue", label: "Queue", labelAr: "قائمة الانتظار", icon: ClipboardList },
  ],
  DOCTOR: [
    { id: "overview", label: "Dashboard", labelAr: "لوحة التحكم", icon: LayoutDashboard },
    { id: "queue", label: "Today's Queue", labelAr: "قائمة اليوم", icon: ClipboardList },
    { id: "patients", label: "My Patients", labelAr: "مرضاي", icon: Users },
    { id: "prescriptions", label: "Prescriptions", labelAr: "الوصفات الطبية", icon: FileText },
  ],
  ADMIN: [
    { id: "overview", label: "Overview", labelAr: "نظرة عامة", icon: LayoutDashboard },
    { id: "doctors", label: "Doctors", labelAr: "الأطباء", icon: Stethoscope },
    { id: "patients", label: "Patients", labelAr: "المرضى", icon: Users },
    { id: "appointments", label: "Appointments", labelAr: "المواعيد", icon: Calendar },
    { id: "billing", label: "Billing", labelAr: "الفواتير", icon: CreditCard },
    { id: "pharmacy", label: "Pharmacy", labelAr: "الصيدلية", icon: Pill },
    { id: "queue", label: "Queue", labelAr: "قائمة الانتظار", icon: ClipboardList },
  ],
  PHARMACIST: [
    { id: "overview", label: "Inventory", labelAr: "المخزون", icon: Pill },
    { id: "movements", label: "Stock Movements", labelAr: "حركة المخزون", icon: ClipboardList },
    { id: "prescriptions", label: "Prescriptions", labelAr: "الوصفات الطبية", icon: FileText },
    { id: "alerts", label: "Alerts", labelAr: "التنبيهات", icon: Bell },
  ],
};

export default function Sidebar({ role, active, onSelect, user, onLogout }) {
  const { i18n } = useTranslation();
  const isAr = i18n.language === "ar";
  const navItems = roleNavs[role] || roleNavs.PATIENT;

  const roleColors = {
    PATIENT: "🏥",
    DOCTOR: "👨‍⚕️",
    ADMIN: "⚙️",
    PHARMACIST: "💊",
  };

  const roleLabels = {
    PATIENT: isAr ? "مريض" : "Patient",
    DOCTOR: isAr ? "طبيب" : "Doctor",
    ADMIN: isAr ? "مدير" : "Admin",
    PHARMACIST: isAr ? "صيدلاني" : "Pharmacist",
  };

  const switchLanguage = () => {
    const next = i18n.language === "ar" ? "en" : "ar";
    i18n.changeLanguage(next);
    document.documentElement.lang = next;
    document.documentElement.dir = next === "ar" ? "rtl" : "ltr";
  };

  return (
    <aside className="sidebar w-64 min-h-screen flex flex-col flex-shrink-0 relative z-10">
      {/* Logo */}
      <div className="px-6 py-6 border-b border-white/10">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-hmsTeal to-hmsMint flex items-center justify-center text-xl">
            ⚕️
          </div>
          <div>
            <div className="font-heading text-white font-bold text-lg leading-none">MediCore</div>
            <div className="text-xs text-slate-400 font-medium">HMS Platform</div>
          </div>
        </div>
      </div>

      {/* User profile */}
      <div className="px-5 py-4 border-b border-white/10">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-full bg-gradient-to-br from-hmsTeal to-hmsMint flex items-center justify-center text-white text-sm font-bold">
            {user?.first_name?.[0] || "U"}
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-white text-sm font-semibold truncate">
              {user?.first_name} {user?.last_name}
            </div>
            <div className="text-xs text-slate-400 flex items-center gap-1">
              <span>{roleColors[role]}</span>
              <span>{roleLabels[role]}</span>
            </div>
          </div>
        </div>
        {user?.patient_id && (
          <div className="mt-2 px-2 py-1 bg-white/5 rounded-lg text-xs text-slate-400">
            ID: {user.patient_id}
          </div>
        )}
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
        {navItems.map(({ id, label, labelAr, icon: Icon }) => (
          <button
            key={id}
            onClick={() => onSelect(id)}
            className={`nav-link w-full flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm font-medium transition-all text-left ${
              active === id
                ? "bg-gradient-to-r from-hmsTeal/80 to-hmsMint/60 text-white shadow-md"
                : "text-slate-300 hover:text-white"
            }`}
          >
            <Icon size={18} className="flex-shrink-0" />
            <span className="flex-1">{isAr ? labelAr : label}</span>
            {active === id && <ChevronRight size={14} className="opacity-60" />}
          </button>
        ))}
      </nav>

      {/* Footer actions */}
      <div className="px-3 py-4 border-t border-white/10 space-y-1">
        <button
          onClick={switchLanguage}
          className="nav-link w-full flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm font-medium text-slate-300 hover:text-white"
        >
          <span className="text-base">🌐</span>
          <span>{isAr ? "English" : "العربية"}</span>
        </button>
        <button
          onClick={onLogout}
          className="nav-link w-full flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm font-medium text-red-400 hover:text-red-300 hover:bg-red-900/20"
        >
          <LogOut size={18} />
          <span>{isAr ? "تسجيل الخروج" : "Logout"}</span>
        </button>
      </div>
    </aside>
  );
}
