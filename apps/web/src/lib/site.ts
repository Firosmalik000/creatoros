export const siteConfig = {
  name: "CreatorOS",
  description:
    "A managed creator marketplace for brands, creators, and agency teams.",
  origin: process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000",
} as const;

export const demoCreators = [
  {
    name: "Alya Pratama",
    handle: "@alyacooks",
    niche: "Food & Lifestyle",
    location: "Jakarta, Indonesia",
    followers: "82K",
    engagement: "6.4%",
    image: "/images/creator-alya.png",
  },
  {
    name: "Daniel Lim",
    handle: "@danieltries",
    niche: "Tech & Everyday Gear",
    location: "Kuala Lumpur, Malaysia",
    followers: "126K",
    engagement: "5.8%",
    image: "/images/creator-daniel.png",
  },
  {
    name: "Maya Santoso",
    handle: "@mayamoves",
    niche: "Travel & Visual Stories",
    location: "Bali, Indonesia",
    followers: "64K",
    engagement: "7.1%",
    image: "/images/creator-maya-v2.png",
  },
] as const;
