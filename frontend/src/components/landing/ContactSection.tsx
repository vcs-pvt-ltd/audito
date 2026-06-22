"use client";

import Image, { type StaticImageData } from "next/image";
import { useState } from "react";
import Link from "next/link";
import {
  Send,
  Loader2,
  CheckCircle,
  Star,
} from "lucide-react";
import testimonialsBg from "@/assets/landing/client-background.png";
import linkedinIcon from "@/assets/landing/icons/linkedin.png";
import mailIcon from "@/assets/landing/icons/mail.png";
import whatsappIcon from "@/assets/landing/icons/whatsapp.png";
import xIcon from "@/assets/landing/icons/x.png";
import Footer from "@/components/layout/Footer";
import Reveal from "./Reveal";
import { landingApi } from "@/lib/api";

export default function ContactSection() {
  const [form, setForm] = useState({
    name: "",
    email: "",
    company: "",
    phone: "",
    message: "",
  });
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: { preventDefault(): void }) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const res = await landingApi.submitContact(form);

    if (res.success) {
      setSubmitted(true);
      setForm({ name: "", email: "", company: "", phone: "", message: "" });
      setTimeout(() => { setSubmitted(false); }, 3000);
    } else {
      setError(res.message || "Failed to send message. Please try again.");
    }
    setLoading(false);
  };

  return (
    <section className="relative overflow-y-auto h-full">
      <style>{`
        @keyframes shimmerText {
          0%   { background-position: -200% center; }
          100% { background-position: 200% center; }
        }
        @keyframes successPop {
          0%   { opacity: 0; transform: scale(0.85) translateY(10px); }
          65%  { transform: scale(1.04) translateY(-2px); }
          100% { opacity: 1; transform: scale(1) translateY(0); }
        }
        @keyframes checkDraw {
          0%   { opacity: 0; transform: scale(0.5) rotate(-15deg); }
          60%  { transform: scale(1.15) rotate(4deg); }
          100% { opacity: 1; transform: scale(1) rotate(0deg); }
        }
        @keyframes sendShimmer {
          0%   { background-position: -200% center; }
          100% { background-position: 200% center; }
        }
        @keyframes socialBounce {
          0%, 100% { transform: translateY(0) scale(1); }
          40%       { transform: translateY(-5px) scale(1.12) rotate(-6deg); }
          70%       { transform: translateY(-2px) scale(1.06) rotate(3deg); }
        }
        @keyframes fadeInUp {
          from { opacity: 0; transform: translateY(16px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes starBadgePulse {
          0%, 100% { box-shadow: 0 0 0 0 rgba(0,212,146,0); }
          50%       { box-shadow: 0 0 0 6px rgba(0,212,146,0.08); }
        }

        .contact-heading { animation: fadeInUp 0.55s cubic-bezier(0.16,1,0.3,1) 0.1s both; }
        .contact-form    { animation: fadeInUp 0.55s cubic-bezier(0.16,1,0.3,1) 0.2s both; }

        .contact-gradient-text {
          background: linear-gradient(90deg, #A8D0AF, #8BB9AC, #D4AF37, #A8D0AF);
          background-size: 200% auto;
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          background-clip: text;
          animation: shimmerText 5s linear infinite;
        }

        .contact-input {
          transition: border-color 0.2s ease, box-shadow 0.2s ease, background 0.2s ease;
        }
        .contact-input:focus {
          border-color: rgba(0,212,146,0.5);
          box-shadow: 0 0 0 3px rgba(0,212,146,0.08), 0 0 12px rgba(0,212,146,0.06);
          background: rgba(255,255,255,0.03);
          outline: none;
        }

        .send-btn {
          position: relative;
          overflow: hidden;
          transition: transform 0.2s ease, box-shadow 0.2s ease, opacity 0.2s ease;
        }
        .send-btn::before {
          content: '';
          position: absolute;
          inset: 0;
          background: linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.25) 50%, transparent 100%);
          background-size: 200% auto;
          opacity: 0;
          transition: opacity 0.25s ease;
        }
        .send-btn:hover::before {
          opacity: 1;
          animation: sendShimmer 0.7s linear infinite;
        }
        .send-btn:hover:not(:disabled) {
          transform: translateY(-1px);
          box-shadow: 0 6px 20px rgba(0,0,0,0.25);
        }
        .send-btn:active:not(:disabled) { transform: translateY(0) scale(0.98); }

        .social-icon-btn {
          transition: transform 0.2s ease, background 0.2s ease, box-shadow 0.2s ease;
        }
        .social-icon-btn:hover {
          animation: socialBounce 0.5s ease forwards;
          background: rgba(255,255,255,0.2);
          box-shadow: 0 4px 16px rgba(0,0,0,0.2);
        }

        .testimonial-card {
          transition: transform 0.3s cubic-bezier(0.34,1.4,0.64,1), box-shadow 0.3s ease, border-color 0.3s ease;
        }
        .testimonial-card:hover {
          transform: translateY(-5px);
          box-shadow: 0 16px 48px rgba(0,0,0,0.35);
          border-color: rgba(255,255,255,0.2) !important;
        }
        .testimonial-card-featured:hover {
          box-shadow: 0 16px 48px rgba(0,0,0,0.35), 0 0 24px rgba(0,212,146,0.12);
          border-color: rgba(0,212,146,0.5) !important;
        }

        .star-badge {
          animation: starBadgePulse 3s ease-in-out infinite;
          transition: transform 0.2s ease;
        }
        .star-badge:hover { transform: scale(1.04); }

        .success-pop { animation: successPop 0.5s cubic-bezier(0.16,1,0.3,1) both; }
        .check-draw  { animation: checkDraw  0.45s cubic-bezier(0.16,1,0.3,1) 0.1s both; }
      `}</style>

      {/* Contact Form Section */}
      <div className="relative pt-20 pb-10 sm:py-12 lg:py-14 overflow-hidden">
        <div className="absolute inset-0 bg-black/20" />
        <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 w-full py-8 sm:py-10 lg:py-14">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 lg:gap-10 items-center max-w-6xl mx-auto">

            {/* Left: heading + social icons */}
            <div className="contact-heading space-y-6 sm:space-y-8 text-center lg:text-left">
              <div>
                <p className="text-xl sm:text-2xl lg:text-3xl text-white/90 font-medium">
                  Your Vision,
                </p>
                <h1 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-white leading-tight">
                  Our Innovation.
                </h1>
              </div>
              <div>
                <p className="text-sm text-gray-300 mb-3">Connect quickly with:</p>
                <div className="flex items-center gap-3 justify-center lg:justify-start">
                  <SocialIcon href="#" iconSrc={whatsappIcon} label="WhatsApp" />
                  <SocialIcon href="#" iconSrc={mailIcon} label="Email" />
                  <SocialIcon href="#" iconSrc={linkedinIcon} label="LinkedIn" />
                  <SocialIcon href="#" iconSrc={xIcon} label="X" />
                </div>
              </div>
            </div>

            {/* Right: form */}
            <div className="contact-form">
              {submitted ? (
                <div className="success-pop glass border border-white/20 rounded-xl p-8 sm:p-12 text-center">
                  <div className="check-draw inline-flex items-center justify-center w-14 h-14 sm:w-16 sm:h-16 rounded-full bg-accent-500/20 mb-5 sm:mb-6">
                    <CheckCircle size={28} className="text-accent-400" />
                  </div>
                  <h3 className="text-lg sm:text-xl font-bold text-white mb-2">
                    Message sent!
                  </h3>
                  <p className="text-gray-400 text-sm">
                    Thank you for reaching out. We&apos;ll get back to you within 24 hours.
                  </p>
                </div>
              ) : (
                <form
                  onSubmit={handleSubmit}
                  className="glass border border-white/20 rounded-xl p-5 sm:p-6 lg:p-8 space-y-3 sm:space-y-4"
                >
                  <h2 className="text-2xl sm:text-3xl font-bold text-white">
                    Let&apos;s Connect
                  </h2>
                  <p className="text-xs text-gray-300">
                    Not sure what you need? The team at ValueCraftMind will be happy to
                    listen to you and suggest ideas you haven&apos;t considered.
                  </p>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                    <div>
                      <FieldLabel>Full name</FieldLabel>
                      <input
                        type="text"
                        required
                        value={form.name}
                        onChange={(e) => setForm((s) => ({ ...s, name: e.target.value }))}
                        className="contact-input w-full px-3 py-2 rounded-md bg-transparent border border-white/25 text-white placeholder-gray-500 text-sm"
                        placeholder="Full name"
                      />
                    </div>
                    <div>
                      <FieldLabel>Email Address</FieldLabel>
                      <input
                        type="email"
                        required
                        value={form.email}
                        onChange={(e) => setForm((s) => ({ ...s, email: e.target.value }))}
                        className="contact-input w-full px-3 py-2 rounded-md bg-transparent border border-white/25 text-white placeholder-gray-500 text-sm"
                        placeholder="Email"
                      />
                    </div>
                    <div>
                      <FieldLabel>Company Name</FieldLabel>
                      <input
                        type="text"
                        value={form.company}
                        onChange={(e) => setForm((s) => ({ ...s, company: e.target.value }))}
                        className="contact-input w-full px-3 py-2 rounded-md bg-transparent border border-white/25 text-white placeholder-gray-500 text-sm"
                        placeholder="Company name"
                      />
                    </div>
                    <div>
                      <FieldLabel>Phone Number</FieldLabel>
                      <input
                        type="text"
                        value={form.phone}
                        onChange={(e) => setForm((s) => ({ ...s, phone: e.target.value }))}
                        className="contact-input w-full px-3 py-2 rounded-md bg-transparent border border-white/25 text-white placeholder-gray-500 text-sm"
                        placeholder="Phone number"
                      />
                    </div>
                  </div>

                  <div>
                    <FieldLabel>Message</FieldLabel>
                    <textarea
                      required
                      rows={4}
                      value={form.message}
                      onChange={(e) => setForm((s) => ({ ...s, message: e.target.value }))}
                      className="contact-input w-full px-3 py-2 rounded-md bg-transparent border border-white/25 text-white placeholder-gray-500 resize-none text-sm"
                      placeholder="Message"
                    />
                  </div>

                  {error && (
                    <div className="p-3 rounded-md bg-red-500/10 border border-red-500/20 text-red-400 text-xs">
                      {error}
                    </div>
                  )}

                  <button
                    type="submit"
                    disabled={loading}
                    className="send-btn w-full flex items-center justify-center gap-2 py-2.5 bg-white hover:bg-white/90 disabled:opacity-50 text-primary-950 font-semibold rounded-md text-sm"
                  >
                    {loading ? (
                      <Loader2 size={18} className="animate-spin" />
                    ) : (
                      <>
                        Send Message
                        <Send size={16} />
                      </>
                    )}
                  </button>

                  <p className="text-[11px] text-center text-gray-400">
                    Prefer to email directly? Reach us at info@valuecraftminds.com
                  </p>
                </form>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Testimonials Section */}
      <div className="relative overflow-hidden py-12 sm:py-16 lg:py-20">
        <Image
          src={testimonialsBg}
          alt="Client testimonials background"
          fill
          className="absolute inset-0 object-cover pointer-events-none opacity-5"
        />
        <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 w-full">
          <div className="max-w-6xl xl:max-w-7xl mx-auto">
            {/* Header */}
            <Reveal variant="up" className="text-center mb-8 sm:mb-10 lg:mb-12">
              <div className="star-badge inline-flex items-center gap-2 px-3 py-1 rounded-full bg-secondary-500/20 text-secondary-300 text-xs font-semibold mb-4">
                <Star size={12} className="fill-secondary-400 text-secondary-400" />
                Trusted by Leaders
              </div>
              <h2 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-white leading-tight mb-3 sm:mb-4">
                What Our Clients
                <br />
                <span className="contact-gradient-text">
                  Are Saying
                </span>
              </h2>
              <p className="text-gray-400 max-w-2xl mx-auto text-sm">
                Join hundreds of enterprises who have transformed their audit operations with Audito.
              </p>
            </Reveal>

            {/* Testimonials Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5 sm:gap-6">
              <Reveal variant="up" delay={0} className="h-full">
                <TestimonialCard
                  rating={5}
                  quote="Audito transformed our compliance workflow. We've reduced audit time by 70% and caught potential issues before they became problems."
                  name="Sarah Chen"
                  role="Chief Compliance Officer"
                  company="TechCorp Global"
                />
              </Reveal>
              <Reveal variant="up" delay={120} className="h-full">
                <TestimonialCard
                  rating={5}
                  quote="The AI-powered insights are game-changing. Audito doesn't just track compliance—it predicts and prevents risks. An essential tool for any enterprise."
                  name="Michael Rodriguez"
                  role="VP of Risk Management"
                  company="Financial Solutions Inc"
                  featured={true}
                />
              </Reveal>
              <Reveal variant="up" delay={240} className="sm:col-span-2 lg:col-span-1 h-full">
                <TestimonialCard
                  rating={5}
                  quote="Best audit management platform we've used. The interface is beautiful, the features are powerful, and the support team is exceptional."
                  name="Emma Thompson"
                  role="Director of Operations"
                  company="Global Enterprises"
                />
              </Reveal>
            </div>
          </div>
        </div>
      </div>

      <Footer />
    </section>
  );
}

function FieldLabel({ children }: { children: string }) {
  return <label className="block text-xs text-gray-300 mb-1">{children}</label>;
}

function SocialIcon({
  href,
  iconSrc,
  label,
}: {
  href: string;
  iconSrc: StaticImageData;
  label: string;
}) {
  return (
    <Link
      href={href}
      aria-label={label}
      className="social-icon-btn h-9 w-9 rounded-full bg-white/10 border border-white/10 flex items-center justify-center"
    >
      <Image src={iconSrc} alt={label} width={16} height={16} className="h-4 w-4 object-contain" />
    </Link>
  );
}

function TestimonialCard({
  rating,
  quote,
  name,
  role,
  company,
  featured = false,
}: {
  rating: number;
  quote: string;
  name: string;
  role: string;
  company: string;
  featured?: boolean;
}) {
  return (
    <div
      className={`testimonial-card relative rounded-2xl p-5 sm:p-6 h-full ${
        featured
          ? "testimonial-card-featured bg-gradient-to-br from-[#F1FDF9]/20 to-[#B7DAD0]/30 border border-secondary-500/40 shadow-xl shadow-secondary-500/10"
          : "glass border border-white/10"
      }`}
    >
      {featured && (
        <div className="absolute -top-3 left-1/2 -translate-x-1/2">
          <span className="px-4 py-1 bg-gradient-to-r from-[#EECA53] to-[#E1A300] text-primary-950 text-[10px] font-bold rounded-full uppercase tracking-wide shadow-lg">
            FEATURED
          </span>
        </div>
      )}
      <div className="flex gap-1 mb-4 sm:mb-5">
        {[...Array(rating)].map((_, i) => (
          <Star key={i} size={15} className="text-[#EECA53] fill-[#EECA53]" />
        ))}
      </div>
      <p className="text-sm text-gray-200 leading-relaxed mb-5 sm:mb-6">&ldquo;{quote}&rdquo;</p>
      <div className="border-t border-white/10 pt-4">
        <p className="text-white font-semibold text-sm">{name}</p>
        <p className="text-xs text-gray-400 mt-0.5">
          {role}
          <br />
          {company}
        </p>
      </div>
    </div>
  );
}
