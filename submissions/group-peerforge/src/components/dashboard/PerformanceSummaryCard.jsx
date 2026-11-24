import React from 'react';
import { Award, BarChart3 } from 'lucide-react';

/**
 * PerformanceSummaryCard: Displays aggregated competency ratings across 4 key dimensions
 * (Code Correctness, Problem Solving, Communication, Architecture) with zero external charting bloat.
 */
export default function PerformanceSummaryCard({ analytics, loading }) {
  const totalSessions = analytics?.totalSessions || 0;
  const overallAverage = analytics?.overallAverage || 0;
  const competencies = analytics?.competencies || {
    codeCorrectness: 0,
    problemSolving: 0,
    communication: 0,
    architecture: 0,
  };

  const getTierBadge = (score) => {
    if (score >= 4.5) return { label: 'Exceptional', color: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20' };
    if (score >= 3.8) return { label: 'Exceeds Bar', color: 'text-emerald-300 bg-emerald-500/10 border-emerald-500/20' };
    if (score >= 3.0) return { label: 'Meets Bar', color: 'text-neutral-300 bg-neutral-800 border-neutral-700' };
    if (score >= 2.0) return { label: 'Developing', color: 'text-amber-400 bg-amber-500/10 border-amber-500/20' };
    return { label: 'Unranked', color: 'text-neutral-500 bg-neutral-900 border-neutral-800' };
  };

  const tier = getTierBadge(overallAverage);

  const competencyItems = [
    { label: 'Code Correctness', score: competencies.codeCorrectness },
    { label: 'Problem Solving', score: competencies.problemSolving },
    { label: 'Communication', score: competencies.communication },
    { label: 'Architecture', score: competencies.architecture },
  ];

  return (
    <div className="rounded-xl border border-neutral-800 bg-neutral-900/40 p-5 flex flex-col justify-between">
      <div>
        <div className="flex items-center justify-between mb-3">
          <div className="w-8 h-8 rounded-lg bg-neutral-800/80 border border-neutral-700/50 flex items-center justify-center text-white">
            <BarChart3 className="w-4 h-4 text-neutral-300" />
          </div>
          <span className={`px-2 py-0.5 rounded text-[11px] font-mono border ${tier.color}`}>
            {tier.label}
          </span>
        </div>

        <div className="flex items-baseline justify-between mb-1">
          <h3 className="text-sm font-medium text-white">Skill Competencies</h3>
          <span className="font-mono text-xs text-neutral-400">
            {totalSessions > 0 ? `${overallAverage.toFixed(1)} / 5.0 avg` : 'No data'}
          </span>
        </div>

        <p className="text-xs text-neutral-400 leading-relaxed mb-4">
          {totalSessions > 0
            ? `Aggregated ratings across ${totalSessions} peer evaluation${totalSessions > 1 ? 's' : ''}`
            : 'Ratings unlock automatically after completing peer mock interviews.'}
        </p>

        {loading ? (
          <div className="space-y-3 py-2 animate-pulse">
            <div className="h-2 bg-neutral-800 rounded" />
            <div className="h-2 bg-neutral-800 rounded" />
            <div className="h-2 bg-neutral-800 rounded" />
          </div>
        ) : totalSessions === 0 ? (
          <div className="rounded-lg border border-neutral-800/80 bg-neutral-950/60 p-3.5 text-center my-1">
            <p className="text-[11px] text-neutral-400">
              Complete your first session in the lobby to generate your performance scorecard.
            </p>
          </div>
        ) : (
          <div className="space-y-2.5">
            {competencyItems.map((item) => {
              const percentage = (item.score / 5) * 100;
              return (
                <div key={item.label} className="space-y-1">
                  <div className="flex justify-between items-center text-[11px]">
                    <span className="text-neutral-400 font-medium">{item.label}</span>
                    <span className="font-mono text-neutral-200 tabular-nums">
                      {item.score.toFixed(1)}
                    </span>
                  </div>
                  <div className="w-full h-1.5 rounded-full bg-neutral-800 overflow-hidden">
                    <div
                      className="h-full bg-neutral-200 rounded-full transition-all duration-300"
                      style={{ width: `${percentage}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <div className="mt-4 pt-3 border-t border-neutral-800/60 flex items-center justify-between text-xs text-neutral-500 font-mono text-[11px]">
        <span>Completed Interviews</span>
        <span className="text-neutral-300 font-medium">{totalSessions}</span>
      </div>
    </div>
  );
}
