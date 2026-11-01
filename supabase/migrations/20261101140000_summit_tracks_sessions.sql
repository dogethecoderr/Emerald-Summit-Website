-- Emerald Summit: tracks and sessions move into the database, so admins and
-- ambassadors can edit them in the app.
-- Run after 20261101120000_student_registrations.sql.
--
-- Until now both lived in the bundle (src/models/tracks.ts, sessions.ts).
-- Those files stay as the fallback when this backend isn't reachable; the
-- seed at the bottom copies them in once.
--
-- Who can change what (public.can_edit_verse):
--   * admins: every track and session, keynotes included
--   * volunteers and ambassadors with can_edit_sessions (EAF ambassadors by
--     default, from the Allowed Volunteers sheet): tracks and sessions in the
--     verses on their sheet row (managed_disciplines; '*' = every verse).
--     Keynotes stay admin-only.
--   * everyone, signed in or not: read
-- Seat counts (enrolled, experts_enrolled, spectators) are sample numbers;
-- reservations still live in the browser.

create or replace function public.can_edit_verse(p_verse text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.users u
     where u.id = auth.uid()
       and (
         u.role = 'admin'::public.user_role
         or (
           u.role in ('volunteer'::public.user_role, 'ambassador'::public.user_role)
           and u.can_edit_sessions
           and p_verse <> 'keynote'
           and ('*' = any(u.managed_disciplines) or p_verse = any(u.managed_disciplines))
         )
       )
  );
$$;

comment on function public.can_edit_verse(text) is
  'True when the signed-in user may edit tracks and sessions in this verse (or ''keynote'').';

-- ---------------------------------------------------------------------------
-- Tracks
-- ---------------------------------------------------------------------------

create table if not exists public.summit_tracks (
  verse       text not null
                check (verse in ('techverse', 'biosphere', 'imaginex', 'novasphere', 'ventureverse', 'civicverse')),
  name        text not null check (char_length(trim(name)) between 1 and 80),
  about       text not null default '' check (char_length(about) <= 600),
  ideas       text[] not null default '{}',
  formats     text[] not null default '{}'
                check (formats <@ array['Workshop', 'Exhibit', 'Presentation']::text[]),
  sort_order  integer not null default 0,
  updated_at  timestamptz not null default now(),
  updated_by  uuid default auth.uid(),
  primary key (verse, name)
);

comment on table public.summit_tracks is
  'Tracks within each verse. Edited in the app by admins and by ambassadors for their verses (can_edit_verse).';

-- ---------------------------------------------------------------------------
-- Sessions
-- ---------------------------------------------------------------------------

create table if not exists public.summit_sessions (
  id               text primary key default ('s-' || substr(md5(random()::text), 1, 10)),
  verse            text not null
                     check (verse in ('keynote', 'techverse', 'biosphere', 'imaginex', 'novasphere', 'ventureverse', 'civicverse')),
  track_name       text,
  title            text not null check (char_length(trim(title)) between 1 and 120),
  speaker          text not null default '',
  time_slot        text not null
                     check (time_slot in ('9:00 AM', '11:00 AM', '1:00 PM', '2:30 PM', '3:45 PM', '5:00 PM')),
  duration         text not null default '60 min',
  location         text not null default '',
  room             text not null default '',
  description      text not null default '' check (char_length(description) <= 1000),
  capacity         integer not null default 30 check (capacity >= 0),
  enrolled         integer not null default 0 check (enrolled >= 0),
  expert_capacity  integer not null default 0 check (expert_capacity >= 0),
  experts_enrolled integer not null default 0 check (experts_enrolled >= 0),
  spectator_cap    integer not null default 0 check (spectator_cap >= 0),
  spectators       integer not null default 0 check (spectators >= 0),
  updated_at       timestamptz not null default now(),
  updated_by       uuid default auth.uid(),
  -- Renaming a track carries its sessions along; a track with sessions
  -- can't be deleted.
  foreign key (verse, track_name) references public.summit_tracks (verse, name)
    on update cascade on delete restrict
);

comment on table public.summit_sessions is
  'Summit sessions. verse is a discipline or ''keynote''; track_name is a summit_tracks name in that verse.';

