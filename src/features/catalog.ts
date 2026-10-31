import type { ComponentType, SVGProps } from "react";
import {
  BriefcaseIcon,
  CalendarIcon,
  ChartIcon,
  MicIcon,
  TargetIcon,
  TrendingUpIcon,
  UploadIcon,
} from "@/components/ui/icons";

export type FeatureId = "F1" | "F2" | "F3" | "F4" | "F5" | "F6" | "F7";

export type Feature = {
  id: FeatureId;
  /** Short product name shown on cards, e.g. "Gap Map". */
  name: string;
  title: string;
  summary: string;
  phase: string;
  icon: ComponentType<SVGProps<SVGSVGElement>>;
  /** Set when the feature is live; otherwise it's shown as "Coming soon". */
  href?: string;
};

// Single source for the feature list (PLAN.md §2), used by the landing page and dashboard.
export const FEATURES: Feature[] = [
  {
    id: "F1",
    name: "Profile Builder",
    title: "Resume & target-role intake",
    summary: "Upload a PDF or DOCX resume and tell us the role you want.",
    phase: "P1",
    icon: UploadIcon,
    href: "/onboarding",
  },
  {
    id: "F2",
    name: "Gap Map",
    title: "Skill-gap map from real JDs",
    summary: "See matched, partial and missing skills, weighted by real demand.",
    phase: "P1",
    icon: TargetIcon,
    href: "/analyze",
  },
  {
    id: "F3",
    name: "Learning Path",
    title: "Week-by-week learning plan",
    summary: "A plan that fits your hours, with resources and checkpoints.",
    phase: "P2",
    icon: CalendarIcon,
    href: "/plan",
  },
  {
    id: "F4",
    name: "Project Lab",
    title: "Portfolio project suggestions",
    summary: "Projects that close several gaps at once and give you interview stories.",
    phase: "P2",
    icon: BriefcaseIcon,
    href: "/projects",
  },
  {
    id: "F5",
    name: "Interview Coach",
    title: "Mock interviews scored on a rubric",
    summary: "Answer by voice or text and get per-criterion scores with feedback.",
    phase: "P3",
    icon: MicIcon,
    href: "/interview",
  },
  {
    id: "F6",
    name: "Progress Tracker",
    title: "Progress tracking that adjusts the plan",
    summary: "Log hours and wins; the plan re-balances when you're ahead or behind.",
    phase: "P4",
    icon: TrendingUpIcon,
    href: "/progress",
  },
  {
    id: "F7",
    name: "Job Tracker",
    title: "Application tracker that learns",
    summary: "Find out which role types and sources actually reply to you.",
    phase: "P5",
    icon: ChartIcon,
    href: "/applications",
  },
];
