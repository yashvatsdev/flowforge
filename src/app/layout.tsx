import type { Metadata } from "next";
import { Provider } from "@/lib/store";
import { MotionProvider } from "@/components/motion-provider";
import "./globals.css";
import "./feature-previews.css";
import "./refinement.css";
import "./surfaces.css";
import "@fontsource-variable/manrope";
import "@fontsource-variable/dm-sans";
import "@fontsource/ibm-plex-mono/400.css";
export const metadata: Metadata = {
  title: { default: "FlowForge — Make work flow.", template: "%s · FlowForge" },
  description:
    "A visual automation studio. Connect ideas, build workflows, and inspect every step. A frontend simulation with local browser storage.",
};
export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark" data-scroll-behavior="smooth">
      <body>
        <a className="skip-link" href="#main">
          Skip to content
        </a>
        <Provider>
          <MotionProvider>{children}</MotionProvider>
        </Provider>
      </body>
    </html>
  );
}
