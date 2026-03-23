import { useContext, useEffect } from "react";
import { ThemeProvider as NextThemesProvider } from "next-themes";
import { type ThemeProviderProps } from "next-themes/dist/types";
import { supabase } from "@/integrations/supabase/client";

// Import the context directly to avoid the throwing useAuth hook
import { useAuth } from "@/components/auth/AuthProvider";

function ThemeSync() {
  let user = null;
  try {
    const authContext = useAuth();
    user = authContext?.user;
  } catch {
    // AuthProvider not yet mounted, skip theme sync
  }

  useEffect(() => {
    const loadUserTheme = async () => {
      if (!user) return;

      try {
        const { data, error } = await supabase
          .from("profiles")
          .select("theme_preference")
          .eq("user_id", user.id)
          .maybeSingle();

        if (error) throw error;

        if (data?.theme_preference) {
          const root = window.document.documentElement;
          const systemTheme = window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
          const themeToApply = data.theme_preference === "system" ? systemTheme : data.theme_preference;
          
          root.classList.remove("light", "dark");
          root.classList.add(themeToApply);
        }
      } catch (error) {
        console.error("Error loading theme preference:", error);
      }
    };

    loadUserTheme();
  }, [user]);

  return null;
}

export function ThemeProvider({ children, ...props }: ThemeProviderProps) {
  return (
    <NextThemesProvider {...props}>
      <ThemeSync />
      {children}
    </NextThemesProvider>
  );
}
