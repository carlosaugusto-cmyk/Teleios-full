import { useState, useEffect, useCallback } from 'react';
import {
  LogOut,
  Edit3,
  Save,
  Plus,
  Heart,
  Copy,
  Check,
  X,
  Church,
  Clock,
  Sparkles,
} from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import { getCurrentUser, isLoggedIn, logout, updateProfile } from '@/lib/auth';
import {
  fetchUserPrayers,
  submitAppPrayer,
  fetchUserDonations,
  submitAppDonation,
  fetchConfigPublic,
  type PrayerItem,
  type DonationItem,
} from '@/lib/api';
import { generatePixPayload } from '@/lib/pixPayload';
import { getPrayerRequests, getDonations, addPrayerRequest, addDonation, type TheleiosUser } from '@/lib/storage';
import LoginModal from '@/components/LoginModal';

export default function PerfilPage() {
  const [user, setUser] = useState<TheleiosUser | null>(() => getCurrentUser());
  const [loggedIn, setLoggedIn] = useState(isLoggedIn());
  const [showLogin, setShowLogin] = useState(false);

  // ─── Edição do Perfil (Recolhido por padrão) ────────────────────────────────
  const [isEditing, setIsEditing] = useState(false);
  const [name, setName] = useState(user?.name ?? '');
  const [phone, setPhone] = useState(user?.phone ?? '');
  const [church, setChurch] = useState(user?.church ?? '');
  const [photoUrl, setPhotoUrl] = useState(user?.photoUrl ?? '');
  const [isBaptized, setIsBaptized] = useState(user?.isBaptized ?? false);
  const [timeAsBeliever, setTimeAsBeliever] = useState(user?.timeAsBeliever ?? '');
  const [inDiscipleship, setInDiscipleship] = useState(user?.inDiscipleship ?? false);
  const [disciplerName, setDisciplerName] = useState(user?.disciplerName ?? '');
  const [notes, setNotes] = useState(user?.notes ?? '');
  const [saved, setSaved] = useState(false);

  // ─── Listas de Orações e Doações ───────────────────────────────────────────
  const [prayers, setPrayers] = useState<PrayerItem[]>([]);
  const [donations, setDonations] = useState<DonationItem[]>([]);
  const [loadingPrayers, setLoadingPrayers] = useState(false);
  const [loadingDonations, setLoadingDonations] = useState(false);

  // ─── Modal Pedido de Oração ────────────────────────────────────────────────
  const [showPrayerModal, setShowPrayerModal] = useState(false);
  const [prayerTitle, setPrayerTitle] = useState('');
  const [prayerDesc, setPrayerDesc] = useState('');
  const [prayerDate, setPrayerDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [isSubmittingPrayer, setIsSubmittingPrayer] = useState(false);
  const [prayerFeedback, setPrayerFeedback] = useState<string | null>(null);

  // ─── Modal Doação Pix ──────────────────────────────────────────────────────
  const [showDonationModal, setShowDonationModal] = useState(false);
  const [donationStep, setDonationStep] = useState<'amount' | 'qrcode'>('amount');
  const [selectedAmount, setSelectedAmount] = useState<number>(20);
  const [customAmount, setCustomAmount] = useState<string>('');
  const [pixPayload, setPixPayload] = useState<string>('');
  const [copiedPix, setCopiedPix] = useState(false);
  const [isGeneratingPix, setIsGeneratingPix] = useState(false);
  const [donationError, setDonationError] = useState<string | null>(null);

  // ─── Carregar orações e doações do usuário (sem loop de re-renderização) ────
  const userPhone = user?.phone;
  const loadUserData = useCallback(async () => {
    if (!userPhone) return;
    setLoadingPrayers(true);
    setLoadingDonations(true);

    try {
      // Orações
      const prayersData = await fetchUserPrayers(userPhone);
      if (prayersData && prayersData.length > 0) {
        setPrayers(prayersData);
      } else {
        // Fallback local
        const localPr = getPrayerRequests();
        setPrayers(
          localPr.map((p) => ({
            id: p.id,
            name: p.name,
            phone: p.phone,
            title: p.name,
            request: '',
            date: p.createdAt.split('T')[0],
            status: 'PENDENTE',
            createdAt: p.createdAt,
          }))
        );
      }

      // Doações
      const donationsData = await fetchUserDonations(userPhone);
      if (donationsData && donationsData.length > 0) {
        setDonations(donationsData);
      } else {
        // Fallback local
        const localDn = getDonations();
        setDonations(
          localDn.map((d) => ({
            id: d.id,
            name: d.name,
            phone: d.phone,
            amount: d.amount,
            status: 'PENDENTE',
            createdAt: d.createdAt,
          }))
        );
      }
    } catch {
      // Silencioso
    } finally {
      setLoadingPrayers(false);
      setLoadingDonations(false);
    }
  }, [userPhone]);

  useEffect(() => {
    if (loggedIn && userPhone) {
      loadUserData();
    }
  }, [loggedIn, userPhone, loadUserData]);

  // ─── Salvar Perfil ─────────────────────────────────────────────────────────
  const handleSaveProfile = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    const updated = updateProfile({
      name,
      phone,
      church,
      photoUrl,
      isBaptized,
      timeAsBeliever,
      inDiscipleship,
      disciplerName,
      notes,
    });

    if (updated) {
      setUser(updated);
    }

    setSaved(true);
    setTimeout(() => {
      setSaved(false);
      setIsEditing(false);
    }, 1200);
  };

  const handleLogout = () => {
    logout();
    setUser(null);
    setLoggedIn(false);
    setIsEditing(false);
    setPrayers([]);
    setDonations([]);
  };

  const handleLoginSuccess = () => {
    setShowLogin(false);
    setLoggedIn(true);
    const u = getCurrentUser();
    if (u) {
      setUser(u);
      setName(u.name);
      setPhone(u.phone);
      setChurch(u.church);
      setPhotoUrl(u.photoUrl || '');
      setIsBaptized(u.isBaptized || false);
      setTimeAsBeliever(u.timeAsBeliever || '');
      setInDiscipleship(u.inDiscipleship || false);
      setDisciplerName(u.disciplerName || '');
      setNotes(u.notes || '');
    }
  };

  // ─── Submeter Pedido de Oração ─────────────────────────────────────────────
  const handleSubmitPrayer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!prayerTitle.trim() || !prayerDesc.trim()) {
      setPrayerFeedback('Por favor, preencha o título e o motivo da oração.');
      return;
    }

    setIsSubmittingPrayer(true);
    setPrayerFeedback(null);

    const currentUser = getCurrentUser();
    const newPrayerItem: PrayerItem = {
      id: `prayer_${Date.now()}`,
      userId: currentUser?.phone,
      name: currentUser?.name || name || 'Membro',
      phone: currentUser?.phone || phone || '',
      title: prayerTitle.trim(),
      request: prayerDesc.trim(),
      date: prayerDate || new Date().toISOString().split('T')[0],
      status: 'PENDENTE',
      createdAt: new Date().toISOString(),
    };

    try {
      const res = await submitAppPrayer({
        name: newPrayerItem.name,
        phone: newPrayerItem.phone,
        title: newPrayerItem.title,
        request: newPrayerItem.request,
        date: newPrayerItem.date,
      });

      if (res.success && res.data) {
        setPrayers((prev) => [res.data!, ...prev]);
      } else {
        setPrayers((prev) => [newPrayerItem, ...prev]);
      }

      // Salva no storage local também
      addPrayerRequest({
        id: newPrayerItem.id,
        name: `${newPrayerItem.title}: ${newPrayerItem.request}`,
        phone: newPrayerItem.phone,
        createdAt: newPrayerItem.createdAt || new Date().toISOString(),
      });

      setPrayerTitle('');
      setPrayerDesc('');
      setShowPrayerModal(false);
    } catch {
      setPrayers((prev) => [newPrayerItem, ...prev]);
      setShowPrayerModal(false);
    } finally {
      setIsSubmittingPrayer(false);
    }
  };

  // ─── Gerar Doação Pix ──────────────────────────────────────────────────────
  const handleGeneratePix = async () => {
    setDonationError(null);
    const amountVal = customAmount ? parseFloat(customAmount.replace(',', '.')) : selectedAmount;

    if (!amountVal || isNaN(amountVal) || amountVal <= 0) {
      setDonationError('Informe um valor de doação válido.');
      return;
    }

    setIsGeneratingPix(true);
    try {
      const pubConfig = await fetchConfigPublic();
      const pix = pubConfig?.pix;

      if (!pix || !pix.key) {
        setDonationError('A chave Pix oficial da igreja ainda não foi configurada pela administração.');
        setIsGeneratingPix(false);
        return;
      }

      const txid = `APP${Date.now().toString().slice(-8)}`;
      const payload = generatePixPayload({
        key: pix.key,
        keyType: pix.keyType,
        receiverName: pix.receiverName || 'MINISTERIO TELEIOS',
        receiverCity: pix.receiverCity || 'SAO PAULO',
        amount: amountVal,
        txid: txid,
        description: pix.description || 'Doacao Ministerio Teleios',
      });

      setPixPayload(payload);
      setDonationStep('qrcode');

      // Registra a doação no backend com status PENDENTE
      const currentUser = getCurrentUser();
      const newDonationItem: DonationItem = {
        id: `don_${Date.now()}`,
        name: currentUser?.name || name || 'Anônimo',
        phone: currentUser?.phone || phone || '',
        amount: amountVal,
        txid: txid,
        status: 'PENDENTE',
        createdAt: new Date().toISOString(),
      };

      try {
        const res = await submitAppDonation({
          name: newDonationItem.name,
          phone: newDonationItem.phone,
          amount: newDonationItem.amount,
          txid: newDonationItem.txid,
        });

        if (res.success && res.data) {
          setDonations((prev) => [res.data!, ...prev]);
        } else {
          setDonations((prev) => [newDonationItem, ...prev]);
        }
      } catch {
        setDonations((prev) => [newDonationItem, ...prev]);
      }

      // Salva no storage local
      addDonation({
        id: newDonationItem.id,
        name: newDonationItem.name,
        phone: newDonationItem.phone,
        amount: newDonationItem.amount,
        createdAt: newDonationItem.createdAt || new Date().toISOString(),
      });
    } catch {
      setDonationError('Erro ao gerar cobrança Pix. Verifique sua conexão e tente novamente.');
    } finally {
      setIsGeneratingPix(false);
    }
  };

  const handleCopyPix = () => {
    if (!pixPayload) return;
    navigator.clipboard.writeText(pixPayload);
    setCopiedPix(true);
    setTimeout(() => setCopiedPix(false), 2500);
  };

  const handleCloseDonationModal = () => {
    setShowDonationModal(false);
    setDonationStep('amount');
    setCustomAmount('');
    setPixPayload('');
    setDonationError(null);
  };

  // ─── Não Logado ────────────────────────────────────────────────────────────
  if (!loggedIn) {
    return (
      <div className="flex flex-col items-center justify-center gap-5 px-6 py-16 text-center">
        <div className="w-16 h-16 rounded-full bg-[var(--color-surface-alt)] flex items-center justify-center">
          <span className="text-2xl">👤</span>
        </div>
        <div>
          <h2 className="text-lg font-semibold text-[var(--color-text)] mb-2">Entre na sua conta</h2>
          <p className="text-sm text-[var(--color-text-muted)] max-w-xs">
            Ao se cadastrar, você poderá salvar seu progresso de leitura, acompanhar seus pedidos de oração e contribuições.
          </p>
        </div>
        <button
          onClick={() => setShowLogin(true)}
          className="px-8 py-3 bg-[var(--color-primary)] text-white font-semibold rounded-xl hover:bg-[var(--color-primary)]/90 transition-colors"
        >
          Entrar / Criar conta
        </button>

        <LoginModal
          open={showLogin}
          onClose={() => setShowLogin(false)}
          onSuccess={handleLoginSuccess}
        />
      </div>
    );
  }

  // ─── Usuário Logado ────────────────────────────────────────────────────────
  return (
    <div className="flex flex-col gap-5 p-4 max-w-lg mx-auto w-full pb-20">
      {/* ─── 1. CABEÇALHO COMPACTO & LIMPO ──────────────────────────────────── */}
      <div className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-2xl p-4 sm:p-5 shadow-sm">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3.5 min-w-0">
            {user?.photoUrl ? (
              <img
                src={user.photoUrl}
                alt={user.name}
                className="w-13 h-13 rounded-full object-cover border-2 border-[var(--color-primary)] shrink-0"
              />
            ) : (
              <div className="w-13 h-13 rounded-full bg-gradient-to-br from-[var(--color-primary)]/30 to-[var(--color-primary)]/60 border border-[var(--color-primary)]/50 flex items-center justify-center shrink-0">
                <span className="text-lg font-bold text-white">
                  {(user?.name || name || 'U').charAt(0).toUpperCase()}
                </span>
              </div>
            )}
            <div className="min-w-0">
              <h2 className="text-base font-bold text-[var(--color-text)] truncate">
                {user?.name || name}
              </h2>
              <p className="text-xs text-[var(--color-text-muted)] truncate flex items-center gap-1.5 mt-0.5">
                <Church size={13} className="shrink-0 text-[var(--color-primary-light)]" />
                <span>{user?.church || church || 'Membro da Comunidade'}</span>
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={() => setIsEditing(!isEditing)}
              className="px-3 py-1.5 text-xs font-semibold rounded-xl bg-[var(--color-surface-alt)] hover:bg-[var(--color-border)] text-[var(--color-text)] border border-[var(--color-border)] transition-colors flex items-center gap-1.5 cursor-pointer"
            >
              <Edit3 size={13} />
              <span>{isEditing ? 'Fechar' : 'Editar'}</span>
            </button>
            <button
              onClick={handleLogout}
              className="p-2 text-xs font-semibold rounded-xl text-red-400 hover:bg-red-500/10 hover:text-red-300 transition-colors cursor-pointer"
              title="Sair da conta"
            >
              <LogOut size={16} />
            </button>
          </div>
        </div>

        {/* ─── FORMULÁRIO DE EDIÇÃO RECOLHIDO POR PADRÃO ───────────────────── */}
        {isEditing && (
          <form onSubmit={handleSaveProfile} className="mt-4 pt-4 border-t border-[var(--color-border)] space-y-3.5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-[var(--color-text-muted)]">
                Editar Dados do Perfil
              </span>
              {saved && (
                <span className="text-xs font-semibold text-emerald-400 flex items-center gap-1">
                  <Check size={13} /> Dados salvos!
                </span>
              )}
            </div>

            <div>
              <label className="block text-xs text-[var(--color-text-muted)] mb-1">Nome Completo</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-[var(--color-surface-alt)] border border-[var(--color-border)] rounded-xl text-[var(--color-text)] text-sm focus:outline-none focus:border-[var(--color-primary)]"
                placeholder="Seu nome"
                required
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-[var(--color-text-muted)] mb-1">Telefone / WhatsApp</label>
                <input
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-[var(--color-surface-alt)] border border-[var(--color-border)] rounded-xl text-[var(--color-text)] text-sm focus:outline-none focus:border-[var(--color-primary)]"
                  placeholder="(00) 00000-0000"
                />
              </div>

              <div>
                <label className="block text-xs text-[var(--color-text-muted)] mb-1">Igreja / Congregação</label>
                <input
                  type="text"
                  value={church}
                  onChange={(e) => setChurch(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-[var(--color-surface-alt)] border border-[var(--color-border)] rounded-xl text-[var(--color-text)] text-sm focus:outline-none focus:border-[var(--color-primary)]"
                  placeholder="Nome da igreja"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs text-[var(--color-text-muted)] mb-1">Foto de Perfil (URL da Imagem)</label>
              <input
                type="url"
                value={photoUrl}
                onChange={(e) => setPhotoUrl(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-[var(--color-surface-alt)] border border-[var(--color-border)] rounded-xl text-[var(--color-text)] text-sm focus:outline-none focus:border-[var(--color-primary)]"
                placeholder="https://exemplo.com/foto.jpg"
              />
            </div>

            {/* Caminhada Cristã */}
            <div className="pt-2 border-t border-[var(--color-border)]/60 space-y-3">
              <span className="block text-xs font-bold text-[var(--color-text-muted)]">Caminhada Cristã & Discipulado</span>

              <div className="flex items-center gap-3">
                <label className="flex items-center gap-2 text-xs text-[var(--color-text)] cursor-pointer">
                  <input
                    type="checkbox"
                    checked={isBaptized}
                    onChange={(e) => setIsBaptized(e.target.checked)}
                    className="rounded border-[var(--color-border)] text-[var(--color-primary)] focus:ring-0"
                  />
                  <span>É batizado nas águas?</span>
                </label>

                <label className="flex items-center gap-2 text-xs text-[var(--color-text)] cursor-pointer ml-auto">
                  <input
                    type="checkbox"
                    checked={inDiscipleship}
                    onChange={(e) => setInDiscipleship(e.target.checked)}
                    className="rounded border-[var(--color-border)] text-[var(--color-primary)] focus:ring-0"
                  />
                  <span>Faz discipulado?</span>
                </label>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-[var(--color-text-muted)] mb-1">Tempo de crente</label>
                  <input
                    type="text"
                    value={timeAsBeliever}
                    onChange={(e) => setTimeAsBeliever(e.target.value)}
                    className="w-full px-3.5 py-2 bg-[var(--color-surface-alt)] border border-[var(--color-border)] rounded-xl text-[var(--color-text)] text-xs focus:outline-none focus:border-[var(--color-primary)]"
                    placeholder="Ex: 2 anos, Desde a infância"
                  />
                </div>

                <div>
                  <label className="block text-xs text-[var(--color-text-muted)] mb-1">Nome do Discipulador</label>
                  <input
                    type="text"
                    value={disciplerName}
                    onChange={(e) => setDisciplerName(e.target.value)}
                    className="w-full px-3.5 py-2 bg-[var(--color-surface-alt)] border border-[var(--color-border)] rounded-xl text-[var(--color-text)] text-xs focus:outline-none focus:border-[var(--color-primary)]"
                    placeholder="Quem te acompanha"
                  />
                </div>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setIsEditing(false)}
                className="px-4 py-2 text-xs text-[var(--color-text-muted)] hover:text-white rounded-xl transition-colors cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="submit"
                className="px-5 py-2 bg-[var(--color-primary)] hover:bg-[var(--color-primary)]/90 text-white font-semibold text-xs rounded-xl transition-colors flex items-center gap-1.5 cursor-pointer shadow"
              >
                <Save size={13} />
                <span>Salvar alterações</span>
              </button>
            </div>
          </form>
        )}
      </div>

      {/* ─── 2. SEÇÃO: PEDIDOS DE ORAÇÃO ────────────────────────────────────── */}
      <section className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-2xl p-4 sm:p-5 shadow-sm space-y-4">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Heart size={18} className="text-rose-400" />
            <h3 className="font-bold text-sm text-[var(--color-text)]">Minhas Orações</h3>
          </div>

          <button
            onClick={() => setShowPrayerModal(true)}
            className="px-3 py-1.5 bg-[var(--color-primary)] hover:bg-[var(--color-primary)]/90 text-white text-xs font-bold rounded-xl transition-all flex items-center gap-1 cursor-pointer shadow-sm"
          >
            <Plus size={14} />
            <span>+ Adicionar oração</span>
          </button>
        </div>

        {loadingPrayers ? (
          <p className="text-xs text-[var(--color-text-muted)] py-3 text-center">Carregando orações...</p>
        ) : prayers.length === 0 ? (
          <div className="text-center py-6 border border-dashed border-[var(--color-border)] rounded-xl">
            <p className="text-xs text-[var(--color-text-muted)]">Nenhum pedido de oração cadastrado ainda.</p>
            <p className="text-[11px] text-[var(--color-text-muted)]/70 mt-1">
              Compartilhe seu motivo de oração e intercederemos por você!
            </p>
          </div>
        ) : (
          <div className="space-y-2.5">
            {prayers.map((p) => {
              const statusBadge =
                p.status === 'ATENDIDO'
                  ? 'bg-emerald-950/70 border-emerald-800 text-emerald-300'
                  : p.status === 'EM_ORACAO'
                  ? 'bg-purple-950/70 border-purple-800 text-purple-300'
                  : 'bg-amber-950/70 border-amber-800 text-amber-300';

              const statusLabel =
                p.status === 'ATENDIDO' ? 'Atendido' : p.status === 'EM_ORACAO' ? 'Em Oração' : 'Pendente';

              return (
                <div
                  key={p.id}
                  className="p-3 bg-[var(--color-surface-alt)] border border-[var(--color-border)] rounded-xl space-y-1.5"
                >
                  <div className="flex items-start justify-between gap-2">
                    <h4 className="text-xs font-bold text-[var(--color-text)] leading-tight">{p.title}</h4>
                    <span className={`px-2 py-0.5 text-[10px] font-bold border rounded-full shrink-0 ${statusBadge}`}>
                      {statusLabel}
                    </span>
                  </div>
                  {p.request && <p className="text-xs text-[var(--color-text-muted)] leading-relaxed">{p.request}</p>}
                  <div className="flex items-center gap-1 text-[10px] text-[var(--color-text-muted)]/70 pt-0.5">
                    <Clock size={11} />
                    <span>{p.date ? new Date(p.date).toLocaleDateString('pt-BR') : 'Hoje'}</span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* ─── 3. SEÇÃO: DOAÇÕES & CONTRIBUIÇÕES ───────────────────────────────── */}
      <section className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-2xl p-4 sm:p-5 shadow-sm space-y-4">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Sparkles size={18} className="text-emerald-400" />
            <h3 className="font-bold text-sm text-[var(--color-text)]">Minhas Doações</h3>
          </div>

          <button
            onClick={() => {
              setShowDonationModal(true);
              setDonationStep('amount');
              setDonationError(null);
            }}
            className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl transition-all flex items-center gap-1 cursor-pointer shadow-sm"
          >
            <Plus size={14} />
            <span>+ Fazer doação</span>
          </button>
        </div>

        {loadingDonations ? (
          <p className="text-xs text-[var(--color-text-muted)] py-3 text-center">Carregando doações...</p>
        ) : donations.length === 0 ? (
          <div className="text-center py-6 border border-dashed border-[var(--color-border)] rounded-xl">
            <p className="text-xs text-[var(--color-text-muted)]">Nenhuma doação registrada até o momento.</p>
            <p className="text-[11px] text-[var(--color-text-muted)]/70 mt-1">
              Sua contribuição voluntária ajuda a propagar os estudos e a palavra.
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {donations.map((d) => {
              const statusBadge =
                d.status === 'CONFIRMADO'
                  ? 'bg-emerald-950/70 border-emerald-800 text-emerald-300'
                  : d.status === 'CANCELADO'
                  ? 'bg-rose-950/70 border-rose-800 text-rose-300'
                  : 'bg-amber-950/70 border-amber-800 text-amber-300';

              const statusLabel =
                d.status === 'CONFIRMADO' ? 'Confirmado' : d.status === 'CANCELADO' ? 'Cancelado' : 'Pendente';

              return (
                <div
                  key={d.id}
                  className="flex items-center justify-between p-3 bg-[var(--color-surface-alt)] border border-[var(--color-border)] rounded-xl"
                >
                  <div>
                    <span className="text-sm font-bold text-emerald-400">
                      R$ {Number(d.amount).toFixed(2).replace('.', ',')}
                    </span>
                    <p className="text-[10px] text-[var(--color-text-muted)] mt-0.5">
                      {d.createdAt ? new Date(d.createdAt).toLocaleDateString('pt-BR') : 'Recente'}
                    </p>
                  </div>
                  <span className={`px-2 py-0.5 text-[10px] font-bold border rounded-full ${statusBadge}`}>
                    {statusLabel}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* ─── MODAL: ADICIONAR ORAÇÃO ────────────────────────────────────────── */}
      {showPrayerModal && (
        <div
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/70 p-0 sm:p-4 backdrop-blur-sm"
          onClick={() => setShowPrayerModal(false)}
        >
          <div
            className="w-full max-w-md bg-[var(--color-surface)] border border-[var(--color-border)] rounded-t-2xl sm:rounded-2xl p-5 shadow-2xl space-y-4"
            style={{ paddingBottom: `calc(1.5rem + var(--safe-bottom))` }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-[var(--color-border)] pb-3">
              <div className="flex items-center gap-2">
                <Heart size={18} className="text-rose-400" />
                <h3 className="text-base font-bold text-white">Novo Pedido de Oração</h3>
              </div>
              <button
                onClick={() => setShowPrayerModal(false)}
                className="p-1 rounded-lg text-[var(--color-text-muted)] hover:text-white hover:bg-[var(--color-surface-alt)] cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            {prayerFeedback && (
              <div className="p-3 bg-amber-950/60 border border-amber-800 rounded-xl text-xs text-amber-300">
                {prayerFeedback}
              </div>
            )}

            <form onSubmit={handleSubmitPrayer} className="space-y-3.5">
              <div>
                <label className="block text-xs font-bold text-[var(--color-text-muted)] mb-1">Título do Pedido *</label>
                <input
                  type="text"
                  value={prayerTitle}
                  onChange={(e) => setPrayerTitle(e.target.value)}
                  placeholder="Ex: Saúde da família, Direção ministerial..."
                  className="w-full px-3.5 py-2.5 bg-[var(--color-surface-alt)] border border-[var(--color-border)] rounded-xl text-sm text-white focus:outline-none focus:border-[var(--color-primary)]"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-[var(--color-text-muted)] mb-1">
                  Descreva seu motivo de oração *
                </label>
                <textarea
                  rows={4}
                  value={prayerDesc}
                  onChange={(e) => setPrayerDesc(e.target.value)}
                  placeholder="Escreva detalhes de como a comunidade e os pastores podem interceder por você..."
                  className="w-full px-3.5 py-2.5 bg-[var(--color-surface-alt)] border border-[var(--color-border)] rounded-xl text-xs text-white focus:outline-none focus:border-[var(--color-primary)] leading-relaxed"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-[var(--color-text-muted)] mb-1">Data</label>
                  <input
                    type="date"
                    value={prayerDate}
                    onChange={(e) => setPrayerDate(e.target.value)}
                    className="w-full px-3 py-2 bg-[var(--color-surface-alt)] border border-[var(--color-border)] rounded-xl text-xs text-white focus:outline-none focus:border-[var(--color-primary)]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-[var(--color-text-muted)] mb-1">Status Inicial</label>
                  <div className="px-3 py-2 bg-[var(--color-surface-alt)] border border-[var(--color-border)] rounded-xl text-xs text-amber-400 font-semibold flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
                    <span>Pendente / Em Oração</span>
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowPrayerModal(false)}
                  className="px-4 py-2 text-xs text-[var(--color-text-muted)] hover:text-white rounded-xl cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingPrayer}
                  className="px-5 py-2 bg-[var(--color-primary)] hover:bg-[var(--color-primary)]/90 text-white text-xs font-bold rounded-xl transition-all cursor-pointer shadow flex items-center gap-1.5"
                >
                  {isSubmittingPrayer ? 'Enviando...' : 'Enviar Pedido de Oração'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ─── MODAL: FAZER DOAÇÃO PIX ───────────────────────────────────────── */}
      {showDonationModal && (
        <div
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/70 p-0 sm:p-4 backdrop-blur-sm"
          onClick={handleCloseDonationModal}
        >
          <div
            className="w-full max-w-md bg-[var(--color-surface)] border border-[var(--color-border)] rounded-t-2xl sm:rounded-2xl p-5 shadow-2xl space-y-4"
            style={{ paddingBottom: `calc(1.5rem + var(--safe-bottom))` }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-[var(--color-border)] pb-3">
              <div className="flex items-center gap-2">
                <Sparkles size={18} className="text-emerald-400" />
                <h3 className="text-base font-bold text-white">Contribuição via Pix</h3>
              </div>
              <button
                onClick={handleCloseDonationModal}
                className="p-1 rounded-lg text-[var(--color-text-muted)] hover:text-white hover:bg-[var(--color-surface-alt)] cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            {donationError && (
              <div className="p-3 bg-rose-950/60 border border-rose-800 rounded-xl text-xs text-rose-300">
                {donationError}
              </div>
            )}

            {/* PASSO 1: ESCOLHER VALOR */}
            {donationStep === 'amount' && (
              <div className="space-y-4">
                <p className="text-xs text-[var(--color-text-muted)] leading-relaxed">
                  Escolha um valor sugerido ou digite quanto deseja contribuir voluntariamente:
                </p>

                {/* Opções rápidas */}
                <div className="grid grid-cols-4 gap-2">
                  {[10, 20, 50, 100].map((val) => {
                    const isSelected = selectedAmount === val && !customAmount;
                    return (
                      <button
                        key={val}
                        type="button"
                        onClick={() => {
                          setSelectedAmount(val);
                          setCustomAmount('');
                        }}
                        className={`py-2.5 rounded-xl font-bold text-xs transition-all cursor-pointer border ${
                          isSelected
                            ? 'bg-emerald-600 text-white border-emerald-500 shadow'
                            : 'bg-[var(--color-surface-alt)] text-[var(--color-text)] border-[var(--color-border)] hover:border-emerald-500/50'
                        }`}
                      >
                        R$ {val}
                      </button>
                    );
                  })}
                </div>

                {/* Valor customizado */}
                <div>
                  <label className="block text-xs font-bold text-[var(--color-text-muted)] mb-1.5">
                    Ou digite outro valor (R$):
                  </label>
                  <div className="relative">
                    <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-sm font-bold text-[var(--color-text-muted)]">
                      R$
                    </span>
                    <input
                      type="number"
                      step="0.01"
                      min="1"
                      placeholder="0,00"
                      value={customAmount}
                      onChange={(e) => setCustomAmount(e.target.value)}
                      className="w-full pl-10 pr-3.5 py-2.5 bg-[var(--color-surface-alt)] border border-[var(--color-border)] rounded-xl text-sm font-bold text-white focus:outline-none focus:border-emerald-500"
                    />
                  </div>
                </div>

                <div className="pt-2">
                  <button
                    type="button"
                    onClick={handleGeneratePix}
                    disabled={isGeneratingPix}
                    className="w-full py-3 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl transition-all flex items-center justify-center gap-2 cursor-pointer shadow"
                  >
                    {isGeneratingPix ? 'Buscando chave oficial...' : 'Gerar QR Code Pix'}
                  </button>
                </div>
              </div>
            )}

            {/* PASSO 2: QR CODE E PIX COPIA E COLA */}
            {donationStep === 'qrcode' && (
              <div className="space-y-4 text-center">
                <div className="p-2 bg-emerald-950/40 border border-emerald-800/60 rounded-xl text-xs text-emerald-300">
                  Contribuição de{' '}
                  <strong className="text-white">
                    R$ {(customAmount ? parseFloat(customAmount) : selectedAmount).toFixed(2).replace('.', ',')}
                  </strong>{' '}
                  gerada com sucesso!
                </div>

                {/* QR Code Renderizado */}
                <div className="flex justify-center my-2">
                  <div className="p-3 bg-white rounded-2xl shadow-md inline-block">
                    <QRCodeSVG value={pixPayload} size={180} level="M" />
                  </div>
                </div>

                <p className="text-[11px] text-[var(--color-text-muted)]">
                  Abra o aplicativo do seu banco, escolha <strong>Pix &gt; Pagar com QR Code</strong> ou utilize o Copia e
                  Cola abaixo:
                </p>

                {/* Pix Copia e Cola */}
                <div className="space-y-2 text-left">
                  <label className="block text-[11px] font-bold text-[var(--color-text-muted)] uppercase">
                    Código Pix Copia e Cola:
                  </label>
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      readOnly
                      value={pixPayload}
                      className="flex-1 px-3 py-2 bg-[var(--color-surface-alt)] border border-[var(--color-border)] rounded-xl text-[11px] font-mono text-white truncate focus:outline-none"
                    />
                    <button
                      type="button"
                      onClick={handleCopyPix}
                      className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl transition-all flex items-center gap-1.5 cursor-pointer shrink-0"
                    >
                      {copiedPix ? (
                        <>
                          <Check size={14} />
                          <span>Copiado!</span>
                        </>
                      ) : (
                        <>
                          <Copy size={14} />
                          <span>Copiar</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>

                <div className="pt-2 border-t border-[var(--color-border)] flex items-center justify-end">
                  <button
                    type="button"
                    onClick={handleCloseDonationModal}
                    className="w-full py-2.5 bg-[var(--color-surface-alt)] hover:bg-[var(--color-border)] text-white text-xs font-semibold rounded-xl transition-colors cursor-pointer"
                  >
                    Concluir
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
