import { useState } from "react";
import axios from "axios";
import { Card, Btn, Input, Alert, EmptyState, TableWrap, Badge } from "../ui";

const API = import.meta.env.VITE_DJANGO_API_BASE || "http://localhost:8000";

const BLANK_OPD = { patient_name:"", patient_phone:"", age:"", gender:"Male", reason:"", bp:"", temperature:"", weight_kg:"", referring_doctor:"", notes:"" };
const BLANK_XRAY = { patient_name:"", patient_phone:"", xray_type:"CHEST", referring_doctor:"", notes:"" };

const STATUS_COLORS = {
  WAITING:"bg-amber-100 text-amber-700", IN_PROGRESS:"bg-blue-100 text-blue-700",
  SEEN:"bg-emerald-100 text-emerald-700", REFERRED:"bg-purple-100 text-purple-700",
  DISCHARGED:"bg-slate-100 text-slate-600", PENDING:"bg-amber-100 text-amber-700",
  DONE:"bg-emerald-100 text-emerald-700", REPORTED:"bg-teal-100 text-teal-700",
};

export default function AdminOPDXRaySection({ headers, doctors }) {
  const [tab, setTab] = useState("opd");
  const [opds, setOpds] = useState([]);
  const [xrays, setXrays] = useState([]);
  const [opdForm, setOpdForm] = useState(BLANK_OPD);
  const [xrayForm, setXrayForm] = useState(BLANK_XRAY);
  const [showOpdForm, setShowOpdForm] = useState(false);
  const [showXrayForm, setShowXrayForm] = useState(false);
  const [msg, setMsg] = useState(null);
  const [loaded, setLoaded] = useState(false);

  const loadData = async () => {
    try {
      const [o, x] = await Promise.all([
        axios.get(`${API}/api/v1/appointments/opd/`, { headers }),
        axios.get(`${API}/api/v1/appointments/xray/`, { headers }),
      ]);
      setOpds(o.data.results||o.data);
      setXrays(x.data.results||x.data);
      setLoaded(true);
    } catch{}
  };

  if (!loaded) loadData();

  const setO = (k,v) => setOpdForm(p=>({...p,[k]:v}));
  const setX = (k,v) => setXrayForm(p=>({...p,[k]:v}));

  const submitOpd = async () => {
    setMsg(null);
    try {
      await axios.post(`${API}/api/v1/appointments/opd/`, opdForm, { headers });
      setMsg({ok:true,text:"OPD visit registered!"}); setShowOpdForm(false); setOpdForm(BLANK_OPD); loadData();
    } catch(e) { setMsg({ok:false,text:"Error registering OPD visit"}); }
  };

  const submitXray = async () => {
    setMsg(null);
    try {
      await axios.post(`${API}/api/v1/appointments/xray/`, xrayForm, { headers });
      setMsg({ok:true,text:"X-Ray request created!"}); setShowXrayForm(false); setXrayForm(BLANK_XRAY); loadData();
    } catch(e) { setMsg({ok:false,text:"Error creating X-Ray request"}); }
  };

  const updateOpdStatus = async (id, status) => {
    try { await axios.patch(`${API}/api/v1/appointments/opd/${id}/`, {status}, {headers}); loadData(); } catch{}
  };

  const updateXrayStatus = async (id, status) => {
    try { await axios.patch(`${API}/api/v1/appointments/xray/${id}/`, {status}, {headers}); loadData(); } catch{}
  };

  const OPD_STATUSES = ["WAITING","IN_PROGRESS","SEEN","REFERRED","DISCHARGED"];
  const XRAY_STATUSES = ["PENDING","IN_PROGRESS","DONE","REPORTED"];

  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        {[["opd","🏥 OPD"],["xray","🩻 X-Ray / Radiology"]].map(([id,lbl])=>(
          <button key={id} onClick={()=>setTab(id)}
            className={`px-4 py-2 rounded-full text-sm font-semibold transition ${tab===id?"bg-hmsTeal text-white":"bg-slate-100 text-slate-600 hover:bg-slate-200"}`}>
            {lbl}
          </button>
        ))}
      </div>

      {msg && <Alert type={msg.ok?"success":"error"}>{msg.text}</Alert>}

      {tab==="opd" && (
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <div>
              <span className="font-semibold text-hmsNavy">Today's OPD</span>
              <span className="ml-2 text-xs bg-hmsTeal/10 text-hmsTeal px-2 py-0.5 rounded-full font-semibold">{opds.filter(o=>o.status==="WAITING").length} waiting</span>
            </div>
            <Btn onClick={()=>setShowOpdForm(!showOpdForm)}>{showOpdForm?"✕ Cancel":"+ Register Patient"}</Btn>
          </div>

          {showOpdForm && (
            <Card title="Register OPD Visit">
              <div className="grid sm:grid-cols-2 gap-3">
                <Input label="Patient Name *" value={opdForm.patient_name} onChange={e=>setO("patient_name",e.target.value)}/>
                <Input label="Phone" value={opdForm.patient_phone} onChange={e=>setO("patient_phone",e.target.value)}/>
                <Input label="Age" type="number" value={opdForm.age} onChange={e=>setO("age",e.target.value)}/>
                <div>
                  <label className="text-xs font-semibold text-slate-600">Gender</label>
                  <select value={opdForm.gender} onChange={e=>setO("gender",e.target.value)} className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm mt-1">
                    <option>Male</option><option>Female</option><option>Other</option>
                  </select>
                </div>
                <Input label="BP (e.g. 120/80)" value={opdForm.bp} onChange={e=>setO("bp",e.target.value)}/>
                <Input label="Temperature (°C)" value={opdForm.temperature} onChange={e=>setO("temperature",e.target.value)}/>
                <Input label="Weight (kg)" type="number" value={opdForm.weight_kg} onChange={e=>setO("weight_kg",e.target.value)}/>
                <div>
                  <label className="text-xs font-semibold text-slate-600">Referring Doctor</label>
                  <select value={opdForm.referring_doctor} onChange={e=>setO("referring_doctor",e.target.value)} className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm mt-1">
                    <option value="">— None —</option>
                    {doctors.map(d=><option key={d.id} value={d.id}>{d.full_name}</option>)}
                  </select>
                </div>
                <div className="sm:col-span-2">
                  <label className="text-xs font-semibold text-slate-600">Reason for Visit</label>
                  <textarea rows={2} value={opdForm.reason} onChange={e=>setO("reason",e.target.value)} className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm mt-1"/>
                </div>
              </div>
              <Btn className="mt-4 w-full justify-center" onClick={submitOpd}>Register Visit</Btn>
            </Card>
          )}

          {opds.length===0 ? <EmptyState icon="🏥" message="No OPD visits today"/> : (
            <TableWrap>
              <table className="hms-table w-full text-sm">
                <thead><tr>
                  <th>Patient</th><th className="hidden sm:table-cell">Age/Gender</th>
                  <th className="hidden md:table-cell">Vitals</th>
                  <th className="hidden md:table-cell">Reason</th>
                  <th>Status</th><th>Actions</th>
                </tr></thead>
                <tbody>
                  {opds.map(o=>(
                    <tr key={o.id}>
                      <td><div className="font-semibold">{o.patient_name}</div><div className="text-xs text-slate-400">{o.patient_phone}</div></td>
                      <td className="hidden sm:table-cell text-xs">{o.age&&`${o.age}y`} {o.gender}</td>
                      <td className="hidden md:table-cell text-xs"><div>BP: {o.bp||"—"}</div><div>Temp: {o.temperature||"—"}</div><div>Wt: {o.weight_kg||"—"}kg</div></td>
                      <td className="hidden md:table-cell text-xs max-w-[140px] truncate">{o.reason||"—"}</td>
                      <td><span className={`text-xs font-bold px-2 py-1 rounded-full ${STATUS_COLORS[o.status]||""}`}>{o.status}</span></td>
                      <td>
                        <select value={o.status} onChange={e=>updateOpdStatus(o.id,e.target.value)}
                          className="text-xs border border-slate-200 rounded-lg px-2 py-1">
                          {OPD_STATUSES.map(s=><option key={s}>{s}</option>)}
                        </select>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </TableWrap>
          )}
        </div>
      )}

      {tab==="xray" && (
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <div>
              <span className="font-semibold text-hmsNavy">X-Ray Requests</span>
              <span className="ml-2 text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full font-semibold">{xrays.filter(x=>x.status==="PENDING").length} pending</span>
            </div>
            <Btn onClick={()=>setShowXrayForm(!showXrayForm)}>{showXrayForm?"✕ Cancel":"+ New Request"}</Btn>
          </div>

          {showXrayForm && (
            <Card title="New X-Ray Request">
              <div className="grid sm:grid-cols-2 gap-3">
                <Input label="Patient Name *" value={xrayForm.patient_name} onChange={e=>setX("patient_name",e.target.value)}/>
                <Input label="Phone" value={xrayForm.patient_phone} onChange={e=>setX("patient_phone",e.target.value)}/>
                <div>
                  <label className="text-xs font-semibold text-slate-600">X-Ray Type</label>
                  <select value={xrayForm.xray_type} onChange={e=>setX("xray_type",e.target.value)} className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm mt-1">
                    {[["CHEST","Chest X-Ray"],["KNEE","Knee"],["SPINE","Spine"],["PELVIS","Pelvis"],["HAND","Hand/Wrist"],["FOOT","Foot/Ankle"],["SKULL","Skull"],["ABDOMEN","Abdomen"],["OTHER","Other"]].map(([v,l])=><option key={v} value={v}>{l}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-600">Referring Doctor</label>
                  <select value={xrayForm.referring_doctor} onChange={e=>setX("referring_doctor",e.target.value)} className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm mt-1">
                    <option value="">— None —</option>
                    {doctors.map(d=><option key={d.id} value={d.id}>{d.full_name}</option>)}
                  </select>
                </div>
                <div className="sm:col-span-2">
                  <label className="text-xs font-semibold text-slate-600">Notes</label>
                  <textarea rows={2} value={xrayForm.notes} onChange={e=>setX("notes",e.target.value)} className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm mt-1"/>
                </div>
              </div>
              <Btn className="mt-4 w-full justify-center" onClick={submitXray}>Create Request</Btn>
            </Card>
          )}

          {xrays.length===0 ? <EmptyState icon="🩻" message="No X-Ray requests"/> : (
            <TableWrap>
              <table className="hms-table w-full text-sm">
                <thead><tr>
                  <th>Patient</th><th>Type</th>
                  <th className="hidden sm:table-cell">Doctor</th>
                  <th className="hidden md:table-cell">Date</th>
                  <th>Status</th><th>Update</th>
                </tr></thead>
                <tbody>
                  {xrays.map(x=>(
                    <tr key={x.id}>
                      <td><div className="font-semibold">{x.patient_name}</div><div className="text-xs text-slate-400">{x.patient_phone}</div></td>
                      <td className="font-semibold text-blue-600">{x.xray_type}</td>
                      <td className="hidden sm:table-cell text-xs">{x.referring_doctor_name||"—"}</td>
                      <td className="hidden md:table-cell text-xs">{x.requested_at?.slice(0,10)}</td>
                      <td><span className={`text-xs font-bold px-2 py-1 rounded-full ${STATUS_COLORS[x.status]||""}`}>{x.status}</span></td>
                      <td>
                        <select value={x.status} onChange={e=>updateXrayStatus(x.id,e.target.value)}
                          className="text-xs border border-slate-200 rounded-lg px-2 py-1">
                          {XRAY_STATUSES.map(s=><option key={s}>{s}</option>)}
                        </select>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </TableWrap>
          )}
        </div>
      )}
    </div>
  );
}
