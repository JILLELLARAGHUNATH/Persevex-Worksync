'use client';

import React, { useEffect, useState } from 'react';
import { 
  MapPin, 
  Crosshair, 
  Save, 
  ExternalLink, 
  Clock, 
  Building, 
  ShieldCheck, 
  Loader2 
} from 'lucide-react';
import { toast } from 'sonner';

export interface OfficeSettingsProps {
  initialConfig?: any;
  userRole?: string;
}

export default function OfficeSettingsClient({ initialConfig, userRole }: OfficeSettingsProps = {}) {
  const [loading, setLoading] = useState(false);
  const [detectingGps, setDetectingGps] = useState(false);

  const [companyName, setCompanyName] = useState(initialConfig?.companyName || 'PERSEVEX Enterprise');
  const [companyEmail, setCompanyEmail] = useState(initialConfig?.companyEmail || 'admin@persevex.com');
  const [officeStartTime, setOfficeStartTime] = useState(initialConfig?.officeStartTime || '11:00');
  const [officeEndTime, setOfficeEndTime] = useState(initialConfig?.officeEndTime || '20:00');
  const [gracePeriodMinutes, setGracePeriodMinutes] = useState(String(initialConfig?.gracePeriodMinutes ?? 15));

  const [officeLatitude, setOfficeLatitude] = useState(initialConfig?.officeLatitude || '12.916480');
  const [officeLongitude, setOfficeLongitude] = useState(initialConfig?.officeLongitude || '77.618145');
  const [officeRadiusMeters, setOfficeRadiusMeters] = useState(initialConfig?.officeRadiusMeters || '100');
  const [enableLocationCheck, setEnableLocationCheck] = useState<boolean>(initialConfig?.enableLocationCheck ?? true);

  useEffect(() => {
    if (!initialConfig) {
      (async () => {
        try {
          const res = await fetch('/api/admin-office-settings');
          const json = await res.json();
          if (json?.success && json.data) {
            const s = json.data;
            if (s.companyName) setCompanyName(s.companyName);
            if (s.companyEmail) setCompanyEmail(s.companyEmail);
            if (s.officeStartTime) setOfficeStartTime(s.officeStartTime);
            if (s.officeEndTime) setOfficeEndTime(s.officeEndTime);
            if (typeof s.gracePeriodMinutes !== 'undefined') setGracePeriodMinutes(String(s.gracePeriodMinutes));
            if (s.officeLatitude) setOfficeLatitude(String(s.officeLatitude));
            if (s.officeLongitude) setOfficeLongitude(String(s.officeLongitude));
            if (s.officeRadiusMeters) setOfficeRadiusMeters(String(s.officeRadiusMeters));
            if (typeof s.enableLocationCheck !== 'undefined') setEnableLocationCheck(Boolean(s.enableLocationCheck));
          }
        } catch (err) {
          console.error('Failed to load office settings', err);
        }
      })();
    }
  }, [initialConfig]);

  const handleDetectGPS = () => {
    if (!navigator.geolocation) {
      toast.error('Geolocation is not supported by your browser.');
      return;
    }

    setDetectingGps(true);

    const onPosSuccess = (pos: GeolocationPosition) => {
      setOfficeLatitude(pos.coords.latitude.toFixed(6));
      setOfficeLongitude(pos.coords.longitude.toFixed(6));
      setDetectingGps(false);
      toast.success('Current GPS coordinates captured!');
    };

    const onPosError = (err: GeolocationPositionError) => {
      if (err.code === 1) {
        setDetectingGps(false);
        toast.error('Location permission denied. Click the lock icon in your browser URL bar to allow location.');
        return;
      }

      navigator.geolocation.getCurrentPosition(
        onPosSuccess,
        (fallbackErr: GeolocationPositionError) => {
          setDetectingGps(false);
          if (fallbackErr.code === 1) {
            toast.error('Location permission denied in browser.');
          } else {
            toast.error('Location unavailable. You can enter Latitude and Longitude manually.');
          }
        },
        { enableHighAccuracy: false, timeout: 15000, maximumAge: 60000 }
      );
    };

    navigator.geolocation.getCurrentPosition(onPosSuccess, onPosError, {
      enableHighAccuracy: true,
      timeout: 10000,
      maximumAge: 60000,
    });
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const payload = {
        companyName,
        companyEmail,
        officeStartTime,
        officeEndTime,
        gracePeriodMinutes: Number(gracePeriodMinutes) || 15,
        officeLatitude: officeLatitude || null,
        officeLongitude: officeLongitude || null,
        officeRadiusMeters: officeRadiusMeters || '100',
        enableLocationCheck,
      };

      const res = await fetch('/api/admin-office-settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const json = await res.json();
      if (!json?.success) {
        toast.error(json?.error || 'Failed to update settings');
      } else {
        toast.success('Office location & timing settings updated live!');
      }
    } catch (err) {
      console.error('Save error:', err);
      toast.error('Network error while saving settings');
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSave} className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 sm:p-8 shadow-sm dark:shadow-xl space-y-8 transition-colors">
      <div className="space-y-4">
        <h3 className="font-extrabold text-slate-900 dark:text-white flex items-center gap-2 text-sm">
          <Building className="w-4 h-4 text-indigo-600 dark:text-indigo-400" /> Corporate Entity Information
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
          <div>
            <label className="block text-slate-700 dark:text-slate-300 font-semibold mb-1.5">Company / Office Name</label>
            <input
              type="text"
              required
              value={companyName}
              onChange={(e) => setCompanyName(e.target.value)}
              className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl p-3 text-slate-900 dark:text-white focus:border-indigo-500"
            />
          </div>
          <div>
            <label className="block text-slate-700 dark:text-slate-300 font-semibold mb-1.5">Official Administrative Email</label>
            <input
              type="email"
              required
              value={companyEmail}
              onChange={(e) => setCompanyEmail(e.target.value)}
              className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl p-3 text-slate-900 dark:text-white font-mono focus:border-indigo-500"
            />
          </div>
        </div>
      </div>

      <div className="pt-6 border-t border-slate-100 dark:border-slate-800 space-y-4">
        <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-3">
          <div>
            <h3 className="font-extrabold text-slate-900 dark:text-white flex items-center gap-2 text-sm">
              <MapPin className="w-4 h-4 text-emerald-600 dark:text-emerald-400" /> Physical Office Geofence & Coordinates
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Set the exact latitude, longitude, and allowed radius for employee attendance punches.
            </p>
          </div>

          <div className="flex items-center gap-2">
            {officeLatitude && officeLongitude && (
              <a
                href={`https://www.google.com/maps?q=${officeLatitude},${officeLongitude}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 text-xs text-indigo-600 dark:text-indigo-400 font-semibold hover:underline bg-indigo-500/10 border border-indigo-500/20 px-3 py-1.5 rounded-xl transition"
              >
                <ExternalLink className="w-3.5 h-3.5" /> View on Google Maps
              </a>
            )}
            <button
              type="button"
              onClick={handleDetectGPS}
              disabled={detectingGps}
              className="inline-flex items-center gap-1.5 bg-slate-100 dark:bg-slate-950 hover:bg-slate-200 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-300 dark:border-slate-800 px-3 py-1.5 rounded-xl text-xs font-semibold transition"
            >
              {detectingGps ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Crosshair className="w-3.5 h-3.5 text-emerald-500" />}
              Detect My Current Location
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
          <div>
            <label className="block text-slate-700 dark:text-slate-300 font-semibold mb-1.5">Office Latitude (GPS)</label>
            <input
              type="text"
              required
              value={officeLatitude}
              onChange={(e) => setOfficeLatitude(e.target.value)}
              placeholder="e.g. 12.916480"
              className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl p-3 text-slate-900 dark:text-white font-mono focus:border-indigo-500"
            />
          </div>
          <div>
            <label className="block text-slate-700 dark:text-slate-300 font-semibold mb-1.5">Office Longitude (GPS)</label>
            <input
              type="text"
              required
              value={officeLongitude}
              onChange={(e) => setOfficeLongitude(e.target.value)}
              placeholder="e.g. 77.618145"
              className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl p-3 text-slate-900 dark:text-white font-mono focus:border-indigo-500"
            />
          </div>

          <div className="sm:col-span-2 space-y-2">
            <div className="flex justify-between items-center">
              <label className="text-slate-700 dark:text-slate-300 font-semibold">Allowed Geofence Radius (Meters)</label>
              <span className="font-mono font-bold text-xs text-indigo-600 dark:text-indigo-400 bg-indigo-500/10 px-2.5 py-0.5 rounded-lg border border-indigo-500/20">
                {officeRadiusMeters} meters (~{(Number(officeRadiusMeters) / 1000).toFixed(2)} km)
              </span>
            </div>
            <input
              type="range"
              min="20"
              max="2000"
              step="10"
              value={officeRadiusMeters}
              onChange={(e) => setOfficeRadiusMeters(e.target.value)}
              className="w-full h-2 bg-slate-200 dark:bg-slate-800 rounded-lg appearance-none cursor-pointer accent-indigo-600"
            />
            <div className="flex justify-between text-[11px] text-slate-400">
              <span>Strict (20m - Room level)</span>
              <span>Standard Office (100m)</span>
              <span>Large Campus / Tech Park (500m+)</span>
            </div>
          </div>

          <div className="sm:col-span-2 p-3.5 bg-slate-50 dark:bg-slate-950 rounded-2xl border border-slate-200 dark:border-slate-800 flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <ShieldCheck className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
              <div>
                <p className="font-bold text-slate-900 dark:text-white text-xs">Enforce GPS Geofencing Check</p>
                <p className="text-[11px] text-slate-500 dark:text-slate-400">Block punches if employee coordinates exceed the allowed office perimeter.</p>
              </div>
            </div>
            <input
              type="checkbox"
              id="enableLocationCheck"
              checked={enableLocationCheck}
              onChange={(e) => setEnableLocationCheck(e.target.checked)}
              className="w-4 h-4 rounded text-indigo-600 focus:ring-0 cursor-pointer"
            />
          </div>
        </div>
      </div>

      <div className="pt-6 border-t border-slate-100 dark:border-slate-800 space-y-4">
        <h3 className="font-extrabold text-slate-900 dark:text-white flex items-center gap-2 text-sm">
          <Clock className="w-4 h-4 text-amber-600 dark:text-amber-400" /> Shift Timings & Grace Period Policies
        </h3>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
          <div>
            <label className="block text-slate-700 dark:text-slate-300 font-semibold mb-1.5">Shift Start Time (HH:MM)</label>
            <input
              type="text"
              required
              value={officeStartTime}
              onChange={(e) => setOfficeStartTime(e.target.value)}
              placeholder="11:00"
              className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl p-3 text-slate-900 dark:text-white font-mono focus:border-indigo-500"
            />
          </div>

          <div>
            <label className="block text-slate-700 dark:text-slate-300 font-semibold mb-1.5">Shift End Time (HH:MM)</label>
            <input
              type="text"
              required
              value={officeEndTime}
              onChange={(e) => setOfficeEndTime(e.target.value)}
              placeholder="20:00"
              className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl p-3 text-slate-900 dark:text-white font-mono focus:border-indigo-500"
            />
          </div>

          <div>
            <label className="block text-slate-700 dark:text-slate-300 font-semibold mb-1.5">Grace Period (Minutes)</label>
            <input
              type="number"
              min="0"
              max="120"
              required
              value={gracePeriodMinutes}
              onChange={(e) => setGracePeriodMinutes(e.target.value)}
              placeholder="15"
              className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl p-3 text-slate-900 dark:text-white font-mono focus:border-indigo-500"
            />
          </div>
        </div>
      </div>

      <div className="pt-6 border-t border-slate-100 dark:border-slate-800 flex justify-end">
        <button
          type="submit"
          disabled={loading}
          className="bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-xs font-bold px-6 py-3 rounded-xl transition shadow-md shadow-indigo-600/30 flex items-center gap-2"
        >
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
          Save System & Geofence Policies
        </button>
      </div>
    </form>
  );
}