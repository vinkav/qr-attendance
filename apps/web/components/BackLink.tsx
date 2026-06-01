import Link from "next/link";

export function BackLink({ href, label = "← Назад" }: { href: string; label?: string }) {
  return (
    <Link
      href={href}
      className="btn btn-secondary"
      style={{ display: "inline-flex", marginBottom: "1rem", textDecoration: "none" }}
    >
      {label}
    </Link>
  );
}
