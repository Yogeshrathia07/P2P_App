import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Users,
  Play,
  X,
  Search,
  Code2,
  Layers,
  Server,
  ArrowRight,
  Sparkles,
} from 'lucide-react';
import { useSocket } from '@/context/SocketContext';

const TRACKS = [
  {
    id: 'Data Structures & Algorithms (DSA)',
    name: 'Data Structures & Algorithms',
    short: 'DSA',
    icon: Code2,
  },
  {
    id: 'Frontend Web Architecture',
    name: 'Frontend Architecture',
    short: 'Frontend',
    icon: Layers,
  },
  {
    id: 'Backend & System Design',
    name: 'Backend & System Design',
    short: 'Backend',
    icon: Server,
  },
];

const DIFFICULTIES = ['Junior / Entry', 'Mid-Level', 'Senior / Staff'];

export default function MatchmakingQuickCard() {
  const navigate = useNavigate();
  const { inQueue, queueData, elapsedSeconds, joinQueue, leaveQueue } = useSocket();

  const [selectedTrack, setSelectedTrack] = useState(TRACKS[0].id);
  const [selectedDifficulty, setSelectedDifficulty] = useState('Mid-Level');

  const formatTimer = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  };

  const handleStartSearch = () => {
    joinQueue({
      track: selectedTrack,
      difficulty: selectedDifficulty,
    });
  };

  const handleCancelSearch = () => {
    leaveQueue();
  };

  return (
    <div className="rounded-xl border border-neutral-800 bg-neutral-900/40 p-5 flex flex-col justify-between font-sans">
      <div>
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-neutral-800/80 border border-neutral-700/50 flex items-center justify-center text-white">
              <Users className="w-4 h-4 text-neutral-300" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-white">Live Matchmaking</h3>
              <p className="text-[11px] text-neutral-400">Pair for a 60-min peer interview</p>
            </div>
          </div>

          <span
            className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-mono border ${
              inQueue
                ? 'bg-amber-500/10 text-amber-400 border-amber-500/20'
                : 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
            }`}
          >
            <span
              className={`w-1.5 h-1.5 rounded-full ${
                inQueue ? 'bg-amber-400 animate-pulse' : 'bg-emerald-500'
              }`}
            />
            {inQueue ? 'Searching...' : 'Ready'}
          </span>
        </div>

        {inQueue ? (
          <div className="rounded-lg border border-emerald-950/80 bg-emerald-950/20 p-4 my-2 space-y-2.5 animate-in fade-in">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-white flex items-center gap-2">
                <Search className="w-3.5 h-3.5 text-emerald-400 animate-pulse" />
                Searching for peer partner...
              </span>
              <span className="font-mono text-xs text-emerald-400 font-semibold">
                {formatTimer(elapsedSeconds)}
              </span>
            </div>
            <p className="text-[11px] text-neutral-400 font-mono truncate">
              {queueData?.track} &bull; {queueData?.difficulty}
            </p>
            <button
              onClick={handleCancelSearch}
              className="w-full py-1.5 rounded-md bg-neutral-900 hover:bg-neutral-850 border border-neutral-800 text-xs text-neutral-300 hover:text-white transition-colors cursor-pointer flex items-center justify-center gap-1.5"
            >
              <X className="w-3.5 h-3.5 text-neutral-400" />
              <span>Cancel Search</span>
            </button>
          </div>
        ) : (
          <div className="space-y-3 my-2">
            {/* Track selector */}
            <div className="space-y-1">
              <label className="text-[11px] font-medium text-neutral-400 block">
                Track
              </label>
              <select
                value={selectedTrack}
                onChange={(e) => setSelectedTrack(e.target.value)}
                className="w-full px-2.5 py-1.5 rounded-md bg-neutral-900 border border-neutral-800 text-xs text-neutral-200 focus:outline-none focus:border-neutral-700 font-sans cursor-pointer"
              >
                {TRACKS.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Difficulty selector */}
            <div className="space-y-1">
              <label className="text-[11px] font-medium text-neutral-400 block">
                Difficulty
              </label>
              <div className="grid grid-cols-3 gap-1.5">
                {DIFFICULTIES.map((diff) => {
                  const isSelected = selectedDifficulty === diff;
                  return (
                    <button
                      key={diff}
                      type="button"
                      onClick={() => setSelectedDifficulty(diff)}
                      className={`py-1 px-1.5 rounded text-[10px] font-mono text-center truncate border transition-colors cursor-pointer ${
                        isSelected
                          ? 'bg-white text-black border-white font-semibold'
                          : 'bg-neutral-900 text-neutral-400 border-neutral-800 hover:text-white'
                      }`}
                    >
                      {diff.split(' ')[0]}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        )}
      </div>

      <div className="mt-4 pt-3 border-t border-neutral-800/60 flex items-center justify-between gap-2">
        <button
          onClick={() => navigate('/lobby')}
          className="text-xs text-neutral-400 hover:text-white font-medium cursor-pointer transition-colors flex items-center gap-1"
        >
          <span>Full Lobby</span>
          <ArrowRight className="w-3 h-3" />
        </button>

        {!inQueue ? (
          <button
            onClick={handleStartSearch}
            className="px-3.5 py-1.5 rounded-md bg-white hover:bg-neutral-200 text-neutral-950 font-semibold text-xs transition-colors cursor-pointer flex items-center gap-1.5 shadow-sm active:scale-[0.99]"
          >
            <Play className="w-3 h-3 fill-black" />
            <span>Find Partner</span>
          </button>
        ) : (
          <button
            onClick={() => navigate('/lobby')}
            className="px-3.5 py-1.5 rounded-md bg-neutral-800 hover:bg-neutral-750 text-white font-medium text-xs transition-colors cursor-pointer"
          >
            View Queue
          </button>
        )}
      </div>
    </div>
  );
}
