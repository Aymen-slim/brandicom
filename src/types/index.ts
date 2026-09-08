export type UserRole = 'admin' | 'member';
export type ClientStatus = 'potential' | 'starting' | 'active' | 'paused' | 'churned';
export type CreatorRole =
  | 'photographer'
  | 'ugc'
  | 'presenter'
  | 'videographer'
  | 'influencer'
  | 'agency'
  | 'editor'
  | 'designer'
  | 'model';
export type DeliverableFormat = 'reel' | 'photo' | 'story' | 'carousel';
export type Platform = 'instagram' | 'tiktok' | 'facebook' | 'youtube';
export type DeliverableStatus = 'idea' | 'scripted' | 'filmed' | 'editing' | 'scheduled' | 'published';
export type PartnerType = 'individual' | 'agency';
export type AssignmentStatus = 'booked' | 'done' | 'cancelled';
export type ContractType = 'retainer' | 'project' | 'one_off';
export type InvoiceStatus = 'draft' | 'sent' | 'paid' | 'partially_paid' | 'overdue' | 'cancelled';
export type PaymentMethod = 'bank_transfer' | 'cash' | 'cheque' | 'card' | 'other';
export type ExpenseCategory =
  | 'partner_fee'
  | 'software'
  | 'ads'
  | 'equipment'
  | 'salary'
  | 'rent'
  | 'travel'
  | 'freelance'
  | 'other';
export type MetricsSource = 'manual' | 'api';
export type HealthRisk = 'low' | 'medium' | 'high';
export type GoalMetric =
  | 'revenue'
  | 'profit'
  | 'deliverables'
  | 'new_clients'
  | 'retention'
  | 'views'
  | 'followers_gained'
  | 'engagement_rate';

export interface UserSummary {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  createdAt?: string;
}

export interface ClientAssignmentData {
  clientId: string;
  userId: string;
  user: UserSummary;
}

export interface SocialAccountData {
  id: string;
  clientId: string;
  platform: Platform;
  handle: string | null;
  url: string | null;
  followers: number | null;
  initialFollowers?: number | null;
  followersUpdatedAt: string | null;
}

export interface PostMetricsData {
  id: string;
  deliverableId: string;
  capturedAt: string;
  views: number;
  likes: number;
  comments: number;
  shares: number;
  saves: number;
  reach: number;
  impressions: number;
  linkClicks: number;
  followersGained: number;
  source: MetricsSource;
  note: string | null;
}

export interface DeliverableData {
  id: string;
  clientId: string;
  clientName?: string | null;
  idea: string;
  title: string | null;
  caption: string | null;
  hook: string | null;
  filmed: boolean;
  published: boolean;
  status: DeliverableStatus;
  link: string | null;
  format: DeliverableFormat | null;
  platform: Platform | null;
  results: string | null;
  publishDate: string | null;
  publishTime?: string | null;
  filmingDate: string | null;
  scheduledAt: string | null;
  thumbnailUrl: string | null;
  createdBy: string | null;
  createdAt: string;
  author?: UserSummary | null;
  latestMetrics?: PostMetricsData | null;
  creatorAssignments?: Array<{
    id: string;
    creator: CreatorData;
    scheduledDate: string | null;
    status?: AssignmentStatus;
  }>;
}

export interface CreatorData {
  id: string;
  name: string;
  role: CreatorRole;
  partnerType: PartnerType;
  company: string | null;
  location: string | null;
  styleTags: string[];
  instagramHandle: string | null;
  followers: number | null;
  dayRate: number | string | null;
  rateUnit: string | null;
  available: boolean;
  phone: string | null;
  email: string | null;
  notes: string | null;
  portfolioUrl: string | null;
  rating: number | null;
  lastWorkedAt: string | null;
  createdAt?: string;
  assignments?: Array<{
    id: string;
    client: { id: string; name: string; status?: ClientStatus };
    scheduledDate: string | null;
    deliverableId: string | null;
    status?: AssignmentStatus;
    deliverable?: {
      id: string;
      idea: string;
      format: string | null;
      platform: string | null;
    } | null;
  }>;
}

export interface ClientContractData {
  clientId: string;
  contractType: ContractType;
  monthlyFee: number | null;
  currency: string;
  billingDay: number | null;
  startDate: string | null;
  endDate: string | null;
  notes: string | null;
}

