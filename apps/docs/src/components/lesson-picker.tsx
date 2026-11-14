"use client";

import { useRouter } from "next/navigation";

/** On phones the sidebar is hidden; this dropdown replaces it. */
export function LessonPicker({ lessons, current }: { lessons: { slug: string; title: string }[]; current: string }) {
  const router = useRouter();
  return (
    <>
      <label htmlFor="lesson-picker" className="hint">
        Lesson
      </label>
      <select id="lesson-picker" value={current} onChange={(e) => router.push(`/learn/${e.target.value}`)}>
        {lessons.map((l, i) => (
          <option key={l.slug} value={l.slug}>
            {i + 1}. {l.title}
          </option>
        ))}
      </select>
    </>
  );
}
