import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import axios from "axios";
import { useTranslation } from "react-i18next";
import { Alert, Input, Btn } from "../components/ui";
import { useSEO } from "../hooks/useSEO";

const API = import.meta.env.VITE_DJANGO_API_BASE || "http://localhost:8000";

export default function RegisterPage({ onLogin }) {
  const navigate = useNavigate();
  const { t, i18n } = useTranslation();
  const isAr = i18n.language === "ar";
  useSEO();
  const [form, setForm] = useState({ full_name: "", email: "", password: "", confirm: "" });
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    if (form.password !== form.confirm) { setError("Passwords do not match."); return; }
    setLoading(true);
    try {
      const { data } = await axios.post(`${API}/api/v1/auth/register`, {
        full_name: form.full_name,
        email: form.email,
        password: form.password,
        language_preference: isAr ? "AR" : "EN",
      });
      setSuccess(`Account created successfully! Redirecting to Sign In...`);
      setTimeout(() => { navigate("/login"); }, 1800);
    } catch (err) {
      const msg = err?.response?.data;
      setError(typeof msg === "string" ? msg : JSON.stringify(msg));
    } finally {
      setLoading(false);
    }
  };

  const set = (key) => (e) => setForm(p => ({ ...p, [key]: e.target.value }));

  return (
    <div className="relative z-10 min-h-screen flex items-center justify-center px-4 py-10">
      <div className="w-full max-w-md bg-white rounded-2xl sm:rounded-3xl shadow-2xl p-6 sm:p-8 lg:p-10">
        <div className="flex items-center gap-3 mb-8">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-hmsTeal to-hmsMint flex items-center justify-center text-xl">⚕️</div>
          <div>
            <div className="font-heading text-xl font-bold text-hmsNavy">MediCore HMS</div>
            <div className="text-xs text-slate-400">Patient Registration</div>
          </div>
        </div>
        <h2 className="font-heading text-2xl font-black text-hmsNavy mb-1">
          {isAr ? "إنشاء حساب جديد" : "Create Your Account"}
        </h2>
        <p className="text-sm text-slate-500 mb-6">
          {isAr ? "سجّل كمريض للوصول إلى خدماتنا" : "Register as a patient to access our services"}
        </p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <Input
            label={isAr ? "الاسم الكامل" : "Full Name"}
            value={form.full_name}
            onChange={set("full_name")}
            required
            placeholder="John Smith"
          />
          <Input
            label={isAr ? "البريد الإلكتروني" : "Email Address"}
            type="email"
            value={form.email}
            onChange={set("email")}
            required
            placeholder="you@example.com"
          />
          <Input
            label={isAr ? "كلمة المرور" : "Password"}
            type="password"
            value={form.password}
            onChange={set("password")}
            required
            placeholder="Min. 8 characters"
          />
          <Input
            label={isAr ? "تأكيد كلمة المرور" : "Confirm Password"}
            type="password"
            value={form.confirm}
            onChange={set("confirm")}
            required
            placeholder="Repeat password"
          />
          {error && <Alert type="error">{error}</Alert>}
          {success && <Alert type="success">{success}</Alert>}
          <Btn type="submit" disabled={loading} className="w-full justify-center" size="lg">
            {loading ? "Creating Account..." : isAr ? "إنشاء الحساب" : "Create Account"}
          </Btn>
        </form>

        <p className="mt-5 text-center text-sm text-slate-500">
          {isAr ? "لديك حساب بالفعل؟" : "Already have an account?"}{" "}
          <Link to="/login" className="text-hmsTeal font-semibold hover:underline">
            {isAr ? "تسجيل الدخول" : "Sign In"}
          </Link>
        </p>
      </div>
    </div>
  );
}
