import React, { useEffect, useState } from "react";
import { supabase } from "../supabaseClient";

// === Funciones Supabase para Bises ===
async function loadBisesFromSupabase() {
  const { data, error } = await supabase.from('bises').select();
  if (error) {
    alert("Error leyendo bises de Supabase: " + error.message);
    return {};
  }
  // Devuelve un mapa { [class]: { [spec]: url } }
  const map = {};
  data.forEach(row => {
    if (!map[row.class]) map[row.class] = {};
    map[row.class][row.spec] = row.url;
  });
  return map;
}

async function saveBiseToSupabase(cls, spec, url) {
  const { error } = await supabase.from('bises').upsert([{ class: cls, spec, url }], { onConflict: ['class', 'spec'] });
  if (error) alert("Error guardando bises en Supabase: " + error.message);
}

// === Panel de Bises ===
const CLASSES = [
  "Warrior", "Paladin", "Hunter", "Rogue", "Priest", "DeathKnight", "Shaman",
  "Mage", "Warlock", "Monk", "Druid", "DemonHunter", "Evoker"
];
const SPECS = {
  Warrior: ["Arms", "Fury", "Protection"],
  Paladin: ["Holy", "Protection", "Retribution"],
  Hunter: ["Beast Mastery", "Marksmanship", "Survival"],
  Rogue: ["Assassination", "Outlaw", "Subtlety"],
  Priest: ["Discipline", "Holy", "Shadow"],
  DeathKnight: ["Blood", "Frost", "Unholy"],
  Shaman: ["Elemental", "Enhancement", "Restoration"],
  Mage: ["Arcane", "Fire", "Frost"],
  Warlock: ["Affliction", "Demonology", "Destruction"],
  Monk: ["Brewmaster", "Mistweaver", "Windwalker"],
  Druid: ["Balance", "Feral", "Guardian", "Restoration"],
  DemonHunter: ["Havoc", "Vengeance"],
  Evoker: ["Augmentation", "Devastation", "Preservation"]
};
const CLASS_COLORS = {
  Warrior: "#C79C6E", Paladin: "#F58CBA", Hunter: "#ABD473", Rogue: "#FFF569",
  Priest: "#FFFFFF", DeathKnight: "#C41F3B", Shaman: "#0070DE", Mage: "#69CCF0",
  Warlock: "#9482C9", Monk: "#00FF96", Druid: "#FF7D0A", DemonHunter: "#A330C9", Evoker: "#33937F"
};

export default function BisesPanel() {
  const [links, setLinks] = useState({});
  const [dropdown, setDropdown] = useState({ cls: "", spec: "", url: "" });

  useEffect(() => {
    loadBisesFromSupabase().then(setLinks);
  }, []);

  const handleDropdownAdd = async () => {
    if (!dropdown.cls || !dropdown.spec || !dropdown.url) return;
    await saveBiseToSupabase(dropdown.cls, dropdown.spec, dropdown.url);
    const newLinks = await loadBisesFromSupabase();
    setLinks(newLinks);
    setDropdown({ cls: "", spec: "", url: "" });
  };

  return (
    <div>
      <h3 className="text-lg font-semibold mb-2">Bises — Enlaces por Especialización</h3>
      <div className="mb-4 flex flex-wrap gap-2 items-end">
        <div>
          <label className="block text-xs mb-1">Clase</label>
          <select
            className="bg-slate-800 border border-slate-700 rounded px-2 py-1"
            value={dropdown.cls}
            onChange={e => setDropdown({ ...dropdown, cls: e.target.value, spec: "" })}
          >
            <option value="">Selecciona clase</option>
            {CLASSES.map(cls => (
              <option key={cls} value={cls}>{cls}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs mb-1">Especialización</label>
          <select
            className="bg-slate-800 border border-slate-700 rounded px-2 py-1"
            value={dropdown.spec}
            onChange={e => setDropdown({ ...dropdown, spec: e.target.value })}
            disabled={!dropdown.cls}
          >
            <option value="">Selecciona spec</option>
            {dropdown.cls && SPECS[dropdown.cls].map(spec => (
              <option key={spec} value={spec}>{spec}</option>
            ))}
          </select>
        </div>
        <div className="flex-1">
          <label className="block text-xs mb-1">URL</label>
          <input
            className="w-full bg-slate-800 border border-slate-700 rounded px-2 py-1"
            value={dropdown.url}
            onChange={e => setDropdown({ ...dropdown, url: e.target.value })}
            placeholder="https://..."
            disabled={!dropdown.cls || !dropdown.spec}
          />
        </div>
        <button
          className="px-3 py-2 bg-emerald-700 rounded hover:bg-emerald-600 text-white"
          onClick={handleDropdownAdd}
          disabled={!dropdown.cls || !dropdown.spec || !dropdown.url}
        >
          Añadir/Actualizar
        </button>
      </div>
      <div className="flex flex-wrap gap-6">
        {CLASSES.map(cls => (
          <div
            key={cls}
            className="rounded-xl shadow-md p-4 flex-1 min-w-[260px] max-w-xs"
            style={{
              background: `linear-gradient(135deg, ${CLASS_COLORS[cls]}22 0%, #181e29 100%)`,
              border: `2px solid ${CLASS_COLORS[cls]}`
            }}
          >
            <div className="font-bold text-lg mb-2" style={{ color: CLASS_COLORS[cls] }}>{cls}</div>
            <div className="flex flex-col gap-2">
              {SPECS[cls].map(spec => {
                const hasUrl = !!links[cls]?.[spec];
                return (
                  <a
                    key={spec}
                    className="flex-1 px-2 py-1 rounded text-left transition-colors"
                    style={{
                      borderLeft: `4px solid ${CLASS_COLORS[cls]}`,
                      color: hasUrl ? "#181e29" : "#cbd5e1",
                      background: hasUrl ? CLASS_COLORS[cls] : "#23293a",
                      fontWeight: hasUrl ? "bold" : "normal",
                      opacity: hasUrl ? 1 : 0.6,
                      cursor: hasUrl ? "pointer" : "not-allowed",
                      pointerEvents: hasUrl ? "auto" : "none",
                      textDecoration: hasUrl ? "underline" : "none"
                    }}
                    href={hasUrl ? links[cls][spec] : undefined}
                    target={hasUrl ? "_blank" : undefined}
                    rel="noopener noreferrer"
                    title={hasUrl ? "Abrir enlace" : "Sin enlace asignado"}
                  >
                    {spec}
                  </a>
                );
              })}
            </div>
          </div>
        ))}
      </div>
      <div className="text-xs text-slate-400 mt-4">
        Los enlaces se guardan en Supabase y son visibles para todos los usuarios.
      </div>
    </div>
  );
}
