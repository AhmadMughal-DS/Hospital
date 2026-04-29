import { useState } from "react";
import axios from "axios";
import { Card, Btn, Input, Alert, EmptyState, TableWrap, Badge } from "../ui";

const API = import.meta.env.VITE_DJANGO_API_BASE || "http://localhost:8000";

const BLANK = {
  first_name:"", last_name:"", email:"", password:"Doctor@1234",
  specialty_id:"", license_number:"", bio:"",
  consultation_fee_aed:200, available_from:"08:00", available_to:"17:00",
  slot_duration_minutes:30, is_tele_health_enabled:true, telehealth_discount_percent:20,
};

export default function AdminDoctorsSection({ headers, specialties, doctors, onRefresh }) {
  const [form, setForm] = useState(BLANK);
  const [editId, setEditId] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [msg, setMsg] = useState(null);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");

  const set = (k,v) => setForm(p=>({...p,[k]:v}));

  const submit = async () => {
    setLoading(true); setMsg(null);
    try {
      if (editId) {
        await axios.patch(`${API}/api/v1/doctors/${editId}/`, {
          bio: form.bio,
          consultation_fee_aed: form.consultation_fee_aed,
          available_from: form.available_from,
          available_to: form.available_to,
          slot_duration_minutes: form.slot_duration_minutes,
          is_tele_health_enabled: form.is_tele_health_enabled,
          telehealth_discount_percent: form.telehealth_discount_percent,
          specialty: form.specialty_id || undefined,
        }, { headers });
        setMsg({ ok: true, text: "Doctor updated!" });
      } else {
        await axios.post(`${API}/api/v1/doctors/admin/create/`, form, { headers });
        setMsg({ ok: true, text: "Doctor created! Default password: Doctor@1234" });
      }
      setShowForm(false); setForm(BLANK); setEditId(null);
      onRefresh();
    } catch(e) {
      setMsg({ ok: false, text: e?.response?.data?.detail || "Error" });
    } finally { setLoading(false); }
  };

  const del = async (id) => {
    if (!window.confirm("Deactivate this doctor?")) return;
    try {
      await axios.delete(`${API}/api/v1/doctors/admin/${id}/delete/`, { headers });
      onRefresh();
    } catch(e) { alert(e?.response?.data?.detail || "Error"); }
  };

  const startEdit = (doc) => {
    setEditId(doc.id);
    setForm({
      ...BLANK,
      first_name: doc.user?.first_name || "",
      last_name: doc.user?.last_name || "",
      email: doc.user?.email || "",
      specialty_id: doc.specialty?.id || "",
      license_number: doc.license_number || "",
      bio: doc.bio || "",
      consultation_fee_aed: doc.consultation_fee_aed,
      available_from: doc.available_from?.slice(0,5) || "08:00",
      available_to: doc.available_to?.slice(0,5) || "17:00",
      slot_duration_minutes: doc.slot_duration_minutes,
      is_tele_health_enabled: doc.is_tele_health_enabled,
      telehealth_discount_percent: doc.telehealth_discount_percent,
    });
    setShowForm(true);
  };

  const filtered = doctors.filter(d =>
    `${d.full_name} ${d.specialty?.name} ${d.user?.email}`.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <input
          placeholder="🔍 Search doctors..."
          value={search} onChange={e=>setSearch(e.target.value)}
          className="border border-slate-200 rounded-xl px-4 py-2 text-sm flex-1 min-w-[180px]"
        />
        <Btn onClick={()=>{setShowForm(!showForm);setEditId(null);setForm(BLANK);}}>
          {showForm?"✕ Cancel":"+ Add Doctor"}
        </Btn>
      </div>

      {msg && <Alert type={msg.ok?"success":"error"}>{msg.text}</Alert>}

      {showForm && (
        <Card title={editId?"Edit Doctor":"Add New Doctor"}>
          <div className="grid sm:grid-cols-2 gap-3">
            <Input label="First Name *" value={form.first_name} onChange={e=>set("first_name",e.target.value)} disabled={!!editId}/>
            <Input label="Last Name" value={form.last_name} onChange={e=>set("last_name",e.target.value)} disabled={!!editId}/>
            <Input label="Email *" type="email" value={form.email} onChange={e=>set("email",e.target.value)} disabled={!!editId}/>
            {!editId && <Input label="Password" value={form.password} onChange={e=>set("password",e.target.value)}/>}
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">Specialty</label>
              <select value={form.specialty_id} onChange={e=>set("specialty_id",e.target.value)}
                className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm">
                <option value="">— Select —</option>
                {specialties.map(s=><option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </div>
            <Input label="License Number" value={form.license_number} onChange={e=>set("license_number",e.target.value)} disabled={!!editId}/>
            <Input label="Fee (AED)" type="number" value={form.consultation_fee_aed} onChange={e=>set("consultation_fee_aed",e.target.value)}/>
            <Input label="Available From" type="time" value={form.available_from} onChange={e=>set("available_from",e.target.value)}/>
            <Input label="Available To" type="time" value={form.available_to} onChange={e=>set("available_to",e.target.value)}/>
            <Input label="Slot Duration (min)" type="number" value={form.slot_duration_minutes} onChange={e=>set("slot_duration_minutes",e.target.value)}/>
            <Input label="TeleHealth Discount %" type="number" value={form.telehealth_discount_percent} onChange={e=>set("telehealth_discount_percent",e.target.value)}/>
            <div className="sm:col-span-2">
              <label className="text-xs font-semibold text-slate-600">Bio</label>
              <textarea rows={2} value={form.bio} onChange={e=>set("bio",e.target.value)}
                className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm mt-1"/>
            </div>
            <label className="flex items-center gap-2 text-sm sm:col-span-2">
              <input type="checkbox" checked={form.is_tele_health_enabled} onChange={e=>set("is_tele_health_enabled",e.target.checked)}/>
              Enable TeleHealth
            </label>
          </div>
          <Btn className="mt-4 w-full justify-center" onClick={submit} disabled={loading}>
            {loading?"Saving...": editId?"Update Doctor":"Create Doctor"}
          </Btn>
        </Card>
      )}

      <Card title={`All Doctors (${filtered.length})`}>
        {filtered.length===0 ? <EmptyState icon="👨‍⚕️" message="No doctors found"/> : (
          <TableWrap>
            <table className="hms-table w-full text-sm">
              <thead><tr>
                <th>Doctor</th><th className="hidden sm:table-cell">Specialty</th>
                <th className="hidden md:table-cell">Fee AED</th>
                <th className="hidden lg:table-cell">Hours</th>
                <th>Status</th><th>Actions</th>
              </tr></thead>
              <tbody>
                {filtered.map(doc=>(
                  <tr key={doc.id}>
                    <td>
                      <div className="font-semibold whitespace-nowrap">{doc.full_name}</div>
                      <div className="text-xs text-slate-400">{doc.user?.email}</div>
                    </td>
                    <td className="hidden sm:table-cell">{doc.specialty?.name||"—"}</td>
                    <td className="hidden md:table-cell font-semibold">{doc.consultation_fee_aed}</td>
                    <td className="hidden lg:table-cell text-xs">{doc.available_from?.slice(0,5)}–{doc.available_to?.slice(0,5)}</td>
                    <td><Badge status={doc.is_active?"ACTIVE":"INACTIVE"}/></td>
                    <td>
                      <div className="flex gap-1">
                        <button onClick={()=>startEdit(doc)}
                          className="text-xs bg-blue-50 text-blue-600 hover:bg-blue-100 px-2 py-1 rounded-lg font-semibold">
                          Edit
                        </button>
                        {doc.is_active && (
                          <button onClick={()=>del(doc.id)}
                            className="text-xs bg-red-50 text-red-600 hover:bg-red-100 px-2 py-1 rounded-lg font-semibold">
                            Remove
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </TableWrap>
        )}
      </Card>
    </div>
  );
}
