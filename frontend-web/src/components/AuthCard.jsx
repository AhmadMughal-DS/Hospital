import { useMemo, useState } from "react";
import axios from "axios";
import { useTranslation } from "react-i18next";

const API_BASE = import.meta.env.VITE_DJANGO_API_BASE || "http://localhost:8000";

export default function AuthCard({ mode, onAuthSuccess }) {
  const { t, i18n } = useTranslation();
  const [form, setForm] = useState({ full_name: "", email: "", password: "" });
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);

  const isRegister = mode === "register";
  const dir = useMemo(() => (i18n.language === "ar" ? "rtl" : "ltr"), [i18n.language]);

  const onSubmit = async (event) => {
    event.preventDefault();
    setResult(null);
    setLoading(true);
    try {
      if (isRegister) {
        const response = await axios.post(`${API_BASE}/api/v1/auth/register`, {
          full_name: form.full_name,
          email: form.email,
          password: form.password,
          language_preference: i18n.language === "ar" ? "AR" : "EN",
        });
        onAuthSuccess?.(response.data);
        setResult({
          ok: true,
          message: `${t("successRegister")}: ${response.data.user.patient_id}`,
          payload: response.data,
        });
      } else {
        const response = await axios.post(`${API_BASE}/api/v1/auth/login`, {
          email: form.email,
          password: form.password,
        });
        onAuthSuccess?.(response.data);
        setResult({ ok: true, message: t("successLogin"), payload: response.data });
      }
    } catch (error) {
      const detail = error?.response?.data?.detail || JSON.stringify(error?.response?.data || {}) || error.message;
      setResult({ ok: false, message: detail });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      dir={dir}
      className="w-full max-w-md rounded-3xl border border-white/40 bg-white/90 p-6 shadow-float backdrop-blur-sm sm:p-8"
    >
      <h2 className="font-heading text-2xl font-bold text-hmsNavy">{isRegister ? t("register") : t("login")}</h2>
      <form className="mt-6 space-y-4" onSubmit={onSubmit}>
        {isRegister ? (
          <label className="block">
            <span className="mb-1 block text-sm font-semibold text-hmsNavy/85">{t("fullName")}</span>
            <input
              required
              className="w-full rounded-xl border border-slate-300 px-4 py-3 outline-none transition focus:border-hmsTeal"
              value={form.full_name}
              onChange={(e) => setForm((prev) => ({ ...prev, full_name: e.target.value }))}
            />
          </label>
        ) : null}
        <label className="block">
          <span className="mb-1 block text-sm font-semibold text-hmsNavy/85">{t("email")}</span>
          <input
            type="email"
            required
            className="w-full rounded-xl border border-slate-300 px-4 py-3 outline-none transition focus:border-hmsTeal"
            value={form.email}
            onChange={(e) => setForm((prev) => ({ ...prev, email: e.target.value }))}
          />
        </label>
        <label className="block">
          <span className="mb-1 block text-sm font-semibold text-hmsNavy/85">{t("password")}</span>
          <input
            type="password"
            required
            className="w-full rounded-xl border border-slate-300 px-4 py-3 outline-none transition focus:border-hmsTeal"
            value={form.password}
            onChange={(e) => setForm((prev) => ({ ...prev, password: e.target.value }))}
          />
        </label>
        <button
          type="submit"
          disabled={loading}
          className="w-full rounded-xl bg-gradient-to-r from-hmsTeal to-hmsMint px-4 py-3 font-heading text-sm font-bold uppercase tracking-wide text-white transition hover:opacity-95 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {loading ? "..." : isRegister ? t("submitRegister") : t("submitLogin")}
        </button>
      </form>

      {result ? (
        <div className={`mt-4 rounded-xl p-3 text-sm ${result.ok ? "bg-emerald-50 text-emerald-700" : "bg-rose-50 text-rose-700"}`}>
          {result.message}
          {result.ok && result.payload?.user?.patient_id ? (
            <div className="mt-1 font-semibold">
              {t("patientId")}: {result.payload.user.patient_id}
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
