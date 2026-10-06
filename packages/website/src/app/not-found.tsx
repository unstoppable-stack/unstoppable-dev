import Link from "next/link";
import { ArrowRight } from "lucide-react";

export default function NotFound() {
  return (
    <div className="mx-auto flex min-h-[65vh] max-w-3xl flex-col items-center justify-center px-4 py-20 text-center">
      <p className="eyebrow">404</p>
      <h1 className="text-4xl font-bold tracking-tight md:text-5xl">That page is not in this preview.</h1>
      <p className="mt-5 max-w-xl leading-7 text-text-secondary">The link may be old, or the guide may have moved into the task-based documentation.</p>
      <div className="mt-8 flex flex-col gap-3 sm:flex-row"><Link href="/docs" className="button-primary">Browse documentation <ArrowRight className="h-4 w-4" /></Link><Link href="/" className="button-secondary">Return home</Link></div>
    </div>
  );
}
