import React, { useEffect } from "react";
import { CheckCircle2, Clock, ShieldCheck, ArrowRight, Loader2 } from "lucide-react";

/**
 * WaitingBlindRoom
 * Real-time blind waiting state ensuring neither peer sees ratings until both submit.
 */
export const WaitingBlindRoom = ({
  partnerName,
  partnerSubmitted,
  socket,
  roomId,
  onUnlocked,
  onReturnToDashboard,
}) => {
  useEffect(() => {
    if (!socket || !roomId) return;

    const handleUnlocked = () => {
      console.log("[Feedback] Symmetric unlock event received");
      onUnlocked();
    };

    socket.on("feedback:unlocked", handleUnlocked);

    return () => {
      socket.off("feedback:unlocked", handleUnlocked);
    };
  }, [socket, roomId, onUnlocked]);

  return (
    <div className="flex flex-col items-center justify-center text-center p-6 sm:p-8 max-w-md mx-auto space-y-6">
      {/* Icon Graphic */}
      <div className="relative">
        <div className="w-16 h-16 rounded-2xl bg-neutral-900 border border-neutral-800 flex items-center justify-center text-emerald-400">
          <CheckCircle2 className="w-8 h-8" />
        </div>
        <div className="absolute -bottom-1 -right-1 w-6 h-6 rounded-full bg-neutral-950 border border-neutral-800 flex items-center justify-center text-neutral-400">
          <Clock className="w-3.5 h-3.5 animate-pulse text-amber-400" />
        </div>
      </div>

      {/* Headings */}
      <div className="space-y-2">
        <h2 className="text-lg font-semibold text-neutral-100 tracking-tight">
          Your Evaluation is Submitted
        </h2>
        <p className="text-xs text-neutral-400 leading-relaxed font-sans">
          To maintain fairness and prevent bias, feedback is protected by symmetric blind reveal.
          Scores unlock the moment both peers complete their reviews.
        </p>
      </div>

      {/* Partner Status Pill */}
      <div className="w-full p-3.5 rounded-lg bg-neutral-900/80 border border-neutral-800 flex items-center justify-between font-mono text-xs">
        <span className="text-neutral-400">{partnerName || "Partner"}</span>
        <span
          className={`flex items-center gap-1.5 px-2 py-0.5 rounded text-[11px] ${
            partnerSubmitted
              ? "bg-emerald-950/60 text-emerald-300 border border-emerald-800/50"
              : "bg-amber-950/60 text-amber-300 border border-amber-800/50"
          }`}
        >
          {partnerSubmitted ? (
            <>
              <CheckCircle2 className="w-3 h-3 text-emerald-400" />
              <span>Submitted</span>
            </>
          ) : (
            <>
              <Loader2 className="w-3 h-3 animate-spin text-amber-400" />
              <span>Writing evaluation...</span>
            </>
          )}
        </span>
      </div>

      {/* Security Notice */}
      <div className="flex items-center gap-2 text-[11px] text-neutral-500 font-mono">
        <ShieldCheck className="w-3.5 h-3.5 text-neutral-400" />
        <span>Symmetric Blind Reveal Active</span>
      </div>

      {/* Return to Dashboard Fallback */}
      <div className="pt-2 w-full">
        <button
          type="button"
          onClick={onReturnToDashboard}
          className="w-full py-2.5 px-4 rounded-md bg-neutral-900 hover:bg-neutral-800 border border-neutral-800 text-xs font-mono text-neutral-300 transition-colors flex items-center justify-center gap-2"
        >
          <span>Return to Dashboard</span>
          <ArrowRight className="w-3.5 h-3.5" />
        </button>
        <p className="text-[10px] text-neutral-600 mt-2 font-mono">
          You can leave anytime; results will unlock in your dashboard history once completed.
        </p>
      </div>
    </div>
  );
};

export default WaitingBlindRoom;

