import Link from "next/link";
import { ArrowRight, BookOpen } from "lucide-react";
import { docsNav, type DocBlock, type DocPage } from "@/lib/docs";
import { CodeBlock } from "@/components/code-block";
import { GettingStartedCards } from "@/components/getting-started-cards";
import { siteConfig } from "@/lib/release";

function headingId(text: string) {
  return text.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
}

// The docs support only explicit inline code and emphasis; prose stays plain text.
function DocText({ text }: { text: string }) {
  return text.split(/(`[^`]+`|\*\*[^*]+\*\*)/g).map((part, index) => {
    if (part.startsWith("`") && part.endsWith("`")) {
      return <code key={index} className="doc-inline-code">{part.slice(1, -1)}</code>;
    }
    if (part.startsWith("**") && part.endsWith("**")) {
      return <strong key={index} className="font-semibold text-text-primary"><DocText text={part.slice(2, -2)} /></strong>;
    }
    return part;
  });
}

function DocBlockView({ block }: { block: DocBlock }) {
  if (block.type === "start-paths") return <GettingStartedCards />;

  if (block.type === "actions") {
    return <div className="flex flex-wrap items-center gap-3">{block.items.map((item) => <a key={item.href} href={item.href} download={item.download || undefined} className={item.download ? "button-primary" : "button-secondary"}>{item.label}<ArrowRight aria-hidden="true" className="h-4 w-4" /></a>)}</div>;
  }

  if (block.type === "lead") {
    return <p className="border-l-2 border-accent/60 pl-5 text-lg leading-8 text-slate-200"><DocText text={block.text} /></p>;
  }

  if (block.type === "heading") {
    return (
      <h2 className="mt-12 border-t border-border pt-8 text-2xl font-semibold tracking-tight">
        <span id={headingId(block.text)} className="scroll-mt-24" />
        {block.text}
      </h2>
    );
  }

  if (block.type === "paragraph") {
    return <p className="doc-copy leading-8"><DocText text={block.text} /></p>;
  }

  if (block.type === "list") {
    return (
      <ul className="space-y-3">
        {block.items.map((item) => (
          <li key={item} className="doc-copy flex gap-3 leading-7">
            <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-accent" />
            <span className="min-w-0"><DocText text={item} /></span>
          </li>
        ))}
      </ul>
    );
  }

  if (block.type === "steps") {
    return (
      <div className="space-y-5">
        {block.items.map((item, index) => (
          <div key={item.title} className="rounded-2xl border border-border bg-surface p-5">
            <div className="mb-3 flex items-center gap-3">
              <span className="flex h-7 w-7 items-center justify-center rounded-full bg-accent text-sm font-bold text-background">
                {index + 1}
              </span>
              <h3 className="font-semibold">{item.title}</h3>
            </div>
            <p className="doc-copy text-sm leading-7"><DocText text={item.body} /></p>
            {item.code ? (
              <div className="mt-4"><CodeBlock code={item.code} language={item.language || "bash"} /></div>
            ) : null}
          </div>
        ))}
      </div>
    );
  }

  if (block.type === "code") {
    return (
      <CodeBlock code={block.code} language={block.language} />
    );
  }

  if (block.type === "callout") {
    return (
      <div className="rounded-2xl border border-accent/20 bg-accent/10 p-5">
        <h3 className="mb-2 font-semibold text-accent">{block.title}</h3>
        <p className="doc-copy text-sm leading-7"><DocText text={block.body} /></p>
      </div>
    );
  }

  if (block.type === "cards") {
    return (
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {block.items.map((item) => {
          const card = (
            <div className="h-full rounded-2xl border border-border bg-surface p-5 transition-colors hover:border-border-light hover:bg-surface-light">
              <h3 className="mb-2 font-semibold">{item.title}</h3>
              <p className="doc-copy text-sm leading-7"><DocText text={item.body} /></p>
              {item.href ? (
                <span className="mt-4 inline-flex items-center gap-2 text-sm font-medium text-accent">
                  Read more <ArrowRight className="h-4 w-4" />
                </span>
              ) : null}
            </div>
          );

          return item.href ? (
            <Link key={item.title} href={item.href}>
              {card}
            </Link>
          ) : (
            <div key={item.title}>{card}</div>
          );
        })}
      </div>
    );
  }
}

export function DocsShell({ page }: { page: DocPage }) {
  const headings = page.blocks.filter((block) => block.type === "heading");
  const navigation = (
    <nav aria-label="Documentation" className="space-y-6">
      {docsNav.map((section) => {
        const links = (
          <div className="space-y-1">
            {section.pages.map((item) => {
              const active = item.slug === page.slug;
              return <Link key={item.slug || "overview"} href={item.slug ? `/docs/${item.slug}` : "/docs"} aria-current={active ? "page" : undefined} className={`block rounded-lg px-3 py-2 text-sm transition-colors ${active ? "bg-accent/10 text-accent" : "text-text-secondary hover:bg-surface hover:text-text-primary"}`}>{item.title}</Link>;
            })}
          </div>
        );
        if (section.title === "Library reference") {
          return <details key={section.title} open={section.pages.some((item) => item.slug === page.slug)} className="rounded-lg border border-border p-3"><summary className="cursor-pointer text-xs font-semibold uppercase tracking-wider text-text-muted">Library reference</summary><div className="mt-3">{links}</div></details>;
        }
        return <div key={section.title}>
          <h2 className="mb-2 text-xs font-semibold uppercase tracking-wider text-text-muted">{section.title}</h2>
          {links}
        </div>;
      })}
    </nav>
  );

  return (
    <div className="relative">
      <div className="absolute inset-x-0 top-0 -z-10 h-80 bg-[radial-gradient(ellipse_at_top,_rgba(0,212,170,0.08)_0%,_transparent_55%)]" />
      <div className="mx-auto grid max-w-7xl grid-cols-1 gap-10 px-4 py-12 sm:px-6 lg:grid-cols-[260px_1fr] lg:px-8 lg:py-16">
        <aside className="lg:sticky lg:top-24 lg:h-[calc(100vh-7rem)] lg:overflow-y-auto">
          <div className="mb-4 flex items-center gap-2 text-sm font-semibold text-text-primary">
            <BookOpen className="h-4 w-4 text-accent" />
            Docs
          </div>
          <details className="rounded-xl border border-border bg-surface p-4 lg:hidden"><summary className="cursor-pointer text-sm font-medium">Browse documentation</summary><div className="mt-5">{navigation}</div></details>
          <div className="hidden lg:block">{navigation}</div>
        </aside>

        <article className="min-w-0 max-w-3xl">
          <div className="mb-10">
            <p className="mb-3 text-sm font-medium text-accent">{page.category}</p>
            <h1 className="mb-4 text-4xl font-bold tracking-tight md:text-5xl">
              {page.title}
            </h1>
            <p className="text-lg leading-8 text-text-secondary">
              {page.description}
            </p>
            <p className="mt-3 text-xs text-text-muted">Content reviewed {page.verifiedOn}</p>
          </div>
          {headings.length > 1 ? (
            <nav aria-label="On this page" className="mb-10 rounded-2xl border border-border bg-surface p-5">
              <h2 className="mb-3 text-sm font-semibold">On this page</h2>
              <ul className="grid gap-2 sm:grid-cols-2">
                {headings.map((heading) => (
                  <li key={heading.text}>
                    <a href={`#${headingId(heading.text)}`} className="text-sm text-accent underline-offset-4 hover:underline">{heading.text}</a>
                  </li>
                ))}
              </ul>
            </nav>
          ) : null}
          <div className="space-y-7">{page.blocks.map((block, index) => <DocBlockView key={index} block={block} />)}</div>
          <div className="mt-14 border-t border-border pt-7 text-sm text-text-muted">Need help? <a href={siteConfig.publicIssuesUrl} className="text-accent underline underline-offset-4">Report an issue</a> with your CLI version, platform, command and first relevant error.</div>
        </article>
      </div>
    </div>
  );
}
