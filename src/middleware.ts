import { NextResponse, type NextRequest } from "next/server";

// Optional: set APP_PASSWORD to put the owner dashboard behind HTTP Basic auth
// (any username). Client pay pages and their APIs stay public.
export function middleware(req: NextRequest) {
  const password = process.env.APP_PASSWORD;
  if (!password) return NextResponse.next();
  const header = req.headers.get("authorization") ?? "";
  if (header.startsWith("Basic ")) {
    const decoded = atob(header.slice(6));
    if (decoded.slice(decoded.indexOf(":") + 1) === password) return NextResponse.next();
  }
  return new NextResponse("Authentication required", {
    status: 401,
    headers: { "WWW-Authenticate": 'Basic realm="OneLine"' },
  });
}

export const config = {
  matcher: ["/((?!pay/|api/pay/|api/health|_next/|favicon|icon).*)"],
};
