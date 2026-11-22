-- La comisión del plan Gratis empieza el 1 de enero de 2027 (00:00 hora argentina) en vez del 21 de febrero.
update public.app_settings set value = '2027-01-01T03:00:00Z' where key = 'commission_from';
