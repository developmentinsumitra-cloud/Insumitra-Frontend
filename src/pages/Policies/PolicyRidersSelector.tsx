import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Plus, Search, X } from 'lucide-react';
import toast from 'react-hot-toast';

export interface AvailableRider {
  id: string;
  name: string;
  label: string;
  category?: string;
  description?: string;
}

const BASE_DEFAULT_RIDERS: AvailableRider[] = [
  { id: 'CRITICAL_ILLNESS', name: 'Critical Illness', label: 'Critical Illness', category: 'Health' },
  { id: 'ACCIDENTAL_DEATH', name: 'Accidental Death Rider', label: 'Accidental Death Rider', category: 'Life' },
  { id: 'ROOM_RENT_WAIVER', name: 'Room Rent Limit Waiver', label: 'Room Rent Limit Waiver', category: 'Health' },
  { id: 'MATERNITY_COVER', name: 'Maternity Cover Option', label: 'Maternity Cover Option', category: 'Health' },
  { id: 'OPD_BENEFIT', name: 'OPD Benefit Rider', label: 'OPD Benefit Rider', category: 'Health' },
  { id: 'WAIVER_OF_PREMIUM', name: 'Waiver of Premium', label: 'Waiver of Premium', category: 'Life' },
];

const normKey = (s?: string) => (s || '').toLowerCase().replace(/[^a-z0-9]/g, '');

export function getAvailablePolicyRiders(
  planId?: string,
  plansList?: any[],
  currentRiders?: string[]
): AvailableRider[] {
  const ridersMap = new Map<string, AvailableRider>();

  const registerRider = (id: string, label: string, category?: string, description?: string) => {
    if (!label || !label.trim()) return;
    const cleanLabel = label.trim();
    const key = normKey(cleanLabel);
    if (!key) return;

    if (!ridersMap.has(key)) {
      ridersMap.set(key, {
        id: id || key,
        name: cleanLabel,
        label: cleanLabel,
        category: category || 'General',
        description: description || '',
      });
    }
  };

  // 1. Base default riders
  BASE_DEFAULT_RIDERS.forEach(r => registerRider(r.id, r.label, r.category));

  // 2. Riders added in Operations -> Riders / Add-ons ('insumitra_master_riders')
  try {
    const rawMaster = localStorage.getItem('insumitra_master_riders');
    if (rawMaster) {
      const parsed = JSON.parse(rawMaster);
      if (Array.isArray(parsed)) {
        parsed.forEach((r: any) => {
          if (r.status !== 'Inactive') {
            registerRider(r.id || r.name, r.name, r.category, r.description);
          }
        });
      }
    }
  } catch {}

  // 3. Riders from Master Dropdowns (Dropdown ID 3 / 'Rider Categories')
  try {
    const rawDropdowns = localStorage.getItem('insumitra_master_dropdowns');
    if (rawDropdowns) {
      const parsed = JSON.parse(rawDropdowns);
      if (Array.isArray(parsed)) {
        const riderMenu = parsed.find((m: any) =>
          m.id === 3 ||
          (m.name && m.name.toLowerCase().includes('rider')) ||
          (m.module && m.module.toLowerCase().includes('rider'))
        );
        if (riderMenu && Array.isArray(riderMenu.options)) {
          riderMenu.options.forEach((opt: string) => {
            registerRider(opt, opt, 'Rider / Add-on');
          });
        }
      }
    }
  } catch {}

  // 4. Riders attached to selected Plan
  if (planId && Array.isArray(plansList)) {
    const plan = plansList.find((p: any) => p.id === planId);
    if (plan) {
      if (Array.isArray(plan.riders)) {
        plan.riders.forEach((r: any) => {
          if (typeof r === 'string') registerRider(r, r, plan.category);
          else if (r?.name) registerRider(r.id || r.name, r.name, plan.category, r.description);
        });
      }
      if (typeof plan.description === 'string' && plan.description.includes('riders')) {
        try {
          const parsed = JSON.parse(plan.description);
          if (Array.isArray(parsed.riders)) {
            parsed.riders.forEach((r: any) => {
              if (typeof r === 'string') registerRider(r, r, plan.category);
              else if (r?.name) registerRider(r.id || r.name, r.name, plan.category, r.description);
            });
          }
        } catch {}
      }
    }
  }

  // 5. Existing riders on policy
  if (Array.isArray(currentRiders)) {
    currentRiders.forEach(r => {
      if (typeof r === 'string' && r.trim()) {
        registerRider(r, r);
      }
    });
  }

  return Array.from(ridersMap.values());
}

