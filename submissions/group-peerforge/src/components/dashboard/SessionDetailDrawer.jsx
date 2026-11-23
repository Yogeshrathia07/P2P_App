import React from 'react';
import { X, Lock, CheckCircle2, Award, Calendar, Clock, User, ShieldAlert } from 'lucide-react';

/**
 * SessionDetailDrawer: Slide-over drawer displaying full rubric breakdown,
 * qualitative strengths/improvements, and private candidate notes for a past interview.
 */
export default function SessionDetailDrawer({ isOpen, onClose, session, currentUser }) {
  if (!isOpen || !session) return null;

  const feedback = session.feedback;
  const isRevealed = feedback?.isRevealed;
  const scores = feedback?.scores || {};
  const formattedDate = session.createdAt
    ? new Date(session.createdAt).toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      })
    : 'Unknown date';

  const peer = session.peer;

  const competencyLabels = [
    { key: 'codeCorrectness', label: 'Code Correctness' },
    { key: 'problemSolving', label: 'Problem Solving' },
    { key: 'communication', label: 'Communication' },
    { key: 'architecture', label: 'Architecture & System Design' },
  ];

  return (
    <div className="fixed inset-0 z-50 overflow-hidden font-sans">
      {/* Backdrop */}
      <div
        onClick={onClose}
        className="absolute inset-0 bg-black/60 backdrop-blur-sm transition-opacity"
      />

      {/* Slide-over Container */}
      <div className="fixed inset-y-0 right-0 max-w-full flex pl-10">
        <div className="w-screen max-w-md bg-neutral-950 border-l border-neutral-800 shadow-2xl flex flex-col justify-between overflow-hidden">
          {/* Header */}
          <div className="p-5 border-b border-neutral-800/80 flex items-center justify-between bg-neutral-900/40">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-neutral-800 text-neutral-300 border border-neutral-700">
                  {session.track || 'Practice Track'}
                </span>
                <span className="text-xs text-neutral-500 font-mono">
                  {session.difficulty || 'Mid-Level'}
                </span>
              </div>
              <h2 className="text-base font-semibold text-white tracking-tight">
                Interview Session Scorecard
              </h2>
            </div>

            <button
              onClick={onClose}
              className="p-1.5 rounded-md text-neutral-400 hover:text-white hover:bg-neutral-800/80 transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Drawer Body */}
          <div className="flex-1 overflow-y-auto p-5 space-y-5 text-xs text-neutral-300 selection:bg-neutral-800">
            {/* Meta Card */}
            <div className="rounded-lg border border-neutral-800/80 bg-neutral-900/30 p-3.5 space-y-2">
              <div className="flex justify-between items-center text-neutral-400">
                <span className="flex items-center gap-1.5">
                  <Calendar className="w-3.5 h-3.5" />
                  Date & Time
                </span>
                <span className="font-mono text-neutral-200">{formattedDate}</span>
              </div>

              <div className="flex justify-between items-center text-neutral-400">
                <span className="flex items-center gap-1.5">
                  <User className="w-3.5 h-3.5" />
                  Peer Partner
                </span>
                <span className="font-mono text-neutral-200">
                  {peer?.name || 'Anonymous Peer'}
                </span>
              </div>

              <div className="flex justify-between items-center text-neutral-400">
                <span className="flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5" />
                  Room ID
                </span>
                <span className="font-mono text-neutral-300 text-[11px] truncate max-w-[140px]">
                  {session.roomId}
                </span>
              </div>
            </div>

            {/* Scorecard Content */}
            {!feedback ? (
              <div className="rounded-lg border border-neutral-800 bg-neutral-900/20 p-6 text-center space-y-2">
                <ShieldAlert className="w-6 h-6 text-neutral-500 mx-auto" />
                <h3 className="text-sm font-medium text-white">No Evaluation Recorded</h3>
                <p className="text-xs text-neutral-400">
                  This session ended before peer feedback was completed.
                </p>
              </div>
            ) : !isRevealed ? (
              <div className="rounded-lg border border-amber-500/20 bg-amber-500/5 p-5 text-center space-y-2">
                <Lock className="w-5 h-5 text-amber-400 mx-auto" />
                <h3 className="text-sm font-medium text-amber-300">Ratings Locked</h3>
                <p className="text-xs text-neutral-400 leading-relaxed">
                  Both participants must submit feedback before ratings are unlocked.
                </p>
                <span className="inline-block px-2.5 py-1 rounded bg-amber-500/10 text-amber-400 text-[11px] font-mono border border-amber-500/20 mt-1">
                  Awaiting Partner Submission
                </span>
              </div>
            ) : (
              <>
                {/* Composite Rating Header */}
                <div className="rounded-xl border border-neutral-800 bg-neutral-900/60 p-4 flex items-center justify-between">
                  <div>
                    <span className="text-[11px] text-neutral-400 font-mono uppercase tracking-wider block">
                      Composite Score
                    </span>
                    <div className="flex items-baseline gap-1.5 mt-0.5">
                      <span className="text-2xl font-bold font-mono text-white">
                        {feedback.compositeScore}
                      </span>
                      <span className="text-neutral-500 font-mono text-xs">/ 5.0</span>
                    </div>
                  </div>

                  <span className="px-2.5 py-1 rounded-md text-xs font-mono font-medium bg-white text-neutral-950">
                    {feedback.compositeScore >= 4.0 ? 'Exceeds Bar' : feedback.compositeScore >= 3.0 ? 'Meets Bar' : 'Developing'}
                  </span>
                </div>

                {/* 4 Rubric Bars */}
                <div className="space-y-3">
                  <h4 className="text-xs font-medium text-neutral-400 uppercase tracking-wider font-mono">
                    Rubric Breakdown
                  </h4>
                  <div className="space-y-2.5 rounded-lg border border-neutral-800 bg-neutral-900/30 p-3.5">
                    {competencyLabels.map(({ key, label }) => {
                      const score = scores[key] || 0;
                      const percentage = (score / 5) * 100;
                      return (
                        <div key={key} className="space-y-1">
                          <div className="flex justify-between items-center text-xs">
                            <span className="text-neutral-300">{label}</span>
                            <span className="font-mono text-white font-medium">
                              {score.toFixed(1)} / 5.0
                            </span>
                          </div>
                          <div className="w-full h-1.5 rounded-full bg-neutral-800 overflow-hidden">
                            <div
                              className="h-full bg-white rounded-full"
                              style={{ width: `${percentage}%` }}
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Qualitative Strengths */}
                <div className="space-y-1.5">
                  <h4 className="text-xs font-medium text-neutral-400 uppercase tracking-wider font-mono flex items-center gap-1.5">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                    Key Strengths
                  </h4>
                  <div className="rounded-lg border border-neutral-800 bg-neutral-900/30 p-3.5 text-xs text-neutral-200 leading-relaxed font-sans">
                    {feedback.strengths}
                  </div>
                </div>

                {/* Qualitative Improvements */}
                <div className="space-y-1.5">
                  <h4 className="text-xs font-medium text-neutral-400 uppercase tracking-wider font-mono flex items-center gap-1.5">
                    <Award className="w-3.5 h-3.5 text-amber-400" />
                    Actionable Improvements
                  </h4>
                  <div className="rounded-lg border border-neutral-800 bg-neutral-900/30 p-3.5 text-xs text-neutral-200 leading-relaxed font-sans">
                    {feedback.improvements}
                  </div>
                </div>

                {/* Private Notes */}
                {feedback.privateNotes && (
                  <div className="space-y-1.5">
                    <h4 className="text-xs font-medium text-neutral-400 uppercase tracking-wider font-mono flex items-center gap-1.5">
                      <Lock className="w-3.5 h-3.5 text-neutral-400" />
                      Candidate Private Notes{' '}
                      <span className="text-[10px] text-neutral-500 normal-case">
                        (Only visible to you)
                      </span>
                    </h4>
                    <div className="rounded-lg border border-neutral-800/80 bg-neutral-900/20 p-3 text-xs text-neutral-400 italic leading-relaxed">
                      "{feedback.privateNotes}"
                    </div>
                  </div>
                )}
              </>
            )}
          </div>

          {/* Footer */}
          <div className="p-4 border-t border-neutral-800/80 bg-neutral-950 flex justify-end">
            <button
              onClick={onClose}
              className="px-4 py-1.5 rounded-md bg-neutral-900 hover:bg-neutral-800 text-xs font-medium text-neutral-300 border border-neutral-800 transition-colors cursor-pointer"
            >
              Close Drawer
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
