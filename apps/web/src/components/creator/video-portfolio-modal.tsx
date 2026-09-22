"use client";

import { Play, X, Film, ExternalLink } from "lucide-react";
import { useEffect, useState } from "react";
import type { PortfolioItem } from "@/lib/creator-types";

type Props = {
  items: PortfolioItem[];
  labels: {
    playVideo: string;
    closeVideo: string;
    videoSample: string;
  };
};

export function VideoPortfolioModal({ items, labels }: Props) {
  const [selectedItem, setSelectedItem] = useState<PortfolioItem | null>(null);

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setSelectedItem(null);
      }
    }
    if (selectedItem) {
      document.body.style.overflow = "hidden";
      window.addEventListener("keydown", handleKeyDown);
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [selectedItem]);

  if (!items || items.length === 0) {
    return null;
  }

  function isDirectVideo(url: string) {
    return (
      url.endsWith(".mp4") ||
      url.endsWith(".webm") ||
      url.endsWith(".ogg") ||
      url.includes("/sample/")
    );
  }

  function isYouTube(url: string) {
    return url.includes("youtube.com") || url.includes("youtu.be");
  }

  function getYouTubeEmbed(url: string) {
    let videoId = "";
    if (url.includes("youtu.be/")) {
      videoId = url.split("youtu.be/")[1]?.split("?")[0] ?? "";
    } else if (url.includes("v=")) {
      videoId = url.split("v=")[1]?.split("&")[0] ?? "";
    }
    return videoId ? `https://www.youtube.com/embed/${videoId}?autoplay=1` : url;
  }

  return (
    <>
      <div className="portfolio-video-grid">
        {items.map((item, index) => {
          const thumbnail =
            item.thumbnail_url ||
            "https://images.unsplash.com/photo-1511707171634-5f897ff02aa9?auto=format&fit=crop&w=600&q=80";
          return (
            <article
              key={item.id ?? `${item.title}-${index}`}
              className="portfolio-video-card"
            >
              <button
                type="button"
                className="portfolio-video-card__visual"
                onClick={() => setSelectedItem(item)}
                aria-label={`${labels.playVideo}: ${item.title}`}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={thumbnail}
                  alt=""
                  loading="lazy"
                  className="portfolio-video-card__thumb"
                />
                <div className="portfolio-video-card__overlay">
                  <span className="portfolio-video-card__play-btn">
                    <Play size={20} fill="currentColor" aria-hidden="true" />
                  </span>
                  <span className="portfolio-video-card__badge">
                    <Film size={12} aria-hidden="true" />
                    4K Reel
                  </span>
                </div>
              </button>
              <div className="portfolio-video-card__content">
                <h3>
                  <button
                    type="button"
                    onClick={() => setSelectedItem(item)}
                    className="portfolio-video-card__title-btn"
                  >
                    {item.title}
                  </button>
                </h3>
                {item.description ? (
                  <p className="portfolio-video-card__desc">{item.description}</p>
                ) : null}
              </div>
            </article>
          );
        })}
      </div>

      {selectedItem ? (
        <div
          className="video-modal-backdrop"
          role="dialog"
          aria-modal="true"
          aria-label={selectedItem.title}
          onClick={(e) => {
            if (e.target === e.currentTarget) setSelectedItem(null);
          }}
        >
          <div className="video-modal-dialog">
            <div className="video-modal-header">
              <div>
                <span className="video-modal-tag">{labels.videoSample}</span>
                <h3 className="video-modal-title">{selectedItem.title}</h3>
              </div>
              <button
                type="button"
                className="video-modal-close"
                onClick={() => setSelectedItem(null)}
                aria-label={labels.closeVideo}
              >
                <X size={20} aria-hidden="true" />
              </button>
            </div>

            <div className="video-modal-player">
              {isDirectVideo(selectedItem.media_url) ? (
                <video
                  src={selectedItem.media_url}
                  controls
                  autoPlay
                  playsInline
                  className="video-modal-video"
                >
                  Your browser does not support HTML5 video.
                </video>
              ) : isYouTube(selectedItem.media_url) ? (
                <iframe
                  src={getYouTubeEmbed(selectedItem.media_url)}
                  title={selectedItem.title}
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                  className="video-modal-iframe"
                />
              ) : (
                <div className="video-modal-fallback">
                  <p>{selectedItem.description}</p>
                  <a
                    href={selectedItem.media_url}
                    target="_blank"
                    rel="noreferrer"
                    className="button button--signal"
                  >
                    Open External Media <ExternalLink size={16} aria-hidden="true" />
                  </a>
                </div>
              )}
            </div>

            {selectedItem.description ? (
              <p className="video-modal-caption">{selectedItem.description}</p>
            ) : null}
          </div>
        </div>
      ) : null}
    </>
  );
}
