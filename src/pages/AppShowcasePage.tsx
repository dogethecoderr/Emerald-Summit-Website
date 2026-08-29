import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  ArrowRight,
  Bell,
  CheckCircle2,
  Clock,
  MapPin,
  Megaphone,
  QrCode,
  Route,
  Sparkles,
  UserCheck,
} from 'lucide-react';
import LandingNav from '../components/LandingNav';
import LandingFooter from '../components/LandingFooter';
import TrackPill from '../components/TrackPill';
import CapacityBar from '../components/CapacityBar';
import { SIGN_IN_ROLES } from '../models/roles';
import { MOCK_SESSIONS } from '../models/sessions';
import { MOCK_ANNOUNCEMENTS } from '../models/announcements';
import { Button } from '@/components/ui/button';

const PREVIEW_SESSIONS = MOCK_SESSIONS.slice(0, 3);
const PREVIEW_ANNOUNCEMENTS = MOCK_ANNOUNCEMENTS.slice(0, 2);

const fadeUp = {
  hidden: { opacity: 0, y: 24 },
  show: { opacity: 1, y: 0 },
};

function SchedulePreview() {
  return (
    <div className="space-y-3">
      {PREVIEW_SESSIONS.map((s) => (
        <div key={s.id} className="rounded-xl border border-border/70 bg-secondary/30 p-4">
          <div className="mb-1.5 flex items-center gap-2">
            <TrackPill track={s.track} />
            <span className="ml-auto inline-flex items-center gap-1 text-[11px] text-muted-foreground">
              <Clock className="h-3 w-3" /> {s.time}
            </span>
          </div>
          <div className="text-[13px] font-semibold leading-snug">{s.title}</div>
          <div className="mt-0.5 inline-flex items-center gap-1 text-[11px] text-muted-foreground">
            <MapPin className="h-3 w-3" /> {s.location}
          </div>
          <CapacityBar enrolled={s.enrolled} capacity={s.capacity} />
        </div>
      ))}
    </div>
  );
}

function AnnouncementsPreview() {
  return (
    <div className="space-y-3">
      {PREVIEW_ANNOUNCEMENTS.map((a) => (
        <div key={a.id} className="rounded-xl border border-border/70 bg-secondary/30 p-4">
          <div className="mb-1 flex items-center gap-2 text-[11px] font-semibold text-emerald-mint">
            <Bell className="h-3 w-3" /> {a.category} → {a.audience}
          </div>
          <div className="text-[13px] font-semibold leading-snug">{a.title}</div>
          <p className="mt-1 line-clamp-2 text-[12px] leading-relaxed text-muted-foreground">
            {a.body}
          </p>
        </div>
      ))}
    </div>
  );
}

function CheckInPreview() {
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-3 rounded-xl border border-emerald-glow/30 bg-emerald/10 p-4">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-emerald text-white">
          <CheckCircle2 className="h-5 w-5" />
        </span>
        <div>
          <div className="text-[13px] font-semibold">Jordan Lee — checked in</div>
          <div className="text-[11px] text-muted-foreground">9:02 AM · Front desk</div>
        </div>
      </div>
      <div className="flex items-center gap-3 rounded-xl border border-border/70 bg-secondary/30 p-4">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-secondary text-muted-foreground">
          <QrCode className="h-5 w-5" />
        </span>
        <div>
          <div className="text-[13px] font-semibold">Scan to confirm identity</div>
          <div className="text-[11px] text-muted-foreground">One tap from the front desk</div>
        </div>
      </div>
    </div>
  );
}

const FEATURE_ROWS = [
  {
    icon: Route,
    title: 'Build your day, your way',
    body: 'Browse 20+ tracks across six disciplines and assemble a conflict-free schedule with live seat counts and walking times between rooms.',
    Preview: SchedulePreview,
  },
  {
    icon: Megaphone,
    title: 'Never miss a change',
    body: 'Announcements land as push, feed, and email at once — room moves and schedule shifts reach you before you need to ask.',
    Preview: AnnouncementsPreview,
  },
  {
    icon: QrCode,
    title: 'One-tap check-in',
    body: 'A clean registration table on the day: volunteers confirm you in seconds and your whole day is already on your phone.',
    Preview: CheckInPreview,
  },
];

