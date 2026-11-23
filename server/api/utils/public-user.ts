/** EventLink's own promotional account: its address is public anyway. */
export const EVENTLINK_PROMOTIONAL_EMAIL = "eventlink@eventlink.one";

interface UserRow {
  id: number;
  role: string | null;
  first_name?: string | null;
  last_name?: string | null;
  profile_photo_url?: string | null;
  email?: string | null;
}

/**
 * What GET /api/users/:id may show anyone, signed in or not. An allow-list,
 * so a new column on users (a token, a Stripe id, an email) never leaks by
 * default. The email is only included for EventLink's own account, which
 * the profile page needs to recognise.
 */
export function publicUserView(user: UserRow) {
  const isPromotional = user.email?.toLowerCase() === EVENTLINK_PROMOTIONAL_EMAIL;
  return {
    id: user.id,
    role: user.role,
    first_name: user.first_name ?? null,
    last_name: user.last_name ?? null,
    profile_photo_url: user.profile_photo_url ?? null,
    ...(isPromotional ? { email: user.email } : {}),
  };
}
