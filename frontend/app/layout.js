import "./globals.css";
import "@xyflow/react/dist/style.css";

export const metadata = {
  title: "Orbit — Semantic Canvas",
  description: "Drop content, watch it orbit. A spatial canvas where AI organizes your research by meaning.",
  keywords: ["AI", "canvas", "semantic search", "Claude", "spatial UI"],
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