export function isRiderChecked(rider: AvailableRider, currentRiders: string[] = []): boolean {
  if (!Array.isArray(currentRiders) || currentRiders.length === 0) return false;
  const targetLabelKey = normKey(rider.label);
  const targetIdKey = normKey(rider.id);
  const targetNameKey = normKey(rider.name);

  return currentRiders.some(r => {
    if (!r) return false;
    if (r === rider.id || r === rider.label || r === rider.name) return true;
    const rKey = normKey(r);
    return rKey === targetLabelKey || rKey === targetIdKey || rKey === targetNameKey;
  });
}

export function toggleRiderItem(
  rider: AvailableRider,
  checked: boolean,
  currentRiders: string[] = []
): string[] {
  const targetLabelKey = normKey(rider.label);
  const targetIdKey = normKey(rider.id);
  const targetNameKey = normKey(rider.name);

  if (checked) {
    const already = currentRiders.some(r => {
      if (r === rider.label || r === rider.id || r === rider.name) return true;
      const rKey = normKey(r);
      return rKey === targetLabelKey || rKey === targetIdKey || rKey === targetNameKey;
    });
    if (already) return currentRiders;
    return [...currentRiders, rider.label];
  } else {
    return currentRiders.filter(r => {
      if (r === rider.label || r === rider.id || r === rider.name) return false;
      const rKey = normKey(r);
      return rKey !== targetLabelKey && rKey !== targetIdKey && rKey !== targetNameKey;
    });
  }
}

export function saveRiderToOperations(name: string, category: string = 'Health', description: string = '') {
  try {
    const raw = localStorage.getItem('insumitra_master_riders');
    let list: any[] = [];
    if (raw) {
      list = JSON.parse(raw);
    }
    const newRider = {
      id: `rider-${Date.now()}`,
      name: name.trim(),
      description: description.trim(),
      category: category || 'Health',
      status: 'Active',
    };
    list = [newRider, ...list];
    localStorage.setItem('insumitra_master_riders', JSON.stringify(list));
    window.dispatchEvent(new CustomEvent('insumitra_riders_updated'));
    return newRider;
  } catch {
    return null;
  }
}

interface PolicyRidersSelectorProps {
  selectedRiders: string[];
  onChange: (newRiders: string[]) => void;
  planId?: string;
  plansList?: any[];
  disabled?: boolean;
}

