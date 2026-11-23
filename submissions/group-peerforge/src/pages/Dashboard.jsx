import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Users,
  Video,
  ChevronRight,
  Lock,
  ArrowRight,
  Sparkles,
  Award,
} from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { useSocket } from '@/context/SocketContext';
import DashboardLayout from '@/components/layout/DashboardLayout';
import ProfileCompletionCard from '@/components/dashboard/ProfileCompletionCard';
import SessionDetailDrawer from '@/components/dashboard/SessionDetailDrawer';
import MatchAcceptModal from '@/components/lobby/MatchAcceptModal';
import { normalizeRoomCode, isValidRoomCode } from '@/utils/roomUtils';
import { getApiUrl } from '@/utils/api';

export default function Dashboard() {
  const { user } = useAuth();
  const { inQueue, elapsedSeconds } = useSocket();
  const navigate = useNavigate();

  const [history, setHistory] = useState([]);
  const [analytics, setAnalytics] = useState(null);
  const [upcoming, setUpcoming] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [selectedSession, setSelectedSession] = useState(null);
  const [quickCode, setQuickCode] = useState('');
  const [quickCodeError, setQuickCodeError] = useState('');

  const handleQuickJoin = (e) => {
    if (e) e.preventDefault();
    setQuickCodeError('');
    const cleanCode = normalizeRoomCode(quickCode);
    if (!cleanCode || !isValidRoomCode(cleanCode)) {
      setQuickCodeError('Invalid room code (e.g. PF-8921)');
      return;
    }
    navigate(`/room/${encodeURIComponent(cleanCode)}`);
  };

  const fetchData = async (isManualRefresh = false) => {
    if (isManualRefresh) setIsRefreshing(true);
    else setLoading(true);

    try {
      const [histRes, anaRes, upcRes] = await Promise.all([
        fetch(getApiUrl('/api/sessions/history'), { credentials: 'include' }),
        fetch(getApiUrl('/api/sessions/analytics'), { credentials: 'include' }),
        fetch(getApiUrl('/api/sessions/upcoming'), { credentials: 'include' }),
      ]);

      if (histRes.ok) {
        const histData = await histRes.json();
        setHistory(histData.sessions || []);
      }
      if (anaRes.ok) {
        const anaData = await anaRes.json();
        setAnalytics(anaData.analytics || null);
      }
      if (upcRes.ok) {
        const upcData = await upcRes.json();
        setUpcoming(upcData.upcoming || []);
      }
    } catch (err) {
      console.error('Failed to load dashboard data:', err);
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

  const totalSessions = analytics?.totalSessions || 0;
  const overallAverage = analytics?.overallAverage || 0;
  const competencies = analytics?.competencies || {};

  const competencyList = [
    { label: 'Code Correctness', score: competencies.codeCorrectness || 0 },
    { label: 'Problem Solving', score: competencies.problemSolving || 0 },
    { label: 'Communication', score: competencies.communication || 0 },
    { label: 'System Architecture', score: competencies.architecture || 0 },
  ];

  return (
    <DashboardLayout
      title="Overview"
      onRefresh={() => fetchData(true)}
      isRefreshing={isRefreshing}
    >
      {/* Global Socket Notification Modal */}
      <MatchAcceptModal />

      <div className="space-y-6">
        {/* Welcome & Context Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-2 border-b border-neutral-900">
          <div>
            <h1 className="text-xl font-semibold tracking-tight text-white">
              Welcome back, {user?.name?.split(' ')[0] || 'Developer'}
            </h1>
            <p className="text-xs text-neutral-400 mt-0.5">
              Here is what is happening with your technical mock interviews and practice sessions
            </p>
          </div>

          <div className="flex items-center gap-2.5 self-start sm:self-auto">
            <button
              onClick={() => navigate('/lobby')}
              className="px-3.5 py-1.5 rounded-md bg-white hover:bg-neutral-200 text-neutral-950 text-xs font-semibold cursor-pointer transition-colors flex items-center gap-1.5 shadow-sm active:scale-[0.99]"
            >
              <Users className="w-3.5 h-3.5 text-neutral-900" />
              <span>{inQueue ? 'View Active Queue' : 'Start Matchmaking'}</span>
            </button>
          </div>
        </div>

        {/* Profile Completion Callout (Only renders when essentials are missing) */}
        <ProfileCompletionCard user={user} />

        {/* Primary Activity Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left Column (Span 2): Active/Upcoming Sessions & Recent Interview Activity */}
          <div className="lg:col-span-2 space-y-6">
            {/* 1. Upcoming & Active Interviews */}
            <section className="space-y-3">
              <div className="flex items-center justify-between">
                <h2 className="text-xs font-semibold text-neutral-400 uppercase tracking-wider font-mono">
                  Upcoming &amp; Active Interviews
                </h2>
                {upcoming.length > 0 && (
                  <span className="text-[11px] font-mono text-neutral-400">
                    {upcoming.length} scheduled
                  </span>
                )}
              </div>

              {loading ? (
                <div className="rounded-xl border border-neutral-800 bg-neutral-900/20 p-5 animate-pulse h-20" />
              ) : upcoming.length === 0 ? (
                <div className="rounded-xl border border-neutral-800/80 bg-neutral-900/20 p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
                  <div>
                    <p className="font-medium text-neutral-200">No upcoming interviews</p>
                    <p className="text-neutral-400 mt-0.5 text-[11px]">
                      Your scheduled sessions will appear here when you connect with another developer.
                    </p>
                  </div>
                  <button
                    onClick={() => navigate('/lobby')}
                    className="text-xs text-white hover:underline font-medium cursor-pointer self-start sm:self-auto shrink-0"
                  >
                    Enter Matchmaking &rarr;
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
                            Partner: {slot.peer?.name || 'Assigned Peer'} &bull; Room active
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

            {/* 2. Recent Interview Activity */}
            <section className="space-y-3">
              <div className="flex items-center justify-between">
                <h2 className="text-xs font-semibold text-neutral-400 uppercase tracking-wider font-mono">
                  Recent Interview Activity
                </h2>
                {history.length > 0 && (
                  <button
                    onClick={() => navigate('/interviews')}
                    className="text-xs text-neutral-400 hover:text-white transition-colors cursor-pointer"
                  >
                    View all &rarr;
                  </button>
                )}
              </div>

              {loading ? (
                <div className="rounded-xl border border-neutral-800 bg-neutral-900/20 p-6 space-y-2 animate-pulse">
                  <div className="h-8 bg-neutral-800/40 rounded" />
                  <div className="h-8 bg-neutral-800/40 rounded" />
                </div>
              ) : history.length === 0 ? (
                <div className="rounded-xl border border-neutral-800/80 bg-neutral-900/20 p-5 text-xs text-neutral-400">
                  <p className="font-medium text-neutral-200">No interview history recorded</p>
                  <p className="text-neutral-400 mt-0.5 text-[11px]">
                    Once you complete a mock interview, your session logs and peer evaluation scorecards will be saved here.
                  </p>
                </div>
              ) : (
                <div className="rounded-xl border border-neutral-800 bg-neutral-900/30 overflow-hidden font-sans">
                  <div className="divide-y divide-neutral-800/60">
                    {history.slice(0, 4).map((session) => {
                      const peer = session.peer;
                      const feedback = session.feedback;
                      const isRevealed = feedback?.isRevealed;
                      const formattedDate = session.createdAt
                        ? new Date(session.createdAt).toLocaleDateString('en-US', {
                            month: 'short',
                            day: 'numeric',
                          })
                        : 'Recent';

                      return (
                        <div
                          key={session._id || session.roomId}
                          onClick={() => setSelectedSession(session)}
                          className="p-3.5 px-4 flex items-center justify-between hover:bg-neutral-900/70 transition-colors cursor-pointer group text-xs"
                        >
                          <div className="flex items-center gap-3">
                            <div className="w-7 h-7 rounded-md bg-neutral-800 border border-neutral-700 text-white text-[10px] font-mono font-semibold flex items-center justify-center shrink-0">
                              {getInitials(peer?.name)}
                            </div>
                            <div>
                              <div className="font-medium text-white group-hover:text-neutral-200">
                                {session.track}
                              </div>
                              <div className="text-[11px] text-neutral-400">
                                with {peer?.name || 'Anonymous Peer'} &bull; {formattedDate}
                              </div>
                            </div>
                          </div>

                          <div className="flex items-center gap-3">
                            {isRevealed && feedback?.compositeScore ? (
                              <span className="font-mono text-xs px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-semibold">
                                {feedback.compositeScore} / 5.0
                              </span>
                            ) : feedback ? (
                              <span className="inline-flex items-center gap-1 font-mono text-[10px] px-2 py-0.5 rounded bg-amber-500/10 text-amber-400 border border-amber-500/20">
                                <Lock className="w-3 h-3" />
                                <span>Awaiting Reveal</span>
                              </span>
                            ) : (
                              <span className="text-[11px] text-neutral-500 font-mono">
                                Incomplete
                              </span>
                            )}
                            <ChevronRight className="w-3.5 h-3.5 text-neutral-500 group-hover:text-white transition-colors" />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </section>
          </div>

          {/* Right Column: Matchmaking Status & Real Verified Competency Breakdown */}
          <div className="space-y-6">
            {/* Matchmaking Quick Jump */}
            <div className="rounded-xl border border-neutral-800 bg-neutral-900/40 p-5 space-y-3 font-sans">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-neutral-400 uppercase tracking-wider font-mono">
                  Matchmaking Queue
                </span>
                <span
                  className={`inline-flex items-center gap-1.5 text-xs font-medium ${
                    inQueue ? 'text-amber-400' : 'text-emerald-400'
                  }`}
                >
                  <span
                    className={`w-1.5 h-1.5 rounded-full ${
                      inQueue ? 'bg-amber-400 animate-pulse' : 'bg-emerald-500'
                    }`}
                  />
                  {inQueue ? 'Searching...' : 'Ready to Pair'}
                </span>
              </div>

              <p className="text-xs text-neutral-400 leading-relaxed">
                Connect with an active engineer for a structured 60-minute interview with live WebRTC and synced Monaco editor.
              </p>

              <button
                onClick={() => navigate('/lobby')}
                className="w-full py-2 px-3 rounded-md bg-neutral-900 hover:bg-neutral-850 text-white font-medium text-xs border border-neutral-800 hover:border-neutral-700 transition-colors cursor-pointer flex items-center justify-center gap-1.5"
              >
                <span>{inQueue ? 'Open Matchmaking Lobby' : 'Join Matchmaking Queue'}</span>
                <ArrowRight className="w-3 h-3 text-neutral-400" />
              </button>

              {/* Quick Join via Room Code */}
              <div className="pt-2 border-t border-neutral-800/80 space-y-1.5">
                <span className="block text-[11px] font-mono text-neutral-400">
                  Have a colleague's room code?
                </span>
                <form onSubmit={handleQuickJoin} className="flex items-center gap-1.5">
                  <input
                    type="text"
                    value={quickCode}
                    onChange={(e) => {
                      setQuickCode(e.target.value);
                      if (quickCodeError) setQuickCodeError('');
                    }}
                    placeholder="e.g. PF-8921"
                    className="flex-1 px-2.5 py-1.5 rounded bg-neutral-950 border border-neutral-800 text-xs font-mono text-white placeholder:text-neutral-600 focus:outline-none focus:border-neutral-600 transition-colors uppercase"
                  />
                  <button
                    type="submit"
                    disabled={!quickCode.trim()}
                    className="px-3 py-1.5 rounded bg-neutral-800 hover:bg-neutral-700 disabled:opacity-40 text-xs font-medium text-white transition-colors cursor-pointer shrink-0"
                  >
                    Join
                  </button>
                </form>
                {quickCodeError && (
                  <span className="text-[10px] text-rose-400 block">{quickCodeError}</span>
                )}
              </div>
            </div>

            {/* Real Skill Competencies (Only renders metrics when verified evaluations exist) */}
            {totalSessions > 0 ? (
              <div className="rounded-xl border border-neutral-800 bg-neutral-900/40 p-5 space-y-3 font-sans">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-neutral-400 uppercase tracking-wider font-mono">
                    Evaluation Competencies
                  </span>
                  <span className="text-xs font-mono text-white font-semibold">
                    {overallAverage.toFixed(1)} / 5.0
                  </span>
                </div>

                <p className="text-xs text-neutral-400">
                  Aggregated average across {totalSessions} completed peer evaluation{totalSessions === 1 ? '' : 's'}.
                </p>

                <div className="space-y-2.5 pt-1">
                  {competencyList.map((item) => {
                    const percentage = (item.score / 5) * 100;
                    return (
                      <div key={item.label} className="space-y-1">
                        <div className="flex justify-between items-center text-xs">
                          <span className="text-neutral-400">{item.label}</span>
                          <span className="font-mono text-white text-[11px] font-medium">
                            {item.score.toFixed(1)}
                          </span>
                        </div>
                        <div className="w-full h-1.5 rounded-full bg-neutral-800 overflow-hidden">
                          <div
                            className="h-full bg-white rounded-full transition-all duration-300"
                            style={{ width: `${percentage}%` }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ) : null}

            {/* Developer Focus Snapshot */}
            <div className="rounded-xl border border-neutral-800/80 bg-neutral-900/30 p-4 space-y-2.5 text-xs">
              <span className="text-xs font-semibold text-neutral-400 uppercase tracking-wider font-mono block">
                Your Focus
              </span>

              <div className="space-y-1.5 text-neutral-300">
                <div className="flex justify-between">
                  <span className="text-neutral-400">Target Roles</span>
                  <span className="font-medium text-white truncate max-w-[140px] text-right">
                    {user?.profile?.targetRoles?.length > 0
                      ? user.profile.targetRoles.join(', ')
                      : 'Not set'}
                  </span>
                </div>

                <div className="flex justify-between">
                  <span className="text-neutral-400">Timezone</span>
                  <span className="font-medium text-white truncate max-w-[140px] text-right">
                    {user?.profile?.timeZone || 'UTC'}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
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
