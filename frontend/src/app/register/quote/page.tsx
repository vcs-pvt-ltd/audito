"use client";

import { Suspense, useEffect, useMemo, useState, type FormEvent, type ReactNode } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { AlertTriangle, ArrowRight, Check, Eye, EyeOff, Loader2 } from "lucide-react";
import logo from "@/assets/logo/audito_logo.png";
import { authApi, countriesApi, landingApi, type Country, type PrivacyPolicy, type QuoteRegistrationView } from "@/lib/api";
import { COUNTRY_TIMEZONE_MAP } from "@/lib/countryTimezones";
import { DEFAULT_AUDITO_CONTACT, type AuditoContact } from "@/lib/auditoContact";
import AuditoContactCard from "@/components/shared/AuditoContactCard";
import CountryField from "@/components/shared/CountryField";

const fieldClass = "w-full min-h-11 rounded-xl border border-white/10 bg-black/10 px-4 py-3 text-sm text-white placeholder-gray-500 transition-all focus:border-secondary-400/60 focus:bg-white/[0.05] focus:outline-none focus:ring-4 focus:ring-secondary-500/10 disabled:cursor-not-allowed disabled:text-white/50";
const primaryClass = "flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-b from-secondary-400 to-secondary-500 py-3.5 font-semibold text-primary-950 shadow-lg shadow-secondary-950/25 transition-all hover:from-secondary-300 hover:to-secondary-400 active:translate-y-px disabled:cursor-not-allowed disabled:opacity-50";
const validPhone = (phone: string) => /^[+()\d\s.-]{7,60}$/.test(phone);
const PASSWORD_RULES = [
  { label: "8+ characters", test: (value: string) => value.length >= 8 },
  { label: "Uppercase letter", test: (value: string) => /[A-Z]/.test(value) },
  { label: "Lowercase letter", test: (value: string) => /[a-z]/.test(value) },
  { label: "Number", test: (value: string) => /\d/.test(value) },
  { label: "Special character (@$!%*?&#)", test: (value: string) => /[@$!%*?&#]/.test(value) },
];
const money = (amount: number, currency = "USD") => { try { return new Intl.NumberFormat(undefined, { style: "currency", currency }).format(amount); } catch { return `$${amount.toFixed(2)}`; } };

function Field({ label, required, hint, children }: { label: string; required?: boolean; hint?: string; children: ReactNode }) {
  return <label className="block">
    <span className="mb-2 block text-sm font-medium text-gray-300">{label} {required && <span className="text-red-400">*</span>}</span>
    {children}
    {hint && <span className="mt-1.5 block text-xs text-gray-500">{hint}</span>}
  </label>;
}

function QuoteRegistrationContent() {
  const router = useRouter();
  const token = useSearchParams().get("token") || "";
  const [quote, setQuote] = useState<QuoteRegistrationView | null>(null);
  const [contact, setContact] = useState<AuditoContact>(DEFAULT_AUDITO_CONTACT);
  const [linkError, setLinkError] = useState("");
  const [loading, setLoading] = useState(true);
  const [privacy, setPrivacy] = useState<PrivacyPolicy | null>(null);
  const [countries, setCountries] = useState<Country[]>([]);
  const [organization, setOrganization] = useState({ name: "", registrationNumber: "", phone: "", country: "Sri Lanka", address1: "", address2: "", address3: "" });
  const [admin, setAdmin] = useState({ firstName: "", lastName: "", phone: "", password: "", confirm: "" });
  const [showPassword, setShowPassword] = useState(false);
  const [agreed, setAgreed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!token) { setLinkError("This registration link is incomplete. Open the button in your quote email again."); setLoading(false); return; }
    authApi.getQuoteRegistration(token).then(result => {
      const data = result.data as { quote?: QuoteRegistrationView; contact?: AuditoContact } | undefined;
      if (data?.contact?.email) setContact(data.contact);
      if (!result.success || !data?.quote) { setLinkError(result.message || "This registration link cannot be used."); return; }
      const value = data.quote;
      const [firstName, ...rest] = value.contact_name.trim().split(/\s+/);
      setQuote(value);
      setOrganization(current => ({ ...current, name: value.organization_name, phone: value.phone, country: value.country || current.country }));
      setAdmin(current => ({ ...current, firstName: firstName || "", lastName: rest.join(" "), phone: value.phone }));
    }).catch(() => setLinkError("We could not open this registration link. Check your connection and try again.")).finally(() => setLoading(false));
    landingApi.getPrivacyPolicy().then(result => { if (result.success && result.data) setPrivacy(result.data); });
    countriesApi.getAll().then(setCountries).catch(() => undefined);
  }, [token]);

  const selectedCountry = useMemo(() => countries.find(country => country.country === organization.country), [countries, organization.country]);
  const passwordOk = PASSWORD_RULES.every(rule => rule.test(admin.password));

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!quote) return;
    if (!organization.name.trim() || !validPhone(organization.phone.trim()) || !organization.country || !organization.address1.trim() || !organization.address2.trim()) return setError("Complete the required organization details, including country and address.");
    if (!admin.firstName.trim() || !admin.lastName.trim() || !validPhone(admin.phone.trim())) return setError("Complete your administrator details.");
    if (!passwordOk) return setError("Password needs 8 characters, uppercase, lowercase, a number, and a special character.");
    if (admin.password !== admin.confirm) return setError("Passwords do not match.");
    if (!privacy || !agreed) return setError("Review and agree to the current Privacy Policy.");
    setBusy(true); setError("");
    const result = await authApi.registerFromQuote({
      token, org_name: organization.name.trim(), registration_number: organization.registrationNumber.trim(),
      org_phone_number: organization.phone.trim(), country: organization.country, address_line_1: organization.address1.trim(), address_line_2: organization.address2.trim(),
      address_line_3: organization.address3.trim(), timezone: selectedCountry ? COUNTRY_TIMEZONE_MAP[selectedCountry.country_code] || "" : "",
      first_name: admin.firstName.trim(), last_name: admin.lastName.trim(), phone_number: admin.phone.trim(), password: admin.password, privacy_policy_id: privacy.privacy_policy_id,
    });
    if (result.success && result.data?.payment?.payment_code) {
      // Same payment page as every other purchase.
      router.push(`/payment?code=${encodeURIComponent(result.data.payment.payment_code)}`);
      return;
    }
    setBusy(false);
    setError(result.message || "Registration failed. Please try again.");
  }

  const shell = (content: ReactNode) => <div className="relative min-h-screen px-4 pb-12 pt-16 text-white sm:py-12">
    <div className="pointer-events-none absolute inset-0 overflow-hidden"><div className="absolute left-1/4 top-1/3 h-80 w-80 rounded-full bg-primary-600/15 blur-3xl" /></div>
    <div className="glass relative mx-auto max-w-3xl overflow-hidden rounded-3xl border-white/10 p-5 shadow-2xl shadow-black/20 sm:p-8">
      <div className="mb-6 text-center"><Link href="/" className="inline-block"><Image src={logo} alt="Audito" width={110} height={30} className="mx-auto h-8" priority /></Link>
        <p className="mb-1 mt-3 text-[10px] font-semibold uppercase tracking-[2px] text-secondary-500">Register from your quote</p></div>
      {content}
    </div>
  </div>;

  if (loading) return shell(<div className="flex justify-center py-16"><Loader2 size={32} className="animate-spin text-secondary-400" aria-label="Loading your quote" /></div>);
  if (linkError || !quote) return shell(<div className="mx-auto max-w-lg text-center">
    <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-amber-500/10 text-amber-300"><AlertTriangle size={26} aria-hidden /></div>
    <h1 className="mt-4 text-xl font-semibold">We can&apos;t open this registration link</h1>
    <p role="alert" className="mt-2 text-sm text-gray-400">{linkError}</p>
    <div className="mt-6"><AuditoContactCard contact={contact} title="Contact the Audito team" description="We can send you a new registration link." /></div>
    <Link href="/login" className="mt-6 inline-flex text-sm font-medium text-secondary-400 hover:text-secondary-300">Already registered? Sign in</Link>
  </div>);

  return shell(<form onSubmit={submit} noValidate>
    <h1 className="text-center text-2xl font-semibold tracking-tight">Register {quote.organization_name}</h1>
    <p className="mx-auto mt-2 max-w-lg text-center text-sm text-gray-400">Create your organization and administrator account. Next you pay on the secure payment page, and your workspace is activated.</p>

    <section aria-label="Your quote" className="mt-6 rounded-2xl border border-secondary-500/25 bg-secondary-500/[0.07] p-4 sm:p-5">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <p className="text-sm font-semibold text-white">Your quote</p>
        <p className="text-2xl font-bold text-secondary-300">{money(quote.price, quote.currency)}</p>
      </div>
      <dl className="mt-3 grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
        {[["Account", quote.entity_type], ["Departments", quote.departments ? quote.departments.toLocaleString() : "—"], ["Audit lines", quote.lines_per_audit ? quote.lines_per_audit.toLocaleString() : "—"], ["Tokens included", quote.tokens.toLocaleString()]].map(([label, value]) =>
          <div key={label} className="min-w-0"><dt className="text-[11px] uppercase tracking-wide text-gray-500">{label}</dt><dd className="mt-0.5 truncate text-gray-200">{value}</dd></div>)}
      </dl>
      {quote.message && <p className="mt-3 whitespace-pre-wrap border-t border-white/10 pt-3 text-sm text-gray-300">{quote.message}</p>}
      <p className="mt-3 text-xs text-gray-500">One-time payment. 1 token = 1 audit line. This link works until {new Date(quote.expires_at).toLocaleDateString()}.</p>
    </section>

    {error && <p role="alert" className="mt-5 rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-400">{error}</p>}

    <fieldset className="mt-6 space-y-4">
      <legend className="mb-3 text-lg font-semibold">Organization details</legend>
      <Field label="Organization name" required><input className={fieldClass} value={organization.name} onChange={event => setOrganization({ ...organization, name: event.target.value })} required /></Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Organization email" hint="The email your quote was sent to. It cannot be changed here."><input type="email" className={fieldClass} value={quote.email} disabled readOnly /></Field>
        <Field label="Registration number"><input className={fieldClass} value={organization.registrationNumber} onChange={event => setOrganization({ ...organization, registrationNumber: event.target.value })} placeholder="Optional" /></Field>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <CountryField countries={countries} value={organization.country} onChange={country => setOrganization({ ...organization, country: country.country })} />
        <div><span className="mb-2 block text-sm font-medium text-gray-300">Organization phone <span className="text-red-400">*</span></span>
          <div className="flex">{selectedCountry?.international_dialing && <span className="inline-flex items-center rounded-l-xl border border-r-0 border-white/10 bg-white/[0.04] px-3 text-sm text-gray-400">{selectedCountry.international_dialing}</span>}
            <input type="tel" aria-label="Organization phone" className={fieldClass + (selectedCountry?.international_dialing ? " rounded-l-none" : "")} value={organization.phone} onChange={event => setOrganization({ ...organization, phone: event.target.value })} required /></div>
        </div>
      </div>
      <Field label="Address line 1" required><input className={fieldClass} value={organization.address1} onChange={event => setOrganization({ ...organization, address1: event.target.value })} placeholder="Street address, P.O. box" required /></Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Address line 2" required><input className={fieldClass} value={organization.address2} onChange={event => setOrganization({ ...organization, address2: event.target.value })} placeholder="Building, floor, area" required /></Field>
        <Field label="Address line 3"><input className={fieldClass} value={organization.address3} onChange={event => setOrganization({ ...organization, address3: event.target.value })} placeholder="City, region (optional)" /></Field>
      </div>
    </fieldset>

    <fieldset className="mt-8 space-y-4 border-t border-white/[0.07] pt-6">
      <legend className="mb-3 text-lg font-semibold">Administrator account</legend>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="First name" required><input className={fieldClass} value={admin.firstName} onChange={event => setAdmin({ ...admin, firstName: event.target.value })} required /></Field>
        <Field label="Last name" required><input className={fieldClass} value={admin.lastName} onChange={event => setAdmin({ ...admin, lastName: event.target.value })} required /></Field>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Sign-in email" hint="The email your quote was sent to. It is already verified."><input type="email" className={fieldClass} value={quote.email} disabled readOnly /></Field>
        <Field label="Phone number" required><input type="tel" className={fieldClass} value={admin.phone} onChange={event => setAdmin({ ...admin, phone: event.target.value })} required /></Field>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Password" required>
          <span className="relative block"><input type={showPassword ? "text" : "password"} className={`${fieldClass} pr-12`} value={admin.password} onChange={event => setAdmin({ ...admin, password: event.target.value })} autoComplete="new-password" required />
            <button type="button" onClick={() => setShowPassword(shown => !shown)} aria-label={showPassword ? "Hide password" : "Show password"} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white">{showPassword ? <EyeOff size={18} /> : <Eye size={18} />}</button></span>
        </Field>
        <Field label="Confirm password" required>
          <input type={showPassword ? "text" : "password"} className={fieldClass} value={admin.confirm} onChange={event => setAdmin({ ...admin, confirm: event.target.value })} autoComplete="new-password" required aria-invalid={Boolean(admin.confirm) && admin.confirm !== admin.password} />
          {admin.confirm && admin.confirm !== admin.password && <span className="mt-1 block text-xs text-red-400">Passwords do not match.</span>}
        </Field>
      </div>
      {admin.password && <ul className="grid grid-cols-2 gap-x-4 gap-y-1.5 rounded-xl border border-white/[0.08] bg-black/10 p-3 text-xs sm:grid-cols-3" aria-label="Password requirements">
        {PASSWORD_RULES.map(rule => { const met = rule.test(admin.password); return <li key={rule.label} className={`flex items-center gap-1.5 ${met ? "text-white" : "text-gray-500"}`}><Check size={12} className={met ? "text-secondary-400" : "text-gray-600"} aria-hidden />{rule.label}<span className="sr-only">{met ? " (met)" : " (not met)"}</span></li>; })}
      </ul>}
    </fieldset>

    <label className="mt-6 flex cursor-pointer items-start gap-3">
      <input type="checkbox" checked={agreed} onChange={event => setAgreed(event.target.checked)} className="mt-0.5 h-5 w-5 shrink-0 accent-secondary-500" />
      <span className="text-sm leading-snug text-gray-400">I agree to the <Link href="/privacy-policies" target="_blank" className="font-medium text-secondary-400 underline underline-offset-2 hover:text-secondary-300">{privacy ? `${privacy.title} (${privacy.version})` : "Privacy Policy"}</Link> and acknowledge that my data will be processed in accordance with it.</span>
    </label>
    <button type="submit" disabled={busy || !privacy || !agreed} className={`${primaryClass} mt-6`}>{busy ? <Loader2 size={18} className="animate-spin" /> : <>Register and continue to payment <ArrowRight size={16} /></>}</button>
    <p className="mt-3 text-center text-xs text-gray-500">You can apply a promo code on the payment page.</p>
    <div className="mt-6"><AuditoContactCard contact={contact} title="Questions about your quote?" /></div>
  </form>);
}

export default function QuoteRegistrationPage() {
  return <Suspense fallback={<div className="flex min-h-screen items-center justify-center"><Loader2 size={32} className="animate-spin text-secondary-400" /></div>}><QuoteRegistrationContent /></Suspense>;
}
