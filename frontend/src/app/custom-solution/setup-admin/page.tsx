"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import Image from "next/image";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowRight, Check, Eye, EyeOff, Loader2 } from "lucide-react";
import { authApi, countriesApi, type Country } from "@/lib/api";
import auditoLogo from "@/assets/logo/audito_logo.png";

function SetupAdminContent() {
  const router = useRouter();
  const paymentCode = useSearchParams().get("code") || "";
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [email, setEmail] = useState("");
  const [organizationCountry, setOrganizationCountry] = useState("");
  const [countries, setCountries] = useState<Country[]>([]);
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const dialCode = countries.find((country) => country.country === organizationCountry)?.international_dialing || "";

  useEffect(() => {
    countriesApi.getAll().then(setCountries);
  }, []);

  useEffect(() => {
    if (!paymentCode) return;
    let active = true;
    authApi.getCustomSolutionAdminSetup(paymentCode).then((result) => {
      if (!active) return;
      if (result.success && result.data?.email) {
        setEmail(result.data.email);
        setOrganizationCountry(result.data.country || "");
      }
      else setError(result.message || "Unable to retrieve the verified organization email.");
    });
    return () => { active = false; };
  }, [paymentCode]);

  const requirements = useMemo(() => ({
    length: password.length >= 8,
    upper: /[A-Z]/.test(password),
    lower: /[a-z]/.test(password),
    number: /[0-9]/.test(password),
    special: /[@$!%*?&#]/.test(password),
  }), [password]);

  const passwordStrength = useMemo(() => {
    const met = Object.values(requirements).filter(Boolean).length;
    if (met === 0) return { label: "", color: "bg-gray-800", width: "0%", text: "text-gray-500" };
    if (met <= 2) return { label: "Weak", color: "bg-red-500", width: "33%", text: "text-red-500" };
    if (met <= 4) return { label: "Medium", color: "bg-yellow-500", width: "66%", text: "text-yellow-500" };
    return { label: "Strong", color: "bg-emerald-500", width: "100%", text: "text-emerald-500" };
  }, [requirements]);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!paymentCode) { setError("The payment reference is missing."); return; }
    if (!firstName.trim() || !lastName.trim()) { setError("First name and last name are required."); return; }
    if (!Object.values(requirements).every(Boolean)) { setError("Use a password that meets all security requirements."); return; }
    if (password !== confirmPassword) { setError("Passwords do not match."); return; }

    setLoading(true);
    setError("");
    try {
      const result = await authApi.setupCustomSolutionAdmin({
        payment_code: paymentCode,
        first_name: firstName.trim(),
        last_name: lastName.trim(),
        phone_number: phoneNumber.trim(),
        password,
      });
      if (result.success) router.replace(`/payment?code=${encodeURIComponent(paymentCode)}`);
      else setError(result.message || "Unable to create the administrator account.");
    } catch {
      setError("Unable to create the administrator account. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen px-4 py-12 sm:py-16">
      <div className="mx-auto w-full max-w-lg rounded-3xl border border-white/10 bg-[#053B36] p-6 shadow-2xl sm:p-8">
        <div className="mb-7 text-center"><Image src={auditoLogo} alt="Audito" width={110} height={30} className="mx-auto mb-5 h-8 w-auto object-contain" priority /><p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-secondary-400">Before payment</p><h1 className="mt-2 text-2xl font-bold text-white">Set up your administrator</h1><p className="mt-2 text-sm leading-relaxed text-gray-400">Your organization email is verified. Create the account that will manage this workspace, then proceed to secure payment.</p></div>
        <form onSubmit={submit} className="space-y-4">
          {error && <div className="rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-300">{error}</div>}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2"><Field label="First name" value={firstName} onChange={setFirstName} placeholder="e.g. Jane" /><Field label="Last name" value={lastName} onChange={setLastName} placeholder="e.g. Perera" /></div>
          <Field label="Organization email" value={email} onChange={() => undefined} type="email" placeholder="Loading verified email…" disabled />
          <div><label className="mb-1.5 block text-sm font-medium text-gray-300">Phone number <span className="text-red-400">*</span></label><div className="flex">{dialCode && <span className="inline-flex min-h-11 items-center rounded-l-xl border border-r-0 border-white/10 bg-white/[0.04] px-3 text-sm text-gray-400">{dialCode}</span>}<input type="tel" value={phoneNumber} onChange={(event) => setPhoneNumber(event.target.value)} placeholder="Phone number" className={`min-h-11 w-full border border-white/10 bg-black/10 px-4 py-3 text-sm text-white placeholder-gray-500 outline-none transition-all focus:border-secondary-400/60 focus:ring-4 focus:ring-secondary-500/10 ${dialCode ? "rounded-r-xl" : "rounded-xl"}`} required /></div>{organizationCountry && <p className="mt-1.5 text-[11px] text-gray-500">Country code based on your organization: {organizationCountry}</p>}</div>
          <PasswordField label="Password" value={password} setValue={setPassword} visible={showPassword} setVisible={setShowPassword} placeholder="Create a strong password" />
          <PasswordField label="Confirm password" value={confirmPassword} setValue={setConfirmPassword} visible={showConfirmPassword} setVisible={setShowConfirmPassword} placeholder="Re-enter your password" invalid={Boolean(confirmPassword && password !== confirmPassword)} />
          {password && <div className="animate-in fade-in slide-in-from-top-2 rounded-2xl border border-white/[0.08] bg-black/10 p-4 duration-300"><div className="mb-3 flex items-center justify-between"><span className="text-[10px] uppercase tracking-wider text-gray-500">Security Strength</span><span className={`text-[10px] uppercase tracking-wider ${passwordStrength.text}`}>{passwordStrength.label}</span></div><div className="mb-4 h-1 overflow-hidden rounded-full bg-white/5"><div className={`h-full transition-all duration-500 ${passwordStrength.color}`} style={{ width: passwordStrength.width }} /></div><div className="grid grid-cols-2 gap-x-4 gap-y-2">{[['length', '8+ Characters'], ['upper', 'Uppercase Letter'], ['lower', 'Lowercase Letter'], ['number', 'One Number'], ['special', 'Special Character (@$!%*?&#)']].map(([key, label]) => <div key={key} className="flex items-center gap-2"><div className={`flex h-3.5 w-3.5 items-center justify-center rounded-full border transition-colors ${requirements[key as keyof typeof requirements] ? 'border-secondary-500/50 bg-secondary-500/20' : 'border-white/10'}`}>{requirements[key as keyof typeof requirements] && <Check size={8} className="text-secondary-400" />}</div><span className={`text-[10px] font-medium transition-colors ${requirements[key as keyof typeof requirements] ? 'text-white' : 'text-gray-500'}`}>{label}</span></div>)}</div></div>}
          <button type="submit" disabled={loading || !paymentCode || !email} className="flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-b from-secondary-400 to-secondary-500 py-3 font-semibold text-primary-950 shadow-lg transition-all hover:from-secondary-300 hover:to-secondary-400 disabled:cursor-not-allowed disabled:opacity-50">{loading ? <Loader2 size={17} className="animate-spin" /> : <>Create administrator account <ArrowRight size={17} /></>}</button>
        </form>
      </div>
    </div>
  );
}

function Field({ label, value, onChange, type = "text", placeholder, disabled = false }: { label: string; value: string; onChange: (value: string) => void; type?: string; placeholder?: string; disabled?: boolean }) {
  return <div><label className="mb-1.5 block text-sm font-medium text-gray-300">{label}</label><input type={type} value={value} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} disabled={disabled} className="min-h-11 w-full rounded-xl border border-white/10 bg-black/10 px-4 py-3 text-sm text-white placeholder-gray-500 outline-none transition-all focus:border-secondary-400/60 focus:ring-4 focus:ring-secondary-500/10 disabled:cursor-not-allowed disabled:opacity-70" required={!disabled} /></div>;
}

