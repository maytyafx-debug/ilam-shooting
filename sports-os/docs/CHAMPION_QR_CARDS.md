# Champion QR Cards

## Purpose
Issue a unique, scannable QR code for an athlete's public honour profile. The QR contains only an opaque random token, never personal data.

## Public allow-list
- Athlete display name
- Sport and athlete category
- Organization name
- Verified podium results (gold/silver/bronze), event title, discipline, date

Never expose date of birth, gender, phone, membership number, guardian details, insurance, financial data, private notes, or internal database IDs.

## Consent and lifecycle
- Publication is performed only by an authenticated tenant owner/admin.
- Active athletes only.
- Under-18 athletes and records with unknown birth date require current, unrevoked guardian consent with scope media.
- Revoking a card immediately makes the existing QR return not found.
- Reissuing a card rotates the random token; old QR links remain invalid.
- Results are read from the verified ledger only; pending/rejected results are never public.

## Rollout
1. Apply migration 013 only after backup and explicit production approval.
2. Confirm guardian media-consent records are current for minor athletes.
3. Issue cards from /athlete-cards.
4. Scan printed QR with a second device and verify only the allow-listed public fields.
5. Revoke a test card and verify its previous URL no longer resolves.

Migration is not applied automatically. No production SQL or deployment is performed by this change.
