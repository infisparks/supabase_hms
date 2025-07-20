import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://medford-supabase.infispark.in'
const supabaseAnonKey = 'eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJpc3MiOiJzdXBhYmFzZSIsImlhdCI6MTc1MjkyNDM2MCwiZXhwIjo0OTA4NTk3OTYwLCJyb2xlIjoiYW5vbiJ9.1lhmETxL5Ao_WGcN5W7hXCE4hmtMUQHO0ai5zBCuC0A';

export const supabase = createClient(supabaseUrl, supabaseAnonKey)
