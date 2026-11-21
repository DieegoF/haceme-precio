-- =====================================================================
-- Ofertas con tiempos de la vida real: el vendedor tiene 12 h para responder una oferta y el
-- comprador 12 h para responder la contraoferta (antes 15 y 10 minutos). El trato aceptado sigue
-- con 12 h para cerrarse. La aceptación automática sigue siendo instantánea.
-- El vendedor ve el WhatsApp del comprador también al contraofertar, para poder avisarle.
-- =====================================================================
create or replace function public.submit_offer(p_product uuid, p_token uuid, p_name text, p_contact text, p_amount integer)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_seller uuid; v_list integer; v_status public.product_status; v_mode public.sale_mode; v_mod text; v_acc public.account_status;
  v_floor integer; v_pct integer; v_used integer; v_active integer; v_recent integer;
  v_st public.offer_status; v_sug integer; v_exp timestamptz; v_close timestamptz; v_reason text; o public.offers;
begin
  p_name := left(btrim(coalesce(p_name, '')), 40);
  p_contact := regexp_replace(coalesce(p_contact, ''), '\D', '', 'g');
  if p_token is null then raise exception 'SIN_TOKEN'; end if;
  if p_amount is null or p_amount <= 0 then raise exception 'OFERTA_INVALIDA'; end if;
  if char_length(p_name) < 2 then raise exception 'FALTA_NOMBRE'; end if;
  if char_length(p_contact) not between 8 and 15 then raise exception 'FALTA_CONTACTO'; end if;

  perform public.expire_offers();

  select p.seller_id, p.list_price, p.status, p.mode, p.moderation, a.status
    into v_seller, v_list, v_status, v_mode, v_mod, v_acc
  from public.products p join public.seller_accounts a on a.seller_id = p.seller_id
  where p.id = p_product for update of p;   -- serializa ofertas del mismo producto
  if not found or v_status <> 'activa' or v_mod <> 'ok' or v_acc not in ('prueba', 'activa', 'gracia') then raise exception 'NO_DISPONIBLE'; end if;
  if v_mode <> 'oferta' then raise exception 'PRECIO_FIJO'; end if;

  select count(*) into v_recent from public.offers where buyer_token = p_token and created_at > now() - interval '1 hour';
  if v_recent >= 20 then raise exception 'DEMASIADAS'; end if;
  select count(*), count(*) filter (where status in ('pendiente', 'contraoferta', 'aceptada'))
    into v_used, v_active from public.offers where product_id = p_product and buyer_token = p_token;
  if v_active > 0 then raise exception 'YA_TENES_UNA'; end if;
  if v_used >= 2 then raise exception 'SIN_INTENTOS'; end if;
  if exists (select 1 from public.offers where product_id = p_product and status = 'aceptada') then raise exception 'TRATO_EN_CURSO'; end if;

  if p_amount > v_list then p_amount := v_list; end if;
  select r.floor_price, r.auto_accept_pct into v_floor, v_pct from public.product_rules r where r.product_id = p_product;

  if v_pct is not null and p_amount >= ceil(v_list * v_pct / 100.0) then
    v_st := 'aceptada'; v_close := now() + interval '12 hours'; v_reason := 'auto';
  elsif v_floor is not null and p_amount < v_floor then
    v_st := 'rechazada_auto'; v_reason := 'bajo_minimo';
    v_sug := least(v_list, (ceil(v_floor * 1.03 / 1000.0) * 1000)::integer);   -- orienta sin mostrar el mínimo exacto
  else
    v_st := 'pendiente'; v_exp := now() + interval '12 hours';
  end if;

  insert into public.offers (product_id, seller_id, buyer_token, buyer_name, buyer_contact, amount, attempt, status, reason,
    suggested_amount, expires_at, close_by, decided_at)
  values (p_product, v_seller, p_token, p_name, p_contact, p_amount, v_used + 1, v_st, v_reason, v_sug, v_exp, v_close,
    case when v_st <> 'pendiente' then now() end)
  returning * into o;
  return public.offer_public(o) || jsonb_build_object('attempts_left', 2 - o.attempt);
end $$;

