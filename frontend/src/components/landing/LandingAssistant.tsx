"use client";

import { FormEvent, KeyboardEvent, useCallback, useEffect, useRef, useState } from "react";
import {
  ArrowUpRight, AudioLines, Bot, ChevronDown, Loader2, MessageCircle, Mic,
  MicOff, PhoneOff, RotateCcw, Send, Square, UserRound, Volume2,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useLanding } from "@/context/LandingContext";
import { landingApi, type LandingAssistantAction } from "@/lib/api";

type Message = {
  id: string;
  role: "assistant" | "user";
  text: string;
  actions?: LandingAssistantAction[];
};

type VoiceStatus = "idle" | "connecting" | "listening" | "thinking" | "speaking";
const AI_UNAVAILABLE_MESSAGE = "Audito AI is temporarily unavailable. Please try again in a few moments.";

type RealtimeEvent = {
  type?: string;
  item_id?: string;
  response_id?: string;
  transcript?: string;
  delta?: string;
  error?: { message?: string };
  response?: { status?: string; status_details?: { error?: { message?: string } } };
};

const SUGGESTIONS = [
  "Which plan is right for my team?",
  "How does the audit workflow work?",
  "Can I audit suppliers or partners?",
  "What can I upload as evidence?",
];

const welcomeMessage = (): Message => ({
  id: "welcome",
  role: "assistant",
  text: "Hi! I’m Audito AI. How can I help you today?",
});

const voiceStatusText: Record<Exclude<VoiceStatus, "idle">, { title: string; detail: string }> = {
  connecting: { title: "Starting voice", detail: "Connecting securely…" },
  listening: { title: "I’m listening", detail: "Speak naturally. Pause when you’re finished." },
  thinking: { title: "Thinking", detail: "Preparing an answer from Audito’s public information." },
  speaking: { title: "Audito AI is speaking", detail: "You can interrupt at any time." },
};

