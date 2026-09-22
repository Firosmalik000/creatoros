import type { OrderStatus } from "@/lib/order-types";

type Props = {
  status: OrderStatus;
  label: string;
};

export function OrderStatusBadge({ status, label }: Props) {
  const modifier = status.replace(/_/g, "-");
  return (
    <span className={`order-status-badge order-status-badge--${modifier}`}>
      {label}
    </span>
  );
}
