import Link from "next/link";
import { highlightDan, encodeCode } from "@/lib/highlight";
import { listLessons } from "@/lib/lessons";

const SAMPLE = `field topic = [greeting, taxes, other]

let hello_messages = ["Hi there!", "Hello! How can I help?", "Hey! 👋"]

flow main
  say-hi: when topic == greeting -> reply hello_messages
  tax: when topic == taxes >= 0.8 -> direct tax_summary
  open: else -> model`;

export default function Home() {
  const lessons = listLessons();
  return (
    <main>
      <section className="hero">
        <h1>danlang</h1>
        <p>A simple language for telling a chatbot what to do. Answer easy questions for free, and only pay the big AI for the hard ones.</p>
        <div className="btn-row">
          <Link className="btn" href="/learn/introduction">
            Start learning
          </Link>
          <Link className="btn secondary" href="/playground">
            Try it now
          </Link>
        </div>
      </section>

      <section className="home-section">
        <h2>It reads almost like English</h2>
        <div className="example">
          <div className="example-head">Example</div>
          <pre className="code dan" dangerouslySetInnerHTML={{ __html: highlightDan(SAMPLE) }} />
          <a className="try" href={`/playground#code=${encodeCode(SAMPLE)}`}>
            Try it Yourself »
          </a>
        </div>
        <div className="home-grid">
          <div className="card">
            <h3>💸 Saves money</h3>
            <p>Greetings, simple questions and missing details are answered without the expensive AI.</p>
          </div>
          <div className="card">
            <h3>👀 Easy to read</h3>
            <p>Anyone on the team can open the file and see exactly what the bot will do.</p>
          </div>
          <div className="card">
            <h3>🧪 Easy to test</h3>
            <p>Type a message and see which rule was picked, and why.</p>
          </div>
        </div>
      </section>

      <section className="home-section">
        <h2>Lessons</h2>
        <div className="home-grid">
          {lessons.map((l) => (
            <Link key={l.slug} className="card" href={`/learn/${l.slug}`}>
              <span className="num">Lesson {l.order}</span>
              <h3>{l.title}</h3>
              <p>{l.summary}</p>
            </Link>
          ))}
        </div>
      </section>
    </main>
  );
}
