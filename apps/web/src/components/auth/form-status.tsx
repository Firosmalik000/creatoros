import { AlertCircle, CheckCircle2 } from "lucide-react";

export function FormStatus({
  tone,
  children,
}: {
  tone: "error" | "success";
  children: React.ReactNode;
}) {
  const Icon = tone === "error" ? AlertCircle : CheckCircle2;
  return (
    <div className={`form-status form-status--${tone}`} role="status">
      <Icon aria-hidden="true" size={19} />
      <div>{children}</div>
    </div>
  );
}
