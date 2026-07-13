import { useState } from 'react';

import { createOwnerQueryScope, type OwnerQueryScope } from './queryKeys';

/** Stable for one mounted account-owned tree; a real boundary remount captures the next epoch. */
export function useOwnerQueryScope(): OwnerQueryScope {
  const [scope] = useState(createOwnerQueryScope);
  return scope;
}
