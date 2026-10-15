import Image from "next/image";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import logo from "@/assets/logo/audito_logo.png";
import PackageSelector from "@/components/pricing/PackageSelector";

export default function SelectPackagePage() {
  return <main className="relative min-h-screen px-4 pb-12 pt-16 text-white sm:px-6 sm:py-12">
    <div className="pointer-events-none absolute inset-0 overflow-hidden">
      <div className="absolute left-1/4 top-1/3 h-80 w-80 rounded-full bg-primary-600/15 blur-3xl" />
      <div className="absolute bottom-1/3 right-1/4 h-60 w-60 rounded-full bg-accent-500/10 blur-3xl" />
    </div>
    <div className="glass relative mx-auto max-w-6xl rounded-3xl border-white/10 pt-6 shadow-2xl shadow-black/20 sm:pt-8">
      <Link href="/login" aria-label="Back to sign in" className="absolute left-5 top-5 z-20 flex h-9 w-9 items-center justify-center rounded-xl border border-white/10 bg-white/[0.04] text-gray-400 transition-colors hover:bg-white/[0.08] hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-secondary-400 sm:left-6 sm:top-6"><ArrowLeft size={18} /></Link>
      <div className="mb-5 px-5 text-center sm:px-8">
        <Link href="/" className="inline-block" aria-label="Audito home"><Image src={logo} alt="Audito" width={110} height={30} className="mx-auto h-8" priority /></Link>
        <p className="mb-1 mt-3 text-[10px] font-semibold uppercase tracking-[2px] text-secondary-500">Create your workspace</p>
      </div>
      <PackageSelector standalone />
      <p className="px-5 pb-8 text-center text-sm text-gray-400 sm:px-8">Already have an account? <Link href="/login" className="font-medium text-secondary-400 hover:text-secondary-300">Log in</Link></p>
    </div>
  </main>;
}
