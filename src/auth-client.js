const config = () => window.LEARN_K8S_CONFIG || {};
const SESSION_KEY = 'learn-k8s-pro-session';

async function cognito(action, payload) {
  const region = config().awsRegion;
  if (!region || !config().cognitoClientId) {
    throw new Error('Authentication is not configured yet.');
  }

  const response = await fetch(`https://cognito-idp.${region}.amazonaws.com/`, {
    method:'POST',
    headers:{
      'content-type':'application/x-amz-json-1.1',
      'x-amz-target':`AWSCognitoIdentityProviderService.${action}`
    },
    body:JSON.stringify(payload)
  });

  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.message || data.__type || 'Cognito request failed');
  }
  return data;
}

export function session() {
  try {
    return JSON.parse(sessionStorage.getItem(SESSION_KEY) || 'null');
  } catch {
    return null;
  }
}

function save(value) {
  sessionStorage.setItem(SESSION_KEY, JSON.stringify(value));
  return value;
}

export function signOut() {
  sessionStorage.removeItem(SESSION_KEY);
}

export async function signUp(email, password) {
  return cognito('SignUp', {
    ClientId:config().cognitoClientId,
    Username:email,
    Password:password,
    UserAttributes:[{ Name:'email', Value:email }]
  });
}

export async function confirmSignUp(email, code) {
  return cognito('ConfirmSignUp', {
    ClientId:config().cognitoClientId,
    Username:email,
    ConfirmationCode:code
  });
}

export async function signIn(email, password) {
  const data = await cognito('InitiateAuth', {
    ClientId:config().cognitoClientId,
    AuthFlow:'USER_PASSWORD_AUTH',
    AuthParameters:{
      USERNAME:email,
      PASSWORD:password
    }
  });

  const result = data.AuthenticationResult;
  return save({
    email,
    idToken:result.IdToken,
    accessToken:result.AccessToken,
    refreshToken:result.RefreshToken,
    expiresAt:Date.now() + ((result.ExpiresIn || 3600) * 1000)
  });
}

async function validSession() {
  const current = session();
  if (!current) return null;

  if (current.expiresAt && current.expiresAt > Date.now() + 60_000) {
    return current;
  }

  if (!current.refreshToken) {
    signOut();
    throw new Error('Your sign-in session expired. Please sign in again.');
  }

  try {
    const data = await cognito('InitiateAuth', {
      ClientId:config().cognitoClientId,
      AuthFlow:'REFRESH_TOKEN_AUTH',
      AuthParameters:{
        REFRESH_TOKEN:current.refreshToken
      }
    });

    const result = data.AuthenticationResult;
    return save({
      ...current,
      idToken:result.IdToken,
      accessToken:result.AccessToken,
      refreshToken:result.RefreshToken || current.refreshToken,
      expiresAt:Date.now() + ((result.ExpiresIn || 3600) * 1000)
    });
  } catch (error) {
    signOut();
    throw new Error('Your sign-in session expired. Please sign in again.');
  }
}

export async function api(path, options={}) {
  const base = config().apiUrl?.replace(/\/$/,'');
  if (!base) throw new Error('AWS API is not configured yet.');

  const current = await validSession();
  const headers = {
    'content-type':'application/json',
    ...(options.headers || {})
  };

  if (current?.idToken) {
    headers.authorization = `Bearer ${current.idToken}`;
  }

  const response = await fetch(base + path, {
    ...options,
    headers
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data.message || `API request failed (${response.status})`);
  }
  return data;
}