export default function AppShowcasePage() {
  const navigate = useNavigate();

  return (
    <div className="relative min-h-screen overflow-clip">
      <div
        className="pointer-events-none absolute -top-40 right-[-10%] h-[480px] w-[480px] rounded-full opacity-30 blur-3xl"
        style={{ background: 'radial-gradient(circle, #0C7A55 0%, transparent 65%)' }}
        aria-hidden
      />

      <LandingNav />

      <div className="relative mx-auto max-w-[1440px] px-6 lg:px-14">
        {/* hero */}
        <section className="flex flex-col items-center pb-16 pt-16 text-center lg:pb-20 lg:pt-20">
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
            className="inline-flex items-center gap-2 rounded-full border border-emerald-glow/30 bg-emerald/10 px-4 py-1.5 text-xs font-semibold text-emerald-mint"
          >
            <Sparkles className="h-3.5 w-3.5" />
            The Emerald Summit app
          </motion.div>
          <motion.h1
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.08, ease: [0.16, 1, 0.3, 1] }}
            className="mt-6 max-w-3xl font-hero text-4xl font-bold leading-[1.08] tracking-tight text-navy-bright sm:text-5xl lg:text-6xl"
          >
            Everything for Summit day,
            <br />
            <span className="text-gradient-emerald">in your pocket.</span>
          </motion.h1>
          <motion.p
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.16, ease: [0.16, 1, 0.3, 1] }}
            className="mt-5 max-w-xl text-base leading-relaxed text-muted-foreground lg:text-lg"
          >
            One app, tailored to who you are on Summit day — competitor,
            attendee, volunteer, or judge. Sign in and it adapts.
          </motion.p>
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.24, ease: [0.16, 1, 0.3, 1] }}
            className="mt-8"
          >
            <Button
              size="lg"
              className="glow-emerald group h-12 rounded-full bg-primary px-8 text-[15px] font-semibold hover:bg-emerald"
              onClick={() => navigate('/home')}
            >
              Get started
              <ArrowRight className="ml-1.5 h-4 w-4 transition-transform group-hover:translate-x-1" />
            </Button>
          </motion.div>
        </section>

        {/* feature rows, alternating */}
        <section className="space-y-16 py-8 lg:space-y-24 lg:py-16">
          {FEATURE_ROWS.map(({ icon: Icon, title, body, Preview }, i) => (
            <motion.div
              key={title}
              initial="hidden"
              whileInView="show"
              viewport={{ once: true, margin: '-100px' }}
              variants={fadeUp}
              transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
              className={`grid items-center gap-10 lg:grid-cols-2 lg:gap-16 ${
                i % 2 === 1 ? 'lg:[&>*:first-child]:order-2' : ''
              }`}
            >
              <div>
                <div className="mb-4 inline-flex h-11 w-11 items-center justify-center rounded-xl bg-emerald/15 text-emerald-mint ring-1 ring-emerald-glow/25">
                  <Icon className="h-5 w-5" />
                </div>
                <h3 className="font-hero text-2xl font-semibold tracking-tight lg:text-3xl">
                  {title}
                </h3>
                <p className="mt-3 max-w-md text-[15px] leading-relaxed text-muted-foreground">
                  {body}
                </p>
              </div>
              <div className="glass rounded-2xl p-5 lg:p-6">
                <Preview />
              </div>
            </motion.div>
          ))}
        </section>

        {/* role breakdown */}
        <section className="border-t border-border/60 py-16 lg:py-24">
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: '-80px' }}
            transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
            className="text-center"
          >
            <p className="font-mono text-xs font-semibold uppercase tracking-[0.25em] text-emerald-mint">
              Built for every role
            </p>
            <h2 className="mt-3 font-hero text-3xl font-bold tracking-tight sm:text-4xl">
              Sign in, and it becomes <span className="text-gradient-emerald">your</span> app.
            </h2>
            <p className="mx-auto mt-3 max-w-xl text-[15px] text-muted-foreground">
              The dashboard, navigation, and tools you see are shaped entirely
              by your role from the moment you sign in.
            </p>
          </motion.div>

          <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {SIGN_IN_ROLES.map((r, i) => (
              <motion.button
                key={r.name}
                type="button"
                onClick={() => navigate(`/login/${r.name}`)}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: '-60px' }}
                transition={{ duration: 0.5, delay: i * 0.08, ease: [0.16, 1, 0.3, 1] }}
                className="glass group flex flex-col items-start rounded-2xl p-5 text-left transition-all hover:-translate-y-0.5 hover:border-emerald-glow/40"
              >
                <span
                  className="flex h-11 w-11 items-center justify-center rounded-xl ring-1 ring-inset"
                  style={{
                    background: `${r.color}1e`,
                    color: r.color,
                    boxShadow: `inset 0 0 0 1px ${r.color}44`,
                  }}
                >
                  <r.icon className="h-5 w-5" strokeWidth={1.9} />
                </span>
                <span className="mt-4 font-hero text-base font-semibold">
                  {r.label}
                </span>
                <span className="mt-1 text-[13px] leading-snug text-muted-foreground">
                  {r.description}
                </span>
                <span className="mt-4 inline-flex items-center gap-1 text-[12px] font-semibold text-emerald-mint">
                  Sign in as {r.label}
                  <ArrowRight className="h-3 w-3 transition-transform group-hover:translate-x-0.5" />
                </span>
              </motion.button>
            ))}
          </div>
        </section>

        {/* final CTA */}
        <motion.section
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-80px' }}
          transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
          className="glass mb-16 flex flex-col items-center gap-5 rounded-2xl p-10 text-center lg:mb-24 lg:p-16"
        >
          <span className="flex h-12 w-12 items-center justify-center rounded-full bg-emerald/15 text-emerald-mint ring-1 ring-emerald-glow/25">
            <UserCheck className="h-6 w-6" />
          </span>
          <h2 className="font-hero text-2xl font-bold tracking-tight sm:text-3xl">
            Ready to build your day?
          </h2>
          <p className="max-w-md text-[15px] text-muted-foreground">
            Pick your role, sign in, and your Summit day starts taking shape.
          </p>
          <Button
            size="lg"
            className="glow-emerald group h-12 rounded-full bg-primary px-8 text-[15px] font-semibold hover:bg-emerald"
            onClick={() => navigate('/home')}
          >
            Get started
            <ArrowRight className="ml-1.5 h-4 w-4 transition-transform group-hover:translate-x-1" />
          </Button>
        </motion.section>
      </div>

      <LandingFooter />
    </div>
  );
}
