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
    <form onSubmit={handleSave} className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 sm:p-6 shadow-xs space-y-6 transition-colors">
      <div className="space-y-3.5">
        <div className="flex items-center gap-2 pb-2 border-b border-slate-100 dark:border-slate-800">
          <div className="p-1.5 rounded-lg bg-blue-50 dark:bg-blue-950/50 text-blue-600 dark:text-blue-400 border border-blue-200/60 dark:border-blue-800/60">
            <Building className="w-3.5 h-3.5" />
          </div>
          <div>
            <h3 className="font-semibold text-slate-900 dark:text-slate-100 text-sm">Entity Information</h3>
            <p className="text-[11px] text-slate-500 dark:text-slate-400">Organization name and official communication address</p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
          <div>
            <label className="block text-slate-700 dark:text-slate-300 font-medium mb-1">Company / Office Name</label>
            <input
              type="text"
              required
              value={companyName}
              onChange={(e) => setCompanyName(e.target.value)}
              className="w-full h-9 bg-slate-50 dark:bg-slate-800/70 border border-slate-200 dark:border-slate-700 rounded-lg px-3 text-xs text-slate-900 dark:text-slate-100 focus:outline-none focus:border-blue-500 font-medium"
            />
          </div>
          <div>
            <label className="block text-slate-700 dark:text-slate-300 font-medium mb-1">Official Administrative Email</label>
            <input
              type="email"
              required
              value={companyEmail}
              onChange={(e) => setCompanyEmail(e.target.value)}
              className="w-full h-9 bg-slate-50 dark:bg-slate-800/70 border border-slate-200 dark:border-slate-700 rounded-lg px-3 text-xs text-slate-900 dark:text-slate-100 font-mono focus:outline-none focus:border-blue-500"
            />
          </div>
        </div>
      </div>

      <div className="pt-4 border-t border-slate-100 dark:border-slate-800 space-y-3.5">
        <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-2 pb-2 border-b border-slate-100 dark:border-slate-800">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-lg bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400 border border-emerald-200/60 dark:border-emerald-800/60">
              <MapPin className="w-3.5 h-3.5" />
            </div>
            <div>
              <h3 className="font-semibold text-slate-900 dark:text-slate-100 text-sm">Physical Office Geofence & Coordinates</h3>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                Set latitude, longitude, and allowed radius for employee check-ins
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {officeLatitude && officeLongitude && (
              <a
                href={`https://www.google.com/maps?q=${officeLatitude},${officeLongitude}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-xs text-blue-600 dark:text-blue-400 font-medium hover:underline bg-blue-50 dark:bg-blue-950/50 border border-blue-200 dark:border-blue-800/60 px-2.5 py-1 rounded-md transition"
              >
                <ExternalLink className="w-3 h-3" /> Map
              </a>
            )}
            <button
              type="button"
              onClick={handleDetectGPS}
              disabled={detectingGps}
              className="inline-flex items-center gap-1.5 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 px-2.5 py-1 rounded-md text-xs font-medium transition cursor-pointer shadow-xs"
            >
              {detectingGps ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Crosshair className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />}
              Detect Location
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
          <div>
            <label className="block text-slate-700 dark:text-slate-300 font-medium mb-1">Office Latitude (GPS)</label>
            <input
              type="text"
              required
              value={officeLatitude}
              onChange={(e) => setOfficeLatitude(e.target.value)}
              placeholder="e.g. 12.916480"
              className="w-full h-9 bg-slate-50 dark:bg-slate-800/70 border border-slate-200 dark:border-slate-700 rounded-lg px-3 text-xs text-slate-900 dark:text-slate-100 font-mono focus:outline-none focus:border-blue-500"
            />
          </div>
          <div>
            <label className="block text-slate-700 dark:text-slate-300 font-medium mb-1">Office Longitude (GPS)</label>
            <input
              type="text"
              required
              value={officeLongitude}
              onChange={(e) => setOfficeLongitude(e.target.value)}
              placeholder="e.g. 77.618145"
              className="w-full h-9 bg-slate-50 dark:bg-slate-800/70 border border-slate-200 dark:border-slate-700 rounded-lg px-3 text-xs text-slate-900 dark:text-slate-100 font-mono focus:outline-none focus:border-blue-500"
            />
          </div>

          <div className="sm:col-span-2 space-y-2 pt-1">
            <div className="flex justify-between items-center">
              <label className="text-slate-700 dark:text-slate-300 font-medium text-xs">Allowed Geofence Radius</label>
              <span className="font-mono font-medium text-xs text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/50 px-2 py-0.5 rounded-md border border-blue-200 dark:border-blue-800/60">
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
              className="w-full h-1.5 bg-slate-200 dark:bg-slate-700 rounded-lg appearance-none cursor-pointer accent-blue-600"
            />
            <div className="flex justify-between text-[11px] text-slate-400 font-medium">
              <span>Strict (20m)</span>
              <span>Standard (100m)</span>
              <span>Campus (500m+)</span>
            </div>
          </div>

          <div className="sm:col-span-2 p-3 bg-slate-50 dark:bg-slate-800/50 rounded-lg border border-slate-200 dark:border-slate-700 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-blue-600 dark:text-blue-400" />
              <div>
                <p className="font-medium text-slate-900 dark:text-slate-100 text-xs">Enforce GPS Geofencing Check</p>
                <p className="text-[11px] text-slate-500 dark:text-slate-400">Block punches if employee is outside the allowed perimeter.</p>
              </div>
            </div>
            <input
              type="checkbox"
              id="enableLocationCheck"
              checked={enableLocationCheck}
              onChange={(e) => setEnableLocationCheck(e.target.checked)}
              className="w-4 h-4 rounded-sm text-blue-600 focus:ring-0 cursor-pointer accent-blue-600"
            />
          </div>
        </div>
      </div>

      <div className="pt-4 border-t border-slate-100 dark:border-slate-800 space-y-3.5">
        <div className="flex items-center gap-2 pb-2 border-b border-slate-100 dark:border-slate-800">
          <div className="p-1.5 rounded-lg bg-amber-50 dark:bg-amber-950/50 text-amber-600 dark:text-amber-400 border border-amber-200/60 dark:border-amber-800/60">
            <Clock className="w-3.5 h-3.5" />
          </div>
          <div>
            <h3 className="font-semibold text-slate-900 dark:text-slate-100 text-sm">Shift Timings & Grace Period Policies</h3>
            <p className="text-[11px] text-slate-500 dark:text-slate-400">Default office shift schedule and late threshold</p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
          <div>
            <label className="block text-slate-700 dark:text-slate-300 font-medium mb-1">Shift Start Time (HH:MM)</label>
            <input
              type="text"
              required
              value={officeStartTime}
              onChange={(e) => setOfficeStartTime(e.target.value)}
              placeholder="11:00"
              className="w-full h-9 bg-slate-50 dark:bg-slate-800/70 border border-slate-200 dark:border-slate-700 rounded-lg px-3 text-xs text-slate-900 dark:text-slate-100 font-mono focus:outline-none focus:border-blue-500"
            />
          </div>

          <div>
            <label className="block text-slate-700 dark:text-slate-300 font-medium mb-1">Shift End Time (HH:MM)</label>
            <input
              type="text"
              required
              value={officeEndTime}
              onChange={(e) => setOfficeEndTime(e.target.value)}
              placeholder="20:00"
              className="w-full h-9 bg-slate-50 dark:bg-slate-800/70 border border-slate-200 dark:border-slate-700 rounded-lg px-3 text-xs text-slate-900 dark:text-slate-100 font-mono focus:outline-none focus:border-blue-500"
            />
          </div>

          <div>
            <label className="block text-slate-700 dark:text-slate-300 font-medium mb-1">Grace Period (Minutes)</label>
            <input
              type="number"
              min="0"
              max="120"
              required
              value={gracePeriodMinutes}
              onChange={(e) => setGracePeriodMinutes(e.target.value)}
              placeholder="15"
              className="w-full h-9 bg-slate-50 dark:bg-slate-800/70 border border-slate-200 dark:border-slate-700 rounded-lg px-3 text-xs text-slate-900 dark:text-slate-100 font-mono focus:outline-none focus:border-blue-500"
            />
          </div>
        </div>
      </div>

      <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex justify-end">
        <button
          type="submit"
          disabled={loading}
          className="h-8 px-3.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-medium text-xs transition flex items-center gap-1.5 shadow-xs disabled:opacity-50 cursor-pointer"
        >
          {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
          Save System Settings
        </button>
      </div>
    </form>
  );
}