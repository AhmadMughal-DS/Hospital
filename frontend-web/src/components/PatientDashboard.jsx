import { useEffect, useMemo, useState } from "react";
import axios from "axios";
import { useTranslation } from "react-i18next";

const QUEUE_BASE = import.meta.env.VITE_QUEUE_API_BASE || "http://localhost:8001";

const specialties = ["Cardiology", "Dermatology", "Orthopedics", "Neurology", "Pediatrics"];

const doctors = [
  { id: "D-100", name: "Dr. Sara Khan", specialty: "Cardiology", slot: "09:30" },
  { id: "D-101", name: "Dr. Ahmed Ali", specialty: "Dermatology", slot: "11:00" },
  { id: "D-102", name: "Dr. Lina Noor", specialty: "Orthopedics", slot: "15:30" },
  { id: "D-103", name: "Dr. Omar Aziz", specialty: "Neurology", slot: "17:00" },
];

const mockRecords = [
  { id: "RX-1001", type: "Prescription", title: "Hypertension follow-up", date: "2026-04-10" },
  { id: "LAB-2001", type: "Lab", title: "Complete blood count", date: "2026-04-04" },
  { id: "VIS-3001", type: "Visit", title: "General consultation", date: "2026-03-20" },
];

const mockPharmacy = [
  { name: "Paracetamol 500mg", stock: 34, expiry: "2027-02" },
  { name: "Amoxicillin 250mg", stock: 7, expiry: "2026-08" },
  { name: "Vitamin D3", stock: 21, expiry: "2027-11" },
];

const mockInvoices = [
  { id: "INV-9901", amount: "AED 220", status: "Paid" },
  { id: "INV-9902", amount: "AED 140", status: "Pending" },
];

