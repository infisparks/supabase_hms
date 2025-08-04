import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://medfordapis.infispark.in/'
const supabaseAnonKey = 'eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJpc3MiOiJzdXBhYmFzZSIsImlhdCI6MTc1NDMyMDc0MCwiZXhwIjo0OTA5OTk0MzQwLCJyb2xlIjoiYW5vbiJ9.cL44o9NQ7iv-aSXmlvae9xKuRtZlpoPfaDF3wuDHkZE';

export const supabase = createClient(supabaseUrl, supabaseAnonKey)
