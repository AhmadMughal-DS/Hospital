import { useState } from "react";
import axios from "axios";
import { Card, Btn, Input, Alert, EmptyState, TableWrap, Badge } from "../ui";

const API = import.meta.env.VITE_DJANGO_API_BASE || "http://localhost:8000";
const BLANK_DRUG = { name:"", sku:"", category:"", unit:"tablet", unit_price_aed:0, stock_quantity:0, low_stock_threshold:10, expiry_date:"", is_controlled:false };
const BLANK_MOVE = { drug:"", movement_type:"IN", quantity:1, reference:"", notes:"" };

export default function AdminPharmacySection({ headers, drugs, onRefresh }) {
  const [tab, setTab] = useState("inventory");
  const [form, setForm] = useState(BLANK_DRUG);
  const [editId, setEditId] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [move, setMove] = useState(BLANK_MOVE);
  const [msg, setMsg] = useState(null);
  const [search, setSearch] = useState("");

  const set = (k,v) => setForm(p=>({...p,[k]:v}));
  const setM = (k,v) => setMove(p=>({...p,[k]:v}));

  const submitDrug = async () => {
    setMsg(null);
    try {
      if (editId) {
        await axios.patch(`${API}/api/v1/pharmacy/drugs/${editId}/`, form, { headers });
      } else {
        await axios.post(`${API}/api/v1/pharmacy/drugs/`, form, { headers });
      }
      setMsg({ ok:true, text: editId?"Updated!":"Medicine added!" });
      setShowForm(false); setForm(BLANK_DRUG); setEditId(null);
      onRefresh();
    } catch(e) { setMsg({ ok:false, text: e?.response?.data?.detail || JSON.stringify(e?.response?.data) || "Error" }); }
  };

  const delDrug = async (id) => {
    if (!window.confirm("Deactivate this medicine?")) return;
    try { await axios.delete(`${API}/api/v1/pharmacy/drugs/${id}/`, { headers }); onRefresh(); }
    catch(e) { alert("Error"); }
  };

  const submitMove = async () => {
    setMsg(null);
    try {
      await axios.post(`${API}/api/v1/pharmacy/stock-movements/`, move, { headers });
      setMsg({ ok:true, text:"Stock updated!" }); setMove(BLANK_MOVE); onRefresh();
    } catch(e) { setMsg({ ok:false, text:"Error updating stock" }); }
  };

  const startEdit = (d) => { setEditId(d.id); setForm({ name:d.name, sku:d.sku, category:d.category||"", unit:d.unit, unit_price_aed:d.unit_price_aed, stock_quantity:d.stock_quantity, low_stock_threshold:d.low_stock_threshold, expiry_date:d.expiry_date||"", is_controlled:d.is_controlled }); setShowForm(true); setTab("inventory"); };

  const filtered = drugs.filter(d => d.name.toLowerCase().includes(search.toLowerCase()) || d.sku.toLowerCase().includes(search.toLowerCase()));

  return (
    <div className="space-y-4">
      <div className="flex gap-2 flex-wrap">
        {[["inventory","💊 Inventory"],["stock","📦 Stock Adjustment"]].map(([id,lbl])=>(
          <button key={id} onClick={()=>setTab(id)}
            className={`px-4 py-2 rounded-full text-sm font-semibold transition ${tab===id?"bg-hmsTeal text-white":"bg-slate-100 text-slate-600 hover:bg-slate-200"}`}>
            {lbl}
          </button>
        ))}
      </div>

      {msg && <Alert type={msg.ok?"success":"error"}>{msg.text}</Alert>}

      {tab==="inventory" && (
        <div className="space-y-4">
          <div className="flex gap-3 flex-wrap">
            <input placeholder="🔍 Search medicines..." value={search} onChange={e=>setSearch(e.target.value)}
              className="border border-slate-200 rounded-xl px-4 py-2 text-sm flex-1 min-w-[180px]"/>
            <Btn onClick={()=>{setShowForm(!showForm);setEditId(null);setForm(BLANK_DRUG);}}>
              {showForm?"✕ Cancel":"+ Add Medicine"}
            </Btn>
          </div>

          {showForm && (
            <Card title={editId?"Edit Medicine":"Add New Medicine"}>
              <div className="grid sm:grid-cols-2 gap-3">
                <Input label="Name *" value={form.name} onChange={e=>set("name",e.target.value)}/>
                <Input label="SKU *" value={form.sku} onChange={e=>set("sku",e.target.value)} disabled={!!editId}/>
                <Input label="Category" value={form.category} onChange={e=>set("category",e.target.value)}/>
                <div>
                  <label className="text-xs font-semibold text-slate-600">Unit</label>
                  <select value={form.unit} onChange={e=>set("unit",e.target.value)} className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm mt-1">
                    {["tablet","capsule","ml","mg","syrup","injection","cream","drops","sachet","patch"].map(u=><option key={u}>{u}</option>)}
                  </select>
                </div>
                <Input label="Price (AED)" type="number" value={form.unit_price_aed} onChange={e=>set("unit_price_aed",e.target.value)}/>
                <Input label="Stock Quantity" type="number" value={form.stock_quantity} onChange={e=>set("stock_quantity",e.target.value)}/>
                <Input label="Low Stock Threshold" type="number" value={form.low_stock_threshold} onChange={e=>set("low_stock_threshold",e.target.value)}/>
                <Input label="Expiry Date" type="date" value={form.expiry_date} onChange={e=>set("expiry_date",e.target.value)}/>
                <label className="flex items-center gap-2 text-sm">
                  <input type="checkbox" checked={form.is_controlled} onChange={e=>set("is_controlled",e.target.checked)}/>
                  Controlled Substance
                </label>
              </div>
              <Btn className="mt-4 w-full justify-center" onClick={submitDrug}>{editId?"Update":"Add Medicine"}</Btn>
            </Card>
          )}

          <Card title={`Medicine Inventory (${filtered.length})`}>
            {filtered.length===0 ? <EmptyState icon="💊" message="No medicines found"/> : (
              <TableWrap>
                <table className="hms-table w-full text-sm">
                  <thead><tr>
                    <th>Name</th><th className="hidden sm:table-cell">SKU</th>
                    <th className="hidden md:table-cell">Category</th>
                    <th>Stock</th><th className="hidden sm:table-cell">Price AED</th>
                    <th className="hidden lg:table-cell">Expiry</th>
                    <th>Status</th><th>Actions</th>
                  </tr></thead>
                  <tbody>
                    {filtered.map(d=>(
                      <tr key={d.id} className={d.is_expired?"expired":d.is_low_stock?"low-stock":""}>
                        <td className="font-semibold whitespace-nowrap">{d.name}{d.is_controlled&&<span className="ml-1 text-xs text-red-500">⚠️</span>}</td>
                        <td className="hidden sm:table-cell font-mono text-xs">{d.sku}</td>
                        <td className="hidden md:table-cell">{d.category}</td>
                        <td className={`font-bold ${d.is_low_stock?"text-orange-600":"text-emerald-600"}`}>{d.stock_quantity}</td>
                        <td className="hidden sm:table-cell">{d.unit_price_aed}</td>
                        <td className="hidden lg:table-cell">{d.expiry_date||"—"}</td>
                        <td>{d.is_expired?<span className="text-xs text-red-600 font-bold">❌ Expired</span>:d.is_low_stock?<span className="text-xs text-orange-600 font-bold">⚠️ Low</span>:<span className="text-xs text-emerald-600 font-bold">✅ OK</span>}</td>
                        <td>
                          <div className="flex gap-1">
                            <button onClick={()=>startEdit(d)} className="text-xs bg-blue-50 text-blue-600 hover:bg-blue-100 px-2 py-1 rounded-lg font-semibold">Edit</button>
                            <button onClick={()=>delDrug(d.id)} className="text-xs bg-red-50 text-red-600 hover:bg-red-100 px-2 py-1 rounded-lg font-semibold">Del</button>
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
      )}

      {tab==="stock" && (
        <Card title="Stock Adjustment">
          <div className="grid sm:grid-cols-2 gap-3 max-w-lg">
            <div className="sm:col-span-2">
              <label className="text-xs font-semibold text-slate-600">Medicine *</label>
              <select value={move.drug} onChange={e=>setM("drug",e.target.value)} className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm mt-1">
                <option value="">— Select Medicine —</option>
                {drugs.map(d=><option key={d.id} value={d.id}>{d.name} (Stock: {d.stock_quantity})</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-600">Movement Type</label>
              <select value={move.movement_type} onChange={e=>setM("movement_type",e.target.value)} className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm mt-1">
                <option value="IN">📦 Stock In (Add)</option>
                <option value="OUT">📤 Stock Out (Remove)</option>
                <option value="ADJUSTMENT">🔧 Set Exact Quantity</option>
                <option value="EXPIRED">❌ Mark Expired</option>
              </select>
            </div>
            <Input label="Quantity" type="number" value={move.quantity} onChange={e=>setM("quantity",e.target.value)}/>
            <Input label="Reference (optional)" value={move.reference} onChange={e=>setM("reference",e.target.value)}/>
            <div className="sm:col-span-2">
              <label className="text-xs font-semibold text-slate-600">Notes</label>
              <textarea rows={2} value={move.notes} onChange={e=>setM("notes",e.target.value)} className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm mt-1"/>
            </div>
          </div>
          <Btn className="mt-4" onClick={submitMove} disabled={!move.drug||!move.quantity}>Update Stock</Btn>
        </Card>
      )}
    </div>
  );
}
