// RPC transport fixture only. The tests execute the real index.ts handler,
// identity HMAC helper and webhookCore.ts; SQL behavior is tested separately.
import type { RevenueCatAtomicArgs } from './webhookCore.ts';

export const transport = {
  calls: [] as { functionName: string; args: RevenueCatAtomicArgs }[],
  data: null as unknown,
  error: null as unknown,
  reject: false,
};

export function createClient(_url: string, _key: string) {
  return {
    rpc(functionName: string, args: RevenueCatAtomicArgs) {
      transport.calls.push({ functionName, args });
      return transport.reject
        ? Promise.reject(new Error('fixture transport response lost'))
        : Promise.resolve({ data: transport.data, error: transport.error });
    },
  };
}
