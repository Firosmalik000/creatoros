import { Activity, Clock } from "lucide-react";
import type { OrderEvent } from "@/lib/order-types";

type Labels = {
  title: string;
  empty: string;
  statuses: Record<string, string>;
};

type Props = {
  events: OrderEvent[];
  locale: string;
  labels: Labels;
};

export function OrderTimeline({ events, locale, labels }: Props) {
  return (
    <section className="order-timeline">
      <div className="order-timeline__header">
        <h3 className="order-timeline__title">
          <Activity size={18} aria-hidden="true" />
          {labels.title}
        </h3>
      </div>

      {events.length === 0 ? (
        <p className="order-timeline__empty">{labels.empty}</p>
      ) : (
        <ol className="order-timeline__list">
          {events.map((evt) => {
            const fromLabel =
              labels.statuses[evt.from_status] ?? evt.from_status;
            const toLabel = labels.statuses[evt.to_status] ?? evt.to_status;

            return (
              <li key={evt.id} className="order-timeline__item">
                <span className="order-timeline__bullet" aria-hidden="true" />
                <div className="order-timeline__content">
                  <div className="order-timeline__meta">
                    <strong>
                      {fromLabel === toLabel
                        ? toLabel
                        : `${fromLabel} → ${toLabel}`}
                    </strong>
                    <time dateTime={evt.created_at}>
                      <Clock size={13} aria-hidden="true" />
                      {new Date(evt.created_at).toLocaleString(locale)}
                    </time>
                  </div>
                  {evt.actor_name ? (
                    <span className="order-timeline__actor">
                      {evt.actor_name}
                    </span>
                  ) : null}
                  {evt.note ? (
                    <p className="order-timeline__note">{evt.note}</p>
                  ) : null}
                </div>
              </li>
            );
          })}
        </ol>
      )}
    </section>
  );
}
