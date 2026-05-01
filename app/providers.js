"use client";

import { AppChrome } from "../components/steady-ui";
import { SteadyProvider } from "../components/steady-provider";
import { ThemeProvider } from "../components/theme-provider";

export default function Providers({ children }) {
  return (
    <ThemeProvider defaultTheme="light">
      <SteadyProvider>
        <AppChrome>{children}</AppChrome>
      </SteadyProvider>
    </ThemeProvider>
  );
}
