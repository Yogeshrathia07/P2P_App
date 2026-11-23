import React from "react";
import { Award, CheckCircle2, AlertCircle, Lock, ArrowRight, Star } from "lucide-react";

const COMPETENCY_LABELS = {
  codeCorrectness: "Code Correctness & Edge Cases",
  problemSolving: "Problem Solving & Algorithmic Approach",
  communication: "Technical Communication & Explanation",
  architecture: "System Architecture & Code Structure",
};

/**
 * UnlockedScorecard
 * Full evaluation scorecard rendered immediately upon symmetric blind reveal.
 */
export const UnlockedScorecard = ({
  receivedFeedback,
  compositeScore,
  partnerName,
  track,
  onDone,
}) => {
  const scores = receivedFeedback?.scores || {
    codeCorrectness: 4,
    problemSolving: 4,
    communication: 4,
    architecture: 4,
  };

  const scoreBadgeColor =
    compositeScore >= 4.5
      ? "bg-emerald-950/60 text-emerald-300 border-emerald-800/60"
      : compositeScore >= 3.5
      ? "bg-blue-950/60 text-blue-300 border-blue-800/60"
      : compositeScore >= 2.5
      ? "bg-amber-950/60 text-amber-300 border-amber-800/60"
      : "bg-rose-950/60 text-rose-300 border-rose-800/60";

  const scoreVerdict =
    compositeScore >= 4.5
      ? "Strong Hire / Senior Mastery"
      : compositeScore >= 3.5
      ? "Hire / Solid Competency"
      : compositeScore >= 2.5
      ? "Borderline / Developing"
      : "Needs Technical Focus";

  return (
    <div className="max-w-2xl w-full mx-auto p-6 sm:p-8 space-y-6 text-neutral-100 font-sans">
      {/* Top Banner: Overall Rating */}
      <div className="bg-neutral-900/80 border border-neutral-800 rounded-xl p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <Award className="w-5 h-5 text-emerald-400" />
            <h2 className="text-base font-semibold tracking-tight text-white">
              Evaluation Scorecard Unlocked
            </h2>
          </div>
          <p className="text-xs text-neutral-400 font-mono">
            Feedback provided by {partnerName || "Peer Reviewer"} • {track || "Practice Session"}
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="text-right">
            <div className="text-2xl font-bold font-mono tracking-tight text-white">
              {compositeScore?.toFixed(1) || "4.0"}
              <span className="text-xs text-neutral-500 font-normal"> / 5.0</span>
            </div>
            <span className={`inline-block px-2 py-0.5 rounded text-[10px] font-mono border ${scoreBadgeColor}`}>
              {scoreVerdict}
            </span>
          </div>
        </div>
      </div>

      {/* 4 Competency Breakdown Bars */}
      <div className="space-y-3 bg-neutral-950 border border-neutral-800 rounded-xl p-5">
        <h3 className="text-xs font-mono uppercase tracking-wider text-neutral-400">
          Core Competency Breakdown
        </h3>

        <div className="space-y-3.5 pt-1">
          {Object.entries(COMPETENCY_LABELS).map(([key, label]) => {
            const val = scores[key] || 3;
            const pct = (val / 5) * 100;

            return (
              <div key={key} className="space-y-1.5 font-mono text-xs">
                <div className="flex justify-between text-neutral-300">
                  <span>{label}</span>
                  <span className="font-semibold text-neutral-100">{val} / 5</span>
                </div>
                {/* Visual Progress Bar */}
                <div className="h-2 w-full bg-neutral-900 border border-neutral-800 rounded-full overflow-hidden">
                  <div
                    className={`h-full transition-all duration-500 rounded-full ${
                      val >= 4 ? "bg-emerald-500" : val === 3 ? "bg-blue-500" : "bg-amber-500"
                    }`}
                    style={{ width: `${pct}%` }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Qualitative Feedback Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Key Strengths */}
        <div className="bg-neutral-900/40 border border-neutral-800 rounded-xl p-4 space-y-2">
          <div className="flex items-center gap-2 text-emerald-400 text-xs font-mono">
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            <span className="font-semibold">Key Strengths</span>
          </div>
          <p className="text-xs text-neutral-300 leading-relaxed font-sans whitespace-pre-wrap">
            {receivedFeedback?.strengths || "Demonstrated clean problem decomposition and structured approach."}
          </p>
        </div>

        {/* Actionable Improvements */}
        <div className="bg-neutral-900/40 border border-neutral-800 rounded-xl p-4 space-y-2">
          <div className="flex items-center gap-2 text-amber-400 text-xs font-mono">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span className="font-semibold">Actionable Improvements</span>
          </div>
          <p className="text-xs text-neutral-300 leading-relaxed font-sans whitespace-pre-wrap">
            {receivedFeedback?.improvements || "Focus on explicitly discussing time and space complexity trade-offs upfront."}
          </p>
        </div>
      </div>

      {/* Candidate-Only Private Notes */}
      {receivedFeedback?.privateNotes && (
        <div className="bg-neutral-900/30 border border-neutral-800/80 rounded-xl p-4 space-y-2">
          <div className="flex items-center gap-2 text-neutral-400 text-xs font-mono">
            <Lock className="w-3.5 h-3.5 text-neutral-500 shrink-0" />
            <span className="font-medium text-neutral-300">Private Candidate Notes</span>
            <span className="text-[10px] text-neutral-500 font-sans">(Visible only to you)</span>
          </div>
          <p className="text-xs text-neutral-400 leading-relaxed font-sans whitespace-pre-wrap">
            {receivedFeedback.privateNotes}
          </p>
        </div>
      )}

      {/* Return to Dashboard Primary Action */}
      <div className="pt-2 flex justify-end">
        <button
          type="button"
          onClick={onDone}
          className="px-5 py-2.5 rounded-lg bg-neutral-100 hover:bg-white text-neutral-950 font-mono text-xs font-semibold transition-colors flex items-center gap-2"
        >
          <span>View in Dashboard</span>
          <ArrowRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};

export default UnlockedScorecard;

