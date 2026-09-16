import { BadgeCheck, MapPin } from "lucide-react";
import Image from "next/image";
import type { demoCreators } from "@/lib/site";

type Creator = (typeof demoCreators)[number];

export function CreatorCard({
  creator,
  verifiedLabel,
  followersLabel,
  engagementLabel,
}: {
  creator: Creator;
  verifiedLabel: string;
  followersLabel: string;
  engagementLabel: string;
}) {
  return (
    <article className="creator-card">
      <Image
        alt={`${creator.name}, ${creator.niche}`}
        className="creator-photo"
        height={1280}
        sizes="(max-width: 560px) calc(100vw - 24px), (max-width: 820px) 50vw, 33vw"
        src={creator.image}
        width={1024}
      />
      <div className="creator-info">
        <div className="creator-heading">
          <div>
            <h3>{creator.name}</h3>
            <p>{creator.handle}</p>
          </div>
          <span className="verified-badge" title={verifiedLabel}>
            <BadgeCheck aria-hidden="true" size={22} fill="currentColor" />
            <span className="sr-only">{verifiedLabel}</span>
          </span>
        </div>
        <p className="creator-niche">{creator.niche}</p>
        <p className="creator-location">
          <MapPin aria-hidden="true" size={15} />
          {creator.location}
        </p>
        <dl className="creator-metrics">
          <div>
            <dt>{followersLabel}</dt>
            <dd>{creator.followers}</dd>
          </div>
          <div>
            <dt>{engagementLabel}</dt>
            <dd>{creator.engagement}</dd>
          </div>
        </dl>
      </div>
    </article>
  );
}
