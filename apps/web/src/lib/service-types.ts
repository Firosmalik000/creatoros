export type ServicePackage = {
  id?: string;
  name: string;
  description: string;
  price_minor: number;
  currency: "IDR" | "MYR" | "USD";
  delivery_days: number;
  revision_limit: number;
  sort_order: number;
};

export type CreatorService = {
  id: string;
  creator_slug: string;
  creator_display_name: string;
  slug: string;
  title: string;
  description: string;
  status: "draft" | "published";
  packages: ServicePackage[];
  published_at: string | null;
  created_at: string;
  updated_at: string;
};

export type ServiceEnvelope<T> = { data: T };
