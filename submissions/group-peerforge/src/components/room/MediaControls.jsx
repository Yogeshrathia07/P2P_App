import React from "react";
import { Mic, MicOff, Video, VideoOff, Monitor, PhoneOff } from "lucide-react";

/**
 * MediaControls
 * Quiet graphite device control bar for the active interview room.
 */
export const MediaControls = ({
  isMuted,
  isVideoOff,
  isScreenSharing,
  onToggleAudio,
  onToggleVideo,
  onToggleScreenShare,
  onLeaveRoom,
}) => {
  return (
    <div className="bg-neutral-900/90 border border-neutral-800 rounded-lg p-1.5 flex items-center justify-between shadow-sm">
      <div className="flex items-center gap-1">
        {/* Microphone Toggle */}
        <button
          type="button"
          onClick={onToggleAudio}
          title={isMuted ? "Unmute microphone" : "Mute microphone"}
          aria-label={isMuted ? "Unmute microphone" : "Mute microphone"}
          className={`px-2.5 py-1.5 rounded-md text-xs font-mono flex items-center gap-1.5 transition-colors border ${
            isMuted
              ? "bg-rose-950/40 text-rose-300 border-rose-800/50 hover:bg-rose-900/50"
              : "bg-neutral-800/80 text-neutral-200 border-neutral-700/60 hover:bg-neutral-700/60"
          }`}
        >
          {isMuted ? <MicOff className="w-3.5 h-3.5 text-rose-400" /> : <Mic className="w-3.5 h-3.5 text-emerald-400" />}
          <span>{isMuted ? "Muted" : "Mic"}</span>
        </button>

        {/* Camera Toggle */}
        <button
          type="button"
          onClick={onToggleVideo}
          title={isVideoOff ? "Turn camera on" : "Turn camera off"}
          aria-label={isVideoOff ? "Turn camera on" : "Turn camera off"}
          className={`px-2.5 py-1.5 rounded-md text-xs font-mono flex items-center gap-1.5 transition-colors border ${
            isVideoOff
              ? "bg-rose-950/40 text-rose-300 border-rose-800/50 hover:bg-rose-900/50"
              : "bg-neutral-800/80 text-neutral-200 border-neutral-700/60 hover:bg-neutral-700/60"
          }`}
        >
          {isVideoOff ? <VideoOff className="w-3.5 h-3.5 text-rose-400" /> : <Video className="w-3.5 h-3.5 text-neutral-300" />}
          <span>{isVideoOff ? "Cam Off" : "Cam"}</span>
        </button>

        {/* Screen Share Toggle */}
        <button
          type="button"
          onClick={onToggleScreenShare}
          title={isScreenSharing ? "Stop sharing screen" : "Share screen"}
          aria-label={isScreenSharing ? "Stop sharing screen" : "Share screen"}
          className={`px-2.5 py-1.5 rounded-md text-xs font-mono flex items-center gap-1.5 transition-colors border ${
            isScreenSharing
              ? "bg-emerald-950/40 text-emerald-300 border-emerald-800/60 hover:bg-emerald-900/50"
              : "bg-neutral-800/80 text-neutral-300 border-neutral-700/60 hover:bg-neutral-700/60"
          }`}
        >
          <Monitor className="w-3.5 h-3.5" />
          <span>{isScreenSharing ? "Sharing" : "Share"}</span>
        </button>
      </div>

      {/* End Session Button */}
      <button
        type="button"
        onClick={onLeaveRoom}
        title="Leave Interview Session"
        aria-label="Leave Interview Session"
        className="px-2.5 py-1.5 rounded-md text-xs font-mono flex items-center gap-1.5 bg-neutral-900 text-rose-400 border border-rose-900/40 hover:bg-rose-950/50 hover:border-rose-700/60 transition-colors"
      >
        <PhoneOff className="w-3.5 h-3.5 text-rose-400" />
        <span>Leave</span>
      </button>
    </div>
  );
};

export default MediaControls;