-- ---------------------------------------------------------------------------
-- Timestamps and editor
-- ---------------------------------------------------------------------------

create or replace function public.stamp_summit_content()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  new.updated_by := auth.uid();
  return new;
end;
$$;

drop trigger if exists summit_tracks_stamp on public.summit_tracks;
create trigger summit_tracks_stamp
  before update on public.summit_tracks
  for each row execute function public.stamp_summit_content();

drop trigger if exists summit_sessions_stamp on public.summit_sessions;
create trigger summit_sessions_stamp
  before update on public.summit_sessions
  for each row execute function public.stamp_summit_content();

-- ---------------------------------------------------------------------------
-- Row-level security
-- ---------------------------------------------------------------------------

alter table public.summit_tracks enable row level security;
alter table public.summit_sessions enable row level security;

drop policy if exists "summit_tracks_select_all" on public.summit_tracks;
create policy "summit_tracks_select_all" on public.summit_tracks
  for select to anon, authenticated using (true);
drop policy if exists "summit_tracks_insert_editor" on public.summit_tracks;
create policy "summit_tracks_insert_editor" on public.summit_tracks
  for insert to authenticated with check (public.can_edit_verse(verse));
drop policy if exists "summit_tracks_update_editor" on public.summit_tracks;
create policy "summit_tracks_update_editor" on public.summit_tracks
  for update to authenticated
  using (public.can_edit_verse(verse)) with check (public.can_edit_verse(verse));
drop policy if exists "summit_tracks_delete_editor" on public.summit_tracks;
create policy "summit_tracks_delete_editor" on public.summit_tracks
  for delete to authenticated using (public.can_edit_verse(verse));

drop policy if exists "summit_sessions_select_all" on public.summit_sessions;
create policy "summit_sessions_select_all" on public.summit_sessions
  for select to anon, authenticated using (true);
drop policy if exists "summit_sessions_insert_editor" on public.summit_sessions;
create policy "summit_sessions_insert_editor" on public.summit_sessions
  for insert to authenticated with check (public.can_edit_verse(verse));
drop policy if exists "summit_sessions_update_editor" on public.summit_sessions;
create policy "summit_sessions_update_editor" on public.summit_sessions
  for update to authenticated
  using (public.can_edit_verse(verse)) with check (public.can_edit_verse(verse));
drop policy if exists "summit_sessions_delete_editor" on public.summit_sessions;
create policy "summit_sessions_delete_editor" on public.summit_sessions
  for delete to authenticated using (public.can_edit_verse(verse));

-- Supabase's default privileges grant everything (TRUNCATE included, which
-- RLS doesn't cover); keep only what the policies use.
revoke all on table public.summit_tracks, public.summit_sessions from anon, authenticated;
grant select on table public.summit_tracks, public.summit_sessions to anon, authenticated;
grant insert, update, delete on table public.summit_tracks, public.summit_sessions to authenticated;
grant all on table public.summit_tracks, public.summit_sessions to service_role;

-- ---------------------------------------------------------------------------
-- Seed: Summit '26's tracks and sample sessions (from src/models). Existing
-- rows are left alone, so re-running never undoes an edit.
-- ---------------------------------------------------------------------------

