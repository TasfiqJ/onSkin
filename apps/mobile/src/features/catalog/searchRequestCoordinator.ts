export type CatalogSearchRequest = Readonly<{
  query: string;
  controller: AbortController;
}>;

export type CatalogSearchBeginResult =
  | Readonly<{ kind: 'duplicate'; request: CatalogSearchRequest }>
  | Readonly<{
      kind: 'started';
      request: CatalogSearchRequest;
      superseded: boolean;
    }>;

/**
 * Retains only the current normalized query and controller for request identity.
 * Route state may publish only while `canPublish` accepts the exact controller;
 * diagnostics never receive the query.
 */
export class CatalogSearchRequestCoordinator {
  private activeRequest: CatalogSearchRequest | null = null;

  current(): CatalogSearchRequest | null {
    return this.activeRequest;
  }

  begin(query: string): CatalogSearchBeginResult {
    if (this.activeRequest?.query === query && !this.activeRequest.controller.signal.aborted) {
      return { kind: 'duplicate', request: this.activeRequest };
    }

    const superseded = this.cancel();
    const request = { query, controller: new AbortController() };
    this.activeRequest = request;
    return { kind: 'started', request, superseded };
  }

  cancel(): boolean {
    const request = this.activeRequest;
    if (!request) return false;

    this.activeRequest = null;
    request.controller.abort();
    return true;
  }

  canPublish(controller: AbortController, mounted: boolean): boolean {
    return mounted && !controller.signal.aborted && this.activeRequest?.controller === controller;
  }

  finish(controller: AbortController): boolean {
    if (this.activeRequest?.controller !== controller) return false;
    this.activeRequest = null;
    return true;
  }
}
