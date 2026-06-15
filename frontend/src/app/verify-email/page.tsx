"use client";

import { useEffect, useState, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { authApi, usersApi } from "@/lib/api";
import { CheckCircle2, XCircle, Loader2, ArrowRight, Eye, EyeOff, Lock, Mail } from "lucide-react";
import Link from "next/link";

function VerifyEmailContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const token = searchParams.get("token");

  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error" | "set-password">("idle");
  const [message, setMessage] = useState("");
  const [userData, setUserData] = useState<{ email: string; first_name: string } | null>(null);

  // Password Setup State
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [setupLoading, setSetupLoading] = useState(false);
  const [setupError, setSetupError] = useState("");

  const handleVerify = () => {
    if (!token) {
      setStatus("error");
      setMessage("Verification token is missing. Please check your email link.");
      return;
    }

    setStatus("loading");
    setMessage("Verifying your email address...");

    authApi.verifyEmail(token)
      .then((res: any) => {
        if (res.success) {
          const data = res.data;
          if (data?.needs_password) {
            setUserData({ email: data.email, first_name: data.first_name });
            setStatus("set-password");
          } else {
            setStatus("success");
            setMessage("Your email has been successfully verified! You can now log in to your account.");
          }
        } else {
          setStatus("error");
          setMessage(res.message || "Failed to verify email. The token might be invalid or expired.");
        }
      })
      .catch((err: any) => {
        setStatus("error");
        setMessage("An unexpected error occurred during verification.");
      });
  };

  useEffect(() => {
    if (!token) {
      setStatus("error");
      setMessage("Verification token is missing. Please check your email link.");
    }
  }, [token]);

  const handleSetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userData?.email) return;
    if (password.length < 8) return setSetupError("Password must be at least 8 characters.");
    if (password !== confirmPassword) return setSetupError("Passwords do not match.");

    setSetupLoading(true);
    setSetupError("");

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
        {status === "idle" && (
          <div className="flex flex-col items-center text-center">
            <div className="w-16 h-16 bg-secondary-500/10 rounded-full flex items-center justify-center mb-4 border border-secondary-500/20">
              <Mail className="text-secondary-400" size={32} />
            </div>
            <h1 className="text-xl font-bold text-white mb-2">Verify Your Account</h1>
            <p className="text-gray-400 mb-8">Click the button below to complete your email verification.</p>
            <button
              onClick={handleVerify}
              className="w-full flex items-center justify-center gap-2 bg-secondary-500 hover:bg-secondary-600 text-primary-950 font-semibold px-6 py-3 rounded-xl transition-all"
            >
              Verify My Account <ArrowRight size={18} />
            </button>
          </div>
        )}

        {status === "loading" && (
          <div className="flex flex-col items-center text-center">
            <Loader2 className="animate-spin text-secondary-500 mb-4" size={48} />
            <h1 className="text-xl font-bold text-white mb-2">Verifying Email</h1>
            <p className="text-gray-400">{message}</p>
          </div>
        )}

        {status === "success" && (
          <div className="flex flex-col items-center text-center">
            <CheckCircle2 className="text-green-500 mb-4" size={48} />
            <h1 className="text-xl font-bold text-white mb-2">Email Verified</h1>
            <p className="text-gray-400 mb-8">{message}</p>
            <Link 
              href="/login" 
              className="w-full flex items-center justify-center gap-2 bg-secondary-500 hover:bg-secondary-600 text-primary-950 font-semibold px-6 py-3 rounded-xl transition-colors"
            >
              Proceed to Login <ArrowRight size={18} />
            </Link>
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
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Min. 8 characters"
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:border-secondary-500/50 transition-all pr-11"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white"
                  >
                    {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-400 mb-1.5">Confirm Password</label>
                <input
                  type={showPassword ? "text" : "password"}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Repeat your password"
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:border-secondary-500/50 transition-all"
                  required
                />
              </div>

              <button
                type="submit"
                disabled={setupLoading}
                className="w-full flex items-center justify-center gap-2 bg-secondary-500 hover:bg-secondary-600 disabled:opacity-50 text-primary-950 font-semibold px-6 py-3 rounded-xl transition-all mt-2"
              >
                {setupLoading ? <Loader2 size={18} className="animate-spin" /> : "Set Password & Login"}
              </button>
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
