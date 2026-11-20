-- Fase 4 · Renueva una vez por día los tokens de MP que vencen en menos de 30 días (Edge Function mp-refresh).
select cron.schedule('renovar-mp', '17 6 * * *', $cron$
  select net.http_post(url := (select value from public.app_settings where key = 'functions_url') || '/mp-refresh',
    body := '{}'::jsonb, headers := '{"Content-Type": "application/json"}'::jsonb, timeout_milliseconds := 30000);
$cron$);
