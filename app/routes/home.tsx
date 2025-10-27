import type { Route } from "./+types/home";
import { Uploader } from "~/uploader/uploader";

export function meta({}: Route.MetaArgs) {
  return [
    { title: "R2 Benchmark" },
    { name: "description", content: "Welcome to R2 Benchmark!" },
  ];
}

export default function Home() {
  return <Uploader></Uploader>;
}
