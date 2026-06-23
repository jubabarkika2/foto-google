import React, { useState, useEffect } from 'react';
import { Download, Eye, Calendar, User, EyeOff, Loader, RefreshCw, Layers } from 'lucide-react';
import { GalleryPhoto, fetchAttachmentData } from '../gmailService';
import { motion } from 'motion/react';

interface PhotoCardProps {
  photo: GalleryPhoto;
  accessToken: string;
  onOpenLightbox: (photo: GalleryPhoto) => void;
  onHidePhoto: (photo: GalleryPhoto) => void;
  onPhotoLoaded: (photoId: string, dataUrl: string) => void;
}

export const PhotoCard: React.FC<PhotoCardProps> = ({
  photo,
  accessToken,
  onOpenLightbox,
  onHidePhoto,
  onPhotoLoaded,
}) => {
  const [dataUrl, setDataUrl] = useState<string | null>(photo.dataUrl || null);
  const [loading, setLoading] = useState<boolean>(!photo.dataUrl);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Se já estiver carregado no buffer do serviço, não recarrega
    if (photo.dataUrl) {
      setDataUrl(photo.dataUrl);
      setLoading(false);
      return;
    }

    let isMounted = true;
    const loadAttachment = async () => {
      if (!accessToken || !photo.messageId || !photo.attachmentId) return;
      
      setLoading(true);
      setError(null);
      try {
        const resultUrl = await fetchAttachmentData(
          accessToken,
          photo.messageId,
          photo.attachmentId,
          photo.mimeType
        );
        if (isMounted) {
          setDataUrl(resultUrl);
          setLoading(false);
          // Atualiza o estado central para que se as fotos forem re-filtradas, 
          // os dados da imagem já permaneçam cacheados
          onPhotoLoaded(`${photo.messageId}_${photo.attachmentId}`, resultUrl);
        }
      } catch (err: any) {
        console.error('Erro ao baixar anexo:', err);
        if (isMounted) {
          setError('Não foi possível carregar esta imagem.');
          setLoading(false);
        }
      }
    };

    loadAttachment();

    return () => {
      isMounted = false;
    };
  }, [photo.messageId, photo.attachmentId, accessToken]);

  // Formatar data humana simplificada
  const formatDate = (dateStr: string) => {
    try {
      const date = new Date(dateStr);
      if (isNaN(date.getTime())) return dateStr;
      return date.toLocaleDateString('pt-BR', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
      });
    } catch {
      return dateStr;
    }
  };

  // Extrair o nome limpo do remetente (removendo o email <...>)
  const cleanSenderName = (fromStr: string) => {
    if (!fromStr) return '(Sem Remetente)';
    const clean = fromStr.replace(/<.*?>/g, '').trim();
    return clean || fromStr;
  };

  // Baixar arquivo diretamente
  const handleDownload = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!dataUrl) return;

    const link = document.createElement('a');
    link.href = dataUrl;
    link.download = photo.filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Excluir ou ocultar localmente
  const handleHideClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    onHidePhoto(photo);
  };

  // Tamanho formatado para humanos
  const formatSize = (bytes: number) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  };

  const getExtensionBadge = (filename: string) => {
    const ext = filename.split('.').pop()?.toUpperCase() || 'IMG';
    return ext.slice(0, 4);
  };

  return (
    <motion.div
      layoutId={`photo-card-${photo.messageId}-${photo.attachmentId}`}
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.95 }}
      transition={{ duration: 0.3 }}
      className="group bg-white rounded-2xl border border-gray-100 overflow-hidden shadow-xs hover:shadow-md hover:border-gray-200/80 transition-all duration-300 flex flex-col h-full"
    >
      {/* Container de imagem & overlays */}
      <div 
        onClick={() => !loading && !error && dataUrl && onOpenLightbox({ ...photo, dataUrl })}
        className={`relative aspect-[4/3] bg-gray-50 flex items-center justify-center overflow-hidden cursor-pointer ${
          loading || error ? 'cursor-default' : ''
        }`}
      >
        {loading && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-rose-500/80 z-10 bg-gray-50/80">
            <Loader className="h-7 w-7 animate-spin duration-1000" />
            <span className="text-xs text-gray-500 font-mono tracking-wide">baixando...</span>
          </div>
        )}

        {error && !loading && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 p-4 text-center z-10 bg-gray-50">
            <span className="text-xs text-gray-400 font-sans line-clamp-2 px-1">{error}</span>
            <button
              onClick={() => {
                // Tenta forçar recarga
                setDataUrl(null);
                setLoading(true);
                setError(null);
                fetchAttachmentData(accessToken, photo.messageId, photo.attachmentId, photo.mimeType)
                  .then((url) => {
                    setDataUrl(url);
                    setLoading(false);
                    onPhotoLoaded(`${photo.messageId}_${photo.attachmentId}`, url);
                  })
                  .catch(() => {
                    setError('Falha ao recarregar.');
                    setLoading(false);
                  });
              }}
              className="mt-1 flex items-center gap-1.5 px-2.5 py-1 text-[11px] font-medium text-gray-600 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 active:scale-95 transition cursor-pointer"
            >
              <RefreshCw className="h-3 w-3" />
              Tentar novamente
            </button>
          </div>
        )}

        {/* Imagem real com Blur-Up */}
        {dataUrl && !error && (
          <img
            src={dataUrl}
            alt={photo.filename}
            className={`w-full h-full object-cover img-blur-up ${
              !loading ? 'img-loaded' : ''
            }`}
          />
        )}

        {/* Extension Badge & Size Overlay info */}
        <div className="absolute top-2.5 left-2.5 flex items-center gap-1.5 z-10">
          <span className="bg-black/60 backdrop-blur-md text-white text-[10px] font-mono leading-none tracking-wider px-2 py-1 rounded-md font-semibold">
            {getExtensionBadge(photo.filename)}
          </span>
          <span className="bg-white/80 backdrop-blur-md text-gray-700 text-[10px] font-mono leading-none px-1.5 py-1 rounded-md border border-gray-100">
            {formatSize(photo.size)}
          </span>
        </div>

        {/* Hover Action Overlays */}
        {dataUrl && !loading && !error && (
          <div className="absolute inset-0 bg-black/40 backdrop-blur-xs opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-center justify-center gap-3 z-10">
            <button
              onClick={() => onOpenLightbox({ ...photo, dataUrl })}
              className="p-2.5 bg-white text-gray-800 rounded-full shadow-lg hover:scale-110 active:scale-95 transition cursor-pointer"
              title="Visualizar Detalhes"
            >
              <Eye className="h-4.5 w-4.5" />
            </button>
            <button
              onClick={handleDownload}
              className="p-2.5 bg-white text-rose-600 rounded-full shadow-lg hover:scale-110 active:scale-95 transition cursor-pointer"
              title="Download Direto"
            >
              <Download className="h-4.5 w-4.5" />
            </button>
            <button
              onClick={handleHideClick}
              className="p-2.5 bg-white text-gray-500 hover:text-red-600 rounded-full shadow-lg hover:scale-110 active:scale-95 transition cursor-pointer"
              title="Ocultar Foto"
            >
              <EyeOff className="h-4.5 w-4.5" />
            </button>
          </div>
        )}
      </div>

      {/* Info do e-mail recebido */}
      <div className="p-3.5 flex flex-col flex-1 justify-between gap-2 border-t border-gray-50">
        <div className="space-y-1">
          {/* Email Subject / Name */}
          <h3 
            onClick={() => dataUrl && onOpenLightbox({ ...photo, dataUrl })}
            className={`font-sans font-semibold text-xs text-gray-800 line-clamp-1 hover:text-rose-600 transition duration-150 ${dataUrl ? 'cursor-pointer' : ''}`}
            title={photo.subject}
          >
            {photo.subject}
          </h3>
          {/* File Name */}
          <p className="text-[10px] text-gray-400 font-mono truncate" title={photo.filename}>
            {photo.filename}
          </p>
        </div>

        {/* Metadata footer */}
        <div className="flex flex-col gap-1 pt-1.5 border-t border-gray-100/60 mt-auto text-[11px] text-gray-500">
          <div className="flex items-center gap-1.5 truncate">
            <User className="h-3 w-3 text-gray-400 shrink-0" />
            <span className="truncate" title={photo.sender}>
              {cleanSenderName(photo.sender)}
            </span>
          </div>
          <div className="flex items-center justify-between gap-1.5">
            <div className="flex items-center gap-1.5">
              <Calendar className="h-3 w-3 text-gray-400 shrink-0" />
              <span>{formatDate(photo.date)}</span>
            </div>
            
            {/* Ir para o Gmail Link */}
            <a
              href={`https://mail.google.com/mail/u/0/#inbox/${photo.messageId}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-[10px] font-medium text-rose-500 hover:text-rose-600 transition"
              title="Ver e-mail original no Gmail"
            >
              Ver e-mail ↗
            </a>
          </div>
        </div>
      </div>
    </motion.div>
  );
};