function PasswordField({ label, value, setValue, visible, setVisible, placeholder, invalid = false }: { label: string; value: string; setValue: (value: string) => void; visible: boolean; setVisible: (visible: boolean) => void; placeholder: string; invalid?: boolean }) {
  return <div><label className="mb-1.5 block text-sm font-medium text-gray-300">{label}</label><div className="relative"><input type={visible ? "text" : "password"} value={value} onChange={(event) => setValue(event.target.value)} placeholder={placeholder} aria-invalid={invalid} className={`min-h-11 w-full rounded-xl border bg-black/10 px-4 py-3 pr-11 text-sm text-white placeholder-gray-500 outline-none transition-all focus:ring-4 ${invalid ? "border-red-500/50 focus:border-red-500 focus:ring-red-500/10" : "border-white/10 focus:border-secondary-400/60 focus:ring-secondary-500/10"}`} required /><button type="button" onClick={() => setVisible(!visible)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white">{visible ? <EyeOff size={18} /> : <Eye size={18} />}</button></div></div>;
}

export default function SetupCustomSolutionAdminPage() {
  return <Suspense fallback={<div className="min-h-screen flex items-center justify-center"><Loader2 className="animate-spin text-secondary-400" size={30} /></div>}><SetupAdminContent /></Suspense>;
}
