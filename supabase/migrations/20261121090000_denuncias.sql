-- =====================================================================
-- Denuncias: cualquiera puede reportar una publicación, un vendedor o una reseña.
-- - Sin cuenta: se identifica con su buyer_token (o su usuario si está logueado). Una denuncia por cosa y
--   persona, y hasta 10 por día por persona (evita spam).
-- - Si una publicación junta 3 denuncias de personas distintas, se pausa sola (moderation = 'pausada')
--   hasta que el admin la revise. Lo mismo con una reseña (se oculta).
-- - El admin las ve, las resuelve o las descarta; todo queda en el registro.
-- =====================================================================
create table public.reports (
  id uuid primary key default gen_random_uuid(),
  kind text not null check (kind in ('producto', 'vendedor', 'resena')),
  product_id uuid references public.products (id) on delete cascade,
  seller_id uuid not null references public.sellers (id) on delete cascade,
  review_id uuid references public.reviews (id) on delete cascade,
  reason text not null check (reason in ('estafa', 'prohibido', 'ofensivo', 'falso', 'otro')),
  detail text check (char_length(detail) <= 300),
  reporter text not null, -- buyer_token o id del usuario (nunca se muestra)
  status text not null default 'nuevo' check (status in ('nuevo', 'resuelto', 'descartado')),
  auto_action text,
  created_at timestamptz not null default now(),
  resolved_at timestamptz
);
create unique index reports_once on public.reports (kind, coalesce(product_id, review_id, seller_id), reporter);
create index reports_status on public.reports (status, created_at desc);
alter table public.reports enable row level security;
revoke all on public.reports from anon, authenticated;

create or replace function public.submit_report(p_kind text, p_target uuid, p_reason text, p_detail text, p_token uuid) returns text
language plpgsql security definer set search_path = '' as $$
declare v_seller uuid; v_product uuid; v_review uuid; v_reporter text := coalesce(auth.uid()::text, p_token::text); n int; v_auto text;
begin
  if v_reporter is null or p_reason not in ('estafa', 'prohibido', 'ofensivo', 'falso', 'otro') then raise exception 'DATOS'; end if;
  if (select count(*) from public.reports where reporter = v_reporter and created_at > now() - interval '1 day') >= 10 then raise exception 'DEMASIADAS'; end if;
  if p_kind = 'producto' then
    select p.seller_id, p.id into v_seller, v_product from public.products p where p.id = p_target;
  elsif p_kind = 'vendedor' then
    select s.id into v_seller from public.sellers s where s.id = p_target;
  elsif p_kind = 'resena' then
    select r.seller_id, r.id into v_seller, v_review from public.reviews r where r.id = p_target;
  end if;
  if v_seller is null then raise exception 'NO_ENCONTRADO'; end if;
  if auth.uid() = v_seller then raise exception 'PROPIO'; end if;

  insert into public.reports (kind, product_id, seller_id, review_id, reason, detail, reporter)
  values (p_kind, v_product, v_seller, v_review, p_reason, nullif(left(btrim(coalesce(p_detail, '')), 300), ''), v_reporter)
  on conflict do nothing;
  if not found then return 'YA_DENUNCIADO'; end if;

  -- 3 personas distintas → se saca de la vista hasta que lo revises.
  if p_kind in ('producto', 'resena') then
    select count(distinct reporter) into n from public.reports
      where kind = p_kind and coalesce(product_id, review_id) = p_target and status = 'nuevo';
    if n >= 3 then
      if p_kind = 'producto' then update public.products set moderation = 'pausada' where id = p_target and moderation = 'ok'; v_auto := 'pausada';
      else update public.reviews set hidden = true where id = p_target and not hidden; v_auto := 'oculta'; end if;
      update public.reports set auto_action = v_auto where kind = p_kind and coalesce(product_id, review_id) = p_target and status = 'nuevo';
    end if;
  end if;
  return 'OK';
