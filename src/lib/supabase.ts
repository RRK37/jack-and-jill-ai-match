import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = "https://khwwjvjsgsraaqjxemkw.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_bUeuaZLpppNRNc1JJ-TrbA_I2TvIb-e";

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
