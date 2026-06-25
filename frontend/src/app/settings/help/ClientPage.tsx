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

// ─── Entity / head wording per account type (mirrors onboarding) ──
const ACCOUNT_STRUCTURE: Record<string, { units: string; examples: string; heads: string }> = {
  Customer: {
    units: "Buying Offices and Suppliers",
    examples: "buying offices and the suppliers that report to them",
    heads: "Buying Office Heads and Supplier Heads",
  },
  Company: {
    units: "Clusters, Factories, Units, Departments and Sections",
    examples: "your clusters, factories, units, departments and sections",
    heads: "Cluster, Factory, Unit, Department and Section Heads",
  },
  "Audit Firm": {
    units: "Branches and Departments",
    examples: "your branches and the departments inside them",
    heads: "Branch Heads and Department Heads",
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

  // 4. Entity heads (not for audit firms)
  if (!isAuditFirm) {
    sections.push({
      icon: Users,
      title: "4. Assign entity heads",
      description: `Entity heads oversee a specific unit. Invite your ${cfg.heads}.`,
      steps: [
        { title: "Open Users", detail: "Pick the head level you want to fill and invite a user for it." },
        { title: "One head per entity", detail: "Each head is tied to their entity and gets read-only visibility into that unit's audits and findings." },
      ],
    });
  }

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
      { title: "Notices", detail: "Publish announcements that your users see in their notification panel." },
      { title: "Organization Info", detail: "Keep your organization's profile details up to date." },
      { title: "Billing", detail: "Review your current plan, resource limits and upgrade when you need more capacity." },
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

// ─── Entity head guide (workflow follows the entity-head pages) ───
function buildEntityHeadGuide(): RoleGuide {
  return {
    badge: "Entity Head",
    heading: "Reviewing audits for your unit",
    intro: "As an entity head you have read-only oversight of the audits and findings for your assigned organization unit. You review and stay informed — you do not perform audits or make approvals.",
    sections: [
      {
        icon: BarChart3,
        title: "Start at your Dashboard",
        description: "Your dashboard summarizes audit activity and performance for your unit.",
        steps: [
          { title: "Spot trends", detail: "Use the dashboard to analyze performance and identify recurring issues across your scope." },
        ],
      },
      {
        icon: Eye,
        title: "Review Audits",
        description: "See every audit carried out within your assigned unit.",
        steps: [
          { title: "Open an audit", detail: "Browse audits in your scope and open one to view its findings and evidence." },
          { title: "Read-only access", detail: "You can review everything but cannot change answers or approve — your role is oversight." },
        ],
      },
      {
        icon: Network,
        title: "Monitor CAPs",
        description: "Track the Corrective Action Plans raised for your unit.",
        steps: [
          { title: "Follow resolution", detail: "Open a CAP to see the finding and watch its progress until it is resolved." },
        ],
      },
    ],
  };
}

function buildGuide(role: string, accountType: string | null | undefined): RoleGuide {
  if (role === "auditor") return buildAuditorGuide();
  if (role === "entity_head") return buildEntityHeadGuide();
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
