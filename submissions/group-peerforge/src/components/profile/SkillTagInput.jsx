import React, { useState } from 'react';
import { X, Plus } from 'lucide-react';

const POPULAR_SKILLS = [
  'React',
  'Node.js',
  'Python',
  'TypeScript',
  'Go',
  'Java',
  'Docker',
  'AWS',
  'System Design',
  'DSA'
];

export default function SkillTagInput({ value = [], onChange }) {
  const [inputValue, setInputValue] = useState('');

  const handleTogglePopular = (skill) => {
    if (value.includes(skill)) {
      onChange(value.filter((s) => s !== skill));
    } else {
      onChange([...value, skill]);
    }
  };

  const handleRemove = (skillToRemove) => {
    onChange(value.filter((s) => s !== skillToRemove));
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      addCustomSkill();
    }
  };

  const addCustomSkill = () => {
    const trimmed = inputValue.trim().replace(/,/g, '');
    if (trimmed && !value.some((s) => s.toLowerCase() === trimmed.toLowerCase())) {
      onChange([...value, trimmed]);
    }
    setInputValue('');
  };

  return (
    <div className="space-y-3 font-sans">
      {/* Popular Chips Header & Toggles */}
      <div>
        <label className="block text-xs font-medium text-neutral-400 mb-1.5">
          Popular Technologies (click to toggle)
        </label>
        <div className="flex flex-wrap gap-1.5">
          {POPULAR_SKILLS.map((skill) => {
            const isSelected = value.includes(skill);
            return (
              <button
                key={skill}
                type="button"
                onClick={() => handleTogglePopular(skill)}
                className={`px-2.5 py-1 rounded-md text-xs font-mono transition-colors duration-150 cursor-pointer border ${
                  isSelected
                    ? 'bg-neutral-100 text-neutral-900 border-neutral-100 font-semibold'
                    : 'bg-neutral-900/80 text-neutral-400 border-neutral-800 hover:text-neutral-200 hover:border-neutral-700'
                }`}
              >
                {skill}
              </button>
            );
          })}
        </div>
      </div>

      {/* Selected Tags Display */}
      <div>
        <label className="block text-xs font-medium text-neutral-400 mb-1.5">
          Selected Skills ({value.length})
        </label>
        {value.length === 0 ? (
          <p className="text-xs text-neutral-500 italic py-1">
            No skills selected yet. Select from presets above or type custom ones below.
          </p>
        ) : (
          <div className="flex flex-wrap gap-1.5">
            {value.map((skill) => (
              <span
                key={skill}
                className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-neutral-900 border border-neutral-800 text-xs font-mono text-neutral-200"
              >
                <span>{skill}</span>
                <button
                  type="button"
                  onClick={() => handleRemove(skill)}
                  className="text-neutral-500 hover:text-neutral-300 transition-colors cursor-pointer"
                  aria-label={`Remove ${skill}`}
                >
                  <X className="w-3 h-3" />
                </button>
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Custom Tag Input */}
      <div className="flex gap-2">
        <input
          type="text"
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Type a skill and press Enter..."
          className="flex-1 px-3 py-1.5 rounded-md bg-neutral-900 border border-neutral-800 text-xs text-neutral-200 placeholder:text-neutral-500 focus:outline-none focus:border-neutral-700 focus:ring-1 focus:ring-neutral-700 transition-colors"
        />
        <button
          type="button"
          onClick={addCustomSkill}
          disabled={!inputValue.trim()}
          className="px-3 py-1.5 rounded-md bg-neutral-900 hover:bg-neutral-800 border border-neutral-800 disabled:opacity-40 text-xs font-medium text-neutral-300 transition-colors cursor-pointer flex items-center gap-1"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>Add</span>
        </button>
      </div>
    </div>
  );
}

