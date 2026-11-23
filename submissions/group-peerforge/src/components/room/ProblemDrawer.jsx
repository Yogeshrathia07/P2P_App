import React, { useState } from "react";
import { BookOpen, ChevronLeft, ChevronRight, Layers, HelpCircle, CheckCircle2 } from "lucide-react";
import { PROBLEMS, getProblemsByTrack } from "../../data/problems";

/**
 * ProblemDrawer
 * Left-column collapsible problem specification pane with question switcher.
 */
export const ProblemDrawer = ({
  problem,
  track,
  userRole,
  isCollapsed,
  onToggleCollapse,
  onSelectProblem,
}) => {
  const [isPickerOpen, setIsPickerOpen] = useState(false);
  const trackProblems = getProblemsByTrack(track);

  if (isCollapsed) {
    return (
      <div className="h-full border-r border-neutral-800 bg-neutral-950 flex flex-col items-center py-4 px-2 select-none">
        <button
          type="button"
          onClick={onToggleCollapse}
          title="Expand Problem Drawer"
          className="p-1.5 rounded text-neutral-400 hover:text-neutral-200 hover:bg-neutral-900 border border-neutral-800 transition-colors mb-4"
        >
          <ChevronRight className="w-4 h-4" />
        </button>
        <span
          className="text-xs font-mono text-neutral-500 uppercase tracking-widest [writing-mode:vertical-rl] rotate-180 py-2 cursor-pointer"
          onClick={onToggleCollapse}
        >
          Problem Spec
        </span>
      </div>
    );
  }

  const difficultyColor =
    problem?.difficulty === "Junior"
      ? "text-emerald-400 bg-emerald-950/40 border-emerald-800/40"
      : problem?.difficulty === "Mid-Level"
      ? "text-amber-400 bg-amber-950/40 border-amber-800/40"
      : "text-rose-400 bg-rose-950/40 border-rose-800/40";

  return (
    <div className="h-full border-r border-neutral-800 bg-neutral-950 flex flex-col overflow-hidden">
      {/* Drawer Header */}
      <div className="p-3 border-b border-neutral-800 flex items-center justify-between bg-neutral-900/50">
        <div className="flex items-center gap-2 min-w-0">
          <BookOpen className="w-4 h-4 text-neutral-400 shrink-0" />
          <span className="text-xs font-mono font-medium text-neutral-300 truncate">
            Problem Specification
          </span>
        </div>
        <div className="flex items-center gap-1.5">
          {/* Question Picker Trigger */}
          <div className="relative">
            <button
              type="button"
              onClick={() => setIsPickerOpen(!isPickerOpen)}
              className="px-2 py-1 rounded text-xs font-mono bg-neutral-900 hover:bg-neutral-800 border border-neutral-800 text-neutral-300 transition-colors flex items-center gap-1"
              title="Select different problem"
            >
              <Layers className="w-3 h-3 text-neutral-400" />
              <span>Change</span>
            </button>

            {/* Dropdown Menu */}
            {isPickerOpen && (
              <div className="absolute top-full left-0 mt-1 w-64 bg-neutral-900 border border-neutral-800 rounded-lg shadow-xl py-1 z-50">
                <div className="px-3 py-1.5 text-[11px] font-mono text-neutral-400 uppercase tracking-wider border-b border-neutral-800">
                  Select Question ({track || "All"})
                </div>
                <div className="max-h-60 overflow-y-auto py-1">
                  {trackProblems.map((p) => (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => {
                        onSelectProblem(p);
                        setIsPickerOpen(false);
                      }}
                      className={`w-full text-left px-3 py-1.5 text-xs font-mono flex items-center justify-between hover:bg-neutral-800 transition-colors ${
                        p.id === problem?.id ? "text-neutral-100 bg-neutral-800/60" : "text-neutral-400"
                      }`}
                    >
                      <span className="truncate">{p.title}</span>
                      <span className="text-[10px] px-1 rounded bg-neutral-950 border border-neutral-800 text-neutral-400 shrink-0 ml-2">
                        {p.difficulty}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Collapse button */}
          <button
            type="button"
            onClick={onToggleCollapse}
            title="Collapse Problem Drawer"
            className="p-1 rounded text-neutral-400 hover:text-neutral-200 hover:bg-neutral-800 transition-colors"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Problem Content Body */}
      <div className="flex-1 overflow-y-auto p-4 space-y-5 text-neutral-300 text-xs leading-relaxed">
        {/* Title & Metadata */}
        <div>
          <div className="flex items-center gap-2 mb-2 flex-wrap">
            <span className={`px-2 py-0.5 rounded text-[11px] font-mono border ${difficultyColor}`}>
              {problem?.difficulty || "Mid-Level"}
            </span>
            <span className="px-2 py-0.5 rounded text-[11px] font-mono bg-neutral-900 border border-neutral-800 text-neutral-400">
              {problem?.track || track}
            </span>
          </div>
          <h2 className="text-base font-medium text-neutral-100">{problem?.title}</h2>
        </div>

        {/* Description */}
        <div className="space-y-2 whitespace-pre-wrap text-neutral-300 font-sans leading-relaxed">
          {problem?.description}
        </div>

        {/* Examples Section */}
        {problem?.examples && problem.examples.length > 0 && (
          <div className="space-y-3">
            <div className="text-[11px] font-mono uppercase tracking-wider text-neutral-400">
              Examples
            </div>
            {problem.examples.map((eg, idx) => (
              <div
                key={idx}
                className="bg-neutral-900/60 border border-neutral-800/80 rounded-md p-3 space-y-1.5 font-mono text-xs"
              >
                <div className="text-neutral-400">
                  <span className="text-neutral-500 font-medium mr-2">Input:</span>
                  <span className="text-neutral-200">{eg.input}</span>
                </div>
                <div className="text-neutral-400">
                  <span className="text-neutral-500 font-medium mr-2">Output:</span>
                  <span className="text-emerald-400">{eg.output}</span>
                </div>
                {eg.explanation && (
                  <div className="text-neutral-500 text-[11px] font-sans pt-1 border-t border-neutral-800/60">
                    <span className="font-mono text-neutral-400 mr-1.5">Note:</span>
                    {eg.explanation}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Constraints */}
        {problem?.constraints && problem.constraints.length > 0 && (
          <div className="space-y-2 pt-2 border-t border-neutral-800">
            <div className="text-[11px] font-mono uppercase tracking-wider text-neutral-400">
              Constraints
            </div>
            <ul className="list-disc list-inside space-y-1 font-mono text-[11px] text-neutral-400">
              {problem.constraints.map((c, i) => (
                <li key={i}>{c}</li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
};

export default ProblemDrawer;

