import React from 'react';
import { X, Moon, Monitor, Bell, Shield, Sliders } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';

export default function SettingsModal({ isOpen, onClose }) {
  const { user } = useAuth();

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 font-sans">
      {/* Backdrop */}
      <div
        onClick={onClose}
        className="fixed inset-0 bg-black/70 backdrop-blur-xs transition-opacity"
        aria-hidden="true"
      />

      {/* Modal Dialog */}
      <div className="relative w-full max-w-md rounded-xl border border-neutral-800 bg-neutral-950 p-6 shadow-2xl z-10 animate-in fade-in zoom-in-95 duration-150">
        <div className="flex items-center justify-between pb-4 border-b border-neutral-800">
          <div className="flex items-center gap-2">
            <Sliders className="w-4 h-4 text-neutral-400" />
            <h3 className="text-sm font-semibold text-white">Application Settings</h3>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-md text-neutral-400 hover:text-white hover:bg-neutral-900 transition-colors cursor-pointer"
            aria-label="Close settings"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="py-4 space-y-4 text-xs text-neutral-300">
          {/* Appearance */}
          <div className="space-y-1.5">
            <label className="text-neutral-400 font-medium block">Appearance</label>
            <div className="grid grid-cols-2 gap-2">
              <div className="flex items-center gap-2 p-2.5 rounded-lg border border-neutral-700 bg-neutral-900 text-white font-medium cursor-default">
                <Moon className="w-4 h-4 text-neutral-200" />
                <span>Dark Theme (Active)</span>
              </div>
              <div className="flex items-center gap-2 p-2.5 rounded-lg border border-neutral-800/60 bg-neutral-950 text-neutral-500 cursor-not-allowed">
                <Monitor className="w-4 h-4 text-neutral-600" />
                <span>System Sync</span>
              </div>
            </div>
          </div>

          {/* Account Security */}
          <div className="space-y-1.5 pt-2 border-t border-neutral-800/80">
            <label className="text-neutral-400 font-medium block">Security &amp; Session</label>
            <div className="p-3 rounded-lg border border-neutral-800/80 bg-neutral-900/40 space-y-1">
              <div className="flex items-center justify-between">
                <span className="text-neutral-300">JWT HTTP-Only Authentication</span>
                <span className="text-emerald-400 font-mono text-[11px]">Active</span>
              </div>
              <p className="text-[11px] text-neutral-500">
                Session tokens are cryptographically signed and stored in secure HTTP-only cookies.
              </p>
            </div>
          </div>

          {/* Signed In As */}
          <div className="space-y-1.5 pt-2 border-t border-neutral-800/80">
            <label className="text-neutral-400 font-medium block">Account</label>
            <div className="p-3 rounded-lg border border-neutral-800/80 bg-neutral-900/40 flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-white">{user?.name}</p>
                <p className="text-[11px] text-neutral-400 font-mono">{user?.email}</p>
              </div>
              <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-neutral-800 text-neutral-300 border border-neutral-700">
                Developer
              </span>
            </div>
          </div>
        </div>

        <div className="pt-3 border-t border-neutral-800 flex justify-end">
          <button
            onClick={onClose}
            className="px-3.5 py-1.5 rounded-md bg-neutral-900 hover:bg-neutral-800 text-xs font-medium text-neutral-300 hover:text-white border border-neutral-800 transition-colors cursor-pointer"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
}

