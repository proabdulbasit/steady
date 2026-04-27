"use client";

import { AppChrome } from "../components/steady-ui";
import { SteadyProvider } from "../components/steady-provider";

export default function Providers({ children }) {
  return (
    <SteadyProvider>
      <AppChrome>{children}</AppChrome>
    </SteadyProvider>
  );
}
