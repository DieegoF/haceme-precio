-- Cada comprador tiene 3 intentos por producto (antes 2).
alter table public.offers drop constraint offers_attempt_check;
alter table public.offers add constraint offers_attempt_check check (attempt between 1 and 3);

create or replace function public.submit_offer(p_product uuid, p_token uuid, p_name text, p_contact text, p_amount integer)
returns jsonb language plpgsql security definer set search_path = '' as $function$
declare
  max_intentos constant integer := 3;
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
  where p.id = p_product for update of p;
  if not found or v_status <> 'activa' or v_mod <> 'ok' or v_acc not in ('prueba', 'activa', 'gracia') then raise exception 'NO_DISPONIBLE'; end if;
  if v_mode <> 'oferta' then raise exception 'PRECIO_FIJO'; end if;

  select count(*) into v_recent from public.offers where buyer_token = p_token and created_at > now() - interval '1 hour';
  if v_recent >= 20 then raise exception 'DEMASIADAS'; end if;
  select count(*), count(*) filter (where status in ('pendiente', 'contraoferta', 'aceptada'))
    into v_used, v_active from public.offers where product_id = p_product and buyer_token = p_token;
  if v_active > 0 then raise exception 'YA_TENES_UNA'; end if;
  if v_used >= max_intentos then raise exception 'SIN_INTENTOS'; end if;
  if exists (select 1 from public.offers where product_id = p_product and status = 'aceptada') then raise exception 'TRATO_EN_CURSO'; end if;

  if p_amount > v_list then p_amount := v_list; end if;
  select r.floor_price, r.auto_accept_pct into v_floor, v_pct from public.product_rules r where r.product_id = p_product;

  if v_pct is not null and p_amount >= ceil(v_list * v_pct / 100.0) then
    v_st := 'aceptada'; v_close := now() + interval '12 hours'; v_reason := 'auto';
  elsif v_floor is not null and p_amount < v_floor then
    v_st := 'rechazada_auto'; v_reason := 'bajo_minimo';
    v_sug := least(v_list, (ceil(v_floor * 1.03 / 1000.0) * 1000)::integer);
  else
    v_st := 'pendiente'; v_exp := now() + interval '12 hours';
  end if;

  insert into public.offers (product_id, seller_id, buyer_token, buyer_name, buyer_contact, amount, attempt, status, reason,
    suggested_amount, expires_at, close_by, decided_at)
  values (p_product, v_seller, p_token, p_name, p_contact, p_amount, v_used + 1, v_st, v_reason, v_sug, v_exp, v_close,
    case when v_st <> 'pendiente' then now() end)
  returning * into o;
  return public.offer_public(o) || jsonb_build_object('attempts_left', max_intentos - o.attempt);
end $function$;
