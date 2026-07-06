import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { RouterProvider } from "react-router";
import { router } from "../routes";
import { useEffect } from "react";
import { initAuthListener } from "../features/auth/api/authApi";
import { TooltipProvider } from "../components/ui/tooltip";
import { Toaster } from "react-hot-toast";

const queryClient = new QueryClient();

export function Providers() {
  useEffect(() => {
    // Initialize dark mode as default
    if (!document.documentElement.classList.contains('dark') && !document.documentElement.classList.contains('light')) {
      document.documentElement.classList.add("dark");
    }
    const unsubscribe = initAuthListener();
    return () => unsubscribe();
  }, []);

  return (
    <TooltipProvider>
      <QueryClientProvider client={queryClient}>
        <RouterProvider router={router} />
        <Toaster
          position="bottom-right"
          toastOptions={{
            duration: 3500,
            style: {
              background: "var(--background)",
              color: "var(--foreground)",
              border: "1px solid var(--border)",
            },
            success: {
              iconTheme: {
                primary: "var(--primary)",
                secondary: "var(--primary-foreground)",
              },
            },
            error: {
              iconTheme: {
                primary: "var(--destructive)",
                secondary: "var(--destructive-foreground)",
              },
            },
          }}
        />
      </QueryClientProvider>
    </TooltipProvider>
  );
}
