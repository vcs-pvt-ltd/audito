import Link from "next/link";
import Image from "next/image";
import { useLanding } from "@/context/LandingContext";
import auditoLogo from "../../assets/logo/audito_logo.png";


export default function Footer() {
  const { setActiveSection } = useLanding();
  return (
    <footer className="border-t border-white/10 bg-transparent">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
          {/* Brand */}
          <div className="col-span-1 md:col-span-2">
            <Image src={auditoLogo} alt="Audito" width={110} height={30} />
            <p className="mt-3 text-sm text-gray-400 max-w-sm">
              Our comprehensive audit management solution helps you maintain
              compliance, reduce risks, and improve operational efficiency.
            </p>
          </div>

          {/* Quick Links */}
          <div>
            <h4 className="text-sm font-semibold text-white mb-3">Product</h4>
            <ul className="space-y-2">
              <li>
                <button 
                  onClick={() => setActiveSection(1)}
                  className="text-sm text-gray-400 hover:text-white transition-colors"
                >
                  Features
                </button>
              </li>
              <li>
                <button 
                  onClick={() => setActiveSection(2)}
                  className="text-sm text-gray-400 hover:text-white transition-colors"
                >
                  Pricing
                </button>
              </li>
            </ul>
          </div>

          {/* Company */}
          <div>
            <h4 className="text-sm font-semibold text-white mb-3">Company</h4>
            <ul className="space-y-2">
              <li>
                <button 
                  onClick={() => setActiveSection(3)}
                  className="text-sm text-gray-400 hover:text-white transition-colors"
                >
                  Contact us
                </button>
              </li>
              <li>
                <Link href="/register" className="text-sm text-gray-400 hover:text-white transition-colors">
                  Get Started
                </Link>
              </li>
            </ul>
          </div>
        </div>

        <div className="mt-10 pt-6 border-t border-white/10 text-center">
          <p className="text-xs text-gray-500">
            &copy; {new Date().getFullYear()} Valuecraft Minds. All rights reserved.
          </p>
        </div>
      </div>
    </footer>
  );
}
