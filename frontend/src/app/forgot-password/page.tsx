"use client";

import { useEffect, useState, useMemo } from "react";
import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { Mail, KeyRound, Lock, Eye, EyeOff, Loader2, ArrowLeft, Check } from "lucide-react";
import { authApi } from "@/lib/api";
import auditoLogo from "../../assets/logo/audito_logo.png";

type Step = "email" | "otp" | "reset" | "done";

export default function ForgotPasswordPage() {
  const router = useRouter();
  const [step, setStep] = useState<Step>("email");

  const [email, setEmail] = useState("");
  const [otp, setOtp] = useState("");
  const [resetToken, setResetToken] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [resendSeconds, setResendSeconds] = useState(0);
  const [resendMessage, setResendMessage] = useState("");

  useEffect(() => {
    if (resendSeconds <= 0) return;
    const timer = window.setInterval(() => setResendSeconds((current) => Math.max(0, current - 1)), 1000);
    return () => window.clearInterval(timer);
  }, [resendSeconds]);

  const passwordRequirements = useMemo(() => ({
    length: newPassword.length >= 8,
    upper: /[A-Z]/.test(newPassword),
    lower: /[a-z]/.test(newPassword),
    number: /[0-9]/.test(newPassword),
    special: /[@$!%*?&#]/.test(newPassword),
  }), [newPassword]);

  const passwordStrength = useMemo(() => {
    const met = Object.values(passwordRequirements).filter(Boolean).length;
    if (met === 0) return { label: "", color: "bg-gray-800", width: "0%", text: "text-gray-500" };
    if (met <= 2) return { label: "Weak", color: "bg-red-500", width: "33%", text: "text-red-500" };
    if (met <= 4) return { label: "Medium", color: "bg-yellow-500", width: "66%", text: "text-yellow-500" };
    return { label: "Strong", color: "bg-emerald-500", width: "100%", text: "text-emerald-500" };
  }, [passwordRequirements]);

  const handleSendOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (!email.trim()) { setError("Email is required."); return; }
    setLoading(true);
    try {
      const res = await authApi.forgotPassword(email);
      if (res.success) {
        setStep("otp");
        setResendSeconds(30);
        setResendMessage("");
      }
      else setError(res.message || "Failed to send OTP.");
    } catch {
      setError("Something went wrong.");
    } finally {
      setLoading(false);
    }
  };

  const handleResendOtp = async () => {
    if (!email.trim() || loading || resendSeconds > 0) return;
    setLoading(true);
    setError("");
    setResendMessage("");
    try {
      const res = await authApi.forgotPassword(email);
      if (res.success) {
        setResendSeconds(30);
        setResendMessage("A new verification code has been sent to your email.");
      } else {
        setError(res.message || "Failed to resend OTP.");
      }
    } catch {
      setError("Something went wrong.");
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (!otp.trim()) { setError("OTP is required."); return; }
    setLoading(true);
    try {
      const res = await authApi.verifyOtp(email, otp);
      const data = res.data as { reset_token: string } | undefined;
      if (res.success && data?.reset_token) {
        setResetToken(data.reset_token);
        setStep("reset");
      } else {
        setError(res.message || "Invalid OTP.");
      }
    } catch {
      setError("Something went wrong.");
    } finally {
      setLoading(false);
    }
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    const { length, upper, lower, number, special } = passwordRequirements;
    if (!length || !upper || !lower || !number || !special) {
      setError("Please ensure your password meets all requirements.");
      return;
    }
    if (newPassword !== confirmPassword) { setError("Passwords do not match."); return; }
    setLoading(true);
    try {
      const res = await authApi.resetPassword(email, resetToken, newPassword);
      if (res.success) setStep("done");
      else setError(res.message || "Failed to reset password.");
    } catch {
      setError("Something went wrong.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-8 sm:py-12">
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute top-1/3 right-1/3 w-80 h-80 bg-primary-600/15 rounded-full blur-3xl" />
        <div className="absolute bottom-1/4 left-1/3 w-60 h-60 bg-accent-500/10 rounded-full blur-3xl" />
      </div>

      <div className="relative w-full max-w-md">
        <div className="rounded-2xl border border-white/10 bg-[#053B36] p-5 shadow-2xl shadow-black/30 backdrop-blur-xl sm:p-8">
          <div className="mb-7 flex items-center gap-2">
            <button
              type="button"
              onClick={() => router.push("/")}
              aria-label="Back to home"
              className="rounded-lg p-1 text-[#059669] transition-colors hover:bg-white/5 hover:text-[#20b67a]"
            >
              <ArrowLeft size={18} />
            </button>
            <button type="button" onClick={() => router.push("/")} className="text-sm text-[#059669] transition-colors hover:text-[#20b67a]">
              Back to Home
            </button>
          </div>

          <div className="mb-7 text-center">
            <Link href="/" className="mb-5 inline-block">
              <Image src={auditoLogo} alt="Audito" width={125} height={30} className="mx-auto h-10" />
            </Link>
            <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-secondary-400">Password recovery</p>
            <h1 className="mt-2 text-2xl font-bold tracking-tight text-white">
              {step === "email" && "Reset your password"}
              {step === "otp" && "Verify your email"}
              {step === "reset" && "Create a new password"}
              {step === "done" && "Password reset successful"}
            </h1>
            <p className="mt-2 text-sm leading-6 text-gray-400">
              {step === "email" && "Enter your account email and we’ll send a secure verification code."}
              {step === "otp" && "Enter the six-digit code we sent to your email address."}
              {step === "reset" && "Choose a strong password to keep your workspace secure."}
              {step === "done" && "Your new password is ready to use."}
            </p>
            {step !== "done" && (
              <div className="mx-auto mt-5 flex max-w-[13rem] items-center gap-2">
                {(["email", "otp", "reset"] as Step[]).map((item, index) => {
                  const activeIndex = ["email", "otp", "reset"].indexOf(step);
                  const isComplete = index < activeIndex;
                  const isCurrent = index === activeIndex;
                  return <span key={item} className={`h-1 flex-1 rounded-full ${isComplete || isCurrent ? "bg-secondary-400" : "bg-white/10"}`} />;
                })}
              </div>
            )}
          </div>
          {error && (
            <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-3 mb-6">
              <p className="text-sm text-red-400">{error}</p>
            </div>
          )}

          {/* Step 1: Email */}
          {step === "email" && (
            <form onSubmit={handleSendOtp} className="space-y-4">
              <div>
                <label className="block text-sm text-gray-400 mb-1">Email Address</label>
                <div className="relative">
                  <Mail size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => { setEmail(e.target.value); setError(""); }}
                    className="w-full pl-10 pr-4 py-3 rounded-lg bg-white/5 border border-white/10 text-white placeholder-gray-500 focus:outline-none focus:border-secondary-500/50 transition-colors"
                    placeholder="admin@email.com"
                  />
                </div>
              </div>
              <button
                type="submit"
                disabled={loading || resendSeconds > 0}
                className="w-full flex items-center justify-center gap-2 py-3 bg-secondary-500 hover:bg-secondary-600 disabled:opacity-50 text-primary-950 font-semibold rounded-lg transition-all"
              >
                {loading ? <Loader2 size={18} className="animate-spin" /> : resendSeconds > 0 ? `Send available in ${resendSeconds}s` : "Send OTP"}
              </button>
            </form>
          )}

          {/* Step 2: OTP */}
          {step === "otp" && (
            <form onSubmit={handleVerifyOtp} className="space-y-4">
              <p className="text-sm text-gray-400 mb-2">
                We sent a 6-digit code to <span className="text-white font-medium">{email}</span>
              </p>
              <div>
                <label className="block text-sm text-gray-400 mb-1">OTP Code</label>
                <div className="relative">
                  <KeyRound size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
                  <input
                    type="text"
                    value={otp}
                    onChange={(e) => { setOtp(e.target.value.replace(/\D/g, "").slice(0, 6)); setError(""); }}
                    className="w-full pl-10 pr-4 py-3 rounded-lg bg-white/5 border border-white/10 text-white placeholder-gray-500 focus:outline-none focus:border-secondary-500/50 transition-colors text-center tracking-[0.5em] text-lg font-mono"
                    placeholder="000000"
                    maxLength={6}
                  />
                </div>
              </div>
              <button
                type="submit"
                disabled={loading || otp.length !== 6}
                className="w-full flex items-center justify-center gap-2 py-3 bg-secondary-500 hover:bg-secondary-600 disabled:opacity-50 text-primary-950 font-semibold rounded-lg transition-all"
              >
                {loading ? <Loader2 size={18} className="animate-spin" /> : "Verify OTP"}
              </button>
              {resendMessage && <p className="rounded-lg border border-emerald-400/25 bg-emerald-400/10 p-3 text-center text-xs text-emerald-200">{resendMessage}</p>}
              <button
                type="button"
                disabled={loading || resendSeconds > 0}
                onClick={() => void handleResendOtp()}
                className="w-full text-center text-sm font-medium text-secondary-400 transition-colors hover:text-secondary-300 disabled:cursor-not-allowed disabled:text-gray-500"
              >
                {resendSeconds > 0 ? `Resend code in ${resendSeconds}s` : "Resend code"}
              </button>
              <button
                type="button"
                onClick={() => { setStep("email"); setOtp(""); setError(""); }}
                className="w-full flex items-center justify-center gap-2 py-2 text-sm text-gray-400 hover:text-white transition-colors"
              >
                <ArrowLeft size={14} /> Back to email
              </button>
            </form>
          )}

          {/* Step 3: New Password */}
          {step === "reset" && (
            <form onSubmit={handleResetPassword} className="space-y-4">
              <div>
                <label className="block text-sm text-gray-400 mb-1">New Password</label>
                <div className="relative">
                  <Lock size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
                  <input
                    type={showNew ? "text" : "password"}
                    value={newPassword}
                    onChange={(e) => { setNewPassword(e.target.value); setError(""); }}
                    className="w-full pl-10 pr-12 py-3 rounded-lg bg-white/5 border border-white/10 text-white placeholder-gray-500 focus:outline-none focus:border-secondary-500/50 transition-colors"
                    placeholder="Strong password"
                  />
                  <button type="button" onClick={() => setShowNew(!showNew)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white">
                    {showNew ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-sm text-gray-400 mb-1">Confirm Password</label>
                <div className="relative">
                  <Lock size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
                  <input
                    type={showConfirm ? "text" : "password"}
                    value={confirmPassword}
                    onChange={(e) => { setConfirmPassword(e.target.value); setError(""); }}
                    className={`w-full pl-10 pr-12 py-3 rounded-lg bg-white/5 border text-white placeholder-gray-500 focus:outline-none transition-colors ${
                      confirmPassword && newPassword !== confirmPassword
                        ? "border-red-500/50 focus:border-red-500"
                        : "border-white/10 focus:border-secondary-500/50"
                    }`}
                    placeholder="Re-enter password"
                  />
                  <button type="button" onClick={() => setShowConfirm(!showConfirm)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white">
                    {showConfirm ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
              </div>

              {newPassword && (
                <div className="bg-white/5 border border-white/10 rounded-xl p-4">
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-[10px] text-gray-500 uppercase tracking-wider">Security Strength</span>
                    <span className={`text-[10px] uppercase tracking-wider ${passwordStrength.text}`}>{passwordStrength.label}</span>
                  </div>
                  <div className="h-1 bg-white/5 rounded-full overflow-hidden mb-4">
                    <div className={`h-full transition-all duration-500 ${passwordStrength.color}`} style={{ width: passwordStrength.width }} />
                  </div>
                  <div className="grid grid-cols-2 gap-x-4 gap-y-2">
                    {[
                      { key: "length", label: "8+ Characters" },
                      { key: "upper", label: "Uppercase Letter" },
                      { key: "lower", label: "Lowercase Letter" },
                      { key: "number", label: "One Number" },
                      { key: "special", label: "Special Character (@$!%*?&#)" },
                    ].map((req) => (
                      <div key={req.key} className="flex items-center gap-2">
                        <div className={`w-3.5 h-3.5 rounded-full flex items-center justify-center border transition-colors ${
                          passwordRequirements[req.key as keyof typeof passwordRequirements]
                            ? "bg-secondary-500/20 border-secondary-500/50"
                            : "border-white/10"
                        }`}>
                          {passwordRequirements[req.key as keyof typeof passwordRequirements] && <Check size={8} className="text-secondary-400" />}
                        </div>
                        <span className={`text-[10px] font-medium transition-colors ${
                          passwordRequirements[req.key as keyof typeof passwordRequirements] ? "text-white" : "text-gray-500"
                        }`}>{req.label}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                className="w-full flex items-center justify-center gap-2 py-3 bg-secondary-500 hover:bg-secondary-600 disabled:opacity-50 text-primary-950 font-semibold rounded-lg transition-all"
              >
                {loading ? <Loader2 size={18} className="animate-spin" /> : "Reset Password"}
              </button>
            </form>
          )}

          {/* Step 4: Success */}
          {step === "done" && (
            <div className="text-center py-4">
              <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-emerald-500/20 flex items-center justify-center">
                <Check size={32} className="text-emerald-400" />
              </div>
              <h3 className="text-lg font-semibold text-white mb-2">Password Reset Successful</h3>
              <p className="text-sm text-gray-400 mb-6">
                Your password has been updated. You can now sign in with your new password.
              </p>
              <button
                onClick={() => router.push("/login")}
                className="w-full py-3 bg-secondary-500 hover:bg-secondary-600 text-primary-950 font-semibold rounded-lg transition-all"
              >
                Go to Login
              </button>
            </div>
          )}

          {step !== "done" && (
            <p className="text-center text-sm text-gray-400 mt-6">
              Remember your password?{" "}
              <Link href="/login" className="text-secondary-400 hover:text-secondary-300 font-medium">
                Sign In
              </Link>
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
