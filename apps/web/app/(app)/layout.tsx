import Link from "next/link";
import { requireOrgContext } from "@/lib/session";
import { logoutAction } from "../(auth)/actions";

const ADMIN_NAV = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/employees", label: "Employees" },
  { href: "/calendar", label: "Calendar" },
  { href: "/reports", label: "Reports" },
  { href: "/notifications", label: "Notifications" },
];

const OWNER_ONLY_NAV = [
  { href: "/audit-log", label: "Audit Log" },
  { href: "/settings/organization", label: "Settings" },
];

const EMPLOYEE_NAV = [
  { href: "/profile", label: "My Profile" },
  { href: "/notifications", label: "Notifications" },
];

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const ctx = await requireOrgContext();
  const isAdmin = ctx.role === "owner" || ctx.role === "office_manager";
  const navItems = isAdmin
    ? [...ADMIN_NAV, ...(ctx.role === "owner" ? OWNER_ONLY_NAV : [])]
    : EMPLOYEE_NAV;

  return (
    <div className="flex min-h-screen">
      <aside className="w-60 shrink-0 border-r border-slate-200 bg-white">
        <div className="border-b border-slate-200 px-4 py-4">
          <p className="truncate text-sm font-semibold text-slate-900">{ctx.organizationName}</p>
          <p className="text-xs text-slate-500">
            {ctx.role === "owner" ? "Owner" : ctx.role === "office_manager" ? "Office Manager" : "Employee"}
          </p>
        </div>
        <nav className="flex flex-col gap-1 p-3">
          {navItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="rounded-md px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 hover:text-slate-900"
            >
              {item.label}
            </Link>
          ))}
        </nav>
        <form action={logoutAction} className="border-t border-slate-200 p-3">
          <button type="submit" className="w-full rounded-md px-3 py-2 text-left text-sm text-slate-500 hover:bg-slate-100">
            Sign out
          </button>
        </form>
      </aside>
      <main className="flex-1 bg-slate-50 p-6">{children}</main>
    </div>
  );
}
