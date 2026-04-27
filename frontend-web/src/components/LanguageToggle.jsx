export default function LanguageToggle({ value, onChange }) {
  return (
    <div className="inline-flex rounded-full border border-white/30 bg-white/70 p-1 backdrop-blur">
      <button
        type="button"
        onClick={() => onChange("en")}
        className={`rounded-full px-4 py-1 text-sm font-semibold transition ${
          value === "en" ? "bg-hmsNavy text-white" : "text-hmsNavy"
        }`}
      >
        EN
      </button>
      <button
        type="button"
        onClick={() => onChange("ar")}
        className={`rounded-full px-4 py-1 text-sm font-semibold transition ${
          value === "ar" ? "bg-hmsNavy text-white" : "text-hmsNavy"
        }`}
      >
        AR
      </button>
    </div>
  );
}
