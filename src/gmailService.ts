export interface GmailMessageHeader {
  name: string;
  value: string;
}

export interface GmailAttachmentInfo {
  attachmentId: string;
  filename: string;
  mimeType: string;
  size: number;
  messageId: string;
  sender: string;
  subject: string;
  date: string;
  snippet: string;
  timestamp: number;
}

export interface GalleryPhoto extends GmailAttachmentInfo {
  dataUrl?: string; // Cache de url base64 para renderização direta
  loading?: boolean;
  error?: string;
}

// Função utilitária para extrair cabeçalhos principais do Email
function parseHeaders(headers: GmailMessageHeader[]) {
  let subject = '(Sem Assunto)';
  let sender = '(Desconhecido)';
  let date = '';

  headers.forEach((header) => {
    const name = header.name.toLowerCase();
    if (name === 'subject') {
      subject = header.value;
    } else if (name === 'from') {
      sender = header.value;
    } else if (name === 'date') {
      date = header.value;
    }
  });

  return { subject, sender, date };
}

// Recursivamente busca anexos de imagem nas partes do Email
function findImageAttachments(
  part: any,
  messageId: string,
  sender: string,
  subject: string,
  date: string,
  snippet: string,
  timestamp: number,
  attachments: GmailAttachmentInfo[] = []
): GmailAttachmentInfo[] {
  if (!part) return attachments;

  // Verifica se a parte é um anexo de imagem
  const hasAttachmentId = part.body && part.body.attachmentId;
  const isImageMime = part.mimeType && part.mimeType.startsWith('image/');
  const hasImageExtension =
    part.filename &&
    /\.(jpg|jpeg|png|gif|webp|heic)$/i.test(part.filename);

  if (hasAttachmentId && (isImageMime || hasImageExtension)) {
    attachments.push({
      attachmentId: part.body.attachmentId,
      filename: part.filename || 'foto_anexo.jpg',
      mimeType: part.mimeType || 'image/jpeg',
      size: part.body.size || 0,
      messageId,
      sender,
      subject,
      date,
      snippet,
      timestamp,
    });
  }

  // Se tiver partes aninhadas, varre-as recursivamente
  if (part.parts && Array.isArray(part.parts)) {
    part.parts.forEach((subPart: any) => {
      findImageAttachments(
        subPart,
        messageId,
        sender,
        subject,
        date,
        snippet,
        timestamp,
        attachments
      );
    });
  }

  return attachments;
}

/**
 * Busca a lista de mensagens do Gmail que contêm anexos de fotos
 */
export const fetchGmailMessageList = async (
  accessToken: string,
  searchQuery = '',
  pageToken = '',
  maxResults = 25
): Promise<{ messages: { id: string; threadId: string }[]; nextPageToken?: string }> => {
  // Constrói query de busca focada em anexos de imagens
  const baseQuery = 'has:attachment (filename:jpg OR filename:jpeg OR filename:png OR filename:gif OR filename:webp OR filename:heic)';
  const combinedQuery = searchQuery ? `${searchQuery} ${baseQuery}` : baseQuery;

  const url = new URL('https://gmail.googleapis.com/gmail/v1/users/me/messages');
  url.searchParams.append('q', combinedQuery);
  url.searchParams.append('maxResults', maxResults.toString());
  if (pageToken) {
    url.searchParams.append('pageToken', pageToken);
  }

  const response = await fetch(url.toString(), {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Accept: 'application/json',
    },
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`Erro ao listar mensagens do Gmail: ${response.status} - ${errText}`);
  }

  const data = await response.json();
  return {
    messages: data.messages || [],
    nextPageToken: data.nextPageToken,
  };
};

/**
 * Busca os detalhes de uma mensagem específica do Gmail para encontrar anexos de imagem
 */
export const fetchMessageDetails = async (
  accessToken: string,
  messageId: string
): Promise<GmailAttachmentInfo[]> => {
  const url = `https://gmail.googleapis.com/gmail/v1/users/me/messages/${messageId}`;
  
  const response = await fetch(url, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Accept: 'application/json',
    },
  });

  if (!response.ok) {
    throw new Error(`Erro ao carregar detalhes do email ${messageId}: ${response.status}`);
  }

  const msg = await response.json();
  const headers = msg.payload?.headers || [];
  const { subject, sender, date } = parseHeaders(headers);
  const snippet = msg.snippet || '';
  const timestamp = msg.internalDate ? parseInt(msg.internalDate) : Date.now();

  const attachments: GmailAttachmentInfo[] = [];
  
  // Se houver partes no payload, varre recursivamente
  if (msg.payload) {
    findImageAttachments(
      msg.payload,
      messageId,
      sender,
      subject,
      date,
      snippet,
      timestamp,
      attachments
    );
  }

  return attachments;
};

/**
 * Busca o conteúdo Base64URL de um anexo de imagem no Gmail e o converte para uma URL amigável ao navegador
 */
export const fetchAttachmentData = async (
  accessToken: string,
  messageId: string,
  attachmentId: string,
  mimeType: string
): Promise<string> => {
  const url = `https://gmail.googleapis.com/gmail/v1/users/me/messages/${messageId}/attachments/${attachmentId}`;
  
  const response = await fetch(url, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Accept: 'application/json',
    },
  });

  if (!response.ok) {
    throw new Error(`Erro ao carregar o anexo ${attachmentId}: ${response.status}`);
  }

  const data = await response.json();
  if (!data.data) {
    throw new Error('Nenhum dado retornado para o anexo.');
  }

  // O Gmail codifica anexos usando Base64URL segura.
  // Precisamos substituir '-' por '+' e '_' por '/' para decodificar em Base64 padrão.
  const base64 = data.data.replace(/-/g, '+').replace(/_/g, '/');
  return `data:${mimeType};base64,${base64}`;
};

/**
 * Lixeira/Exclusão de Email (Mera simulação ou chamada real se o escopo permitisse, 
 * mas como o escopo da chave é readonly, nós omitimos exclusões destrutivas directas do Gmail
 * para segurança. Em vez disso, gerimos filtros locais inteligentes se o usuário quiser ocultar uma foto).
 */
