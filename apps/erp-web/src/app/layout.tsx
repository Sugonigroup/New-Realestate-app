import type { Metadata } from "next";
import { cookies } from "next/headers";
import "./globals.css";
import { AuthProvider, filterNav, parseJwtClaims, seededRolePermissions } from "@buildos/ui";
import { Shell } from "@/components/Shell";

export const metadata: Metadata = {
  title: "BuildOS ERP",
  description: "AI-operated construction ERP — system of record",
};

/**
 * App shell lives in the root layout: every authenticated route gets the
 * role-filtered sidebar (with active-route highlight). Login (no token)
 * renders children only.
 */
export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const token = (await cookies()).get("access_token")?.value;
  const user = parseJwtClaims(token);
  const nav = filterNav(user?.roles ?? [], seededRolePermissions());

  return (
    <html lang="en">
      <body>
        {token ? (
          <AuthProvider user={user}>
            <Shell nav={nav}>{children}</Shell>
          </AuthProvider>
        ) : (
          children
        )}
      </body>
    </html>
  );
}