const messageId = (prefix: string) => `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

export default function LandingAssistant() {
  const router = useRouter();
  const { setActiveSection, openPackageSetup } = useLanding();
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<Message[]>([welcomeMessage()]);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const [voiceStatus, setVoiceStatus] = useState<VoiceStatus>("idle");
  const [voiceMuted, setVoiceMuted] = useState(false);
  const [liveVoiceTranscript, setLiveVoiceTranscript] = useState("");
  const [audioNeedsResume, setAudioNeedsResume] = useState(false);

  const transcriptEndRef = useRef<HTMLDivElement>(null);
  const audioRef = useRef<HTMLAudioElement>(null);
  const peerConnectionRef = useRef<RTCPeerConnection | null>(null);
  const dataChannelRef = useRef<RTCDataChannel | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const assistantTranscriptRef = useRef("");
  const assistantResponseIdRef = useRef("");
  const voiceStartingRef = useRef(false);
  const recordedTranscriptIdsRef = useRef(new Set<string>());

  const voiceActive = voiceStatus !== "idle";

  useEffect(() => {
    if (open) transcriptEndRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }, [messages, open, sending, liveVoiceTranscript, voiceStatus]);

  const appendTranscriptMessage = useCallback((role: Message["role"], text: string, eventId?: string) => {
    const cleanText = text.trim();
    if (!cleanText) return;
    const stableId = eventId || messageId(role);
    if (recordedTranscriptIdsRef.current.has(stableId)) return;
    recordedTranscriptIdsRef.current.add(stableId);
    setMessages(current => [...current, { id: stableId, role, text: cleanText }]);
  }, []);

  const stopVoice = useCallback(() => {
    const channel = dataChannelRef.current;
    dataChannelRef.current = null;
    if (channel && channel.readyState !== "closed") channel.close();

    const connection = peerConnectionRef.current;
    peerConnectionRef.current = null;
    if (connection) connection.close();

    mediaStreamRef.current?.getTracks().forEach(track => track.stop());
    mediaStreamRef.current = null;

    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.srcObject = null;
    }

    assistantTranscriptRef.current = "";
    assistantResponseIdRef.current = "";
    voiceStartingRef.current = false;
    setLiveVoiceTranscript("");
    setVoiceMuted(false);
    setAudioNeedsResume(false);
    setVoiceStatus("idle");
  }, []);

  useEffect(() => {
    const stopOnPageExit = () => stopVoice();
    window.addEventListener("pagehide", stopOnPageExit);
    return () => {
      window.removeEventListener("pagehide", stopOnPageExit);
      stopVoice();
    };
  }, [stopVoice]);

  const handleRealtimeEvent = useCallback((event: RealtimeEvent) => {
    const type = event.type || "";
    if (type === "session.created" || type === "session.updated") {
      setVoiceStatus("listening");
      return;
    }
    if (type === "input_audio_buffer.speech_started") {
      setVoiceStatus("listening");
      return;
    }
    if (type === "input_audio_buffer.speech_stopped" || type === "response.created") {
      setVoiceStatus("thinking");
      return;
    }
    if (type === "conversation.item.input_audio_transcription.completed") {
      appendTranscriptMessage("user", event.transcript || "", event.item_id ? `voice-user-${event.item_id}` : undefined);
      return;
    }
    if (type === "conversation.item.input_audio_transcription.failed") {
      setError("I heard you, but couldn’t create a transcript for that turn. Please try again.");
      return;
    }
    if (type === "response.output_audio.delta") {
      setVoiceStatus("speaking");
      return;
    }
    if (type === "response.output_audio_transcript.delta") {
      if (event.response_id && assistantResponseIdRef.current !== event.response_id) {
        assistantResponseIdRef.current = event.response_id;
        assistantTranscriptRef.current = "";
      }
      assistantTranscriptRef.current += event.delta || "";
      setLiveVoiceTranscript(assistantTranscriptRef.current);
      return;
    }
    if (type === "response.output_audio_transcript.done") {
      const responseId = event.response_id || assistantResponseIdRef.current || messageId("voice-response");
      const transcript = event.transcript || assistantTranscriptRef.current;
      appendTranscriptMessage("assistant", transcript, `voice-assistant-${responseId}`);
      assistantTranscriptRef.current = "";
      assistantResponseIdRef.current = "";
      setLiveVoiceTranscript("");
      return;
    }
    if (type === "response.done") {
      const responseError = event.response?.status_details?.error?.message;
      if (event.response?.status === "failed" || responseError) setError(responseError || "Audito voice could not complete that response.");
      if (assistantTranscriptRef.current.trim()) {
        const responseId = event.response_id || assistantResponseIdRef.current || messageId("voice-response");
        appendTranscriptMessage("assistant", assistantTranscriptRef.current, `voice-assistant-${responseId}`);
        assistantTranscriptRef.current = "";
        assistantResponseIdRef.current = "";
        setLiveVoiceTranscript("");
      }
      setVoiceStatus("listening");
      return;
    }
    if (type === "error") {
      setError(event.error?.message || "Audito voice encountered a temporary error. You can continue with text chat.");
      setVoiceStatus("listening");
    }
  }, [appendTranscriptMessage]);

  const startVoice = async () => {
    if (voiceActive || voiceStartingRef.current || sending) return;
    setError("");
    setAudioNeedsResume(false);
    if (!window.isSecureContext && window.location.hostname !== "localhost") {
      setError("Voice requires a secure HTTPS connection. You can continue using text chat.");
      return;
    }
    if (!navigator.mediaDevices?.getUserMedia || typeof RTCPeerConnection === "undefined") {
      setError("Voice isn’t supported by this browser. You can continue using text chat.");
      return;
    }

    voiceStartingRef.current = true;
    setVoiceStatus("connecting");
    let connection: RTCPeerConnection | null = null;
    let stream: MediaStream | null = null;
    try {
      stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
      });
      mediaStreamRef.current = stream;

      const history = messages
        .filter(item => item.id !== "welcome")
        .slice(-6)
        .map(item => ({ role: item.role, content: item.text }));
      const sessionResult = await landingApi.createAssistantVoiceSession(history);
      if (!sessionResult.success || !sessionResult.data?.value) {
        throw new Error(sessionResult.message || AI_UNAVAILABLE_MESSAGE);
      }

      connection = new RTCPeerConnection();
      peerConnectionRef.current = connection;
      stream.getTracks().forEach(track => connection?.addTrack(track, stream!));

      connection.ontrack = event => {
        const audio = audioRef.current;
        if (!audio) return;
        audio.srcObject = event.streams[0];
        void audio.play().then(() => setAudioNeedsResume(false)).catch(() => setAudioNeedsResume(true));
      };
      connection.onconnectionstatechange = () => {
        if (peerConnectionRef.current !== connection) return;
        if (connection?.connectionState === "connected") setVoiceStatus("listening");
        if (connection?.connectionState === "failed" || connection?.connectionState === "disconnected") {
          setError("The voice connection ended. You can reconnect or continue with text chat.");
          stopVoice();
        }
      };

      const dataChannel = connection.createDataChannel("oai-events");
      dataChannelRef.current = dataChannel;
      dataChannel.onopen = () => setVoiceStatus("listening");
      dataChannel.onmessage = message => {
        try { handleRealtimeEvent(JSON.parse(String(message.data)) as RealtimeEvent); }
        catch { /* Ignore malformed transport events without ending the call. */ }
      };
      dataChannel.onerror = () => setError("Voice controls encountered a temporary connection error.");
      dataChannel.onclose = () => {
        if (dataChannelRef.current !== dataChannel) return;
        setError("The voice session ended. You can reconnect or continue with text chat.");
        stopVoice();
      };

      const offer = await connection.createOffer();
      await connection.setLocalDescription(offer);
      const sdpResponse = await fetch("https://api.openai.com/v1/realtime/calls", {
        method: "POST",
        body: offer.sdp,
        headers: {
          Authorization: `Bearer ${sessionResult.data.value}`,
          "Content-Type": "application/sdp",
        },
      });
      if (!sdpResponse.ok) throw new Error("The secure voice connection could not be established.");
      await connection.setRemoteDescription({ type: "answer", sdp: await sdpResponse.text() });
    } catch (voiceError) {
      const browserError = voiceError instanceof DOMException && voiceError.name === "NotAllowedError"
        ? "Microphone access was blocked. Allow microphone permission to use voice, or continue with text chat."
        : voiceError instanceof Error ? voiceError.message : "Audito voice could not start. Please use text chat or try again.";
      setError(browserError);
      stopVoice();
    } finally {
      voiceStartingRef.current = false;
    }
  };

  const toggleVoiceMute = () => {
    const nextMuted = !voiceMuted;
    mediaStreamRef.current?.getAudioTracks().forEach(track => { track.enabled = !nextMuted; });
    setVoiceMuted(nextMuted);
  };

  const stopVoiceResponse = () => {
    const channel = dataChannelRef.current;
    if (channel?.readyState === "open") {
      channel.send(JSON.stringify({ type: "response.cancel" }));
      channel.send(JSON.stringify({ type: "output_audio_buffer.clear" }));
    }
    setVoiceStatus("listening");
  };

  const resumeAudio = async () => {
    try {
      await audioRef.current?.play();
      setAudioNeedsResume(false);
    } catch {
      setError("Your browser is blocking audio playback. Check the site’s sound permission.");
    }
  };

  const sendMessage = async (rawMessage: string) => {
    const message = rawMessage.trim();
    if (!message || sending || voiceActive) return;
    if (message.length > 1000) { setError("Please keep your question under 1,000 characters."); return; }
    const history = messages
      .filter(item => item.id !== "welcome")
      .slice(-6)
      .map(item => ({ role: item.role, content: item.text }));

    setInput("");
    setError("");
    setMessages(current => [...current, { id: messageId("user"), role: "user", text: message }]);
    setSending(true);
    try {
      const result = await landingApi.askAssistant(message, history);
      const data = result.data;
      if (result.success && data) {
        setMessages(current => [...current, { id: messageId("assistant"), role: "assistant", text: data.answer, actions: data.actions }]);
      } else {
        setError(result.message || AI_UNAVAILABLE_MESSAGE);
      }
    } catch {
      setError(AI_UNAVAILABLE_MESSAGE);
    } finally {
      setSending(false);
    }
  };

  const handleSubmit = (event: FormEvent) => { event.preventDefault(); void sendMessage(input); };
  const handleKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === "Enter" && !event.shiftKey) { event.preventDefault(); void sendMessage(input); }
  };
  const reset = () => {
    stopVoice();
    setMessages([welcomeMessage()]);
    recordedTranscriptIdsRef.current.clear();
    setInput("");
    setError("");
  };
  const closeAssistant = () => { stopVoice(); setOpen(false); };
  const followAction = (action: LandingAssistantAction) => {
    stopVoice();
    if (action.target === "pricing") setActiveSection(0);
    else if (action.target === "features") setActiveSection(1);
    else if (action.target === "contact") setActiveSection(3);
    else if (action.target === "register") openPackageSetup();
    else router.push("/custom-solution");
    setOpen(false);
  };

  const currentVoiceStatus = voiceStatus === "idle" ? null : voiceStatusText[voiceStatus];

  return (
    <div className="z-50">
      <audio ref={audioRef} autoPlay className="hidden" />
      {open && (
        <section aria-label="Audito AI Assistant" className="fixed bottom-20 right-4 flex h-[min(44rem,calc(100dvh-7rem))] w-[calc(100vw-2rem)] max-w-[25rem] flex-col overflow-hidden rounded-3xl border border-white/15 bg-[#092018]/95 shadow-2xl shadow-black/50 backdrop-blur-2xl sm:bottom-[5.5rem] sm:right-6 sm:w-[25rem]">
          <header className="flex items-center justify-between border-b border-white/[.09] bg-gradient-to-r from-secondary-500/15 to-transparent px-4 py-3.5">
            <div className="flex min-w-0 items-center gap-3">
              <div className={`flex h-9 w-9 items-center justify-center rounded-xl border text-secondary-300 ${voiceActive ? "border-secondary-400/40 bg-secondary-500/20" : "border-secondary-400/25 bg-secondary-500/15"}`}>{voiceActive ? <AudioLines size={19} className={voiceStatus === "speaking" ? "animate-pulse" : ""} /> : <Bot size={19} />}</div>
              <div><h2 className="text-sm font-bold text-white">Audito AI</h2><p className={`text-[11px] ${voiceActive ? "text-secondary-200" : "text-secondary-300"}`}>{voiceActive ? voiceMuted ? "Voice · Microphone muted" : `Voice · ${currentVoiceStatus?.title}` : "Online"}</p></div>
            </div>
            <div className="flex items-center gap-1">
              <button type="button" onClick={reset} title="Start new chat" className="rounded-lg p-2 text-gray-400 transition hover:bg-white/[.07] hover:text-white"><RotateCcw size={15} /></button>
              <button type="button" onClick={closeAssistant} title="Close assistant" className="rounded-lg p-2 text-gray-400 transition hover:bg-white/[.07] hover:text-white"><ChevronDown size={18} /></button>
            </div>
          </header>

          <div className="flex-1 space-y-3 overflow-y-auto px-3 py-4">
            <div className="rounded-xl border border-amber-400/15 bg-amber-400/[.06] px-3 py-2 text-[11px] leading-relaxed text-amber-100/75">Don’t share passwords, payment details, audit records, or personal information. Microphone audio is streamed only while voice mode is active.</div>

            {voiceActive && currentVoiceStatus ? (
              <div className="overflow-hidden rounded-2xl border border-secondary-400/25 bg-gradient-to-br from-secondary-500/[.14] to-white/[.025] p-4" role="status" aria-live="polite">
                <div className="flex items-center gap-3">
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full border border-secondary-400/25 bg-primary-950/35">
                    {voiceStatus === "connecting" ? <Loader2 size={20} className="animate-spin text-secondary-300" /> : <div className="flex h-6 items-center gap-0.5">{[0, 1, 2, 3].map(bar => <span key={bar} className={`w-1 rounded-full bg-secondary-300 ${voiceStatus === "listening" || voiceStatus === "speaking" ? "animate-pulse" : ""}`} style={{ height: `${10 + ((bar * 7) % 13)}px`, animationDelay: `${bar * 110}ms` }} />)}</div>}
                  </div>
                  <div className="min-w-0"><p className="text-sm font-semibold text-white">{voiceMuted ? "Microphone muted" : currentVoiceStatus.title}</p><p className="mt-0.5 text-xs leading-5 text-gray-400">{voiceMuted ? "Unmute when you’re ready to continue." : currentVoiceStatus.detail}</p></div>
                </div>
                {audioNeedsResume ? <button type="button" onClick={() => void resumeAudio()} className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl border border-amber-300/20 bg-amber-300/10 px-3 py-2 text-xs font-semibold text-amber-100"><Volume2 size={14} /> Tap to hear Audito AI</button> : null}
                <div className="mt-3 grid grid-cols-3 gap-2 border-t border-white/[.08] pt-3">
                  <button type="button" onClick={toggleVoiceMute} disabled={voiceStatus === "connecting"} className="flex min-h-10 items-center justify-center gap-1.5 rounded-xl border border-white/10 bg-white/[.04] text-xs font-semibold text-gray-200 transition hover:bg-white/[.08] disabled:opacity-40">{voiceMuted ? <MicOff size={15} /> : <Mic size={15} />}{voiceMuted ? "Unmute" : "Mute"}</button>
                  <button type="button" onClick={stopVoiceResponse} disabled={voiceStatus !== "speaking" && voiceStatus !== "thinking"} className="flex min-h-10 items-center justify-center gap-1.5 rounded-xl border border-white/10 bg-white/[.04] text-xs font-semibold text-gray-200 transition hover:bg-white/[.08] disabled:opacity-35"><Square size={13} /> Stop</button>
                  <button type="button" onClick={stopVoice} className="flex min-h-10 items-center justify-center gap-1.5 rounded-xl border border-red-400/20 bg-red-400/10 text-xs font-semibold text-red-200 transition hover:bg-red-400/15"><PhoneOff size={15} /> End</button>
                </div>
              </div>
            ) : null}

            {messages.map(message => (
              <div key={message.id} className={message.role === "user" ? "flex justify-end" : "flex justify-start"}>
                <div className={`max-w-[88%] rounded-2xl px-3.5 py-3 text-sm leading-relaxed ${message.role === "user" ? "rounded-br-md bg-secondary-500 text-primary-950" : "rounded-bl-md border border-white/[.09] bg-white/[.055] text-gray-200"}`}>
                  <div className={`mb-1 flex items-center gap-1.5 text-[10px] font-semibold ${message.role === "user" ? "text-primary-950/70" : "text-secondary-300"}`}>{message.role === "user" ? <UserRound size={11} /> : <Bot size={11} />}{message.role === "user" ? "You" : "Audito AI"}</div>
                  <p>{message.text}</p>
                  {message.actions?.length ? <div className="mt-3 flex flex-wrap gap-1.5">{message.actions.map(action => <button key={`${message.id}-${action.target}`} type="button" onClick={() => followAction(action)} className="inline-flex items-center gap-1 rounded-lg border border-secondary-400/25 bg-secondary-500/10 px-2.5 py-1.5 text-[11px] font-semibold text-secondary-200 transition hover:bg-secondary-500/20"><ArrowUpRight size={12} />{action.label}</button>)}</div> : null}
                </div>
              </div>
            ))}
            {liveVoiceTranscript ? <div className="flex justify-start"><div className="max-w-[88%] rounded-2xl rounded-bl-md border border-secondary-400/15 bg-secondary-500/[.07] px-3.5 py-3 text-sm leading-relaxed text-gray-200"><div className="mb-1 flex items-center gap-1.5 text-[10px] font-semibold text-secondary-300"><AudioLines size={11} />Audito AI · speaking</div><p>{liveVoiceTranscript}<span className="ml-1 inline-block h-3 w-1 animate-pulse rounded bg-secondary-300" /></p></div></div> : null}
            {sending && <div className="flex justify-start"><div className="rounded-2xl rounded-bl-md border border-white/[.09] bg-white/[.055] px-3.5 py-3 text-secondary-300"><div className="flex gap-1"><span className="h-1.5 w-1.5 animate-bounce rounded-full bg-secondary-300 [animation-delay:-0.2s]" /><span className="h-1.5 w-1.5 animate-bounce rounded-full bg-secondary-300 [animation-delay:-0.1s]" /><span className="h-1.5 w-1.5 animate-bounce rounded-full bg-secondary-300" /></div></div></div>}
            {!voiceActive ? <div className="pt-1"><p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-gray-500">Try asking</p><div className="flex flex-wrap gap-1.5">{SUGGESTIONS.map(suggestion => <button key={suggestion} type="button" disabled={sending} onClick={() => void sendMessage(suggestion)} className="rounded-lg border border-white/[.09] bg-white/[.035] px-2.5 py-1.5 text-left text-[11px] text-gray-300 transition hover:border-secondary-400/30 hover:bg-secondary-500/10 hover:text-secondary-200 disabled:opacity-50">{suggestion}</button>)}</div></div> : null}
            <div ref={transcriptEndRef} />
          </div>

          <form onSubmit={handleSubmit} className="border-t border-white/[.09] p-3">
            <div className="flex items-end gap-2 rounded-2xl border border-white/10 bg-black/15 p-1.5 focus-within:border-secondary-400/45">
              <button type="button" onClick={() => void startVoice()} disabled={voiceActive || sending} title={voiceActive ? "Voice mode is active" : "Start voice conversation"} aria-label="Start voice conversation" className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-white/10 bg-white/[.04] text-secondary-300 transition hover:border-secondary-400/35 hover:bg-secondary-500/10 disabled:cursor-not-allowed disabled:opacity-40"><Mic size={16} /></button>
              <textarea value={input} onChange={event => setInput(event.target.value)} onKeyDown={handleKeyDown} rows={1} maxLength={1000} disabled={voiceActive} placeholder={voiceActive ? "End voice mode to type…" : "Ask about Audito…"} className="max-h-24 min-h-9 flex-1 resize-none bg-transparent px-2 py-2 text-sm text-white outline-none placeholder:text-gray-500 disabled:cursor-not-allowed disabled:opacity-55" />
              <button type="submit" disabled={!input.trim() || sending || voiceActive} className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-secondary-500 text-primary-950 transition hover:bg-secondary-400 disabled:cursor-not-allowed disabled:opacity-40" aria-label="Send message"><Send size={16} /></button>
            </div>
            {error && <p className="mt-2 text-xs leading-5 text-red-300">{error}</p>}
            {!voiceActive ? <p className="mt-2 text-center text-[10px] text-gray-600">Use the microphone for a hands-free conversation.</p> : null}
          </form>
        </section>
      )}
      <button type="button" onClick={() => open ? closeAssistant() : setOpen(true)} aria-label={open ? "Close Audito AI" : "Open Audito AI"} className="fixed bottom-4 right-4 z-50 flex h-12 w-12 items-center justify-center rounded-full bg-secondary-500 text-primary-950 shadow-xl shadow-black/30 transition hover:-translate-y-0.5 hover:bg-secondary-400 sm:bottom-6 sm:right-6">{voiceActive ? <AudioLines size={21} className="animate-pulse" /> : <MessageCircle size={21} />}<span className="absolute right-0.5 top-0.5 h-2.5 w-2.5 rounded-full border-2 border-[#0b2118] bg-emerald-400" /></button>
    </div>
  );
}
