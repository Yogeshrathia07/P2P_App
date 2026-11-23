import React, { useState, useEffect } from 'react';
import { Check, X, Clock, ShieldCheck, Users } from 'lucide-react';
import { useSocket } from '../../context/SocketContext';

export default function MatchAcceptModal() {
  const { pendingMatch, acceptMatch, declineMatch } = useSocket();
  const [timeLeft, setTimeLeft] = useState(15);
  const [hasAccepted, setHasAccepted] = useState(false);

  useEffect(() => {
    if (!pendingMatch) {
      setTimeLeft(15);
      setHasAccepted(false);
      return;
    }

    // Initialize countdown
    const initialSeconds = Math.max(
      1,
      Math.round((pendingMatch.expiresAt - Date.now()) / 1000)
    );
    setTimeLeft(initialSeconds);
    setHasAccepted(false);

    const interval = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          clearInterval(interval);
          // If time expires without mutual accept, decline automatically
          if (!hasAccepted) {
            declineMatch(pendingMatch.matchId);
          }
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [pendingMatch, declineMatch, hasAccepted]);

  if (!pendingMatch) return null;

  const handleAcceptClick = () => {
    setHasAccepted(true);
    acceptMatch(pendingMatch.matchId);
  };

  const handleDeclineClick = () => {
    declineMatch(pendingMatch.matchId);
  };

  const peer = pendingMatch.peerDetails || {};
  const peerName = peer.name || 'Anonymous Peer';
  const peerInitials = peerName
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .substring(0, 2);

  const progressPercent = Math.max(0, Math.min(100, (timeLeft / 15) * 100));

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="w-full max-w-md rounded-xl border border-neutral-800 bg-neutral-950 p-6 shadow-2xl space-y-5 font-sans">
        {/* Modal Header */}
        <div className="flex items-center justify-between pb-3 border-b border-neutral-900">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping" />
            <span className="text-xs font-mono uppercase tracking-wider text-emerald-400 font-semibold">
              Peer Found
            </span>
          </div>

          <div className="flex items-center gap-1.5 text-neutral-400 font-mono text-xs tabular-nums">
            <Clock className="w-3.5 h-3.5 text-neutral-500" />
            <span>00:{String(timeLeft).padStart(2, '0')}</span>
          </div>
        </div>

        {/* Countdown Progress Bar */}
        <div className="w-full h-1 bg-neutral-900 rounded-full overflow-hidden">
          <div
            className="h-full bg-emerald-500 transition-all duration-1000 ease-linear rounded-full"
            style={{ width: `${progressPercent}%` }}
          />
        </div>

        {/* Peer Match Details Card */}
        <div className="p-4 rounded-lg bg-neutral-900/60 border border-neutral-800/80 flex items-center gap-3.5">
          <div className="w-12 h-12 rounded-lg bg-neutral-800 border border-neutral-700/80 flex items-center justify-center text-white font-mono font-semibold text-sm shrink-0">
            {peer.avatarUrl ? (
              <img
                src={peer.avatarUrl}
                alt={peerName}
                className="w-full h-full object-cover rounded-lg"
              />
            ) : (
              peerInitials
            )}
          </div>

          <div className="flex-1 overflow-hidden">
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-semibold text-white truncate">{peerName}</h3>
              <span className="px-1.5 py-0.2 rounded text-[10px] font-mono bg-neutral-800 text-neutral-300">
                {pendingMatch.difficulty}
              </span>
            </div>
            <p className="text-xs text-neutral-400 font-mono truncate mt-0.5">
              {pendingMatch.track}
            </p>
          </div>
        </div>

        {/* Status Callout */}
        <div className="text-center text-xs text-neutral-400">
          {hasAccepted ? (
            <p className="text-emerald-400 font-medium animate-pulse">
              Accepted! Waiting for your peer to confirm...
            </p>
          ) : (
            <p>Both participants must accept to initialize the collaborative room.</p>
          )}
        </div>

        {/* Actions */}
        <div className="grid grid-cols-2 gap-3 pt-1">
          <button
            type="button"
            onClick={handleDeclineClick}
            disabled={hasAccepted}
            className="px-4 py-2.5 rounded-md border border-neutral-800 hover:bg-neutral-900 text-xs font-medium text-neutral-400 hover:text-white transition-colors cursor-pointer disabled:opacity-40 flex items-center justify-center gap-1.5"
          >
            <X className="w-3.5 h-3.5" />
            <span>Decline</span>
          </button>

          <button
            type="button"
            onClick={handleAcceptClick}
            disabled={hasAccepted || timeLeft === 0}
            className={`px-4 py-2.5 rounded-md text-xs font-semibold transition-all cursor-pointer flex items-center justify-center gap-1.5 shadow-sm active:scale-[0.99] ${
              hasAccepted
                ? 'bg-neutral-800 text-neutral-400 border border-neutral-700 cursor-not-allowed'
                : 'bg-emerald-500 hover:bg-emerald-400 text-neutral-950 font-medium'
            }`}
          >
            <Check className="w-3.5 h-3.5" />
            <span>{hasAccepted ? 'Accepted' : 'Accept Match'}</span>
          </button>
        </div>
      </div>
    </div>
  );
}

