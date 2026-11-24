import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  Code2,
  Video,
  ArrowRight,
  ShieldCheck,
  CheckCircle2,
  Clock,
  Users2,
  Shuffle,
  ChevronRight,
  Terminal,
  Play,
  Copy,
  Check,
  Laptop,
  Cpu,
  Sparkles,
  ArrowUpRight,
  Star,
  FileCode,
  Layers,
  HelpCircle,
} from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { PROBLEMS } from "@/data/problems";

export default function Landing() {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [activeTrack, setActiveTrack] = useState("Data Structures & Algorithms (DSA)");
  const [copiedCode, setCopiedCode] = useState(false);

  const tracks = [
    "Data Structures & Algorithms (DSA)",
    "Frontend Web Architecture",
    "Backend & System Design",
  ];

  const filteredProblems = PROBLEMS.filter((p) => p.track === activeTrack).slice(0, 4);

  const handleCopySampleCode = () => {
    navigator.clipboard.writeText("PF-7K2M9X");
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 2000);
  };

  return (
    <div className="min-h-screen bg-white text-neutral-900 selection:bg-neutral-900 selection:text-white font-sans antialiased">
      {/* 1. TOP NAVIGATION BAR */}
      <header className="sticky top-0 z-50 bg-white/80 backdrop-blur-md border-b border-neutral-200/80 transition-all">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          {/* Logo & Brand */}
          <Link to="/" className="flex items-center gap-2.5 group">
            <div className="w-8 h-8 rounded-lg bg-black flex items-center justify-center text-white font-mono font-bold text-sm tracking-wider shadow-sm group-hover:scale-105 transition-transform">
              PF
            </div>
            <div className="flex flex-col">
              <span className="font-bold text-base tracking-tight text-neutral-950 font-sans">
                PeerForge
              </span>
              <span className="text-[9px] font-mono uppercase tracking-widest text-neutral-400 -mt-1 hidden sm:block">
                P2P Mock Workspace
              </span>
            </div>
          </Link>

          {/* Navigation Links */}
          <nav className="hidden md:flex items-center gap-8 text-xs font-medium text-neutral-600">
            <a href="#how-it-works" className="hover:text-neutral-950 transition-colors">
              How It Works
            </a>
            <a href="#workspace" className="hover:text-neutral-950 transition-colors">
              Live Workspace
            </a>
            <a href="#tracks" className="hover:text-neutral-950 transition-colors">
              Problem Tracks
            </a>
            <a href="#architecture" className="hover:text-neutral-950 transition-colors">
              P2P Protocol
            </a>
            <a href="#faq" className="hover:text-neutral-950 transition-colors">
              FAQ
            </a>
          </nav>

          {/* Action CTAs */}
          <div className="flex items-center gap-3">
            {user ? (
              <Link
                to="/dashboard"
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-black text-white hover:bg-neutral-800 text-xs font-medium transition-all shadow-sm active:scale-95"
              >
                <span>Dashboard</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            ) : (
              <>
                <Link
                  to="/login"
                  className="px-3 py-1.5 text-xs font-medium text-neutral-700 hover:text-neutral-950 transition-colors"
                >
                  Sign In
                </Link>
                <Link
                  to="/login"
                  className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-black text-white hover:bg-neutral-800 text-xs font-medium transition-all shadow-sm active:scale-95"
                >
                  <span>Get Started</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </Link>
              </>
            )}
          </div>
        </div>
      </header>

      {/* 2. HERO SECTION */}
      <section className="relative pt-20 pb-16 md:pt-28 md:pb-24 overflow-hidden border-b border-neutral-100">
        {/* Subtle grid pattern background */}
        <div className="absolute inset-0 bg-[radial-gradient(#e5e7eb_1px,transparent_1px)] [background-size:24px_24px] opacity-60 pointer-events-none" />

        <div className="relative max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 text-center space-y-6">
          {/* Top Micro Badge */}
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-neutral-100 border border-neutral-200 text-neutral-800 text-[11px] font-mono font-medium tracking-wide">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
            <span>DECENTRALIZED TECHNICAL INTERVIEW EXCHANGE</span>
          </div>

          {/* Headline with Commanding Typography */}
          <h1 className="text-4xl sm:text-6xl md:text-7xl font-bold tracking-tight text-neutral-950 font-sans leading-[1.08] max-w-4xl mx-auto">
            Master the technical interview with peers, not bots.
          </h1>

          {/* Subtitle */}
          <p className="text-base sm:text-lg md:text-xl text-neutral-600 max-w-2xl mx-auto leading-relaxed font-normal">
            Practice real engineering interviews over live WebRTC video, synchronized Monaco code
            editor, and bidirectional 60-minute role rotations. Receive honest, double-blind feedback.
          </p>

          {/* Hero Action Buttons */}
          <div className="pt-4 flex flex-col sm:flex-row items-center justify-center gap-3">
            <Link
              to={user ? "/dashboard" : "/login"}
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 py-3.5 rounded-xl bg-black text-white hover:bg-neutral-800 text-sm font-semibold transition-all duration-150 shadow-md hover:shadow-lg active:scale-[0.98]"
            >
              <span>{user ? "Enter Developer Workspace" : "Start Practicing for Free"}</span>
              <ArrowRight className="w-4 h-4" />
            </Link>
            <a
              href="#workspace"
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 py-3.5 rounded-xl bg-neutral-100 text-neutral-800 hover:bg-neutral-200 text-sm font-semibold transition-all duration-150 border border-neutral-200"
            >
              <span>See Live Workspace</span>
              <Laptop className="w-4 h-4 text-neutral-500" />
            </a>
          </div>

          {/* Trust & Spec Badges */}
          <div className="pt-8 flex flex-wrap items-center justify-center gap-y-2 gap-x-6 text-xs font-mono text-neutral-500">
            <span className="flex items-center gap-1.5">
              <CheckCircle2 className="w-3.5 h-3.5 text-neutral-900" /> 100% Free & Open
            </span>
            <span className="flex items-center gap-1.5">
              <CheckCircle2 className="w-3.5 h-3.5 text-neutral-900" /> WebRTC Audio & Video
            </span>
            <span className="flex items-center gap-1.5">
              <CheckCircle2 className="w-3.5 h-3.5 text-neutral-900" /> Collaborative Monaco Editor
            </span>
            <span className="flex items-center gap-1.5">
              <CheckCircle2 className="w-3.5 h-3.5 text-neutral-900" /> Double-Blind Rubric
            </span>
          </div>
        </div>
      </section>

      {/* 3. INTERACTIVE HERO WORKSPACE PREVIEW */}
      <section id="workspace" className="py-16 md:py-24 bg-neutral-950 text-neutral-100">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center space-y-3 mb-10">
            <span className="text-[11px] font-mono uppercase tracking-widest text-neutral-400">
              The PeerForge Environment
            </span>
            <h2 className="text-2xl sm:text-4xl font-bold tracking-tight text-white font-sans">
              A high-focus 3-column live interview workspace
            </h2>
            <p className="text-sm text-neutral-400 max-w-xl mx-auto">
              Everything required for a rigorous FAANG-style interview: problem specs, collaborative
              coding, test harness, and live video in one unified layout.
            </p>
          </div>

          {/* Workspace Mockup Card */}
          <div className="relative rounded-2xl border border-neutral-800 bg-black overflow-hidden shadow-2xl">
            {/* Top Workspace Header Bar */}
            <div className="h-12 border-b border-neutral-800 bg-neutral-950 px-4 flex items-center justify-between text-xs font-mono">
              <div className="flex items-center gap-3">
                <span className="font-bold text-white tracking-tight">PeerForge</span>
                <span className="text-neutral-600">/</span>
                <div className="flex items-center gap-1.5 bg-neutral-900 border border-neutral-800 px-2 py-0.5 rounded text-[11px]">
                  <span className="text-neutral-500">ROOM:</span>
                  <span className="text-emerald-400 font-bold">PF-7K2M9X</span>
                  <button
                    onClick={handleCopySampleCode}
                    className="ml-1 text-neutral-400 hover:text-white"
                    title="Copy code"
                  >
                    {copiedCode ? (
                      <Check className="w-3 h-3 text-emerald-400" />
                    ) : (
                      <Copy className="w-3 h-3" />
                    )}
                  </button>
                </div>
                <span className="hidden sm:inline text-neutral-500 text-[11px]">
                  Data Structures & Algorithms (DSA)
                </span>
              </div>

              {/* Center Timer */}
              <div className="flex items-center gap-2 bg-neutral-900 border border-neutral-800 px-2.5 py-1 rounded">
                <Clock className="w-3.5 h-3.5 text-neutral-400" />
                <span className="font-bold text-neutral-200">54:20</span>
                <span className="text-[10px] text-neutral-500 border-l border-neutral-800 pl-2 hidden md:inline">
                  Phase 1: Candidate Round
                </span>
              </div>

              {/* Connection Indicator */}
              <div className="flex items-center gap-2">
                <span className="flex items-center gap-1.5 text-[11px] text-neutral-300 bg-neutral-900 border border-neutral-800 px-2.5 py-1 rounded">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                  <span>Connected</span>
                </span>
              </div>
            </div>

            {/* 3-Column Workspace Simulation */}
            <div className="grid grid-cols-1 lg:grid-cols-12 min-h-[520px]">
              {/* Column 1: Problem Spec (3 cols) */}
              <div className="lg:col-span-3 border-b lg:border-b-0 lg:border-r border-neutral-800 p-5 space-y-4 bg-neutral-950/60">
                <div className="flex items-center gap-2">
                  <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-emerald-950/60 text-emerald-400 border border-emerald-800/40">
                    Junior
                  </span>
                  <span className="text-xs text-neutral-400 font-mono">Problem 1 of 12</span>
                </div>
                <h3 className="text-base font-bold text-white tracking-tight">Two Sum</h3>
                <p className="text-xs text-neutral-400 leading-relaxed font-sans">
                  Given an array of integers <code className="text-neutral-200 font-mono">nums</code> and
                  an integer <code className="text-neutral-200 font-mono">target</code>, return indices
                  of the two numbers such that they add up to target.
                </p>
                <div className="p-3 rounded-lg bg-neutral-900/80 border border-neutral-800 space-y-1 font-mono text-[11px]">
                  <div className="text-neutral-400">Example 1:</div>
                  <div className="text-neutral-300">Input: nums = [2,7,11,15], target = 9</div>
                  <div className="text-emerald-400">Output: [0,1]</div>
                </div>
                <div className="space-y-1.5 text-[11px] text-neutral-500 font-mono">
                  <div>• Exactly one valid solution exists</div>
                  <div>• O(n) time complexity expected</div>
                </div>
              </div>

              {/* Column 2: Collaborative Monaco Editor & Test Console (6 cols) */}
              <div className="lg:col-span-6 flex flex-col border-b lg:border-b-0 lg:border-r border-neutral-800 bg-black">
                {/* Editor Tab Bar */}
                <div className="h-9 border-b border-neutral-800 bg-neutral-950 px-3 flex items-center justify-between text-xs font-mono text-neutral-400">
                  <div className="flex items-center gap-2">
                    <FileCode className="w-3.5 h-3.5 text-neutral-300" />
                    <span className="text-neutral-200 text-[11px]">solution.js</span>
                    <span className="text-[10px] text-neutral-600">• Synced via WebSocket</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <button className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded bg-neutral-100 hover:bg-white text-neutral-950 text-[11px] font-semibold transition-colors cursor-pointer">
                      <Play className="w-3 h-3 fill-neutral-950" />
                      <span>Run (Ctrl+Enter)</span>
                    </button>
                  </div>
                </div>

                {/* Simulated Monaco Editor Lines */}
                <div className="flex-1 p-4 font-mono text-xs leading-relaxed text-neutral-300 space-y-1 overflow-x-auto">
                  <div className="text-neutral-600">// Real-time collaborative typing with under 150ms latency</div>
                  <div>
                    <span className="text-purple-400">function</span>{" "}
                    <span className="text-blue-400">twoSum</span>(nums, target) &#123;
                  </div>
                  <div className="pl-4">
                    <span className="text-purple-400">const</span> map ={" "}
                    <span className="text-purple-400">new</span>{" "}
                    <span className="text-yellow-400">Map</span>();
                  </div>
                  <div className="pl-4">
                    <span className="text-purple-400">for</span> (
                    <span className="text-purple-400">let</span> i = 0; i &lt; nums.length; i++) &#123;
                  </div>
                  <div className="pl-8">
                    <span className="text-purple-400">const</span> complement = target - nums[i];
                  </div>
                  <div className="pl-8">
                    <span className="text-purple-400">if</span> (map.has(complement)) &#123;
                  </div>
                  <div className="pl-12">
                    <span className="text-purple-400">return</span> [map.get(complement), i];
                  </div>
                  <div className="pl-8">&#125;</div>
                  <div className="pl-8 flex items-center">
                    <span>map.set(nums[i], i);</span>
                    {/* Live Remote Peer Cursor */}
                    <span className="inline-block w-0.5 h-4 bg-emerald-400 animate-pulse ml-1" />
                    <span className="text-[9px] bg-emerald-500 text-black px-1 rounded ml-1 font-sans font-bold">
                      Alex (Interviewer)
                    </span>
                  </div>
                  <div className="pl-4">&#125;</div>
                  <div className="pl-4">
                    <span className="text-purple-400">return</span> [];
                  </div>
                  <div>&#125;</div>
                </div>

                {/* Bottom Test Output Console */}
                <div className="h-28 border-t border-neutral-800 bg-neutral-950 p-3 font-mono text-xs space-y-2">
                  <div className="flex items-center justify-between text-[11px] text-neutral-500 border-b border-neutral-800 pb-1.5">
                    <span className="flex items-center gap-1.5 text-emerald-400 font-bold">
                      <Check className="w-3.5 h-3.5" /> All Test Assertions Passed (2/2)
                    </span>
                    <span className="text-neutral-500">Execution: 12ms</span>
                  </div>
                  <div className="text-[11px] text-neutral-400 space-y-1">
                    <div>✓ Case 1: nums=[2,7,11,15], target=9 &rarr; [0, 1]</div>
                    <div>✓ Case 2: nums=[3,2,4], target=6 &rarr; [1, 2]</div>
                  </div>
                </div>
              </div>

              {/* Column 3: WebRTC Video Tiles & Controls (3 cols) */}
              <div className="lg:col-span-3 p-4 flex flex-col justify-between bg-neutral-950/80 space-y-3">
                {/* Remote Peer Video Tile */}
                <div className="flex-1 rounded-xl bg-neutral-900 border border-neutral-800 relative overflow-hidden flex flex-col items-center justify-center p-4 aspect-video">
                  <div className="absolute top-2 left-2 flex items-center gap-1.5">
                    <span className="px-1.5 py-0.5 rounded text-[9px] font-mono uppercase bg-amber-950 text-amber-300 border border-amber-800">
                      Interviewer
                    </span>
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                  </div>
                  <div className="w-12 h-12 rounded-full bg-neutral-800 border border-neutral-700 flex items-center justify-center font-mono font-bold text-neutral-300 mb-1">
                    AP
                  </div>
                  <span className="text-[11px] text-neutral-300 font-mono">Alex Rivera</span>
                  <span className="text-[10px] text-neutral-500">Senior Engineer • London</span>
                </div>

                {/* Local User Video Tile */}
                <div className="flex-1 rounded-xl bg-neutral-900 border border-neutral-800 relative overflow-hidden flex flex-col items-center justify-center p-4 aspect-video">
                  <div className="absolute top-2 left-2 flex items-center gap-1.5">
                    <span className="px-1.5 py-0.5 rounded text-[9px] font-mono uppercase bg-blue-950 text-blue-300 border border-blue-800">
                      Candidate
                    </span>
                  </div>
                  <div className="w-12 h-12 rounded-full bg-neutral-800 border border-neutral-700 flex items-center justify-center font-mono font-bold text-neutral-300 mb-1">
                    ME
                  </div>
                  <span className="text-[11px] text-neutral-300 font-mono">You (Candidate)</span>
                  <span className="text-[10px] text-neutral-500">Candidate Round</span>
                </div>

                {/* Media Control Pill */}
                <div className="p-2 rounded-lg bg-neutral-900 border border-neutral-800 flex items-center justify-between text-[11px] font-mono text-neutral-300">
                  <span className="text-emerald-400">Mic On</span>
                  <span className="text-neutral-500">•</span>
                  <span className="text-neutral-300">Cam Live</span>
                  <span className="text-neutral-500">•</span>
                  <span className="text-neutral-300">Share</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 4. HOW IT WORKS (THE 3-STEP REVERSE PROTOCOL) */}
      <section id="how-it-works" className="py-20 md:py-28 bg-white border-b border-neutral-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="max-w-2xl mx-auto text-center space-y-3 mb-16">
            <span className="text-[11px] font-mono uppercase tracking-widest text-neutral-500">
              Structured Methodology
            </span>
            <h2 className="text-3xl sm:text-5xl font-bold tracking-tight text-neutral-950 font-sans">
              The 60-Minute Peer Exchange
            </h2>
            <p className="text-base text-neutral-600">
              Unlike passive coding platforms, PeerForge simulates the human dynamics of real technical
              interviews through a balanced bilateral exchange.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {/* Step 1 */}
            <div className="p-8 rounded-2xl border border-neutral-200 bg-neutral-50/50 hover:bg-neutral-50 hover:border-neutral-300 transition-all space-y-4">
              <div className="w-10 h-10 rounded-xl bg-black text-white font-mono font-bold flex items-center justify-center text-sm">
                01
              </div>
              <h3 className="text-xl font-bold text-neutral-950 tracking-tight">
                Pair Up by Track or Code
              </h3>
              <p className="text-sm text-neutral-600 leading-relaxed">
                Join the instant matchmaking queue filtered by your target engineering domain and
                seniority, or generate a private 6-character room code to practice with friends.
              </p>
              <div className="pt-2 text-xs font-mono text-neutral-500">
                &rarr; Instant matchmaking &bull; Private invite links
              </div>
            </div>

            {/* Step 2 */}
            <div className="p-8 rounded-2xl border border-neutral-200 bg-neutral-50/50 hover:bg-neutral-50 hover:border-neutral-300 transition-all space-y-4">
              <div className="w-10 h-10 rounded-xl bg-black text-white font-mono font-bold flex items-center justify-center text-sm">
                02
              </div>
              <h3 className="text-xl font-bold text-neutral-950 tracking-tight">
                30m Candidate + 30m Interviewer
              </h3>
              <p className="text-sm text-neutral-600 leading-relaxed">
                Spend 30 minutes solving an unseen problem while speaking your thoughts out loud. Then,
                swap roles at the halfway checkpoint and evaluate your peer’s solution.
              </p>
              <div className="pt-2 text-xs font-mono text-neutral-500">
                &rarr; Automated timer &bull; Equal hands-on practice
              </div>
            </div>

            {/* Step 3 */}
            <div className="p-8 rounded-2xl border border-neutral-200 bg-neutral-50/50 hover:bg-neutral-50 hover:border-neutral-300 transition-all space-y-4">
              <div className="w-10 h-10 rounded-xl bg-black text-white font-mono font-bold flex items-center justify-center text-sm">
                03
              </div>
              <h3 className="text-xl font-bold text-neutral-950 tracking-tight">
                Symmetric Blind Evaluation
              </h3>
              <p className="text-sm text-neutral-600 leading-relaxed">
                Both engineers fill out a structured rubric evaluating Problem Solving, Code Quality, and
                Communication. Ratings are revealed only after both peers submit.
              </p>
              <div className="pt-2 text-xs font-mono text-neutral-500">
                &rarr; Zero rating bias &bull; Actionable feedback
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 5. PROBLEM TRACKS EXPLORER */}
      <section id="tracks" className="py-20 md:py-28 bg-neutral-50/60 border-b border-neutral-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="max-w-2xl mx-auto text-center space-y-3 mb-12">
            <span className="text-[11px] font-mono uppercase tracking-widest text-neutral-500">
              Curated Curriculum
            </span>
            <h2 className="text-3xl sm:text-5xl font-bold tracking-tight text-neutral-950 font-sans">
              Choose your practice track
            </h2>
            <p className="text-sm text-neutral-600">
              Industry-vetted problems with unit test assertion suites across major software engineering domains.
            </p>
          </div>

          {/* Track Filter Tabs */}
          <div className="flex flex-wrap items-center justify-center gap-2 mb-10">
            {tracks.map((track) => (
              <button
                key={track}
                onClick={() => setActiveTrack(track)}
                className={`px-4 py-2 rounded-xl text-xs font-medium transition-all cursor-pointer border ${
                  activeTrack === track
                    ? "bg-black text-white border-black shadow-sm"
                    : "bg-white text-neutral-600 border-neutral-200 hover:border-neutral-400"
                }`}
              >
                {track}
              </button>
            ))}
          </div>

          {/* Problem Cards Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-w-4xl mx-auto">
            {filteredProblems.map((prob) => (
              <div
                key={prob.id}
                className="p-5 rounded-xl border border-neutral-200 bg-white hover:border-neutral-400 transition-all space-y-3 shadow-xs"
              >
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-mono uppercase tracking-wider px-2 py-0.5 rounded bg-neutral-100 text-neutral-700 border border-neutral-200 font-semibold">
                    {prob.difficulty}
                  </span>
                  <span className="text-[11px] font-mono text-neutral-400">{prob.track}</span>
                </div>
                <h4 className="text-base font-bold text-neutral-950">{prob.title}</h4>
                <p className="text-xs text-neutral-600 line-clamp-2 leading-relaxed">
                  {prob.description}
                </p>
                <div className="pt-2 flex items-center justify-between text-xs font-mono text-neutral-500 border-t border-neutral-100">
                  <span>Entry: {prob.entryFunction}()</span>
                  <span className="text-neutral-900 font-medium">Test suite ready &rarr;</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* 6. BENTO GRID FEATURES */}
      <section id="architecture" className="py-20 md:py-28 bg-white border-b border-neutral-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="max-w-2xl mx-auto text-center space-y-3 mb-16">
            <span className="text-[11px] font-mono uppercase tracking-widest text-neutral-500">
              Core Capabilities
            </span>
            <h2 className="text-3xl sm:text-5xl font-bold tracking-tight text-neutral-950 font-sans">
              Engineered for realistic practice
            </h2>
            <p className="text-sm text-neutral-600">
              Every detail is designed to remove friction so you can focus entirely on technical communication and code.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Bento Card 1 */}
            <div className="p-8 rounded-2xl border border-neutral-200 bg-neutral-50/50 space-y-3">
              <Code2 className="w-6 h-6 text-neutral-950" />
              <h3 className="text-lg font-bold text-neutral-950">Monaco Code Editor</h3>
              <p className="text-xs text-neutral-600 leading-relaxed">
                The exact editor powering VS Code with full syntax highlighting, bracket matching,
                keyboard shortcuts, and sub-150ms remote cursor broadcasting.
              </p>
            </div>

            {/* Bento Card 2 */}
            <div className="p-8 rounded-2xl border border-neutral-200 bg-neutral-50/50 space-y-3">
              <Video className="w-6 h-6 text-neutral-950" />
              <h3 className="text-lg font-bold text-neutral-950">WebRTC Video & Audio</h3>
              <p className="text-xs text-neutral-600 leading-relaxed">
                Peer-to-peer encrypted audio, video, and screen sharing with automated virtual avatar
                fallback when webcams are busy or testing locally.
              </p>
            </div>

            {/* Bento Card 3 */}
            <div className="p-8 rounded-2xl border border-neutral-200 bg-neutral-50/50 space-y-3">
              <ShieldCheck className="w-6 h-6 text-neutral-950" />
              <h3 className="text-lg font-bold text-neutral-950">Decentralized P2P Rules</h3>
              <p className="text-xs text-neutral-600 leading-relaxed">
                Enforces strict 2-peer room limits (SEC-02), cryptographic JWT verification, and
                immutable session state to prevent spoofing or connection crashes.
              </p>
            </div>

            {/* Bento Card 4 */}
            <div className="p-8 rounded-2xl border border-neutral-200 bg-neutral-50/50 space-y-3">
              <Clock className="w-6 h-6 text-neutral-950" />
              <h3 className="text-lg font-bold text-neutral-950">Synchronized Session Timer</h3>
              <p className="text-xs text-neutral-600 leading-relaxed">
                Server-synchronized 60-minute countdown with automatic 30-minute halfway alerts to
                ensure both participants receive equal candidate time.
              </p>
            </div>

            {/* Bento Card 5 */}
            <div className="p-8 rounded-2xl border border-neutral-200 bg-neutral-50/50 space-y-3">
              <Terminal className="w-6 h-6 text-neutral-950" />
              <h3 className="text-lg font-bold text-neutral-950">In-Browser Test Runner</h3>
              <p className="text-xs text-neutral-600 leading-relaxed">
                Run test suites directly in the browser with execution timers and formatted stdout/stderr
                output consoles.
              </p>
            </div>

            {/* Bento Card 6 */}
            <div className="p-8 rounded-2xl border border-neutral-200 bg-neutral-50/50 space-y-3">
              <Layers className="w-6 h-6 text-neutral-950" />
              <h3 className="text-lg font-bold text-neutral-950">Performance History</h3>
              <p className="text-xs text-neutral-600 leading-relaxed">
                Track your ratings over time across Problem Solving, Code Quality, and Communication to
                measure your interview readiness.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* 7. FREQUENTLY ASKED QUESTIONS */}
      <section id="faq" className="py-20 md:py-28 bg-neutral-50/60 border-b border-neutral-200">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 space-y-12">
          <div className="text-center space-y-3">
            <span className="text-[11px] font-mono uppercase tracking-widest text-neutral-500">
              Common Inquiries
            </span>
            <h2 className="text-3xl sm:text-4xl font-bold tracking-tight text-neutral-950">
              Frequently Asked Questions
            </h2>
          </div>

          <div className="space-y-4">
            <div className="p-6 rounded-xl border border-neutral-200 bg-white space-y-2">
              <h3 className="text-sm font-bold text-neutral-950">
                Is PeerForge completely free to use?
              </h3>
              <p className="text-xs text-neutral-600 leading-relaxed">
                Yes. PeerForge is 100% free and open for developers. There are no paywalls, token limits,
                or subscription tiers.
              </p>
            </div>

            <div className="p-6 rounded-xl border border-neutral-200 bg-white space-y-2">
              <h3 className="text-sm font-bold text-neutral-950">
                How does the bilateral role swap work?
              </h3>
              <p className="text-xs text-neutral-600 leading-relaxed">
                Every session is structured as a 60-minute interview. In the first 30 minutes, Peer A is
                the Candidate and Peer B is the Interviewer. At the 30-minute mark, the platform triggers
                a role swap: Peer B receives a new problem as Candidate and Peer A conducts the interview.
              </p>
            </div>

            <div className="p-6 rounded-xl border border-neutral-200 bg-white space-y-2">
              <h3 className="text-sm font-bold text-neutral-950">
                Can I practice with a specific friend or teammate?
              </h3>
              <p className="text-xs text-neutral-600 leading-relaxed">
                Yes! From the matchmaking lobby, click &quot;Generate Code &amp; Link&quot; to create a memorable
                6-character code (e.g. <code className="font-mono text-neutral-900">PF-7K2M9X</code>) or
                share the direct URL with your teammate.
              </p>
            </div>

            <div className="p-6 rounded-xl border border-neutral-200 bg-white space-y-2">
              <h3 className="text-sm font-bold text-neutral-950">
                How does symmetric blind evaluation prevent retaliation?
              </h3>
              <p className="text-xs text-neutral-600 leading-relaxed">
                After the session, both developers submit a structured evaluation form. Neither developer
                can view the other&apos;s feedback until both reviews are submitted, completely eliminating
                rating bias or tit-for-tat scoring.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* 8. BOTTOM CALL TO ACTION */}
      <section className="py-20 md:py-28 bg-black text-white text-center">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 space-y-6">
          <span className="text-[11px] font-mono uppercase tracking-widest text-neutral-400">
            Start Your Preparation
          </span>
          <h2 className="text-3xl sm:text-5xl font-bold tracking-tight text-white font-sans max-w-2xl mx-auto">
            Stop practicing in isolation. Level up with fellow engineers.
          </h2>
          <p className="text-sm sm:text-base text-neutral-400 max-w-lg mx-auto">
            Join the decentralized community of software developers sharpening their interview skills today.
          </p>
          <div className="pt-4 flex justify-center">
            <Link
              to={user ? "/dashboard" : "/login"}
              className="inline-flex items-center gap-2 px-8 py-4 rounded-xl bg-white text-neutral-950 hover:bg-neutral-100 text-sm font-bold transition-all shadow-lg active:scale-95 cursor-pointer"
            >
              <span>{user ? "Go to Your Dashboard" : "Create Free Account & Practice"}</span>
              <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        </div>
      </section>

      {/* 9. MINIMALIST FOOTER */}
      <footer className="py-12 bg-white border-t border-neutral-200 text-xs font-mono text-neutral-500">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <div className="w-5 h-5 rounded bg-black text-white flex items-center justify-center font-bold text-[10px]">
              PF
            </div>
            <span className="font-bold text-neutral-900 font-sans">PeerForge</span>
            <span className="text-neutral-400">&bull;</span>
            <span>&copy; {new Date().getFullYear()} Open Source Technical Mock Interviews</span>
          </div>

          <div className="flex items-center gap-6 text-neutral-600">
            <a href="#how-it-works" className="hover:text-neutral-900 transition-colors">
              Workflow
            </a>
            <a href="#workspace" className="hover:text-neutral-900 transition-colors">
              Workspace
            </a>
            <a href="#tracks" className="hover:text-neutral-900 transition-colors">
              Tracks
            </a>
            <Link to="/login" className="hover:text-neutral-900 transition-colors">
              Sign In
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
