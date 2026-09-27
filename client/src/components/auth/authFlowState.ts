export type AuthMode = 'login' | 'register' | 'verify' | 'forgot' | 'reset';

export type AuthCompletion = 'VERIFY_EMAIL_SUCCESS' | 'RESET_PASSWORD_SUCCESS' | null;

export function getAuthCompletionCopy(completion: AuthCompletion) {
  if (completion === 'VERIFY_EMAIL_SUCCESS') {
    return {title: 'Xác minh email thành công', subtitle: 'Email đã được xác minh. Bạn có thể đăng nhập ngay bây giờ.'};
  }
  if (completion === 'RESET_PASSWORD_SUCCESS') {
    return {title: 'Đặt lại mật khẩu thành công', subtitle: 'Mật khẩu đã được cập nhật. Bạn có thể đăng nhập bằng mật khẩu mới.'};
  }
  return null;
}

export interface AuthFlowState {
  mode: AuthMode;
  completion: AuthCompletion;
}

export type AuthFlowEvent =
  | {type: 'SWITCH_MODE'; mode: AuthMode}
  | {type: 'REGISTER_SUCCEEDED'}
  | {type: 'VERIFY_EMAIL_SUCCEEDED'}
  | {type: 'FORGOT_PASSWORD_SUCCEEDED'}
  | {type: 'RESET_PASSWORD_SUCCEEDED'};

export function transitionAuthFlow(state: AuthFlowState, event: AuthFlowEvent): AuthFlowState {
  switch (event.type) {
    case 'SWITCH_MODE':
      return {mode: event.mode, completion: null};
    case 'REGISTER_SUCCEEDED':
      return {mode: 'verify', completion: null};
    case 'VERIFY_EMAIL_SUCCEEDED':
      return {mode: 'verify', completion: 'VERIFY_EMAIL_SUCCESS'};
    case 'FORGOT_PASSWORD_SUCCEEDED':
      return {mode: 'reset', completion: null};
    case 'RESET_PASSWORD_SUCCEEDED':
      return {mode: 'reset', completion: 'RESET_PASSWORD_SUCCESS'};
    default:
      return state;
  }
}
