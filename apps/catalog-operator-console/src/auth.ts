import { createClient, type SupabaseClient } from '@supabase/supabase-js';

import type { OperatorConsoleEnvironment } from './env';

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const OTP_PATTERN = /^\d{6}$/;

export interface MfaState {
  readonly currentLevel: 'aal1' | 'aal2' | null;
  readonly nextLevel: 'aal1' | 'aal2' | null;
  readonly verifiedTotpFactors: ReadonlyArray<{
    readonly id: string;
    readonly friendlyName: string;
  }>;
}

type OperatorAuthClient = SupabaseClient;
type OperatorAuthClientFactory = (
  environment: OperatorConsoleEnvironment,
) => OperatorAuthClient;

function createOperatorAuthClient(
  environment: OperatorConsoleEnvironment,
): OperatorAuthClient {
  return createClient(environment.supabaseUrl, environment.publishableKey, {
    auth: {
      autoRefreshToken: true,
      detectSessionInUrl: false,
      flowType: 'pkce',
      persistSession: false,
    },
    global: {
      headers: { 'X-Client-Info': 'layerwell-catalog-operator-console/0.1' },
    },
  });
}

function assuranceLevel(value: unknown): 'aal1' | 'aal2' | null {
  return value === 'aal1' || value === 'aal2' ? value : null;
}

export class OperatorAuth {
  readonly #environment: OperatorConsoleEnvironment;
  readonly #clientFactory: OperatorAuthClientFactory;
  #client: OperatorAuthClient;

  constructor(
    environment: OperatorConsoleEnvironment,
    clientFactory: OperatorAuthClientFactory = createOperatorAuthClient,
  ) {
    this.#environment = environment;
    this.#clientFactory = clientFactory;
    this.#client = clientFactory(environment);
  }

  async requestEmailOtp(rawEmail: string): Promise<string> {
    const email = rawEmail.trim().toLowerCase();
    if (!EMAIL_PATTERN.test(email) || email.length > 254) {
      throw new Error('Enter a valid operator email address.');
    }
    const { error } = await this.#client.auth.signInWithOtp({
      email,
      options: { shouldCreateUser: false },
    });
    if (error) throw new Error('The sign-in code could not be requested.');
    return email;
  }

  async verifyEmailOtp(email: string, rawToken: string): Promise<void> {
    const token = rawToken.trim();
    if (!EMAIL_PATTERN.test(email) || !OTP_PATTERN.test(token)) {
      throw new Error('Enter the six-digit sign-in code.');
    }
    const { error } = await this.#client.auth.verifyOtp({ email, token, type: 'email' });
    if (error) throw new Error('The sign-in code is invalid or expired.');
  }

  async mfaState(): Promise<MfaState> {
    const [assurance, factors] = await Promise.all([
      this.#client.auth.mfa.getAuthenticatorAssuranceLevel(),
      this.#client.auth.mfa.listFactors(),
    ]);
    if (assurance.error || factors.error) {
      throw new Error('The MFA state could not be verified.');
    }
    const verifiedTotpFactors = factors.data.totp
      .filter((factor) => factor.status === 'verified')
      .map((factor) => ({
        id: factor.id,
        friendlyName: factor.friendly_name?.trim() || 'Authenticator app',
      }));
    return {
      currentLevel: assuranceLevel(assurance.data.currentLevel),
      nextLevel: assuranceLevel(assurance.data.nextLevel),
      verifiedTotpFactors,
    };
  }

  async verifyTotp(factorId: string, rawCode: string): Promise<void> {
    const code = rawCode.trim();
    if (!factorId || !OTP_PATTERN.test(code)) {
      throw new Error('Enter the six-digit authenticator code.');
    }
    const challenge = await this.#client.auth.mfa.challenge({ factorId });
    if (challenge.error) throw new Error('The MFA challenge could not be created.');
    const verification = await this.#client.auth.mfa.verify({
      factorId,
      challengeId: challenge.data.id,
      code,
    });
    if (verification.error) throw new Error('The authenticator code is invalid or expired.');
  }

  async accessToken(): Promise<string> {
    const { data, error } = await this.#client.auth.getSession();
    const token = data.session?.access_token;
    if (error || !token) throw new Error('The operator session has expired.');
    return token;
  }

  async signOut(): Promise<void> {
    const retiredClient = this.#client;
    retiredClient.auth.stopAutoRefresh();
    let failed = false;
    try {
      const { error } = await retiredClient.auth.signOut({ scope: 'local' });
      failed = error !== null;
    } catch {
      failed = true;
    } finally {
      retiredClient.auth.stopAutoRefresh();
      // Replace the client even when remote revocation fails. This destroys
      // the only in-memory token reference and prevents a retired client from
      // auto-refreshing after the console has cleared its UI.
      this.#client = this.#clientFactory(this.#environment);
    }
    if (failed) throw new Error('The operator session could not be revoked.');
  }
}