create or replace function public.seller_offer_action(p_offer uuid, p_action text, p_counter integer default null)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare uid uuid := auth.uid(); o public.offers; v_list integer; v_stock integer;
begin
  if uid is null then raise exception 'SIN_SESION'; end if;
  perform public.expire_offers();
  select * into o from public.offers where id = p_offer and seller_id = uid for update;
  if not found then raise exception 'NO_ENCONTRADA'; end if;
  select list_price into v_list from public.products where id = o.product_id for update;

  if p_action = 'aceptar' then
    if o.status <> 'pendiente' then raise exception 'YA_NO_VALE'; end if;
    if exists (select 1 from public.offers where product_id = o.product_id and status = 'aceptada') then raise exception 'TRATO_EN_CURSO'; end if;
    update public.offers set status = 'aceptada', close_by = now() + interval '12 hours', decided_at = now(), reason = 'vendedor' where id = o.id returning * into o;
  elsif p_action = 'rechazar' then
    if o.status <> 'pendiente' then raise exception 'YA_NO_VALE'; end if;
    update public.offers set status = 'rechazada', decided_at = now(), reason = 'vendedor' where id = o.id returning * into o;
  elsif p_action = 'contraofertar' then
    if o.status <> 'pendiente' then raise exception 'YA_NO_VALE'; end if;
    if p_counter is null or p_counter <= o.amount or p_counter > v_list then raise exception 'CONTRA_INVALIDA'; end if;
    update public.offers set status = 'contraoferta', counter_amount = p_counter, expires_at = now() + interval '12 hours', decided_at = now()
    where id = o.id returning * into o;
  elsif p_action = 'vendido' then
    if o.status <> 'aceptada' then raise exception 'YA_NO_VALE'; end if;
    update public.offers set status = 'vendida', closed_at = now() where id = o.id returning * into o;
    update public.products set stock = greatest(stock - 1, 0) where id = o.product_id returning stock into v_stock;
    if v_stock = 0 then
      update public.products set status = 'vendida' where id = o.product_id;
      update public.offers set status = 'rechazada', decided_at = now(), reason = 'vendido_a_otro'
      where product_id = o.product_id and status in ('pendiente', 'contraoferta');
    end if;
  elsif p_action = 'liberar' then
    if o.status <> 'aceptada' then raise exception 'YA_NO_VALE'; end if;
    update public.offers set status = 'cancelada', closed_at = now(), reason = 'se_cayo' where id = o.id returning * into o;
  else
    raise exception 'ACCION_INVALIDA';
  end if;
  return public.offer_public(o);
end $$;

create or replace function public.get_seller_offers()
returns jsonb language plpgsql security definer set search_path = '' as $$
declare uid uuid := auth.uid();
begin
  if uid is null then raise exception 'SIN_SESION'; end if;
  perform public.expire_offers();
  return coalesce((
    select jsonb_agg(jsonb_build_object(
      'id', o.id, 'product_id', o.product_id, 'product_title', p.title, 'product_slug', p.slug, 'product_photo', p.photos[1],
      'list_price', p.list_price, 'floor_price', r.floor_price, 'amount', o.amount, 'attempt', o.attempt, 'status', o.status,
      'reason', o.reason, 'counter_amount', o.counter_amount, 'expires_at', o.expires_at, 'close_by', o.close_by,
      'created_at', o.created_at, 'decided_at', o.decided_at, 'buyer_name', o.buyer_name,
      'buyer_contact', case when o.status in ('contraoferta', 'aceptada', 'vendida') then o.buyer_contact end
    ) order by o.created_at desc)
    from public.offers o join public.products p on p.id = o.product_id left join public.product_rules r on r.product_id = o.product_id
    where o.seller_id = uid and o.created_at > now() - interval '60 days'), '[]'::jsonb);
end $$;

-- =====================================================================
-- Plan «una sola cosa»: 2 publicaciones gratis (antes 1). Desde la 3ª, pase de $5.000
-- o pasarse al Básico (que en ese caso arranca pagando, sin prueba: lo aplica el paso de suscripciones).
-- =====================================================================
alter table public.seller_accounts add column free_passes_used integer not null default 0 check (free_passes_used between 0 and 2);
revoke update (free_passes_used) on public.seller_accounts from authenticated, anon;
update public.seller_accounts set free_passes_used = 1 where free_pass_used_at is not null;

create or replace function public.check_product_quota() returns trigger
language plpgsql security definer set search_path = '' as $$
declare acc record; activos int;
begin
  select a.plan, a.status, a.free_passes_used, a.pass_credits into acc
    from public.seller_accounts a where a.seller_id = new.seller_id for update;
  if new.status = 'activa' and (tg_op = 'INSERT' or old.status is distinct from 'activa') then
    if acc.status not in ('prueba', 'activa', 'gracia') then
      raise exception 'PLAN_INACTIVO: Tu plan no está activo. Renovalo para publicar.';
    end if;
    if acc.plan = 'pase' then
      select count(*) into activos from public.products p where p.seller_id = new.seller_id and p.status = 'activa' and p.id <> new.id;
      if activos >= 1 then raise exception 'LIMITE_PASE: El pase permite una sola publicación activa.'; end if;
      if tg_op = 'INSERT' then
        if acc.free_passes_used < 2 then
          update public.seller_accounts set free_passes_used = free_passes_used + 1, free_pass_used_at = now() where seller_id = new.seller_id;
        elsif acc.pass_credits > 0 then
          update public.seller_accounts set pass_credits = pass_credits - 1 where seller_id = new.seller_id;
        else
          raise exception 'PASE_PAGO: Ya usaste tus 2 publicaciones gratis. Para publicar otra, pagá el pase de $5.000 o pasate al Básico.';
        end if;
      end if;
    end if;
  end if;
  if (select s.name from public.sellers s where s.id = new.seller_id) is null then
    raise exception 'SIN_PERFIL: Completá tu nombre y tu link antes de publicar.';
  end if;
  return new;
end $$;
