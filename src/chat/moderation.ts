/// Lightweight auto-moderation for halal-mode chat. A message whose text hits
/// the flagged-word list is stored with `flagged=true` and a `message:flagged`
/// event is emitted so the dashboard can review it. The message is NOT blocked
/// — flagging is a soft signal for moderators.
///
/// The list is intentionally conservative (solicitation / off-platform / overtly
/// inappropriate). Extend or move to the DB if the dashboard needs to edit it.
const FLAGGED_PATTERNS: RegExp[] = [
  /\bwhats\s?app\b/i,
  /\bsnap\s?chat\b/i,
  /\binsta\s?gram\b/i,
  /\btelegram\b/i,
  /\bsend\s+(me\s+)?(your\s+)?(nudes?|pics?)\b/i,
  /\bnude(s)?\b/i,
  /\bsex\b/i,
  /\bmeet\s+(up\s+)?(alone|tonight)\b/i,
  // bare phone number (7+ consecutive digits)
  /\b\d{7,}\b/,
];

export function containsFlaggedWord(text: string): boolean {
  return FLAGGED_PATTERNS.some((re) => re.test(text));
}
