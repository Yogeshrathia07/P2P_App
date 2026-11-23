import React, { useState, useEffect } from 'react';
import {
  Calendar,
  CheckCircle2,
  Clock,
  Video,
  ChevronRight,
  Lock,
  Filter,
  User,
  ShieldAlert,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import DashboardLayout from '@/components/layout/DashboardLayout';
import SessionDetailDrawer from '@/components/dashboard/SessionDetailDrawer';
import MatchAcceptModal from '@/components/lobby/MatchAcceptModal';
import { getApiUrl } from '@/utils/api';

export default function Interviews() {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [history, setHistory] = useState([]);
  const [upcoming, setUpcoming] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState('all'); // 'all' | 'upcoming' | 'completed'
  const [selectedSession, setSelectedSession] = useState(null);

  const fetchData = async (isManual = false) => {
    if (isManual) setIsRefreshing(true);
    else setLoading(true);

    try {
      const [histRes, upcRes] = await Promise.all([
        fetch(getApiUrl('/api/sessions/history'), { credentials: 'include' }),
        fetch(getApiUrl('/api/sessions/upcoming'), { credentials: 'include' }),
      ]);

      if (histRes.ok) {
        const histData = await histRes.json();
        setHistory(histData.sessions || []);
      }
      if (upcRes.ok) {
        const upcData = await upcRes.json();
        setUpcoming(upcData.upcoming || []);
      }
    } catch (err) {
      console.error('Failed to load interviews:', err);
    } finally {
      setLoading(false);
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const getInitials = (name) => {
    if (!name) return 'PF';
    return name
      .split(' ')
      .map((part) => part[0])
      .join('')
      .toUpperCase()
      .substring(0, 2);
  };

  const filteredHistory = history.filter((session) => {
    if (activeTab === 'completed') {
      return session.feedback?.isRevealed === true;
    }
    return true;
  });

  return (
    <DashboardLayout
      title="Interviews"
      onRefresh={() => fetchData(true)}
      isRefreshing={isRefreshing}
    >
      <MatchAcceptModal />

      <div className="space-y-6">
        {/* Header summary banner */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-2 border-b border-neutral-900">
          <div>
            <h1 className="text-xl font-semibold tracking-tight text-white">
              Interview Sessions
            </h1>
            <p className="text-xs text-neutral-400 mt-0.5">
              Review your upcoming scheduled pairings, past interview records, and peer scorecards
            </p>
          </div>

          <button
            onClick={() => navigate('/lobby')}
            className="px-3.5 py-1.5 rounded-md bg-white hover:bg-neutral-200 text-neutral-950 text-xs font-semibold cursor-pointer transition-colors self-start sm:self-auto shadow-sm active:scale-[0.99]"
          >
            Find a Practice Partner
          </button>
        </div>

        {/* Section 1: Upcoming & Active Pairings */}
        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-xs font-semibold text-neutral-400 uppercase tracking-wider font-mono">
              Active &amp; Scheduled Sessions
            </h2>
            <span className="text-[11px] font-mono text-neutral-500">
              {upcoming.length} slot{upcoming.length === 1 ? '' : 's'}
            </span>
          </div>

          {loading ? (
            <div className="p-4 rounded-xl border border-neutral-800 bg-neutral-900/20 animate-pulse h-16" />
          ) : upcoming.length === 0 ? (
            <div className="p-4 rounded-xl border border-neutral-800/80 bg-neutral-900/20 text-xs text-neutral-400 flex items-center justify-between">
              <span>No active or upcoming interview rooms.</span>
              <button
                onClick={() => navigate('/lobby')}
                className="text-xs text-white hover:underline cursor-pointer font-medium"
              >
                Join queue in Matchmaking &rarr;
              </button>
            </div>
          ) : (
            <div className="space-y-2">
              {upcoming.map((slot) => (
                <div
                  key={slot._id || slot.roomId}
                  className="rounded-xl border border-neutral-800 bg-neutral-900/40 p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex items-center justify-center shrink-0">
                      <Video className="w-4 h-4" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-semibold text-white">
                          {slot.track || 'Practice Interview'}
                        </span>
                        <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-neutral-800 text-neutral-400">
                          {slot.difficulty || 'Mid-Level'}
                        </span>
                      </div>
                      <p className="text-[11px] text-neutral-400 mt-0.5">
                        Partner: {slot.peer?.name || 'Assigned Peer'} &bull; Status: Room open
                      </p>
                    </div>
                  </div>

                  <button
                    onClick={() => navigate(`/room/${slot.roomId}`)}
                    className="px-3.5 py-1.5 rounded-md bg-white hover:bg-neutral-200 text-neutral-950 text-xs font-semibold transition-colors cursor-pointer flex items-center justify-center gap-1.5 self-start sm:self-auto shadow-sm active:scale-[0.99]"
                  >
                    <Video className="w-3.5 h-3.5" />
                    <span>Launch Room</span>
                  </button>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Section 2: Past Interview History & Scorecards */}
        <section className="space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <h2 className="text-xs font-semibold text-neutral-400 uppercase tracking-wider font-mono">
              Completed Interview History
            </h2>

            {/* Filter Tabs */}
            <div className="flex items-center gap-1 p-0.5 rounded-lg border border-neutral-800 bg-neutral-900/60 self-start sm:self-auto">
              <button
                onClick={() => setActiveTab('all')}
                className={`px-2.5 py-1 rounded-md text-[11px] font-medium transition-colors cursor-pointer ${
                  activeTab === 'all'
                    ? 'bg-neutral-800 text-white font-semibold'
                    : 'text-neutral-400 hover:text-white'
                }`}
              >
                All Records ({history.length})
              </button>
              <button
                onClick={() => setActiveTab('completed')}
                className={`px-2.5 py-1 rounded-md text-[11px] font-medium transition-colors cursor-pointer ${
                  activeTab === 'completed'
                    ? 'bg-neutral-800 text-white font-semibold'
                    : 'text-neutral-400 hover:text-white'
                }`}
              >
                With Unlocked Scorecard
              </button>
            </div>
          </div>

          {loading ? (
            <div className="p-6 rounded-xl border border-neutral-800 bg-neutral-900/20 space-y-3 animate-pulse">
              <div className="h-8 bg-neutral-800/60 rounded" />
              <div className="h-8 bg-neutral-800/60 rounded" />
              <div className="h-8 bg-neutral-800/60 rounded" />
            </div>
          ) : filteredHistory.length === 0 ? (
            <div className="p-8 rounded-xl border border-neutral-800 bg-neutral-900/20 text-center space-y-2">
              <Calendar className="w-6 h-6 text-neutral-500 mx-auto mb-1" />
              <h3 className="text-sm font-semibold text-white">No interview records found</h3>
              <p className="text-xs text-neutral-400 max-w-sm mx-auto">
                Completed interview sessions and unlocked peer scorecards will appear here once you pair and evaluate.
              </p>
            </div>
          ) : (
            <div className="rounded-xl border border-neutral-800 bg-neutral-900/30 overflow-hidden font-sans">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-neutral-900/70 border-b border-neutral-800 text-neutral-400 font-mono text-[11px] uppercase tracking-wider">
                    <tr>
                      <th className="py-3 px-4">Track &amp; Level</th>
                      <th className="py-3 px-4">Peer Partner</th>
                      <th className="py-3 px-4">Date</th>
                      <th className="py-3 px-4">Evaluation Result</th>
                      <th className="py-3 px-4 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-neutral-800/60">
                    {filteredHistory.map((session) => {
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
                          onClick={() => setSelectedSession(session)}
                          className="hover:bg-neutral-900/70 transition-colors cursor-pointer group"
                        >
                          <td className="py-3.5 px-4">
                            <div className="font-semibold text-white">
                              {session.track || 'Practice Track'}
                            </div>
                            <div className="text-[11px] text-neutral-500 font-mono mt-0.5">
                              {session.difficulty || 'Mid-Level'}
                            </div>
                          </td>

                          <td className="py-3.5 px-4">
                            <div className="flex items-center gap-2">
                              <div className="w-6 h-6 rounded-md bg-neutral-800 border border-neutral-700 text-white text-[10px] font-mono font-semibold flex items-center justify-center shrink-0">
                                {getInitials(peer?.name)}
                              </div>
                              <span className="text-neutral-200 truncate max-w-[130px]">
                                {peer?.name || 'Anonymous Peer'}
                              </span>
                            </div>
                          </td>

                          <td className="py-3.5 px-4 font-mono text-neutral-300 tabular-nums">
                            {formattedDate}
                          </td>

                          <td className="py-3.5 px-4">
                            {!feedback ? (
                              <span className="text-neutral-500 font-mono text-[11px]">
                                Incomplete
                              </span>
                            ) : !isRevealed ? (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-mono bg-amber-500/10 text-amber-400 border border-amber-500/20">
                                <Lock className="w-3 h-3" />
                                Awaiting Partner
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[11px] font-mono bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                                <span className="font-semibold">{feedback.compositeScore}</span>
                                <span className="text-[10px] text-emerald-500/80">/ 5.0</span>
                              </span>
                            )}
                          </td>

                          <td className="py-3.5 px-4 text-right">
                            <span className="inline-flex items-center gap-1 text-xs text-neutral-400 group-hover:text-white font-medium transition-colors">
                              <span>View Scorecard</span>
                              <ChevronRight className="w-3.5 h-3.5" />
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </section>
      </div>

      {/* Slide-over Scorecard Drawer */}
      <SessionDetailDrawer
        isOpen={Boolean(selectedSession)}
        onClose={() => setSelectedSession(null)}
        session={selectedSession}
        currentUser={user}
      />
    </DashboardLayout>
  );
}

