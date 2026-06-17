import { Hero } from "../../components/landing/hero";
import { Features } from "../../components/landing/features";
import { LiveDemo } from "../../components/landing/live-demo";
import { LandingFooter } from "../../components/landing/footer";

export default function HomePage() {
  return (
    <div className="flex-1 flex flex-col min-h-screen bg-slate-50 dark:bg-slate-950 antialiased selection:bg-blue-500 selection:text-white">
      <Hero />
      <Features />
      <LiveDemo />
      <LandingFooter />
    </div>
  );
}
