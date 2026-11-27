import { useState, useCallback } from "react";
import { useSignIn, useClerk } from "@clerk/react";

/**
 * Headless 1-click Google OAuth helper using Clerk Core 3 without rendering Clerk UI widgets.
 */
export function useGoogleSignIn() {
  const { signIn, fetchStatus } = useSignIn();
  const { signOut } = useClerk();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isLoaded = Boolean(signIn);

  const signInWithGoogle = useCallback(
    async (redirectComplete = "/check") => {
      if (!signIn) return;
      setLoading(true);
      setError(null);
      try {
        const res = await signIn.sso({
          strategy: "oauth_google",
          redirectUrl: redirectComplete,
          redirectCallbackUrl: "/sso-callback",
        });
        if (res?.error) {
          setError(res.error.message || "Could not sign in with Google.");
          setLoading(false);
        }
      } catch (err: unknown) {
        const message =
          (err as { message?: string })?.message ||
          "Could not start Google sign-in. Please try again.";
        console.error("Google OAuth failed:", err);
        setError(message);
        setLoading(false);
      }
    },
    [signIn]
  );

  return {
    signInWithGoogle,
    signOut,
    isLoaded,
    loading: loading || fetchStatus === "fetching",
    error,
  };
}
