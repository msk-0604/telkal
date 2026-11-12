import { NextResponse, type NextRequest } from "next/server";

/**
 * 未ログインの画面アクセスをログイン画面へ振り分ける（Cookie の有無のみの簡易判定）。
 * セッションの有効性と企業の確定は、必ず Workers API 側で行う。
 */
export function proxy(request: NextRequest) {
  if (!request.cookies.has("telkal_session")) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.search = "";
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!api|login|_next/static|_next/image|favicon.ico|icon|apple-icon|manifest.webmanifest|.*\\.(?:png|svg|ico|webp)$).*)"],
};
