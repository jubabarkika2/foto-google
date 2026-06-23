import React from 'react';
import { X, Download, Calendar, User, Mail, Link, EyeOff, LayoutTemplate, ShieldAlert } from 'lucide-react';
import { GalleryPhoto } from '../gmailService';
import { motion, AnimatePresence } from 'motion/react';

interface LightboxModalProps {
  photo: GalleryPhoto | null;
  onClose: () => void;
  onHidePhoto: (photo: GalleryPhoto) => void;
}

export const LightboxModal: React.FC<LightboxModalProps> = ({ photo, onClose, onHidePhoto }) => {
  if (!photo) return null;

  // Formatar data completa para exibição detalhada
  const formatFullDate = (dateStr: string) => {
    try {
      const date = new Date(dateStr);
      if (isNaN(date.getTime())) return dateStr;
      return date.toLocaleDateString('pt-BR', {
        weekday: 'long',
        day: '2-digit',
        month: 'long',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return dateStr;
    }
  };

  // Baixar imagem do lightbox
  const handleDownload = () => {
    if (!photo.dataUrl) return;
    const link = document.createElement('a');
    link.href = photo.dataUrl;
    link.download = photo.filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Tamanho para humanos
  const formatSize = (bytes: number) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  };

  const handleHideClick = () => {
    onHidePhoto(photo);
    onClose();
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 overflow-y-auto flex items-center justify-center p-4">
        {/* Backdrop escuro com desfoque */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="fixed inset-0 bg-gray-950/80 backdrop-blur-md cursor-zoom-out"
        />

        {/* Modal real */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.95 }}
          transition={{ type: 'spring', damping: 25, stiffness: 350 }}
          className="bg-white rounded-3xl overflow-hidden shadow-2xl border border-gray-100 max-w-5xl w-full flex flex-col md:flex-row relative z-10 max-h-[90vh] md:max-h-[85vh]"
        >
          {/* Lado Esquerdo: Visualização da Imagem */}
          <div className="flex-1 bg-gray-900 border-b md:border-b-0 md:border-r border-gray-100 flex items-center justify-center relative min-h-[300px] md:min-h-0 bg-radial from-gray-800 to-gray-950">
            {photo.dataUrl ? (
              <img
                src={photo.dataUrl}
                alt={photo.filename}
                className="max-w-full max-h-[45vh] md:max-h-[80vh] object-contain transition-transform"
              />
            ) : (
              <div className="text-gray-400 p-8 text-center text-sm font-sans">
                Imagem indisponível.
              </div>
            )}
          </div>

          {/* Lado Direito: Detalhes do E-mail e Arquivo */}
          <div className="w-full md:w-[380px] p-6 sm:p-8 flex flex-col overflow-y-auto max-h-[45vh] md:max-h-full justify-between">
            <div>
              {/* Header do popover */}
              <div className="flex items-center justify-between gap-4 mb-5 pb-4 border-b border-gray-100">
                <div>
                  <span className="text-[10px] uppercase tracking-wider text-rose-500 font-mono font-bold">
                    Detalhes do Anexo
                  </span>
                  <h2 className="font-display font-bold text-lg text-gray-900 truncate max-w-[240px]">
                    {photo.filename}
                  </h2>
                </div>
                <button
                  onClick={onClose}
                  className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-50 rounded-full transition cursor-pointer"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              {/* Informações da Origem do Email */}
              <div className="space-y-4 font-sans text-sm">
                <div>
                  <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2 flex items-center gap-1.5 font-mono">
                    <Mail className="h-3.5 w-3.5 text-gray-400" />
                    Recebido via E-mail
                  </h3>
                  <div className="bg-rose-50/50 p-3 rounded-2xl border border-rose-100/40 text-gray-800">
                    <p className="font-semibold text-xs text-rose-800 tracking-wide line-clamp-1 mb-1">
                      Assunto:
                    </p>
                    <p className="text-sm font-medium text-gray-900 line-clamp-2 leading-snug">
                      {photo.subject}
                    </p>
                  </div>
                </div>

                <div className="space-y-3 pt-2 text-gray-700">
                  <div className="flex items-start gap-2.5">
                    <User className="h-4 w-4 text-gray-400 mt-0.5 shrink-0" />
                    <div>
                      <p className="text-xs text-gray-400">Remetente</p>
                      <p className="font-medium text-gray-900 break-all leading-tight">{photo.sender}</p>
                    </div>
                  </div>

                  <div className="flex items-start gap-2.5">
                    <Calendar className="h-4 w-4 text-gray-400 mt-0.5 shrink-0" />
                    <div>
                      <p className="text-xs text-gray-400">Data e Hora de Chegada</p>
                      <p className="text-gray-900 leading-tight">{formatFullDate(photo.date)}</p>
                    </div>
                  </div>

                  {photo.snippet && (
                    <div className="bg-gray-50 p-3.5 rounded-2xl border border-gray-100">
                      <p className="text-xs font-semibold text-gray-400 mb-1 font-mono">Trecho do E-mail</p>
                      <p className="text-xs text-gray-600 leading-relaxed italic line-clamp-4">
                        "{photo.snippet}"
                      </p>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Ações e Rodapé */}
            <div className="mt-6 pt-5 border-t border-gray-100 space-y-3">
              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={handleDownload}
                  className="flex items-center justify-center gap-2 px-4 py-2.5 bg-rose-600 text-white rounded-xl hover:bg-rose-700 transition duration-200 text-xs font-medium shadow-xs cursor-pointer active:scale-95"
                >
                  <Download className="h-4 w-4" />
                  <span>Download</span>
                </button>
                <a
                  href={`https://mail.google.com/mail/u/0/#inbox/${photo.messageId}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-center gap-2 px-4 py-2.5 bg-gray-50 hover:bg-gray-100 text-gray-700 border border-gray-200 rounded-xl transition duration-200 text-xs font-medium cursor-pointer"
                >
                  <Link className="h-3.5 w-3.5" />
                  <span>Ver Email Orig.</span>
                </a>
              </div>

              {/* Botão Ocultar */}
              <button
                onClick={handleHideClick}
                className="w-full flex items-center justify-center gap-2 px-4 py-2 text-gray-400 hover:text-red-500 rounded-xl hover:bg-red-50/50 transition duration-150 text-[11px] font-medium cursor-pointer"
              >
                <EyeOff className="h-3.5 w-3.5" />
                <span>Ocultar esta foto da galeria</span>
              </button>

              <div className="text-center text-[10px] text-gray-400 font-mono">
                Mime: {photo.mimeType} | Tamanho: {formatSize(photo.size)}
              </div>
            </div>

          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
