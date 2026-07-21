"use client";

import Link from "next/link";
import Image from "next/image";
import { ArrowLeft } from "lucide-react";
import logo from "@/assets/logo/audito_logo.png";

const SECTIONS = [
  {
    title: "1. Information We Collect",
    content: `We collect information you provide directly to us, including:
• Account registration details (name, email, phone number, organization information)
• Payment and billing information processed through secure third-party payment processors
• Audit data, reports, checklists, and corrective actions created within the platform
• Communication data when you contact our support team
• Usage data such as log files, device information, and interaction patterns within the application`,
  },
  {
    title: "2. How We Use Your Information",
    content: `We use the information we collect to:
• Provide, maintain, and improve our audit management services
• Process transactions and send related information (receipts, confirmations)
• Send administrative notifications (service updates, security alerts, support messages)
• Monitor and analyze trends, usage, and activity patterns to enhance user experience
• Detect, investigate, and prevent fraudulent or unauthorized activity
• Comply with legal obligations and enforce our terms of service`,
  },
  {
    title: "3. Data Sharing & Disclosure",
    content: `We do not sell your personal information. We may share your data only in the following circumstances:
• With your explicit consent or at your direction
• With service providers who assist in operating our platform (hosting, analytics, payment processing)
• When required by law, regulation, or valid legal process
• To protect the rights, property, or safety of Audito, our users, or the public
• In connection with a merger, acquisition, or sale of assets, with appropriate notice`,
  },
  {
    title: "4. Data Security",
    content: `We implement industry-standard security measures to protect your data:
• All data is encrypted in transit (TLS 1.3) and at rest (AES-256)
• Access controls and authentication mechanisms protect against unauthorized access
• Regular security audits and vulnerability assessments are conducted
• Employee access to user data is restricted and monitored
• Incident response procedures are in place to address any security breaches promptly`,
  },
  {
    title: "5. Data Retention",
    content: `We retain your personal information for as long as your account is active or as needed to provide services. If you request account deletion, we will remove your personal data within 30 days, except where retention is required by law or for legitimate business purposes such as dispute resolution and enforcement of our agreements.`,
  },
  {
    title: "6. Your Rights",
    content: `Depending on your jurisdiction, you may have the following rights:
• Access and receive a copy of your personal data
• Correct inaccurate or incomplete personal data
• Request deletion of your personal data
• Object to or restrict certain processing of your data
• Data portability — receive your data in a structured, machine-readable format
• Withdraw consent where processing is based on consent
To exercise these rights, please contact our privacy team at hi@audito.cloud.`,
  },
  {
    title: "7. Cookies & Tracking",
    content: `We use cookies and similar technologies to:
• Maintain your session and keep you logged in
• Remember your preferences and settings
• Analyze usage patterns to improve our services
• Detect and prevent security threats

You can control cookie preferences through your browser settings. Disabling certain cookies may affect platform functionality.`,
  },
  {
    title: "8. International Data Transfers",
    content: `Your data may be transferred to and processed in countries other than your own. We ensure appropriate safeguards are in place for international transfers, including standard contractual clauses and data processing agreements with our service providers.`,
  },
  {
    title: "9. Children's Privacy",
    content: `Our services are not intended for individuals under the age of 18. We do not knowingly collect personal information from children. If we become aware that we have collected data from a child, we will take steps to delete it promptly.`,
  },
  {
    title: "10. Changes to This Policy",
    content: `We may update this Privacy Policy from time to time. We will notify you of any material changes by posting the updated policy on this page and, where required, by email. Your continued use of the platform after changes are posted constitutes acceptance of the updated policy.`,
  },
  {
    title: "11. Contact Us",
    content: `If you have questions or concerns about this Privacy Policy or our data practices, please contact us:

Audito Privacy Team
Email: hi@audito.cloud

We aim to respond to all privacy-related inquiries within 5 business days.`,
  },
];

export default function PrivacyPolicyPage() {
  return (
    <div className="min-h-screen bg-transparent">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-12 sm:py-20">
        {/* Header */}
        <div className="mb-10">
          <Link href="/register" className="inline-flex items-center gap-2 text-sm text-secondary-400 hover:text-secondary-300 transition-colors mb-6">
            <ArrowLeft size={16} />
            Back to Registration
          </Link>

          <div className="flex items-center gap-3 mb-6">
            <Image src={logo} alt="Audito" className="h-auto w-28 object-contain" />
          </div>

          <h1 className="text-3xl sm:text-4xl font-bold text-white mb-3">Privacy Policy</h1>
          <p className="text-sm text-gray-400">
            Last updated: July 15, 2026
          </p>
          <p className="text-sm text-gray-400 mt-3 leading-relaxed max-w-3xl">
            At Audito, we are committed to protecting your privacy and ensuring the security of your personal information.
            This Privacy Policy explains how we collect, use, disclose, and safeguard your data when you use our audit management platform.
          </p>
        </div>

        {/* Content */}
        <div className="space-y-8">
          {SECTIONS.map((section) => (
            <div key={section.title} className="glass rounded-xl border border-white/10 p-6 sm:p-8">
              <h2 className="text-lg font-bold text-white mb-3">{section.title}</h2>
              <div className="text-sm text-gray-400 leading-relaxed whitespace-pre-line">
                {section.content}
              </div>
            </div>
          ))}
        </div>

        {/* Footer */}
        <div className="mt-12 pt-8 border-t border-white/10 text-center">
          <p className="text-xs text-gray-500">
            This Privacy Policy is effective as of the date listed above and applies to all users of the Audito platform.
          </p>
          <Link href="/register" className="inline-flex items-center gap-2 mt-4 text-sm text-secondary-400 hover:text-secondary-300 transition-colors">
            <ArrowLeft size={14} />
            Return to Registration
          </Link>
        </div>
      </div>
    </div>
  );
}
