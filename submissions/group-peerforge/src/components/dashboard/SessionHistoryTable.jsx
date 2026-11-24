import React from 'react';
import { Calendar, ChevronRight, Lock, Clock, User, ArrowRight } from 'lucide-react';

/**
 * SessionHistoryTable: Displays table of past interview sessions with status badges,
 * composite ratings, and interactive row triggers for the slide-over scorecard drawer.
 */
export default function SessionHistoryTable({ sessions = [], loading, onSelectSession }) {
  const getInitials = (name) => {
    if (!name) return 'PF';
    return name
      .split(' ')
      .map((part) => part[0])
      .join('')
      .toUpperCase()
      .substring(0, 2);
  };

  if (loading) {
    return (
      <div className="rounded-xl border border-neutral-800 bg-neutral-900/20 p-6 space-y-3 animate-pulse">
        <div className="h-4 bg-neutral-800 rounded w-1/4" />
        <div className="h-10 bg-neutral-800/60 rounded" />
        <div className="h-10 bg-neutral-800/60 rounded" />
      </div>
    );
  }

  if (sessions.length === 0) {
    return (
      <section className="rounded-xl border border-neutral-800 bg-neutral-900/20 p-8 flex flex-col items-center justify-center text-center">
        <div className="w-10 h-10 rounded-lg bg-neutral-800/80 border border-neutral-700/50 flex items-center justify-center text-neutral-400 mb-3">
          <Calendar className="w-5 h-5" />
        </div>
        <h3 className="text-sm font-medium text-white">No interview sessions recorded yet</h3>
        <p className="text-xs text-neutral-400 max-w-sm mt-1 mb-4 leading-relaxed">
          Your completed mock interviews, peer feedback rubrics, and performance metrics will appear here after your first session.
        </p>
        <button
          onClick={() => (window.location.href = '/lobby')}
          className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-md bg-white hover:bg-neutral-200 text-neutral-950 text-xs font-medium cursor-pointer transition-colors"
        >
          <Clock className="w-3.5 h-3.5 text-neutral-800" />
          <span>Join Lobby to Pair</span>
        </button>
      </section>
    );
  }

  return (
    <div className="rounded-xl border border-neutral-800 bg-neutral-900/30 overflow-hidden font-sans">
      <div className="px-5 py-4 border-b border-neutral-800/80 flex items-center justify-between">
        <div>
          <h3 className="text-sm font-medium text-white">Past Interview Sessions</h3>
          <p className="text-xs text-neutral-400 mt-0.5">
            Click any row to view full feedback rubric, qualitative strengths, and candidate notes
          </p>
        </div>
        <span className="font-mono text-[11px] text-neutral-400">
          {sessions.length} session{sessions.length > 1 ? 's' : ''}
        </span>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs">
          <thead className="bg-neutral-900/60 border-b border-neutral-800 text-neutral-400 font-mono text-[11px] uppercase tracking-wider">
            <tr>
              <th className="py-3 px-4">Track & Difficulty</th>
              <th className="py-3 px-4">Peer Partner</th>
              <th className="py-3 px-4">Date</th>
              <th className="py-3 px-4">Evaluation</th>
              <th className="py-3 px-4 text-right">Details</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-800/60">
            {sessions.map((session) => {
              const peer = session.peer;
              const feedback = session.feedback;
              const isRevealed = feedback?.isRevealed;
              const formattedDate = session.createdAt
                ? new Date(session.createdAt).toLocaleDateString('en-US', {
                    month: 'short',
                    day: 'numeric',
                    year: 'numeric',
                  })
                : 'Recent';

              return (
                <tr
                  key={session._id || session.roomId}
                  onClick={() => onSelectSession(session)}
                  className="hover:bg-neutral-900/70 transition-colors cursor-pointer group"
                >
                  {/* Track & Difficulty */}
                  <td className="py-3.5 px-4">
                    <div className="font-medium text-white">
                      {session.track || 'Practice Track'}
                    </div>
                    <div className="text-[11px] text-neutral-500 font-mono mt-0.5">
                      {session.difficulty || 'Mid-Level'}
                    </div>
                  </td>

                  {/* Peer Partner */}
                  <td className="py-3.5 px-4">
                    <div className="flex items-center gap-2.5">
                      <div className="w-7 h-7 rounded-md bg-neutral-800 border border-neutral-700/80 flex items-center justify-center text-white text-[11px] font-mono font-semibold">
                        {getInitials(peer?.name)}
                      </div>
                      <div className="truncate max-w-[130px]">
                        <div className="text-neutral-200 truncate">
                          {peer?.name || 'Anonymous Peer'}
                        </div>
                        <div className="text-[10px] text-neutral-500 font-mono">
                          {session.myRole === 'candidate' ? 'Interviewer' : 'Candidate'}
                        </div>
                      </div>
                    </div>
                  </td>

                  {/* Date */}
                  <td className="py-3.5 px-4 font-mono text-neutral-300 tabular-nums">
                    {formattedDate}
                  </td>

                  {/* Evaluation / Composite Score */}
                  <td className="py-3.5 px-4">
                    {!feedback ? (
                      <span className="text-neutral-500 font-mono text-[11px]">
                        Unreviewed
                      </span>
                    ) : !isRevealed ? (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-mono bg-amber-500/10 text-amber-400 border border-amber-500/20">
                        <Lock className="w-3 h-3" />
                        Pending Reveal
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[11px] font-mono bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                        <span className="font-semibold">{feedback.compositeScore}</span>
                        <span className="text-[10px] text-emerald-500/80">/ 5.0</span>
                      </span>
                    )}
                  </td>

                  {/* Action Chevron */}
                  <td className="py-3.5 px-4 text-right">
                    <span className="inline-flex items-center text-neutral-500 group-hover:text-white transition-colors">
                      <ChevronRight className="w-4 h-4" />
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
