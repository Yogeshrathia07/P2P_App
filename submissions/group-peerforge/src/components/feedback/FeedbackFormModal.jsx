import React, { useState, useEffect, useCallback } from "react";
import { MessageSquare, ShieldCheck, AlertCircle, Loader2, ArrowRight } from "lucide-react";
import RubricSlider from "./RubricSlider";
import WaitingBlindRoom from "./WaitingBlindRoom";
import UnlockedScorecard from "./UnlockedScorecard";
import { getApiUrl } from "../../utils/api";

/**
 * FeedbackFormModal
 * Post-session peer review modal with structured 4-pillar rubric, character counts, and symmetric blind reveal.
 */
export const FeedbackFormModal = ({
  isOpen,
  roomId,
  candidate,
  track,
  socket,
  onClose,
  onCompleted,
}) => {
  const [step, setStep] = useState("form"); // "form" | "waiting" | "scorecard"
  const [scores, setScores] = useState({
    codeCorrectness: 0,
    problemSolving: 0,
    communication: 0,
    architecture: 0,
  });
  const [strengths, setStrengths] = useState("");
  const [improvements, setImprovements] = useState("");
  const [privateNotes, setPrivateNotes] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState(null);

  // Blind waiting state
  const [partnerSubmitted, setPartnerSubmitted] = useState(false);
  const [scorecardData, setScorecardData] = useState(null);

  // Check if session feedback was already submitted or unlocked
  const fetchSessionFeedback = useCallback(async () => {
    if (!roomId) return;
    try {
      const res = await fetch(getApiUrl(`/api/feedback/session/${roomId}`), {
        headers: { "Content-Type": "application/json" },
        credentials: "include",
      });
      const data = await res.json();

      if (data.isRevealed) {
        setScorecardData(data);
        setStep("scorecard");
      } else if (data.myFeedbackSubmitted) {
        setPartnerSubmitted(data.partnerSubmitted);
        setStep("waiting");
      }
    } catch (err) {
      console.error("[fetchSessionFeedback Error]", err);
    }
  }, [roomId]);

  useEffect(() => {
    if (isOpen) {
      fetchSessionFeedback();
    }
  }, [isOpen, fetchSessionFeedback]);

  // Socket listeners for real-time progress
  useEffect(() => {
    if (!socket || !roomId) return;

    const handlePartnerSubmitted = () => {
      setPartnerSubmitted(true);
    };

    const handleUnlocked = () => {
      fetchSessionFeedback();
    };

    socket.on("feedback:partner-submitted", handlePartnerSubmitted);
    socket.on("feedback:unlocked", handleUnlocked);

    return () => {
      socket.off("feedback:partner-submitted", handlePartnerSubmitted);
      socket.off("feedback:unlocked", handleUnlocked);
    };
  }, [socket, roomId, fetchSessionFeedback]);

  if (!isOpen) return null;

  // Validation
  const allScoresSet = Object.values(scores).every((s) => s >= 1 && s <= 5);
  const strengthsValid = strengths.trim().length >= 20;
  const improvementsValid = improvements.trim().length >= 20;
  const canSubmit = allScoresSet && strengthsValid && improvementsValid && !isSubmitting;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!canSubmit) return;

    setIsSubmitting(true);
    setError(null);

    try {
      const res = await fetch(getApiUrl("/api/feedback/submit"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          roomId,
          candidateId: candidate?._id || candidate?.userId,
          scores,
          strengths,
          improvements,
          privateNotes,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to submit feedback");
      }

      if (data.isRevealed) {
        await fetchSessionFeedback();
      } else {
        setStep("waiting");
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-neutral-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-neutral-950 border border-neutral-800 rounded-2xl w-full max-w-xl max-h-[90vh] overflow-y-auto shadow-2xl">
        {/* Step 1: Feedback Form */}
        {step === "form" && (
          <form onSubmit={handleSubmit} className="p-6 space-y-6">
            {/* Header */}
            <div className="border-b border-neutral-800 pb-4">
              <div className="flex items-center gap-2 text-neutral-400 text-xs font-mono mb-1">
                <MessageSquare className="w-3.5 h-3.5" />
                <span>Post-Session Peer Evaluation</span>
              </div>
              <h2 className="text-base font-semibold text-neutral-100">
                Evaluate {candidate?.name || "Peer Developer"}
              </h2>
              <p className="text-xs text-neutral-400 mt-1 font-sans">
                Provide honest, constructive ratings across the 4 core competencies.
              </p>
            </div>

            {error && (
              <div className="p-3 rounded-lg bg-rose-950/40 border border-rose-800/50 text-rose-300 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            {/* Rubric Dimension Sliders */}
            <div className="space-y-4">
              <RubricSlider
                label="1. Code Correctness & Edge Cases"
                description="Did the candidate solve the problem accurately and anticipate constraints?"
                value={scores.codeCorrectness}
                onChange={(val) => setScores((prev) => ({ ...prev, codeCorrectness: val }))}
              />

              <RubricSlider
                label="2. Problem Solving & Algorithmic Approach"
                description="How sound was their algorithmic reasoning and data structure choices?"
                value={scores.problemSolving}
                onChange={(val) => setScores((prev) => ({ ...prev, problemSolving: val }))}
              />

              <RubricSlider
                label="3. Technical Communication & Dialogue"
                description="Did they think out loud clearly and collaborate effectively throughout the session?"
                value={scores.communication}
                onChange={(val) => setScores((prev) => ({ ...prev, communication: val }))}
              />

              <RubricSlider
                label="4. System Architecture & Code Structure"
                description="Modularity, idiomatic naming, and awareness of time/space complexity."
                value={scores.architecture}
                onChange={(val) => setScores((prev) => ({ ...prev, architecture: val }))}
              />
            </div>

            {/* Qualitative Written Prompts */}
            <div className="space-y-4 pt-2 border-t border-neutral-800">
              {/* Key Strengths */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between text-xs font-mono">
                  <label className="text-neutral-200">
                    Key Strengths <span className="text-rose-400">*</span>
                  </label>
                  <span
                    className={`text-[10px] ${
                      strengths.length >= 20 ? "text-emerald-400" : "text-neutral-500"
                    }`}
                  >
                    {strengths.length}/20 min
                  </span>
                </div>
                <textarea
                  rows={2}
                  value={strengths}
                  onChange={(e) => setStrengths(e.target.value)}
                  placeholder="What did the peer do exceptionally well? (e.g. Great modular decomposition and proactive testing...)"
                  className="w-full bg-neutral-900 border border-neutral-800 rounded-lg p-2.5 text-xs text-neutral-100 placeholder-neutral-500 focus:outline-none focus:border-neutral-600 font-sans"
                />
              </div>

              {/* Actionable Improvements */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between text-xs font-mono">
                  <label className="text-neutral-200">
                    Actionable Improvements <span className="text-rose-400">*</span>
                  </label>
                  <span
                    className={`text-[10px] ${
                      improvements.length >= 20 ? "text-emerald-400" : "text-neutral-500"
                    }`}
                  >
                    {improvements.length}/20 min
                  </span>
                </div>
                <textarea
                  rows={2}
                  value={improvements}
                  onChange={(e) => setImprovements(e.target.value)}
                  placeholder="What constructive focus areas would elevate their technical interviews? (e.g. Discuss time complexity trade-offs upfront...)"
                  className="w-full bg-neutral-900 border border-neutral-800 rounded-lg p-2.5 text-xs text-neutral-100 placeholder-neutral-500 focus:outline-none focus:border-neutral-600 font-sans"
                />
              </div>

              {/* Private Candidate Notes */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between text-xs font-mono">
                  <label className="text-neutral-300">
                    Private Candidate Notes <span className="text-neutral-500">(Optional)</span>
                  </label>
                  <span className="text-[10px] text-neutral-500">Candidate eyes only</span>
                </div>
                <textarea
                  rows={2}
                  value={privateNotes}
                  onChange={(e) => setPrivateNotes(e.target.value)}
                  placeholder="Any discreet technical advice or resource recommendations..."
                  className="w-full bg-neutral-900 border border-neutral-800 rounded-lg p-2.5 text-xs text-neutral-100 placeholder-neutral-500 focus:outline-none focus:border-neutral-600 font-sans"
                />
              </div>
            </div>

            {/* Footer Buttons */}
            <div className="pt-3 border-t border-neutral-800 flex items-center justify-between">
              <button
                type="button"
                onClick={onClose}
                className="px-3 py-1.5 rounded text-xs font-mono text-neutral-400 hover:text-neutral-200 hover:bg-neutral-900 transition-colors"
              >
                Skip / Later
              </button>

              <button
                type="submit"
                disabled={!canSubmit}
                className="px-4 py-2 rounded-lg bg-neutral-100 hover:bg-white text-neutral-950 font-mono text-xs font-semibold flex items-center gap-2 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>Submitting...</span>
                  </>
                ) : (
                  <>
                    <span>Submit Evaluation</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </>
                )}
              </button>
            </div>
          </form>
        )}

        {/* Step 2: Symmetric Blind Waiting Room */}
        {step === "waiting" && (
          <WaitingBlindRoom
            partnerName={candidate?.name}
            partnerSubmitted={partnerSubmitted}
            socket={socket}
            roomId={roomId}
            onUnlocked={() => fetchSessionFeedback()}
            onReturnToDashboard={onCompleted}
          />
        )}

        {/* Step 3: Unlocked Scorecard */}
        {step === "scorecard" && scorecardData && (
          <UnlockedScorecard
            receivedFeedback={scorecardData.receivedFeedback}
            compositeScore={scorecardData.compositeScore}
            partnerName={candidate?.name}
            track={track}
            onDone={onCompleted}
          />
        )}
      </div>
    </div>
  );
};

export default FeedbackFormModal;

