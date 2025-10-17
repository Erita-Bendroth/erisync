import { useEffect, useState } from "react";
import { useAuth } from "@/components/auth/AuthProvider";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useTheme } from "next-themes";

type Theme = "light" | "dark" | "system";

export function useUserTheme() {
  const { user } = useAuth();
  const { toast } = useToast();
  const { setTheme: setNextTheme } = useTheme();
  const [theme, setThemeState] = useState<Theme>("system");
  const [isLoading, setIsLoading] = useState(true);

  // Fetch user's theme preference from database
  useEffect(() => {
    const fetchUserTheme = async () => {
      if (!user) {
        setIsLoading(false);
        return;
      }

      try {
        const { data, error } = await supabase
          .from("profiles")
          .select("theme_preference")
          .eq("user_id", user.id)
          .single();

        if (error) throw error;

        if (data?.theme_preference) {
          const userTheme = data.theme_preference as Theme;
          setThemeState(userTheme);
          setNextTheme(userTheme);
        }
      } catch (error) {
        console.error("Error fetching theme preference:", error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchUserTheme();
  }, [user, setNextTheme]);

  // Save theme preference to database
  const setTheme = async (newTheme: Theme) => {
    if (!user) {
      // For non-authenticated users, just update next-themes
      setNextTheme(newTheme);
      setThemeState(newTheme);
      return;
    }

    try {
      const { error } = await supabase
        .from("profiles")
        .update({ theme_preference: newTheme })
        .eq("user_id", user.id);

      if (error) throw error;

      setThemeState(newTheme);
      setNextTheme(newTheme);
    } catch (error) {
      console.error("Error saving theme preference:", error);
      toast({
        title: "Theme Update Failed",
        description: "Could not save your theme preference. Please try again.",
        variant: "destructive",
      });
    }
  };

  return { theme, setTheme, isLoading };
}
