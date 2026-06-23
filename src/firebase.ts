import { initializeApp } from 'firebase/app';
import {
  getAuth,
  signInWithPopup,
  signInWithRedirect,
  getRedirectResult,
  GoogleAuthProvider,
  onAuthStateChanged,
  User,
} from 'firebase/auth';
import firebaseConfig from '../firebase-applet-config.json';

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);

export const provider = new GoogleAuthProvider();
// Adiciona o escopo do Gmail necessário
provider.addScope('https://www.googleapis.com/auth/gmail.readonly');

// Flag para indicar fluxo de entrada
let isSigningIn = false;

// Tenta carregar o token salvo anteriormente no localStorage para reter a conexão em reloads
const getStoredToken = (): string | null => {
  try {
    return localStorage.getItem('gmail_gallery_access_token');
  } catch {
    return null;
  }
};

const setStoredToken = (token: string | null) => {
  try {
    if (token) {
      localStorage.setItem('gmail_gallery_access_token', token);
    } else {
      localStorage.removeItem('gmail_gallery_access_token');
    }
  } catch (err) {
    console.error('Erro ao salvar token localmente:', err);
  }
};

export const getStoredUser = (): any | null => {
  try {
    const saved = localStorage.getItem('gmail_gallery_gsi_user');
    return saved ? JSON.parse(saved) : null;
  } catch {
    return null;
  }
};

export const setStoredUser = (user: any | null) => {
  try {
    if (user) {
      localStorage.setItem('gmail_gallery_gsi_user', JSON.stringify(user));
    } else {
      localStorage.removeItem('gmail_gallery_gsi_user');
    }
  } catch {}
};

// Token de acesso cached
let cachedAccessToken: string | null = getStoredToken();
// Usuário GSI cached
let cachedGsiUser: any | null = getStoredUser();
// Callback arrays para notificar mudanças do token
const tokenListeners: Array<(token: string | null) => void> = [];


export const registerTokenListener = (listener: (token: string | null) => void) => {
  tokenListeners.push(listener);
  // Executa imediatamente com o valor atual
  listener(cachedAccessToken);
  return () => {
    const index = tokenListeners.indexOf(listener);
    if (index > -1) {
      tokenListeners.splice(index, 1);
    }
  };
};

const notifyTokenListeners = (token: string | null) => {
  tokenListeners.forEach((listener) => listener(token));
};

// Verifica se estamos em um celular/browser móvel
export const isMobileBrowser = (): boolean => {
  if (typeof window === 'undefined' || !window.navigator) return false;
  const ua = window.navigator.userAgent || '';
  return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(ua);
};

// Inicializa o listener de autenticação e tenta obter o resultado do redirecionamento
export const initAuth = (
  onAuthSuccess?: (user: any, token: string) => void,
  onAuthFailure?: () => void
) => {
  // Se já temos dados do login GSI salvos localmente, inicializa direto de imediato!
  const storedUser = getStoredUser();
  const storedToken = getStoredToken();
  if (storedUser && storedToken) {
    cachedAccessToken = storedToken;
    cachedGsiUser = storedUser;
    notifyTokenListeners(storedToken);
    if (onAuthSuccess) {
      setTimeout(() => onAuthSuccess(storedUser, storedToken), 10);
    }
  }

  // Trata o resultado do redirect (muito útil em navegadores móveis)
  getRedirectResult(auth)
    .then((result) => {
      if (result) {
        const credential = GoogleAuthProvider.credentialFromResult(result);
        if (credential?.accessToken) {
          cachedAccessToken = credential.accessToken;
          setStoredToken(cachedAccessToken);
          notifyTokenListeners(cachedAccessToken);
          if (onAuthSuccess) {
            onAuthSuccess(result.user, cachedAccessToken);
          }
        }
      }
    })
    .catch((error) => {
      console.error('Erro ao recuperar resultado do redirect:', error);
    });

  return onAuthStateChanged(auth, async (user: User | null) => {
    if (user) {
      // Se já temos o token no cache ou localStorage, aproveitamos ele
      const currentToken = cachedAccessToken || getStoredToken();
      if (currentToken) {
        cachedAccessToken = currentToken;
        setStoredToken(currentToken);
        if (onAuthSuccess) onAuthSuccess(user, currentToken);
      } else if (!isSigningIn) {
        // Se temos usuário mas perdemos o token, limpamos tudo
        cachedAccessToken = null;
        setStoredToken(null);
        notifyTokenListeners(null);
        if (onAuthFailure) onAuthFailure();
      }
    } else {
      // Se não temos usuário Firebase mas temos usuário GSI, mantemos conectado via GSI!
      const gsiUser = getStoredUser();
      const gsiToken = getStoredToken();
      if (gsiUser && gsiToken) {
        if (onAuthSuccess) onAuthSuccess(gsiUser, gsiToken);
        return;
      }

      cachedAccessToken = null;
      setStoredToken(null);
      notifyTokenListeners(null);
      if (onAuthFailure) onAuthFailure();
    }
  });
};

