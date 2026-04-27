/**
 * useSEO — Dynamic per-page SEO meta tag management
 *
 * Sets <title>, meta description, OG tags, Twitter card,
 * canonical URL, and hreflang whenever a page mounts.
 *
 * Usage:
 *   useSEO({
 *     title: "Book Appointment | MediCore HMS",
 *     description: "...",
 *     canonical: "/patient/booking",
 *   });
 */
import { useEffect } from "react";
import { useTranslation } from "react-i18next";

const SITE_NAME = "MediCore HMS";
const BASE_URL  = "https://medicorehms.ae";
const OG_IMAGE  = `${BASE_URL}/og-image.png`;

const PAGE_META = {
  // Route → { en, ar }
  "/login": {
    en: {
      title: "Sign In — MediCore HMS | Hospital Management UAE",
      description: "Sign in to MediCore HMS — the leading hospital management platform for UAE and Saudi Arabia. Access your patient portal, doctor dashboard, or admin panel.",
    },
    ar: {
      title: "تسجيل الدخول — ميديكور | نظام إدارة المستشفى",
      description: "سجّل دخولك إلى ميديكور — منصة إدارة المستشفيات الرائدة في الإمارات والمملكة العربية السعودية.",
    },
  },
  "/register": {
    en: {
      title: "Patient Registration — MediCore HMS | UAE Online Healthcare",
      description: "Register as a patient on MediCore HMS. Get your unique Patient ID, book online appointments, and access your digital medical records.",
    },
    ar: {
      title: "تسجيل المريض — ميديكور | الرعاية الصحية الإلكترونية",
      description: "سجّل كمريض في ميديكور. احصل على رقم مريضك الفريد وابدأ حجز مواعيدك الطبية فوراً.",
    },
  },
  "/patient": {
    en: {
      title: "Patient Portal — Book Appointments & View Records | MediCore HMS",
      description: "Access your MediCore patient portal: book appointments with specialist doctors, view digital prescriptions, track payments in AED/SAR/EUR, and manage your OPD queue token.",
    },
    ar: {
      title: "بوابة المريض — حجز المواعيد والسجلات الطبية | ميديكور",
      description: "ادخل إلى بوابة مريضك: احجز مواعيد مع أطباء متخصصين، اطلع على وصفاتك الطبية الرقمية، وتابع مدفوعاتك.",
    },
  },
  "/doctor": {
    en: {
      title: "Doctor Command Center — Daily Queue & E-Prescriptions | MediCore HMS",
      description: "Doctor dashboard: manage today's appointment queue, view patient vitals, write digital e-prescriptions, and conduct TeleHealth video consultations.",
    },
    ar: {
      title: "لوحة الطبيب — الطابور اليومي والوصفات الإلكترونية | ميديكور",
      description: "لوحة تحكم الطبيب: أدر طابورك اليومي، اكتب الوصفات الطبية الإلكترونية، وأجرِ استشارات مرئية عن بُعد.",
    },
  },
  "/admin": {
    en: {
      title: "Admin Control Center — HMS Analytics & Management | MediCore HMS",
      description: "Hospital admin dashboard: KPI overview, billing management, pharmacy inventory, doctor management, live OPD queue control, and system-wide analytics.",
    },
    ar: {
      title: "لوحة المدير — تحليلات وإدارة المستشفى | ميديكور",
      description: "لوحة إدارة المستشفى: نظرة عامة على المؤشرات، إدارة الفواتير، مخزون الصيدلية، والتحكم في الطابور المباشر.",
    },
  },
  "/pharmacy": {
    en: {
      title: "Pharmacy Management — Inventory & Stock Control | MediCore HMS",
      description: "Pharmacy module: real-time drug inventory tracking, low-stock alerts, expiry management, stock movement history, and prescription dispensing workflow.",
    },
    ar: {
      title: "إدارة الصيدلية — المخزون ومتابعة الأدوية | ميديكور",
      description: "وحدة الصيدلية: تتبع مخزون الأدوية لحظياً، تنبيهات النقص، إدارة الصلاحية، وسجل حركات المخزون.",
    },
  },
};

function setMeta(name, content, attr = "name") {
  if (!content) return;
  let el = document.querySelector(`meta[${attr}="${name}"]`);
  if (!el) {
    el = document.createElement("meta");
    el.setAttribute(attr, name);
    document.head.appendChild(el);
  }
  el.setAttribute("content", content);
}

function setLink(rel, href, extra = {}) {
  if (!href) return;
  let selector = `link[rel="${rel}"]`;
  Object.entries(extra).forEach(([k, v]) => { selector += `[${k}="${v}"]`; });
  let el = document.querySelector(selector);
  if (!el) {
    el = document.createElement("link");
    el.setAttribute("rel", rel);
    Object.entries(extra).forEach(([k, v]) => el.setAttribute(k, v));
    document.head.appendChild(el);
  }
  el.setAttribute("href", href);
}

export function useSEO({ title, description, canonical, noindex = false } = {}) {
  const { i18n } = useTranslation();
  const lang     = i18n.language === "ar" ? "ar" : "en";

  useEffect(() => {
    const path = window.location.pathname;

    // Auto-select from page meta map if not explicitly provided
    const pageMeta  = PAGE_META[path] || PAGE_META["/login"];
    const meta      = pageMeta?.[lang] || pageMeta?.en || {};
    const pageTitle = title       || meta.title       || `${SITE_NAME} — Hospital Management UAE`;
    const pageDesc  = description || meta.description || "Enterprise Hospital Management System for UAE and Saudi Arabia.";
    const pageCanon = `${BASE_URL}${canonical || path}`;

    // ── <title>
    document.title = pageTitle;

    // ── <html lang> and dir
    document.documentElement.lang = lang;
    document.documentElement.dir  = lang === "ar" ? "rtl" : "ltr";

    // ── Primary meta
    setMeta("description",      pageDesc);
    setMeta("robots",           noindex ? "noindex, nofollow" : "index, follow");

    // ── Open Graph
    setMeta("og:title",         pageTitle,  "property");
    setMeta("og:description",   pageDesc,   "property");
    setMeta("og:url",           pageCanon,  "property");
    setMeta("og:image",         OG_IMAGE,   "property");
    setMeta("og:locale",        lang === "ar" ? "ar_AE" : "en_AE", "property");

    // ── Twitter
    setMeta("twitter:title",       pageTitle);
    setMeta("twitter:description", pageDesc);
    setMeta("twitter:image",       OG_IMAGE);

    // ── Canonical
    setLink("canonical", pageCanon);

    // ── Hreflang
    setLink("alternate", `${BASE_URL}${path}`,       { hreflang: "en" });
    setLink("alternate", `${BASE_URL}/ar${path}`,    { hreflang: "ar" });
    setLink("alternate", `${BASE_URL}${path}`,       { hreflang: "x-default" });

  }, [title, description, canonical, lang, noindex]);
}

export default useSEO;
