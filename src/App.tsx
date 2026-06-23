import { useState, useEffect, useMemo } from 'react';
import {
  initAuth,
  googleSignIn,
  logout,
  isMobileBrowser
} from './firebase';
import {
  fetchGmailMessageList,
  fetchMessageDetails,
  GalleryPhoto
} from './gmailService';
import { Header } from './components/Header';
import { PhotoCard } from './components/PhotoCard';
import { LightboxModal } from './components/LightboxModal';
import { StatsPanel } from './components/StatsPanel';
import {
  User as FirebaseUser
} from 'firebase/auth';
import {
  Search,
  SlidersHorizontal,
  Image as ImageIcon,
  KeyRound,
  Grid,
  Sparkles,
  Smartphone,
  ShieldCheck,
  Compass,
  CornerDownRight,
  Info,
  ChevronDown,
  Loader
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

export default function App() {
  const [needsAuth, setNeedsAuth] = useState(true);
  const [user, setUser] = useState<FirebaseUser | null>(null);
  const [accessToken, setAccessToken] = useState('');
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [loginMethod, setLoginMethod] = useState<'popup' | 'redirect' | null>(null);

  // Estados da Galeria
  const [photos, setPhotos] = useState<GalleryPhoto[]>([]);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [errorText, setErrorText] = useState('');
  const [nextPageToken, setNextPageToken] = useState<string | undefined>(undefined);
  const [currentMailOffset, setCurrentMailOffset] = useState<string[]>([]); // rastreamento de tokens anteriores para paginação se necessário
  
  // Filtros Globais e Barra de Pesquisa
  const [searchTerm, setSearchTerm] = useState('');
  const [activeFilter, setActiveFilter] = useState('all'); // all, jpg, png, webp, other
  const [activeSort, setActiveSort] = useState<'newest' | 'oldest'>('newest');
  
  // Fotos Ocultadas salvas no localStorage
  const [hiddenPhotoIds, setHiddenPhotoIds] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem('gmail_gallery_hidden_photos');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  // Lightbox e Visualização Detalhada
  const [selectedPhoto, setSelectedPhoto] = useState<GalleryPhoto | null>(null);

  // Inicialização do Auth e Redirect result no celular ao montar o componente
  useEffect(() => {
    const unsubscribe = initAuth(
      (currentUser, token) => {
        setUser(currentUser);
        setAccessToken(token);
        setNeedsAuth(false);
        // Busca imediata da galeria após autenticação garantida
        loadGallery(token, true);
      },
      () => {
        setNeedsAuth(true);
        setUser(null);
        setAccessToken('');
      }
    );
    return () => unsubscribe();
  }, []);

  // Salvar IDs de fotos ocultadas no localStorage
  useEffect(() => {
    localStorage.setItem('gmail_gallery_hidden_photos', JSON.stringify(hiddenPhotoIds));
  }, [hiddenPhotoIds]);

  // Função para carregar fotos do Gmail
  const loadGallery = async (token = accessToken, reset = true, nextPageKey?: string) => {
    if (!token) return;
    setIsRefreshing(true);
    setErrorText('');

    try {
      // 1. Listar mensagens que batem com nossa query de fotos
      const result = await fetchGmailMessageList(token, '', reset ? '' : nextPageKey, 15);
      setNextPageToken(result.nextPageToken);

      if (reset) {
        setPhotos([]);
      }

      const messageList = result.messages;

      if (!messageList || messageList.length === 0) {
        setIsRefreshing(false);
        if (reset) setPhotos([]);
        return;
      }

      // 2. Baixar os detalhes de metadados das mensagens em paralelo (remetente, assunto, anexos existentes)
      const fetchedAttachments: GalleryPhoto[] = [];
      const batchRequests = messageList.map(async (msg) => {
        try {
          const attachments = await fetchMessageDetails(token, msg.id);
          attachments.forEach((att) => {
            fetchedAttachments.push({
              ...att,
              loading: true,
            });
          });
        } catch (err) {
          console.error(`Erro ao carregar mensagem ${msg.id}:`, err);
        }
      });

      await Promise.all(batchRequests);

      // 3. Atualizar o estado principal mesclando ou reescrevendo
      setPhotos((prev) => {
        const combined = reset ? fetchedAttachments : [...prev, ...fetchedAttachments];
        
        // Evita duplicatas exatas usando ID único composto
        const uniqueMap = new Map<string, GalleryPhoto>();
        combined.forEach(p => {
          const uniqueKey = `${p.messageId}_${p.attachmentId}`;
          // Se já temos a foto e ela possui dados carregados, consome para não perder o cache base64
          if (uniqueMap.has(uniqueKey)) {
            const existing = uniqueMap.get(uniqueKey);
            if (existing?.dataUrl && !p.dataUrl) {
              p.dataUrl = existing.dataUrl;
              p.loading = false;
            }
          }
          uniqueMap.set(uniqueKey, p);
        });

        return Array.from(uniqueMap.values());
      });

    } catch (err: any) {
      console.error('Erro na galeria:', err);
      setErrorText('Houve um erro ao sincronizar com seu Gmail. Sua sessão pode ter expirado.');
    } finally {
      setIsRefreshing(false);
    }
  };

  // Callback chamado quando um card filhote baixa seus dados de imagem de forma isolada
  const handlePhotoLoaded = (photoId: string, dataUrl: string) => {
    setPhotos((prev) =>
      prev.map((photo) => {
        const uKey = `${photo.messageId}_${photo.attachmentId}`;
        if (uKey === photoId) {
          return { ...photo, dataUrl, loading: false };
        }
        return photo;
      })
    );
  };

  // Desconectar sessão do Google / Firebase
  const handleLogout = async () => {
    await logout();
    setPhotos([]);
    setNextPageToken(undefined);
    setNeedsAuth(true);
  };

  // Ocultar foto localmente
  const handleHidePhoto = (photo: GalleryPhoto) => {
    const confirmHide = window.confirm(
      `Deseja ocultar o anexo "${photo.filename}" desta galeria? Ele continuará salvo no seu e-mail original, mas será escondido deste aplicativo.`
    );
    if (!confirmHide) return;

    const uniqueId = `${photo.messageId}_${photo.attachmentId}`;
    setHiddenPhotoIds((prev) => [...prev, uniqueId]);
  };

  // Limpar lista de ocultadas
  const handleResetHidden = () => {
    const confirmReset = window.confirm('Deseja restaurar todas as fotos ocultadas de volta à galeria?');
    if (confirmReset) {
      setHiddenPhotoIds([]);
    }
  };

  // Fluxo inteligente de login para computadores e celulares
  const handleLogin = async (useRedirectMode = false) => {
    setIsLoggingIn(true);
    setLoginMethod(useRedirectMode ? 'redirect' : 'popup');
    try {
      await googleSignIn(useRedirectMode);
      // Se for popup, o resultado retorna na hora. No redirect, haverá recarga da página.
    } catch (err: any) {
      console.error('Falha de Login:', err);
      if (err.code !== 'auth/popup-blocked') {
        alert(`Erro ao fazer login: ${err.message || err}`);
      }
    } finally {
      setIsLoggingIn(false);
      setLoginMethod(null);
    }
  };

  // Filtragem e Ordenação dinâmica realizada localmente em memória
  const processedPhotos = useMemo(() => {
    // 1. Filtra as ocultas
    let result = photos.filter((photo) => {
      const uKey = `${photo.messageId}_${photo.attachmentId}`;
      return !hiddenPhotoIds.includes(uKey);
    });

    // 2. Filtra por extensão
    if (activeFilter !== 'all') {
      result = result.filter((photo) => {
        const ext = photo.filename.split('.').pop()?.toLowerCase() || '';
        if (activeFilter === 'jpg') return ['jpg', 'jpeg'].includes(ext);
        if (activeFilter === 'png') return ext === 'png';
        if (activeFilter === 'webp') return ext === 'webp';
        if (activeFilter === 'other') return !['jpg', 'jpeg', 'png', 'webp'].includes(ext);
        return true;
      });
    }

    // 3. Filtra por termo de busca (remetente, assunto ou nome do arquivo)
    if (searchTerm.trim() !== '') {
      const query = searchTerm.toLowerCase();
      result = result.filter(
        (photo) =>
          photo.filename.toLowerCase().includes(query) ||
          photo.subject.toLowerCase().includes(query) ||
          photo.sender.toLowerCase().includes(query) ||
          (photo.snippet && photo.snippet.toLowerCase().includes(query))
      );
    }

    // 4. Ordenação
    result.sort((a, b) => {
      if (activeSort === 'newest') {
        return b.timestamp - a.timestamp;
      } else {
        return a.timestamp - b.timestamp;
      }
    });

    return result;
  }, [photos, hiddenPhotoIds, activeFilter, searchTerm, activeSort]);

  // Carregar mais fotos usando paginação
  const handleLoadMore = () => {
    if (nextPageToken && !isRefreshing) {
      loadGallery(accessToken, false, nextPageToken);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50/50 flex flex-col font-sans text-gray-900 leading-normal selection:bg-rose-100 selection:text-rose-900">
      
      {/* Header unificado */}
      <Header
        user={user}
        needsAuth={needsAuth}
        onLogout={handleLogout}
        onRefresh={() => loadGallery(accessToken, true)}
        isRefreshing={isRefreshing}
        totalPhotosCount={processedPhotos.length}
      />

      {/* RENDERIZAÇÃO ESTADO: AUTENTICAÇÃO REQUERIDA (TELA DE LOGIN) */}
      {needsAuth ? (
        <div className="flex-1 flex items-center justify-center py-10 px-4 sm:px-6 lg:px-8 bg-radial from-white to-gray-50/70">
          <div className="max-w-4xl w-full grid grid-cols-1 md:grid-cols-12 gap-8 items-center">
            
            {/* Lado Esquerdo: Texto Explicativo e Benefícios */}
            <div className="md:col-span-7 space-y-6 text-center md:text-left pr-0 md:pr-4">
              <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-rose-50 text-rose-600 rounded-full text-xs font-semibold uppercase tracking-wider">
                <Sparkles className="h-3.5 w-3.5" />
                Inovação Baseada no Gmail
              </span>
              <h2 className="font-display font-extrabold text-3xl sm:text-4xl text-gray-900 tracking-tight leading-none">
                Sua caixa de entrada é seu{' '}
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-rose-500 to-amber-500">
                  banco de dados
                </span>{' '}
                de fotos privado.
              </h2>
              <p className="text-gray-500 text-sm sm:text-base leading-relaxed">
                Este aplicativo inovador varre com segurança as mensagens do seu Gmail em busca de fotos anexadas. Nós criamos uma galeria interativa sem armazenar nenhuma de suas fotos em servidores de terceiros. Seu Gmail controla tudo.
              </p>

              {/* Solução para Erros de Login Mobile */}
              <div className="bg-amber-50/70 rounded-3xl p-5 border border-amber-100 flex gap-4.5 text-left shadow-xs">
                <Smartphone className="h-6 w-6 text-amber-500 shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <h4 className="font-display font-bold text-xs text-amber-900 uppercase tracking-wide">
                    Correção para Celulares & Popups
                  </h4>
                  <p className="text-xs text-amber-700/90 leading-normal">
                    Navegadores móveis (Safari no iOS e Chrome no Android) costumam bloquear pop-ups. Caso ocorram erros ao entrar no celular, oferecemos o <strong className="text-amber-900 font-semibold">"Redirecionamento Seguro"</strong>, resolvendo qualquer impedimento de pop-ups bloqueados nativamente para uma conexão perfeita!
                  </p>
                </div>
              </div>

              {/* Informação sobre segurança */}
              <div className="flex items-center gap-2.5 text-gray-400 text-xs">
                <ShieldCheck className="h-4.5 w-4.5 text-emerald-500" />
                <span>Integração 100% privada e oficial sob aprovação da API do Google.</span>
              </div>
            </div>

            {/* Lado Direito: Caixa de Conexão com botões específicos */}
            <div className="md:col-span-5 bg-white rounded-3xl border border-gray-100 p-6 sm:p-8 shadow-xl relative overflow-hidden flex flex-col justify-between min-h-[350px]">
              
              {/* Efeito decorativo sutil */}
              <div className="absolute -top-10 -right-10 w-32 h-32 bg-rose-500/10 rounded-full blur-2xl" />
              
              <div className="space-y-4 relative z-10">
                <div className="bg-gray-50 p-3.5 rounded-2xl w-fit border border-gray-100 text-gray-700">
                  <KeyRound className="h-6 w-6 text-rose-500" />
                </div>
                <div>
                  <h3 className="font-display font-bold text-lg text-gray-900">
                    Acesse sua Galeria
                  </h3>
                  <p className="text-xs text-gray-400 mt-1 leading-normal">
                    Conecte sua conta do Google de forma autorizada. Você controla os termos.
                  </p>
                </div>
              </div>

              {/* Botões de Login */}
              <div className="space-y-3.5 pt-6 relative z-10">
                
                {/* 1. Método Recomendado para Computadores */}
                <button
                  onClick={() => handleLogin(false)}
                  disabled={isLoggingIn}
                  className="w-full flex items-center justify-center gap-3 py-3 px-4 bg-gray-900 hover:bg-gray-800 text-white font-medium rounded-xl text-sm transition-all shadow-md hover:shadow-lg disabled:opacity-60 cursor-pointer active:scale-[0.98]"
                >
                  {isLoggingIn && loginMethod === 'popup' ? (
                    <Loader className="h-4 w-4 animate-spin text-gray-400" />
                  ) : (
                    <svg className="h-4 w-4" viewBox="0 0 48 48">
                      <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z" />
                      <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z" />
                      <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z" />
                      <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z" />
                    </svg>
                  )}
                  <span>Entrar com o Google (Popup)</span>
                </button>

                {/* Linha separadora discreta */}
                <div className="flex items-center gap-2 my-2 text-[10px] text-gray-400 font-mono uppercase tracking-widest justify-center">
                  <span className="h-px bg-gray-100 flex-1" />
                  <span>Se estiver no celular</span>
                  <span className="h-px bg-gray-100 flex-1" />
                </div>

                {/* 2. Método Corrigido de Redirect para Celular */}
                <button
                  onClick={() => handleLogin(true)}
                  disabled={isLoggingIn}
                  className="w-full flex items-center justify-center gap-2 py-3 px-4 bg-rose-50 hover:bg-rose-100 text-rose-600 font-semibold rounded-xl text-xs border border-rose-100/60 transition-all disabled:opacity-60 cursor-pointer active:scale-[0.98]"
                >
                  {isLoggingIn && loginMethod === 'redirect' ? (
                    <Loader className="h-3.5 w-3.5 animate-spin text-rose-400" />
                  ) : (
                    <Smartphone className="h-4.5 w-4.5" />
                  )}
                  <span>Usar Redirecionamento de Celular</span>
                </button>
              </div>

              {/* Detalhes sobre os limites de escopo */}
              <div className="text-[10px] text-gray-400 text-center leading-normal pt-4 border-t border-gray-50 uppercase font-mono tracking-wide">
                Permissão Solicitada: gmail.readonly (Apenas leitura)
              </div>

            </div>
          </div>
        </div>
      ) : (
        /* RENDERIZAÇÃO ESTADO: AUTENTICADO (DASHBOARD DA GALERIA) */
        <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
          
          {/* Dashboard Stats */}
          <StatsPanel
            photos={photos.filter((photo) => {
              const uKey = `${photo.messageId}_${photo.attachmentId}`;
              return !hiddenPhotoIds.includes(uKey);
            })}
            isRefreshing={isRefreshing}
            onRefresh={() => loadGallery(accessToken, true)}
          />

          {/* Barra de Filtros e Busca */}
          <div className="bg-white rounded-3xl border border-gray-100 p-4 sm:p-5 flex flex-col md:flex-row items-center justify-between gap-4 shadow-xs">
            
            {/* Input de Pesquisa */}
            <div className="relative w-full md:w-80">
              <span className="absolute inset-y-0 left-3 flex items-center pointer-events-none text-gray-400">
                <Search className="h-4.5 w-4.5" />
              </span>
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Buscar por arquivo, assunto ou remetente..."
                className="w-full text-sm font-sans pl-10 pr-4 py-2.5 bg-gray-50/80 rounded-2xl border border-gray-100 focus:outline-none focus:border-rose-400/80 focus:bg-white transition-all text-gray-800"
              />
            </div>

            {/* Abas de Filtros de Formato (Tabs) */}
            <div className="flex flex-wrap items-center gap-1.5 w-full md:w-auto overflow-x-auto pb-1 md:pb-0">
              {[
                { id: 'all', label: 'Tudo' },
                { id: 'jpg', label: 'JPG' },
                { id: 'png', label: 'PNG' },
                { id: 'webp', label: 'WEBP' },
                { id: 'other', label: 'Outros' },
              ].map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveFilter(tab.id)}
                  className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold tracking-wide transition cursor-pointer ${
                    activeFilter === tab.id
                      ? 'bg-rose-600 text-white shadow-xs'
                      : 'text-gray-500 hover:text-gray-800 hover:bg-gray-100'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {/* Menu de Ordenação & Ocultas */}
            <div className="flex items-center gap-3 w-full md:w-auto justify-between md:justify-end border-t md:border-t-0 pt-3 md:pt-0 border-gray-100">
              <div className="flex items-center gap-1.5 text-xs text-gray-400 font-semibold font-mono uppercase tracking-wide">
                <SlidersHorizontal className="h-3.5 w-3.5" />
                <span>Ordenar:</span>
              </div>
              
              <select
                value={activeSort}
                onChange={(e) => setActiveSort(e.target.value as 'newest' | 'oldest')}
                className="text-xs font-semibold bg-gray-50 hover:bg-gray-100 p-2 rounded-xl border border-gray-200/80 focus:outline-none"
              >
                <option value="newest">Mais Recentes</option>
                <option value="oldest">Mais Antigas</option>
              </select>

              {hiddenPhotoIds.length > 0 && (
                <button
                  onClick={handleResetHidden}
                  className="text-xs text-rose-600 hover:text-rose-700 font-semibold underline decoration-2 underline-offset-2 cursor-pointer ml-2"
                  title="Mostrar todas as fotos ocultadas"
                >
                  Mostrar ocultas ({hiddenPhotoIds.length})
                </button>
              )}
            </div>

          </div>

          {/* MENSAGEM DE ERRO SE HOUVER */}
          {errorText && (
            <div className="p-4 bg-red-50 rounded-2xl border border-red-100 text-sm text-red-700 text-center font-medium max-w-xl mx-auto">
              <p>{errorText}</p>
              <button
                onClick={() => loadGallery(accessToken, true)}
                className="mt-2 text-xs font-bold text-red-900 underline pointer-events-auto"
              >
                Tentar Recarregar
              </button>
            </div>
          )}

          {/* GRILLA DE FOTOS OU VISÃO DE ESTADOS */}
          {isRefreshing && processedPhotos.length === 0 ? (
            /* Estado: Carregando Inicial */
            <div className="py-24 flex flex-col items-center justify-center gap-4 text-rose-600/90 max-w-md mx-auto text-center">
              <Loader className="h-10 w-10 animate-spin" />
              <div className="space-y-1">
                <p className="font-display font-medium text-gray-900">Sincronizando anexos com seu Gmail...</p>
                <p className="text-xs text-gray-400">Isso pode levar alguns segundos dependendo do tamanho da sua caixa de entrada.</p>
              </div>
            </div>
          ) : processedPhotos.length === 0 ? (
            /* Estado: Sem Resultados */
            <div className="py-24 text-center max-w-md mx-auto space-y-4">
              <div className="p-4 bg-gray-100 rounded-2xl w-fit mx-auto text-gray-400">
                <ImageIcon className="h-8 w-8" />
              </div>
              <div className="space-y-1">
                <h3 className="font-display font-bold text-gray-900 text-sm sm:text-base">Nenhuma foto encontrada</h3>
                <p className="text-xs text-gray-400 leading-normal">
                  {searchTerm !== '' 
                    ? 'Nenhum anexo corresponde aos termos da sua busca. Que tal tentar outras palavras?'
                    : 'Nenhum anexo de imagem foi descoberto nos seus emails recentes. Envie uma foto para si mesmo por e-mail para testar!'}
                </p>
              </div>
              <button
                onClick={() => {
                  setSearchTerm('');
                  setActiveFilter('all');
                  loadGallery(accessToken, true);
                }}
                className="px-4 py-2 bg-rose-600 text-white rounded-xl text-xs font-semibold shadow-xs hover:bg-rose-700 transition cursor-pointer active:scale-95"
              >
                Limpar filtros e Sincronizar
              </button>
            </div>
          ) : (
            /* Estado: Galeria exibindo resultados */
            <div className="space-y-8">
              {/* Grid bento */}
              <motion.div 
                layout 
                className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6"
              >
                <AnimatePresence mode="popLayout">
                  {processedPhotos.map((photo) => (
                    <PhotoCard
                      key={`${photo.messageId}_${photo.attachmentId}`}
                      photo={photo}
                      accessToken={accessToken}
                      onOpenLightbox={setSelectedPhoto}
                      onHidePhoto={handleHidePhoto}
                      onPhotoLoaded={handlePhotoLoaded}
                    />
                  ))}
                </AnimatePresence>
              </motion.div>

              {/* Botão Ver Mais (Paginação) */}
              {nextPageToken && (
                <div className="flex justify-center pt-4">
                  <button
                    onClick={handleLoadMore}
                    disabled={isRefreshing}
                    className="flex items-center gap-2 px-6 py-3 bg-white text-gray-700 hover:bg-gray-50 border border-gray-100 rounded-2xl transition duration-200 text-sm font-semibold shadow-xs disabled:opacity-60 cursor-pointer active:scale-95"
                  >
                    {isRefreshing ? (
                      <Loader className="h-4 w-4 animate-spin text-rose-500" />
                    ) : (
                      <ChevronDown className="h-4 w-4" />
                    )}
                    <span>{isRefreshing ? 'Carregando mais e-mails...' : 'Ver Mais Fotos'}</span>
                  </button>
                </div>
              )}
            </div>
          )}

          {/* INFOBAR DESCRITIVO INFERIOR */}
          <div className="text-center py-6 border-t border-gray-100 space-y-1">
            <p className="text-[10px] text-gray-400 font-mono uppercase tracking-widest">
              Gmail Photo Gallery v1.1
            </p>
            <p className="text-[11px] text-gray-500 max-w-lg mx-auto">
              Seus dados do Gmail não são coletados por nós. As requisições são seguras e se comunicam de forma direta e protegida com as APIs do Google e o Firebase Auth.
            </p>
          </div>

        </main>
      )}

      {/* LIGHTBOX / POPUP DETALHADO */}
      <LightboxModal
        photo={selectedPhoto}
        onClose={() => setSelectedPhoto(null)}
        onHidePhoto={handleHidePhoto}
      />

    </div>
  );
}
