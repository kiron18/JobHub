export const config = {
  matcher: ['/((?!not-available|_vercel|favicon\\.ico).*)'],
};

export default function middleware(request: Request) {
  const country = request.headers.get('x-vercel-ip-country');
  // No header means local dev or non-Vercel environment — allow through
  if (!country || country === 'AU') return;
  return Response.redirect(new URL('/not-available', request.url), 302);
}
