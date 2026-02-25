export const PedidoErrorTypes = {
  VALIDATION: 'validation',
  LOCATION: 'location',
  NETWORK: 'network',
  NOTIFICATION: 'notification',
  FIREBASE: 'firebase',
  PERMISSION: 'permission',
  GENERAL: 'general'
};

export class PedidoError extends Error {
  constructor(message, type = PedidoErrorTypes.GENERAL, code = null, field = null) {
    super(message);
    this.name = 'PedidoError';
    this.type = type;
    this.code = code;
    this.field = field;
    this.timestamp = new Date();
  }
}

export const PedidoErrorService = {
  handleError: (error, context = '') => {
    console.error(`[${context}] Erro:`, error);
    
    let userMessage = 'Ocorreu um erro inesperado. Tente novamente.';
    let type = PedidoErrorTypes.GENERAL;
    let field = null;
    
    if (error instanceof PedidoError) {
      userMessage = error.message;
      type = error.type;
      field = error.field;
    } else if (error.code) {
      switch (error.code) {
        case 'permission-denied':
          userMessage = 'Permissão negada para acessar este recurso.';
          type = PedidoErrorTypes.PERMISSION;
          break;
        case 'unavailable':
          userMessage = 'Serviço indisponível. Verifique sua conexão.';
          type = PedidoErrorTypes.NETWORK;
          break;
        case 'auth/network-request-failed':
          userMessage = 'Erro de conexão. Verifique sua internet.';
          type = PedidoErrorTypes.NETWORK;
          break;
        default:
          userMessage = error.message || userMessage;
      }
    } else if (error.message) {
      userMessage = error.message;
    }
    
    return { userMessage, type, field, originalError: error };
  },
  
  showError: (errorResult, onRetry = null) => {
    const { userMessage, type, field } = errorResult;
    
    const title = type === PedidoErrorTypes.VALIDATION ? '📝 Campo Obrigatório' : 
                  type === PedidoErrorTypes.LOCATION ? '📍 Erro de Localização' :
                  '❌ Ops, algo deu errado';
    
    const buttons = [
      { text: 'OK', style: 'default' }
    ];
    
    if (onRetry) {
      buttons.unshift({
        text: 'Tentar Novamente',
        onPress: onRetry,
        style: 'cancel'
      });
    }
    
    Alert.alert(title, userMessage, buttons, { cancelable: true });
  },
  
  logError: (error, context) => {
    const errorLog = {
      context,
      error: error instanceof PedidoError ? {
        message: error.message,
        type: error.type,
        code: error.code,
        field: error.field,
        timestamp: error.timestamp
      } : {
        message: error.message,
        code: error.code,
        stack: error.stack
      },
      timestamp: new Date().toISOString(),
      user: auth.currentUser?.uid || 'anonymous'
    };
    
    console.log('📋 Log de Erro Pedido Urgente:', errorLog);
  }
};

export const executeWithErrorHandling = async (operation, context, fallback = null) => {
  try {
    return await operation();
  } catch (error) {
    const errorResult = PedidoErrorService.handleError(error, context);
    PedidoErrorService.logError(error, context);
    
    if (fallback) {
      return fallback;
    }
    
    throw new PedidoError(errorResult.userMessage, errorResult.type, error.code, errorResult.field);
  }
};