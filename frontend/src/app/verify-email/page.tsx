"use client";

import { useEffect, useState, useMemo, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { authApi, usersApi } from "@/lib/api";
import { CheckCircle2, XCircle, Loader2, ArrowRight, Eye, EyeOff, Lock, Check } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui";

function VerifyEmailContent() {
  const searchParams = useSearchParams();
  const token = searchParams.get("token");

  const [status, setStatus] = useState<"loading" | "success" | "error" | "set-password">("loading");
  const [message, setMessage] = useState("");
  const [userData, setUserData] = useState<{ email: string; first_name: string } | null>(null);
  const [paymentCode, setPaymentCode] = useState<string | null>(null);

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [setupLoading, setSetupLoading] = useState(false);
  const [setupError, setSetupError] = useState("");

  const passwordRequirements = useMemo(() => ({
    length: password.length >= 8,
    upper: /[A-Z]/.test(password),
    lower: /[a-z]/.test(password),
    number: /[0-9]/.test(password),
    special: /[@$!%*?&#]/.test(password),
  }), [password]);

  const passwordStrength = useMemo(() => {
    const met = Object.values(passwordRequirements).filter(Boolean).length;
    if (met === 0) return { label: "", color: "bg-gray-800", width: "0%", text: "text-gray-500" };
    if (met <= 2) return { label: "Weak", color: "bg-red-500", width: "33%", text: "text-red-500" };
    if (met <= 4) return { label: "Medium", color: "bg-yellow-500", width: "66%", text: "text-yellow-500" };
    return { label: "Strong", color: "bg-emerald-500", width: "100%", text: "text-emerald-500" };
  }, [passwordRequirements]);

  useEffect(() => {
    if (!token) {
      setStatus("error");
      setMessage("Verification token is missing. Please check your email link.");
      return;
    }
    authApi.verifyEmail(token)
      .then((res: any) => {
        if (res.success) {
          const data = res.data;
          if (data?.needs_password) {
            setUserData({ email: data.email, first_name: data.first_name });
            setStatus("set-password");
          } else {
            setStatus("success");
            if (data?.payment?.payment_code) {
              setPaymentCode(data.payment.payment_code);
              setMessage("Your email is verified. Continue to complete your subscription payment.");
            } else {
              setMessage("Your email has been successfully verified! You can now log in to your account.");
            }
          }
        } else {
          setStatus("error");
          setMessage(res.message || "Failed to verify email. The token might be invalid or expired.");
        }
      })
      .catch(() => {
        setStatus("error");
        setMessage("An unexpected error occurred during verification.");
      });
  }, [token]);

  const handleSetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userData?.email) return;
    setSetupError("");
    const { length, upper, lower, number, special } = passwordRequirements;
    if (!length || !upper || !lower || !number || !special) {
      setSetupError("Please ensure your password meets all requirements.");
      return;
    }
    if (password !== confirmPassword) { setSetupError("Passwords do not match."); return; }

    setSetupLoading(true);
    const res = await usersApi.setPassword(userData.email, password);
    setSetupLoading(false);
    if (res.success) {
      setStatus("success");
      setMessage("Password set successfully! You can now log in to your account.");
    } else {
      setSetupError(res.message || "Failed to set password.");
    }
  };

  return (
    <div className="flex items-center justify-center min-h-screen bg-transparent p-6">
      <div className="w-full max-w-md bg-white/5 border border-white/10 rounded-2xl p-8 backdrop-blur-sm transition-all">

        {status === "loading" && (
          <div className="flex flex-col items-center text-center">
            <Loader2 className="animate-spin text-secondary-500 mb-4" size={48} />
            <h1 className="text-xl font-bold text-white mb-2">Verifying Email</h1>
            <p className="text-gray-400">Please wait while we verify your email address...</p>
          </div>
        )}

        {status === "success" && (
          <div className="flex flex-col items-center text-center">
            <CheckCircle2 className="text-green-500 mb-4" size={48} />
            <h1 className="text-xl font-bold text-white mb-2">Email Verified</h1>
            <p className="text-gray-400 mb-8">{message}</p>
            {paymentCode ? (
              <Link
                href={`/payment?code=${paymentCode}`}
                className="w-full flex items-center justify-center gap-2 bg-secondary-500 hover:bg-secondary-600 text-primary-950 font-semibold px-6 py-3 rounded-xl transition-colors"
              >
                Continue to Payment <ArrowRight size={18} />
              </Link>
            ) : (
              <Link
                href="/login"
                className="w-full flex items-center justify-center gap-2 bg-secondary-500 hover:bg-secondary-600 text-primary-950 font-semibold px-6 py-3 rounded-xl transition-colors"
              >
                Proceed to Login <ArrowRight size={18} />
              </Link>
            )}
          </div>
        )}

        {status === "set-password" && (
          <div className="flex flex-col">
            <div className="flex flex-col items-center text-center mb-6">
              <div className="w-16 h-16 bg-secondary-500/10 rounded-full flex items-center justify-center mb-4 border border-secondary-500/20">
                <Lock className="text-secondary-400" size={32} />
              </div>
              <h1 className="text-xl font-bold text-white mb-2">Welcome, {userData?.first_name}!</h1>
              <p className="text-gray-400 text-sm">Please set a password for your account to continue.</p>
            </div>

            <form onSubmit={handleSetPassword} className="space-y-4">
              {setupError && (
                <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-3 text-red-400 text-sm">
                  {setupError}
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-gray-400 mb-1.5">New Password</label>
                <div className="relative">
                  <input
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(e) => { setPassword(e.target.value); setSetupError(""); }}
                    placeholder="Strong password"
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:border-secondary-500/50 transition-all pr-11"
                    required
                  />
                  <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white">
                    {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-400 mb-1.5">Confirm Password</label>
                <div className="relative">
                  <input
                    type={showConfirm ? "text" : "password"}
                    value={confirmPassword}
                    onChange={(e) => { setConfirmPassword(e.target.value); setSetupError(""); }}
                    placeholder="Repeat your password"
                    className={`w-full bg-white/5 border rounded-xl px-4 py-3 text-white text-sm focus:outline-none transition-all pr-11 ${
                      confirmPassword && password !== confirmPassword
                        ? "border-red-500/50 focus:border-red-500"
                        : "border-white/10 focus:border-secondary-500/50"
                    }`}
                    required
                  />
                  <button type="button" onClick={() => setShowConfirm(!showConfirm)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white">
                    {showConfirm ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
              </div>

              {password && (
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

              <Button
                type="submit"
                fullWidth
                loading={setupLoading}
                disabled={setupLoading}
                className="mt-2 rounded-xl py-3 font-semibold"
              >
                Set Password & Login
              </Button>
            </form>
          </div>
        )}

        {status === "error" && (
          <div className="flex flex-col items-center text-center">
            <XCircle className="text-red-500 mb-4" size={48} />
            <h1 className="text-xl font-bold text-white mb-2">Verification Failed</h1>
            <p className="text-gray-400 mb-8">{message}</p>
            <Link
              href="/login"
              className="w-full flex items-center justify-center gap-2 bg-white/10 hover:bg-white/20 text-white font-medium px-6 py-3 rounded-xl transition-colors border border-white/10"
            >
              Back to Login
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}

export default function VerifyEmailPage() {
  return (
    <Suspense fallback={
      <div className="flex items-center justify-center min-h-screen bg-transparent">
        <Loader2 className="animate-spin text-secondary-500" size={48} />
      </div>
    }>
      <VerifyEmailContent />
    </Suspense>
  );
}
