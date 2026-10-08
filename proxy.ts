import { NextResponse, type NextRequest } from "next/server";
// Local-first milestone: no auth requests or backend connections.
// Supabase integration is retained in lib/supabase for the next milestone.
export function proxy(request: NextRequest) {
  return NextResponse.next({ request });
}
export const config = {
  matcher: [
    "/dashboard",
    "/transactions",
    "/accounts",
    "/plan",
    "/goals",
    "/analytics",
    "/profile",
  ],
};
