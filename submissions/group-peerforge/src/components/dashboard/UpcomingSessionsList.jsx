import React from 'react';
import { Calendar, Clock, Video, ArrowRight, User } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

/**
 * UpcomingSessionsList: Displays upcoming or active interview pairings with 1-click room launch.
 */
export default function UpcomingSessionsList({ upcoming = [], loading }) {
  const navigate = useNavigate();

  if (loading) {
    return (
      <div className="rounded-xl border border-neutral-800 bg-neutral-900/20 p-4 animate-pulse">
        <div className="h-4 bg-neutral-800 rounded w-1/5 mb-3" />
        <div className="h-12 bg-neutral-800/40 rounded" />
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-neutral-800 bg-neutral-900/30 p-5 font-sans">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Calendar className="w-4 h-4 text-neutral-400" />
          <h3 className="text-sm font-medium text-white">Upcoming & Active Interviews</h3>
        </div>
        <span className="text-[11px] font-mono text-neutral-500">
          {upcoming.length} scheduled
        </span>
      </div>

      {upcoming.length === 0 ? (
        <div className="rounded-lg border border-neutral-800/80 bg-neutral-950/40 p-4 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs">
          <div className="text-neutral-400 text-center sm:text-left">
            <span>No upcoming interviews booked. </span>
            <span className="text-neutral-500 hidden sm:inline">
              Pair with another developer in the lobby anytime.
            </span>
          </div>

          <button
            onClick={() => navigate('/lobby')}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-neutral-900 hover:bg-neutral-850 text-neutral-300 hover:text-white border border-neutral-800 hover:border-neutral-700 text-xs font-medium cursor-pointer transition-colors"
          >
            <span>Enter Matchmaking Lobby</span>
            <ArrowRight className="w-3 h-3" />
          </button>
        </div>
      ) : (
        <div className="space-y-2">
          {upcoming.map((slot) => {
            const peer = slot.peer;
            return (
              <div
                key={slot._id || slot.roomId}
                className="rounded-lg border border-neutral-800 bg-neutral-900/60 p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
              >
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-md bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex items-center justify-center">
                    <Video className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-medium text-white">
                        {slot.track || 'Practice Interview'}
                      </span>
                      <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-neutral-800 text-neutral-400">
                        {slot.difficulty || 'Mid-Level'}
                      </span>
                    </div>
                    <div className="text-[11px] text-neutral-400 font-mono mt-0.5 flex items-center gap-2">
                      <span>Peer: {peer?.name || 'Assigned Developer'}</span>
                      <span>•</span>
                      <span className="text-emerald-400">Ready to join</span>
                    </div>
                  </div>
                </div>

                <button
                  onClick={() => navigate(`/room/${slot.roomId}`)}
                  className="px-3.5 py-1.5 rounded-md bg-white hover:bg-neutral-200 text-neutral-950 text-xs font-medium transition-colors cursor-pointer flex items-center justify-center gap-1.5 shadow-sm active:scale-[0.99] self-start sm:self-auto"
                >
                  <Video className="w-3.5 h-3.5 text-neutral-900" />
                  <span>Launch Interview Room</span>
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
