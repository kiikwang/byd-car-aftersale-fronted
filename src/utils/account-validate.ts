/**
 * 账号格式校验规则（用户名 / 密码），登录与注册页共用。
 * 用户名：3~20 位，必须以英文字母开头，只能包含字母、数字、下划线，不能包含空格。
 * 密码（注册/设密场景）：6~20 位，必须同时包含字母与数字，不能包含空格。
 * 登录场景仅做格式层面的轻量校验（不校验密码强度），避免影响已存在的历史账号登录。
 */
export const USERNAME_PATTERN = /^[A-Za-z][A-Za-z0-9_]{2,19}$/
export const PASSWORD_STRENGTH_PATTERN = /^(?=.*[A-Za-z])(?=.*\d)\S{6,20}$/

export function validateUsernameFormat(username: string): string | null {
  if (!username) return '用户名不能为空'
  if (/\s/.test(username)) return '用户名不能包含空格'
  if (!/^[A-Za-z]/.test(username)) return '用户名首字母必须为英文字母'
  if (username.length < 3 || username.length > 20) return '用户名长度需为 3~20 位'
  if (!USERNAME_PATTERN.test(username)) return '用户名只能包含字母、数字和下划线'
  return null
}

export function validateLoginPassword(password: string): string | null {
  if (!password) return '密码不能为空'
  if (/\s/.test(password)) return '密码不能包含空格'
  return null
}

export function validatePasswordStrength(password: string): string | null {
  const basic = validateLoginPassword(password)
  if (basic) return basic
  if (password.length < 6 || password.length > 20) return '密码长度需为 6~20 位'
  if (!PASSWORD_STRENGTH_PATTERN.test(password)) return '密码需同时包含字母和数字'
  return null
}

/** 登录页格式预检查：只做格式层面校验，不校验密码强度，避免影响历史演示账号登录。 */
export function validateLoginForm(username: string, password: string): string | null {
  if (!username || !password) return '请输入用户名和密码'
  const usernameErr = validateUsernameFormat(username)
  if (usernameErr) return usernameErr
  return validateLoginPassword(password)
}
