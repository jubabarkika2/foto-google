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

// Token de acesso cached
let cachedAccessToken: string | null = getStoredToken();
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
  onAuthSuccess?: (user: User, token: string) => void,
  onAuthFailure?: () => void
) => {
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
  await auth.signOut();
  cachedAccessToken = null;
  setStoredToken(null);
  notifyTokenListeners(null);
};
