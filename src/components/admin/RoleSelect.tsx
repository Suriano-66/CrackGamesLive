"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function RoleSelect({
  userId,
  role,
  disabled,
}: {
  userId: string;
  role: string;
  disabled?: boolean;
}) {
  const router = useRouter();
  const [value, setValue] = useState(role);
  const [saving, setSaving] = useState(false);

  async function onChange(next: string) {
    const previous = value;
    setValue(next);
    setSaving(true);
    const res = await fetch("/api/admin/users", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId, role: next }),
    });
    setSaving(false);
    if (!res.ok) {
      setValue(previous);
      const data = await res.json().catch(() => ({}));
      alert(data.error ?? "Impossible de changer le rôle.");
      return;
    }
    router.refresh();
  }

  return (
    <select
      className="role-select"
      value={value}
      disabled={disabled || saving}
      onChange={(e) => onChange(e.target.value)}
      title={disabled ? "Tu ne peux pas modifier ton propre rôle" : undefined}
    >
      <option value="user">Membre</option>
      <option value="support">Support</option>
      <option value="admin">Admin</option>
    </select>
  );
}
