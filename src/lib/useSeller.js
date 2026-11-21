import { useCallback, useEffect, useState } from "react";
import { supabase } from "./supabase.js";
import { useAuth } from "./auth.jsx";

// Trae el perfil público (sellers) y la cuenta privada (seller_accounts) del usuario logueado.
export function useSeller() {
  const { session } = useAuth();
  const uid = session?.user?.id;
  const [state, setState] = useState({ loading: true, seller: null, account: null, store: null, error: null });
  const load = useCallback(async () => {
    if (!uid) return;
    const [s, a, st] = await Promise.all([
      supabase.from("sellers").select("id, name, slug, is_store, phone_verified").eq("id", uid).maybeSingle(),
      supabase.from("seller_accounts").select("plan, status, trial_ends_at, period_end, cancel_at, free_pass_used_at, pass_credits, is_admin").eq("seller_id", uid).maybeSingle(),
      supabase.from("stores").select("*").eq("seller_id", uid).maybeSingle(),
    ]);
    setState({ loading: false, seller: s.data, account: a.data, store: st.data, error: s.error || a.error });
  }, [uid]);
  useEffect(() => { load(); }, [load]);
  return { ...state, reload: load };
}
