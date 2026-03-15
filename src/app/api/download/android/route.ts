import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  return NextResponse.redirect(new URL('/apk/SplitMate.apk', request.url), 302)
}
