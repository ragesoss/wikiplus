# Design — a signed-in skin toggle survives reload

**Lane:** Heavy by touch (the Auth.js `jwt` callback), minimal by size. **Owner report:** "my
light/dark skin preference isn't sticking… on page refresh I'm back to dark" (signed in).

## Cause

The session's `skinPreference` is stamped into the stateless JWT once, at sign-in. `SkinSync`
mirrors it DB→cookie "once per session", but its guard is a React ref — it resets on every page
load. So after a signed-in toggle (cookie + DB = new skin, JWT = old skin), each reload re-mirrors
the stale JWT value over the cookie.

## Contract

1. **The toggle keeps the session truthful.** A signed-in toggle re-signs the JWT with the new skin
   by POSTing Auth.js's session-update endpoint (`/api/auth/session`, `{ csrfToken, data: {
   skinPreference } }` — the same request `update()` makes), so the session, cookie, and DB agree and
   the load-time mirror is a no-op. It does **not** call the provider's `update()`, which flips every
   `useSession()` consumer to `"loading"` for the round trip (header chip, `/contribute` form swap +
   lost focus). Calls are **serialized latest-wins**: a toggle made while one is in flight is sent
   when it lands, so the JWT always ends on the last choice. Fire-and-forget — never gates the flip.
   A toggle while the session is still `"loading"` also re-signs (a no-op without a session cookie).
2. **The `jwt` callback's `update` trigger accepts ONLY `skinPreference`,** and only a value in the
   closed skin set (`"zine"` | `"zine-dark"`); anything else is ignored. Identity/role claims
   (`contributorId`, `username`, `isModerator`) are never read from the client payload.
3. **No provider required.** The toggle reads the session via `SessionContext` (undefined outside a
   `SessionProvider` — logged-out / test renders simply skip the re-sign) rather than `useSession()`.
4. **Cross-device restore unchanged:** a cookieless login still mirrors the stored preference
   (AC6/AC7); a device whose cookie already matches is untouched.

## Verify

Signed-in: toggle dark→light, reload → stays light (cookie `zine`, session `zine`). Toggle again →
dark sticks. The `update` trigger with `isModerator: true` / `contributorId` / an unknown skin
changes nothing but a valid `skinPreference`.