// Login com suporte a Popup ou Redirect como fallback para mobile
export const googleSignIn = async (useRedirect = false): Promise<{ user: User; accessToken: string } | null> => {
  try {
    isSigningIn = true;
    
    // Se o usuário pedir redirect ou se detectamos que está em dispositivo móvel
    if (useRedirect || isMobileBrowser()) {
      console.log('Utilizando signInWithRedirect para evitar bloqueios de popup em dispositivos móveis.');
      await signInWithRedirect(auth, provider);
      return null;
    }

    // Caso contrário, tenta Popup
    const result = await signInWithPopup(auth, provider);
    const credential = GoogleAuthProvider.credentialFromResult(result);
    if (!credential?.accessToken) {
      throw new Error('Falha ao obter o token de acesso do Gmail.');
    }

    cachedAccessToken = credential.accessToken;
    setStoredToken(cachedAccessToken);
    notifyTokenListeners(cachedAccessToken);
    return { user: result.user, accessToken: cachedAccessToken };
  } catch (error: any) {
    console.error('Erro no fluxo de login:', error);
    
    // Se falhar por causa de bloqueio de popup, tenta redirecionamento automaticamente
    if (error.code === 'auth/popup-blocked' || error.code === 'auth/cancelled-popup-request') {
      console.warn('Popup bloqueado ou cancelado. Tentando fallback com Redirect...');
      await signInWithRedirect(auth, provider);
      return null;
    }
    
    throw error;
  } finally {
    isSigningIn = false;
  }
};

export const getAccessToken = async (): Promise<string | null> => {
  return cachedAccessToken || getStoredToken();
};

export const logout = async () => {
  try {
    await auth.signOut();
  } catch (err) {
    console.warn('Erro ao deslogar do Firebase (pode ser ignorado se login GSI ativo):', err);
  }
  cachedAccessToken = null;
  cachedGsiUser = null;
  setStoredToken(null);
  setStoredUser(null);
  notifyTokenListeners(null);
};

// --- INTEGRAÇÃO DIRETA COM O GOOGLE IDENTITY SERVICES (GSI) ---

let gsiScriptParsed = false;

export const loadGsi = (): Promise<any> => {
  return new Promise((resolve, reject) => {
    if ((window as any).google?.accounts?.oauth2) {
      resolve((window as any).google);
      return;
    }
    if (gsiScriptParsed) {
      // Já está carregando, espera um tempo ou verifica presença
      const interval = setInterval(() => {
        if ((window as any).google?.accounts?.oauth2) {
          clearInterval(interval);
          resolve((window as any).google);
        }
      }, 100);
      return;
    }
    
    gsiScriptParsed = true;
    const script = document.createElement('script');
    script.src = 'https://accounts.google.com/gsi/client';
    script.async = true;
    script.defer = true;
    script.onload = () => {
      resolve((window as any).google);
    };
    script.onerror = (e) => {
      gsiScriptParsed = false;
      reject(new Error('Falha ao carregar o script do Google Identity Services (GSI). Verifique sua conexão.'));
    };
    document.head.appendChild(script);
  });
};

export const signInWithGsi = async (
  clientId: string,
  scope = 'https://www.googleapis.com/auth/gmail.readonly https://www.googleapis.com/auth/userinfo.profile https://www.googleapis.com/auth/userinfo.email'
): Promise<{ user: any; accessToken: string }> => {
  const google = await loadGsi();
  return new Promise((resolve, reject) => {
    try {
      const client = google.accounts.oauth2.initTokenClient({
        client_id: clientId,
        scope: scope,
        callback: async (response: any) => {
          if (response.error) {
            reject(new Error(response.error_description || response.error));
            return;
          }
          if (response.access_token) {
            const token = response.access_token;
            try {
              // Busca os dados do perfil do usuário na API oficial de informações do Google
              const userRes = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
                headers: { Authorization: `Bearer ${token}` },
              });
              
              if (!userRes.ok) {
                throw new Error('Falha ao obter perfil de usuário.');
              }
              
              const googleUser = await userRes.json();
              const profileUser = {
                uid: googleUser.sub,
                displayName: googleUser.name || googleUser.given_name || 'Usuário Google',
                email: googleUser.email,
                photoURL: googleUser.picture || null,
              };

              cachedAccessToken = token;
              cachedGsiUser = profileUser;
              setStoredToken(token);
              setStoredUser(profileUser);
              notifyTokenListeners(token);
              
              resolve({ user: profileUser, accessToken: token });
            } catch (err) {
              // Fallback gracioso com usuário simulado se a API de UserInfo falhar
              console.warn('Falha ao buscar dados detalhados. Usando usuário simplificado:', err);
              const fallbackUser = {
                uid: 'gsi-user-' + Date.now(),
                displayName: 'Usuário Google Autenticado',
                email: 'conectado@gsi.com',
                photoURL: null,
              };
              
              cachedAccessToken = token;
              cachedGsiUser = fallbackUser;
              setStoredToken(token);
              setStoredUser(fallbackUser);
              notifyTokenListeners(token);
              
              resolve({ user: fallbackUser, accessToken: token });
            }
          } else {
            reject(new Error('Nenhum Access Token retornado pelo Google Identity Services.'));
          }
        },
        error_callback: (err: any) => {
          reject(err);
        }
      });
      client.requestAccessToken();
    } catch (err) {
      reject(err);
    }
  });
};

