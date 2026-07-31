"use client";

import { useMemo } from "react";
import { useAuth } from "@/context/AuthContext";
import {
  HelpCircle, Building2, FolderTree, Users, Shield, ClipboardList, FileCheck,
  CreditCard, MapPin, Bell, GraduationCap, ClipboardCheck, Eye, BarChart3,
  Network, CheckCircle2, type LucideIcon,
} from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────
interface HelpStep { title: string; detail: string; }
interface HelpSection {
  icon: LucideIcon;
  title: string;
  description: string;
  steps: HelpStep[];
}
interface RoleGuide {
  badge: string;
  heading: string;
  intro: string;
  sections: HelpSection[];
}

// ─── Entity wording per account type (mirrors onboarding) ──
const ACCOUNT_STRUCTURE: Record<string, { units: string; examples: string }> = {
  Customer: {
    units: "Buying Offices and Suppliers",
    examples: "buying offices and the suppliers that report to them",
  },
  Company: {
    units: "Clusters, Factories, Units, Departments and Sections",
    examples: "your clusters, factories, units, departments and sections",
  },
  "Audit Firm": {
    units: "Branches and Departments",
    examples: "your branches and the departments inside them",
  },
};

// ─── Admin guide builder (workflow follows the onboarding missions) ─
function buildAdminGuide(accountType: string): RoleGuide {
  const isAuditFirm = accountType === "Audit Firm";
  const cfg = ACCOUNT_STRUCTURE[accountType] ?? ACCOUNT_STRUCTURE.Customer;

  const sections: HelpSection[] = [];

  // 1. Build the structure
  sections.push({
    icon: Building2,
    title: "1. Build your organization structure",
    description: `Recreate your real-world organization inside Audito by adding ${cfg.examples}.`,
    steps: [
      { title: "Open Structure", detail: `Use the Structure menu in the sidebar to add your ${cfg.units}. Work top-down — create higher levels first so lower levels have a parent to attach to.` },
      { title: "Add at least one of each level", detail: "You only need one entity per level to get started; you can keep adding more at any time afterwards." },
    ],
  });

  // 2. Org mapping
  sections.push({
    icon: FolderTree,
    title: "2. Map the reporting hierarchy",
    description: "Link your entities together so audit results roll up through the correct chain.",
    steps: [
      { title: "Open the Org Tree", detail: "Go to Structure → Org Tree to connect each entity to its parent and visualize the full hierarchy." },
      { title: "Use Links for external partners", detail: "Structure → Links lets you connect with partner organizations (for example a Supplier connecting to a Company) so audits can be shared across the link." },
    ],
  });

  // 3. Auditors
  sections.push({
    icon: Shield,
    title: "3. Add your auditors",
    description: "Auditors are the people who carry out inspections on the ground.",
    steps: [
      { title: "Open Users → Auditors", detail: "Invite each auditor by email. They receive an invitation to set their password and verify their account." },
      { title: "Assign their scope", detail: `Attach each auditor to the relevant ${isAuditFirm ? "branch or department" : "entity"} so they only see the audits meant for them.` },
    ],
  });

  // 4. Organization users
  sections.push({
    icon: Users,
    title: "4. Add organization users",
    description: "Organization users have read-only oversight of the organization areas you select.",
    steps: [
      { title: "Open Users → Organization Users", detail: "Invite a user and select any combination of non-root entities from the organization tree." },
      { title: "Choose exact or branch access", detail: "Grant access to only the selected entity, or include all of its current and future subentities." },
    ],
  });

  // 5 & 6. Checklists + Audits — only the assigning side (not Audit Firm)
  if (!isAuditFirm) {
    sections.push({
      icon: ClipboardList,
      title: "5. Create your checklists",
      description: "Checklists are the questionnaires auditors fill in during an audit.",
      steps: [
        { title: "Define a Checklist Type", detail: "Under Checklists → Checklist Types, group related questionnaires (for example Safety, Quality, Compliance)." },
        { title: "Build the checklist", detail: "Add questions, configure scoring and repeat settings, then assign the checklist to the entities it applies to." },
      ],
    });
    sections.push({
      icon: FileCheck,
      title: "6. Launch your first audit",
      description: "Bring everything together by scheduling an audit assignment.",
      steps: [
        { title: "Open Audits", detail: "Choose a checklist, select the target entities and the auditors who will perform it." },
        { title: "Set the timeline", detail: "Pick start and end dates. The audit then appears in each assigned auditor's My Audits list." },
        { title: "Track CAPs", detail: "When findings need fixing, Corrective Action Plans (CAPs) are raised and tracked from the CAPs menu until they are resolved." },
      ],
    });
    sections.push({
      icon: BarChart3,
      title: "7. Compare completed audits",
      description: "Compare repeated audits that use the same checklist to identify performance changes across your organization.",
      steps: [
        { title: "Open Audit Comparison", detail: "From Audits, select Compare Audits. Choose two to five completed audits that use the same checklist." },
        { title: "Focus on an entity", detail: "Use the Entity filter to view the completed score for your organization, a specific entity, or one of its child entities." },
      ],
    });
  } else {
    // Audit Firm receives assignments rather than creating them
    sections.push({
      icon: FileCheck,
      title: "5. Manage assigned audits",
      description: "Audit firms receive audit assignments from their clients rather than creating checklists.",
      steps: [
        { title: "Open Assigned Audits", detail: "Review the audits clients have assigned to your firm and delegate them to the right auditors and branches." },
        { title: "Monitor progress", detail: "Follow each audit from planned to in-progress to completed, and make sure reports are submitted on time." },
      ],
    });
  }

  // Learning
  sections.push({
    icon: GraduationCap,
    title: "Develop your team with Learning",
    description: "Keep auditors sharp with trainings, field visits and evaluations.",
    steps: [
      { title: "Trainings & Field Visits", detail: "Schedule trainings and on-site field visits from the Learning menu." },
      { title: "Evaluation Papers", detail: "Assess auditor competency with evaluation papers and review their scores." },
    ],
  });

  // Settings
  sections.push({
    icon: CreditCard,
    title: "Configure your account in Settings",
    description: "The Settings menu holds the controls that apply to your whole organization.",
    steps: [
      { title: "Timezone", detail: "Set the official timezone so all audit schedules and reports use consistent times." },
      { title: "Notices and notifications", detail: "Publish organization notices and use in-app notifications to keep assigned users informed about audits, learning and corrective actions." },
      { title: "Organization Info", detail: "Keep your organization profile, contact details and optional logo up to date. The logo can appear alongside Audito branding in reports." },
      { title: "Billing", detail: "Review your plan, renewal date and limits; change between monthly and yearly billing, upgrade when you need capacity, and complete renewal payments when prompted." },
    ],
  });

  return {
    badge: `${accountType} Admin`,
    heading: "Setting up and running Audito",
    intro: "As an admin you configure entities, users and audit workflows for your whole organization. Follow the steps below in order — they mirror the guided onboarding flow — then use the ongoing sections to keep things running.",
    sections,
  };
}

