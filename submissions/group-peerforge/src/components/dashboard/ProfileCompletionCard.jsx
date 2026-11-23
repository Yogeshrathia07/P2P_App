import React from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowRight, CheckCircle2, AlertCircle } from 'lucide-react';

export default function ProfileCompletionCard({ user }) {
  const navigate = useNavigate();

  const targetRoles = user?.profile?.targetRoles || [];
  const skills = user?.profile?.skills || [];
  const timeZone = user?.profile?.timeZone || 'UTC';

  const hasRoles = targetRoles.length > 0;
  const hasSkills = skills.length > 0;
  const hasTimezone = Boolean(timeZone && timeZone !== 'UTC');

  const completedCount = (hasRoles ? 1 : 0) + (hasSkills ? 1 : 0) + (hasTimezone ? 1 : 0);
  const isProfileComplete = completedCount === 3;

  if (isProfileComplete) {
    return (
      <div className="rounded-xl border border-emerald-950/60 bg-emerald-950/15 p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
        <div className="flex items-center gap-2.5 text-emerald-400">
          <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-400" />
          <span className="font-medium">
            Profile fully configured &mdash; you are match-ready for live peer interviews
          </span>
        </div>

        <button
          onClick={() => navigate('/profile')}
          className="text-xs text-emerald-300 hover:text-white underline font-medium cursor-pointer self-start sm:self-auto transition-colors"
        >
          Edit preferences
        </button>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-neutral-800 bg-neutral-900/60 p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
      <div className="space-y-1.5">
        <div className="flex items-center gap-2">
          <span className="px-2 py-0.5 rounded text-[11px] font-mono bg-amber-500/10 text-amber-400 border border-amber-500/20">
            {completedCount} of 3 Essentials Set
          </span>
          <span className="text-xs font-semibold text-white">Complete Profile for Matching</span>
        </div>
        <p className="text-xs text-neutral-400 leading-relaxed max-w-xl">
          Add your target engineering roles, primary tech stack, and timezone to enable accurate peer matchmaking.
        </p>
      </div>

      <button
        onClick={() => navigate('/profile')}
        className="px-3.5 py-2 rounded-md bg-white hover:bg-neutral-200 text-neutral-900 font-medium text-xs transition-colors cursor-pointer flex items-center justify-center gap-1.5 shrink-0 self-start sm:self-auto shadow-sm active:scale-[0.99]"
      >
        <span>Complete Profile</span>
        <ArrowRight className="w-3.5 h-3.5" />
      </button>
    </div>
  );
}