export default function PatientDashboard({ user, token, onLogout }) {
  const { t, i18n } = useTranslation();
  const [active, setActive] = useState("overview");
  const [specialty, setSpecialty] = useState("Cardiology");
  const [bookDate, setBookDate] = useState("");
  const [bookTime, setBookTime] = useState("");
  const [appointments, setAppointments] = useState([]);
  const [queueState, setQueueState] = useState({ current: null, waiting_count: 0, queue: [] });

  const filteredDoctors = useMemo(() => doctors.filter((d) => d.specialty === specialty), [specialty]);

  useEffect(() => {
    const run = async () => {
      try {
        const response = await axios.get(`${QUEUE_BASE}/api/v1/queue/tokens/current`);
        setQueueState(response.data);
      } catch {
        // Queue service may be offline during local setup.
      }
    };

    run();
    const id = setInterval(run, 4000);
    return () => clearInterval(id);
  }, []);

  const bookAppointment = () => {
    if (!bookDate || !bookTime || filteredDoctors.length === 0) return;
    const selectedDoctor = filteredDoctors[0];
    setAppointments((prev) => [
      {
        id: `APT-${Date.now().toString().slice(-6)}`,
        doctor: selectedDoctor.name,
        specialty,
        date: bookDate,
        time: bookTime,
        status: "Scheduled",
      },
      ...prev,
    ]);
    setBookDate("");
    setBookTime("");
  };

  const genQueueToken = async () => {
    try {
      await axios.post(`${QUEUE_BASE}/api/v1/queue/tokens/generate`, {
        patient_id: user?.patient_id || null,
        doctor_id: null,
        is_priority: false,
      });
      const refresh = await axios.get(`${QUEUE_BASE}/api/v1/queue/tokens/current`);
      setQueueState(refresh.data);
    } catch {
      alert(t("queueServiceOffline"));
    }
  };

  const sections = {
    overview: (
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Stat title={t("welcomeBack")} value={user?.first_name || "Patient"} />
        <Stat title={t("patientId")} value={user?.patient_id || "-"} />
        <Stat title={t("appointments")} value={String(appointments.length)} />
        <Stat title={t("queueWaiting")} value={String(queueState.waiting_count || 0)} />
      </div>
    ),
    booking: (
      <div className="grid gap-4 lg:grid-cols-2">
        <Card title={t("bookAppointment")}
        >
          <div className="space-y-3">
            <label className="block">
              <span className="mb-1 block text-xs font-semibold text-slate-600">{t("specialty")}</span>
              <select className="w-full rounded-lg border border-slate-300 px-3 py-2" value={specialty} onChange={(e) => setSpecialty(e.target.value)}>
                {specialties.map((item) => (
                  <option key={item}>{item}</option>
                ))}
              </select>
            </label>
            <label className="block">
              <span className="mb-1 block text-xs font-semibold text-slate-600">{t("date")}</span>
              <input type="date" className="w-full rounded-lg border border-slate-300 px-3 py-2" value={bookDate} onChange={(e) => setBookDate(e.target.value)} />
            </label>
            <label className="block">
              <span className="mb-1 block text-xs font-semibold text-slate-600">{t("time")}</span>
              <input type="time" className="w-full rounded-lg border border-slate-300 px-3 py-2" value={bookTime} onChange={(e) => setBookTime(e.target.value)} />
            </label>
            <button onClick={bookAppointment} className="rounded-lg bg-hmsTeal px-4 py-2 text-sm font-semibold text-white">
              {t("confirmBooking")}
            </button>
          </div>
        </Card>

        <Card title={t("availableDoctors")}>
          <div className="space-y-2">
            {filteredDoctors.map((doc) => (
              <div key={doc.id} className="rounded-lg border border-slate-200 p-3">
                <div className="font-semibold text-hmsNavy">{doc.name}</div>
                <div className="text-sm text-slate-600">{doc.specialty} • {doc.slot}</div>
              </div>
            ))}
          </div>
        </Card>
      </div>
    ),
    records: (
      <Card title={t("medicalRecords")}>
        <div className="space-y-2">
          {mockRecords.map((record) => (
            <div key={record.id} className="flex items-center justify-between rounded-lg border border-slate-200 p-3">
              <div>
                <div className="font-semibold text-hmsNavy">{record.title}</div>
                <div className="text-sm text-slate-500">{record.type}</div>
              </div>
              <span className="text-xs font-semibold text-slate-600">{record.date}</span>
            </div>
          ))}
        </div>
      </Card>
    ),
    payments: (
      <Card title={t("payments")}
      >
        <div className="space-y-2">
          {mockInvoices.map((inv) => (
            <div key={inv.id} className="flex items-center justify-between rounded-lg border border-slate-200 p-3">
              <div className="font-semibold text-hmsNavy">{inv.id}</div>
              <div className="text-sm text-slate-700">{inv.amount}</div>
              <div className={`text-xs font-bold ${inv.status === "Paid" ? "text-emerald-600" : "text-amber-600"}`}>{inv.status}</div>
            </div>
          ))}
        </div>
      </Card>
    ),
    pharmacy: (
      <Card title={t("pharmacyInventory")}
      >
        <div className="space-y-2">
          {mockPharmacy.map((drug) => (
            <div key={drug.name} className="rounded-lg border border-slate-200 p-3">
              <div className="font-semibold text-hmsNavy">{drug.name}</div>
              <div className="text-sm text-slate-600">{t("stock")}: {drug.stock} • {t("expiry")}: {drug.expiry}</div>
            </div>
          ))}
        </div>
      </Card>
    ),
    queue: (
      <div className="grid gap-4 lg:grid-cols-2">
        <Card title={t("liveQueue")}
        >
          <div className="text-sm text-slate-700">
            <div>{t("currentToken")}: <strong>{queueState.current?.token_number || "-"}</strong></div>
            <div>{t("queueWaiting")}: <strong>{queueState.waiting_count ?? 0}</strong></div>
          </div>
          <button onClick={genQueueToken} className="mt-3 rounded-lg bg-hmsNavy px-4 py-2 text-sm font-semibold text-white">
            {t("generateToken")}
          </button>
        </Card>

        <Card title={t("myUpcoming")}
        >
          <div className="space-y-2">
            {appointments.length === 0 ? <p className="text-sm text-slate-500">{t("noAppointments")}</p> : null}
            {appointments.map((apt) => (
              <div key={apt.id} className="rounded-lg border border-slate-200 p-3">
                <div className="font-semibold text-hmsNavy">{apt.doctor}</div>
                <div className="text-sm text-slate-600">{apt.specialty} • {apt.date} {apt.time}</div>
              </div>
            ))}
          </div>
        </Card>
      </div>
    ),
  };

  const tabs = [
    ["overview", t("overview")],
    ["booking", t("booking")],
    ["records", t("records")],
    ["payments", t("payments")],
    ["pharmacy", t("pharmacy")],
    ["queue", t("queue")],
  ];

  return (
    <section className="mx-auto mt-6 w-full max-w-6xl rounded-3xl border border-white/30 bg-white/85 p-5 shadow-float backdrop-blur sm:p-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="font-heading text-2xl font-bold text-hmsNavy">{t("dashboard")}</h2>
          <p className="text-sm text-slate-600">{token ? t("sessionActive") : ""}</p>
        </div>
        <button className="rounded-lg border border-hmsNavy/20 px-4 py-2 text-sm font-semibold text-hmsNavy" onClick={onLogout}>
          {t("logout")}
        </button>
      </div>

      <div className="mt-5 flex flex-wrap gap-2">
        {tabs.map(([id, label]) => (
          <button
            key={id}
            onClick={() => setActive(id)}
            className={`rounded-full px-4 py-2 text-sm font-semibold transition ${active === id ? "bg-hmsNavy text-white" : "bg-slate-100 text-slate-700"}`}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="mt-5">{sections[active]}</div>
    </section>
  );
}

function Card({ title, children }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4">
      <h3 className="mb-3 font-heading text-lg font-bold text-hmsNavy">{title}</h3>
      {children}
    </div>
  );
}

function Stat({ title, value }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4">
      <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">{title}</div>
      <div className="mt-2 text-lg font-bold text-hmsNavy">{value}</div>
    </div>
  );
}
