import "@fontsource-variable/onest";
import "@fontsource-variable/unbounded";
import "./index.css";
import { ThemeProvider } from "next-themes";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router";
import { App } from "@/App";
import { AuthProvider } from "@/auth";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
      <TooltipProvider delayDuration={300}>
        <AuthProvider>
          <BrowserRouter>
            <App />
          </BrowserRouter>
        </AuthProvider>
        {/* mobileOffset : au-dessus de la barre d'onglets du téléphone. */}
        <Toaster position="bottom-right" mobileOffset={{ bottom: "calc(5.5rem + env(safe-area-inset-bottom))" }} />
      </TooltipProvider>
    </ThemeProvider>
  </StrictMode>,
);
