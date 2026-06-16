import { createFileRoute } from "@tanstack/react-router";
import { ClientOnly } from "@tanstack/react-router";
import { GwalaExperience } from "@/components/gwala-experience";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Gwala — A Celebration" },
      { name: "description", content: "A little something for Gwala. Press play." },
      { property: "og:title", content: "Gwala — A Celebration" },
      { property: "og:description", content: "A little something for Gwala. Press play." },
    ],
  }),
  component: Index,
});

function Index() {
  return (
    <main className="h-screen w-screen overflow-hidden bg-background">
      <ClientOnly fallback={<Fallback />}>
        <GwalaExperience />
      </ClientOnly>
    </main>
  );
}

function Fallback() {
  return (
    <div className="flex h-screen w-screen items-center justify-center bg-background">
      <p className="font-display text-sm uppercase tracking-[0.4em] text-accent">
        Setting the stage…
      </p>
    </div>
  );
}