end $$;
revoke execute on function public.submit_report(text, uuid, text, text, uuid) from public;
grant execute on function public.submit_report(text, uuid, text, text, uuid) to anon, authenticated;

-- Admin: denuncias agrupadas por lo denunciado.
create or replace function public.admin_reports(p_status text default 'nuevo') returns jsonb
language plpgsql stable security definer set search_path = '' as $$
begin
  perform public.admin_guard();
  return coalesce((select jsonb_agg(x order by x.last_at desc) from (
    select r.kind, coalesce(r.product_id, r.review_id, r.seller_id) as target,
      max(r.created_at) as last_at, count(*) as n, max(r.auto_action) as auto_action,
      jsonb_agg(jsonb_build_object('id', r.id, 'reason', r.reason, 'detail', r.detail, 'created_at', r.created_at) order by r.created_at desc) as items,
      s.id as seller_id, s.name as seller_name, s.slug as seller_slug, a.status as seller_status,
      p.title as product_title, p.slug as product_slug, p.moderation as product_moderation, p.photos[1] as product_photo,
      rv.stars as review_stars, rv.comment as review_comment, rv.buyer_name as review_by, rv.hidden as review_hidden
    from public.reports r
      join public.sellers s on s.id = r.seller_id
      left join public.seller_accounts a on a.seller_id = r.seller_id
      left join public.products p on p.id = r.product_id
      left join public.reviews rv on rv.id = r.review_id
    where r.status = p_status
    group by r.kind, coalesce(r.product_id, r.review_id, r.seller_id), s.id, s.name, s.slug, a.status, p.title, p.slug, p.moderation, p.photos[1],
      rv.stars, rv.comment, rv.buyer_name, rv.hidden
    limit 200) x), '[]'::jsonb);
end $$;

-- Admin: cerrar las denuncias de algo (resolver = actuaste; descartar = no pasaba nada).
create or replace function public.admin_report_close(p_kind text, p_target uuid, p_status text) returns void
language plpgsql security definer set search_path = '' as $$
declare uid uuid := public.admin_guard(); v_seller uuid; v_product uuid;
begin
  if p_status not in ('resuelto', 'descartado') then raise exception 'DATOS'; end if;
  select r.seller_id, r.product_id into v_seller, v_product from public.reports r
    where r.kind = p_kind and coalesce(r.product_id, r.review_id, r.seller_id) = p_target limit 1;
  update public.reports set status = p_status, resolved_at = now()
    where kind = p_kind and coalesce(product_id, review_id, seller_id) = p_target and status = 'nuevo';
  insert into public.admin_log (admin_id, action, seller_id, product_id, detail)
  values (uid, 'denuncia_' || p_status, v_seller, v_product, jsonb_build_object('tipo', p_kind));
end $$;

-- Admin: reseñas (para moderar).
create or replace function public.admin_reviews() returns jsonb
language plpgsql stable security definer set search_path = '' as $$
begin
  perform public.admin_guard();
  return coalesce((select jsonb_agg(x order by x.created_at desc) from (
    select r.id, r.stars, r.comment, r.buyer_name, r.hidden, r.created_at, s.name as seller_name, s.slug as seller_slug, p.title as product_title
    from public.reviews r join public.sellers s on s.id = r.seller_id left join public.products p on p.id = r.product_id
    order by r.created_at desc limit 200) x), '[]'::jsonb);
end $$;

-- Resumen del admin: cuántas denuncias nuevas hay.
create or replace function public.admin_reports_count() returns int
language sql stable security definer set search_path = '' as $$
  select case when public.is_admin() then (select count(distinct (kind, coalesce(product_id, review_id, seller_id)))::int from public.reports where status = 'nuevo') else 0 end
$$;

revoke execute on function public.admin_reports(text), public.admin_report_close(text, uuid, text), public.admin_reviews(), public.admin_reports_count() from public, anon;
grant execute on function public.admin_reports(text), public.admin_report_close(text, uuid, text), public.admin_reviews(), public.admin_reports_count() to authenticated;
