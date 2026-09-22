export type CatalogItem = { code: string; name: string };

export type SocialAccount = {
  platform_code: string;
  platform_name?: string;
  handle: string;
  profile_url: string;
  follower_count: number;
  average_views: number;
  engagement_bps: number;
};

export type PortfolioItem = {
  id?: string;
  title: string;
  description: string;
  media_url: string;
  thumbnail_url?: string;
  sort_order: number;
};

export type CreatorStats = {
  total_orders: number;
  completed_orders: number;
  completion_rate: number;
  rating_score: number;
  review_count: number;
};

export type CreatorProfile = {
  user_id: string;
  display_name: string;
  slug: string;
  headline: string;
  bio: string;
  city: string;
  country_code: string;
  avatar_url?: string;
  verification_status: string;
  submitted_at: string | null;
  reviewed_at: string | null;
  review_note?: string;
  categories: CatalogItem[];
  languages: string[];
  social_accounts: SocialAccount[];
  portfolio: PortfolioItem[];
  stats?: CreatorStats;
  complete?: boolean;
  missing_fields?: string[];
};

export type PublicCreatorProfile = Pick<
  CreatorProfile,
  | "display_name"
  | "slug"
  | "headline"
  | "bio"
  | "city"
  | "country_code"
  | "avatar_url"
  | "categories"
  | "languages"
  | "social_accounts"
  | "portfolio"
  | "stats"
>;

export type DirectoryCreator = {
  display_name: string;
  slug: string;
  headline: string;
  city: string;
  country_code: string;
  categories: CatalogItem[];
  languages: string[];
  followers: number;
  engagement_bps: number;
  cover_url?: string;
  is_favorite: boolean;
};

export type DirectoryResponse = {
  data: DirectoryCreator[];
  meta: { page: number; per_page: number; total: number };
};

export type CreatorCatalog = {
  platforms: CatalogItem[];
  categories: CatalogItem[];
};

export type CreatorReviewItem = {
  user_id: string;
  display_name: string;
  slug: string;
  headline: string;
  city: string;
  country_code: string;
  status: string;
  submitted_at: string | null;
  updated_at: string;
};

export type ApiEnvelope<T> = { data: T; meta?: Record<string, number> };
