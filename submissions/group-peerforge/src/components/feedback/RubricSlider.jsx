import React from "react";

const SCALE_DESCRIPTORS = {
  1: { label: "Developing", desc: "Significant gaps; needs substantial coaching" },
  2: { label: "Below Bar", desc: "Demonstrated partial understanding with notable stumbling" },
  3: { label: "Meets Bar", desc: "Solid competency; solves core problem with clean approach" },
  4: { label: "Exceeds Bar", desc: "Strong performance; anticipates edge cases and explains trade-offs" },
  5: { label: "Exceptional", desc: "Senior mastery; elegant architecture and fluid communication" },
};

/**
 * RubricSlider
 * 1-5 Competency step picker with descriptive anchors.
 */
export const RubricSlider = ({ label, description, value, onChange }) => {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <label className="text-xs font-mono font-medium text-neutral-200">{label}</label>
        {value > 0 && (
          <span className="text-[11px] font-mono text-emerald-400 font-medium">
            {value} / 5 — {SCALE_DESCRIPTORS[value]?.label}
          </span>
        )}
      </div>

      {description && <p className="text-[11px] text-neutral-400 font-sans">{description}</p>}

      {/* 5-Step Segmented Bar */}
      <div className="grid grid-cols-5 gap-1.5 pt-1">
        {[1, 2, 3, 4, 5].map((step) => {
          const isSelected = value === step;
          return (
            <button
              key={step}
              type="button"
              onClick={() => onChange(step)}
              className={`py-2 px-1 rounded-md text-xs font-mono flex flex-col items-center justify-center transition-all border ${
                isSelected
                  ? "bg-neutral-100 text-neutral-950 border-white font-bold shadow-sm"
                  : "bg-neutral-900/80 text-neutral-400 border-neutral-800 hover:bg-neutral-850 hover:text-neutral-200"
              }`}
            >
              <span className="text-sm leading-none">{step}</span>
              <span className="text-[9px] mt-1 font-sans tracking-tight hidden sm:inline truncate max-w-full">
                {SCALE_DESCRIPTORS[step]?.label}
              </span>
            </button>
          );
        })}
      </div>

      {/* Selected Step Description Hint */}
      {value > 0 && (
        <div className="text-[10px] text-neutral-500 font-mono italic pt-0.5">
          {SCALE_DESCRIPTORS[value]?.desc}
        </div>
      )}
    </div>
  );
};

export default RubricSlider;

