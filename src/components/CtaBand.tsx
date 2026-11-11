import { useNavigate } from 'react-router-dom';
import { ArrowRight, Mail } from '@/components/icons';
import { Button } from '@/components/ui/button';

/** Full-width closing CTA — the "one last push" band before the footer. */
export default function CtaBand() {
  const navigate = useNavigate();

  return (
    <section className="relative overflow-hidden bg-gradient-to-br from-emerald to-emerald-deep py-20 text-center text-white lg:py-28">
      <div
        className="pointer-events-none absolute -top-24 left-1/2 h-[420px] w-[720px] -translate-x-1/2 rounded-full bg-white/10 blur-3xl"
        aria-hidden
      />
      <div className="relative mx-auto max-w-2xl px-6">
        <p className="font-mono text-xs font-semibold uppercase tracking-[0.25em] text-white/70">
          Get involved
        </p>
        <h2 className="mt-4 font-hero text-4xl font-bold tracking-tight sm:text-5xl">
          Start the trek.
        </h2>
        <p className="mt-4 text-sm text-white/80 lg:text-base">
          January 2027 · Emerald High School, Dublin, CA · 100% free
        </p>
        <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
          <Button
            size="lg"
            className="group h-12 rounded-full bg-white px-8 text-[15px] font-semibold text-emerald-deep hover:bg-white/90 lg:h-14 lg:px-10 lg:text-lg"
            onClick={() => navigate('/home')}
          >
            Get started
            <ArrowRight className="ml-1.5 h-4 w-4 transition-transform group-hover:translate-x-1 lg:h-5 lg:w-5" />
          </Button>
          <a
            href="mailto:contact.ehsaf@gmail.com"
            className="inline-flex h-12 items-center gap-2 rounded-full border border-white/30 px-8 text-[15px] font-semibold text-white transition-colors hover:bg-white/10 lg:h-14 lg:px-10 lg:text-lg"
          >
            <Mail className="h-4 w-4 lg:h-5 lg:w-5" />
            contact.ehsaf@gmail.com
          </a>
        </div>
      </div>
    </section>
  );
}
