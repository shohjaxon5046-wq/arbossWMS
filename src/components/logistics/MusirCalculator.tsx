import { useEffect, useMemo, useState } from 'react';
import { useApp } from '@/contexts/AppContext';
import { calculateMusir, suggestVehicle } from '@/lib/logistics';
import { BreakdownList, StatPill } from '@/components/logistics/Common';
import type { LogisticsPricingData } from '@/types/logistics';

interface Props {
  pricing: LogisticsPricingData;
  onChange: (details: Record<string, unknown>, price: number) => void;
}

export function MusirCalculator({ pricing, onChange }: Props) {
  const { t } = useApp();
  const [typeId, setTypeId] = useState(pricing.waste_types[0]?.id ?? '');
  const [unit, setUnit] = useState<'m3' | 'ton'>('m3');
  const [volume, setVolume] = useState(5);
  const [vehicleId, setVehicleId] = useState('');
  const [km, setKm] = useState(10);
  const [withLoaders, setWithLoaders] = useState(false);
  const [loaders, setLoaders] = useState(2);
  const [floor, setFloor] = useState(1);

  const type = pricing.waste_types.find(wt => wt.id === typeId);
  const vehicles = pricing.waste_vehicles;

  const density = Number(type?.density_ton_m3 ?? 0);
  const volumeM3 = unit === 'm3' ? volume : (density > 0 ? volume / density : volume);
  const tons = unit === 'ton' ? volume : volume * density;

  const suggested = useMemo(() => suggestVehicle(vehicles, volumeM3, tons), [vehicles, volumeM3, tons]);

  const vehicle = vehicles.find(v => v.id === (vehicleId || suggested?.id)) ?? suggested;

  useEffect(() => {
    if (vehicle && !vehicleId) setVehicleId(vehicle.id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [vehicle?.id]);

  const quote = useMemo(
    () => calculateMusir(type, volume, unit, vehicle, km, withLoaders, loaders, floor, pricing.waste_settings, pricing.loader_settings),
    [type, volume, unit, vehicle, km, withLoaders, loaders, floor, pricing.waste_settings, pricing.loader_settings],
  );

  useEffect(() => {
    onChange(
      {
        service: 'musir',
        waste_type: type?.name ?? '',
        volume,
        unit,
        vehicle: vehicle?.name ?? '',
        trips: quote.trips,
        km,
        with_loaders: withLoaders,
        loaders: withLoaders ? loaders : 0,
        floor,
      },
      quote.total,
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [quote.total, quote.trips, quote.tons, vehicle?.id, withLoaders, loaders, unit]);

  const switchUnit = (u: 'm3' | 'ton') => {
    if (u === unit) return;
    if (u === 'ton') setVolume(Math.round(volumeM3 * density * 10) / 10);
    else setVolume(density > 0 ? Math.round((volume / density) * 10) / 10 : volume);
    setUnit(u);
  };

  return (
    <div className="space-y-5">
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-300">{t('wasteType')}</label>
          <select value={typeId} onChange={e => setTypeId(e.target.value)} className="input-field">
            {pricing.waste_types.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
          </select>
        </div>
        <div>
          <label className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-300">{t('volume')}</label>
          <div className="flex gap-2">
            <input type="number" min={0} step={0.1} value={volume} onChange={e => setVolume(Math.max(0, Number(e.target.value) || 0))} className="input-field" />
            <div className="inline-flex rounded-lg bg-slate-100 p-1 dark:bg-slate-800">
              {(['m3', 'ton'] as const).map(u => (
                <button key={u} onClick={() => switchUnit(u)}
                  className={`rounded-md px-3 py-1.5 text-xs font-medium transition-all ${unit === u ? 'bg-white text-slate-900 shadow-sm dark:bg-slate-700 dark:text-white' : 'text-slate-500'}`}>
                  {u === 'm3' ? t('cubicM') : t('tons')}
                </button>
              ))}
            </div>
          </div>
          <p className="mt-1 text-xs text-slate-400">≈ {Math.round((unit === 'm3' ? volumeM3 : tons) * 10) / 10} {t('totalTonnage').toLowerCase()}</p>
        </div>
        <div>
          <label className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-300">{t('vehicle')}</label>
          <select value={vehicle?.id ?? ''} onChange={e => setVehicleId(e.target.value)} className="input-field">
            {vehicles.map(v => <option key={v.id} value={v.id}>{v.name} ({v.capacity_m3} m³ / {v.capacity_ton} t)</option>)}
          </select>
        </div>
        <div>
          <label className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-300">{t('kmToDump')}</label>
          <input type="number" min={0} value={km} onChange={e => setKm(Math.max(0, Number(e.target.value) || 0))} className="input-field" />
        </div>
      </div>

      <div>
        <p className="mb-2 text-sm font-semibold text-slate-700 dark:text-slate-200">{t('loading')}</p>
        <div className="inline-flex rounded-lg bg-slate-100 p-1 dark:bg-slate-800">
          <button onClick={() => setWithLoaders(false)}
            className={`rounded-md px-4 py-2 text-sm font-medium transition-all ${!withLoaders ? 'bg-white text-slate-900 shadow-sm dark:bg-slate-700 dark:text-white' : 'text-slate-500'}`}>
            {t('driverSelf')}
          </button>
          <button onClick={() => setWithLoaders(true)}
            className={`rounded-md px-4 py-2 text-sm font-medium transition-all ${withLoaders ? 'bg-white text-slate-900 shadow-sm dark:bg-slate-700 dark:text-white' : 'text-slate-500'}`}>
            {t('withLoaders')}
          </button>
        </div>
        {withLoaders && (
          <div className="mt-3 grid gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-300">{t('workersNeeded')}</label>
              <input type="number" min={1} value={loaders} onChange={e => setLoaders(Math.max(1, Number(e.target.value) || 1))} className="input-field" />
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-300">{t('etaj')}</label>
              <input type="number" min={1} value={floor} onChange={e => setFloor(Math.max(1, Number(e.target.value) || 1))} className="input-field" />
            </div>
          </div>
        )}
      </div>

      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-2">
          <StatPill label={t('trips')} value={quote.trips} />
          <StatPill label={t('totalTonnage')} value={`${quote.tons} t`} />
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-900">
          <p className="mb-2 text-sm font-semibold text-slate-700 dark:text-slate-200">{t('priceBreakdown')}</p>
          <BreakdownList rows={quote.breakdown} total={quote.total} />
        </div>
      </div>
    </div>
  );
}
