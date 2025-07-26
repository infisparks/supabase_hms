import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://medfordapi.infispark.in'
const supabaseAnonKey = 'eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJpc3MiOiJzdXBhYmFzZSIsImlhdCI6MTc1MzU0Mjg0MCwiZXhwIjo0OTA5MjE2NDQwLCJyb2xlIjoiYW5vbiJ9.bhgZs435LM1Oiw3RALEsbrb7SgEY4222PPOpHGDVoIQ';

export const supabase = createClient(supabaseUrl, supabaseAnonKey)