export const PolicyRidersSelector: React.FC<PolicyRidersSelectorProps> = ({
  selectedRiders,
  onChange,
  planId,
  plansList,
  disabled = false,
}) => {
  const [riders, setRiders] = useState<AvailableRider[]>(() =>
    getAvailablePolicyRiders(planId, plansList, selectedRiders)
  );
  const [searchTerm, setSearchTerm] = useState('');
  const [showAddInline, setShowAddInline] = useState(false);
  const [newRiderName, setNewRiderName] = useState('');

  const refreshRiders = useCallback(() => {
    setRiders(getAvailablePolicyRiders(planId, plansList, selectedRiders));
  }, [planId, plansList, selectedRiders]);

  useEffect(() => {
    refreshRiders();
  }, [refreshRiders]);

  useEffect(() => {
    const handleUpdate = () => {
      refreshRiders();
    };

    window.addEventListener('insumitra_riders_updated', handleUpdate);
    window.addEventListener('insumitra_master_dropdowns_changed', handleUpdate);
    window.addEventListener('storage', handleUpdate);

    return () => {
      window.removeEventListener('insumitra_riders_updated', handleUpdate);
      window.removeEventListener('insumitra_master_dropdowns_changed', handleUpdate);
      window.removeEventListener('storage', handleUpdate);
    };
  }, [refreshRiders]);

  const filteredRiders = useMemo(() => {
    if (!searchTerm.trim()) return riders;
    const q = searchTerm.toLowerCase().trim();
    return riders.filter(
      r =>
        r.label.toLowerCase().includes(q) ||
        (r.category && r.category.toLowerCase().includes(q)) ||
        (r.description && r.description.toLowerCase().includes(q))
    );
  }, [riders, searchTerm]);

  const handleAddNewRider = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newRiderName.trim()) return;
    const created = saveRiderToOperations(newRiderName.trim());
    if (created) {
      toast.success(`Rider "${created.name}" added and synced with Operations`);
      onChange(toggleRiderItem(created as any, true, selectedRiders));
      setNewRiderName('');
      setShowAddInline(false);
      refreshRiders();
    }
  };

  return (
    <div className="flex flex-col gap-1.5 pt-2">
      <div className="flex items-center justify-between mb-1">
        <div className="flex items-center gap-2">
          <label className="label text-[10px] font-extrabold text-slate-900 uppercase tracking-wider block">
            Riders / Addons
          </label>
          <span className="text-[10px] font-bold text-slate-500 bg-slate-200/80 px-2 py-0.5 rounded-full">
            {selectedRiders.length} Selected
          </span>
        </div>

        {!disabled && (
          <div className="flex items-center gap-2">
            {!showAddInline && (
              <button
                type="button"
                onClick={() => setShowAddInline(true)}
                className="text-[10px] font-bold text-blue-600 hover:text-blue-700 flex items-center gap-1 cursor-pointer hover:underline"
              >
                <Plus size={12} /> Add Rider
              </button>
            )}
          </div>
        )}
      </div>

      {showAddInline && !disabled && (
        <form onSubmit={handleAddNewRider} className="flex items-center gap-2 mb-2 p-2 bg-blue-50/70 border border-blue-200 rounded-xl animate-fadeIn">
          <input
            type="text"
            value={newRiderName}
            onChange={(e) => setNewRiderName(e.target.value)}
            placeholder="Enter new rider name..."
            className="input text-xs flex-1 py-1 px-2.5 bg-white border border-blue-300 rounded-lg focus:outline-none"
            autoFocus
          />
          <button
            type="submit"
            className="px-3 py-1 bg-blue-600 text-white text-xs font-bold rounded-lg hover:bg-blue-700 cursor-pointer shadow-xs"
          >
            Add
          </button>
          <button
            type="button"
            onClick={() => { setShowAddInline(false); setNewRiderName(''); }}
            className="p-1 text-slate-400 hover:text-slate-600 cursor-pointer"
          >
            <X size={14} />
          </button>
        </form>
      )}

      {riders.length > 6 && (
        <div className="relative mb-1">
          <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search riders by name..."
            className="w-full text-xs pl-7 pr-7 py-1 rounded-lg border border-slate-200 bg-white focus:outline-none focus:border-blue-500"
          />
          {searchTerm && (
            <button
              type="button"
              onClick={() => setSearchTerm('')}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-0.5"
            >
              <X size={12} />
            </button>
          )}
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 sm:grid-cols-3 gap-2 p-3 bg-slate-50 rounded-xl border border-slate-200 text-xs max-h-56 overflow-y-auto">
        {filteredRiders.map(rider => {
          const isChecked = isRiderChecked(rider, selectedRiders);
          return (
            <label
              key={rider.id}
              className={`flex items-start gap-2 p-1.5 rounded-lg transition-all ${
                disabled ? 'cursor-default' : 'cursor-pointer hover:bg-white/80'
              } ${isChecked ? 'bg-blue-50/70 border border-blue-200/70 font-semibold text-blue-900' : 'text-slate-700'}`}
            >
              <input
                type="checkbox"
                checked={isChecked}
                disabled={disabled}
                onChange={e => {
                  if (disabled) return;
                  const next = toggleRiderItem(rider, e.target.checked, selectedRiders);
                  onChange(next);
                }}
                className={`mt-0.5 rounded border-gray-300 text-blue-600 focus:ring-blue-500 ${
                  disabled ? 'cursor-default opacity-80' : 'cursor-pointer'
                }`}
              />
              <div className="flex-1 min-w-0">
                <span className="text-[11px] block leading-tight break-words">{rider.label}</span>
                {rider.category && rider.category !== 'General' && (
                  <span className="text-[9px] text-slate-400 font-normal block leading-none mt-0.5">
                    {rider.category}
                  </span>
                )}
              </div>
            </label>
          );
        })}

        {filteredRiders.length === 0 && (
          <div className="col-span-full py-3 text-center text-xs text-slate-400 italic">
            No riders match "{searchTerm}".
          </div>
        )}
      </div>
    </div>
  );
};