insert into public.summit_tracks (verse, name, about, ideas, formats, sort_order) values
  ('techverse', 'Computer Science', 'Software, apps, and the ideas behind them, from algorithms to cybersecurity.', array['Show an app, game, or website you built', 'Explain a project or research question', 'Demo a tool and talk through the code']::text[], array['Exhibit', 'Presentation']::text[], 0),
  ('techverse', 'AI Playground', 'Hands-on time with machine learning and AI tools: what they can do, and where they fall short.', array['Train or test a small model', 'Try prompts and compare results', 'Talk through responsible use with experts']::text[], array['Workshop']::text[], 1),
  ('techverse', 'Engineering', 'Designs that solve physical problems, from circuits and mechanisms to full prototypes.', array['Bring a prototype or build log', 'Walk through your design decisions', 'Get feedback from working engineers']::text[], array['Exhibit', 'Presentation']::text[], 2),
  ('techverse', 'CADathon', 'A computer-aided design workshop: model a part or product to a brief, solo or in a team.', array['Model to a design brief', 'Iterate on feedback during the session', 'Present your model at the end']::text[], array['Workshop']::text[], 3),
  ('techverse', 'Robothon', 'A robotics workshop: build, wire, and program a robot to take on a task.', array['Build and program in a team', 'Debug sensors and motors', 'Demo what your robot can do']::text[], array['Workshop']::text[], 4),
  ('techverse', 'Product Design', 'Taking a product from a user need to a design: research, sketching, and prototyping.', array['Pitch a problem and your solution', 'Sketch and prototype quickly', 'Test ideas with other attendees']::text[], array['Workshop']::text[], 5),
  ('biosphere', 'Psychology', 'How people think, feel, and behave, and how researchers study it.', array['Present a study or survey you ran', 'Explore a topic in behavior or the mind', 'Discuss research methods with experts']::text[], array['Workshop', 'Presentation']::text[], 6),
  ('biosphere', 'Genetics', 'DNA, heredity, and tools like CRISPR, along with the ethics that come with them.', array['Present a genetics project or review', 'Explore gene editing and bioethics', 'Ask experts about lab and research paths']::text[], array['Workshop', 'Presentation']::text[], 7),
  ('biosphere', 'Health Sciences', 'Medicine, public health, and the science of keeping people well.', array['Share a health research project', 'Explore a public health problem', 'Learn about careers in medicine']::text[], array['Workshop', 'Presentation']::text[], 8),
  ('biosphere', 'Presentations', 'An open stage for life science work: present any BioSphere project and get expert feedback.', array['Present research or a science fair project', 'Practice a talk with a real audience', 'Get notes from experts afterward']::text[], array['Presentation']::text[], 9),
  ('novasphere', 'Core Science', 'Physics, chemistry, astronomy, and math: the foundations, and where they lead.', array['Present an experiment or model', 'Explore space and physics questions', 'Work through problems with experts']::text[], array['Workshop', 'Presentation']::text[], 10),
  ('novasphere', 'Climate Change & Sustainability', 'Understanding a changing climate and building solutions, local and global.', array['Share a sustainability project', 'Analyze climate data', 'Pitch a solution for your school or city']::text[], array['Workshop', 'Presentation']::text[], 11),
  ('imaginex', 'Art', 'Visual art and design in any medium, from drawing and painting to film and digital work.', array['Exhibit a piece or portfolio', 'Present the process behind your work', 'Get critique from working artists']::text[], array['Exhibit', 'Presentation']::text[], 12),
  ('imaginex', 'Literature', 'Writing and reading: fiction, poetry, essays, and the craft behind them.', array['Share a story, poem, or essay', 'Talk about a work you love', 'Get feedback on your writing']::text[], array['Exhibit', 'Presentation']::text[], 13),
  ('imaginex', 'Music', 'Performing, composing, and producing music.', array['Perform or play a recording', 'Share a composition or production', 'Talk theory and process with musicians']::text[], array['Workshop', 'Presentation']::text[], 14),
  ('imaginex', 'Culinary', 'Food as craft and science: recipes, techniques, and food culture.', array['Present a dish and its story', 'Explore the science of cooking', 'Learn techniques from experts']::text[], array['Workshop']::text[], 15),
  ('ventureverse', 'Entrepreneurship', 'Turning an idea into a venture: problems, customers, business models, and money.', array['Pitch a startup or club idea', 'Build a simple business plan', 'Get feedback from founders and investors']::text[], array['Workshop', 'Presentation']::text[], 16),
  ('ventureverse', 'Marketing', 'Reaching people: brands, campaigns, social media, and what makes a message stick.', array['Present a campaign or brand you made', 'Analyze one that worked', 'Plan a launch with a team']::text[], array['Workshop', 'Presentation']::text[], 17),
  ('civicverse', 'Mock Trial', 'A courtroom workshop: argue a case as attorneys and witnesses.', array['Prepare arguments in a team', 'Play attorney or witness', 'Hear feedback from legal experts']::text[], array['Workshop']::text[], 18),
  ('civicverse', 'Civic Engagement', 'Making change in your community: organizing, service, and getting involved in government.', array['Present a service or advocacy project', 'Plan a community initiative', 'Meet local leaders']::text[], array['Workshop', 'Presentation']::text[], 19),
  ('civicverse', 'Law & Rights', 'How laws are made and argued, and the rights they protect.', array['Debate a policy question', 'Present research on a case or right', 'Talk with lawyers about the field']::text[], array['Workshop', 'Presentation']::text[], 20)
