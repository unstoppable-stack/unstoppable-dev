import Link from "next/link";
import { ArrowRight, BookOpen } from "lucide-react";
import { docsNav, type DocBlock, type DocPage } from "@/lib/docs";

function DocBlockView({ block }: { block: DocBlock }) {
  if (block.type === "lead") {
    return <p className="text-lg leading-8 text-text-secondary">{block.text}</p>;
  }

  if (block.type === "heading") {
    return (
      <h2 className="mt-12 border-t border-border pt-8 text-2xl font-semibold tracking-tight">
        {block.text}
      </h2>
    );
  }

  if (block.type === "paragraph") {
    return <p className="leading-7 text-text-secondary">{block.text}</p>;
  }

  if (block.type === "list") {
    return (
      <ul className="space-y-3">
        {block.items.map((item) => (
          <li key={item} className="flex gap-3 text-text-secondary">
            <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-accent" />
            <span>{item}</span>
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
            <p className="text-sm leading-6 text-text-secondary">{item.body}</p>
            {item.code ? (
              <pre className="mt-4 overflow-x-auto rounded-xl border border-border bg-background p-4 text-sm text-text-secondary">
                <code>{item.code}</code>
              </pre>
            ) : null}
          </div>
        ))}
      </div>
    );
  }

  if (block.type === "code") {
    return (
      <pre className="overflow-x-auto rounded-2xl border border-border bg-background p-5 text-sm text-text-secondary">
        <code>{block.code}</code>
      </pre>
    );
  }

  if (block.type === "callout") {
    return (
      <div className="rounded-2xl border border-accent/20 bg-accent/10 p-5">
        <h3 className="mb-2 font-semibold text-accent">{block.title}</h3>
        <p className="text-sm leading-6 text-text-secondary">{block.body}</p>
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
              <p className="text-sm leading-6 text-text-secondary">{item.body}</p>
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
  return (
    <div className="relative">
      <div className="absolute inset-x-0 top-0 -z-10 h-80 bg-[radial-gradient(ellipse_at_top,_rgba(0,212,170,0.08)_0%,_transparent_55%)]" />
      <div className="mx-auto grid max-w-7xl grid-cols-1 gap-10 px-4 py-12 sm:px-6 lg:grid-cols-[260px_1fr] lg:px-8 lg:py-16">
        <aside className="lg:sticky lg:top-24 lg:h-[calc(100vh-7rem)] lg:overflow-y-auto">
          <div className="mb-5 flex items-center gap-2 text-sm font-semibold text-text-primary">
            <BookOpen className="h-4 w-4 text-accent" />
            Docs
          </div>
          <nav className="space-y-6">
            {docsNav.map((section) => (
              <div key={section.title}>
                <h2 className="mb-2 text-xs font-semibold uppercase tracking-wider text-text-muted">
                  {section.title}
                </h2>
                <div className="space-y-1">
                  {section.pages.map((item) => {
                    const active = item.slug === page.slug;
                    return (
                      <Link
                        key={item.slug || "overview"}
                        href={item.slug ? `/docs/${item.slug}` : "/docs"}
                        className={`block rounded-lg px-3 py-2 text-sm transition-colors ${
                          active
                            ? "bg-accent/10 text-accent"
                            : "text-text-secondary hover:bg-surface hover:text-text-primary"
                        }`}
                      >
                        {item.title}
                      </Link>
                    );
                  })}
                </div>
              </div>
            ))}
          </nav>
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
          </div>
          <div className="space-y-7">{page.blocks.map((block, index) => <DocBlockView key={index} block={block} />)}</div>
        </article>
      </div>
    </div>
  );
}
