import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { LessonPicker } from "@/components/lesson-picker";
import { getLesson, listLessons } from "@/lib/lessons";

export const dynamicParams = false;

export function generateStaticParams() {
  return listLessons().map((l) => ({ slug: l.slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const lesson = getLesson(slug);
  return lesson ? { title: lesson.title, description: lesson.summary } : {};
}

export default async function LessonPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const lesson = getLesson(slug);
  if (!lesson) notFound();
  const all = listLessons();
  const i = all.findIndex((l) => l.slug === slug);
  const prev = all[i - 1];
  const next = all[i + 1];

  const pager = (
    <div className="pager">
      {prev ? (
        <Link className="btn" href={`/learn/${prev.slug}`}>
          ❮ Previous
        </Link>
      ) : (
        <span />
      )}
      {next ? (
        <Link className="btn" href={`/learn/${next.slug}`}>
          Next ❯
        </Link>
      ) : (
        <Link className="btn" href="/playground">
          Open Try it ❯
        </Link>
      )}
    </div>
  );

  return (
    <div className="learn">
      <aside className="sidebar">
        <h2>danlang Tutorial</h2>
        {all.map((l) => (
          <Link key={l.slug} href={`/learn/${l.slug}`} className={l.slug === slug ? "active" : undefined}>
            {l.title}
          </Link>
        ))}
      </aside>
      <div>
        <div className="mobile-nav">
          <LessonPicker lessons={all.map(({ slug, title }) => ({ slug, title }))} current={slug} />
        </div>
        <article className="lesson">
          {pager}
          <h1>{lesson.title}</h1>
          <p className="summary">{lesson.summary}</p>
          <div dangerouslySetInnerHTML={{ __html: lesson.html }} />
          {pager}
        </article>
      </div>
    </div>
  );
}