// ─── Auditor guide (workflow follows the auditor pages) ───────────
function buildAuditorGuide(): RoleGuide {
  return {
    badge: "Auditor",
    heading: "Performing audits and corrective actions",
    intro: "As an auditor your job is to carry out the audits assigned to you, record what you find, submit reports and follow up on corrective actions. Everything you need lives in the sidebar.",
    sections: [
      {
        icon: BarChart3,
        title: "Start at your Dashboard",
        description: "Your dashboard gives you a quick overview of what needs your attention.",
        steps: [
          { title: "Check assignments", detail: "See your upcoming and in-progress audits and any pending corrective actions at a glance." },
        ],
      },
      {
        icon: ClipboardCheck,
        title: "Work through My Audits",
        description: "Every audit assigned to you appears here, moving from Planned to In Progress to Completed.",
        steps: [
          { title: "Open an assignment", detail: "Each audit shows its checklist, target entities, dates and progress. Open one to begin." },
          { title: "Execute the checklist", detail: "Answer each question, record findings and attach evidence such as photos or notes as you inspect." },
          { title: "Preview & submit the report", detail: "Review your answers in the preview, then submit the report once the audit is complete." },
          { title: "Raise corrective actions", detail: "Where a question fails or a finding needs fixing, raise corrective actions so the issue can be tracked to resolution." },
        ],
      },
      {
        icon: ClipboardList,
        title: "Follow up in My CAPs",
        description: "Corrective Action Plans (CAPs) track the issues that came out of your audits.",
        steps: [
          { title: "Review CAP details", detail: "Open a CAP to see the finding, the required action and its current status." },
          { title: "Execute and report", detail: "Carry out the follow-up checks, record the outcome and submit your CAP report." },
        ],
      },
      {
        icon: GraduationCap,
        title: "Grow with My Learning",
        description: "Build your skills and complete the assessments your organization sets for you.",
        steps: [
          { title: "Trainings & Field Visits", detail: "Complete the trainings and field visits assigned to you under My Learning." },
          { title: "Evaluation Papers", detail: "Take your evaluation papers to demonstrate your competency." },
        ],
      },
    ],
  };
}

