import { useEffect, useRef } from "react";
import { useAuth, useUser } from "@clerk/react";
import { useAuthStore } from "@/store/useAuthStore";
import { httpLotteryApi } from "@/lib/api";

/**
 * Headless bridge component mounted inside <ClerkProvider>.
 * Keeps Zustand auth state, Clerk JWT token provider, and Postgres profile/ticket sync up to date.
 */
export function ClerkAuthSync() {
  const { isLoaded, isSignedIn, userId, getToken } = useAuth();
  const { user } = useUser();
  const { setSession, setLoaded, bumpSyncVersion } = useAuthStore();
  const syncedUserRef = useRef<string | null>(null);

  // Register live Bearer token provider synchronously whenever auth changes
  useEffect(() => {
    if (!isLoaded) return;

    if (isSignedIn && userId) {
      httpLotteryApi.setTokenGetter(() => getToken());
    } else {
      httpLotteryApi.setTokenGetter(null);
      syncedUserRef.current = null;
    }
  }, [isLoaded, isSignedIn, userId, getToken]);

  // Sync Clerk user profile & migrate any guest localStorage checks to Postgres
  useEffect(() => {
    if (!isLoaded) return;

    if (!isSignedIn || !userId) {
      setSession({ user: null, isAuthenticated: false });
      setLoaded(true);
      return;
    }

    const name =
      user?.fullName ||
      user?.firstName ||
      user?.primaryEmailAddress?.emailAddress?.split("@")[0] ||
      "Google User";
    const email = user?.primaryEmailAddress?.emailAddress || "";
    const avatarUrl = user?.imageUrl || "";

    setSession({
      user: {
        id: userId,
        name,
        email,
        avatarUrl,
      },
      isAuthenticated: true,
    });
    setLoaded(true);

    if (syncedUserRef.current !== userId && user) {
      syncedUserRef.current = userId;
      (async () => {
        try {
          httpLotteryApi.setTokenGetter(() => getToken());
          await httpLotteryApi.syncProfile({ email, name, avatarUrl });
          await httpLotteryApi.syncGuestTicketsToCloud();
          bumpSyncVersion();
        } catch (err) {
          console.warn("Failed to sync profile/tickets with Postgres:", err);
        }
      })();
    }
  }, [isLoaded, isSignedIn, userId, user, getToken, setSession, setLoaded, bumpSyncVersion]);

  return null;
}
