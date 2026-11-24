import React, { useState, useEffect } from "react";
import { Clock, ArrowLeftRight, AlertCircle } from "lucide-react";

/**
 * InterviewTimer
 * Synchronized 60-minute session countdown with 30m phase tracker and role swapping.
 */
export const InterviewTimer = ({
  userRole,
  partnerRole,
  timerState,
  onSwapRoles,
}) => {
  const [secondsRemaining, setSecondsRemaining] = useState(3600);
  const [showSwapModal, setShowSwapModal] = useState(false);

  useEffect(() => {
    if (!timerState || !timerState.startedAt) return;

    const interval = setInterval(() => {
      const elapsedSeconds = Math.floor((Date.now() - timerState.startedAt) / 1000);
      const remaining = Math.max(0, 3600 - elapsedSeconds);
      setSecondsRemaining(remaining);

      // Trigger halfway checkpoint notification at 30:00 (1800s left)
      if (remaining === 1800 && timerState.phase === 1) {
        setShowSwapModal(true);
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [timerState]);

  const minutes = Math.floor(secondsRemaining / 60);
  const seconds = secondsRemaining % 60;
  const formattedTime = `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;

  const currentPhase = secondsRemaining > 1800 ? "Phase 1: First Round" : "Phase 2: Reverse Round";

  return (
    <div className="flex items-center gap-3">
      {/* Session Timer Pill */}
      <div className="flex items-center gap-2 px-2.5 py-1 rounded-md bg-neutral-900 border border-neutral-800 text-xs font-mono">
        <Clock className="w-3.5 h-3.5 text-neutral-400" />
        <span
          className={`font-medium ${
            secondsRemaining < 300
              ? "text-rose-400 font-bold animate-pulse"
              : secondsRemaining < 900
              ? "text-amber-400"
              : "text-neutral-200"
          }`}
        >
          {formattedTime}
        </span>
        <span className="text-[10px] text-neutral-500 border-l border-neutral-800 pl-2 hidden sm:inline">
          {currentPhase}
        </span>
      </div>

      {/* Role Pill & Swap Action */}
      <div className="flex items-center gap-1.5">
        <span
          className={`px-2 py-0.5 rounded text-xs font-mono border ${
            userRole === "interviewer"
              ? "bg-amber-950/40 text-amber-300 border-amber-800/50"
              : "bg-blue-950/40 text-blue-300 border-blue-800/50"
          }`}
        >
          You: <span className="capitalize font-semibold">{userRole || "Candidate"}</span>
        </span>

        {/* Manual Swap Roles Trigger */}
        <button
          type="button"
          onClick={onSwapRoles}
          title="Swap roles (Interviewer <-> Candidate)"
          className="p-1 rounded bg-neutral-900 hover:bg-neutral-800 border border-neutral-800 text-neutral-400 hover:text-neutral-200 transition-colors"
        >
          <ArrowLeftRight className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Halfway Checkpoint Modal / Banner */}
      {showSwapModal && (
        <div className="fixed inset-0 bg-neutral-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-5 max-w-sm w-full space-y-4 shadow-2xl">
            <div className="flex items-center gap-2.5 text-amber-400">
              <AlertCircle className="w-5 h-5 shrink-0" />
              <h3 className="font-mono text-sm font-semibold">Halfway Checkpoint (30:00)</h3>
            </div>
            <p className="text-xs text-neutral-300 font-sans leading-relaxed">
              You have completed 30 minutes. It is now time to switch roles so both peers get equal
              hands-on candidate practice.
            </p>
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowSwapModal(false)}
                className="px-3 py-1.5 rounded text-xs font-mono bg-neutral-800 text-neutral-300 hover:bg-neutral-700"
              >
                Dismiss
              </button>
              <button
                type="button"
                onClick={() => {
                  onSwapRoles();
                  setShowSwapModal(false);
                }}
                className="px-3 py-1.5 rounded text-xs font-mono bg-neutral-100 text-neutral-950 font-semibold hover:bg-white"
              >
                Switch Roles Now
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default InterviewTimer;