// ─── Organization user guide (workflow follows the organization-user pages) ───
function buildOrganizationUserGuide(): RoleGuide {
  return {
    badge: "Organization User",
    heading: "Reviewing audits for your organization areas",
    intro: "As an organization user you have read-only oversight of audits and findings for the organization areas assigned to you. You review and stay informed — you do not perform audits or make approvals.",
    sections: [
      {
        icon: BarChart3,
        title: "Start at your Dashboard",
        description: "Your dashboard summarizes audit activity and performance across your permitted organization areas.",
        steps: [
          { title: "Spot trends", detail: "Use the dashboard to analyze performance and identify recurring issues across your scope." },
        ],
      },
      {
        icon: Eye,
        title: "Review Audits",
        description: "See every audit carried out within your permitted organization areas.",
        steps: [
          { title: "Open an audit", detail: "Browse audits in your scope and open one to view its findings and evidence." },
          { title: "Read-only access", detail: "You can review everything but cannot change answers or approve — your role is oversight." },
        ],
      },
      {
        icon: Network,
        title: "Monitor CAPs",
        description: "Track the Corrective Action Plans raised for your permitted organization areas.",
        steps: [
          { title: "Follow resolution", detail: "Open a CAP to see the finding and watch its progress until it is resolved." },
        ],
      },
    ],
  };
}

function buildAuditoAdminGuide(): RoleGuide {
  return {
    badge: "Audito Admin",
    heading: "Operating the Audito platform",
    intro: "As an Audito administrator, you manage platform-wide plans, campaigns, policy content, payments and organization requests. Changes here can affect future registrations and renewals, so review each update before saving.",
    sections: [
      {
        icon: BarChart3,
        title: "Monitor the platform dashboard",
        description: "Use the dashboard to understand registrations, income and plan performance at a glance.",
        steps: [
          { title: "Review registrations", detail: "Use the registration chart time range to monitor new organizations over daily, weekly, monthly or yearly periods." },
          { title: "Review income", detail: "Use the income distribution chart and payment records to identify revenue by plan and billing activity." },
        ],
      },
      {
        icon: CreditCard,
        title: "Manage plans and limits",
        description: "Plan settings control the prices and limits presented on the landing page, registration flow and future subscription renewals.",
        steps: [
          { title: "Open Plans", detail: "Review each plan side by side, then update its price, included limits and available features as needed." },
          { title: "Use yearly discount carefully", detail: "The yearly discount applies platform-wide. Confirm the calculation before saving because it changes the yearly price displayed to customers." },
          { title: "Add a plan when required", detail: "Use Add Plan to create a new plan with its name, price, billing options, limits and feature access." },
        ],
      },
      {
        icon: Network,
        title: "Run promotion campaigns",
        description: "Campaigns are time-limited public offers. They are separate from promo codes and can automatically appear on pricing cards.",
        steps: [
          { title: "Create a campaign", detail: "Set the eligible plan, discount type or amount, purchase purpose and the campaign start and end period." },
          { title: "Check active dates", detail: "Only active campaigns within their configured time window are applied to new purchases. End or pause a campaign when the offer is no longer valid." },
          { title: "Manage promo codes separately", detail: "Use Promotions → Promo Codes for code-based discounts that a customer enters during registration." },
        ],
      },
      {
        icon: FileCheck,
        title: "Review custom solution requests",
        description: "Custom plan registrations are verified before they appear for pricing review.",
        steps: [
          { title: "Wait for email verification", detail: "Only verified custom solution requests appear as pending review, preventing unverified submissions from entering the pricing workflow." },
          { title: "Set the tailored price", detail: "Review the requested capacity, assign the agreed price and send the organization its secure payment path." },
        ],
      },
      {
        icon: ClipboardCheck,
        title: "Manage privacy policies",
        description: "Published policies are shown during registration and each registration records the policy version accepted.",
        steps: [
          { title: "Draft and review", detail: "Create a policy title, introduction and clear sections before publishing it." },
          { title: "Publish a new version", detail: "Once a published policy has accepted registrations, keep it as a historical record and publish a new policy version for future registrations." },
        ],
      },
      {
        icon: Shield,
        title: "Review payments and renewals",
        description: "Payment records provide the financial trail for registrations, renewals and upgrades.",
        steps: [
          { title: "Filter and export", detail: "Use plan, billing cycle, status and date filters on Payments. Download a date-range PDF report when a finance summary is needed." },
          { title: "Subscription reminders", detail: "Active plans receive reminders at 7, 3 and 1 day before expiry. Ensure organization admin email and notification delivery remain enabled." },
        ],
      },
    ],
  };
}