export interface ClientHealthData {
  clientId: string;
  score: number;
  risk: HealthRisk;
  factors: Record<string, unknown>;
  aiSummary: string | null;
  computedAt: string;
}

export interface ClientData {
  id: string;
  name: string;
  location: string | null;
  industry: string | null;
  website: string | null;
  contactName: string | null;
  contactEmail: string | null;
  contactPhone: string | null;
  startDate: string | null;
  endDate: string | null;
  leadSource: string | null;
  churnReason: string | null;
  tags: string[];
  assetsUrl: string | null;
  logoUrl: string | null;
  status: ClientStatus;
  services: string[];
  notes: string | null;
  createdAt: string;
  contract?: ClientContractData | null;
  socialAccounts?: SocialAccountData[];
  health?: ClientHealthData | null;
  assignments?: ClientAssignmentData[];
  deliverables?: DeliverableData[];
  creatorAssignments?: Array<{
    id: string;
    creator: CreatorData;
    scheduledDate: string | null;
    deliverableId: string | null;
    status?: AssignmentStatus;
    deliverable?: {
      id: string;
      idea: string;
      format: string | null;
      platform: string | null;
    } | null;
  }>;
  messages?: MessageData[];
  _count?: {
    deliverables: number;
    messages: number;
  };
}

export interface MessageData {
  id: string;
  clientId: string;
  senderId: string | null;
  body: string;
  createdAt: string;
  sender?: UserSummary | null;
}

export interface GoalData {
  id: string;
  periodType: string;
  periodValue: string;
  metric: string;
  target: number;
  actual?: number;
  progressPercent?: number;
  hit?: boolean;
}

export interface InvoiceData {
  id: string;
  clientId: string;
  clientName?: string;
  client?: {
    id?: string;
    name: string;
    location?: string | null;
    contactName?: string | null;
    contactEmail?: string | null;
    contactPhone?: string | null;
    industry?: string | null;
    services?: string[];
  } | null;
  number: string;
  issueDate: string;
  dueDate: string | null;
  periodLabel: string | null;
  subtotal: number;
  vatRate: number;
  total: number;
  status: InvoiceStatus;
  notes: string | null;
  createdBy: string | null;
  createdAt: string;
  paidAmount?: number;
}

export interface PaymentData {
  id: string;
  invoiceId: string;
  amount: number;
  paidAt: string;
  method: PaymentMethod;
  reference: string | null;
}

export interface ExpenseData {
  id: string;
  date: string;
  amount: number;
  category: ExpenseCategory;
  description: string | null;
  clientId: string | null;
  clientName?: string | null;
  partnerId: string | null;
  partnerName?: string | null;
  assignmentId: string | null;
  recurring: boolean;
  recurrence: 'monthly' | 'yearly' | null;
  receiptUrl: string | null;
  createdBy: string | null;
  createdAt: string;
}

export interface DashboardMetrics {
  periodValue: string;
  isAdmin: boolean;
  revenue: {
    actual: number;
    target: number;
    percent: number;
  } | null;
  profit: {
    actual: number;
    target: number;
    percent: number;
  } | null;
  expenses: number | null;
  outstanding: number | null;
  overdue: number | null;
  mrr: number | null;
  deliverables: {
    actual: number;
    target: number;
    percent: number;
  };
  newClients: {
    actual: number;
    target: number;
    percent: number;
  };
  retention: {
    actual: number;
    target: number;
    percent: number;
  };
  views: {
    actual: number;
    target: number;
    percent: number;
  };
  pipelineBreakdown: Record<ClientStatus, number>;
  totalClients: number;
}

export interface EngagementSummary {
  views: number;
  likes: number;
  comments: number;
  shares: number;
  saves: number;
  reach: number;
  impressions: number;
  followersGained: number;
  engagementRate: number;
  posts: number;
}

export interface FinanceSummary {
  period: string;
  revenueReceived: number;
  invoiced: number;
  outstanding: number;
  overdue: number;
  expenses: number;
  profit: number;
  margin: number;
  mrr: number;
  expensesByCategory: Record<string, number>;
  monthlySeries: Array<{
    month: string;
    revenue: number;
    expenses: number;
    profit: number;
  }>;
  clientProfitability: Array<{
    clientId: string;
    name: string;
    revenue: number;
    expenses: number;
    profit: number;
  }>;
}

export interface ContentIdea {
  title: string;
  hook: string;
  format: DeliverableFormat;
  platform: Platform;
  whyItFits: string;
  scriptOutline: string;
}
