import React, { useEffect, useState } from 'react';
import { Globe } from 'lucide-react';

const COMMON_TIMEZONES = [
  'UTC',
  'America/New_York',
  'America/Chicago',
  'America/Denver',
  'America/Los_Angeles',
  'America/Toronto',
  'America/Sao_Paulo',
  'Europe/London',
  'Europe/Paris',
  'Europe/Berlin',
  'Europe/Amsterdam',
  'Asia/Dubai',
  'Asia/Kolkata',
  'Asia/Singapore',
  'Asia/Hong_Kong',
  'Asia/Tokyo',
  'Australia/Sydney',
  'Pacific/Auckland',
];

export default function TimezoneSelect({ value, onChange }) {
  const [searchTerm, setSearchTerm] = useState('');

  // Auto-detect browser time zone on mount if unset
  useEffect(() => {
    if (!value || value === 'UTC') {
      try {
        const detected = Intl.DateTimeFormat().resolvedOptions().timeZone;
        if (detected && detected !== value) {
          onChange(detected);
        }
      } catch (e) {
        // Fallback to UTC
      }
    }
  }, [value, onChange]);

  const filteredTimezones = COMMON_TIMEZONES.filter((tz) =>
    tz.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-1.5 font-sans">
      <label className="block text-xs font-medium text-neutral-400">
        Time Zone (IANA standard)
      </label>

      <div className="relative">
        <select
          value={value || 'UTC'}
          onChange={(e) => onChange(e.target.value)}
          className="w-full px-3 py-2 pl-9 rounded-md bg-neutral-900 border border-neutral-800 text-xs text-neutral-200 focus:outline-none focus:border-neutral-700 focus:ring-1 focus:ring-neutral-700 appearance-none cursor-pointer transition-colors"
        >
          {/* Ensure current value is included even if custom */}
          {value && !COMMON_TIMEZONES.includes(value) && (
            <option value={value}>{value} (Detected)</option>
          )}
          {COMMON_TIMEZONES.map((tz) => (
            <option key={tz} value={tz}>
              {tz}
            </option>
          ))}
        </select>
        <Globe className="w-4 h-4 text-neutral-500 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
      </div>
      <p className="text-[11px] text-neutral-500">
        Used to accurately coordinate interview scheduling across global timezones.
      </p>
    </div>
  );
}