function buildGuide(role: string, accountType: string | null | undefined): RoleGuide {
  if (role === "audito_admin" || accountType === "audito_admin") return buildAuditoAdminGuide();
  if (role === "auditor") return buildAuditorGuide();
  if (role === "organization_user") return buildOrganizationUserGuide();
  return buildAdminGuide(accountType === "Audit Firm Company" ? "Audit Firm" : (accountType || "Customer"));
}

export default function HelpPage() {
  const { admin } = useAuth();

  const guide = useMemo(
    () => (admin ? buildGuide(admin.role, admin.account_type) : null),
    [admin]
  );

  if (!admin || !guide) return null;

  return (
    <div className="flex-1 p-6 lg:p-8 pt-20 lg:pt-8 overflow-y-auto max-w-6xl w-full mx-auto space-y-6">

      {/* Header */}
      <div>
        <h1 className="text-xl sm:text-2xl font-bold text-white flex items-center gap-2">
          <HelpCircle size={20} className="text-secondary-400" />
          Help & Guidance
        </h1>
        <p className="text-sm text-gray-400 mt-0.5">
          Step-by-step instructions tailored to your role in Audito.
        </p>
      </div>

      {/* Role intro card */}
      <div className="glass border border-white/[0.08] rounded-xl p-5 sm:p-6">
        <div className="flex items-center gap-3 mb-3">
          <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-secondary-500/15 text-secondary-400 border border-secondary-500/20">
            {guide.badge}
          </span>
        </div>
        <h2 className="text-lg font-semibold text-white">{guide.heading}</h2>
        <p className="text-sm text-gray-400 mt-1.5 leading-relaxed">{guide.intro}</p>
      </div>

      {/* Sections */}
      <div className="space-y-4">
        {guide.sections.map((section, i) => {
          const Icon = section.icon;
          return (
            <div key={i} className="glass border border-white/[0.08] rounded-xl p-5 sm:p-6">
              <div className="flex items-start gap-3 pb-4 border-b border-white/[0.06]">
                <div className="w-9 h-9 rounded-lg bg-secondary-500/10 border border-secondary-500/20 flex items-center justify-center shrink-0">
                  <Icon size={16} className="text-secondary-400" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-white">{section.title}</p>
                  <p className="text-xs text-gray-500 mt-0.5">{section.description}</p>
                </div>
              </div>

              <ul className="mt-4 space-y-3">
                {section.steps.map((step, j) => (
                  <li key={j} className="flex items-start gap-3">
                    <CheckCircle2 size={16} className="text-secondary-400/70 shrink-0 mt-0.5" />
                    <div>
                      <p className="text-sm font-medium text-white">{step.title}</p>
                      <p className="text-[13px] text-gray-400 mt-0.5 leading-relaxed">{step.detail}</p>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          );
        })}
      </div>

      {/* Footer note */}
      <div className="glass border border-white/[0.08] rounded-xl p-4 flex items-center gap-3">
        <Bell size={16} className="text-secondary-400 shrink-0" />
        <p className="text-xs text-gray-400">
          Need more help? Check the notifications panel for announcements from your organization, or contact your administrator.
        </p>
      </div>
    </div>
  );
}
