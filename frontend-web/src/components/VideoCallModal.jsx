import { useEffect, useRef, useState } from "react";

/**
 * VideoCallModal
 * Uses Jitsi Meet External API (free, no API key required).
 * Each TeleHealth appointment has a unique `tele_room_id` — both
 * patient and doctor join the same Jitsi room using that ID.
 *
 * Props:
 *   roomId      – unique room name (appointment.tele_room_id)
 *   displayName – user's name shown in the call
 *   role        – "PATIENT" | "DOCTOR"
 *   onClose     – called when the user ends/closes the call
 */
export default function VideoCallModal({ roomId, displayName, role, onClose }) {
  const containerRef = useRef(null);
  const apiRef = useRef(null);
  const [status, setStatus] = useState("connecting"); // connecting | live | ended | error
  const [participants, setParticipants] = useState(1);
  const [isMuted, setIsMuted] = useState(false);
  const [isVideoOff, setIsVideoOff] = useState(false);

  useEffect(() => {
    // Load Jitsi External API script dynamically
    const scriptId = "jitsi-api-script";
    const load = () => initJitsi();

    if (document.getElementById(scriptId)) {
      load();
      return;
    }

    const script = document.createElement("script");
    script.id = scriptId;
    script.src = "https://meet.jit.si/external_api.js";
    script.async = true;
    script.onload = load;
    script.onerror = () => setStatus("error");
    document.head.appendChild(script);

    return () => {
      if (apiRef.current) {
        apiRef.current.dispose();
        apiRef.current = null;
      }
    };
  }, []);

  const initJitsi = () => {
    if (!window.JitsiMeetExternalAPI || !containerRef.current) return;

    try {
      const api = new window.JitsiMeetExternalAPI("meet.jit.si", {
        roomName: roomId,
        width: "100%",
        height: "100%",
        parentNode: containerRef.current,
        userInfo: {
          displayName: displayName,
          email: "",
        },
        configOverwrite: {
          startWithAudioMuted: false,
          startWithVideoMuted: false,
          enableWelcomePage: false,
          disableDeepLinking: true,
          prejoinPageEnabled: false,
          disableInviteFunctions: true,
          toolbarButtons: [
            "microphone", "camera", "closedcaptions",
            "fullscreen", "chat", "tileview", "hangup",
          ],
        },
        interfaceConfigOverwrite: {
          SHOW_JITSI_WATERMARK: false,
          SHOW_BRAND_WATERMARK: false,
          BRAND_WATERMARK_LINK: "",
          SHOW_POWERED_BY: false,
          DISPLAY_WELCOME_FOOTER: false,
          MOBILE_APP_PROMO: false,
          HIDE_INVITE_MORE_HEADER: true,
          APP_NAME: "MediCore HMS",
          NATIVE_APP_NAME: "MediCore HMS",
          DEFAULT_BACKGROUND: "#0f172a",
        },
      });

      apiRef.current = api;

      api.on("videoConferenceJoined", () => setStatus("live"));
      api.on("participantJoined", () => setParticipants(p => p + 1));
      api.on("participantLeft", () => setParticipants(p => Math.max(1, p - 1)));
      api.on("audioMuteStatusChanged", ({ muted }) => setIsMuted(muted));
      api.on("videoMuteStatusChanged", ({ muted }) => setIsVideoOff(muted));
      api.on("readyToClose", () => { setStatus("ended"); onClose(); });
    } catch {
      setStatus("error");
    }
  };

  const toggleMic = () => {
    apiRef.current?.executeCommand("toggleAudio");
  };

  const toggleCamera = () => {
    apiRef.current?.executeCommand("toggleVideo");
  };

  const endCall = () => {
    apiRef.current?.executeCommand("hangup");
    setTimeout(onClose, 500);
  };

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-slate-950">
      {/* Top bar */}
      <div className="flex items-center justify-between px-4 py-3 bg-slate-900/95 backdrop-blur border-b border-slate-800 flex-shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-hmsTeal to-hmsMint flex items-center justify-center text-white text-sm font-bold">
            ⚕️
          </div>
          <div>
            <div className="text-white font-semibold text-sm">MediCore TeleHealth</div>
            <div className="flex items-center gap-2">
              {status === "connecting" && (
                <span className="flex items-center gap-1 text-xs text-amber-400">
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
                  Connecting...
                </span>
              )}
              {status === "live" && (
                <span className="flex items-center gap-1 text-xs text-emerald-400">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  Live · {participants} {participants === 1 ? "participant" : "participants"}
                </span>
              )}
              {status === "error" && (
                <span className="text-xs text-red-400">Connection failed</span>
              )}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Role badge */}
          <span className={`text-xs font-semibold px-2 py-1 rounded-full ${
            role === "DOCTOR" ? "bg-blue-900 text-blue-300" : "bg-teal-900 text-teal-300"
          }`}>
            {role === "DOCTOR" ? "👨‍⚕️ Doctor" : "🧑 Patient"}
          </span>

          {/* Mic toggle */}
          <button
            onClick={toggleMic}
            title={isMuted ? "Unmute" : "Mute"}
            className={`w-9 h-9 rounded-full flex items-center justify-center text-sm transition ${
              isMuted ? "bg-red-500/20 text-red-400 hover:bg-red-500/30" : "bg-slate-700 text-slate-300 hover:bg-slate-600"
            }`}
          >
            {isMuted ? "🔇" : "🎤"}
          </button>

          {/* Camera toggle */}
          <button
            onClick={toggleCamera}
            title={isVideoOff ? "Turn on camera" : "Turn off camera"}
            className={`w-9 h-9 rounded-full flex items-center justify-center text-sm transition ${
              isVideoOff ? "bg-red-500/20 text-red-400 hover:bg-red-500/30" : "bg-slate-700 text-slate-300 hover:bg-slate-600"
            }`}
          >
            {isVideoOff ? "📵" : "📹"}
          </button>

          {/* End call */}
          <button
            onClick={endCall}
            title="End call"
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-red-600 hover:bg-red-700 text-white text-xs font-bold transition"
          >
            📞 End Call
          </button>
        </div>
      </div>

      {/* Jitsi container */}
      <div className="flex-1 relative">
        {status === "connecting" && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-950 z-10 gap-4">
            <div className="w-16 h-16 border-4 border-hmsTeal border-t-transparent rounded-full animate-spin" />
            <div className="text-slate-400 text-sm">Joining secure video room...</div>
            <div className="text-slate-600 text-xs font-mono">{roomId}</div>
          </div>
        )}
        {status === "error" && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-950 z-10 gap-4">
            <div className="text-5xl">⚠️</div>
            <div className="text-white font-semibold">Could not connect to video room</div>
            <div className="text-slate-400 text-sm">Check your internet connection and try again.</div>
            <button
              onClick={onClose}
              className="mt-2 px-6 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-xl text-sm font-semibold transition"
            >
              Close
            </button>
          </div>
        )}
        <div ref={containerRef} className="w-full h-full" />
      </div>
    </div>
  );
}
