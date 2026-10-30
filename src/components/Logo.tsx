import Link from "next/link";

/** Původní logo Play Haven. */
export default function Logo() {
  return (
    <Link href="/" className="flex shrink-0 items-center gap-3" aria-label="Play Haven">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/brand/logo-mark.png" alt="" className="h-9 w-auto" />
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/brand/logo-wordmark.png" alt="Play Haven" className="hidden h-3 w-auto sm:block" />
    </Link>
  );
}
