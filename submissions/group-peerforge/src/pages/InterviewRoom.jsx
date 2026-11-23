import React, { useState, useEffect, useCallback, useMemo } from "react";
import { useParams, useNavigate, useLocation } from "react-router-dom";
import { ArrowLeft, ShieldAlert, Wifi, WifiOff, Copy, Check, Link as LinkIcon, AlertCircle } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { useSocket } from "../context/SocketContext";
import { useWebRTC } from "../hooks/useWebRTC";
import { ProblemDrawer } from "../components/room/ProblemDrawer";
import { CodeEditor } from "../components/room/CodeEditor";
import { ConsoleDrawer } from "../components/room/ConsoleDrawer";
import { VideoTiles } from "../components/room/VideoTiles";
import { InterviewTimer } from "../components/room/InterviewTimer";
import { FeedbackFormModal } from "../components/feedback/FeedbackFormModal";
import { executeCode } from "../utils/codeExecutor";
import { PROBLEMS, getProblemsByTrack, getProblemById } from "../data/problems";
import { normalizeRoomCode, generateRoomLink } from "../utils/roomUtils";

/**
 * InterviewRoom
 * Main 3-column live technical mock interview workspace.
 */
export default function InterviewRoom() {
  const { roomId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();
  const { socket, isConnected } = useSocket();

  // Normalize room identifier so teammates on different hosts / cases share the exact session
  const cleanRoomId = useMemo(() => normalizeRoomCode(roomId), [roomId]);

  // Route state passes initial track/difficulty from lobby if available
  const initialTrack = location.state?.track || "Data Structures & Algorithms (DSA)";
  const initialDifficulty = location.state?.difficulty || "Mid-Level";

  // WebRTC Media & Peer Hook
  const {
    localStream,
    remoteStream,
    isMuted,
    isVideoOff,
    isScreenSharing,
    connectionStatus,
    peerMediaStatus,
    toggleAudio,
    toggleVideo,
    toggleScreenShare,
    leaveCall,
  } = useWebRTC(socket, cleanRoomId, user);

  // Room & Layout State
  const [track, setTrack] = useState(initialTrack);
  const [difficulty, setDifficulty] = useState(initialDifficulty);
  const [userRole, setUserRole] = useState("candidate"); // "candidate" | "interviewer"
  const [peerRole, setPeerRole] = useState("interviewer");
  const [peerUser, setPeerUser] = useState(null);
  const [timerState, setTimerState] = useState(null);
  const [copiedCode, setCopiedCode] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);
  const [joinError, setJoinError] = useState(null);

  // Problem & Code State
  const [problem, setProblem] = useState(() => getProblemsByTrack(initialTrack)[0] || PROBLEMS[0]);
  const [language, setLanguage] = useState("javascript");
  const [code, setCode] = useState(() => problem.starterCode?.javascript || "");

  // Execution & Drawer State
  const [isRunning, setIsRunning] = useState(false);
  const [testResults, setTestResults] = useState([]);
  const [consoleLogs, setConsoleLogs] = useState([]);
  const [executionTimeMs, setExecutionTimeMs] = useState(undefined);
  const [executionError, setExecutionError] = useState(null);

  const [isProblemDrawerCollapsed, setIsProblemDrawerCollapsed] = useState(false);
  const [isConsoleCollapsed, setIsConsoleCollapsed] = useState(false);
  const [leaveModalOpen, setLeaveModalOpen] = useState(false);
  const [feedbackModalOpen, setFeedbackModalOpen] = useState(false);

  // Normalized current user ID
  const myUserId = (user?.id || user?._id)?.toString();

  // Initialize and Join Room on Mount or when socket connects
  useEffect(() => {
    if (!socket || !cleanRoomId) return;

    const joinSessionRoom = () => {
      console.log(`[InterviewRoom] Joining room: ${cleanRoomId}`);
      socket.emit(
        "room:join",
        {
          roomId: cleanRoomId,
          track,
          difficulty,
          user: {
            id: myUserId,
            name: user?.name,
            avatarUrl: user?.profile?.avatarUrl,
          },
        },
        (response) => {
          if (!response?.success) {
            setJoinError(response?.message || "Room is unavailable or at maximum capacity (2 peers).");
            return;
          }

          setUserRole(response.myRole || "candidate");
          setPeerRole(response.myRole === "candidate" ? "interviewer" : "candidate");
          if (response.track) setTrack(response.track);
          if (response.difficulty) setDifficulty(response.difficulty);
          if (response.timer) setTimerState(response.timer);

          // Find other peer if already in room
          if (response.participants) {
            const partner = response.participants.find((p) => p.userId !== myUserId);
            if (partner) {
              setPeerUser(partner);
              setPeerRole(partner.role);
            }
          }

          // Restore synced problem if preset
          if (response.activeProblemId) {
            const activeProb = getProblemById(response.activeProblemId);
            setProblem(activeProb);
            if (response.code) {
              setCode(response.code);
            } else {
              setCode(activeProb.starterCode?.[response.language || "javascript"] || "");
            }
          }

          if (response.language) {
            setLanguage(response.language);
          }
        }
      );
    };

    if (socket.connected) {
      joinSessionRoom();
    }

    socket.on("connect", joinSessionRoom);

    // Listeners for peer lifecycle
    const handlePeerJoined = ({ peer, participants }) => {
      if (peer) {
        setPeerUser(peer);
        if (peer.role) setPeerRole(peer.role);
      }
    };

    const handleParticipantsUpdated = ({ participants }) => {
      if (participants) {
        const partner = participants.find((p) => p.userId !== myUserId);
        if (partner) {
          setPeerUser(partner);
          if (partner.role) setPeerRole(partner.role);
        }
      }
    };

    const handlePeerLeft = () => {
      setPeerUser(null);
    };

    // Role swap listener
    const handleRoleSwapped = ({ participants }) => {
      if (participants) {
        const me = participants.find((p) => p.userId === myUserId);
        const them = participants.find((p) => p.userId !== myUserId);
        if (me) setUserRole(me.role);
        if (them) setPeerRole(them.role);
      }
    };

    // Problem update listener
    const handleProblemUpdated = ({ problemId, code: newCode }) => {
      const nextProblem = getProblemById(problemId);
      setProblem(nextProblem);
      if (newCode) setCode(newCode);
    };

    socket.on("room:peer-joined", handlePeerJoined);
    socket.on("room:participants-updated", handleParticipantsUpdated);
    socket.on("room:peer-left", handlePeerLeft);
    socket.on("room:role-swapped", handleRoleSwapped);
    socket.on("room:problem-updated", handleProblemUpdated);

    return () => {
      socket.off("connect", joinSessionRoom);
      socket.off("room:peer-joined", handlePeerJoined);
      socket.off("room:participants-updated", handleParticipantsUpdated);
      socket.off("room:peer-left", handlePeerLeft);
      socket.off("room:role-swapped", handleRoleSwapped);
      socket.off("room:problem-updated", handleProblemUpdated);
    };
  }, [socket, isConnected, cleanRoomId, track, difficulty, myUserId]);

  // Code change handler
  const handleCodeChange = useCallback((newCode, shouldSync = true) => {
    setCode(newCode);
  }, []);

  // Language change handler
  const handleLanguageChange = useCallback(
    (newLang, shouldSync = true) => {
      setLanguage(newLang);
      if (problem.starterCode?.[newLang]) {
        setCode(problem.starterCode[newLang]);
      }
    },
    [problem]
  );

  // Reset code to starter template
  const handleResetCode = () => {
    const starter = problem.starterCode?.[language] || "";
    setCode(starter);
    if (socket && cleanRoomId) {
      socket.emit("room:code-change", {
        roomId: cleanRoomId,
        code: starter,
        version: Date.now(),
      });
    }
  };

  // Switch problem prompt (Interviewer action)
  const handleSelectProblem = (newProb) => {
    setProblem(newProb);
    const starter = newProb.starterCode?.[language] || "";
    setCode(starter);
    setTestResults([]);
    setConsoleLogs([]);
    setExecutionError(null);

    if (socket && cleanRoomId) {
      socket.emit("room:problem-change", {
        roomId: cleanRoomId,
        problemId: newProb.id,
        starterCode: starter,
      });
    }
  };

  // Run in-browser code evaluation
  const handleRunCode = async () => {
    setIsRunning(true);
    setExecutionError(null);
    setIsConsoleCollapsed(false); // Auto-expand console drawer on run

    try {
      const result = await executeCode({
        code,
        language,
        problem,
      });

      setTestResults(result.testResults || []);
      setConsoleLogs(result.consoleLogs || []);
      setExecutionTimeMs(result.executionTimeMs);
      setExecutionError(result.error);
    } catch (err) {
      setExecutionError(err.message || "Failed to execute code");
    } finally {
      setIsRunning(false);
    }
  };

  // Role swap trigger
  const handleSwapRoles = () => {
    if (socket && cleanRoomId) {
      socket.emit("room:role-swap", { roomId: cleanRoomId });
    }
  };

  const handleCopyRoomCode = async () => {
    if (!cleanRoomId) return;
    try {
      await navigator.clipboard.writeText(cleanRoomId);
      setCopiedCode(true);
      setTimeout(() => setCopiedCode(false), 2500);
    } catch (e) {
      console.error("Failed to copy code", e);
    }
  };

  const handleCopyRoomLink = async () => {
    if (!cleanRoomId) return;
    try {
      const link = generateRoomLink(cleanRoomId);
      await navigator.clipboard.writeText(link);
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2500);
    } catch (e) {
      console.error("Failed to copy link", e);
    }
  };

  // Clean exit & transition into post-session feedback
  const handleConfirmLeave = () => {
    setLeaveModalOpen(false);
    leaveCall();
    if (socket && cleanRoomId) {
      socket.emit("room:leave", { roomId: cleanRoomId });
    }
    if (peerUser) {
      setFeedbackModalOpen(true);
    } else {
      navigate("/dashboard");
    }
  };

  return (
    <div className="h-screen w-screen bg-neutral-950 text-neutral-100 flex flex-col font-sans overflow-hidden select-none">
      {/* Top Navigation Bar */}
      <header className="h-12 border-b border-neutral-800 bg-neutral-950/90 backdrop-blur px-4 flex items-center justify-between z-40 shrink-0">
        {/* Left: Branding & Code Badge */}
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => setLeaveModalOpen(true)}
            className="p-1.5 rounded text-neutral-400 hover:text-neutral-100 hover:bg-neutral-900 border border-neutral-800 transition-colors cursor-pointer"
            title="Leave Session"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div className="flex items-center gap-2">
            <span className="font-semibold text-xs tracking-tight text-neutral-100">PeerForge</span>
            <span className="text-neutral-600 text-xs">/</span>
            
            {/* Room Code Badge */}
            <div className="flex items-center gap-1.5 bg-neutral-900 border border-neutral-800 px-2 py-0.5 rounded-md whitespace-nowrap shrink-0">
              <span className="text-[10px] text-neutral-400 font-mono uppercase tracking-wider">Code:</span>
              <span className="text-xs font-mono font-bold text-emerald-400 tracking-wider select-all">
                {cleanRoomId}
              </span>
              <button
                type="button"
                onClick={handleCopyRoomCode}
                title="Copy Room Code for teammate"
                className="ml-1 p-0.5 rounded text-neutral-400 hover:text-white transition-colors cursor-pointer"
              >
                {copiedCode ? (
                  <Check className="w-3.5 h-3.5 text-emerald-400" />
                ) : (
                  <Copy className="w-3.5 h-3.5" />
                )}
              </button>
              <button
                type="button"
                onClick={handleCopyRoomLink}
                title="Copy direct invite URL"
                className="p-0.5 rounded text-neutral-400 hover:text-white transition-colors cursor-pointer"
              >
                {copiedLink ? (
                  <Check className="w-3.5 h-3.5 text-emerald-400" />
                ) : (
                  <LinkIcon className="w-3.5 h-3.5" />
                )}
              </button>
            </div>
          </div>
          <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-neutral-900 border border-neutral-800 text-neutral-400 hidden xl:inline">
            {track}
          </span>
        </div>

        {/* Center: Global 60-min Timer & Role Controller */}
        <InterviewTimer
          userRole={userRole}
          partnerRole={peerRole}
          timerState={timerState}
          onSwapRoles={handleSwapRoles}
        />

        {/* Right: Connection State */}
        <div className="flex items-center gap-2.5">
          <span className="flex items-center gap-1.5 px-2.5 py-1 rounded bg-neutral-900 border border-neutral-800 text-[11px] font-mono text-neutral-300">
            <span
              className={`w-1.5 h-1.5 rounded-full ${
                isConnected ? "bg-emerald-500 animate-pulse" : "bg-rose-500"
              }`}
            />
            <span className="hidden sm:inline">{isConnected ? "Connected" : "Disconnected"}</span>
          </span>
        </div>
      </header>

      {/* Main 3-Column Workspace Canvas */}
      <div className="flex-1 flex overflow-hidden">
        {/* Column 1: Problem Specification Drawer (Left 25% or Collapsed) */}
        <div
          className={`h-full transition-all duration-200 shrink-0 ${
            isProblemDrawerCollapsed ? "w-10" : "w-1/4 min-w-[280px] max-w-[380px]"
          }`}
        >
          <ProblemDrawer
            problem={problem}
            track={track}
            userRole={userRole}
            isCollapsed={isProblemDrawerCollapsed}
            onToggleCollapse={() => setIsProblemDrawerCollapsed(!isProblemDrawerCollapsed)}
            onSelectProblem={handleSelectProblem}
          />
        </div>

        {/* Column 2: Collaborative Monaco Editor + Test Console (Center Flex) */}
        <div className="flex-1 h-full flex flex-col min-w-0">
          {/* Monaco Editor (flex-1) */}
          <div className="flex-1 min-h-0">
            <CodeEditor
              code={code}
              language={language}
              onChangeCode={handleCodeChange}
              onChangeLanguage={handleLanguageChange}
              onResetCode={handleResetCode}
              onRunCode={handleRunCode}
              isRunning={isRunning}
              socket={socket}
              roomId={cleanRoomId}
              peerName={peerUser?.name}
            />
          </div>

          {/* Test & Output Console Drawer (docked at bottom) */}
          <ConsoleDrawer
            testResults={testResults}
            consoleLogs={consoleLogs}
            executionTimeMs={executionTimeMs}
            error={executionError}
            isCollapsed={isConsoleCollapsed}
            onToggleCollapse={() => setIsConsoleCollapsed(!isConsoleCollapsed)}
          />
        </div>

        {/* Column 3: WebRTC Video Tiles & AV Controls (Right 20%) */}
        <div className="w-1/5 min-w-[260px] max-w-[320px] h-full shrink-0">
          <VideoTiles
            localStream={localStream}
            remoteStream={remoteStream}
            isMuted={isMuted}
            isVideoOff={isVideoOff}
            isScreenSharing={isScreenSharing}
            connectionStatus={connectionStatus}
            peerMediaStatus={peerMediaStatus}
            user={user}
            peerUser={peerUser}
            userRole={userRole}
            peerRole={peerRole}
            onToggleAudio={toggleAudio}
            onToggleVideo={toggleVideo}
            onToggleScreenShare={toggleScreenShare}
            onLeaveRoom={() => setLeaveModalOpen(true)}
          />
        </div>
      </div>

      {/* Leave Session Confirmation Dialog */}
      {leaveModalOpen && (
        <div className="fixed inset-0 bg-neutral-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-5 max-w-sm w-full space-y-4 shadow-2xl">
            <div className="flex items-center gap-2 text-rose-400">
              <ShieldAlert className="w-5 h-5" />
              <h3 className="font-mono text-sm font-semibold text-neutral-100">
                Leave Interview Session?
              </h3>
            </div>
            <p className="text-xs text-neutral-400 leading-relaxed">
              Leaving the room will disconnect your audio, video, and collaborative code session with
              your peer.
            </p>
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setLeaveModalOpen(false)}
                className="px-3 py-1.5 rounded text-xs font-mono bg-neutral-800 text-neutral-300 hover:bg-neutral-700 transition-colors"
              >
                Stay
              </button>
              <button
                type="button"
                onClick={handleConfirmLeave}
                className="px-3 py-1.5 rounded text-xs font-mono bg-rose-600 text-white font-semibold hover:bg-rose-500 transition-colors"
              >
                Leave Session
              </button>
            </div>
          </div>
        </div>
      )}
      {/* Join Error Modal (e.g. room full or capacity exceeded) */}
      {joinError && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="max-w-md w-full bg-neutral-900 border border-neutral-800 rounded-xl p-6 space-y-4 shadow-2xl">
            <div className="flex items-center gap-3 text-amber-400">
              <ShieldAlert className="w-5 h-5 shrink-0" />
              <h3 className="text-sm font-semibold text-white">Room Notice</h3>
            </div>
            <p className="text-xs text-neutral-300 leading-relaxed">
              {joinError}
            </p>
            <div className="pt-2">
              <button
                type="button"
                onClick={() => navigate("/lobby")}
                className="w-full py-2.5 px-4 rounded-md bg-white hover:bg-neutral-200 text-neutral-950 text-xs font-semibold cursor-pointer transition-colors"
              >
                Return to Matchmaking Lobby
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Post-Session Symmetric Blind Feedback Modal */}
      <FeedbackFormModal
        isOpen={feedbackModalOpen}
        roomId={cleanRoomId}
        candidate={peerUser}
        track={track}
        socket={socket}
        onClose={() => {
          setFeedbackModalOpen(false);
          navigate("/dashboard");
        }}
        onCompleted={() => {
          setFeedbackModalOpen(false);
          navigate("/dashboard");
        }}
      />
    </div>
  );
}
