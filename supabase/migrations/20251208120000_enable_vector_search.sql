-- Enable pgvector extension
create extension if not exists vector;

-- Add embedding column to therapists table
-- Gemini text-embedding-004 output dimension is 768
alter table "therapists" add column if not exists "embedding" vector(768);

-- Create a function to match therapists by vector similarity
create or replace function match_therapists (
  query_embedding vector(768),
  match_threshold float,
  match_count int,
  filter_insurance text default null
)
returns table (
  id uuid,
  name text,
  specialties jsonb,
  accepted_insurance jsonb,
  bio text,
  similarity float
)
language plpgsql
as $$
begin
  return query
  select
    therapists.id,
    therapists.name,
    therapists.specialties,
    therapists.accepted_insurance,
    therapists.bio,
    1 - (therapists.embedding <=> query_embedding) as similarity
  from therapists
  where 1 - (therapists.embedding <=> query_embedding) > match_threshold
  and (
    filter_insurance is null 
    or 
    exists (
      select 1 
      from jsonb_array_elements_text(therapists.accepted_insurance) as ins 
      where ins ilike '%' || filter_insurance || '%'
    )
  )
  order by therapists.embedding <=> query_embedding
  limit match_count;
end;
$$;