on conflict (verse, name) do nothing;

insert into public.summit_sessions (id, verse, track_name, title, speaker, time_slot, duration, location, room, description, capacity, enrolled, expert_capacity, experts_enrolled, spectator_cap, spectators) values
  ('s1', 'keynote', null, 'Opening Keynote: Innovate, Imagine, Impact', 'Marcus Chen & Elena Rodriguez', '9:00 AM', '60 min', 'Main Hall A', 'A', 'Summit directors open the day with a vision for what students can build, discover, and lead.', 300, 212, 3, 2, 0, 0),
  ('s2', 'techverse', 'AI Playground', 'AI & Machine Learning Foundations', 'TechVerse Faculty Lead', '11:00 AM', '75 min', 'Computer Lab', 'C', 'Hands-on intro to ML concepts with live demos and beginner coding exercises.', 30, 28, 3, 3, 10, 4),
  ('s3', 'biosphere', 'Presentations', 'Climate Solutions by Students', 'BioSphere Panel', '11:00 AM', '60 min', 'Room 204', 'D', 'Student researchers present local environmental projects and scalable solutions.', 40, 31, 3, 1, 15, 7),
  ('s4', 'imaginex', 'Art', 'Visual Storytelling & Brand Design', 'ImagineX Studio Lead', '11:00 AM', '90 min', 'Design Studio', 'E', 'Workshop on visual identity, layout, and communicating ideas through design.', 24, 24, 3, 3, 8, 2),
  ('s5', 'novasphere', 'Core Science', 'Rocket Science & Space Exploration', 'NovaSphere Volunteers', '1:00 PM', '60 min', 'Science Wing', 'F', 'From orbital mechanics to student-built model rockets — exploring beyond Earth.', 30, 18, 3, 2, 12, 3),
  ('s6', 'ventureverse', 'Entrepreneurship', 'Pitch Your Idea: Startup Studio', 'VentureVerse Coaches', '1:00 PM', '90 min', 'Innovation Hub', 'G', 'Students pitch business concepts to a panel of volunteers and receive live feedback.', 20, 17, 3, 3, 20, 11),
  ('s7', 'civicverse', 'Law & Rights', 'Mock Legislature & Policy Debate', 'CivicVerse Facilitators', '1:00 PM', '75 min', 'Room 108', 'B', 'Simulate the legislative process by debating real policy proposals.', 35, 22, 3, 3, 15, 6),
  ('s8', 'techverse', 'Computer Science', 'Cybersecurity & Ethical Hacking', 'TechVerse Faculty Lead', '2:30 PM', '60 min', 'Computer Lab', 'C', 'Explore how vulnerabilities are found and patched — and the ethics behind disclosure.', 30, 26, 3, 3, 8, 8),
  ('s9', 'biosphere', 'Genetics', 'Genetics, CRISPR & Bioethics', 'BioSphere Faculty Lead', '2:30 PM', '60 min', 'Bio Lab', 'H', 'Dive into gene editing technology and the moral questions scientists must navigate.', 28, 15, 3, 2, 10, 2),
  ('s10', 'imaginex', 'Art', 'Film & Podcast Production Lab', 'ImagineX Media Team', '2:30 PM', '60 min', 'Media Lab', 'I', 'Record, edit, and produce a short segment using professional studio equipment.', 20, 20, 3, 3, 5, 5),
  ('s11', 'ventureverse', 'Entrepreneurship', 'Financial Literacy & Investing 101', 'VentureVerse Coaches', '3:45 PM', '60 min', 'Innovation Hub', 'G', 'Stocks, compound interest, and personal finance — tools every student should know.', 35, 19, 3, 2, 20, 4),
  ('s12', 'civicverse', 'Civic Engagement', 'Community Leadership & Civic Action', 'CivicVerse Panel', '3:45 PM', '60 min', 'Courtyard Stage', 'J', 'Local student leaders discuss how to organize and create change in Dublin.', 60, 34, 3, 3, 40, 12),
  ('s14', 'techverse', 'Engineering', 'Engineering Design Showcase', 'TechVerse Engineering Mentors', '11:00 AM', '60 min', 'Engineering Lab', 'K', 'Show a prototype or build log and talk through your design choices with working engineers.', 30, 19, 3, 1, 25, 9),
  ('s15', 'techverse', 'CADathon', 'CADathon: Design to a Brief', 'TechVerse Engineering Mentors', '1:00 PM', '90 min', 'Engineering Lab', 'K', 'Model a part to a design brief, solo or in a team, then present it for expert feedback.', 24, 17, 2, 1, 10, 3),
  ('s16', 'techverse', 'Robothon', 'Robothon: Build and Program', 'TechVerse Robotics Mentors', '3:45 PM', '75 min', 'Robotics Lab', 'M', 'Build, wire, and program a robot in a team to take on a task by the end of the session.', 24, 22, 2, 2, 15, 8),
  ('s17', 'techverse', 'Product Design', 'Product Design Sprint', 'TechVerse Design Mentors', '2:30 PM', '60 min', 'Design Studio', 'E', 'Go from a user need to a sketch and a quick prototype, then test it with other attendees.', 30, 14, 3, 1, 10, 2),
  ('s18', 'biosphere', 'Psychology', 'Psychology of Decision-Making', 'BioSphere Faculty Lead', '1:00 PM', '60 min', 'Room 204', 'D', 'How people make choices, how researchers study it, and how to design a study of your own.', 35, 21, 3, 2, 20, 6),
  ('s19', 'biosphere', 'Health Sciences', 'Health Sciences: Medicine & Public Health', 'BioSphere Panel', '3:45 PM', '60 min', 'Bio Lab', 'H', 'Present health research or explore a public health problem with doctors and researchers.', 35, 26, 3, 2, 20, 11),
  ('s20', 'novasphere', 'Climate Change & Sustainability', 'Climate Change & Sustainability Lab', 'NovaSphere Faculty Lead', '11:00 AM', '75 min', 'Science Wing', 'F', 'Work with real climate data and pitch a sustainability fix for your school or city.', 30, 24, 3, 2, 15, 7),
  ('s21', 'imaginex', 'Literature', 'Writers'' Workshop: Stories & Poetry', 'ImagineX Faculty Lead', '1:00 PM', '60 min', 'Library', 'N', 'Share a story, poem, or essay, and get notes on craft from published writers.', 25, 12, 2, 1, 15, 4),
  ('s22', 'imaginex', 'Music', 'Music: Compose, Perform, Produce', 'ImagineX Music Mentors', '3:45 PM', '60 min', 'Music Room', 'O', 'Perform, play a recording, or share a production, and talk process with working musicians.', 25, 20, 2, 1, 30, 18),
  ('s23', 'imaginex', 'Culinary', 'Culinary Science Kitchen', 'ImagineX Culinary Mentors', '11:00 AM', '75 min', 'Culinary Room', 'P', 'The science behind cooking techniques, hands-on, with a dish to present at the end.', 20, 18, 2, 2, 0, 0),
  ('s24', 'ventureverse', 'Marketing', 'Marketing: Build a Brand Campaign', 'VentureVerse Panel', '2:30 PM', '60 min', 'Innovation Hub', 'G', 'Plan a launch campaign in a team and present it to marketers for feedback.', 40, 23, 3, 1, 20, 5),
  ('s25', 'civicverse', 'Mock Trial', 'Mock Trial: Courtroom Workshop', 'CivicVerse Legal Mentors', '2:30 PM', '90 min', 'Room 108', 'B', 'Argue a case as attorneys and witnesses, with feedback from lawyers and judges.', 30, 27, 3, 3, 40, 22),
  ('s13', 'keynote', null, 'Closing Ceremony & Discipline Awards', 'Marcus Chen & Elena Rodriguez', '5:00 PM', '45 min', 'Main Hall A', 'A', 'Celebrate standout work across all six disciplines with peer-nominated awards.', 300, 198, 3, 1, 0, 0)
on conflict (id) do nothing;
