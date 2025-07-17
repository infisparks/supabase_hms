import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://jdflvpzeqjvjtgywayby.supabase.co'
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpkZmx2cHplcWp2anRneXdheWJ5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDg3NTU0OTUsImV4cCI6MjA2NDMzMTQ5NX0.u1sqXbT7d4ceSswQqD5tLDZ8DpkG0l8KYY4m4aJpgZ0'

export const supabase = createClient(supabaseUrl, supabaseAnonKey)
