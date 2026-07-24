import Link from "next/link";
import Image from "next/image";
import { ArrowUpRight, Mail, ShieldCheck } from "lucide-react";
import { useLanding } from "@/context/LandingContext";
import auditoLogo from "../../assets/logo/audito_logo.png";


export default function Footer() {
  const { setActiveSection } = useLanding();
  return (
    <footer className="border-t border-white/[0.08] bg-[#061b18]/70">
      <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 sm:py-12 lg:px-8">
        <div className="grid gap-9 sm:grid-cols-2 lg:grid-cols-[minmax(0,1.65fr)_0.75fr_0.75fr_minmax(13rem,0.95fr)] lg:gap-8">
          <div>
            <Image src={auditoLogo} alt="Audito" width={116} height={32} className="h-auto w-[116px]" />
            <p className="mt-4 max-w-sm text-sm leading-6 text-gray-400">
              Confident audit management for teams that want compliance, assurance, and operational improvement in one clear workspace.
            </p>
            <div className="mt-5 inline-flex items-center gap-2 rounded-full border border-secondary-400/15 bg-secondary-500/[0.07] px-3 py-1.5 text-[11px] font-medium text-secondary-200">
              <ShieldCheck size={14} /> Built for better assurance
            </div>
          </div>

          <div>
            <h4 className="mb-3 text-xs font-semibold uppercase tracking-[0.16em] text-white">Explore</h4>
            <ul className="space-y-2.5">
              <li><button onClick={() => setActiveSection(1)} className="text-sm text-gray-400 transition-colors hover:text-secondary-300">Features</button></li>
              <li><button onClick={() => setActiveSection(0)} className="text-sm text-gray-400 transition-colors hover:text-secondary-300">Pricing</button></li>
              <li><Link href="/register" className="text-sm text-gray-400 transition-colors hover:text-secondary-300">Get started</Link></li>
            </ul>
          </div>

          <div>
            <h4 className="mb-3 text-xs font-semibold uppercase tracking-[0.16em] text-white">Company</h4>
            <ul className="space-y-2.5">
              <li><button onClick={() => setActiveSection(3)} className="text-sm text-gray-400 transition-colors hover:text-secondary-300">Contact us</button></li>
              <li><a href="mailto:hi@audito.cloud" className="text-sm text-gray-400 transition-colors hover:text-secondary-300">hi@audito.cloud</a></li>
            </ul>
          </div>

          <div className="rounded-2xl border border-white/10 bg-white/[0.035] p-4">
            <p className="text-sm font-semibold text-white">Ready to simplify audits?</p>
            <p className="mt-1.5 text-xs leading-5 text-gray-400">Start building a more visible, accountable audit process today.</p>
            <Link href="/register" className="mt-4 inline-flex items-center gap-1.5 text-sm font-semibold text-secondary-300 transition-colors hover:text-secondary-200">
              Create your workspace <ArrowUpRight size={15} />
            </Link>
            <a href="mailto:hi@audito.cloud" className="mt-3 flex items-center gap-1.5 text-xs text-gray-400 transition-colors hover:text-white">
              <Mail size={13} /> Talk to our team
            </a>
          </div>
        </div>

        <div className="mt-9 flex flex-col gap-2 border-t border-white/[0.08] pt-5 text-xs text-gray-500 sm:flex-row sm:items-center sm:justify-between">
          <p>&copy; {new Date().getFullYear()} Valuecraft Minds. All rights reserved.</p>
          <p>Audito — Audit management made visible.</p>
        </div>
      </div>
    </footer>
  );
}
