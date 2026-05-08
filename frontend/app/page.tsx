import { HeroCard } from "@/components/hero-card";

export default function Home() {
  return (
    <main className="min-h-screen bg-background">
      <div className="mx-auto flex w-full max-w-5xl flex-col px-6 py-16 md:px-10">
        <HeroCard />
      </div>
    </main>
  );
}
