let backendToken: string | undefined;

export function setBackendAuthToken(token: string | undefined): void {
  backendToken = token;
}

export function getBackendAuthToken(): string | undefined {
  return backendToken;
}

export function authHeaders(): Record<string, string> {
  return backendToken ? { Authorization: `Bearer ${backendToken}` } : {};
}
