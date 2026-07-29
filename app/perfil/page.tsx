'use client'
import { useState, useEffect, useRef } from 'react'
import AppLayout from '@/components/layout/AppLayout'
import { useAuth } from '@/contexts/AuthContext'
import { useHideValues } from '@/contexts/HideValuesContext'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { getCurrentMonth, formatCurrency } from '@/lib/utils'
import { Save, User, CheckCircle, DollarSign, Camera, ZoomIn, Crop } from 'lucide-react'

export default function PerfilPage() {
  const { user, loading, updateNome, signOut, currentView, setCurrentView } = useAuth()
  const { mask } = useHideValues()
  const router = useRouter()
  const { mes, ano } = getCurrentMonth()
  const [nome, setNome] = useState('')
  const [salario, setSalario] = useState('')
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null)
  const [uploading, setUploading] = useState(false)

  // Crop state
  const [showCropModal, setShowCropModal] = useState(false)
  const [cropImage, setCropImage] = useState<string | null>(null)
  const [cropFile, setCropFile] = useState<File | null>(null)
  const [zoom, setZoom] = useState(1)
  const [pan, setPan] = useState({ x: 0, y: 0 })
  const [isDragging, setIsDragging] = useState(false)
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 })
  const cropCanvasRef = useRef<HTMLCanvasElement>(null)
  const imageRef = useRef<HTMLImageElement | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!loading && !user) router.push('/login')
    if (user) {
      setNome(user.nome)
      loadSalario()
      loadAvatar()
    }
  }, [user, loading, router])

  async function loadAvatar() {
    if (!user) return
    const { data } = await supabase
      .from('perfis')
      .select('avatar_url')
      .eq('dono', user.dono)
      .order('updated_at', { ascending: false })
      .limit(1)
      .maybeSingle()
    if (data?.avatar_url) {
      setAvatarUrl(data.avatar_url)
    }
  }

  async function loadSalario() {
    const dono = currentView === 'conjunto' ? 'eu' : currentView
    const { data } = await supabase
      .from('rendas')
      .select('valor')
      .eq('dono', dono)
      .eq('mes', mes)
      .eq('ano', ano)
      .single()
    if (data?.valor) {
      setSalario(data.valor.toString())
    }
  }

  function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file || !user) return
    setCropFile(file)
    const reader = new FileReader()
    reader.onload = () => {
      setCropImage(reader.result as string)
      setZoom(1)
      setPan({ x: 0, y: 0 })
      setShowCropModal(true)
    }
    reader.readAsDataURL(file)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  function handleMouseDown(e: React.MouseEvent) {
    setIsDragging(true)
    setDragStart({ x: e.clientX - pan.x, y: e.clientY - pan.y })
  }

  function handleMouseMove(e: React.MouseEvent) {
    if (!isDragging) return
    setPan({ x: e.clientX - dragStart.x, y: e.clientY - dragStart.y })
  }

  function handleMouseUp() {
    setIsDragging(false)
  }

  const CROP_SIZE = 250

  function applyCrop(): Promise<Blob | null> {
    return new Promise((resolve) => {
      const img = new Image()
      img.onload = () => {
        const canvas = document.createElement('canvas')
        canvas.width = 256
        canvas.height = 256
        const ctx = canvas.getContext('2d')
        if (!ctx) { resolve(null); return }

        const imgW = img.naturalWidth
        const imgH = img.naturalHeight
        const containerSize = CROP_SIZE

        const scale = Math.max(containerSize / imgW, containerSize / imgH)
        const dispW = imgW * scale
        const dispH = imgH * scale
        const offsetX = (containerSize - dispW) / 2
        const offsetY = (containerSize - dispH) / 2

        const zoomedSize = containerSize / zoom
        const sx = Math.max(0, (containerSize / 2 - zoomedSize / 2 - pan.x + offsetX) / scale)
        const sy = Math.max(0, (containerSize / 2 - zoomedSize / 2 - pan.y + offsetY) / scale)
        const sw = Math.min(imgW - sx, zoomedSize / scale)
        const sh = Math.min(imgH - sy, zoomedSize / scale)

        ctx.drawImage(img, sx, sy, sw, sh, 0, 0, 256, 256)

        canvas.toBlob((blob) => resolve(blob), 'image/jpeg', 0.9)
      }
      img.src = cropImage || ''
    })
  }

  async function confirmCrop() {
    if (!cropFile || !user) return
    setUploading(true)
    setShowCropModal(false)
    try {
      const blob = await applyCrop()
      if (!blob) throw new Error('Erro ao processar imagem')

      const fileExt = cropFile.name.split('.').pop() || 'jpg'
      const fileName = `${user.dono}-${Date.now()}.${fileExt}`

      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(fileName, blob, { upsert: true, contentType: 'image/jpeg' })

      if (uploadError) throw uploadError

      const { data: { publicUrl } } = supabase.storage
        .from('avatars')
        .getPublicUrl(fileName)

      const { error: dbError } = await supabase.from('perfis').upsert(
        { id: user.id, dono: user.dono, nome: user.nome, avatar_url: publicUrl, updated_at: new Date().toISOString() },
        { onConflict: 'id' }
      )

      if (dbError) throw dbError

      setAvatarUrl(publicUrl)
    } catch (err) {
      console.error('Erro ao enviar avatar:', err)
      alert('Erro ao enviar foto. Veja o console (F12) para detalhes.')
    } finally {
      setUploading(false)
      setCropImage(null)
      setCropFile(null)
    }
  }

  async function handleSave() {
    if (!nome.trim()) return
    setSaving(true)
    await updateNome(nome.trim())

    if (salario) {
      const val = parseFloat(salario.replace(',', '.'))
      if (!isNaN(val)) {
        const dono = currentView === 'conjunto' ? 'eu' : currentView
        await supabase.from('rendas').upsert({
          user_id: user!.id,
          dono,
          mes,
          ano,
          valor: val,
        }, { onConflict: 'dono,mes,ano' })
      }
    }

    setSaving(false)
    setSaved(true)
    setTimeout(() => setSaved(false), 2500)
  }

  return (
    <AppLayout>
      <div className="page-header">
        <div>
          <h1 className="page-title">Meu Perfil & Configurações</h1>
          <p className="page-subtitle">Configure seu nome e seu salário mensal</p>
        </div>
      </div>

      <div style={{ maxWidth: 520 }}>
        <div className="card card-p" style={{ marginBottom: '1.25rem', display: 'flex', alignItems: 'center', gap: '1.25rem' }}>
          <div style={{ position: 'relative', flexShrink: 0 }}>
            {avatarUrl ? (
              <img
                src={avatarUrl}
                alt="Avatar"
                style={{
                  width: 64, height: 64,
                  borderRadius: '50%',
                  objectFit: 'cover',
                  display: 'block',
                }}
              />
            ) : (
              <div style={{
                width: 64, height: 64,
                background: 'linear-gradient(135deg, var(--color-primary), var(--color-primary-hover))',
                borderRadius: '50%',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                color: 'white', fontWeight: 800, fontSize: '1.5rem',
              }}>
                {nome?.[0]?.toUpperCase() || 'U'}
              </div>
            )}
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
              style={{
                position: 'absolute', bottom: -2, right: -2,
                width: 28, height: 28,
                borderRadius: '50%',
                border: '2px solid var(--color-bg)',
                background: 'var(--color-primary)',
                color: 'white',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                cursor: 'pointer', fontSize: 12,
                padding: 0,
              }}
              title="Alterar foto"
            >
              {uploading ? '...' : <Camera size={14} />}
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              style={{ display: 'none' }}
              onChange={handleFileSelect}
            />
          </div>
          <div>
            <div style={{ fontWeight: 700, fontSize: '1.1rem', color: 'var(--color-text)' }}>{nome || user?.nome}</div>
            <div style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)' }}>
              {user?.dono === 'eu' ? '👤 Meu Portal' : '👩 Portal da Esposa'}
            </div>
          </div>
        </div>

        <div className="card card-p" style={{ marginBottom: '1rem' }}>
          <h3 style={{ fontWeight: 700, marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--color-text)' }}>
            <User size={16} color="var(--color-primary)" />
            Seu Nome no App
          </h3>
          <div className="form-group" style={{ marginBottom: '1.25rem' }}>
            <label className="form-label">Nome de exibição</label>
            <input
              id="input-nome-perfil"
              className="form-input"
              value={nome}
              onChange={e => setNome(e.target.value)}
              placeholder="Ex: João, Eu, Marido..."
            />
          </div>

          <h3 style={{ fontWeight: 700, marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--color-text)' }}>
            <DollarSign size={16} color="var(--color-primary)" />
            Salário / Renda Mensal (R$)
          </h3>
          <div className="form-group" style={{ marginBottom: '1.25rem' }}>
            <label className="form-label">Qual é o seu salário mensal neste mês?</label>
            <input
              id="input-salario-perfil"
              type="number"
              step="0.01"
              className="form-input"
              value={salario}
              onChange={e => setSalario(e.target.value)}
              placeholder="Ex: 5000,00"
            />
            <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', marginTop: '0.375rem' }}>
              Este valor é usado no Dashboard para calcular quanto sobrou do mês.
            </div>
          </div>

          <div style={{ display: 'flex', gap: '0.75rem' }}>
            {saved ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--color-status-pago)', fontWeight: 600, fontSize: '0.875rem' }}>
                <CheckCircle size={18} />
                Dados salvos com sucesso!
              </div>
            ) : (
              <button
                id="btn-salvar-perfil"
                className="btn btn-primary"
                onClick={handleSave}
                disabled={saving || !nome.trim()}
              >
                <Save size={16} />
                {saving ? 'Salvando...' : 'Salvar Perfil & Salário'}
              </button>
            )}
          </div>
        </div>

        <div className="card card-p" style={{ borderColor: '#FECACA' }}>
          <h3 style={{ fontWeight: 700, marginBottom: '0.75rem', color: 'var(--color-text)' }}>🔐 Sessão</h3>
          <p style={{ fontSize: '0.875rem', color: 'var(--color-text-muted)', marginBottom: '1rem' }}>
            Para alternar de conta (Eu ↔ Esposa), saia para a tela inicial.
          </p>
          <button
            id="btn-sair-perfil"
            className="btn btn-danger btn-sm"
            onClick={signOut}
          >
            Sair do App
          </button>
        </div>
      </div>

      {showCropModal && cropImage && (
        <div className="modal-overlay" onClick={e => { if (e.target === e.currentTarget) { setShowCropModal(false); setCropImage(null) } }}>
          <div className="modal" style={{ maxWidth: 400 }}>
            <div className="modal-header">
              <h2 className="modal-title">Ajustar Foto</h2>
              <button className="btn btn-ghost btn-icon" onClick={() => { setShowCropModal(false); setCropImage(null) }}>✕</button>
            </div>
            <div className="modal-body" style={{ textAlign: 'center' }}>
              <div
                style={{
                  width: CROP_SIZE, height: CROP_SIZE,
                  margin: '0 auto 1rem',
                  borderRadius: '50%',
                  overflow: 'hidden',
                  position: 'relative',
                  cursor: isDragging ? 'grabbing' : 'grab',
                  background: '#000',
                  userSelect: 'none',
                }}
                onMouseDown={handleMouseDown}
                onMouseMove={handleMouseMove}
                onMouseUp={handleMouseUp}
                onMouseLeave={handleMouseUp}
              >
                <img
                  ref={imageRef as any}
                  src={cropImage}
                  alt="Crop preview"
                  draggable={false}
                  style={{
                    position: 'absolute',
                    top: '50%',
                    left: '50%',
                    transform: `translate(calc(-50% + ${pan.x / zoom}px), calc(-50% + ${pan.y / zoom}px)) scale(${zoom})`,
                    transformOrigin: 'center center',
                    width: '100%',
                    height: '100%',
                    objectFit: 'cover',
                    pointerEvents: 'none',
                  }}
                />
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
                <ZoomIn size={16} color="var(--color-text-muted)" />
                <input
                  type="range"
                  min="1"
                  max="3"
                  step="0.05"
                  value={zoom}
                  onChange={e => setZoom(parseFloat(e.target.value))}
                  style={{ flex: 1 }}
                />
                <ZoomIn size={16} color="var(--color-text-muted)" />
              </div>
              <p style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', margin: 0 }}>
                Arraste para reposicionar · Zoom para ajustar
              </p>
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => { setShowCropModal(false); setCropImage(null) }}>Cancelar</button>
              <button className="btn btn-primary" onClick={confirmCrop} disabled={uploading}>
                {uploading ? 'Salvando...' : 'Salvar Foto'}
              </button>
            </div>
          </div>
        </div>
      )}
    </AppLayout>
  )
}
