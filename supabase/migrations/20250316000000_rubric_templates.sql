create table if not exists rubric_templates (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  items jsonb not null default '[]',
  created_at timestamptz default now()
);

alter table rubric_templates enable row level security;

-- Instructors and admins can read all templates
create policy "Instructors can read rubric templates"
  on rubric_templates for select
  using (
    exists (
      select 1 from users where id = auth.uid() and role in ('instructor', 'admin')
    )
  );

-- Instructors and admins can insert
create policy "Instructors can insert rubric templates"
  on rubric_templates for insert
  with check (
    exists (
      select 1 from users where id = auth.uid() and role in ('instructor', 'admin')
    )
  );

-- Instructors and admins can delete
create policy "Instructors can delete rubric templates"
  on rubric_templates for delete
  using (
    exists (
      select 1 from users where id = auth.uid() and role in ('instructor', 'admin')
    )
  );
