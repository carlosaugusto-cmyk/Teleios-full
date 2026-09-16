import React, { useState, useEffect, useMemo } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import {
  X,
  Copy,
  Check,
  Upload,
  Heart,
  CheckCircle2,
  RefreshCw,
  Trash2,
  AlertCircle,
  ArrowLeft,
} from 'lucide-react';
import confetti from 'canvas-confetti';
import { generatePixPayload } from '../../utils/pixPayload.ts';
import { PixConfig } from '../../types/index.ts';
import { apiUrl } from '../../services/api.service.ts';

interface DonationModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const PRESET_AMOUNTS = [10, 20, 50, 100];

export const DonationModal: React.FC<DonationModalProps> = ({ isOpen, onClose }) => {
  // Etapas: 'select_value' | 'show_pix' | 'donor' | 'success'
  const [step, setStep] = useState<'select_value' | 'show_pix' | 'donor' | 'success'>('select_value');

  // Pix Config
  const [pixConfig, setPixConfig] = useState<PixConfig>({
    key: 'cagusto123@hotmail.com',
    keyType: 'email',
    receiverName: 'MINISTERIO TELEIOS',
    receiverCity: 'SAO LUIS',
    description: 'Doacao Teleios',
  });

  // Etapa 1: Valor
  const [selectedPreset, setSelectedPreset] = useState<number | null>(20);
  const [isCustom, setIsCustom] = useState<boolean>(false);
  const [customValue, setCustomValue] = useState<string>('');
  const [copied, setCopied] = useState<boolean>(false);
  const [qrCopiedToast, setQrCopiedToast] = useState<boolean>(false);

  // Etapa 2: Dados do Doador
  const [name, setName] = useState<string>('');
  const [phone, setPhone] = useState<string>('');
  const [receiptFile, setReceiptFile] = useState<File | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  // Carregar dados de Pix públicos configurados no backend
  useEffect(() => {
    if (!isOpen) return;

    fetch(apiUrl('/api/config/public'))
      .then((res) => res.json())
      .then((json) => {
        if (json.success && json.data?.pix?.key) {
          setPixConfig(json.data.pix);
        }
      })
      .catch(() => {});
  }, [isOpen]);

  // Resetar modal ao fechar
  const handleClose = () => {
    onClose();
    setTimeout(() => {
      setStep('select_value');
      setSelectedPreset(20);
      setIsCustom(false);
      setCustomValue('');
      setName('');
      setPhone('');
      setReceiptFile(null);
      setErrorMsg(null);
      setCopied(false);
      setQrCopiedToast(false);
    }, 250);
  };

  // Valor ativo da doação
  const activeAmount = useMemo(() => {
    if (isCustom) {
      const parsed = parseFloat(customValue.replace(',', '.'));
      return isNaN(parsed) || parsed <= 0 ? 0 : parsed;
    }
    return selectedPreset || 0;
  }, [isCustom, customValue, selectedPreset]);

  // Geração dinâmica do payload Pix (BR Code padrão oficial Banco Central / EMVCo)
  const pixPayload = useMemo(() => {
    if (!pixConfig.key || activeAmount <= 0) return '';
    return generatePixPayload({
      key: pixConfig.key,
      keyType: pixConfig.keyType,
      receiverName: pixConfig.receiverName || 'MINISTERIO TELEIOS',
      receiverCity: pixConfig.receiverCity || 'SAO LUIS',
      amount: activeAmount,
      description: pixConfig.description || 'Doacao Teleios',
    });
  }, [pixConfig, activeAmount]);

  // Ação de Gerar PIX
  const handleGeneratePix = () => {
    if (activeAmount <= 0) {
      setErrorMsg('Por favor, informe ou escolha um valor válido.');
      return;
    }
    setErrorMsg(null);
    setStep('show_pix');
  };

  // Copiar código Copia e Cola / Toque no QR Code
  const handleCopyCode = () => {
    if (!pixPayload) return;
    navigator.clipboard.writeText(pixPayload);
    setCopied(true);
    setQrCopiedToast(true);
    setTimeout(() => setCopied(false), 2500);
    setTimeout(() => setQrCopiedToast(false), 2500);
  };

  // Avançar após pagamento
  const handleProceedToDonor = () => {
    setErrorMsg(null);
    setStep('donor');
  };

  // Formatação automática do WhatsApp
  const handlePhoneChange = (val: string) => {
    const raw = val.replace(/\D/g, '').slice(0, 11);
    if (raw.length <= 2) {
      setPhone(raw);
    } else if (raw.length <= 6) {
      setPhone(`(${raw.slice(0, 2)}) ${raw.slice(2)}`);
    } else if (raw.length <= 10) {
      setPhone(`(${raw.slice(0, 2)}) ${raw.slice(2, 6)}-${raw.slice(6)}`);
    } else {
      setPhone(`(${raw.slice(0, 2)}) ${raw.slice(2, 7)}-${raw.slice(7)}`);
    }
  };

  // Confirmação final
  const handleFinalSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanDigits = phone.replace(/\D/g, '');

    if (cleanDigits.length < 10) {
      setErrorMsg('Informe um WhatsApp válido com DDD.');
      return;
    }

    setIsSubmitting(true);
    setErrorMsg(null);

    try {
      let res: Response;
      const donorName = name.trim() || 'Doador';

      if (receiptFile) {
        const formData = new FormData();
        formData.append('name', donorName);
        formData.append('phone', phone.trim());
        formData.append('amount', String(activeAmount));
        formData.append('receipt', receiptFile);

        res = await fetch(apiUrl('/api/leads/doacao'), {
          method: 'POST',
          body: formData,
        });
      } else {
        res = await fetch(apiUrl('/api/leads/doacao'), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: donorName,
            phone: phone.trim(),
            amount: activeAmount,
          }),
        });
      }

      const json = await res.json();
      if (json.success) {
        confetti({ particleCount: 75, spread: 60, origin: { y: 0.6 } });
        setStep('success');
      } else {
        setErrorMsg(json.error || 'Erro ao registrar doação. Tente novamente.');
      }
    } catch {
      setErrorMsg('Erro de conexão ao enviar doação. Verifique sua rede.');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/85 backdrop-blur-sm"
      onClick={handleClose}
    >
      <div
        className="bg-[#111827] border border-[#374151] rounded-2xl w-full max-w-sm sm:max-w-md overflow-hidden shadow-2xl transition-all"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-[#374151] bg-[#0A0F1A]">
          <div className="flex items-center gap-2">
            {step === 'show_pix' && (
              <button
                type="button"
                onClick={() => setStep('select_value')}
                className="p-1 -ml-1 text-[#9CA3AF] hover:text-white transition cursor-pointer"
                title="Voltar"
              >
                <ArrowLeft className="w-4 h-4" />
              </button>
            )}
            <div className="w-7 h-7 rounded-lg bg-emerald-950/80 border border-emerald-800 text-emerald-400 flex items-center justify-center shrink-0">
              <Heart className="w-3.5 h-3.5 fill-emerald-400" />
            </div>
            <span className="font-bold text-sm text-white">
              {step === 'success' ? 'Doação Realizada' : 'Fazer uma Doação'}
            </span>
          </div>
          <button
            onClick={handleClose}
            aria-label="Fechar"
            className="p-1.5 rounded-lg text-[#9CA3AF] hover:text-white hover:bg-[#1F2937] transition cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-5 space-y-4">
          {/* Mensagem de Erro */}
          {errorMsg && (
            <div className="p-3 bg-rose-950/80 border border-rose-800 text-rose-300 rounded-xl text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* ── ETAPA 1: ESCOLHER VALOR ── */}
          {step === 'select_value' && (
            <div className="space-y-4">
              <div className="grid grid-cols-4 gap-2">
                {PRESET_AMOUNTS.map((amt) => {
                  const isSelected = !isCustom && selectedPreset === amt;
                  return (
                    <button
                      key={amt}
                      type="button"
                      onClick={() => {
                        setIsCustom(false);
                        setSelectedPreset(amt);
                        setErrorMsg(null);
                      }}
                      className={`py-3 rounded-xl text-xs font-bold transition cursor-pointer text-center ${
                        isSelected
                          ? 'bg-emerald-600 text-white shadow-md'
                          : 'bg-[#1F2937] text-[#9CA3AF] hover:text-white hover:bg-[#374151] border border-[#374151]'
                      }`}
                    >
                      R$ {amt}
                    </button>
                  );
                })}
              </div>

              {/* Botão Outro Valor */}
              <div>
                <button
                  type="button"
                  onClick={() => {
                    setIsCustom(true);
                    setSelectedPreset(null);
                    setErrorMsg(null);
                  }}
                  className={`w-full py-2.5 rounded-xl text-xs font-bold transition border cursor-pointer ${
                    isCustom
                      ? 'border-emerald-500 bg-emerald-950/40 text-emerald-300'
                      : 'border-[#374151] text-[#9CA3AF] hover:text-white hover:bg-[#1F2937]'
                  }`}
                >
                  Outro valor
                </button>

                {isCustom && (
                  <div className="mt-2 relative">
                    <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-xs font-bold text-[#9CA3AF]">
                      R$
                    </span>
                    <input
                      type="text"
                      inputMode="decimal"
                      placeholder="0,00"
                      autoFocus
                      value={customValue}
                      onChange={(e) => {
                        setCustomValue(e.target.value);
                        setErrorMsg(null);
                      }}
                      className="w-full pl-10 pr-4 py-2.5 bg-[#1F2937] border border-[#374151] rounded-xl text-xs text-white font-mono placeholder-[#9CA3AF]/60 focus:outline-none focus:border-emerald-500"
                    />
                  </div>
                )}
              </div>

              {/* Botão Gerar PIX */}
              <div className="pt-2">
                <button
                  type="button"
                  onClick={handleGeneratePix}
                  disabled={activeAmount <= 0}
                  className="w-full py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl text-xs uppercase tracking-wider transition shadow-md disabled:opacity-50 cursor-pointer text-center"
                >
                  Gerar PIX
                </button>
              </div>
            </div>
          )}

          {/* ── ETAPA 2: QR CODE + PIX COPIA E COLA ── */}
          {step === 'show_pix' && (
            <div className="space-y-4">
              {/* Resumo do Valor */}
              <div className="flex items-center justify-between px-3 py-2 bg-[#1F2937] border border-[#374151] rounded-xl text-xs">
                <span className="text-[#9CA3AF]">Valor da doação:</span>
                <span className="font-bold text-white font-mono">
                  R$ {activeAmount.toFixed(2).replace('.', ',')}
                </span>
              </div>

              {/* QR Code */}
              <div className="space-y-2">
                <div
                  onClick={handleCopyCode}
                  title="Clique para copiar o código Pix"
                  className="relative bg-white p-4 rounded-2xl flex flex-col items-center justify-center max-w-[210px] mx-auto shadow cursor-pointer select-none group"
                >
                  <QRCodeSVG
                    value={pixPayload}
                    size={175}
                    level="M"
                    includeMargin={false}
                    className="w-full h-auto"
                  />

                  {qrCopiedToast && (
                    <div className="absolute inset-0 bg-black/90 rounded-2xl flex flex-col items-center justify-center text-white gap-1 animate-fade-in">
                      <Check className="w-8 h-8 text-emerald-400" />
                      <span className="text-xs font-bold">Código Copiado!</span>
                    </div>
                  )}
                </div>

                {/* Orientação curta requerida */}
                <p className="text-[11px] text-center text-[#9CA3AF] leading-tight">
                  Segure ou clique no QR Code para copiar o código PIX.
                </p>
              </div>

              {/* Código PIX copia e cola */}
              <div className="flex items-center gap-2 p-2 bg-[#1F2937] border border-[#374151] rounded-xl">
                <input
                  type="text"
                  readOnly
                  value={pixPayload}
                  onClick={handleCopyCode}
                  className="flex-1 bg-transparent text-[11px] font-mono text-[#9CA3AF] truncate px-2 outline-none cursor-pointer"
                />
                <button
                  type="button"
                  onClick={handleCopyCode}
                  className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold flex items-center gap-1.5 transition shrink-0 cursor-pointer shadow"
                >
                  {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copied ? 'Copiado' : 'Copiar'}</span>
                </button>
              </div>

              {/* Botão simples OK */}
              <div className="pt-2">
                <button
                  type="button"
                  onClick={handleProceedToDonor}
                  className="w-full py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl text-xs uppercase tracking-wider transition shadow-md cursor-pointer text-center"
                >
                  OK
                </button>
              </div>
            </div>
          )}

          {/* ── ETAPA 3: NOME + WHATSAPP + COMPROVANTE ── */}
          {step === 'donor' && (
            <form onSubmit={handleFinalSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-[#9CA3AF] mb-1.5">
                  Nome
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Nome"
                  className="w-full px-3.5 py-2.5 bg-[#1F2937] border border-[#374151] rounded-xl text-xs text-white placeholder-[#9CA3AF]/50 focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-[#9CA3AF] mb-1.5">
                  WhatsApp *
                </label>
                <input
                  type="tel"
                  required
                  value={phone}
                  onChange={(e) => handlePhoneChange(e.target.value)}
                  placeholder="(DDD) 99999-9999"
                  className="w-full px-3.5 py-2.5 bg-[#1F2937] border border-[#374151] rounded-xl text-xs text-white placeholder-[#9CA3AF]/50 focus:outline-none focus:border-emerald-500 font-mono"
                />
              </div>

              {/* [ ícone de upload ] Comprovante */}
              <div>
                <input
                  type="file"
                  id="receipt-upload"
                  accept="image/*,.pdf"
                  onChange={(e) => setReceiptFile(e.target.files?.[0] || null)}
                  className="hidden"
                />

                {!receiptFile ? (
                  <label
                    htmlFor="receipt-upload"
                    className="w-full py-2.5 px-4 bg-[#1F2937] hover:bg-[#374151] border border-dashed border-[#374151] rounded-xl text-xs text-[#9CA3AF] hover:text-white flex items-center justify-center gap-2 cursor-pointer transition"
                  >
                    <Upload className="w-4 h-4 text-emerald-400" />
                    <span>Comprovante</span>
                  </label>
                ) : (
                  <div className="flex items-center justify-between p-2.5 bg-[#1F2937] border border-emerald-800/60 rounded-xl text-xs">
                    <span className="truncate text-white font-mono mr-2 text-xs">
                      {receiptFile.name}
                    </span>
                    <button
                      type="button"
                      onClick={() => setReceiptFile(null)}
                      className="p-1 text-[#9CA3AF] hover:text-rose-400 transition cursor-pointer"
                      title="Remover"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                )}
              </div>

              {/* Botão Confirmar */}
              <div className="pt-2 flex gap-2">
                <button
                  type="button"
                  onClick={() => setStep('show_pix')}
                  className="px-4 py-3 bg-[#1F2937] hover:bg-[#374151] text-white rounded-xl text-xs font-semibold transition cursor-pointer"
                >
                  Voltar
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="flex-1 py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl text-xs uppercase tracking-wider transition shadow-md flex items-center justify-center gap-2 disabled:opacity-50 cursor-pointer"
                >
                  {isSubmitting ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      <span>Confirmando...</span>
                    </>
                  ) : (
                    <span>Confirmar</span>
                  )}
                </button>
              </div>
            </form>
          )}

          {/* ── ETAPA 4: FINALIZADO ── */}
          {step === 'success' && (
            <div className="py-4 text-center space-y-4">
              <div className="w-12 h-12 bg-emerald-950/70 border border-emerald-800 rounded-full flex items-center justify-center mx-auto text-emerald-400 shadow">
                <CheckCircle2 className="w-7 h-7" />
              </div>

              <div className="space-y-1">
                <h3 className="font-bold text-base text-white">
                  Doação Confirmada
                </h3>
                <p className="text-xs text-[#9CA3AF] max-w-xs mx-auto leading-relaxed">
                  Muito obrigado por apoiar o Ministério Teleios.
                </p>
              </div>

              <div className="pt-2">
                <button
                  type="button"
                  onClick={handleClose}
                  className="w-full py-3 bg-[#1F2937] hover:bg-[#374151] text-white font-bold rounded-xl text-xs uppercase tracking-wider transition cursor-pointer"
                >
                  Fechar
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
