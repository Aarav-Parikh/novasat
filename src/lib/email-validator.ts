// Lightweight client-side email deliverability check.
// Uses Google's public DNS-over-HTTPS to confirm the domain has MX records.
// Not perfect (won't catch fake mailboxes), but rejects obvious junk like foo@qwerty.zz.

const BASIC_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function checkEmailDeliverable(email: string): Promise<{ ok: boolean; reason?: string }> {
  const trimmed = email.trim().toLowerCase();
  if (!BASIC_RE.test(trimmed)) return { ok: false, reason: "That doesn't look like a valid email." };
  const domain = trimmed.split("@")[1];
  if (!domain || domain.length < 3) return { ok: false, reason: "Invalid email domain." };

  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 4000);
    const res = await fetch(`https://dns.google/resolve?name=${encodeURIComponent(domain)}&type=MX`, {
      signal: controller.signal,
    });
    clearTimeout(timer);
    if (!res.ok) return { ok: true }; // fail open if DNS lookup itself fails
    const json = await res.json();
    const hasMx = Array.isArray(json.Answer) && json.Answer.some((a: any) => a.type === 15);
    if (!hasMx) return { ok: false, reason: "That email domain doesn't accept mail." };
    return { ok: true };
  } catch {
    return { ok: true }; // network failure -> don't block signup
  }
}
