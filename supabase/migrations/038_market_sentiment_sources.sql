-- Market Sentiment Model V1: configurable public data sources and weights

create table public.market_sentiment_sources (
  id uuid primary key default gen_random_uuid(),
  slug text not null,
  name text not null,
  description text not null default '',
  weight_percent smallint not null,
  active boolean not null default true,
  sort_order integer not null default 0,
  config jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint market_sentiment_sources_slug_not_blank check (length(trim(slug)) > 0),
  constraint market_sentiment_sources_name_not_blank check (length(trim(name)) > 0),
  constraint market_sentiment_sources_weight_range check (
    weight_percent >= 0 and weight_percent <= 100
  )
);

create unique index market_sentiment_sources_slug_unique
  on public.market_sentiment_sources (lower(trim(slug)));

create index market_sentiment_sources_active_sort_idx
  on public.market_sentiment_sources (active, sort_order, name);

alter table public.market_sentiment_sources enable row level security;

create policy "Authenticated users can read active sentiment sources"
  on public.market_sentiment_sources
  for select
  to authenticated
  using (active = true or public.is_admin());

create policy "Admins can insert sentiment sources"
  on public.market_sentiment_sources
  for insert
  to authenticated
  with check (public.is_admin());

create policy "Admins can update sentiment sources"
  on public.market_sentiment_sources
  for update
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

create policy "Admins can delete sentiment sources"
  on public.market_sentiment_sources
  for delete
  to authenticated
  using (public.is_admin());

insert into public.market_sentiment_sources (
  slug,
  name,
  description,
  weight_percent,
  sort_order,
  config
) values
  (
    'news',
    'Sports News',
    'Recent articles from major sports news RSS feeds (ESPN, CBS Sports, Yahoo Sports, Bleacher Report, NBA.com).',
    30,
    1,
    '{"feeds":[{"name":"ESPN","url":"https://www.espn.com/espn/rss/news","quality":0.9},{"name":"CBS Sports","url":"https://www.cbssports.com/rss/headlines/","quality":0.85},{"name":"Yahoo Sports","url":"https://sports.yahoo.com/rss/","quality":0.8},{"name":"Bleacher Report","url":"https://bleacherreport.com/articles/feed","quality":0.75},{"name":"NBA.com","url":"https://www.nba.com/news/rss","quality":0.85}]}'::jsonb
  ),
  (
    'reddit',
    'Reddit',
    'Public Reddit discussions from basketball cards, sports cards, NBA, and team subreddits.',
    20,
    2,
    '{"subreddits":["basketballcards","sportscards","nba","bostonceltics","lakers"]}'::jsonb
  ),
  (
    'youtube',
    'YouTube',
    'Recent public YouTube videos mentioning the player or card via search.',
    20,
    3,
    '{"maxResults":15}'::jsonb
  ),
  (
    'social',
    'X (Twitter)',
    'Public social mentions via accessible web search snippets (no authenticated API).',
    15,
    4,
    '{"querySuffix":"sports cards"}'::jsonb
  ),
  (
    'search_interest',
    'Google Trends',
    'Public search interest signals where available.',
    15,
    5,
    '{"geo":"US"}'::jsonb
  );
