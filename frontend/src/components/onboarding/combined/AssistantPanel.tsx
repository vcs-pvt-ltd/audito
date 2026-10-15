"use client";

import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { AlertTriangle, Bot, FileUp, Mic, Save, Send, Square, UserRound, X } from "lucide-react";
import { Button } from "@/components/ui";
import type { ChatMessage } from "./model";
import { inputClass } from "./ui";
import { EASE, notice } from "../motion";

type SpeechResult = { results: ArrayLike<ArrayLike<{ transcript: string }>> };
type SpeechCapture = { lang: string; interimResults: boolean; continuous: boolean; onresult: ((event: SpeechResult) => void) | null; onerror: (() => void) | null; onend: (() => void) | null; start: () => void; stop: () => void; abort: () => void };
type SpeechWindow = Window & { SpeechRecognition?: new () => SpeechCapture; webkitSpeechRecognition?: new () => SpeechCapture };

const PROMPTS: Record<number, string[]> = {
  1: ["Find any organization areas missed in my sheet", "Check each area's reporting line against my sheet"],
  2: ["Suggest answers and points for questions without them", "Assign every question to the whole organization", "Remove questions about the past audit results"],
  3: ["Suggest a checklist name from my sheet"],
};

export default function AssistantPanel({ step, messages, busy, aiAvailable, dirty, onSend, onSaveDraft, onUploadAgain }: {
  step: number; messages: ChatMessage[]; busy: boolean; aiAvailable: boolean; dirty: boolean;
  onSend: (text: string) => Promise<boolean>; onSaveDraft: () => void; onUploadAgain: () => void;
}) {
  const [text, setText] = useState("");
  const [listening, setListening] = useState(false);
  const [voiceAvailable, setVoiceAvailable] = useState(false);
  const [voiceError, setVoiceError] = useState("");
  // Text that came from the microphone is reviewed before it is sent.
  const [fromVoice, setFromVoice] = useState(false);
  const recognition = useRef<SpeechCapture | null>(null);
  const endRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    const speechWindow = window as SpeechWindow;
    setVoiceAvailable(Boolean(speechWindow.SpeechRecognition || speechWindow.webkitSpeechRecognition));
    return () => recognition.current?.abort();
  }, []);
  useEffect(() => { endRef.current?.scrollIntoView({ block: "nearest" }); }, [messages.length, busy]);
  useEffect(() => { if (busy) recognition.current?.stop(); }, [busy]);

  function startVoice() {
    const Speech = (window as SpeechWindow).SpeechRecognition || (window as SpeechWindow).webkitSpeechRecognition;
    if (!Speech) return;
    const capture = new Speech();
    recognition.current = capture;
    capture.lang = navigator.language || "en-US"; capture.interimResults = false; capture.continuous = false;
    capture.onresult = event => {
      setText(current => `${current} ${Array.from(event.results).map(result => result[0].transcript).join(" ")}`.trim().slice(0, 2000));
      setFromVoice(true);
    };
    capture.onerror = () => { setListening(false); setVoiceError("Voice input is unavailable. Check microphone permission or type your change."); };
    capture.onend = () => setListening(false);
    setVoiceError("");
    try { capture.start(); setListening(true); } catch { setVoiceError("Could not start the microphone. Type your change instead."); }
  }
  async function send(value: string) {
    if (!value.trim() || busy) return;
    if (await onSend(value.trim())) { setText(""); setFromVoice(false); }
  }

  return <div className="flex min-h-0 flex-1 flex-col">
    <div className="min-h-[160px] flex-1 space-y-3 overflow-y-auto p-4" aria-live="polite">
      {!messages.length && <div className="flex gap-2"><span className="mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-full bg-white/10 text-secondary-300" aria-hidden><Bot size={12} /></span><p className="rounded-2xl border border-white/10 bg-white/[.04] px-3 py-2 text-sm leading-6 text-gray-200">Tell me what to change, by typing or speaking. For example: move an area, rename it, or suggest answers and points. Changed items are highlighted so you can check them.</p></div>}
      <AnimatePresence initial={false}>
        {messages.map(message => <motion.div key={message.id} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.18, ease: EASE }} className={`flex gap-2 ${message.role === "user" ? "justify-end" : ""}`}>
          {message.role === "assistant" && <span className="mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-full bg-white/10 text-secondary-300" aria-hidden><Bot size={12} /></span>}
          <p className={`max-w-[85%] whitespace-pre-wrap rounded-2xl px-3 py-2 text-sm leading-6 ${message.role === "user" ? "bg-secondary-400 text-primary-950" : "border border-white/10 bg-white/[.04] text-gray-200"}`}>
            <span className="sr-only">{message.role === "user" ? "You: " : "Audito AI: "}</span>{message.content}
          </p>
          {message.role === "user" && <span className="mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-full bg-secondary-400 text-primary-950" aria-hidden><UserRound size={12} /></span>}
        </motion.div>)}
        {busy && <motion.div key="working" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex items-center gap-2 text-xs text-gray-400" role="status">
          <span className="grid h-6 w-6 place-items-center rounded-full bg-white/10 text-secondary-300" aria-hidden><Bot size={12} /></span>
          <span className="flex gap-1" aria-hidden>{[0, 1, 2].map(i => <span key={i} className="h-1.5 w-1.5 animate-pulse rounded-full bg-secondary-300" style={{ animationDelay: `${i * 150}ms` }} />)}</span>
          Working on your change…
        </motion.div>}
      </AnimatePresence>
      <div ref={endRef} />
    </div>
    <div className="space-y-3 border-t border-white/10 p-4">
      {!aiAvailable && <div className="rounded-xl border border-amber-400/20 bg-amber-400/10 p-3 text-xs text-amber-100">
        <p className="flex items-start gap-2"><AlertTriangle size={14} className="mt-0.5 shrink-0" aria-hidden />Upload your sheet again so AI can check changes against it. You can still edit the draft yourself.</p>
        <button type="button" disabled={busy} className="mt-2 font-semibold underline" onClick={onUploadAgain}>Upload again</button>
      </div>}
      {(PROMPTS[step] || []).length > 0 && !text && !listening && <div>
        <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-[.12em] text-gray-500">Try</p>
        <div className="flex flex-wrap gap-1.5">{PROMPTS[step].map(prompt => <button key={prompt} type="button" disabled={busy || !aiAvailable} onClick={() => { setText(prompt); setFromVoice(false); }} className="rounded-full border border-white/10 px-2.5 py-1.5 text-left text-xs text-gray-300 hover:border-secondary-400/30 hover:text-secondary-200 disabled:opacity-40">{prompt}</button>)}</div>
      </div>}
      <AnimatePresence initial={false}>
        {fromVoice && text && !listening && <motion.div variants={notice} initial="initial" animate="animate" exit="exit" className="overflow-hidden">
          <p className="flex items-start gap-2 rounded-xl border border-secondary-400/25 bg-secondary-400/[.08] p-2.5 text-xs leading-5 text-secondary-100">
            <Mic size={14} className="mt-0.5 shrink-0" aria-hidden />
            <span className="flex-1">Check the voice transcript below. Fix anything that was misheard, then send it.</span>
            <button type="button" aria-label="Clear transcript" onClick={() => { setText(""); setFromVoice(false); }} className="shrink-0 text-secondary-200 hover:text-white"><X size={14} /></button>
          </p>
        </motion.div>}
      </AnimatePresence>
      <label className="block"><span className="sr-only">{fromVoice ? "Voice transcript. Edit before sending" : "Your change"}</span>
        <textarea className={`${inputClass} resize-none ${fromVoice && text ? "border-secondary-400/50" : ""}`} rows={3} maxLength={2000} placeholder={listening ? "Listening… speak now" : "For example: Move Packing under the factory in my sheet."} value={text} disabled={busy}
          onChange={event => setText(event.target.value)} onKeyDown={event => { if (event.key === "Enter" && (event.ctrlKey || event.metaKey)) void send(text); }} />
      </label>
      <p className="text-[11px] leading-4 text-gray-400" role={voiceError ? "alert" : undefined}>{voiceError || (listening
        ? <span className="flex items-center gap-1.5 text-red-200"><span className="h-2 w-2 animate-pulse rounded-full bg-red-400" aria-hidden />Recording. Tap stop when you finish speaking.</span>
        : voiceAvailable ? "Voice uses your browser’s speech service. Press Ctrl + Enter to send." : "Voice is unavailable in this browser. Type your change and press Ctrl + Enter to send.")}</p>
      <div className="flex gap-2">
        {voiceAvailable && <Button variant="secondary" aria-label={listening ? "Stop recording" : "Start voice input"} aria-pressed={listening} disabled={busy} onClick={() => listening ? recognition.current?.stop() : startVoice()} className="!min-h-11 !px-3.5">{listening ? <Square size={16} className="text-red-300" /> : <Mic size={16} />}</Button>}
        <Button fullWidth disabled={busy || listening || !text.trim() || !aiAvailable} loading={busy} leftIcon={<Send size={15} />} onClick={() => void send(text)} className="min-h-11">{busy ? "Applying…" : "Send change"}</Button>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-2 border-t border-white/10 pt-3 text-xs">
        <span className={dirty ? "text-amber-200" : "text-gray-400"}>{dirty ? "Unsaved changes" : "Draft saved · nothing is live yet"}</span>
        <span className="flex gap-1">
          <button type="button" disabled={busy || !dirty} className="flex min-h-9 items-center gap-1 rounded-lg px-2 font-semibold text-secondary-300 hover:bg-white/[.05] disabled:opacity-40" onClick={onSaveDraft}><Save size={13} aria-hidden />Save draft</button>
          <button type="button" disabled={busy} className="flex min-h-9 items-center gap-1 rounded-lg px-2 text-gray-300 hover:bg-white/[.05] hover:text-white disabled:opacity-40" onClick={onUploadAgain}><FileUp size={13} aria-hidden />Read another sheet</button>
        </span>
      </div>
    </div>
  </div>;
}
