"use client";

import { FormEvent, KeyboardEvent, useRef, useState } from "react";
import { ArrowUpRight, Bot, ChevronDown, MessageCircle, RotateCcw, Send, UserRound } from "lucide-react";
import { useRouter } from "next/navigation";
import { useLanding } from "@/context/LandingContext";
import { landingApi, type LandingAssistantAction } from "@/lib/api";

type Message = {
  id: string;
  role: "assistant" | "user";
  text: string;
  actions?: LandingAssistantAction[];
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
  text: "Hi, I’m Audito AI. I can answer questions using Audito’s published product knowledge.",
});

export default function LandingAssistant() {
  const router = useRouter();
  const { setActiveSection } = useLanding();
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<Message[]>([welcomeMessage()]);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const conversationId = useRef<string | null>(null);

  const sendMessage = async (rawMessage: string) => {
    const message = rawMessage.trim();
    if (!message || sending) return;
    if (message.length > 1000) { setError("Please keep your question under 1,000 characters."); return; }
    if (!conversationId.current) conversationId.current = crypto.randomUUID();

    setInput("");
    setError("");
    setMessages(current => [...current, { id: `user-${Date.now()}`, role: "user", text: message }]);
    setSending(true);
    try {
      const result = await landingApi.askAssistant(message);
      const data = result.data;
      if (result.success && data) {
        setMessages(current => [...current, {
          id: `assistant-${Date.now()}`,
          role: "assistant",
          text: data.answer,
          actions: data.actions,
        }]);
      } else {
        setError(result.message || "The Audito AI Assistant is unavailable right now. Please try again.");
      }
    } catch {
      setError("The Audito AI Assistant is unavailable right now. Please try again.");
    } finally {
      setSending(false);
    }
  };

  const handleSubmit = (event: FormEvent) => { event.preventDefault(); void sendMessage(input); };
  const handleKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === "Enter" && !event.shiftKey) { event.preventDefault(); void sendMessage(input); }
  };
  const reset = () => { setMessages([welcomeMessage()]); setInput(""); setError(""); conversationId.current = null; };
  const followAction = (action: LandingAssistantAction) => {
    if (action.target === "pricing") setActiveSection(0);
    else if (action.target === "features") setActiveSection(1);
    else if (action.target === "contact") setActiveSection(3);
    else if (action.target === "register") router.push("/register");
    else router.push("/custom-solution");
    setOpen(false);
  };

  return (
    <div className="z-50">
      {open && (
        <section aria-label="Audito AI Assistant" className="fixed bottom-20 right-4 flex h-[min(42rem,calc(100dvh-7rem))] w-[calc(100vw-2rem)] max-w-[24rem] flex-col overflow-hidden rounded-3xl border border-white/15 bg-[#092018]/95 shadow-2xl shadow-black/50 backdrop-blur-2xl sm:bottom-[5.5rem] sm:right-6 sm:w-[24rem]">
          <header className="flex items-center justify-between border-b border-white/[.09] bg-gradient-to-r from-secondary-500/15 to-transparent px-4 py-3.5">
            <div className="flex min-w-0 items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl border border-secondary-400/25 bg-secondary-500/15 text-secondary-300"><Bot size={19} /></div>
              <div><h2 className="text-sm font-bold text-white">Audito AI</h2><p className="text-[11px] text-secondary-300">Online</p></div>
            </div>
            <div className="flex items-center gap-1">
              <button type="button" onClick={reset} title="Start new chat" className="rounded-lg p-2 text-gray-400 transition hover:bg-white/[.07] hover:text-white"><RotateCcw size={15} /></button>
              <button type="button" onClick={() => setOpen(false)} title="Close assistant" className="rounded-lg p-2 text-gray-400 transition hover:bg-white/[.07] hover:text-white"><ChevronDown size={18} /></button>
            </div>
          </header>

          <div className="flex-1 space-y-3 overflow-y-auto px-3 py-4">
            <div className="rounded-xl border border-amber-400/15 bg-amber-400/[.06] px-3 py-2 text-[11px] leading-relaxed text-amber-100/75">Please don’t share passwords, payment details, audit records, or personal information here.</div>
            {messages.map(message => (
              <div key={message.id} className={message.role === "user" ? "flex justify-end" : "flex justify-start"}>
                <div className={`max-w-[88%] rounded-2xl px-3.5 py-3 text-sm leading-relaxed ${message.role === "user" ? "rounded-br-md bg-secondary-500 text-primary-950" : "rounded-bl-md border border-white/[.09] bg-white/[.055] text-gray-200"}`}>
                  <div className={`mb-1 flex items-center gap-1.5 text-[10px] font-semibold ${message.role === "user" ? "text-primary-950/70" : "text-secondary-300"}`}>
                    {message.role === "user" ? <UserRound size={11} /> : <Bot size={11} />}{message.role === "user" ? "You" : "Audito AI"}
                  </div>
                  <p>{message.text}</p>
                  {message.actions?.length ? <div className="mt-3 flex flex-wrap gap-1.5">{message.actions.map(action => <button key={`${message.id}-${action.target}`} type="button" onClick={() => followAction(action)} className="inline-flex items-center gap-1 rounded-lg border border-secondary-400/25 bg-secondary-500/10 px-2.5 py-1.5 text-[11px] font-semibold text-secondary-200 transition hover:bg-secondary-500/20"><ArrowUpRight size={12} />{action.label}</button>)}</div> : null}
                </div>
              </div>
            ))}
            {sending && <div className="flex justify-start"><div className="rounded-2xl rounded-bl-md border border-white/[.09] bg-white/[.055] px-3.5 py-3 text-secondary-300"><div className="flex gap-1"><span className="h-1.5 w-1.5 animate-bounce rounded-full bg-secondary-300 [animation-delay:-0.2s]" /><span className="h-1.5 w-1.5 animate-bounce rounded-full bg-secondary-300 [animation-delay:-0.1s]" /><span className="h-1.5 w-1.5 animate-bounce rounded-full bg-secondary-300" /></div></div></div>}
            <div className="pt-1"><p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-gray-500">Try asking</p><div className="flex flex-wrap gap-1.5">{SUGGESTIONS.map(suggestion => <button key={suggestion} type="button" disabled={sending} onClick={() => void sendMessage(suggestion)} className="rounded-lg border border-white/[.09] bg-white/[.035] px-2.5 py-1.5 text-left text-[11px] text-gray-300 transition hover:border-secondary-400/30 hover:bg-secondary-500/10 hover:text-secondary-200 disabled:opacity-50">{suggestion}</button>)}</div></div>
          </div>

          <form onSubmit={handleSubmit} className="border-t border-white/[.09] p-3">
            <div className="flex items-end gap-2 rounded-2xl border border-white/10 bg-black/15 p-1.5 focus-within:border-secondary-400/45">
              <textarea value={input} onChange={event => setInput(event.target.value)} onKeyDown={handleKeyDown} rows={1} maxLength={1000} placeholder="Ask about Audito..." className="max-h-24 min-h-9 flex-1 resize-none bg-transparent px-2 py-2 text-sm text-white outline-none placeholder:text-gray-500" />
              <button type="submit" disabled={!input.trim() || sending} className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-secondary-500 text-primary-950 transition hover:bg-secondary-400 disabled:cursor-not-allowed disabled:opacity-40" aria-label="Send message"><Send size={16} /></button>
            </div>
            {error && <p className="mt-2 text-xs text-red-300">{error}</p>}
          </form>
        </section>
      )}
      <button type="button" onClick={() => setOpen(current => !current)} aria-label={open ? "Close Audito AI" : "Open Audito AI"} className="fixed bottom-4 right-4 z-50 flex h-12 w-12 items-center justify-center rounded-full bg-secondary-500 text-primary-950 shadow-xl shadow-black/30 transition hover:-translate-y-0.5 hover:bg-secondary-400 sm:bottom-6 sm:right-6"><MessageCircle size={21} /><span className="absolute right-0.5 top-0.5 h-2.5 w-2.5 rounded-full border-2 border-[#0b2118] bg-emerald-400" /></button>
    </div>
  );
}
