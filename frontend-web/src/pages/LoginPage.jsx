import { useState } from "react";
import { Link } from "react-router-dom";
import axios from "axios";
import { useTranslation } from "react-i18next";
import { Alert, Input, Btn } from "../components/ui";
import { useSEO } from "../hooks/useSEO";

const API = import.meta.env.VITE_DJANGO_API_BASE || "http://localhost:8000";

export default function LoginPage({ onLogin }) {
  const { t, i18n } = useTranslation();
  useSEO();
  const [form, setForm] = useState({ email: "", password: "" });
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);

  const isAr = i18n.language === "ar";

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const { data } = await axios.post(`${API}/api/v1/auth/login`, form);
      onLogin(data);
    } catch (err) {
      setError(err?.response?.data?.detail || err?.response?.data?.non_field_errors?.[0] || "Login failed. Check credentials.");
    } finally {
      setLoading(false);
    }
  };

  const switchLang = () => {
    const next = isAr ? "en" : "ar";
    i18n.changeLanguage(next);
    document.documentElement.lang = next;
    document.documentElement.dir = next === "ar" ? "rtl" : "ltr";
  };

  return (
    <div className="relative z-10 min-h-screen flex items-center justify-center px-4 py-8">
      <div className="w-full max-w-5xl grid lg:grid-cols-2 gap-0 rounded-2xl sm:rounded-3xl overflow-hidden shadow-2xl">

        {/* Left panel — hidden on mobile */}
        <div className="hidden lg:flex flex-col justify-between p-10 bg-gradient-to-br from-hmsNavy to-blue-900 text-white">
          <div>
            <div className="flex items-center gap-3 mb-12">
              <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-hmsTeal to-hmsMint flex items-center justify-center text-2xl">⚕️</div>
              <div>
                <div className="font-heading text-2xl font-bold">MediCore HMS</div>
                <div className="text-xs text-blue-300">Enterprise Healthcare Platform</div>
              </div>
            </div>
            <h1 className="font-heading text-4xl font-black leading-tight mb-4">
              {isAr ? "منصة الرعاية الصحية المتكاملة" : "Next-Generation Hospital Management"}
            </h1>
            <p className="text-blue-200 text-sm leading-relaxed">
              {isAr
                ? "إدارة شاملة للمستشفيات مع دعم كامل للغة العربية وواجهة مستخدم حديثة"
                : "Scalable, HIPAA & GDPR-ready HMS for Middle East and European markets."}
            </p>
          </div>
          <div className="grid grid-cols-2 gap-4">
            {[
              { icon: "👨‍⚕️", label: isAr ? "أطباء" : "Doctors", value: "50+" },
              { icon: "🏥", label: isAr ? "مواعيد" : "Appointments", value: "1200+/mo" },
              { icon: "💊", label: isAr ? "صيدلية" : "Pharmacy", value: "Real-time" },
              { icon: "🔒", label: isAr ? "آمن" : "Security", value: "GDPR Ready" },
            ].map(({ icon, label, value }) => (
              <div key={label} className="bg-white/10 rounded-2xl p-4 backdrop-blur">
                <div className="text-2xl mb-2">{icon}</div>
                <div className="text-lg font-bold">{value}</div>
                <div className="text-xs text-blue-300">{label}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Right panel — full width on mobile */}
        <div className="bg-white p-6 sm:p-8 lg:p-10 flex flex-col justify-center">

          {/* Mobile logo */}
          <div className="flex lg:hidden items-center gap-3 mb-6">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-hmsTeal to-hmsMint flex items-center justify-center text-xl">⚕️</div>
            <div>
              <div className="font-heading text-xl font-bold text-hmsNavy">MediCore HMS</div>
              <div className="text-xs text-slate-400">Enterprise Healthcare Platform</div>
            </div>
          </div>

          <div className="flex items-center justify-between mb-6 sm:mb-8">
            <div>
              <h2 className="font-heading text-xl sm:text-2xl font-black text-hmsNavy">
                {isAr ? "تسجيل الدخول" : "Welcome Back"}
              </h2>
              <p className="text-sm text-slate-500 mt-1">
                {isAr ? "أدخل بيانات حسابك" : "Sign in to your account"}
              </p>
            </div>
            <button
              onClick={switchLang}
              className="text-xs font-semibold text-hmsTeal border border-hmsTeal/30 px-3 py-1.5 rounded-lg hover:bg-hmsTeal/5 transition flex-shrink-0"
            >
              {isAr ? "EN" : "عربي"}
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <Input
              label={isAr ? "البريد الإلكتروني" : "Email Address"}
              type="email"
              required
              value={form.email}
              onChange={e => setForm(p => ({ ...p, email: e.target.value }))}
              placeholder="you@example.com"
            />
            <Input
              label={isAr ? "كلمة المرور" : "Password"}
              type="password"
              required
              value={form.password}
              onChange={e => setForm(p => ({ ...p, password: e.target.value }))}
              placeholder="••••••••"
            />
            {error && <Alert type="error">{error}</Alert>}
            <Btn type="submit" disabled={loading} className="w-full justify-center" size="lg">
              {loading ? "..." : isAr ? "دخول" : "Sign In"}
            </Btn>
          </form>

          <div className="mt-5 text-center text-sm text-slate-500">
            {isAr ? "ليس لديك حساب؟" : "Don't have an account?"}{" "}
            <Link to="/register" className="text-hmsTeal font-semibold hover:underline">
              {isAr ? "سجل الآن" : "Register"}
            </Link>
          </div>

          {/* Demo credentials */}
          <div className="mt-5 p-3 sm:p-4 bg-slate-50 rounded-xl text-xs text-slate-600 space-y-1">
            <div className="font-bold text-slate-700 mb-2">🔑 Demo Credentials</div>
            <div><strong>Admin:</strong> admin@hms.ae / Admin@1234</div>
            <div><strong>Doctor:</strong> sara.khan@hms.ae / Doctor@1234</div>
            <div><strong>Pharmacist:</strong> pharma@hms.ae / Pharma@1234</div>
            <div><strong>Patient:</strong> patient@hms.ae / Patient@1234</div>
          </div>
        </div>
      </div>
    </div>
  );
}
