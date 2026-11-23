import React from 'react';
import { Clock } from 'lucide-react';

const PREFERENCE_WINDOWS = [
  'Weekday Evenings',
  'Weekday Mornings',
  'Weekends',
  'Flexible',
];

export default function AvailabilityToggle({
  value = { isSearching: true, preferredWindows: ['Weekday Evenings', 'Weekends'] },
  onChange,
}) {
  const isSearching = value?.isSearching ?? true;
  const preferredWindows = value?.preferredWindows ?? [];

  const handleToggleStatus = () => {
    onChange({
      ...value,
      isSearching: !isSearching,
    });
  };

  const handleToggleWindow = (win) => {
    let next;
    if (preferredWindows.includes(win)) {
      next = preferredWindows.filter((w) => w !== win);
    } else {
      next = [...preferredWindows, win];
    }
    onChange({
      ...value,
      preferredWindows: next,
    });
  };

  return (
    <div className="space-y-3 font-sans">
      {/* Availability Status Switch */}
      <div className="flex items-center justify-between p-3 rounded-md bg-neutral-900 border border-neutral-800">
        <div>
          <div className="flex items-center gap-2">
            <span
              className={`w-2 h-2 rounded-full ${
                isSearching ? 'bg-emerald-500' : 'bg-neutral-600'
              }`}
            />
            <span className="text-xs font-medium text-white">
              {isSearching ? 'Active in Matching Queue' : 'Away / Inactive'}
            </span>
          </div>
          <p className="text-[11px] text-neutral-400 mt-0.5">
            {isSearching
              ? 'Your profile can be paired with peers for practice sessions.'
              : 'You will not appear in matchmaking queues or receive pairing requests.'}
          </p>
        </div>

        <button
          type="button"
          onClick={handleToggleStatus}
          className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-1 focus:ring-neutral-400 ${
            isSearching ? 'bg-emerald-600' : 'bg-neutral-800'
          }`}
          role="switch"
          aria-checked={isSearching}
        >
          <span
            className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow-sm ring-0 transition duration-200 ease-in-out ${
              isSearching ? 'translate-x-4' : 'translate-x-0'
            }`}
          />
        </button>
      </div>

      {/* Preferred Time Windows */}
      <div>
        <label className="block text-xs font-medium text-neutral-400 mb-1.5 flex items-center gap-1.5">
          <Clock className="w-3.5 h-3.5 text-neutral-500" />
          Preferred Practice Windows
        </label>
        <div className="flex flex-wrap gap-1.5">
          {PREFERENCE_WINDOWS.map((win) => {
            const isSelected = preferredWindows.includes(win);
            return (
              <button
                key={win}
                type="button"
                onClick={() => handleToggleWindow(win)}
                className={`px-2.5 py-1 rounded-md text-xs font-mono transition-colors duration-150 cursor-pointer border ${
                  isSelected
                    ? 'bg-neutral-100 text-neutral-900 border-neutral-100 font-semibold'
                    : 'bg-neutral-900/80 text-neutral-400 border-neutral-800 hover:text-neutral-200 hover:border-neutral-700'
                }`}
              >
                {win}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

