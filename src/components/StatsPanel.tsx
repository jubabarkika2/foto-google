import React from 'react';
import { Database, Image, Users, Sparkles, AlertCircle, RefreshCw } from 'lucide-react';
import { GalleryPhoto } from '../gmailService';

interface StatsPanelProps {
  photos: GalleryPhoto[];
  isRefreshing: boolean;
  onRefresh: () => void;
}

export const StatsPanel: React.FC<StatsPanelProps> = ({ photos, isRefreshing, onRefresh }) => {
  // Calcular estatísticas das fotos carregadas
  const totalPhotos = photos.length;
  
  const uniqueSenders = Array.from(
    new Set(photos.map((p) => p.sender))
  ).length;

  const totalBytes = photos.reduce((acc, p) => acc + p.size, 0);
  const formatSize = (bytes: number) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  };

  const getFormatBreakdown = () => {
    const counts: { [key: string]: number } = {};
    photos.forEach((p) => {
      const ext = p.filename.split('.').pop()?.toUpperCase() || 'OUTROS';
      counts[ext] = (counts[ext] || 0) + 1;
    });
    return Object.entries(counts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3);
  };

  const formats = getFormatBreakdown();

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 p-4 bg-gray-50/50 rounded-3xl border border-gray-100">
      
      {/* Total Photos card */}
      <div className="p-4 bg-white rounded-2xl border border-gray-100/60 shadow-xs flex items-center gap-4">
        <div className="p-3 bg-rose-50 text-rose-500 rounded-xl">
          <Image className="h-5 w-5" />
        </div>
        <div>
          <p className="text-[11px] text-gray-400 font-sans uppercase font-bold tracking-wider">Total de Fotos</p>
          <p className="text-xl font-display font-bold text-gray-900">{totalPhotos}</p>
        </div>
      </div>

      {/* Senders count card */}
      <div className="p-4 bg-white rounded-2xl border border-gray-100/60 shadow-xs flex items-center gap-4">
        <div className="p-3 bg-amber-50 text-amber-500 rounded-xl">
          <Users className="h-5 w-5" />
        </div>
        <div>
          <p className="text-[11px] text-gray-400 font-sans uppercase font-bold tracking-wider">Origens / Pessoas</p>
          <p className="text-xl font-display font-bold text-gray-900">{uniqueSenders} {uniqueSenders === 1 ? 'remetente' : 'remetentes'}</p>
        </div>
      </div>

      {/* Storage size card */}
      <div className="p-4 bg-white rounded-2xl border border-gray-100/60 shadow-xs flex items-center gap-4">
        <div className="p-3 bg-indigo-50 text-indigo-500 rounded-xl">
          <Database className="h-5 w-5" />
        </div>
        <div>
          <p className="text-[11px] text-gray-400 font-sans uppercase font-bold tracking-wider">Dados em Anexos</p>
          <p className="text-xl font-display font-bold text-gray-900">{formatSize(totalBytes)}</p>
        </div>
      </div>

      {/* Formatos dominantes ou mini helper card */}
      <div className="p-4 bg-gradient-to-br from-gray-900 to-gray-950 text-white rounded-2xl shadow-xs flex flex-col justify-center gap-1.5 min-h-[75px]">
        <div className="flex items-center gap-1">
          <Sparkles className="h-3.5 w-3.5 text-amber-400 shrink-0" />
          <p className="text-[10px] font-mono uppercase font-bold tracking-wider text-gray-300">Gmail as a DB</p>
        </div>
        <p className="text-[11px] text-gray-300 font-sans leading-tight">
          Nenhuma foto é salva em servidores de terceiros. A galeria consome as fotos diretamente de forma dinâmica.
        </p>
      </div>

    </div>
  );
};
