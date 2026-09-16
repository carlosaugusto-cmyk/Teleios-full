import React, { useState, useEffect, useMemo } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import {
  Heart,
  Copy,
  Check,
  CheckCircle2,
  AlertCircle,
  UploadCloud,
  FileCheck,
  ShieldCheck,
  QrCode,
  DollarSign,
  Send,
  RefreshCw,
} from 'lucide-react';
import confetti from 'canvas-confetti';
import { generatePixPayload } from '../../utils/pixPayload.ts';
import { PixConfig } from '../../types/index.ts';

const PRESET_AMOUNTS = [10, 30, 50, 100];

export const LandingDoacao: React.FC = () => {
  const [pixConfig, setPixConfig] = useState<PixConfig>({
    key: 'pix@ministerioteleios.com.br',
    keyType: 'email',
    receiverName: 'MINISTERIO TELEIOS',
    receiverCity: 'SAO PAULO',
    description: 'Doacao Ministerio Teleios',
  });

  const [selectedAmount, setSelectedAmount] = useState<number>(30);
  const [customAmount, setCustomAmount] = useState<string>('');
  const [isCustom, setIsCustom] = useState<boolean>(false);

  // Form Fields
  const [name, setName] = useState<string>('');
  const [phone, setPhone] = useState<string>('');
  const [receiptFile, setReceiptFile] = useState<File | null>(null);
  const [cannotSendReceipt, setCannotSendReceipt] = useState<boolean>(false);

  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [copiedKey, setCopiedKey] = useState<boolean>(false);
  const [copiedPayload, setCopiedPayload] = useState<boolean>(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Carregar dados de Pix públicos configurados no Admin
  useEffect(() => {
    fetch('https://teleios-api-worker.ca88321499.workers.dev/api/config/public')
      .then((res) => res.json())
      .then((json) => {
        if (json.success && json.data?.pix?.key) {
          setPixConfig(json.data.pix);
        }
      })
      .catch(() => {});
  }, []);

  const activeAmount = useMemo(() => {
    if (isCustom) {
      const parsed = parseFloat(customAmount.replace(',', '.'));
      return isNaN(parsed) || parsed <= 0 ? 0 : parsed;
    }
    return selectedAmount;
  }, [isCustom, customAmount, selectedAmount]);

  // Geração dinâmica do payload Pix (BR Code padrão oficial Banco Central / EMVCo)
  const pixPayload = useMemo(() => {
    return generatePixPayload({
      key: pixConfig.key,
      receiverName: pixConfig.receiverName || 'MINISTERIO TELEIOS',
      receiverCity: pixConfig.receiverCity || 'SAO PAULO',
      amount: activeAmount > 0 ? activeAmount : undefined,
      description: pixConfig.description || 'Doacao Teleios',
    });
  }, [pixConfig, activeAmount]);

  const handleCopyKey = () => {
    if (!pixConfig.key) return;
    navigator.clipboard.writeText(pixConfig.key);
    setCopiedKey(true);
    setTimeout(() => setCopiedKey(false), 2500);
  };

  const handleCopyPayload = () => {
    if (!pixPayload) return;
    navigator.clipboard.writeText(pixPayload);
    setCopiedPayload(true);
    setTimeout(() => setCopiedPayload(false), 2500);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setFeedback({ type: 'error', text: 'Por favor, informe seu nome.' });
      return;
    }
    if (!phone.trim()) {
      setFeedback({ type: 'error', text: 'Por favor, informe seu telefone com DDD.' });
      return;
    }
    if (activeAmount <= 0) {
      setFeedback({ type: 'error', text: 'Por favor, informe um valor de doação maior que zero.' });
      return;
    }

    setIsSubmitting(true);
    setFeedback(null);

    try {
      let res: Response;

      // Se houver comprovante e o usuário não tiver marcado "Não consigo enviar"
      if (receiptFile && !cannotSendReceipt) {
        const formData = new FormData();
        formData.append('name', name.trim());
        formData.append('phone', phone.trim());
        formData.append('amount', String(activeAmount));
        formData.append('receipt', receiptFile);

        res = await fetch('https://teleios-api-worker.ca88321499.workers.dev/api/leads/doacao', {
          method: 'POST',
          body: formData,
        });
      } else {
        res = await fetch('https://teleios-api-worker.ca88321499.workers.dev/api/leads/doacao', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: name.trim(),
            phone: phone.trim(),
            amount: activeAmount,
          }),
        });
      }

      const json = await res.json();
      if (json.success) {
        confetti({ particleCount: 60, spread: 70, origin: { y: 0.7 } });
        setFeedback({
          type: 'success',
          text: 'Doação registrada com sucesso! Muito obrigado pelo seu apoio e generosidade.',
        });
        setName('');
        setPhone('');
        setReceiptFile(null);
        setCannotSendReceipt(false);
      } else {
        setFeedback({ type: 'error', text: json.error || 'Erro ao registrar doação.' });
      }
    } catch {
      setFeedback({ type: 'error', text: 'Erro de conexão ao enviar doação. Verifique sua rede.' });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <section id="doacao" className="py-20 sm:py-28 bg-[#0A0F1A] border-t border-[#1F2937] font-sans">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Section Header */}
        <div className="text-center max-w-2xl mx-auto space-y-3">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-950/60 border border-emerald-800 text-emerald-400 text-xs font-bold uppercase tracking-wider">
            <Heart className="w-3.5 h-3.5 fill-emerald-400" />
            <span>Faça uma Doação</span>
          </div>
          <h2 className="text-2xl sm:text-4xl font-serif font-bold text-white tracking-tight">
            Apoie o Ministério Teleios
          </h2>
          <p className="text-xs sm:text-sm text-[#9CA3AF] leading-relaxed">
            Sua generosidade viabiliza a expansão do Evangelho, a produção de devocionais bíblicos e o cuidado integral de vidas.
          </p>
        </div>

        {/* Content Grid */}
        <div className="mt-12 grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          {/* Coluna 1: Dados do Pix & QR Code Dinâmico (5 colunas) */}
          <div className="lg:col-span-5 bg-[#111827] border border-[#374151] rounded-2xl p-6 space-y-6 shadow-xl">
            <div>
              <span className="text-[10px] uppercase font-bold text-emerald-400 tracking-wider block">
                Passo 1: Pagamento via Pix
              </span>
              <h3 className="text-lg font-bold text-white mt-0.5 flex items-center gap-2">
                <QrCode className="w-5 h-5 text-emerald-400" />
                QR Code Pix Oficial
              </h3>
              <p className="text-xs text-[#9CA3AF] mt-1">
                Abra o app do seu Banco, escolha <strong>Pix &gt; Ler QR Code</strong>, ou use o botão <strong>Pix Copia e Cola</strong> abaixo diretamente no celular.
              </p>
            </div>

            {/* Seleção de Valor */}
            <div className="space-y-2">
              <label className="text-xs font-bold uppercase tracking-wider text-[#9CA3AF] block">
                Escolha o Valor da Doação:
              </label>
              <div className="grid grid-cols-4 gap-2">
                {PRESET_AMOUNTS.map((amt) => {
                  const isSelected = !isCustom && selectedAmount === amt;
                  return (
                    <button
                      key={amt}
                      type="button"
                      onClick={() => {
                        setIsCustom(false);
                        setSelectedAmount(amt);
                      }}
                      className={`py-2.5 rounded-xl text-xs font-bold transition cursor-pointer flex flex-col items-center justify-center ${
                        isSelected
                          ? 'bg-emerald-600 text-white shadow-md'
                          : 'bg-[#1F2937] text-[#9CA3AF] hover:text-white border border-[#374151]'
                      }`}
                    >
                      <span>R$ {amt}</span>
                    </button>
                  );
                })}
              </div>

              {/* Botão para outro valor */}
              <div className="pt-1">
                <button
                  type="button"
                  onClick={() => setIsCustom(!isCustom)}
                  className="text-xs text-emerald-400 hover:underline flex items-center gap-1 cursor-pointer"
                >
                  <DollarSign className="w-3.5 h-3.5" />
                  <span>{isCustom ? 'Escolher valores sugeridos' : 'Informar outro valor'}</span>
                </button>
                {isCustom && (
                  <div className="mt-2 relative">
                    <span className="text-xs text-[#9CA3AF] absolute left-3 top-1/2 -translate-y-1/2 font-bold">
                      R$
                    </span>
                    <input
                      type="text"
                      placeholder="0,00"
                      value={customAmount}
                      onChange={(e) => setCustomAmount(e.target.value)}
                      className="w-full pl-9 pr-4 py-2 bg-[#1F2937] border border-[#374151] rounded-xl text-xs text-white placeholder-[#9CA3AF]/60 focus:outline-none focus:border-emerald-500 font-mono"
                    />
                  </div>
                )}
              </div>
            </div>

            {/* QR Code Container */}
            <div className="bg-white p-4 rounded-2xl flex flex-col items-center justify-center shadow-inner max-w-[240px] mx-auto">
              {pixPayload ? (
                <QRCodeSVG
                  value={pixPayload}
                  size={190}
                  level="M"
                  includeMargin={true}
                  className="w-full h-auto"
                />
              ) : (
                <div className="w-[190px] h-[190px] flex items-center justify-center text-xs text-black">
                  Carregando QR Code...
                </div>
              )}
              <span className="text-[11px] font-bold text-gray-800 mt-2 font-mono">
                Valor: R$ {activeAmount.toFixed(2).replace('.', ',')}
              </span>
            </div>

            {/* Botões de Cópia */}
            <div className="space-y-2.5">
              <button
                type="button"
                onClick={handleCopyPayload}
                className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold uppercase tracking-wider transition shadow flex items-center justify-center gap-2 cursor-pointer"
              >
                {copiedPayload ? <Check className="w-4 h-4 text-white" /> : <Copy className="w-4 h-4" />}
                <span>{copiedPayload ? 'Código Copiado!' : 'Copiar Pix Copia e Cola'}</span>
              </button>

              <div className="flex items-center justify-between p-2.5 bg-[#1F2937] border border-[#374151] rounded-xl text-xs">
                <div className="truncate mr-2">
                  <span className="text-[#9CA3AF] text-[10px] block">Chave Pix:</span>
                  <span className="text-white font-mono font-medium truncate block">
                    {pixConfig.key}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={handleCopyKey}
                  className="p-1.5 bg-[#111827] hover:bg-[#374151] text-[#9CA3AF] hover:text-white rounded-lg transition shrink-0 cursor-pointer"
                  title="Copiar Chave"
                >
                  {copiedKey ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                </button>
              </div>
            </div>

            <div className="text-[11px] text-[#9CA3AF] space-y-1">
              <div><strong className="text-white">Titular:</strong> {pixConfig.receiverName}</div>
              <div><strong className="text-white">Cidade:</strong> {pixConfig.receiverCity}</div>
            </div>
          </div>

          {/* Coluna 2: Formulário de Confirmação e Comprovante Opcional (7 colunas) */}
          <div className="lg:col-span-7 bg-[#111827] border border-[#374151] rounded-2xl p-6 sm:p-8 space-y-6 shadow-xl">
            <div>
              <span className="text-[10px] uppercase font-bold text-[#0077C8] tracking-wider block">
                Passo 2: Confirmação da Doação
              </span>
              <h3 className="text-lg font-bold text-white mt-0.5">
                Informações do Doador
              </h3>
              <p className="text-xs text-[#9CA3AF] mt-1">
                Preencha seus dados para registrarmos a sua contribuição no sistema e emitirmos o comprovante de oração.
              </p>
            </div>

            {feedback && (
              <div
                className={`p-4 rounded-xl border text-xs font-medium flex items-center gap-2.5 animate-fade-in ${
                  feedback.type === 'success'
                    ? 'bg-emerald-950/80 border-emerald-800 text-emerald-300'
                    : 'bg-rose-950/80 border-rose-800 text-rose-300'
                }`}
              >
                {feedback.type === 'success' ? (
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                ) : (
                  <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
                )}
                <span>{feedback.text}</span>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-[#9CA3AF] mb-1.5">
                  Seu Nome Completo *
                </label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Ex: Carlos Eduardo Silva"
                  className="w-full px-4 py-3 bg-[#1F2937] border border-[#374151] rounded-xl text-xs text-white placeholder-[#9CA3AF]/60 focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-[#9CA3AF] mb-1.5">
                    WhatsApp / Telefone *
                  </label>
                  <input
                    type="tel"
                    required
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="(11) 98888-7777"
                    className="w-full px-4 py-3 bg-[#1F2937] border border-[#374151] rounded-xl text-xs text-white placeholder-[#9CA3AF]/60 focus:outline-none focus:border-emerald-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-[#9CA3AF] mb-1.5">
                    Valor da Doação (R$) *
                  </label>
                  <input
                    type="text"
                    readOnly
                    value={`R$ ${activeAmount.toFixed(2).replace('.', ',')}`}
                    className="w-full px-4 py-3 bg-[#1F2937]/70 border border-[#374151] rounded-xl text-xs text-emerald-400 font-bold font-mono focus:outline-none"
                  />
                </div>
              </div>

              {/* Upload de Comprovante (Opcional) */}
              <div className="p-4 bg-[#1F2937]/60 border border-[#374151] rounded-xl space-y-3">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold uppercase tracking-wider text-[#9CA3AF] flex items-center gap-1.5">
                    <FileCheck className="w-3.5 h-3.5 text-emerald-400" />
                    Comprovante Pix (Opcional)
                  </label>
                </div>

                {!cannotSendReceipt ? (
                  <div>
                    <input
                      type="file"
                      accept="image/*,.pdf"
                      onChange={(e) => setReceiptFile(e.target.files?.[0] || null)}
                      className="w-full px-3 py-2 bg-[#111827] border border-[#374151] rounded-xl text-xs text-[#9CA3AF] file:mr-3 file:py-1 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-bold file:bg-emerald-600 file:text-white cursor-pointer"
                    />
                    <p className="text-[11px] text-[#9CA3AF] mt-1.5">
                      Formatos aceitos: Imagem (JPG, PNG) ou PDF.
                    </p>
                  </div>
                ) : (
                  <p className="text-xs text-amber-400/90 italic">
                    Você optou por não enviar o comprovante agora. Sua doação será registrada normalmente.
                  </p>
                )}

                {/* Opção "Não consigo enviar o comprovante" */}
                <div className="pt-1">
                  <label className="flex items-center gap-2 text-xs text-white/90 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={cannotSendReceipt}
                      onChange={(e) => {
                        setCannotSendReceipt(e.target.checked);
                        if (e.target.checked) setReceiptFile(null);
                      }}
                      className="rounded text-emerald-500 focus:ring-0"
                    />
                    <span>Não consigo enviar o comprovante agora</span>
                  </label>
                </div>
              </div>

              <div className="pt-2">
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full py-3.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold uppercase tracking-wider transition shadow-lg flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                >
                  {isSubmitting ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      <span>Registrando Doação...</span>
                    </>
                  ) : (
                    <>
                      <Send className="w-4 h-4" />
                      <span>Confirmar Doação</span>
                    </>
                  )}
                </button>
              </div>

              <div className="flex items-center gap-2 text-[11px] text-[#9CA3AF] justify-center pt-1">
                <ShieldCheck className="w-4 h-4 text-emerald-400" />
                <span>Ambiente protegido e dados registrados com segurança.</span>
              </div>
            </form>
          </div>
        </div>
      </div>
    </section>
  );
};
