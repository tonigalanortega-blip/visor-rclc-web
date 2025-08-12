import React, { useEffect, useState, useMemo, useRef } from "react";
import BisesPanel from './components/BisesPanel';
import prominenceTitle from './assets/prominence-title.png'; // Ajusta la ruta si es necesario
import { supabase } from './supabaseClient';

// === RCLC auto-loader helpers ===
async function loadJsonPublic(path){
  try {
    const res = await fetch(path, { cache: "no-store" });
    if (res.ok) return await res.json();
  } catch {}
  return null;
}
async function loadRclcManifest(){
  const m = await loadJsonPublic("/rclc/manifest.json");
  if (m && Array.isArray(m.files)) return m.files;
  return null;
}
async function autoloadRclc(tryFiles, addEventsCb){
  const files = (await loadRclcManifest()) || tryFiles;
  let added = [];
  for (const name of files){
    const j = await loadJsonPublic(`/rclc/${name}`);
    if (j) {
      try {
        // usa el mismo extractor del uploader
        const arr = extract(j);
        if (Array.isArray(arr) && arr.length) added = added.concat(arr);
      } catch(e){
        console.warn("No se pudo extraer de", name, e);
      }
    }
  }
  if (added.length) addEventsCb(added);
  return added.length;
}


const WH_CLASS_COLORS = {Warrior:"#C79C6E",Paladin:"#F58CBA",Hunter:"#ABD473",Rogue:"#FFF569",Priest:"#FFFFFF",DeathKnight:"#C41F3B",Shaman:"#0070DE",Mage:"#69CCF0",Warlock:"#9482C9",Monk:"#00FF96",Druid:"#FF7D0A",DemonHunter:"#A330C9",Evoker:"#33937F",Guerrero:"#C79C6E","Paladín":"#F58CBA",Cazador:"#ABD473","Pícaro":"#FFF569",Sacerdote:"#FFFFFF","Caballero de la Muerte":"#C41F3B",Chamán:"#0070DE",Mago:"#69CCF0",Brujo:"#9482C9",Monje:"#00FF96",Druida:"#FF7D0A","Cazador de Demonios":"#A330C9",Evocador:"#33937F"};
const QUALITY_COLORS = {0:"#9d9d9d",1:"#ffffff",2:"#1eff00",3:"#0070dd",4:"#a335ee",5:"#ff8000",6:"#e6cc80"};
const WOWHEAD_SCRIPT = "https://wow.zamimg.com/widgets/power.js";

// === Helper robusto para fechas YYYY/MM/DD o DD/MM/YYYY ===
function parseLogDate(dateStr, timeStr = "00:00:00") {
  if (!dateStr) return null;
  const isoMatch = /^\s*(\d{4})[\/\-](\d{1,2})[\/\-](\d{1,2})\s*$/.exec(dateStr);
  const euMatch  = /^\s*(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})\s*$/.exec(dateStr);
  let Y, M, D;
  if (isoMatch) {
    [, Y, M, D] = isoMatch;
  } else if (euMatch) {
    [, D, M, Y] = euMatch;
  } else {
    return null;
  }
  const [h = "00", mi = "00", s = "00"] = (timeStr || "00:00:00").split(":");
  return new Date(Number(Y), Number(M) - 1, Number(D), Number(h), Number(mi), Number(s));
}


const BOSS_ES_MAP = (()=>{const pairs=[["One-Armed Bandit","Bandido manco"],["Vexie and the Geargrinders","Vexie y los Cadenas"],["Mug'Zee, Heads of Security","Mug'Zee, responsable de seguridad"],["King Chromatic Gallywix","Rey Cromado Gallywix"],["The Amalgam Chamber","La Cámara de Amalgama"],["The Forgotten Experiments","Los experimentos olvidados"],["Kazzara, the Hellforged","Kazzara la Infernoforjada"],["Boss","Jefe"],["Rik Reverberation","Rik Reverberación"],["Stix the Scrapper","Stix Chatarracatre"]];const selfES=["Bandido manco","Caldera de la Carnicería","Kazzara la Infernoforjada","La Cámara de Amalgama","Los experimentos olvidados","Magmorax","Mug'Zee, responsable de seguridad","Piñonero Todolisto","Rey Cromado Gallywix","Rik Reverberación","Stix Chatarracatre","Vexie y los Cadenas","Jefe"];const M=new Map();const nk=(s)=>(s||"").toString().trim().toLowerCase().normalize("NFD").replace(/\p{Diacritic}/gu,"").replace(/[^a-z0-9' ]+/g," ").replace(/\s+/g," ").trim();pairs.forEach(([en,es])=>{M.set(nk(en),es);M.set(nk(es),es);});selfES.forEach(es=>M.set(nk(es),es));return{get:(s)=>M.get(nk(s))||s||""};})();

const classColor=(n)=> WH_CLASS_COLORS[n] || WH_CLASS_COLORS[n?.replace(/\s/g,"")] || "#e2e8f0";
const fmtDate=(d)=>{if(!d)return"";const dd=String(d.getDate()).padStart(2,"0"),mm=String(d.getMonth()+1).padStart(2,"0"),yy=d.getFullYear(),hh=String(d.getHours()).padStart(2,"0"),mi=String(d.getMinutes()).padStart(2,"0");return `${dd}/${mm}/${yy} ${hh}:${mi}`};
const dayKey=(d)=>{if(!d)return"";const dd=String(d.getDate()).padStart(2,"0"),mm=String(d.getMonth()+1).padStart(2,"0"),yy=d.getFullYear();return `${dd}/${mm}/${yy}`};
const parseDate=(v)=>{if(!v)return null;if(typeof v==="number"){const ms=v>1e12?v:v*1000;return new Date(ms);}if(typeof v==="string"){const s=v.trim();if(/^\d+$/.test(s)){const n=Number(s);const ms=n>1e12?n:n*1000;const d=new Date(ms);if(!isNaN(d.getTime()))return d;}let m=s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})(?:\s+(\d{1,2}):(\d{2})(?::(\d{2}))?)?$/);if(m){const[,d,mo,y,hh="0",mm="0",ss="0"]=m;const Y=y.length===2?Number("20"+y):Number(y);return new Date(Y,Number(mo)-1,Number(d),Number(hh),Number(mm),Number(ss));}m=s.match(/^(\d{4})\/(\d{1,2})\/(\d{1,2})(?:\s+(\d{1,2}):(\d{2})(?::(\d{2}))?)?$/);if(m){const[,Y,mo,d,hh="0",mm="0",ss="0"]=m;return new Date(Number(Y),Number(mo)-1,Number(d),Number(hh),Number(mm),Number(ss));}const d1=new Date(s);if(!isNaN(d1.getTime()))return d1;}return null;};
const parseDayKey = (dk) => {
  if (!dk) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(dk)) { const [y,m,d] = dk.split('-').map(Number); return new Date(y, m-1, d); }
  const parts = dk.split('/').map(Number);
  if (parts.length === 3 && parts.every(n => !Number.isNaN(n))) { const [dd,mm,yy] = parts; return new Date(yy, mm-1, dd); }
  return null;
};const fmtDayLong = (dk) => {
  const d = parseDayKey(dk);
  if (!(d instanceof Date) || isNaN(d)) return dk;
  const MESES = ["enero","febrero","marzo","abril","mayo","junio","julio","agosto","septiembre","octubre","noviembre","diciembre"];
  const DIAS = ["domingo","lunes","martes","miércoles","jueves","viernes","sábado"];
  return `${String(d.getDate()).padStart(2,"0")} de ${MESES[d.getMonth()]} de ${d.getFullYear()} · ${DIAS[d.getDay()]}`;
};

