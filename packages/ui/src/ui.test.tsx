import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { DataTable } from "./DataTable.js";
import { AuthProvider, useCan, parseJwtClaims } from "./auth.js";

interface Row {
  unit: string;
  state: string;
}

const cols = [
  { accessorKey: "unit", header: "Unit" },
  { accessorKey: "state", header: "State" },
];

function tokenFor(roles: string[]): string {
  const b64 = (o: object) => Buffer.from(JSON.stringify(o)).toString("base64url");
  return `h.${b64({ sub: "u1", tenant: "t1", roles })}.sig`;
}

describe("DataTable (U0)", () => {
  it("renders rows and the empty state", () => {
    render(<DataTable<Row> data={[{ unit: "T1-101", state: "available" }]} columns={cols} />);
    expect(screen.getByText("T1-101")).toBeDefined();
    render(<DataTable<Row> data={[]} columns={cols} />);
    expect(screen.getByText("No rows")).toBeDefined();
  });
});

describe("auth context (U0)", () => {
  it("parses role claims from the session token", () => {
    const user = parseJwtClaims(tokenFor(["sales_manager"]));
    expect(user).toMatchObject({ userId: "u1", tenantId: "t1", roles: ["sales_manager"] });
    expect(parseJwtClaims(undefined)).toBeNull();
    expect(parseJwtClaims("garbage")).toBeNull();
  });

  it("useCan gates modules by role", () => {
    const token = tokenFor(["sales_manager"]);
    render(
      <AuthProvider user={parseJwtClaims(token)}>
        <CanProbe module="sales" />
        <CanProbe module="finance" />
      </AuthProvider>,
    );
    expect(screen.getByTestId("can-sales").textContent).toBe("yes");
    expect(screen.getByTestId("can-finance").textContent).toBe("no");
  });

  it("super admin can everywhere via **", () => {
    render(
      <AuthProvider user={parseJwtClaims(tokenFor(["super_admin"]))}>
        <CanProbe module="settings" />
      </AuthProvider>,
    );
    expect(screen.getByTestId("can-settings").textContent).toBe("yes");
  });
});

function CanProbe({ module }: { module: string }) {
  const can = useCan(module);
  return <span data-testid={`can-${module}`}>{can ? "yes" : "no"}</span>;
}
