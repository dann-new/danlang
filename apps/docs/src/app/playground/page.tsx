import type { Metadata } from "next";
import { Playground } from "@/components/playground";

export const metadata: Metadata = {
  title: "Try it",
  description: "Write danlang and see which rule your chatbot picks, right in the browser.",
};

export default function PlaygroundPage() {
  return <Playground />;
}
