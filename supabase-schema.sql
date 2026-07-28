-- =============================================
-- MEU FINANCEIRO — Schema SQL Corrigido para Supabase
-- Copie e cole todo este texto no SQL Editor do Supabase e clique em RUN
-- =============================================

-- Habilitar extensão de UUID
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. TABELA DE PERFIS
CREATE TABLE IF NOT EXISTS perfis (
  id UUID PRIMARY KEY,
  dono TEXT NOT NULL UNIQUE CHECK (dono IN ('eu', 'esposa')),
  nome TEXT NOT NULL,
  avatar_url TEXT,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);


-- 2. TABELA DE CATEGORIAS
CREATE TABLE IF NOT EXISTS categorias (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  nome TEXT NOT NULL,
  icone TEXT DEFAULT '📦',
  cor TEXT DEFAULT '#820AD1',
  keywords TEXT[] DEFAULT '{}',
  created_by UUID,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. TABELA DE LANÇAMENTOS
CREATE TABLE IF NOT EXISTS lancamentos (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID,
  dono TEXT NOT NULL CHECK (dono IN ('eu', 'esposa', 'conjunto')),
  mes INTEGER NOT NULL CHECK (mes BETWEEN 1 AND 12),
  ano INTEGER NOT NULL,
  categoria_id UUID REFERENCES categorias ON DELETE SET NULL,
  descricao TEXT,
  valor DECIMAL(10,2) NOT NULL DEFAULT 0,
  tipo TEXT NOT NULL DEFAULT 'parcela_unica' CHECK (tipo IN ('fixa', 'parcela_unica', 'parcelado')),
  status TEXT NOT NULL DEFAULT 'aguardando' CHECK (status IN ('pago', 'aguardando', 'proximo_mes')),
  data_vencimento DATE,
  parcela_atual INTEGER DEFAULT NULL,
  parcelas_total INTEGER DEFAULT NULL,
  origem TEXT NOT NULL DEFAULT 'manual' CHECK (origem IN ('manual', 'cartao')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. TABELA DE RENDAS
CREATE TABLE IF NOT EXISTS rendas (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID,
  dono TEXT NOT NULL CHECK (dono IN ('eu', 'esposa')),
  mes INTEGER NOT NULL CHECK (mes BETWEEN 1 AND 12),
  ano INTEGER NOT NULL,
  valor DECIMAL(10,2) NOT NULL DEFAULT 0,
  UNIQUE(dono, mes, ano)
);

-- 5. TABELA DE COFRINHOS
CREATE TABLE IF NOT EXISTS cofrinhos (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  nome TEXT NOT NULL,
  icone TEXT DEFAULT '🏆',
  cor TEXT DEFAULT '#820AD1',
  valor_alvo DECIMAL(10,2) NOT NULL DEFAULT 0,
  valor_atual DECIMAL(10,2) NOT NULL DEFAULT 0,
  descricao TEXT,
  concluido BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 6. TABELA DE APORTES NOS COFRINHOS
CREATE TABLE IF NOT EXISTS aportes_cofrinhos (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  cofrinho_id UUID REFERENCES cofrinhos ON DELETE CASCADE NOT NULL,
  user_id UUID,
  dono TEXT NOT NULL CHECK (dono IN ('eu', 'esposa')),
  valor DECIMAL(10,2) NOT NULL DEFAULT 0,
  data DATE DEFAULT CURRENT_DATE,
  observacao TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================
-- REMOVER RESTRIÇÕES DE FOREIGN KEY RÍGIDAS
-- =============================================
ALTER TABLE perfis DROP CONSTRAINT IF EXISTS perfis_id_fkey;
ALTER TABLE lancamentos DROP CONSTRAINT IF EXISTS lancamentos_user_id_fkey;
ALTER TABLE rendas DROP CONSTRAINT IF EXISTS rendas_user_id_fkey;
ALTER TABLE aportes_cofrinhos DROP CONSTRAINT IF EXISTS aportes_cofrinhos_user_id_fkey;
ALTER TABLE categorias DROP CONSTRAINT IF EXISTS categorias_created_by_fkey;

ALTER TABLE lancamentos ALTER COLUMN user_id DROP NOT NULL;
ALTER TABLE rendas ALTER COLUMN user_id DROP NOT NULL;
ALTER TABLE aportes_cofrinhos ALTER COLUMN user_id DROP NOT NULL;

-- =============================================
-- DESABILITAR / AJUSTAR RLS PARA PERMITIR LEITURA E GRAVAÇÃO
-- =============================================
ALTER TABLE perfis ENABLE ROW LEVEL SECURITY;
ALTER TABLE categorias ENABLE ROW LEVEL SECURITY;
ALTER TABLE lancamentos ENABLE ROW LEVEL SECURITY;
ALTER TABLE rendas ENABLE ROW LEVEL SECURITY;
ALTER TABLE cofrinhos ENABLE ROW LEVEL SECURITY;
ALTER TABLE aportes_cofrinhos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Permitir tudo perfis" ON perfis;
DROP POLICY IF EXISTS "Permitir tudo categorias" ON categorias;
DROP POLICY IF EXISTS "Permitir tudo lancamentos" ON lancamentos;
DROP POLICY IF EXISTS "Permitir tudo rendas" ON rendas;
DROP POLICY IF EXISTS "Permitir tudo cofrinhos" ON cofrinhos;
DROP POLICY IF EXISTS "Permitir tudo aportes" ON aportes_cofrinhos;

DROP POLICY IF EXISTS "Usuários veem todos os perfis" ON perfis;
DROP POLICY IF EXISTS "Usuário edita próprio perfil" ON perfis;
DROP POLICY IF EXISTS "Todos veem categorias" ON categorias;
DROP POLICY IF EXISTS "Autenticados gerenciam categorias" ON categorias;
DROP POLICY IF EXISTS "Todos autenticados veem lancamentos" ON lancamentos;
DROP POLICY IF EXISTS "Autenticados criam lancamentos" ON lancamentos;
DROP POLICY IF EXISTS "Autenticados atualizam lancamentos" ON lancamentos;
DROP POLICY IF EXISTS "Autenticados deletam lancamentos" ON lancamentos;
DROP POLICY IF EXISTS "Todos autenticados veem rendas" ON rendas;
DROP POLICY IF EXISTS "Autenticados gerenciam rendas" ON rendas;
DROP POLICY IF EXISTS "Todos autenticados veem cofrinhos" ON cofrinhos;
DROP POLICY IF EXISTS "Autenticados gerenciam cofrinhos" ON cofrinhos;
DROP POLICY IF EXISTS "Todos autenticados veem aportes" ON aportes_cofrinhos;
DROP POLICY IF EXISTS "Autenticados gerenciam aportes" ON aportes_cofrinhos;

CREATE POLICY "Permitir tudo perfis" ON perfis FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Permitir tudo categorias" ON categorias FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Permitir tudo lancamentos" ON lancamentos FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Permitir tudo rendas" ON rendas FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Permitir tudo cofrinhos" ON cofrinhos FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Permitir tudo aportes" ON aportes_cofrinhos FOR ALL USING (true) WITH CHECK (true);

-- =============================================
-- TRIGGER DO COFRINHO
-- =============================================
CREATE OR REPLACE FUNCTION update_cofrinho_valor()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE cofrinhos SET valor_atual = valor_atual + NEW.valor WHERE id = NEW.cofrinho_id;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE cofrinhos SET valor_atual = valor_atual - OLD.valor WHERE id = OLD.cofrinho_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_cofrinho ON aportes_cofrinhos;
CREATE TRIGGER trigger_update_cofrinho
  AFTER INSERT OR DELETE ON aportes_cofrinhos
  FOR EACH ROW EXECUTE FUNCTION update_cofrinho_valor();

-- =============================================
-- CATEGORIAS PADRÃO INICIAIS
-- =============================================
INSERT INTO categorias (nome, icone, cor, keywords) VALUES
  ('Investimentos', '📈', '#10B981', ARRAY['xp', 'inter invest', 'cdb', 'tesouro', 'ações', 'nubank invest']),
  ('Apartamento', '🏠', '#6366F1', ARRAY['aluguel', 'condomínio', 'iptu', 'reforma', 'imóvel']),
  ('Mercado', '🛒', '#F59E0B', ARRAY['supermercado', 'extra', 'carrefour', 'pão de açúcar', 'atacadão', 'assai', 'hortifruti']),
  ('Alimentação', '🍔', '#EF4444', ARRAY['ifood', 'rappi', 'mcdonalds', 'burger', 'restaurante', 'lanche', 'padaria', 'pizza']),
  ('Transporte', '🚗', '#8B5CF6', ARRAY['uber', '99', 'combustível', 'gasolina', 'estacionamento', 'pedágio', 'táxi']),
  ('Saúde', '💊', '#EC4899', ARRAY['farmácia', 'drogasil', 'droga raia', 'consulta', 'plano de saúde', 'unimed', 'amil', 'médico']),
  ('Streaming', '📺', '#06B6D4', ARRAY['netflix', 'spotify', 'disney', 'amazon prime', 'hbo', 'apple tv', 'deezer', 'youtube']),
  ('Internet & Tel', '📱', '#3B82F6', ARRAY['claro', 'vivo', 'tim', 'oi', 'net', 'telefone', 'internet', 'celular']),
  ('Luz & Água & Gás', '💡', '#F97316', ARRAY['enel', 'sabesp', 'comgás', 'cemig', 'copel', 'luz', 'energia', 'água', 'gás']),
  ('Educação', '📚', '#84CC16', ARRAY['mensalidade', 'faculdade', 'curso', 'udemy', 'escola', 'livro', 'material']),
  ('Beleza', '💄', '#F43F5E', ARRAY['salão', 'cabelo', 'unha', 'sóbrancelha', 'beleza', 'maquiagem', 'cosmético', 'skin', 'estética']),
  ('Cartão de Crédito', '💳', '#F97316', ARRAY['cartão', 'cartao', 'credito', 'crédito', 'fatura', 'nubank', 'inter', 'elo', 'mastercard', 'visa'])
ON CONFLICT DO NOTHING;

-- =============================================
-- MIGRAÇÃO: Adicionar colunas de parcelas
-- =============================================
ALTER TABLE lancamentos ADD COLUMN IF NOT EXISTS parcela_atual INTEGER DEFAULT NULL;
ALTER TABLE lancamentos ADD COLUMN IF NOT EXISTS parcelas_total INTEGER DEFAULT NULL;

-- Migrar valores antigos: 'variavel' vira 'parcela_unica'
UPDATE lancamentos SET tipo = 'parcela_unica' WHERE tipo = 'variavel';

-- Atualizar CHECK constraint do tipo
ALTER TABLE lancamentos DROP CONSTRAINT IF EXISTS lancamentos_tipo_check;
ALTER TABLE lancamentos ADD CONSTRAINT lancamentos_tipo_check CHECK (tipo IN ('fixa', 'parcela_unica', 'parcelado'));

-- =============================================
-- MIGRAÇÃO: Adicionar coluna de origem
-- =============================================
ALTER TABLE lancamentos ADD COLUMN IF NOT EXISTS origem TEXT NOT NULL DEFAULT 'manual' CHECK (origem IN ('manual', 'cartao'));

-- =============================================
-- MIGRAÇÃO: Adicionar coluna de avatar
-- =============================================
ALTER TABLE perfis ADD COLUMN IF NOT EXISTS avatar_url TEXT;em IN ('manual', 'cartao'));
