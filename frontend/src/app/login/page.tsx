"use client";

import { useState, useEffect, Suspense } from "react";
import Image from "next/image";
import auditoLogo from "../../assets/logo/audito_logo.png";
import { useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";
import { Eye, EyeOff, Loader2, CheckCircle, ArrowLeft } from "lucide-react";
import { useAuth, type SubscriptionStatus } from "@/context/AuthContext";
import { type PaymentDetails } from "@/lib/api";
import SubscriptionExpiredModal from "@/components/auth/SubscriptionExpiredModal";

function LoginForm() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { login, admin, isLoading } = useAuth();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [showSuccess, setShowSuccess] = useState(false);
  const [expiredModal, setExpiredModal] = useState<{ open: boolean; subscription?: SubscriptionStatus | null; payment?: PaymentDetails | null }>({ open: false });

  useEffect(() => {
    if (searchParams.get("registered") === "true") {
      setShowSuccess(true);
    }
  }, [searchParams]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setShowSuccess(false);

    if (!email.trim() || !password) {
      setError("Email and password are required.");
      return;
    }

    setLoading(true);
    try {
      const res = await login({ email, password });

      if (res.success) {
        router.push("/dashboard");
      } else if (res.paymentRequired && res.payment?.payment_code) {
        router.push(`/payment?code=${res.payment.payment_code}`);
      } else if (res.subscriptionExpired) {
        setExpiredModal({ open: true, subscription: res.subscription, payment: res.payment });
      } else {
        setError(res.message || "Login failed.");
      }
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-12">
      {expiredModal.open && (
        <SubscriptionExpiredModal
          subscription={expiredModal.subscription}
          payment={expiredModal.payment}
          onClose={() => setExpiredModal({ open: false })}
        />
      )}


      <div className="relative w-full max-w-md">
        {/* Form Card */}
        <form onSubmit={handleSubmit} className="bg-[#053B36] backdrop-blur-xl rounded-2xl p-6 sm:p-8 border border-white/10 shadow-2xl">
          {/* Back to Home */}
          <div className="flex items-center gap-2 mb-6">
            <button
              type="button"
              onClick={() => router.push("/")}
              className="text-[#059669] hover:text-[#047A55] transition-colors p-1 rounded-lg hover:bg-white/5"
            >
              <ArrowLeft size={18} />
            </button>
            <button
              type="button"
              onClick={() => router.push("/")}
              className="text-sm text-[#059669] hover:text-[#047A55] transition-colors"
            >
              Back to Home
            </button>
          </div>

          {/* Logo and Welcome Text */}
          <div className="text-center mb-8">
            <Link href="/" className="inline-block mb-4">
              <Image src={auditoLogo} alt="Audito" width={125} height={30} className="h-10 mx-auto" />
            </Link>
            <h1 className="text-2xl font-bold text-white mb-2">
              Welcome Back
            </h1>
            <p className="text-gray-400 text-sm">
              Sign in to your account to continue
            </p>
          </div>

          {/* Success Message */}
          {showSuccess && (
            <div className="bg-accent-500/10 border border-accent-500/30 rounded-lg p-3 mb-6 flex items-center gap-2">
              <CheckCircle size={16} className="text-accent-400" />
              <p className="text-sm text-accent-400">
                Registration successful! Please log in.
              </p>
            </div>
          )}

          {/* Error Message */}
          {error && (
            <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-3 mb-6">
              <p className="text-sm text-red-400">{error}</p>
            </div>
          )}

          {/* Form Fields */}
          <div className="space-y-4">
            {/* Email Field */}
            <div>
              <label className="block text-sm text-gray-300 mb-2">
                Email Address
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value);
                  setError("");
                }}
                className="w-full px-4 py-3 rounded-lg bg-white/5 border border-white/10 text-white placeholder-gray-500 focus:outline-none focus:border-secondary-500/40 focus:ring-1 focus:ring-secondary-500/30 transition-all"
                placeholder="Enter your email"
              />
            </div>

            {/* Password Field */}
            <div>
              <label className="block text-sm text-gray-300 mb-2">
                Password
              </label>
              <div className="relative">
                <input
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value);
                    setError("");
                  }}
                  className="w-full px-4 py-3 rounded-lg bg-white/5 border border-white/10 text-white placeholder-gray-500 focus:outline-none focus:border-secondary-500/40 focus:ring-1 focus:ring-secondary-500/30 transition-all pr-12"
                  placeholder="Enter your password"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white transition-colors"
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>

            {/* Forgot Password Link */}
            <div className="text-right">
              <Link
                href="/forgot-password"
                className="text-sm text-[#059669] hover:text-[#047A55] transition-colors"
              >
                Forgot Password?
              </Link>
            </div>

            {/* Sign In Button */}
            <button
              type="submit"
              disabled={loading}
              className="w-full flex items-center justify-center gap-2 py-3 bg-[#059669] hover:bg-[#047A55] disabled:opacity-50 text-white font-semibold rounded-lg transition-all shadow-lg shadow-[#059669]/25 disabled:shadow-none"
            >
              {loading ? (
                <Loader2 size={18} className="animate-spin" />
              ) : (
                "Sign In"
              )}
            </button>
          </div>

          {/* Sign Up Link */}
          <p className="text-center text-sm text-gray-400 mt-6">
            Don't have an account?{" "}
            <Link
              href="/register"
              className="text-[#059669] hover:text-[#047A55] font-medium transition-colors"
            >
              Create Account
            </Link>
          </p>

        

         

          {/* Security Footer */}
          <div className="mt-8 text-center">
            <p className="text-xs text-gray-500">
              Protected by Industry-leading security standards
            </p>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center bg-transparent">
          <Loader2 size={32} className="animate-spin text-secondary-400" />
        </div>
      }
    >
      <LoginForm />
    </Suspense>
  );
}