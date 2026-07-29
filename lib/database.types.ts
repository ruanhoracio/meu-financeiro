export type Database = {
  public: {
    Tables: {
      lancamentos: {
        Row: {
          id: string
          user_id: string
          dono: 'eu' | 'esposa' | 'conjunto'
          mes: number
          ano: number
          categoria_id: string | null
          descricao: string | null
          valor: number
          tipo: 'fixa' | 'parcela_unica' | 'parcelado'
          status: 'pago' | 'aguardando' | 'proximo_mes'
          data_vencimento: string | null
          parcela_atual: number | null
          parcelas_total: number | null
          origem: 'manual' | 'cartao'
          created_at: string
        }
        Insert: Omit<Database['public']['Tables']['lancamentos']['Row'], 'id' | 'created_at'>
        Update: Partial<Database['public']['Tables']['lancamentos']['Insert']>
      }
      categorias: {
        Row: {
          id: string
          nome: string
          icone: string | null
          cor: string | null
          keywords: string[] | null
          created_by: string | null
        }
        Insert: Omit<Database['public']['Tables']['categorias']['Row'], 'id'>
        Update: Partial<Database['public']['Tables']['categorias']['Insert']>
      }
      rendas: {
        Row: {
          id: string
          user_id: string
          dono: 'eu' | 'esposa'
          mes: number
          ano: number
          valor: number
        }
        Insert: Omit<Database['public']['Tables']['rendas']['Row'], 'id'>
        Update: Partial<Database['public']['Tables']['rendas']['Insert']>
      }
      cofrinhos: {
        Row: {
          id: string
          nome: string
          icone: string | null
          cor: string | null
          valor_alvo: number
          valor_atual: number
          descricao: string | null
          concluido: boolean | null
          data_fim: string | null
          created_at: string
        }
        Insert: Omit<Database['public']['Tables']['cofrinhos']['Row'], 'id' | 'created_at'>
        Update: Partial<Database['public']['Tables']['cofrinhos']['Insert']>
      }
      aportes_cofrinhos: {
        Row: {
          id: string
          cofrinho_id: string
          user_id: string
          dono: 'eu' | 'esposa'
          valor: number
          data: string
          observacao: string | null
        }
        Insert: Omit<Database['public']['Tables']['aportes_cofrinhos']['Row'], 'id'>
        Update: Partial<Database['public']['Tables']['aportes_cofrinhos']['Insert']>
      }
    }
  }
}

export type Lancamento = Database['public']['Tables']['lancamentos']['Row']
export type Categoria = Database['public']['Tables']['categorias']['Row']
export type Renda = Database['public']['Tables']['rendas']['Row']
export type Cofrinho = Database['public']['Tables']['cofrinhos']['Row']
export type AporteCofrinho = Database['public']['Tables']['aportes_cofrinhos']['Row']

export type DonoType = 'eu' | 'esposa' | 'conjunto'
export type StatusType = 'pago' | 'aguardando' | 'proximo_mes'
export type TipoType = 'fixa' | 'parcela_unica' | 'parcelado'
export type ViewType = 'eu' | 'esposa' | 'conjunto'
