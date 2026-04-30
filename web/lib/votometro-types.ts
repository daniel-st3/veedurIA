import type { VotometroTopicKey } from "@/lib/votometro-topics";

export type VotometroChamber = "senado" | "camara";
export type PromiseAlignment = "coherente" | "inconsistente" | "ausente" | "sin-promesa";
export type VotometroIssueCode = "missing_env" | "missing_schema" | "query_error";

export type VotometroDataIssue = {
  code: VotometroIssueCode;
  title: string;
  message: string;
  detail: string | null;
  httpStatus: number;
};

export type TopicScore = {
  key: string;
  label: string;
  score: number | null;
  votes: number;
};

export type PromiseReviewSummary = {
  id: string;
  claimText: string;
  sourceUrl: string;
  sourceLabel: string;
  sourceDate: string | null;
  topicKey: string | null;
  topicLabel: string;
  stance: string;
  extractionConfidence: number | null;
  reviewNote: string;
  reviewedAt: string | null;
};

export type AttendanceSummary = {
  sessions: number;
  attended: number;
  rate: number | null;
};

export type VoteEventDetail = {
  id: string;
  voteEventId: string;
  projectId: string | null;
  title: string;
  description: string;
  topicKey: string | null;
  topicLabel: string;
  voteDate: string;
  voteValue: string;
  resultText: string;
  promiseAlignment: PromiseAlignment;
  sourceUrl: string;
  projectSourceUrl: string;
  sessionLabel: string;
  isAbsent: boolean;
  deviatesFromParty: boolean;
};

export type LegislatorListItem = {
  id: string;
  slug: string;
  canonicalName: string;
  normalizedName: string;
  initials: string;
  chamber: VotometroChamber;
  chamberLabel: string;
  party: string;
  partyKey: string;
  roleLabel: string;
  commission: string;
  circunscription: string;
  email: string;
  phone: string;
  office: string;
  imageUrl: string;
  bio: string;
  sourcePrimary: string;
  sourceRef: string;
  sourceUpdatedAt: string | null;
  votesIndexed: number;
  attendanceSessions: number;
  attendedSessions: number;
  attendanceRate: number | null;
  approvedPromiseMatches: number;
  coherentVotes: number;
  inconsistentVotes: number;
  absentVotes: number;
  coherenceScore: number | null;
  topTopics: string[];
  topicScores: TopicScore[];
  updatedAt: string | null;
};

export type LegislatorProfile = LegislatorListItem & {
  attendance: AttendanceSummary;
  socials: { network: string; handle: string; url: string }[];
  promises: PromiseReviewSummary[];
  recentVotes: VoteEventDetail[];
};

export type PartySummary = {
  partyKey: string;
  party: string;
  chamber: string;
  memberCount: number;
  activeMembers: number;
  indexedVotes: number;
  attendanceRate: number | null;
  coherenceScore: number | null;
  approvedPromiseMatches: number;
  topicScores: TopicScore[];
};

export type VotometroFilters = {
  chamber?: VotometroChamber;
  party?: string;
  circunscription?: string;
  commission?: string;
  topic?: VotometroTopicKey | string;
  votesMin?: number;
  attendanceMin?: number;
  coherenceMin?: number;
  page: number;
  pageSize: number;
};

export type VotometroDirectoryPayload = {
  meta: {
    total: number;
    page: number;
    pageSize: number;
    pageCount: number;
    activeLegislators: number;
    indexedVotes: number;
    averageCoherence: number | null;
    generatedAt: string;
  };
  issue: VotometroDataIssue | null;
  filters: VotometroFilters;
  options: {
    parties: string[];
    circunscriptions: string[];
    commissions: string[];
  };
  items: LegislatorListItem[];
};

export type VotometroLandingStats = {
  activeLegislators: number | null;
  indexedVotes: number | null;
  averageCoherence: number | null;
  available: boolean;
};

export type VotometroVotesPayload = {
  meta: {
    total: number;
    page: number;
    pageSize: number;
    generatedAt: string;
  };
  issue: VotometroDataIssue | null;
  items: VoteEventDetail[];
};

export type PartySummariesPayload = {
  meta: {
    total: number;
    generatedAt: string;
  };
  issue: VotometroDataIssue | null;
  items: PartySummary[];
};

export type VotometroProfileResult = {
  profile: LegislatorProfile | null;
  issue: VotometroDataIssue | null;
};

export type PromiseReviewRecord = {
  id: string;
  legislatorId: string;
  legislatorName: string;
  topicLabel: string;
  sourceLabel: string;
  sourceDate: string | null;
  claimText: string;
  status: string;
  reviewNote: string;
};

export type IdentityConflictRecord = {
  id: string;
  sourceSystem: string;
  chamber: string;
  candidateName: string;
  normalizedName: string;
  proposedLegislatorId: string | null;
  confidence: number | null;
  status: string;
  evidence: Record<string, unknown>;
  resolvedNote: string;
};

export type ReviewDashboardPayload = {
  promiseQueue: PromiseReviewRecord[];
  identityQueue: IdentityConflictRecord[];
  runs: Record<string, unknown>[];
  issue: VotometroDataIssue | null;
};
