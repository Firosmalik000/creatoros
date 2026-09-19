"use client";

import { ArrowUpRight, Check, Clock3, RefreshCw } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import type { ServicePackage } from "@/lib/service-types";

type Labels = {
  choose: string;
  delivery: string;
  deliveryValue: string;
  revisions: string;
  revisionValue: string;
  selected: string;
  continue: string;
};

export function PackageSelector({
  packages,
  locale,
  loginHref,
  labels,
}: {
  packages: ServicePackage[];
  locale: string;
  loginHref: string;
  labels: Labels;
}) {
  const [selected, setSelected] = useState(0);
  const current = packages[selected] ?? packages[0];
  const money = new Intl.NumberFormat(locale, {
    style: "currency",
    currency: current.currency,
    maximumFractionDigits: current.currency === "IDR" ? 0 : 2,
  });
  const price = current.price_minor / (current.currency === "IDR" ? 1 : 100);

  return (
    <div className="package-selector">
      <fieldset>
        <legend>{labels.choose}</legend>
        <div className="package-options">
          {packages.map((item, index) => (
            <label
              className={index === selected ? "is-selected" : ""}
              key={item.id ?? item.name}
            >
              <input
                checked={index === selected}
                name="service-package"
                onChange={() => setSelected(index)}
                type="radio"
              />
              <span className="package-option__check" aria-hidden="true">
                {index === selected ? <Check size={15} /> : null}
              </span>
              <span className="package-option__name">{item.name}</span>
              <strong>
                {new Intl.NumberFormat(locale, {
                  style: "currency",
                  currency: item.currency,
                  maximumFractionDigits: item.currency === "IDR" ? 0 : 2,
                }).format(
                  item.price_minor / (item.currency === "IDR" ? 1 : 100),
                )}
              </strong>
            </label>
          ))}
        </div>
      </fieldset>

      <div className="package-selection" aria-live="polite">
        <span>{labels.selected}</span>
        <h2>{current.name}</h2>
        {current.description ? <p>{current.description}</p> : null}
        <strong className="package-selection__price">
          {money.format(price)}
        </strong>
        <dl>
          <div>
            <dt>
              <Clock3 aria-hidden="true" size={17} /> {labels.delivery}
            </dt>
            <dd>
              {labels.deliveryValue.replace(
                "{count}",
                String(current.delivery_days),
              )}
            </dd>
          </div>
          <div>
            <dt>
              <RefreshCw aria-hidden="true" size={17} /> {labels.revisions}
            </dt>
            <dd>
              {labels.revisionValue.replace(
                "{count}",
                String(current.revision_limit),
              )}
            </dd>
          </div>
        </dl>
        <Link
          className="button button--signal"
          href={`${loginHref}?package=${encodeURIComponent(current.id ?? current.name)}`}
        >
          {labels.continue} <ArrowUpRight aria-hidden="true" size={18} />
        </Link>
      </div>
    </div>
  );
}
