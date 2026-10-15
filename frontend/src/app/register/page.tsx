"use client";

import { Suspense, useEffect, useMemo, useRef, useState, type FormEvent, type ChangeEvent } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowLeft, ArrowRight, Check, Eye, EyeOff, ImagePlus, Loader2 } from "lucide-react";
import logo from "@/assets/logo/audito_logo.png";
import { authApi, countriesApi, landingApi, packagePricingApi, type AllEntityType, type ContactReviewInput, type Country, type PackagePricing, type PrivacyPolicy, type RegisterPayload } from "@/lib/api";
import { canRegisterPackageEntry, FREE_COMPANY_LEVELS, MIN_AUDIT_LINES, hierarchySelectionLabel, type CompanyEntryType } from "@/lib/packageHierarchy";
import AccountTypeStep, { type AccountGroup } from "./AccountTypeStep";
import OrganizationLogoCropModal from "@/components/organization/OrganizationLogoCropModal";
import type { OrganizationLogoCrop } from "@/lib/organizationLogo";
import { COUNTRY_TIMEZONE_MAP } from "@/lib/countryTimezones";
import { DEFAULT_AUDITO_CONTACT, type AuditoContact } from "@/lib/auditoContact";
import AuditoContactCard from "@/components/shared/AuditoContactCard";
import CountryField from "@/components/shared/CountryField";