const monthKey = (dk) => {
  const d = parseDayKey(dk);
  if (!(d instanceof Date) || isNaN(d)) return "unknown";
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}`;
};

const monthLabel=(k)=>{const [y,m]=k.split("-").map(Number);const MESES=["enero","febrero","marzo","abril","mayo","junio","julio","agosto","septiembre","octubre","noviembre","diciembre"];return `${MESES[(m||1)-1]} ${y}`;}

const looksLoot=(o)=>{if(!o||typeof o!=="object")return false;const ks=Object.keys(o);return ks.some(k=>/item(id|string|link|name)/i.test(k))&&ks.some(k=>/player|winner|receiver/i.test(k));};
function normEvent(r){
  const player=r.player||r.winner||r.receiver||r.candidate||r.unit||r.name;
  let klass=r.class||r.className||r.playerClass; klass=normalizeClass(klass);
  const itemID=r.itemID||r.itemId; const itemString=r.itemString||r.itemLink||r.item; const itemName=r.itemName||r.item||r.name||(typeof r.itemLink==="string"?r.itemLink.replace(/\|c.*\|h\[(.*)\]\|h\|r/,'$1'):undefined);
  const icon=r.icon; const quality=r.quality??r.itemQuality??r.qualityID; const ilvl=r.ilvl||r.itemLevel||r.level||r.iLvl; const slot=r.slot||r.equipLoc||r.inventoryType; const instance=r.instance||r.raid||r.zone||r.map; const boss=BOSS_ES_MAP.get(r.boss||r.encounter||r.npc||r.source); const difficulty=r.difficulty||r.diff||r.difficultyID; const response=r.response||r.awardReason||r.reason; const votes=r.votes; const note=r.note||r.notes; const owner=r.owner||r.awardedBy||r.masterLooter||r.ml;
  const timePrimary=r.servertime||r.timestamp||r.awardTime||r.when;
  const dateObj=parseDateParts(r.date,r.time)||parseDate(timePrimary);
  const ts=dateObj?dateObj.getTime():undefined;
  const providedId=r.id||r.awardId||r.eventId; const id=providedId||(()=>{let h=5381;const s=[providedId||'',ts||'',itemID||itemString||itemName||'',player||'',boss||'',owner||''].join('|');for(let i=0;i<s.length;i++)h=(h*33)^s.charCodeAt(i);return (h>>>0).toString(36)})();
  return {id,ts,date:dateObj,day:dayKey(dateObj),player,class:klass,itemID,itemString,itemName,icon,quality,ilvl,slot,instance,boss,difficulty,response,votes,note,owner,raw:r};
}
function parseDateParts(dateStr,timeStr){ return parseLogDate(dateStr,timeStr) || parseDate(dateStr) || parseDate(timeStr); }
function walk(node,acc){if(!node)return;if(Array.isArray(node)){node.forEach(x=>walk(x,acc));return;}if(typeof node==="object"){if(looksLoot(node))acc.push(normEvent(node));for(const k of Object.keys(node)){const v=node[k];if(v&&(typeof v==="object"||Array.isArray(v)))walk(v,acc);}}}
const extract=(obj)=>{const out=[];walk(obj,out);return out};
const isAssigned=(e)=>{const r=(e.response||"").toLowerCase();const looks=/auto|self|personal|despo|loot|greed|need|ninjaloot/.test(r);return !!e.owner&&!looks};

// === WCL logs (localStorage) ===
// Elimina las funciones antiguas de localStorage para logs
//// const LOGS_STORAGE_KEY="rclc_logs_by_day";
//// const loadLogsMap=()=>{try{return JSON.parse(localStorage.getItem(LOGS_STORAGE_KEY))||{};}catch{return {}}};
//// const saveLogsMap=(map)=>{try{localStorage.setItem(LOGS_STORAGE_KEY,JSON.stringify(map));}catch{}};
//// const setLogForDate=(dayKey,url)=>{const m=loadLogsMap();if(!url||!String(url).trim()) delete m[dayKey]; else m[dayKey]=String(url).trim();saveLogsMap(m);};
//// const getLogForDate = (dayKey) => wclogsMap[dayKey] || null;
function isValidWclUrl(url){try{const u=new URL(url);return /warcraftlogs\./i.test(u.hostname);}catch{return false;}}

// === Parser pegado masivo WCL ===
function parseBulkWcl(text, dayGroups) {
  const lines = String(text).split(/\r?\n/).map(l => l.trim()).filter(Boolean);
  const knownDays = new Set(dayGroups.flatMap(g => g.days));
  const items = [];
  for (const line of lines) {
    const urlMatch = line.match(/https?:\/\/[\w.-]*warcraftlogs\.com\/reports\/[A-Za-z0-9]+[^\s]*/i);
    if (!urlMatch) continue;
    const url = urlMatch[0].trim();
    let dateKey = null;
    try {
      const u = new URL(url);
      const searchStart = u.searchParams.get("start") || u.searchParams.get("s");
      const hashStart = u.hash ? new URLSearchParams(u.hash.replace(/^#/, "")).get("start") : null;
      const start = searchStart || hashStart;
      if (start && /^\d{10,13}$/.test(start)) {
        const ms = start.length === 13 ? Number(start) : Number(start) * 1000;
        const d = new Date(ms);
        const y = d.getFullYear();
        const m = String(d.getMonth() + 1).padStart(2, "0");
        const da = String(d.getDate()).padStart(2, "0");
        const iso = `${y}-${m}-${da}`;
        const eu = `${da}/${m}/${y}`;
        if (knownDays.has(iso)) dateKey = iso; else if (knownDays.has(eu)) dateKey = eu;
      }
    } catch {}
    if (!dateKey) {
      let head = line.split(/[;\s]+/)[0];
      if (!/^\d/.test(head) && line.includes(";")) head = line.split(";")[0].trim();
      const ddmmyyyy = head.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
      const yyyymmdd = head.match(/^(\d{4})-(\d{2})-(\d{2})$/);
      if (ddmmyyyy) {
        const [, dd, mm, yyyy] = ddmmyyyy; const iso = `${yyyy}-${mm}-${dd}`; const eu = `${dd}/${mm}/${yyyy}`;
        if (knownDays.has(iso)) dateKey = iso; else if (knownDays.has(eu)) dateKey = eu;
      } else if (yyyymmdd) {
        const [, yyyy, mm, dd] = yyyymmdd; const iso = `${yyyy}-${mm}-${dd}`; const eu = `${dd}/${mm}/${yyyy}`;
        if (knownDays.has(iso)) dateKey = iso; else if (knownDays.has(eu)) dateKey = eu;
      }
    }
    items.push({ url, dateKey });
  }
  return items;
}

/* ===== Menú desplegable simple ===== */
function Menu({label, items}) {
  const [open,setOpen]=useState(false);
  return (
    <div className="relative">
      <button
        onClick={()=>setOpen(o=>!o)}
        className="h-8 px-3 rounded-md border border-slate-700 bg-slate-800 hover:bg-slate-700 text-sm"
      >
        {label} ⌄
      </button>
      {open && (
        <div className="absolute right-0 mt-1 min-w-40 rounded-md border border-slate-700 bg-slate-900 shadow-xl z-50">
          {items.map((it,idx)=>(
            <button
              key={idx}
              onClick={()=>{it.onClick(); setOpen(false);}}
              className="w-full text-left px-3 py-2 text-sm hover:bg-slate-800"
            >
              {it.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/* ===== Selector por meses (colapsable) ===== */
function LogsMonthPicker({ dayGroups, selectedDays, onChange }) {
  const [open, setOpen] = React.useState(() => new Set(dayGroups[0] ? [dayGroups[0].key] : []));
  React.useEffect(() => { setOpen(new Set(dayGroups[0] ? [dayGroups[0].key] : [])); }, [dayGroups.length]);

  const sel = new Set(selectedDays);
  const monthAllSelected = (g) => g.days.every(dk => sel.has(dk));
  const monthSomeSelected = (g) => !monthAllSelected(g) && g.days.some(dk => sel.has(dk));
  const toggleMonthAll = (g) => {
    const n = new Set(sel);
    const all = monthAllSelected(g);
    g.days.forEach(dk => { if (all) n.delete(dk); else n.add(dk); });
    onChange(Array.from(n));
  };
  const toggleDay = (dk) => {
    const n = new Set(sel);
    if (n.has(dk)) n.delete(dk); else n.add(dk);
    onChange(Array.from(n));
  };
  const clearAll = () => onChange([]);
  const selectAll = () => onChange(dayGroups.flatMap(g => g.days));
  const toggleOpen = (key) => {
    const n = new Set(open);
    n.has(key) ? n.delete(key) : n.add(key);
    setOpen(n);
  };

  return (
    <div className="rounded-xl border border-slate-700 bg-slate-900/60">
      <div className="flex items-center justify-between px-2 py-1 border-b border-slate-800">
        <div className="text-sm text-slate-300">Días de raid (multi)</div>
        <div className="flex gap-2">
          <button onClick={clearAll} className="px-2 py-1 rounded bg-slate-700 hover:bg-slate-600 text-xs">Limpiar</button>
          <button onClick={selectAll} className="px-2 py-1 rounded bg-slate-700 hover:bg-slate-600 text-xs">Seleccionar todo</button>
        </div>
      </div>

      <ul className="max-h-[16vh] overflow-auto pretty-scroll">
        {dayGroups.map(g => {
          const all = monthAllSelected(g);
          const some = monthSomeSelected(g);
          return (
            <li key={g.key} className="border-b border-slate-800">
              <div className="flex items-center gap-2 px-2 py-1 bg-slate-900">
                <input
                  type="checkbox"
                  checked={all}
                  ref={el => { if (el) el.indeterminate = some; }}
                  onChange={()=>toggleMonthAll(g)}
                />
                <button className="flex-1 text-left" onClick={()=>toggleOpen(g.key)}>
                  {g.label}
                </button>
                <span className="text-xs text-slate-400">{g.days.length}</span>
              </div>
              {open.has(g.key) && (
                <ul className="bg-slate-800">
                  {g.days.map(dk => (
                    <li key={dk} className="flex items-center gap-2 px-5 py-1 border-t border-slate-700">
                      <input type="checkbox" checked={sel.has(dk)} onChange={()=>toggleDay(dk)} />
                      <span className="text-xs">{fmtDayLong(dk)}</span>
                    </li>
                  ))}
                </ul>
              )}
            </li>
          );
        })}
      </ul>

      <div className="px-2 py-1 text-[11px] text-slate-400 border-t border-slate-800">
        Marca el mes completo o despliega para elegir días individuales.
      </div>
    </div>
  );
}

/* ===== Panel derecho: lista de Warcraft Logs por día ===== */
function WclLinksPanel({ dayGroups, onOpenEditor }) {
  const allDays = dayGroups.flatMap(g => g.days);
  return (
    <div className="rounded-xl border border-slate-700 bg-slate-900/60">
      <div className="flex items-center justify-between px-2 py-1 border-b border-slate-800">
        <div className="text-sm text-slate-300">Warcraft Logs</div>
        <button
          onClick={()=>onOpenEditor(allDays[0]||"")}
          className="px-2 py-1 rounded bg-slate-700 hover:bg-slate-600 text-xs"
        >
          Editar…
        </button>
      </div>

      <ul className="max-h-[16vh] overflow-auto pretty-scroll">
        {dayGroups.map(g=>(
          <li key={g.key} className="border-b border-slate-800">
            <div className="px-2 py-1 text-xs text-slate-400">{g.label}</div>
            {g.days.map(dk=>{
              const url = getLogForDate(dk);
              return (
                <div key={dk} className="flex items-center gap-2 px-3 py-1 border-t border-slate-800">
                  <div className="flex-1 text-xs">{fmtDayLong(dk)}</div>
                  {url ? (
                    <>
                      <a href={url} target="_blank" rel="noreferrer" className="text-sky-300 hover:text-sky-200 text-xs">Abrir</a>
                      <button className="text-xs px-2 py-0.5 rounded bg-slate-700 hover:bg-slate-600"
                              onClick={()=>onOpenEditor(dk)}>Cambiar</button>
                    </>
                  ) : (
                    <>
                      <span className="text-[11px] text-slate-500">Sin enlace</span>
                      <button className="text-xs px-2 py-0.5 rounded bg-slate-700 hover:bg-slate-600"
                              onClick={()=>onOpenEditor(dk)}>Añadir</button>
                    </>
                  )}
                </div>
              );
            })}
          </li>
        ))}
      </ul>

      <div className="px-2 py-1 text-[11px] text-slate-400 border-t border-slate-800">
        Gestiona los enlaces de cada día de raid.
      </div>
    </div>
  );
}

export default function App(){
  const [events,setEvents]=useState([]);
  const [search,setSearch]=useState("");
  const [instance,setInstance]=useState("");
  const [boss,setBoss]=useState("");
  const [player,setPlayer]=useState("");
  const [klass,setKlass]=useState("");
  const [quality,setQuality]=useState("");
  const [slot,setSlot]=useState("");
  const [dateFrom,setDateFrom]=useState("");
  const [dateTo,setDateTo]=useState("");
  const [selectedDays,setSelectedDays]=useState([]);
  const [hideSelfLoot,setHideSelfLoot]=useState(true);

  
  const [showTop,setShowTop]=useState(false);const [tab,setTab]=useState("summary");
  const [isWclOpen,setIsWclOpen]=useState(false);
  const [wclDate,setWclDate]=useState("");
  const [wclUrl,setWclUrl]=useState("");
  const [isBulkOpen,setIsBulkOpen]=useState(false);
  const [bulkText,setBulkText]=useState("");
  const [bulkPreview,setBulkPreview]=useState([]);
  const [bulkDefaultDate,setBulkDefaultDate]=useState("");

  const fileRef=useRef(null);

    // Autocargar RCLC desde /public/rclc si no hay datos en local
  useEffect(()=>{
    (async ()=>{
      try{
        if (Array.isArray(events) && events.length) return;
        const tried = await autoloadRclc(
          ["dataset.json","config.json","items.json","raids.json","rclc.json","logs.json"],
          addEvents
        );
        if (!tried) {
          console.info("Sin datos en /public/rclc — la app queda vacía hasta que subas JSON o añadas manifest.json");
        }
      }catch(e){ console.warn("Autoload RCLC falló", e); }
    })();
  },[events?.length]);

  useEffect(()=>{if(!document.querySelector(`script[src='${WOWHEAD_SCRIPT}']`)){const s=document.createElement('script');s.src=WOWHEAD_SCRIPT;s.defer=true;document.body.appendChild(s);}const t=setTimeout(()=>{if(window.$WowheadPower){try{window.$WowheadPower.refreshLinks();}catch{}}},300);return()=>clearTimeout(t);},[events,tab]);
  useEffect(()=>{
    const onScroll = () => setShowTop(window.scrollY > 200);
    window.addEventListener("scroll", onScroll, { passive: true });
    onScroll();
    return () => window.removeEventListener("scroll", onScroll);
  },[]);


  const addEvents=(arr)=>{const map=new Map();[...events,...arr].forEach(e=>map.set(e.id,e));const merged=[...map.values()].sort((a,b)=>(a.ts||0)-(b.ts||0));setEvents(merged);};
  const onFiles = async (files) => {
  let added = [];
  for (const f of files) {
    try {
      const text = await (typeof f.text === 'function' ? f.text() : new Response(f).text());
      const parsed = JSON.parse(text);
      let arr = [];
      if (Array.isArray(parsed)) {
        arr = parsed;
      } else if (parsed && Array.isArray(parsed.entries)) {
        arr = parsed.entries;
      } else if (parsed && Array.isArray(parsed.data)) {
        arr = parsed.data;
      } else {
        throw new Error('Estructura no soportada (se esperaba un array JSON).');
      }
      if (!arr.length) throw new Error('El archivo no contiene elementos.');
      // Normaliza los eventos aquí:
      added = added.concat(arr.map(normEvent));
    } catch (e) {
      alert(`Error al importar ${f.name}: ${e.message || e}`);
      console.error('Import error', f.name, e);
    }
  }
  if (added.length) {
    await saveEventsToSupabase(added);
    const nuevos = await loadEventsFromSupabase();
    setEvents(Array.isArray(nuevos) ? nuevos : []);
  }
};

  const opts=useMemo(()=>{const U=(a)=>Array.from(new Set(a.filter(Boolean))).sort((a,b)=>{const da=parseDate(a),db=parseDate(b);if(da&&db)return da-db;return String(a).localeCompare(String(b));});return {instances:U(events.map(e=>e.instance)),bosses:U(events.map(e=>e.boss)),players:U(events.map(e=>e.player)),classes:U(events.map(e=>e.class)),slots:U(events.map(e=>e.slot)),qualities:U(events.map(e=>e.quality)),days:Array.from(new Set(events.map(e=>e.day).filter(Boolean))).sort((a,b)=>parseDayKey(a)-parseDayKey(b))};},[events]);

  const dayGroups = useMemo(()=> {
    const groups = new Map();
    for(const dk of opts.days){
      const mk = monthKey(dk);
      if(!groups.has(mk)) groups.set(mk, []);
      groups.get(mk).push(dk);
    }
    const arr = Array.from(groups.entries()).sort((a,b)=> a[0].localeCompare(b[0]));
    return arr.map(([k,days])=> ({ key:k, label:monthLabel(k), days: days.sort((a,b)=>parseDayKey(a)-parseDayKey(b)) }));
  }, [opts.days]);

  const filtered=useMemo(()=>{const s=search.toLowerCase();const fromMs=dateFrom?new Date(dateFrom).getTime():-Infinity;const toMs=dateTo?new Date(dateTo).getTime()+24*3600*1000-1:Infinity;const daySet=new Set(selectedDays);
    return events.filter(e=>{
      if(hideSelfLoot&&!isAssigned(e))return false;
      if(e.ts&&(e.ts<fromMs||e.ts>toMs))return false;
      if(daySet.size&&!daySet.has(e.day))return false;
      if(instance&&e.instance!==instance)return false;
      if(boss&&e.boss!==boss)return false;
      if(player&&e.player!==player)return false;
      if(klass&&e.class!==klass)return false;
      if(quality!==""&&String(e.quality)!==String(quality))return false;
      if(slot&&e.slot!==slot)return false;
      if(s){const hay=[e.itemName,e.player,e.instance,e.boss,e.note,e.owner].join(" ").toLowerCase();if(!hay.includes(s))return false;}
      return true;
    });
  },[events,search,instance,boss,player,klass,quality,slot,dateFrom,dateTo,selectedDays,hideSelfLoot]);

  const summary=useMemo(()=>{const byDay=new Map();for(const e of filtered){const k=e.day||"Sin fecha";if(!byDay.has(k))byDay.set(k,[]);byDay.get(k).push(e);}const rows=Array.from(byDay.entries()).map(([day,arr])=>{const bosses=new Set(arr.map(x=>x.boss).filter(Boolean));const inst=new Set(arr.map(x=>x.instance).filter(Boolean));return {day,count:arr.length,bosses:bosses.size,instances:[...inst].join(", ")};}).sort((a,b)=>parseDayKey(a.day)-parseDayKey(b.day));return {byDay,rows};},[filtered]);

  const exportCSV=()=>{const headers=["day","datetime","instance","boss","difficulty","itemID","itemName","ilvl","quality","slot","player","class","response","votes","note","awardedBy"];const esc=(v)=>{if(v==null)return"";const s=String(v).replaceAll('"','""');return /[",\n]/.test(s)?'"'+s+'"':s};const lines=[headers.join(',')];filtered.forEach(r=>lines.push([r.day,fmtDate(r.date),r.instance,r.boss,r.difficulty,r.itemID,r.itemName,r.ilvl,r.quality,r.slot,r.player,r.class,r.response,r.votes,r.note,r.owner].map(esc).join(',')));const b=new Blob([lines.join('\n')],{type:"text/plain;charset=utf-8"});const u=URL.createObjectURL(b);const a=document.createElement("a");a.href=u;a.download=`rclc_filtrado_${new Date().toISOString().slice(0,10)}.csv`;a.click();URL.revokeObjectURL(u);};
  const exportJSON=()=>{const b=new Blob([JSON.stringify(filtered,null,2)],{type:"application/json"});const u=URL.createObjectURL(b);const a=document.createElement("a");a.href=u;a.download=`rclc_filtrado_${new Date().toISOString().slice(0,10)}.json`;a.click();URL.revokeObjectURL(u);};
  const clearAll = () => {
    if (confirm("¿Borrar todos los datos cargados?")) {
      setEvents([]);
    }
  };

  function openWclFor(dayKeySel){
    if(!dayKeySel) return;
    setWclDate(dayKeySel);
    setWclUrl(wclogsMap[dayKeySel] || "");
    setIsWclOpen(true);
  }
  function handleOpenWcl(){
    const firstDay = (selectedDays && selectedDays[0]) || (dayGroups && dayGroups[0]?.days?.[0]) || "";
    openWclFor(firstDay);
  }
  function handleSaveWcl(){
    if(!wclDate) { alert("Selecciona una fecha de raid."); return; }
    if(!isValidWclUrl(wclUrl)) { alert("Pon una URL válida de Warcraft Logs."); return; }
    setLogForDate(wclDate, wclUrl);
    setIsWclOpen(false);
  }
  function handleBulkPreview() {
    const entries = parseBulkWcl(bulkText, dayGroups);
    const defDate = bulkDefaultDate;
    const withDefaults = entries.map(e => ({...e, dateKey: e.dateKey || defDate || ""}));
    setBulkPreview(withDefaults);
  }
  async function handleBulkSave() {
    const toSave = (bulkPreview && bulkPreview.length ? bulkPreview : parseBulkWcl(bulkText, dayGroups)).filter(e => e.url && e.dateKey);
    if (!toSave.length) { alert("No hay enlaces para guardar."); return; }
    for (const e of toSave) {
      await saveWclogToSupabase(e.dateKey, e.url);
    }
    const map = await loadWclogsFromSupabase();
    setWclogsMap(map);
    setIsBulkOpen(false);
  }

  const [wclogsMap, setWclogsMap] = useState({});
  useEffect(()=>{
    loadWclogsFromSupabase().then(setWclogsMap);
  }, [events]);

  const setLogForDate = async (dayKey, url) => {
    await saveWclogToSupabase(dayKey, url);
    const map = await loadWclogsFromSupabase();
    setWclogsMap(map);
  };
  const getLogForDate = (dayKey) => wclogsMap[dayKey] || null;

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100">
      {/* scrollbars bonitos para los contenedores .pretty-scroll */}
      <style>{`
        :root{ --sb-bg:#0f172a; --sb-thumb:#475569; --sb-thumb-hover:#64748b; }
        .pretty-scroll{ scrollbar-width: thin; scrollbar-color: var(--sb-thumb) var(--sb-bg); }
        .pretty-scroll::-webkit-scrollbar{ width:10px; height:10px; }
        .pretty-scroll::-webkit-scrollbar-track{ background:var(--sb-bg); border-radius:9999px; }
        .pretty-scroll::-webkit-scrollbar-thumb{ background:var(--sb-thumb); border-radius:9999px; border:2px solid var(--sb-bg); }
        .pretty-scroll::-webkit-scrollbar-thumb:hover{ background:var(--sb-thumb-hover); }
      `}</style>

      <header className="relative z-20 backdrop-blur bg-slate-900/80 border-b border-slate-800 py-3">
        <div className="mx-auto px-3 py-1 max-w-none">
          <div className="flex items-center gap-3">
            <img
              src={prominenceTitle}
              alt="Prominence"
              style={{ maxHeight: 80, width: "auto" }}
              className="block"
            />
            <nav className="ml-1 flex gap-1 text-xs">
              {[["summary","Resumen"],["byraid","Detalle por día"],["players","Por jugador"],["items","Por ítem"],["timeline","Timeline"],["bises","Bises"]].map(([k,l])=> (
                <button key={k} onClick={()=>setTab(k)} className={`h-8 px-3 rounded-full border ${tab===k?"bg-slate-100 text-slate-900 border-slate-100":"border-slate-700 hover:bg-slate-800"}`}>{l}</button>
              ))}
            </nav>

            {/* Acciones agrupadas a la derecha */}
            <div className="ml-auto flex items-center gap-2">
              <Menu
                label="Datos"
                items={[
                  {label:"Subir JSON RCLC (múltiple)", onClick:()=>fileRef.current?.click()},
                ]}
              />
              <Menu
                label="WCL"
                items={[
                  {label:"Añadir enlace WCL", onClick:()=>handleOpenWcl()},
                  {label:"Pegar enlaces WCL (auto)", onClick:()=>{setIsBulkOpen(true); setBulkText(""); setBulkPreview([]);}},
                ]}
              />
              <Menu
                label="Exportar"
                items={[
                  {label:"CSV", onClick:exportCSV},
                  {label:"JSON", onClick:exportJSON},
                ]}
              />
              <button onClick={clearAll} className="h-8 px-3 rounded-md bg-rose-600 hover:bg-rose-500 text-sm">Borrar datos</button>
              <input ref={fileRef} type="file" multiple accept=".json" className="hidden" onChange={(e)=> onFiles(Array.from(e.target.files||[]))} />
            </div>
          </div>

          {/* Fila 1: buscador + filtros + fechas + checkbox (Calidad/Slot SUBIDOS AQUÍ) */}
          <div className="mt-1 grid grid-cols-2 md:grid-cols-12 gap-1 text-sm">
            <input className="px-3 h-8 bg-slate-800 rounded-md border border-slate-700 col-span-2 md:col-span-3" placeholder="Buscar texto… (item, jugador, boss)" value={search} onChange={(e)=>setSearch(e.target.value)} />
            <select className="px-3 h-8 bg-slate-800 rounded-md border border-slate-700" value={instance} onChange={(e)=>setInstance(e.target.value)}>
              <option value="">Instancia</option>{opts.instances.map(v=> <option key={v} value={v}>{v}</option>)}
            </select>
            <select className="px-3 h-8 bg-slate-800 rounded-md border border-slate-700" value={boss} onChange={(e)=>setBoss(e.target.value)}>
              <option value="">Jefe</option>{opts.bosses.map(v=> <option key={v} value={v}>{v}</option>)}
            </select>
            <select className="px-3 h-8 bg-slate-800 rounded-md border border-slate-700" value={player} onChange={(e)=>setPlayer(e.target.value)}>
              <option value="">Jugador</option>{opts.players.map(v=> <option key={v} value={v}>{v}</option>)}
            </select>
            <select className="px-3 h-8 bg-slate-800 rounded-md border border-slate-700" value={klass} onChange={(e)=>setKlass(e.target.value)}>
              <option value="">Clase</option>{opts.classes.map(v=> <option key={v} value={v}>{v}</option>)}
            </select>

            {/* NUEVO arriba */}
            <select className="px-3 h-8 bg-slate-800 rounded-md border border-slate-700" value={quality} onChange={(e)=>setQuality(e.target.value)}>
              <option value="">Calidad</option>{opts.qualities.map(v=> <option key={v} value={v}>{v}</option>)}
            </select>
            <select className="px-3 h-8 bg-slate-800 rounded-md border border-slate-700" value={slot} onChange={(e)=>setSlot(e.target.value)}>
              <option value="">Slot</option>{opts.slots.map(v=> <option key={v} value={v}>{v}</option>)}
            </select>

            <input type="date" className="px-3 h-8 bg-slate-800 rounded-md border border-slate-700" value={dateFrom} onChange={(e)=>setDateFrom(e.target.value)} />
            <input type="date" className="px-3 h-8 bg-slate-800 rounded-md border border-slate-700" value={dateTo} onChange={(e)=>setDateTo(e.target.value)} />

            <label className="col-span-2 md:col-span-2 flex items-center gap-2 text-xs text-slate-300">
              <input type="checkbox" checked={hideSelfLoot} onChange={(e)=> setHideSelfLoot(e.target.checked)} />
              Ocultar botín no asignado / despojo directo
            </label>
          </div>

          {/* Fila 2: dos cuadros 50/50 */}
          <div className="mt-1 grid grid-cols-2 md:grid-cols-12 gap-2 text-sm items-start">
            {/* Izquierda: Días de raid */}
            <div className="col-span-2 md:col-span-6">
              <div className="rounded-xl border border-slate-700 bg-slate-900/80 shadow-lg p-2 max-h-[22vh] overflow-auto pretty-scroll">
                <LogsMonthPicker dayGroups={dayGroups} selectedDays={selectedDays} onChange={setSelectedDays} />
              </div>
            </div>

            {/* Derecha: Panel WCL */}
            <div className="col-span-2 md:col-span-6">
              <div className="rounded-xl border border-slate-700 bg-slate-900/80 shadow-lg p-2 max-h-[22vh] overflow-auto pretty-scroll">
                <WclLinksPanel dayGroups={dayGroups} onOpenEditor={openWclFor} />
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* WCL Modal */}
      {isWclOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center">
          <div className="bg-slate-900 border border-slate-700 rounded-xl p-4 w-[min(420px,92vw)] shadow-xl">
            <h3 className="text-lg font-semibold mb-3">Asociar Warcraft Logs</h3>
            <label className="block text-sm text-slate-300 mb-1">Fecha de raid</label>
            <select value={wclDate} onChange={(e)=>{
                setWclDate(e.target.value);
                setWclUrl(wclogsMap[e.target.value]||"");
              }} className="w-full px-3 py-2 bg-slate-800 rounded-md border border-slate-700 mb-3">
              {dayGroups.map(g=> (
                <optgroup key={g.key} label={g.label}>
                  {g.days.map(v=> <option key={v} value={v}>{fmtDayLong(v)}</option>)}
                </optgroup>
              ))}
            </select>
            <label className="block text-sm text-slate-300 mb-1">URL de Warcraft Logs</label>
            <input value={wclUrl} onChange={(e)=>setWclUrl(e.target.value)} placeholder="https://www.warcraftlogs.com/reports/XXXXXX" className="w-full px-3 py-2 bg-slate-800 rounded-md border border-slate-700" />
            <div className="flex justify-end gap-2 mt-4">
              <button onClick={()=>setIsWclOpen(false)} className="px-3 py-2 rounded-md bg-slate-700 hover:bg-slate-600">Cancelar</button>
              <button onClick={handleSaveWcl} className="px-3 py-2 rounded-md bg-amber-600 hover:bg-amber-500">Guardar</button>
            </div>
          </div>
        </div>
      )}

      {/* Bulk WCL Modal */}
      {isBulkOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center">
          <div className="bg-slate-900 border border-slate-700 rounded-xl p-4 w-[min(720px,96vw)] shadow-xl">
            <h3 className="text-lg font-semibold mb-3">Pegar enlaces WCL (auto)</h3>
            <div className="grid md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm text-slate-300 mb-1">Fecha por defecto (opcional)</label>
                <select value={bulkDefaultDate} onChange={(e)=>setBulkDefaultDate(e.target.value)} className="w-full px-3 py-2 bg-slate-800 rounded-md border border-slate-700 mb-3">
                  <option value="">— Sin fecha por defecto —</option>
                  {dayGroups.map(g=> (
                    <optgroup key={g.key} label={g.label}>
                      {g.days.map(v=> <option key={v} value={v}>{fmtDayLong(v)}</option>)}
                    </optgroup>
                  ))}
                </select>
                <label className="block text-sm text-slate-300 mb-1">Enlaces (uno por línea). Puedes anteponer fecha: DD/MM/YYYY;URL o YYYY-MM-DD URL</label>
                <textarea value={bulkText} onChange={(e)=>setBulkText(e.target.value)} rows={10} className="w-full px-3 py-2 bg-slate-800 rounded-md border border-slate-700"></textarea>
              </div>
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm text-slate-300">Previsualización</span>
                  <button onClick={handleBulkPreview} className="px-2 py-1 rounded-md bg-slate-700 hover:bg-slate-600 text-sm">Previsualizar</button>
                </div>
                <div className="space-y-2 max-h-64 overflow-auto pr-1 pretty-scroll">
                  {(bulkPreview||[]).map((e,idx)=> (
                    <div key={idx} className="p-2 bg-slate-800 rounded border border-slate-700">
                      <div className="text-xs break-all">{e.url}</div>
                      <div className="mt-2 flex items-center gap-2">
                        <span className="text-xs text-slate-400">Fecha:</span>
                        <select value={e.dateKey||""} onChange={(ev) => {
                              const v = ev.target.value;
                              setBulkPreview(prev => prev.map((it,i) => i === idx ? ({ ...it, dateKey: v }) : it));
                            }} className="px-2 py-1 bg-slate-900 rounded border border-slate-700 text-sm">
                          <option value="">— Elegir —</option>
                          {dayGroups.map(g=> (
                            <optgroup key={g.key} label={g.label}>
                              {g.days.map(v=> <option key={v} value={v}>{fmtDayLong(v)}</option>)}
                            </optgroup>
                          ))}
                        </select>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
            <div className="flex justify-end gap-2 mt-4">
              <button onClick={()=>setIsBulkOpen(false)} className="px-3 py-2 rounded-md bg-slate-700 hover:bg-slate-600">Cancelar</button>
              <button onClick={handleBulkSave} className="px-3 py-2 rounded-md bg-amber-600 hover:bg-amber-500">Guardar todos</button>
            </div>
          </div>
        </div>
      )}

      <main className="mx-auto p-3 max-w-none">
        
      {/* Aviso: arranque sin datos */}
      {(!events || events.length===0) && (
        <div className="mt-3 text-xs text-amber-300">
          Sin datos cargados. Puedes subir JSON desde <b>Datos → “Subir JSON RCLC”</b> o colocar tus archivos en <code>/public/rclc</code> (opcionalmente crea <code>manifest.json</code> con {"{"}"files":["...json"]{"}"}).
        </div>
      )}
{tab==="summary" && <SummaryPanel summary={summary} />}
        {tab==="byraid" && <ByRaidPanel summary={summary} />}
        {tab==="players" && <PlayersPanel rows={filtered} />}
        {tab==="items" && <ItemsPanel rows={filtered} />}
        {tab==="timeline" && <Timeline rows={filtered} />}
      </main>

      {showTop && (
        <button
          onClick={()=> window.scrollTo({ top: 0, behavior: "smooth" })}
          aria-label="Volver arriba"
          title="Volver arriba"
          className="fixed bottom-5 right-5 z-50 h-11 w-11 rounded-full border border-slate-700 bg-slate-800/90 hover:bg-slate-700 shadow-lg backdrop-blur flex items-center justify-center"
        >
          <span className="text-xl leading-none">↑</span>
        </button>
      )}

      {tab==="bises" && (
        <section className="mt-4">
          <BisesPanel />
        </section>
      )}

      <footer className="mx-auto px-3 py-5 text-xs text-slate-400 max-w-none">
        Consejo: pasa el ratón por el nombre del ítem para ver el tooltip de Wowhead.
      </footer>
    </div>
  );
}

/* ====== UI secundarios ====== */
function Empty({onPick}){return <div className="border border-dashed border-slate-700 rounded-2xl p-10 text-center bg-slate-800/40"><h2 className="text-2xl font-semibold mb-2">Sube tu export JSON de RCLootCouncil</h2><p className="text-slate-300 mb-6">Admite varias subidas; fusiona y deduplica automáticamente. Solo uso local (navegador).</p><button onClick={onPick} className="px-4 py-2 rounded-md bg-amber-600 hover:bg-amber-500">Elegir archivos</button></div>;}
function Pill({children,tone="default"}){const cls={default:"bg-slate-800 text-slate-200 border-slate-700",good:"bg-emerald-900/40 text-emerald-200 border-emerald-800",info:"bg-sky-900/40 text-sky-200 border-sky-800"}[tone];return <span className={`px-2 py-0.5 rounded-full text-xs border ${cls}`}>{children}</span>;}
const PlayerCell=({name,klass})=>{const color=classColor(klass);return <div className="flex items-center gap-2"><div className="w-2 h-2 rounded-full" style={{backgroundColor:color}}/><span style={{color}}>{name||"—"}</span></div>};
function ItemCell({e}){const base=QUALITY_COLORS[e.quality];const fallback=e.itemID?"#a335ee":"#e2e8f0";const q=base||fallback;const hasId=e.itemID&&Number(e.itemID)>0;const iconSrc=e.icon? (e.icon.startsWith("http")?e.icon:(e.icon.includes("/")?e.icon:`https://wow.zamimg.com/images/wow/icons/medium/${e.icon}.jpg`)):null;return <div className="flex items-center gap-2">{iconSrc&&<img src={iconSrc} alt="ico" className="w-6 h-6 rounded" />}{hasId?<a href={`https://www.wowhead.com/item=${e.itemID}`} data-wowhead={`item=${e.itemID}`} className="hover:underline" style={{color:q}} target="_blank">{e.itemName||`Ítem ${e.itemID}`}</a>:<span style={{color:q}}>{e.itemName||e.itemString||"Ítem"}</span>}{e.ilvl?<Pill tone="info">iLvl {e.ilvl}</Pill>:null}</div>}

const USERS = [
  { user: "Kromgol", pass: "Kromgol", role: "admin" },
  { user: "Prominence", pass: "Oficial123456", role: "user" }
];

function SummaryPanel({ summary }) {
  const [openDay, setOpenDay] = useState(null);
  return (
    <div className="space-y-6">
      <div className="rounded-2xl overflow-hidden border border-slate-700">
        <table className="w-full text-sm">
          <thead className="bg-slate-800/80">
            <tr className="text-left">
              <th className="p-3">Día</th>
              <th className="p-3">Instancias</th>
              <th className="p-3">Jefes</th>
              <th className="p-3">Objetos</th>
            </tr>
          </thead>
          <tbody>
            {summary.rows.map((r) => (
              <React.Fragment key={r.day}>
                <tr className="border-t border-slate-800 cursor-pointer hover:bg-slate-800/40" onClick={()=> setOpenDay(openDay===r.day?null:r.day)}>
                  <td className="p-3 font-medium">
                    <span className="inline-flex items-center gap-2">
                      {fmtDayLong(r.day)}
                      {getLogForDate(r.day) && (
                        <a href={getLogForDate(r.day)} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-sky-300 hover:text-sky-200">
                          <img src="data:image/png;base64,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" alt="Warcraft Logs" width="16" height="16" />
                          <span className="text-xs">Logs</span>
                        </a>
                      )}
                    </span>
                  </td>
                  <td className="p-3 text-slate-300">{r.instances || "—"}</td>
                  <td className="p-3">{r.bosses}</td>
                  <td className="p-3">{r.count}</td>
                </tr>
                {openDay===r.day && (
                  <tr className="border-t border-slate-800 bg-slate-800/30">
                    <td colSpan={4} className="p-0">
                      <DayBreakdown rows={summary.byDay.get(r.day) || []} />
                    </td>
                  </tr>
                )}
              </React.Fragment>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
function DayBreakdown({ rows }) {
  return (
    <div className="p-3">
      <table className="w-full text-xs">
        <thead className="bg-slate-800/60">
          <tr className="text-left">
            <th className="p-2">Hora</th>
            <th className="p-2">Instancia</th>
            <th className="p-2">Jefe</th>
            <th className="p-2">Objeto</th>
            <th className="p-2">Jugador</th>
            <th className="p-2">Resp./Votos</th>
            <th className="p-2">Nota</th>
            <th className="p-2">Otorgado por</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((e)=>(
            <tr key={e.id} className="border-t border-slate-800">
              <td className="p-2 whitespace-nowrap">{fmtDate(e.date)}</td>
              <td className="p-2">{e.instance || "—"}</td>
              <td className="p-2">{e.boss || "—"}</td>
              <td className="p-2"><ItemCell e={e} /></td>
              <td className="p-2"><PlayerCell name={e.player} klass={e.class} /></td>
              <td className="p-2">{e.response || "—"}{typeof e.votes==="number"?` (${e.votes})`:""}</td>
              <td className="p-2 text-slate-300">{e.note || ""}</td>
              <td className="p-2">{e.owner || "—"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
function ByRaidPanel({summary}){return <div className="space-y-8">{Array.from(summary.byDay.entries()).map(([day,arr])=> (<div key={day} className="rounded-2xl border border-slate-700 overflow-hidden"><div className="px-4 py-2 bg-slate-800/70 flex items-center gap-3"><div className="text-lg font-semibold">{fmtDayLong(day)}</div><Pill tone="info">{new Set(arr.map(e=>e.boss).filter(Boolean)).size} jefes</Pill><Pill tone="good">{arr.length} objetos</Pill></div><table className="w-full text-sm"><thead className="bg-slate-800/50"><tr className="text-left"><th className="p-3">Hora</th><th className="p-3">Instancia</th><th className="p-3">Jefe</th><th className="p-3">Objeto</th><th className="p-3">Jugador</th><th className="p-3">Resp./Votos</th><th className="p-3">Nota</th><th className="p-3">Otorgado por</th></tr></thead><tbody>{arr.map(e=> <tr key={e.id} className="border-t border-slate-800"><td className="p-3 whitespace-nowrap">{fmtDate(e.date)}</td><td className="p-3">{e.instance||"—"}</td><td className="p-3">{e.boss||"—"}</td><td className="p-3"><ItemCell e={e}/></td><td className="p-3"><PlayerCell name={e.player} klass={e.class} /></td><td className="p-3">{e.response||"—"}{typeof e.votes==="number"?` (${e.votes})`:""}</td><td className="p-3 text-slate-300">{e.note||""}</td><td className="p-3">{e.owner||"—"}</td></tr>)}</tbody></table></div>))}</div>;}
function PlayersPanel({rows}){const now=Date.now();const players=useMemo(()=>{const m=new Map();for(const e of rows){const k=e.player||"(desconocido)";if(!m.has(k))m.set(k,{player:k,class:e.class,items:[],lastTs:0});m.get(k).items.push(e);if(!m.get(k).class&&e.class)m.get(k).class=e.class;if(e.ts&&e.ts>m.get(k).lastTs)m.get(k).lastTs=e.ts;}return Array.from(m.values()).map(p=>({...p,lastDate:p.lastTs?new Date(p.lastTs):null,daysSince:p.lastTs?Math.floor((now-p.lastTs)/(24*3600*1000)):Infinity,count:p.items.length}));},[rows]);const [order,setOrder]=useState("longest_no_loot");const sorted=useMemo(()=>{const a=[...players];switch(order){case"name_az":a.sort((x,y)=>x.player.localeCompare(y.player));break;case"class":a.sort((x,y)=>(x.class||"").localeCompare(y.class||""));break;case"most_items":a.sort((x,y)=>y.count-x.count);break;case"fewest_items":a.sort((x,y)=>x.count-y.count);break;case"shortest_no_loot":a.sort((x,y)=>x.daysSince-y.daysSince);break;default:a.sort((x,y)=>y.daysSince-x.daysSince);}return a;},[players,order]);return <div className="space-y-4"><div className="flex items-center gap-1 text-sm"><span className="text-slate-300">Ordenar por:</span><select className="px-3 py-2 bg-slate-800 rounded-md border border-slate-700" value={order} onChange={(e)=>setOrder(e.target.value)}><option value="longest_no_loot">Más tiempo sin loot</option><option value="shortest_no_loot">Menos tiempo sin loot</option><option value="name_az">Nombre (A→Z)</option><option value="class">Clase</option><option value="most_items">Más objetos</option><option value="fewest_items">Menos objetos</option></select></div>{sorted.map(p=> (<div key={p.player} className="rounded-2xl border border-slate-700 overflow-hidden"><div className="px-4 py-2 bg-slate-800/70 flex items-center gap-3"><PlayerCell name={p.player} klass={p.class}/><Pill tone="good">{p.count} objetos</Pill><Pill tone="info">Último loot: {p.lastDate?fmtDate(p.lastDate):"—"}</Pill><Pill>Hace {p.daysSince===Infinity?"—":`${p.daysSince} días`}</Pill></div><table className="w-full text-sm"><thead className="bg-slate-800/50"><tr className="text-left"><th className="p-3">Fecha</th><th className="p-3">Instancia/Jefe</th><th className="p-3">Objeto</th><th className="p-3">Resp./Votos</th><th className="p-3">Nota</th><th className="p-3">Otorgado por</th></tr></thead><tbody>{p.items.map(e=> <tr key={e.id} className="border-t border-slate-800"><td className="p-3 whitespace-nowrap">{fmtDate(e.date)}</td><td className="p-3">{e.instance||"—"}{e.boss?` · ${e.boss}`:""}</td><td className="p-3"><ItemCell e={e}/></td><td className="p-3">{e.response||"—"}{typeof e.votes==="number"?` (${e.votes})`:""}</td><td className="p-3 text-slate-300">{e.note||""}</td><td className="p-3">{e.owner||"—"}</td></tr>)}</tbody></table></div>))}</div>;}
function ItemsPanel({rows}){const byItem=useMemo(()=>{const m=new Map();for(const e of rows){const k=e.itemID||e.itemName||e.id;if(!m.has(k))m.set(k,{key:k,name:e.itemName,id:e.itemID,icon:e.icon,quality:e.quality,rows:[]});m.get(k).rows.push(e);if(!m.get(k).name&&e.itemName)m.get(k).name=e.itemName;if(!m.get(k).id&&e.itemID)m.get(k).id=e.itemID;}return Array.from(m.values()).sort((a,b)=>b.rows.length-a.rows.length);},[rows]);return <div className="space-y-6">{byItem.map(it=> (<div key={it.key} className="rounded-2xl border border-slate-700 overflow-hidden"><div className="px-4 py-2 bg-slate-800/70 flex items-center gap-4"><div className="flex items-center gap-2">{it.icon&&<img src={it.icon.startsWith('http')?it.icon:(it.icon.includes('/')?it.icon:`https://wow.zamimg.com/images/wow/icons/medium/${it.icon}.jpg`)} alt="ico" className="w-6 h-6 rounded"/>}<a href={it.id?`https://www.wowhead.com/item=${it.id}`:"#"} data-wowhead={it.id?`item=${it.id}`:undefined} className="font-medium hover:underline" style={{color:QUALITY_COLORS[it.quality]||"#a335ee"}}>{it.name||`(item ${it.id||it.key})`}</a></div><Pill tone="good">{it.rows.length} veces</Pill></div><table className="w-full text-sm"><thead className="bg-slate-800/50"><tr className="text-left"><th className="p-3">Fecha</th><th className="p-3">Instancia/Jefe</th><th className="p-3">Ganador</th><th className="p-3">Resp./Votos</th><th className="p-3">Nota</th></tr></thead><tbody>{it.rows.map(e=> <tr key={e.id} className="border-t border-slate-800"><td className="p-3 whitespace-nowrap">{fmtDate(e.date)}</td><td className="p-3">{e.instance||"—"}{e.boss?` · ${e.boss}`:""}</td><td className="p-3"><PlayerCell name={e.player} klass={e.class} /></td><td className="p-3">{e.response||"—"}{typeof e.votes==="number"?` (${e.votes})`:""}</td><td className="p-3 text-slate-300">{e.note||""}</td></tr>)}</tbody></table></div>))}</div>;}
function Timeline({rows}){const sorted=[...rows].sort((a,b)=>(a.ts||0)-(b.ts||0));return <div className="space-y-4">{sorted.map(e=> (<div key={e.id} className="flex items-center gap-3 p-3 rounded-xl bg-slate-800 border border-slate-700"><div className="w-28 text-xs text-slate-300">{fmtDate(e.date)}</div><div className="flex-1"><div className="text-sm text-slate-200"><span className="mr-2">{e.instance||'Instancia'}{e.boss?` · ${e.boss}`:""}</span><ItemCell e={e}/></div></div><div className="w-48"><PlayerCell name={e.player} klass={e.class} /></div><div className="w-48 text-sm">{e.response||"—"}{typeof e.votes==="number"?` (${e.votes})`:""}</div><div className="w-40 text-xs text-slate-300">{e.owner||""}</div></div>))}</div>;}
/* ===== Bises Panel (Wowhead embeds) ===== */
const CLASS_COLORS = {
  Warrior: "#C79C6E", Paladin: "#F58CBA", Hunter: "#ABD473", Rogue: "#FFF569",
  Priest: "#FFFFFF", DeathKnight: "#C41E3A", Shaman: "#0070DE", Mage: "#40C7EB",
  Warlock: "#8788EE", Monk: "#00FF96", Druid: "#FF7D0A", DemonHunter: "#A330C9",
  Evoker: "#33937F"
};
const WH_SPECS = {
  Warrior: ["Arms","Fury","Protection"], Paladin: ["Holy","Protection","Retribution"],
  Hunter: ["Beast Mastery","Marksmanship","Survival"], Rogue: ["Assassination","Outlaw","Subtlety"],
  Priest: ["Discipline","Holy","Shadow"], DeathKnight: ["Blood","Frost","Unholy"],
  Shaman: ["Elemental","Enhancement","Restoration"], Mage: ["Arcane","Fire","Frost"],
  Warlock: ["Affliction","Demonology","Destruction"], Monk: ["Brewmaster","Mistweaver","Windwalker"],
  Druid: ["Balance","Feral","Guardian","Restoration"], DemonHunter: ["Havoc","Vengeance"],
  Evoker: ["Augmentation","Devastación","Preservación"]};
const WH_BIS_URLS = {
  "Warrior": {
    "Arms": "https://www.wowhead.com/warcraft/guide/classes/warrior/arms/gear",
    "Fury": "https://www.wowhead.com/warcraft/guide/classes/warrior/fury/gear",
    "Protection": "https://www.wowhead.com/warcraft/guide/classes/warrior/protection/gear"
  },
  "Paladin": {
    "Holy": "https://www.wowhead.com/warcraft/guide/classes/paladin/holy/gear",
    "Protection": "https://www.wowhead.com/warcraft/guide/classes/paladin/protection/gear",
    "Retribution": "https://www.wowhead.com/warcraft/guide/classes/paladin/retribution/gear"
  },
  "Hunter": {
    "Beast Mastery": "https://www.wowhead.com/warcraft/guide/classes/hunter/beast-mastery/gear",
    "Marksmanship": "https://www.wowhead.com/warcraft/guide/classes/hunter/marksmanship/gear",
    "Survival": "https://www.wowhead.com/warcraft/guide/classes/hunter/survival/gear"
  },
  "Rogue": {
    "Assassination": "https://www.wowhead.com/warcraft/guide/classes/rogue/assassination/gear",
    "Outlaw": "https://www.wowhead.com/warcraft/guide/classes/rogue/outlaw/gear",
    "Subtlety": "https://www.wowhead.com/warcraft/guide/classes/rogue/subtlety/gear"
  },
  "Priest": {
    "Discipline": "https://www.wowhead.com/warcraft/guide/classes/priest/discipline/gear",
    "Holy": "https://www.wowhead.com/warcraft/guide/classes/priest/holy/gear",
    "Shadow": "https://www.wowhead.com/warcraft/guide/classes/priest/shadow/gear"
  },
  "DeathKnight": {
    "Blood": "https://www.wowhead.com/warcraft/guide/classes/death-knight/blood/gear",
    "Frost": "https://www.wowhead.com/warcraft/guide/classes/death-knight/frost/gear",
    "Unholy": "https://www.wowhead.com/warcraft/guide/classes/death-knight/unholy/gear"
  },
  "Shaman": {
    "Elemental": "https://www.wowhead.com/warcraft/guide/classes/shaman/elemental/gear",
    "Enhancement": "https://www.wowhead.com/warcraft/guide/classes/shaman/enhancement/gear",
    "Restoration": "https://www.wowhead.com/warcraft/guide/classes/shaman/restoration/gear"
  },
  "Mage": {
    "Arcane": "https://www.wowhead.com/warcraft/guide/classes/mage/arcane/gear",
    "Fire": "https://www.wowhead.com/warcraft/guide/classes/mage/fire/gear",
    "Frost": "https://www.wowhead.com/warcraft/guide/classes/mage/frost/gear"
  },
  "Warlock": {
    "Affliction": "https://www.wowhead.com/warcraft/guide/classes/warlock/affliction/gear",
    "Demonology": "https://www.wowhead.com/warcraft/guide/classes/warlock/demonology/gear",
    "Destruction": "https://www.wowhead.com/warcraft/guide/classes/warlock/destruction/gear"
  },
  "Monk": {
    "Brewmaster": "https://www.wowhead.com/warcraft/guide/classes/monk/brewmaster/gear",
    "Mistweaver": "https://www.wowhead.com/warcraft/guide/classes/monk/mistweaver/gear",
    "Windwalker": "https://www.wowhead.com/warcraft/guide/classes/monk/windwalker/gear"
  },
  "Druid": {
    "Balance": "https://www.wowhead.com/warcraft/guide/classes/druid/balance/gear",
    "Feral": "https://www.wowhead.com/warcraft/guide/classes/druid/feral/gear",
    "Guardian": "https://www.wowhead.com/warcraft/guide/classes/druid/guardian/gear",
    "Restoration": "https://www.wowhead.com/warcraft/guide/classes/druid/restoration/gear"
  },
  "DemonHunter": {
    "Havoc": "https://www.wowhead.com/warcraft/guide/classes/demon-hunter/havoc/gear",
    "Vengeance": "https://www.wowhead.com/warcraft/guide/classes/demon-hunter/vengeance/gear"
  },
  "Evoker": {
    "Augmentation": "https://www.wowhead.com/warcraft/guide/classes/evoker/augmentation/gear",
    "Devastación": "https://www.wowhead.com/warcraft/guide/classes/evoker/devastacion/gear",
    "Preservación": "https://www.wowhead.com/warcraft/guide/classes/evoker/preservacion/gear"
  }};
function normalizeClass(str) {
  if (!str) return "";
  return String(str).replace(/\s/g, "").replace(/^\w/, c => c.toUpperCase());
}

// Guarda cada evento como un registro en la tabla events
async function saveEventsToSupabase(events) {
  // Puedes guardar varios a la vez
  const { data, error } = await supabase.from('events').insert(
    events.map(e => ({
      data: e, // Guarda el evento completo como JSON
    }))
  );
  if (error) {
    alert("Error guardando en Supabase: " + error.message);
  }
}

async function loadEventsFromSupabase() {
  const { data, error } = await supabase.from('events').select();
  if (error) {
    alert("Error leyendo de Supabase: " + error.message);
    return [];
  }
  // data es un array de objetos con la columna 'data'
  return data.map(row => row.data);
}

// === Cargar eventos desde Supabase al iniciar ===
useEffect(()=>{
  loadEventsFromSupabase().then(setEvents);
},[]);

// === Warcraft Logs en Supabase ===
async function saveWclogToSupabase(date_key, url) {
  const { error } = await supabase.from('wclogs').upsert([{ date_key, url }], { onConflict: ['date_key'] });
  if (error) alert("Error guardando WCL en Supabase: " + error.message);
}

async function loadWclogsFromSupabase() {
  const { data, error } = await supabase.from('wclogs').select();
  if (error) {
    alert("Error leyendo WCL de Supabase: " + error.message);
    return {};
  }
  const map = {};
  data.forEach(row => { map[row.date_key] = row.url; });
  return map;
}

useEffect(()=>{
  loadWclogsFromSupabase().then(setWclogsMap);
}, [events]);