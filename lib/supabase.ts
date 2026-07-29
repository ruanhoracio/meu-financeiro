import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://kuuocgrbbfjyjhwfzwbd.supabase.co'
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imt1dW9jZ3JiYmZqeWpod2Z6d2JkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODUwNzU3MzEsImV4cCI6MjEwMDY1MTczMX0.YqCwYEqOVsfaMDdD2f6fZD8-MiKUZpYC6RhkZU5p2Rc'

export const supabase = createClient(supabaseUrl, supabaseAnonKey)
export const SUPABASE_URL = supabaseUrl
export const SUPABASE_ANON_KEY = supabaseAnonKey

export type UserProfile = {
  id: string
  email: string
  dono: 'eu' | 'esposa'
  nome: string
}