const fieldClass = "w-full min-h-11 rounded-xl border border-white/10 bg-black/10 px-4 py-3 text-sm text-white placeholder-gray-500 transition-all focus:border-secondary-400/60 focus:bg-white/[0.05] focus:outline-none focus:ring-4 focus:ring-secondary-500/10";
const primaryClass = "flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-b from-secondary-400 to-secondary-500 py-3.5 font-semibold text-primary-950 shadow-lg shadow-secondary-950/25 transition-all hover:from-secondary-300 hover:to-secondary-400 active:translate-y-px disabled:cursor-not-allowed disabled:opacity-50";
const money = (amount: number) => `$${amount.toFixed(2)}`;
const validEmail = (email: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
const validPhone = (phone: string) => /^[+()\d\s.-]{7,60}$/.test(phone);

function Progress({ step, contactMode }: { step: number; contactMode: boolean }) {
  const total = contactMode ? 2 : 3;
  return <div className="mx-auto mb-2 flex max-w-xs items-center justify-center gap-2" aria-label={`Step ${step + 1} of ${total}`}>
    {Array.from({ length: total }, (_, index) => <div key={index} className={`h-1.5 rounded-full transition-all duration-300 ${index === step ? "w-10 bg-secondary-400 shadow-[0_0_12px_rgba(217,163,70,.32)]" : index < step ? "w-7 bg-secondary-500/50" : "w-7 bg-white/10"}`} />)}
  </div>;
}

function RegistrationContent() {
  const router = useRouter();
  const search = useSearchParams();
  const contactMode = search.get("contact") === "1";
  const selection = useMemo(() => ({ company_levels: Number(search.get("company_levels") || FREE_COMPANY_LEVELS), departments: Number(search.get("departments") || 5), lines_per_audit: Number(search.get("lines_per_audit") || MIN_AUDIT_LINES) }), [search]);
  const validSelection = Number.isSafeInteger(selection.company_levels) && selection.company_levels >= FREE_COMPANY_LEVELS && selection.company_levels <= 5 && Number.isSafeInteger(selection.departments) && selection.departments >= 1 && selection.departments <= 10000 && Number.isSafeInteger(selection.lines_per_audit) && selection.lines_per_audit >= MIN_AUDIT_LINES && selection.lines_per_audit <= 1000000;
  const needsPackageSetup = !contactMode && (search.get("package") === "1" || !search.has("company_levels") || !search.has("departments") || !search.has("lines_per_audit") || !validSelection);
  const packageSetupHref = `/register/select-package?company_levels=${selection.company_levels}&departments=${selection.departments}&lines_per_audit=${selection.lines_per_audit}`;
  const automaticEntityType: AllEntityType | "" = !contactMode && validSelection
    ? selection.company_levels === 5 ? "Company" : selection.company_levels === 4 ? "Cluster" : ""
    : "";
  const [pricing, setPricing] = useState<PackagePricing | null>(null);
  const [privacy, setPrivacy] = useState<PrivacyPolicy | null>(null);
  const [accountType, setAccountType] = useState<AccountGroup | "">(automaticEntityType ? "Company" : "");
  const [entityType, setEntityType] = useState<AllEntityType | "">(automaticEntityType);
  const [step, setStep] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);
  const [agreed, setAgreed] = useState(false);
  const [organization, setOrganization] = useState({ name: "", registrationNumber: "", email: "", phone: "", companyType: "", country: "Sri Lanka", address1: "", address2: "", address3: "", timezone: "Asia/Colombo", logo: null as string | null });
  const [administrator, setAdministrator] = useState({ firstName: "", lastName: "", email: "", phone: "", password: "" });
  const [contact, setContact] = useState({ organizationName: "", contactName: "", email: "", phone: "", country: "Sri Lanka", departments: "", lines: "", notes: "" });
  const [teamContact, setTeamContact] = useState<AuditoContact>(DEFAULT_AUDITO_CONTACT);
  const [verificationSent, setVerificationSent] = useState(true);
  const [countries, setCountries] = useState<Country[]>([]);
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoCrop, setLogoCrop] = useState<OrganizationLogoCrop>("wide");
  const logoInput = useRef<HTMLInputElement>(null);
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const company = accountType === "Company";
  const selectedCountry = countries.find((country) => country.country === organization.country);
  const dialCode = selectedCountry?.international_dialing || "";
  const contactDialCode = countries.find((country) => country.country === contact.country)?.international_dialing || "";
  const passwordRequirements = {
    length: administrator.password.length >= 8,
    upper: /[A-Z]/.test(administrator.password), lower: /[a-z]/.test(administrator.password),
    number: /\d/.test(administrator.password), special: /[@$!%*?&#]/.test(administrator.password),
  };

  const quote = useMemo(() => {
    if (!pricing || pricing.pricing_version !== 3 || !validSelection) return null;
    const levelCharge = pricing.company_level_charges[selection.company_levels];
    const departmentCharge = selection.departments <= 5 ? 0 : selection.departments * 10;
    const lineCharge = selection.lines_per_audit * pricing.token_unit_price;
    const extraTokens = (levelCharge + departmentCharge) / pricing.token_unit_price;
    return Number.isSafeInteger(extraTokens) ? { total: levelCharge + departmentCharge + lineCharge, tokens: selection.lines_per_audit + extraTokens } : null;
  }, [pricing, selection, validSelection]);

  useEffect(() => {
    if (!contactMode && !needsPackageSetup) packagePricingApi.get().then((result) => { if (result.success && result.data?.pricing_version === 3) setPricing(result.data); else setError(result.message || "Package pricing is unavailable."); });
    landingApi.getPrivacyPolicy().then((result) => { if (result.success && result.data) setPrivacy(result.data); });
  }, [contactMode, needsPackageSetup]);
  useEffect(() => { if (needsPackageSetup) router.replace(packageSetupHref); }, [needsPackageSetup, packageSetupHref, router]);
  useEffect(() => {
    setAccountType(automaticEntityType ? "Company" : "");
    setEntityType(automaticEntityType);
    setStep(0);
    setError("");
  }, [contactMode, automaticEntityType, needsPackageSetup]);
  useEffect(() => { countriesApi.getAll().then(setCountries); }, []);
  useEffect(() => {
    if (!contactMode) return;
    landingApi.getContactDetails().then((result) => { if (result.success && result.data?.email) setTeamContact(result.data); }).catch(() => undefined);
  }, [contactMode]);

  function chooseAccount(type: AccountGroup) {
    if (contactMode ? type === "Company" : type !== "Company") return;
    setAccountType(type); setEntityType(""); setError("");
  }
  function chooseLogo(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    if (!["image/png", "image/jpeg"].includes(file.type)) return setError("Organization logo must be a PNG or JPEG image.");
    setLogoFile(file);
  }
  function back() { setStep((current) => current - 1); setError(""); }
  function continueFromAccount() {
    if (!accountType || !entityType) return setError("Select an account type and a starting level.");
    if (!contactMode && accountType !== "Company") return setError("This package is for Company workspaces. Contact the Audito team for Customer or Audit Firm accounts.");
    if (contactMode && accountType === "Company") return setError("Choose a Company package in pricing to continue.");
    if (company && (!quote || !canRegisterPackageEntry(entityType as CompanyEntryType, selection.company_levels))) return setError("Select an available starting level for your package.");
    setError(""); setStep(1);
  }
  async function continueFromOrganization(event: FormEvent) {
    event.preventDefault();
    if (!organization.name.trim() || !validEmail(organization.email) || !validPhone(organization.phone) || !organization.country.trim() || !organization.address1.trim() || !organization.address2.trim()) return setError("Complete the required organization details, including country and address.");
    if (entityType === "Company" && !organization.companyType) return setError("Select a company type.");
    setBusy(true);
    const result = await authApi.checkRegistrationEmail(organization.email.trim());
    setBusy(false);
    if (!result.success) return setError(result.message || "Unable to check the organization email.");
    setAdministrator((current) => ({ ...current, email: organization.email.trim(), phone: current.phone || organization.phone }));
    setError(""); setStep(2);
  }
  async function submitCompany(event: FormEvent) {
    event.preventDefault();
    if (contactMode) return setError("Choose a Company package in pricing to continue.");
    if (!entityType || !canRegisterPackageEntry(entityType as CompanyEntryType, selection.company_levels) || !quote || !pricing) return setError("Review your starting level and package.");
    if (!privacy || !agreed) return setError("Review and agree to the current Privacy Policy.");
    if (!administrator.firstName.trim() || !administrator.lastName.trim() || !validEmail(administrator.email) || !validPhone(administrator.phone)) return setError("Complete your administrator details.");
    if (!/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&#])[A-Za-z\d@$!%*?&#]{8,}$/.test(administrator.password)) return setError("Password needs 8 characters, uppercase, lowercase, a number, and a special character.");
    if (administrator.password !== confirmPassword) return setError("Passwords do not match.");
    const payload: RegisterPayload = {
      entity_type: entityType, org_name: organization.name.trim(), registration_number: organization.registrationNumber.trim(),
      org_email: organization.email.trim(), org_phone_number: organization.phone.trim(), company_type: organization.companyType.trim(),
      country: organization.country.trim(), address_line_1: organization.address1.trim(), address_line_2: organization.address2.trim(), address_line_3: organization.address3.trim(), timezone: organization.timezone, organization_logo: organization.logo,
      first_name: administrator.firstName.trim(), last_name: administrator.lastName.trim(), email: administrator.email.trim(),
      phone_number: administrator.phone.trim(), password: administrator.password, plan_name: "Package", billing_cycle: "None",
      privacy_policy_id: privacy.privacy_policy_id, package_selection: { ...selection, expected_token_unit_price: pricing.token_unit_price, pricing_version: pricing.pricing_version },
    };
    setBusy(true); setError("");
    const result = await authApi.register(payload);
    setBusy(false);
    if (result.success) setDone(true); else setError(result.message || "Registration failed.");
  }
  async function submitContact(event: FormEvent) {
    event.preventDefault();
    if (!accountType || accountType === "Company" || !entityType) return setError("Select a Customer or Audit Firm account type.");
    if (!contact.organizationName.trim() || !contact.contactName.trim() || !validEmail(contact.email) || !validPhone(contact.phone)) return setError("Enter your organization, name, valid email, and phone number.");
    if (!contact.country) return setError("Select your country.");
    const departments = Number(contact.departments);
    const lines = Number(contact.lines);
    if (!Number.isSafeInteger(departments) || departments < 1 || departments > 10000) return setError("Enter the number of departments, from 1 to 10,000.");
    if (!Number.isSafeInteger(lines) || lines < 1 || lines > 1000000) return setError("Enter the audit lines per audit, from 1 to 1,000,000.");
    const payload: ContactReviewInput = { account_type: accountType, entity_type: entityType, organization_name: contact.organizationName.trim(), contact_name: contact.contactName.trim(), email: contact.email.trim(), phone: contact.phone.trim(), country: contact.country, departments, lines_per_audit: lines, notes: contact.notes.trim() };
    setBusy(true); setError("");
    const result = await landingApi.submitContactReview(payload);
    setBusy(false);
    if (result.success) {
      if (result.data?.contact?.email) setTeamContact(result.data.contact);
      setVerificationSent(result.data?.email_sent !== false);
      setDone(true);
    } else setError(result.message || "Could not send your request.");
  }
  const input = (label: string, value: string, update: (value: string) => void, type = "text", required = false, placeholder = "") => <div>
    <label className="mb-2 block text-sm font-medium text-gray-300">{label} {required && <span className="text-red-400">*</span>}</label>
    <input type={type} required={required} value={value} placeholder={placeholder} onChange={(event) => update(event.target.value)} className={fieldClass} />
  </div>;

  if (needsPackageSetup) return <div className="flex min-h-screen items-center justify-center"><Loader2 size={32} className="animate-spin text-secondary-400" /><span className="sr-only">Opening package selection</span></div>;

  return <div className="relative min-h-screen px-4 pb-12 pt-16 text-white sm:py-12">
    <div className="pointer-events-none absolute inset-0 overflow-hidden"><div className="absolute left-1/4 top-1/3 h-80 w-80 rounded-full bg-primary-600/15 blur-3xl" /><div className="absolute bottom-1/3 right-1/4 h-60 w-60 rounded-full bg-accent-500/10 blur-3xl" /></div>
    <div className="glass relative mx-auto max-w-4xl overflow-hidden rounded-3xl border-white/10 pt-6 shadow-2xl shadow-black/20 sm:pt-8">
      <div className="mb-5 px-5 text-center sm:px-8"><Link href="/" className="inline-block"><Image src={logo} alt="Audito" width={110} height={30} className="mx-auto h-8" priority /></Link><p className="mb-1 mt-3 text-[10px] font-semibold uppercase tracking-[2px] text-secondary-500">Create your workspace</p></div>
      {done ? company
        ? <div className="p-8 text-center sm:p-12"><div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-secondary-500/15 text-secondary-300"><Check size={30} /></div><h1 className="mt-5 text-2xl font-semibold text-white">Check your email</h1><p className="mx-auto mt-3 max-w-lg text-sm text-gray-400">Verify your email to continue to payment for your package.</p><Link href="/" className={`${primaryClass} mt-7`}>Return home <ArrowRight size={18} /></Link></div>
        : <div className="mx-auto max-w-xl p-6 sm:p-10">
          <div className="text-center"><div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-secondary-500/15 text-secondary-300"><Check size={30} /></div>
            <h1 className="mt-5 text-2xl font-semibold text-white">Request sent for review</h1>
            <p className="mx-auto mt-2 max-w-md text-sm text-gray-400">Thank you, {contact.contactName.trim().split(" ")[0] || "there"}. We sent the details of your {accountType} request to <span className="text-gray-200">{contact.email.trim()}</span>.</p></div>
          {!verificationSent && <p role="alert" className="mt-6 rounded-xl border border-amber-400/25 bg-amber-400/10 p-3 text-sm text-amber-100">We saved your request but could not send the verification email. Contact the Audito team below and we will continue your review.</p>}
          <ol className="mt-6 space-y-3 rounded-2xl border border-white/10 bg-white/[0.03] p-4 text-sm">
            {[
              ["Verify your email", verificationSent ? "Open the email from Audito and select Verify Email. The link works for 48 hours." : "The Audito team will verify your request with you."],
              ["We review your request", `Our team checks your ${contact.departments || "–"} departments and ${contact.lines ? Number(contact.lines).toLocaleString() : "–"} audit lines per audit.`],
              ["You receive a quote", "We email your price and the next steps to set up your workspace."],
            ].map(([title, text], index) => <li key={title} className="flex gap-3"><span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-secondary-500/15 text-xs font-bold text-secondary-300">{index + 1}</span><span><span className="block font-semibold text-white">{title}</span><span className="block text-gray-400">{text}</span></span></li>)}
          </ol>
          <div className="mt-4"><AuditoContactCard contact={teamContact} title="Questions? Contact the Audito team" description="Message us on WhatsApp or by email. Mention your organization name." message={`Hello Audito team, I sent a ${accountType} account request for ${contact.organizationName.trim()}.`} /></div>
          <Link href="/" className={`${primaryClass} mt-6`}>Return home <ArrowRight size={18} /></Link>
        </div> : <>
        <Progress step={step} contactMode={contactMode} />
        <p className="mb-5 px-5 text-center text-xs font-medium text-gray-500 sm:px-8">Step {step + 1} of {contactMode ? 2 : 3} — {step === 0 ? "Account Type" : company ? step === 1 ? "Organization Details" : "Admin Account" : "Contact Details"}</p>
        {step > 0 && error && <p role="alert" className="mx-5 mb-5 rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-400 sm:mx-8">{error}</p>}
        {step === 0 && <AccountTypeStep
          selectedGroup={accountType}
          selectedEntityType={entityType}
          companyLevels={selection.company_levels}
          hasPackage={!contactMode && Boolean(quote)}
          defaultGroup={contactMode ? "Customer" : "Company"}
          mode={contactMode ? "contact" : "package"}
          packageSetupHref={packageSetupHref}
          onGroupSelect={chooseAccount}
          onEntityTypeSelect={(type) => { setEntityType(type); setError(""); }}
          onNext={continueFromAccount}
          error={error}
        />}
        {step === 1 && company && <form onSubmit={continueFromOrganization} className="p-5 pt-1 sm:p-8 sm:pt-2">
          <div className="mb-7 flex items-start gap-3">
            <button type="button" onClick={back} aria-label="Go back" className="absolute left-5 top-5 z-20 flex h-9 w-9 items-center justify-center rounded-xl border border-white/10 bg-white/[0.04] text-gray-400 hover:bg-white/[0.08] hover:text-white sm:left-6 sm:top-6"><ArrowLeft size={18} /></button>
            <div><h3 className="text-xl font-semibold tracking-tight text-white sm:text-2xl">Organization details</h3><p className="mt-1 text-sm leading-relaxed text-gray-400">Tell us about the organization this Audito workspace belongs to.</p></div>
          </div>
          <div className="space-y-5">
            {input("Organization Name", organization.name, (value) => setOrganization((current) => ({ ...current, name: value })), "text", true, "Enter organization name")}
            <div>
              <label className="block text-sm font-medium text-gray-300">Organization logo <span className="text-xs font-normal text-gray-500">(optional)</span></label>
              <p className="mt-0.5 text-xs text-gray-500">PNG or JPEG. We crop and optimize it for your report header.</p>
              <input ref={logoInput} type="file" accept="image/png,image/jpeg" className="hidden" onChange={chooseLogo} />
              <div className="mt-2 flex min-h-20 items-center gap-3 rounded-xl border border-dashed border-white/15 bg-black/10 p-3">
                {organization.logo ? <img src={organization.logo} alt="Organization logo preview" className="h-14 w-20 rounded-lg border border-white/10 bg-white object-contain p-1" /> : <div className="flex h-14 w-20 items-center justify-center rounded-lg border border-white/10 bg-white/[0.04] text-gray-500"><ImagePlus size={20} /></div>}
                <div className="min-w-0 flex-1"><p className="text-sm font-medium text-white">{organization.logo ? "Logo selected" : "Add your organization logo"}</p><p className="mt-0.5 text-xs text-gray-500">Optional branding for audit and CAP reports.</p></div>
                <div className="flex shrink-0 gap-2"><button type="button" onClick={() => logoInput.current?.click()} className="rounded-lg border border-white/10 bg-white/[0.05] px-3 py-2 text-xs font-medium text-gray-200 hover:bg-white/10">{organization.logo ? "Replace" : "Select"}</button>{organization.logo && <button type="button" onClick={() => setOrganization((current) => ({ ...current, logo: null }))} className="rounded-lg border border-red-400/20 bg-red-500/10 px-3 py-2 text-xs font-medium text-red-300 hover:bg-red-500/20">Remove</button>}</div>
              </div>
              <OrganizationLogoCropModal open={Boolean(logoFile)} file={logoFile} initialCrop={logoCrop} onClose={() => setLogoFile(null)} onError={setError} onApply={(value, crop) => { setOrganization((current) => ({ ...current, logo: value })); setLogoCrop(crop); setLogoFile(null); }} />
            </div>
            {entityType === "Company" && <div><label className="mb-2 block text-sm font-medium text-gray-300">Company Type <span className="text-red-400">*</span></label><select required value={organization.companyType} onChange={(event) => setOrganization((current) => ({ ...current, companyType: event.target.value }))} className={fieldClass}><option value="">Select company type</option><option value="Ready to sell">Ready to sell</option><option value="Ready to bill">Ready to bill</option></select></div>}
            {input("Registration Number", organization.registrationNumber, (value) => setOrganization((current) => ({ ...current, registrationNumber: value })), "text", false, "Business registration number")}
            {input("Organization Email", organization.email, (value) => setOrganization((current) => ({ ...current, email: value })), "email", true, "info@company.com")}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <CountryField countries={countries} value={organization.country}
                onChange={(country) => setOrganization((current) => ({ ...current, country: country.country, timezone: COUNTRY_TIMEZONE_MAP[country.country_code] || "" }))} />
              <div><label className="mb-2 block text-sm font-medium text-gray-300">Phone number <span className="text-red-400">*</span></label><div className="flex">{dialCode && <span className="inline-flex items-center rounded-l-xl border border-r-0 border-white/10 bg-white/[0.04] px-3 text-sm text-gray-400">{dialCode}</span>}<input type="tel" required value={organization.phone} onChange={(event) => setOrganization((current) => ({ ...current, phone: event.target.value }))} placeholder="Phone number" className={fieldClass + (dialCode ? " rounded-l-none" : "")} /></div></div>
            </div>
            {organization.timezone && <div className="-mt-1 flex items-center gap-1.5 rounded-lg border border-white/[0.06] bg-black/10 px-3 py-2 text-[11px] text-gray-500">Timezone auto-detected: <span className="font-medium text-secondary-500">{organization.timezone}</span></div>}
            <div className="space-y-5 border-t border-white/[0.07] pt-5">
              {input("Address Line 1", organization.address1, (value) => setOrganization((current) => ({ ...current, address1: value })), "text", true, "Street address, P.O. box")}
              {input("Address Line 2", organization.address2, (value) => setOrganization((current) => ({ ...current, address2: value })), "text", true, "Apartment, suite, unit, building, floor, etc.")}
              {input("Address Line 3", organization.address3, (value) => setOrganization((current) => ({ ...current, address3: value })), "text", false, "City, State/Province, Region (optional)")}
            </div>
            {quote && <div className="rounded-2xl border border-secondary-500/20 bg-secondary-500/[0.07] p-4 text-xs text-gray-300"><strong className="text-white">{entityType} workspace</strong> · {hierarchySelectionLabel(selection.company_levels)} · {selection.departments} departments · {selection.lines_per_audit} audit lines · {quote.tokens.toLocaleString()} tokens · {money(quote.total)} total <Link href={packageSetupHref} className="ml-2 text-secondary-400 underline">Edit package</Link></div>}
            <button type="submit" disabled={busy} className={primaryClass}>{busy ? "Checking email..." : "Next: Admin Account"} <ArrowRight size={16} /></button>
          </div>
          <p className="mt-4 text-center text-sm text-gray-400">Already have an account? <Link href="/login" className="font-medium text-secondary-400 hover:text-secondary-300">Log in</Link></p>
        </form>}
        {step === 2 && company && <form onSubmit={submitCompany} className="p-5 pt-1 sm:p-8 sm:pt-2">
          <div className="mb-7 flex items-start gap-3"><button type="button" onClick={back} aria-label="Go back" className="absolute left-5 top-5 z-20 flex h-9 w-9 items-center justify-center rounded-xl border border-white/10 bg-white/[0.04] text-gray-400 hover:bg-white/[0.08] hover:text-white sm:left-6 sm:top-6"><ArrowLeft size={18} /></button><div><div className="flex flex-wrap items-center gap-2"><h3 className="text-xl font-semibold tracking-tight text-white sm:text-2xl">Admin account</h3><span className="rounded-full border border-secondary-500/20 bg-secondary-500/10 px-2.5 py-1 text-[10px] font-semibold text-secondary-400">Company</span></div><p className="mt-1 text-sm leading-relaxed text-gray-400">Create the primary administrator who will manage this workspace.</p></div></div>
          <div className="space-y-5">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">{input("First Name", administrator.firstName, (value) => setAdministrator((current) => ({ ...current, firstName: value })), "text", true, "First name")}{input("Last Name", administrator.lastName, (value) => setAdministrator((current) => ({ ...current, lastName: value })), "text", true, "Last name")}</div>
            <div className="grid grid-cols-1 items-end gap-4 sm:grid-cols-2">
              <div><label className="mb-2 block text-sm font-medium text-gray-300">Email <span className="text-red-400">*</span><span className="ml-1.5 text-[10px] font-normal text-secondary-500">(same as organization email)</span></label><input type="email" value={administrator.email} readOnly className="min-h-11 w-full cursor-not-allowed rounded-xl border border-white/[0.07] bg-white/[0.025] px-4 py-3 text-sm text-white/50" /></div>
              <div><label className="mb-2 block text-sm font-medium text-gray-300">Phone number <span className="text-red-400">*</span></label><div className="flex">{dialCode && <span className="inline-flex items-center rounded-l-xl border border-r-0 border-white/10 bg-white/[0.04] px-3 text-sm text-gray-400">{dialCode}</span>}<input type="tel" required value={administrator.phone} onChange={(event) => setAdministrator((current) => ({ ...current, phone: event.target.value }))} className={fieldClass + (dialCode ? " rounded-l-none" : "")} placeholder="Phone number" /></div></div>
            </div>
            <div className="space-y-5 border-t border-white/[0.07] pt-5">
              <div><label className="mb-2 block text-sm font-medium text-gray-300">Password <span className="text-red-400">*</span></label><div className="relative"><input type={showPassword ? "text" : "password"} required value={administrator.password} onChange={(event) => setAdministrator((current) => ({ ...current, password: event.target.value }))} className={fieldClass + " pr-12"} placeholder="Create a strong password" /><button type="button" aria-label={showPassword ? "Hide password" : "Show password"} onClick={() => setShowPassword((shown) => !shown)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white">{showPassword ? <EyeOff size={18} /> : <Eye size={18} />}</button></div></div>
              <div><label className="mb-2 block text-sm font-medium text-gray-300">Confirm Password <span className="text-red-400">*</span></label><div className="relative"><input type={showConfirmPassword ? "text" : "password"} required value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} className={fieldClass + " pr-12"} placeholder="Repeat password" /><button type="button" aria-label={showConfirmPassword ? "Hide confirmation" : "Show confirmation"} onClick={() => setShowConfirmPassword((shown) => !shown)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white">{showConfirmPassword ? <EyeOff size={18} /> : <Eye size={18} />}</button></div>{confirmPassword && administrator.password !== confirmPassword && <p className="mt-1 text-xs text-red-400">Passwords do not match.</p>}</div>
            </div>
            {administrator.password && <div className="rounded-2xl border border-white/[0.08] bg-black/10 p-4"><p className="mb-3 text-[10px] uppercase tracking-wider text-gray-500">Security strength</p><div className="mb-4 h-1 overflow-hidden rounded-full bg-white/5"><div className={"h-full transition-all " + (Object.values(passwordRequirements).every(Boolean) ? "w-full bg-emerald-500" : Object.values(passwordRequirements).filter(Boolean).length > 2 ? "w-2/3 bg-yellow-500" : "w-1/3 bg-red-500")} /></div><div className="grid grid-cols-2 gap-x-4 gap-y-2">{[{ key: "length", label: "8+ Characters" }, { key: "upper", label: "Uppercase Letter" }, { key: "lower", label: "Lowercase Letter" }, { key: "number", label: "One Number" }, { key: "special", label: "Special Character (@$!%*?&#)" }].map((rule) => <div key={rule.key} className="flex items-center gap-2"><span className={"flex h-3.5 w-3.5 items-center justify-center rounded-full border " + (passwordRequirements[rule.key as keyof typeof passwordRequirements] ? "border-secondary-500/50 bg-secondary-500/20" : "border-white/10")}>{passwordRequirements[rule.key as keyof typeof passwordRequirements] && <Check size={8} className="text-secondary-400" />}</span><span className={"text-[10px] font-medium " + (passwordRequirements[rule.key as keyof typeof passwordRequirements] ? "text-white" : "text-gray-500")}>{rule.label}</span></div>)}</div></div>}
            {quote && pricing && <div className="rounded-2xl border border-secondary-500/20 bg-secondary-500/[0.07] p-4 text-xs text-gray-300"><strong className="text-white">Your package</strong><p className="mt-1">{entityType} workspace · {hierarchySelectionLabel(selection.company_levels)} · {selection.departments} departments · {selection.lines_per_audit} audit lines</p><p className="mt-1">1 token = 1 audit line at {money(pricing.token_unit_price)} per token. {quote.tokens.toLocaleString()} tokens · {money(quote.total)} total.</p></div>}
            <label className="group flex cursor-pointer items-start gap-3"><span className="relative mt-0.5"><input type="checkbox" checked={agreed} onChange={(event) => setAgreed(event.target.checked)} className="peer sr-only" /><span className={"flex h-5 w-5 items-center justify-center rounded border transition-all " + (agreed ? "border-secondary-500 bg-secondary-500" : "border-white/30 bg-white/5 group-hover:border-white/50")}>{agreed && <Check size={12} className="text-primary-950" />}</span></span><span className="text-sm leading-snug text-gray-400">I agree to the <Link href="/privacy-policies" target="_blank" className="font-medium text-secondary-400 underline underline-offset-2 hover:text-secondary-300">{privacy ? privacy.title + " (" + privacy.version + ")" : "Privacy Policy"}</Link> and acknowledge that my data will be processed in accordance with it.</span></label>
            <button type="submit" disabled={busy || !quote || !privacy || !agreed} className={primaryClass}>{busy ? <Loader2 size={18} className="animate-spin" /> : "Create Account"}</button>
          </div>
          <p className="mt-4 text-center text-sm text-gray-400">Already have an account? <Link href="/login" className="font-medium text-secondary-400 hover:text-secondary-300">Log in</Link></p>
        </form>}
        {step === 1 && !company && <form onSubmit={submitContact} className="p-5 pt-1 sm:p-8 sm:pt-2">
          <div className="mb-7 flex items-start gap-3"><button type="button" onClick={back} aria-label="Go back" className="absolute left-5 top-5 z-20 flex h-9 w-9 items-center justify-center rounded-xl border border-white/10 bg-white/[0.04] text-gray-400 hover:bg-white/[0.08] hover:text-white sm:left-6 sm:top-6"><ArrowLeft size={18} /></button><div><div className="flex flex-wrap items-center gap-2"><h3 className="text-xl font-semibold tracking-tight text-white sm:text-2xl">Contact the Audito team</h3><span className="rounded-full border border-secondary-500/20 bg-secondary-500/10 px-2.5 py-1 text-[10px] font-semibold text-secondary-400">{accountType}</span></div><p className="mt-1 text-sm leading-relaxed text-gray-400">Tell us about the organization requesting a {entityType} account.</p></div></div>
          <div className="space-y-5">
            {input("Organization Name", contact.organizationName, (value) => setContact((current) => ({ ...current, organizationName: value })), "text", true, "Enter organization name")}
            {input("Your Name", contact.contactName, (value) => setContact((current) => ({ ...current, contactName: value })), "text", true, "Your full name")}
            {input("Email", contact.email, (value) => setContact((current) => ({ ...current, email: value })), "email", true, "you@company.com")}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <CountryField countries={countries} value={contact.country} onChange={(country) => setContact((current) => ({ ...current, country: country.country }))} />
              <div><label className="mb-2 block text-sm font-medium text-gray-300">Phone number <span className="text-red-400">*</span></label><div className="flex">{contactDialCode && <span className="inline-flex items-center rounded-l-xl border border-r-0 border-white/10 bg-white/[0.04] px-3 text-sm text-gray-400">{contactDialCode}</span>}<input type="tel" required value={contact.phone} onChange={(event) => setContact((current) => ({ ...current, phone: event.target.value }))} placeholder="Phone number" className={fieldClass + (contactDialCode ? " rounded-l-none" : "")} /></div></div>
            </div>
            <fieldset className="rounded-2xl border border-white/10 bg-white/[0.02] p-4">
              <legend className="px-1 text-sm font-semibold text-white">Workspace size</legend>
              <p className="-mt-1 mb-4 text-xs text-gray-400">We use these to prepare your quote. An estimate is fine.</p>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label htmlFor="review-departments" className="mb-2 block text-sm font-medium text-gray-300">Departments <span className="text-red-400">*</span></label>
                  <input id="review-departments" type="number" inputMode="numeric" min={1} max={10000} step={1} required value={contact.departments} placeholder="For example: 12"
                    onChange={(event) => setContact((current) => ({ ...current, departments: event.target.value }))} className={fieldClass} aria-describedby="review-departments-help" />
                  <p id="review-departments-help" className="mt-1.5 text-xs text-gray-500">Areas you will audit, from 1 to 10,000.</p>
                </div>
                <div>
                  <label htmlFor="review-lines" className="mb-2 block text-sm font-medium text-gray-300">Audit lines per audit <span className="text-red-400">*</span></label>
                  <input id="review-lines" type="number" inputMode="numeric" min={1} max={1000000} step={1} required value={contact.lines} placeholder="For example: 150"
                    onChange={(event) => setContact((current) => ({ ...current, lines: event.target.value }))} className={fieldClass} aria-describedby="review-lines-help" />
                  <p id="review-lines-help" className="mt-1.5 text-xs text-gray-500">Questions or checks in one audit.</p>
                </div>
              </div>
            </fieldset>
            <div><label className="mb-2 block text-sm font-medium text-gray-300">Additional details</label><textarea value={contact.notes} onChange={(event) => setContact((current) => ({ ...current, notes: event.target.value }))} className={fieldClass} rows={4} placeholder="Tell us what you need, for example sites, audit types or timelines" /></div>
            <button type="submit" disabled={busy} className={primaryClass}>{busy ? <Loader2 size={18} className="animate-spin" /> : "Send for Review"}<ArrowRight size={16} /></button>
            <AuditoContactCard contact={teamContact} title="Prefer to talk first?" description="Message us on WhatsApp or send an email." />
          </div>
          <p className="mt-4 text-center text-sm text-gray-400">Already have an account? <Link href="/login" className="font-medium text-secondary-400 hover:text-secondary-300">Log in</Link></p>
        </form>}
      </>}
    </div></div>;
}

export default function RegisterPage() { return <Suspense fallback={<div className="flex min-h-screen items-center justify-center"><Loader2 size={32} className="animate-spin text-secondary-400" /></div>}><RegistrationContent /></Suspense>; }
