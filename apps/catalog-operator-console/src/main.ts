import './styles.css';

import { OperatorAuth } from './auth';
import { readEnvironment, type OperatorConsoleEnvironment } from './env';
import {
  OperatorApi,
  OperatorApiError,
  type ItemClaim,
  type ItemDetail,
  type OperatorSession,
  type PresentationValue,
  type QueueCursor,
  type QueueItem,
  type QueueKind,
} from './operatorApi';
import {
  millisecondsUntilExpiry,
  recordActivity,
  sessionExpiryReason,
  type SessionClock,
} from './sessionTimer';
import { SessionWorkEpoch } from './sessionWorkEpoch';
import {
  canClaim,
  canReadQueue,
  leaseIsCurrent,
  releaseReceiptId,
  transitionOptionsFor,
  type TransitionOption,
} from './workflow';

type NoticeTone = 'info' | 'warning' | 'error';
type AuthStage = 'email' | 'email_code' | 'totp';

interface Notice {
  readonly message: string;
  readonly tone: NoticeTone;
}

const mountedRoot = document.querySelector<HTMLElement>('#app');
if (!mountedRoot) throw new Error('Operator console mount point is missing.');
const root: HTMLElement = mountedRoot;

let environment: OperatorConsoleEnvironment;
let auth: OperatorAuth;
let api: OperatorApi;
let authStage: AuthStage = 'email';
let email = '';
let factors: ReadonlyArray<{ readonly id: string; readonly friendlyName: string }> = [];
let operatorSession: OperatorSession | null = null;
let sessionClock: SessionClock | null = null;
let renewalInFlight = false;
let nextRenewalAttemptAtMs = 0;
let queueKind: QueueKind = 'correction';
let queueItems: readonly QueueItem[] = [];
let nextCursor: QueueCursor | null = null;
let selectedItem: QueueItem | null = null;
let detail: ItemDetail | null = null;
let claim: ItemClaim | null = null;
let busy = false;
let notice: Notice | null = null;
const sessionWorkEpoch = new SessionWorkEpoch();

function sessionWorkIsCurrent(epoch: number): boolean {
  return (
    sessionWorkEpoch.isCurrent(epoch) &&
    operatorSession !== null &&
    sessionClock !== null
  );
}

function element<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  options: { readonly className?: string; readonly text?: string } = {},
): HTMLElementTagNameMap[K] {
  const result = document.createElement(tag);
  if (options.className) result.className = options.className;
  if (options.text !== undefined) result.textContent = options.text;
  return result;
}

function setNotice(message: string, tone: NoticeTone = 'info'): void {
  notice = { message, tone };
}

function noticeNode(current: Notice | null): HTMLElement {
  const output = element('div', {
    className: `notice${current && current.tone !== 'info' ? ` ${current.tone}` : ''}`,
    text: current?.message ?? '',
  });
  output.id = 'operator-status';
  output.setAttribute('role', current?.tone === 'error' ? 'alert' : 'status');
  output.setAttribute('aria-live', current?.tone === 'error' ? 'assertive' : 'polite');
  output.hidden = current === null;
  return output;
}

function field(labelText: string, control: HTMLElement, helpText?: string): HTMLDivElement {
  const wrapper = element('div', { className: 'field' });
  const id = control.id || `field-${crypto.randomUUID()}`;
  control.id = id;
  const label = element('label', { text: labelText });
  label.htmlFor = id;
  wrapper.append(label, control);
  if (helpText) {
    const help = element('small', { text: helpText });
    help.id = `${id}-help`;
    control.setAttribute('aria-describedby', help.id);
    wrapper.append(help);
  }
  return wrapper;
}

function submitButton(text: string): HTMLButtonElement {
  const button = element('button', { text });
  button.type = 'submit';
  button.disabled = busy;
  return button;
}

function formatTimestamp(value: string): string {
  const timestamp = new Date(value);
  return Number.isFinite(timestamp.getTime()) ? timestamp.toLocaleString() : 'Unavailable';
}

function humanize(value: string): string {
  return value.replaceAll('_', ' ');
}

function formatPresentationValue(value: PresentationValue): string {
  if (value === null) return 'Not set';
  if (typeof value === 'boolean') return value ? 'Yes' : 'No';
  if (typeof value === 'object') return JSON.stringify(value);
  return String(value);
}

function errorNotice(error: unknown): Notice {
  if (error instanceof OperatorApiError) {
    const suffix = error.requestId ? ` Request ${error.requestId}.` : '';
    return { message: `${error.message}${suffix}`, tone: 'error' };
  }
  if (error instanceof Error && error.message.length > 0 && error.message.length <= 180) {
    return { message: error.message, tone: 'error' };
  }
  return { message: 'The operation could not be completed.', tone: 'error' };
}

function renderConfigurationFailure(error: unknown): void {
  const card = element('section', { className: 'auth-card' });
  const heading = element('h1', { text: 'Catalog operations unavailable' });
  const message = error instanceof Error ? error.message : 'The deployment configuration is invalid.';
  card.append(
    heading,
    element('p', {
      className: 'lede',
      text: 'This console failed closed before authentication or catalog access.',
    }),
    noticeNode({ message, tone: 'error' }),
  );
  root.replaceChildren(card);
}

function renderAuth(): void {
  const page = element('div', { className: 'page' });
  const card = element('section', { className: 'auth-card' });
  card.setAttribute('aria-labelledby', 'auth-title');
  const heading = element('h1', { text: 'Catalog operations' });
  heading.id = 'auth-title';
  card.append(
    heading,
    element('p', {
      className: 'lede',
      text: 'Restricted internal review. Sensitive detail reads and decisions are authorized and audited.',
    }),
    noticeNode(notice),
  );

  if (authStage === 'email') card.append(emailForm());
  if (authStage === 'email_code') card.append(emailCodeForm());
  if (authStage === 'totp') card.append(totpForm());

  card.append(
    element('p', {
      className: 'muted',
      text: `Environment: ${environment.environment}. Sessions are in memory only.`,
    }),
  );
  page.append(card);
  root.replaceChildren(page);
}

function emailForm(): HTMLFormElement {
  const form = element('form');
  form.noValidate = true;
  const input = element('input');
  input.name = 'email';
  input.type = 'email';
  input.autocomplete = 'username';
  input.inputMode = 'email';
  input.maxLength = 254;
  input.required = true;
  input.value = email;
  form.append(
    field('Operator email', input, 'Existing authorized accounts only; account creation is disabled.'),
    submitButton('Send one-time code'),
  );
  form.addEventListener('submit', (event) => {
    event.preventDefault();
    void requestEmailCode(input.value);
  });
  queueMicrotask(() => input.focus());
  return form;
}

function emailCodeForm(): HTMLFormElement {
  const form = element('form');
  form.noValidate = true;
  const input = element('input');
  input.name = 'email-code';
  input.type = 'text';
  input.autocomplete = 'one-time-code';
  input.inputMode = 'numeric';
  input.pattern = '[0-9]{6}';
  input.maxLength = 6;
  input.required = true;
  const actions = element('div', { className: 'actions' });
  const back = element('button', { className: 'secondary', text: 'Use another email' });
  back.type = 'button';
  back.disabled = busy;
  back.addEventListener('click', () => {
    authStage = 'email';
    notice = null;
    renderAuth();
  });
  actions.append(submitButton('Verify email code'), back);
  form.append(
    element('p', { text: `A sign-in code was requested for ${email}.` }),
    field('Six-digit email code', input),
    actions,
  );
  form.addEventListener('submit', (event) => {
    event.preventDefault();
    void verifyEmailCode(input.value);
  });
  queueMicrotask(() => input.focus());
  return form;
}

function totpForm(): HTMLFormElement {
  const form = element('form');
  form.noValidate = true;
  const factor = element('select');
  factor.name = 'factor';
  for (const candidate of factors) {
    const option = element('option', { text: candidate.friendlyName });
    option.value = candidate.id;
    factor.append(option);
  }
  const input = element('input');
  input.name = 'totp-code';
  input.type = 'text';
  input.autocomplete = 'one-time-code';
  input.inputMode = 'numeric';
  input.pattern = '[0-9]{6}';
  input.maxLength = 6;
  input.required = true;
  form.append(
    element('h2', { text: 'Verify authenticator' }),
    field('Verified TOTP factor', factor),
    field('Six-digit authenticator code', input),
    submitButton('Verify and open console'),
  );
  form.addEventListener('submit', (event) => {
    event.preventDefault();
    void verifyTotp(factor.value, input.value);
  });
  queueMicrotask(() => input.focus());
  return form;
}

async function requestEmailCode(rawEmail: string): Promise<void> {
  if (busy) return;
  busy = true;
  setNotice('Requesting a one-time code…');
  renderAuth();
  try {
    email = await auth.requestEmailOtp(rawEmail);
    authStage = 'email_code';
    setNotice('Enter the code sent to the authorized operator address.');
  } catch (error) {
    notice = errorNotice(error);
  } finally {
    busy = false;
    renderAuth();
  }
}

async function verifyEmailCode(code: string): Promise<void> {
  if (busy) return;
  busy = true;
  setNotice('Verifying the email code…');
  renderAuth();
  try {
    await auth.verifyEmailOtp(email, code);
    await continueAfterPrimaryAuth();
  } catch (error) {
    notice = errorNotice(error);
  } finally {
    busy = false;
    if (!operatorSession) renderAuth();
  }
}

async function continueAfterPrimaryAuth(): Promise<void> {
  const mfa = await auth.mfaState();
  if (mfa.currentLevel === 'aal2') {
    await establishOperatorSession();
    return;
  }
  if (mfa.nextLevel !== 'aal2' || mfa.verifiedTotpFactors.length === 0) {
    await auth.signOut();
    authStage = 'email';
    email = '';
    throw new Error('A pre-enrolled, verified authenticator factor is required.');
  }
  factors = mfa.verifiedTotpFactors;
  authStage = 'totp';
  setNotice('Email verified. Complete the required authenticator challenge.');
}

async function verifyTotp(factorId: string, code: string): Promise<void> {
  if (busy) return;
  busy = true;
  setNotice('Verifying the authenticator code…');
  renderAuth();
  try {
    await auth.verifyTotp(factorId, code);
    const mfa = await auth.mfaState();
    if (mfa.currentLevel !== 'aal2') throw new Error('The required MFA level was not established.');
    await establishOperatorSession();
  } catch (error) {
    notice = errorNotice(error);
  } finally {
    busy = false;
    if (!operatorSession) renderAuth();
  }
}

async function establishOperatorSession(): Promise<void> {
  const established = await api.call({ action: 'session' });
  if (new Date(established.expiresAt).getTime() <= Date.now()) {
    throw new Error('The database returned an expired operator session.');
  }
  sessionWorkEpoch.begin();
  operatorSession = established;
  nextRenewalAttemptAtMs = 0;
  const now = Date.now();
  sessionClock = { startedAtMs: now, lastActivityAtMs: now };
  factors = [];
  notice = { message: 'Operator authority verified.', tone: 'info' };
  chooseReadableQueue();
  // Authentication callers hold the global busy flag. Release it before the
  // first bounded queue request so successful sign-in cannot strand a disabled
  // workspace with no data request.
  busy = false;
  renderWorkspace();
  await loadQueue(true);
}

function chooseReadableQueue(): void {
  if (!operatorSession) return;
  const capabilities = new Set(operatorSession.capabilities);
  if (canReadQueue(queueKind, capabilities)) return;
  if (canReadQueue('correction', capabilities)) queueKind = 'correction';
  else if (canReadQueue('source_import', capabilities)) queueKind = 'source_import';
}

function renderWorkspace(): void {
  if (!operatorSession || !sessionClock) {
    renderAuth();
    return;
  }
  const shell = element('div', { className: 'shell' });
  shell.append(workspaceTopbar());
  const page = element('main', { className: 'page' });
  page.id = 'operator-workspace';
  page.append(noticeNode(notice));
  const workspace = element('div', { className: 'workspace' });
  workspace.append(queuePanel(), detailPanel());
  page.append(workspace);
  shell.append(page);
  root.replaceChildren(shell);
}

function workspaceTopbar(): HTMLElement {
  if (!operatorSession) throw new Error('Operator session missing.');
  const bar = element('header', { className: 'topbar' });
  const brand = element('div', { className: 'brand' });
  brand.append(
    element('strong', { text: 'Layerwell catalog operations' }),
    element('span', { className: 'environment', text: operatorSession.environment }),
  );
  const actions = element('div', { className: 'actions' });
  const authority = element('div', { className: 'authority-receipt' });
  authority.append(
    element('strong', {
      text: `${operatorSession.operatorEmail} · ${operatorSession.operatorUserId}`,
    }),
    element('span', {
      text:
        `Authority ${operatorSession.admissionState} · generation ${operatorSession.controlGeneration} · expires ${formatTimestamp(operatorSession.expiresAt)}`,
    }),
    element('span', {
      text:
        `Deployment ${operatorSession.edgeDeploymentId} · source ${operatorSession.sourceRevision}`,
    }),
    element('span', {
      text: `Capabilities: ${operatorSession.capabilities.join(', ')}`,
    }),
  );
  const signOutButton = element('button', { className: 'secondary', text: 'Sign out' });
  signOutButton.type = 'button';
  signOutButton.disabled = busy;
  signOutButton.addEventListener('click', () => void endSession('Signed out.'));
  actions.append(authority, signOutButton);
  bar.append(brand, actions);
  return bar;
}

function queuePanel(): HTMLElement {
  const panel = element('section', { className: 'panel' });
  panel.setAttribute('aria-labelledby', 'queue-heading');
  const header = element('div', { className: 'panel-header' });
  const heading = element('h2', { text: 'Review queue' });
  heading.id = 'queue-heading';
  header.append(heading);
  const body = element('div', { className: 'panel-body' });
  if (!operatorSession) return panel;
  const capabilities = new Set(operatorSession.capabilities);
  const controls = element('div', { className: 'queue-controls' });
  const select = element('select');
  select.id = 'queue-kind';
  select.disabled = busy;
  const queueOptions: ReadonlyArray<readonly [QueueKind, string]> = [
    ['correction', 'Corrections and holds'],
    ['source_import', 'Sources and imports'],
  ];
  for (const [kind, label] of queueOptions) {
    if (!canReadQueue(kind, capabilities)) continue;
    const option = element('option', { text: label });
    option.value = kind;
    option.selected = queueKind === kind;
    select.append(option);
  }
  select.addEventListener('change', () => {
    queueKind = select.value as QueueKind;
    void loadQueue(true);
  });
  const refresh = element('button', { className: 'secondary', text: 'Refresh' });
  refresh.type = 'button';
  refresh.disabled = busy || select.options.length === 0;
  refresh.addEventListener('click', () => void loadQueue(true));
  controls.append(field('Queue', select), refresh);
  body.append(controls);

  if (select.options.length === 0) {
    body.append(
      element('p', {
        className: 'muted',
        text: 'The current grant has no queue-read capability.',
      }),
    );
  } else if (queueItems.length === 0) {
    body.append(
      element('p', {
        className: 'muted',
        text: busy ? 'Loading the bounded queue…' : 'No items are currently available.',
      }),
    );
  } else {
    const list = element('ul', { className: 'queue-list' });
    for (const item of queueItems) {
      const listItem = element('li');
      listItem.append(queueItemButton(item));
      list.append(listItem);
    }
    body.append(list);
    if (nextCursor) {
      const loadMore = element('button', { className: 'secondary', text: 'Load more' });
      loadMore.type = 'button';
      loadMore.disabled = busy;
      loadMore.addEventListener('click', () => void loadQueue(false));
      body.append(loadMore);
    }
  }
  panel.append(header, body);
  return panel;
}

function queueItemButton(item: QueueItem): HTMLButtonElement {
  const button = element('button', { className: 'queue-item' });
  button.type = 'button';
  button.disabled = busy;
  button.setAttribute(
    'aria-current',
    String(selectedItem?.itemKind === item.itemKind && selectedItem.itemId === item.itemId),
  );
  const title =
    item.summary.productName ??
    item.summary.displayName ??
    item.summary.sourceName ??
    item.summary.sourceKey ??
    item.summary.correctionType ??
    humanize(item.itemKind);
  button.append(
    element('strong', { text: String(title) }),
    element('small', { text: `${humanize(item.status)} · priority ${item.priority}` }),
  );
  const metadata = element('ul', { className: 'queue-meta' });
  for (const value of [humanize(item.itemKind), `v${item.itemVersion}`, formatTimestamp(item.createdAt)]) {
    const entry = element('li', { className: 'pill', text: value });
    metadata.append(entry);
  }
  button.append(metadata);
  button.addEventListener('click', () => void selectQueueItem(item));
  return button;
}

function detailPanel(): HTMLElement {
  const panel = element('section', { className: 'panel' });
  panel.setAttribute('aria-labelledby', 'detail-heading');
  const header = element('div', { className: 'panel-header' });
  const heading = element('h2', { text: 'Review detail' });
  heading.id = 'detail-heading';
  header.append(heading);
  const body = element('div', { className: 'panel-body' });
  const liveClaim =
    claim &&
    selectedItem &&
    claim.itemKind === selectedItem.itemKind &&
    claim.itemId === selectedItem.itemId &&
    leaseIsCurrent(claim.leaseExpiresAt, Date.now())
      ? claim
      : null;
  if (!liveClaim) {
    claim = null;
    detail = null;
  }

  if (!selectedItem) {
    body.append(
      element('p', {
        className: 'muted',
        text: 'Select a queue item to review its minimized summary. A live claim is required before detail is read.',
      }),
    );
    panel.append(header, body);
    return panel;
  }

  if (!detail) {
    const summary = element('dl', { className: 'definition-list' });
    appendDefinition(summary, 'Item kind', humanize(selectedItem.itemKind));
    appendDefinition(summary, 'Status', humanize(selectedItem.status));
    appendDefinition(summary, 'Version', String(selectedItem.itemVersion));
    appendDefinition(summary, 'Item ID', selectedItem.itemId, true);
    for (const [key, value] of Object.entries(selectedItem.summary).sort(([left], [right]) =>
      left.localeCompare(right),
    )) {
      appendDefinition(
        summary,
        humanize(key),
        formatPresentationValue(value),
        key.endsWith('Id') || key.endsWith('Sha256'),
      );
    }
    body.append(
      summary,
      element('p', {
        className: 'notice warning',
        text: 'Only this minimized queue summary is visible. Claim the current version before loading review detail.',
      }),
      claimSurface(selectedItem),
    );
    panel.append(header, body);
    return panel;
  }
  if (!liveClaim) throw new Error('Claim-bound detail invariant failed.');

  const summary = element('dl', { className: 'definition-list' });
  appendDefinition(summary, 'Item kind', humanize(detail.itemKind));
  appendDefinition(summary, 'Status', humanize(detail.status));
  appendDefinition(summary, 'Version', String(detail.itemVersion));
  appendDefinition(summary, 'Item ID', detail.itemId, true);
  for (const [key, value] of Object.entries(detail.detail).sort(([left], [right]) =>
    left.localeCompare(right),
  )) {
    appendDefinition(
      summary,
      humanize(key),
      formatPresentationValue(value),
      key.endsWith('Id') || key.endsWith('Sha256'),
    );
  }
  body.append(
    summary,
    element('p', {
      className: 'notice',
      text: `Claim valid until ${formatTimestamp(liveClaim.leaseExpiresAt)}. Decisions use optimistic version ${liveClaim.itemVersion}.`,
    }),
    actionSurface(),
  );
  panel.append(header, body);
  return panel;
}

function appendDefinition(
  list: HTMLDListElement,
  label: string,
  value: string,
  monospace = false,
): void {
  list.append(
    element('dt', { text: label }),
    element('dd', { className: monospace ? 'mono' : undefined, text: value }),
  );
}

function claimSurface(item: QueueItem): HTMLElement {
  const wrapper = element('div');
  if (!operatorSession) return wrapper;
  const allowed = canClaim(item.itemKind, new Set(operatorSession.capabilities));
  const currentClaim =
    claim &&
    claim.itemKind === item.itemKind &&
    claim.itemId === item.itemId &&
    leaseIsCurrent(claim.leaseExpiresAt, Date.now())
      ? claim
      : null;
  const button = element('button', {
    text: currentClaim ? 'Open claimed detail' : 'Claim and open for five minutes',
  });
  button.type = 'button';
  button.disabled = busy || !allowed;
  button.addEventListener('click', () =>
    void (currentClaim ? loadClaimedDetail() : claimSelected()),
  );
  wrapper.append(button);
  if (currentClaim) {
    wrapper.append(
      element('p', {
        className: 'muted',
        text: `Claim valid until ${formatTimestamp(currentClaim.leaseExpiresAt)}.`,
      }),
    );
  }
  if (!allowed) {
    wrapper.append(
      element('p', { className: 'muted', text: 'The current grant cannot claim this item.' }),
    );
  }
  return wrapper;
}

function actionSurface(): HTMLElement {
  const wrapper = element('div');
  if (!operatorSession || !detail || !claim) return wrapper;
  const capabilities = new Set(operatorSession.capabilities);
  const transitionOptions = transitionOptionsFor(detail, capabilities);
  const receiptId = releaseReceiptId(detail, capabilities);
  if (transitionOptions.length > 0) wrapper.append(transitionForm(transitionOptions));
  if (receiptId) wrapper.append(releaseForm(receiptId));
  if (transitionOptions.length === 0 && !receiptId) {
    wrapper.append(
      element('p', {
        className: 'muted',
        text: 'No transition is valid for this status and capability set.',
      }),
    );
  }
  return wrapper;
}

function transitionForm(options: readonly TransitionOption[]): HTMLFormElement {
  const form = element('form');
  const heading = element('h3', { text: 'Record decision' });
  const select = element('select');
  select.name = 'decision';
  for (const [index, candidate] of options.entries()) {
    const option = element('option', { text: candidate.label });
    option.value = String(index);
    select.append(option);
  }
  form.append(heading, field('Allowed decision', select));
  let evidence: HTMLInputElement | null = null;
  if (detail?.itemKind === 'product_hold') {
    evidence = element('input');
    evidence.name = 'evidence-sha256';
    evidence.type = 'text';
    evidence.autocomplete = 'off';
    evidence.spellcheck = false;
    evidence.pattern = '[a-f0-9]{64}';
    evidence.minLength = 64;
    evidence.maxLength = 64;
    evidence.required = true;
    form.append(
      field(
        'Exact repair evidence SHA-256',
        evidence,
        'Digest only. Raw evidence and free-form notes are never accepted here.',
      ),
    );
  }
  const warning = element('p', {
    className: 'notice warning',
    text: 'This creates an immutable audit event. Re-open the item if its version or claim has changed.',
  });
  form.append(warning, submitButton('Record audited decision'));
  form.addEventListener('submit', (event) => {
    event.preventDefault();
    const option = options[Number(select.value)];
    if (option) void submitTransition(option, evidence?.value);
  });
  return form;
}

function releaseForm(repairReceiptId: string): HTMLFormElement {
  const form = element('form');
  form.append(
    element('h3', { text: 'Release serving hold' }),
    element('p', {
      className: 'notice warning',
      text: 'Release requires current CAT02 plus staged CAT03 successor proof and a fourth operator distinct from triage, disposition, and repair attestation. It advances the root but does not reactivate the product.',
    }),
    field(
      'Current repair receipt',
      Object.assign(element('input'), {
        value: repairReceiptId,
        readOnly: true,
      }),
    ),
    submitButton('Release verified hold'),
  );
  form.addEventListener('submit', (event) => {
    event.preventDefault();
    void submitRelease(repairReceiptId);
  });
  return form;
}

async function loadQueue(reset: boolean): Promise<void> {
  if (!operatorSession || busy) return;
  const epoch = sessionWorkEpoch.capture();
  const capabilities = new Set(operatorSession.capabilities);
  if (!canReadQueue(queueKind, capabilities)) {
    setNotice('The current grant cannot read that queue.', 'error');
    renderWorkspace();
    return;
  }
  busy = true;
  setNotice(reset ? 'Refreshing the queue…' : 'Loading the next bounded page…');
  if (reset) {
    queueItems = [];
    nextCursor = null;
    selectedItem = null;
    detail = null;
    claim = null;
  }
  renderWorkspace();
  try {
    const page = await api.call({
      action: 'queue',
      queueKind,
      ...(reset || !nextCursor ? {} : { cursor: nextCursor }),
      limit: 25,
    });
    if (!sessionWorkIsCurrent(epoch)) return;
    const combined = reset ? page.items : [...queueItems, ...page.items];
    const byId = new Map(combined.map((item) => [`${item.itemKind}:${item.itemId}`, item]));
    queueItems = [...byId.values()];
    nextCursor = page.items.length === 25 ? page.nextCursor : null;
    setNotice(
      queueItems.length === 0
        ? 'The selected queue is empty.'
        : `${queueItems.length} bounded queue item${queueItems.length === 1 ? '' : 's'} loaded.`,
    );
  } catch (error) {
    if (!sessionWorkIsCurrent(epoch)) return;
    await handleApiError(error, epoch);
  } finally {
    if (sessionWorkIsCurrent(epoch)) {
      busy = false;
      renderWorkspace();
    }
  }
}

async function selectQueueItem(item: QueueItem): Promise<void> {
  if (!operatorSession || busy) return;
  selectedItem = item;
  detail = null;
  claim = null;
  setNotice('Minimized queue item selected. Claim its current version to load review detail.');
  renderWorkspace();
}

async function claimSelected(): Promise<void> {
  if (!operatorSession || !selectedItem || busy) return;
  const epoch = sessionWorkEpoch.capture();
  const item = selectedItem;
  busy = true;
  setNotice('Creating a short, version-bound claim before reading detail…');
  renderWorkspace();
  try {
    const acquiredClaim = await api.call({
      action: 'claim',
      itemKind: item.itemKind,
      itemId: item.itemId,
      expectedVersion: item.itemVersion,
      operationId: crypto.randomUUID(),
    });
    if (!sessionWorkIsCurrent(epoch)) return;
    const acquiredDetail = await api.call({
      action: 'detail',
      itemKind: item.itemKind,
      itemId: item.itemId,
      leaseId: acquiredClaim.leaseId,
      expectedVersion: acquiredClaim.itemVersion,
    });
    if (!sessionWorkIsCurrent(epoch)) return;
    claim = acquiredClaim;
    detail = acquiredDetail;
    setNotice(
      `Claimed detail loaded. Claim expires ${formatTimestamp(acquiredClaim.leaseExpiresAt)}.`,
    );
  } catch (error) {
    if (!sessionWorkIsCurrent(epoch)) return;
    detail = null;
    if (error instanceof OperatorApiError && error.code === 'conflict') claim = null;
    await handleApiError(error, epoch);
  } finally {
    if (sessionWorkIsCurrent(epoch)) {
      busy = false;
      renderWorkspace();
    }
  }
}

async function loadClaimedDetail(): Promise<void> {
  if (!operatorSession || !selectedItem || !claim || busy) return;
  const epoch = sessionWorkEpoch.capture();
  if (
    claim.itemKind !== selectedItem.itemKind ||
    claim.itemId !== selectedItem.itemId ||
    !leaseIsCurrent(claim.leaseExpiresAt, Date.now())
  ) {
    claim = null;
    detail = null;
    setNotice('The claim expired. Claim the current item version again.', 'warning');
    renderWorkspace();
    return;
  }
  const item = selectedItem;
  const currentClaim = claim;
  busy = true;
  setNotice('Loading the claim-bound sanitized detail…');
  renderWorkspace();
  try {
    const acquiredDetail = await api.call({
      action: 'detail',
      itemKind: item.itemKind,
      itemId: item.itemId,
      leaseId: currentClaim.leaseId,
      expectedVersion: currentClaim.itemVersion,
    });
    if (!sessionWorkIsCurrent(epoch)) return;
    detail = acquiredDetail;
    setNotice(`Claimed detail loaded. Claim expires ${formatTimestamp(currentClaim.leaseExpiresAt)}.`);
  } catch (error) {
    if (!sessionWorkIsCurrent(epoch)) return;
    detail = null;
    if (error instanceof OperatorApiError && error.code === 'conflict') claim = null;
    await handleApiError(error, epoch);
  } finally {
    if (sessionWorkIsCurrent(epoch)) {
      busy = false;
      renderWorkspace();
    }
  }
}

async function submitTransition(option: TransitionOption, evidenceSha256?: string): Promise<void> {
  if (!operatorSession || !detail || !claim || busy) return;
  const epoch = sessionWorkEpoch.capture();
  const currentDetail = detail;
  const currentClaim = claim;
  if (!leaseIsCurrent(currentClaim.leaseExpiresAt, Date.now())) {
    claim = null;
    setNotice('The claim expired. Claim the current item version again.', 'warning');
    renderWorkspace();
    return;
  }
  busy = true;
  setNotice('Recording the version-bound decision…');
  renderWorkspace();
  try {
    const common = {
      action: 'transition' as const,
      itemId: currentDetail.itemId,
      leaseId: currentClaim.leaseId,
      expectedVersion: currentClaim.itemVersion,
      operationId: crypto.randomUUID(),
      decision: option.decision,
      reasonCode: option.reasonCode,
    };
    const result =
      currentDetail.itemKind === 'product_hold'
        ? await api.call({
            ...common,
            itemKind: 'product_hold',
            decision: 'attest_repair',
            reasonCode: 'cat02_cat03_repair_verified',
            evidenceSha256: evidenceSha256?.trim().toLowerCase() ?? '',
          })
        : await api.call({ ...common, itemKind: currentDetail.itemKind });
    if (!sessionWorkIsCurrent(epoch)) return;
    setNotice(`Decision recorded as ${humanize(result.status)}. Event ${result.eventId}.`);
    selectedItem = null;
    detail = null;
    claim = null;
    await refreshQueueAfterMutation(epoch);
  } catch (error) {
    if (!sessionWorkIsCurrent(epoch)) return;
    await handleApiError(error, epoch);
    if (error instanceof OperatorApiError && error.code === 'conflict') claim = null;
  } finally {
    if (sessionWorkIsCurrent(epoch)) {
      busy = false;
      renderWorkspace();
    }
  }
}

async function submitRelease(repairReceiptId: string): Promise<void> {
  if (!operatorSession || !detail || !claim || busy || detail.itemKind !== 'product_hold') return;
  const epoch = sessionWorkEpoch.capture();
  const currentDetail = detail;
  const currentClaim = claim;
  if (!leaseIsCurrent(currentClaim.leaseExpiresAt, Date.now())) {
    claim = null;
    setNotice('The release claim expired. Reload and claim the current hold version.', 'warning');
    renderWorkspace();
    return;
  }
  busy = true;
  setNotice('Verifying and releasing the independent serving hold…');
  renderWorkspace();
  try {
    const result = await api.call({
      action: 'release_hold',
      holdId: currentDetail.itemId,
      leaseId: currentClaim.leaseId,
      expectedVersion: currentClaim.itemVersion,
      operationId: crypto.randomUUID(),
      repairReceiptId,
      reasonCode: 'repair_verified_current',
    });
    if (!sessionWorkIsCurrent(epoch)) return;
    setNotice(`Hold released at ${formatTimestamp(result.releasedAt)}. Event ${result.eventId}.`);
    selectedItem = null;
    detail = null;
    claim = null;
    await refreshQueueAfterMutation(epoch);
  } catch (error) {
    if (!sessionWorkIsCurrent(epoch)) return;
    await handleApiError(error, epoch);
    if (error instanceof OperatorApiError && error.code === 'conflict') claim = null;
  } finally {
    if (sessionWorkIsCurrent(epoch)) {
      busy = false;
      renderWorkspace();
    }
  }
}

async function refreshQueueAfterMutation(epoch: number): Promise<void> {
  const page = await api.call({ action: 'queue', queueKind, limit: 25 });
  if (!sessionWorkIsCurrent(epoch)) return;
  queueItems = page.items;
  nextCursor = page.items.length === 25 ? page.nextCursor : null;
}

async function handleApiError(error: unknown, epoch: number): Promise<void> {
  if (!sessionWorkIsCurrent(epoch)) return;
  notice = errorNotice(error);
  if (error instanceof OperatorApiError && error.code === 'unauthorized') {
    await endSession(error.message);
  }
}

async function renewDatabaseAuthorityIfNeeded(): Promise<void> {
  if (!operatorSession || !sessionClock || renewalInFlight) return;
  const epoch = sessionWorkEpoch.capture();
  const now = Date.now();
  if (sessionExpiryReason(sessionClock, now)) return;
  const serverRemaining = new Date(operatorSession.expiresAt).getTime() - now;
  if (!Number.isFinite(serverRemaining) || serverRemaining > 2 * 60 * 1000) return;
  if (now < nextRenewalAttemptAtMs) return;
  renewalInFlight = true;
  nextRenewalAttemptAtMs = now + 30_000;
  try {
    const renewed = await api.call({ action: 'session' });
    if (!sessionWorkIsCurrent(epoch)) return;
    if (new Date(renewed.expiresAt).getTime() <= now) throw new Error('Expired renewal');
    operatorSession = renewed;
    chooseReadableQueue();
    setNotice('Operator authority was re-verified against the live grant and MFA session.');
    renderWorkspace();
  } catch (error) {
    if (!sessionWorkIsCurrent(epoch)) return;
    await endSession(
      error instanceof OperatorApiError
        ? error.message
        : 'Operator authority could not be renewed. Sign in again.',
    );
  } finally {
    if (sessionWorkEpoch.isCurrent(epoch)) renewalInFlight = false;
  }
}

async function endSession(message: string): Promise<void> {
  const logoutEpoch = sessionWorkEpoch.invalidate();
  operatorSession = null;
  sessionClock = null;
  renewalInFlight = false;
  nextRenewalAttemptAtMs = 0;
  queueItems = [];
  nextCursor = null;
  selectedItem = null;
  detail = null;
  claim = null;
  factors = [];
  email = '';
  authStage = 'email';
  busy = true;
  notice = { message, tone: 'warning' };
  // Remove every sensitive node before any network-dependent logout work.
  // A slow or unavailable Auth endpoint must never leave claimed detail on
  // screen after manual, idle, absolute, or unauthorized-session sign-out.
  renderAuth();
  try {
    await auth.signOut();
  } catch {
    // Local state is already cleared. A future login must establish a fresh
    // in-memory Auth and database operator session.
  } finally {
    if (sessionWorkEpoch.isCurrent(logoutEpoch)) {
      busy = false;
      renderAuth();
    }
  }
}

function recordTrustedActivity(event: Event): void {
  if (!event.isTrusted || !sessionClock || !operatorSession) return;
  sessionClock = recordActivity(sessionClock, Date.now());
}

for (const eventName of ['keydown', 'pointerdown'] as const) {
  window.addEventListener(eventName, recordTrustedActivity, { capture: true, passive: true });
}

globalThis.setInterval(() => {
  if (!sessionClock || !operatorSession) return;
  const now = Date.now();
  const reason = sessionExpiryReason(sessionClock, now);
  if (reason) {
    void endSession(
      reason === 'idle'
        ? 'Signed out after 15 minutes of inactivity.'
        : 'Signed out at the one-hour absolute session limit.',
    );
    return;
  }
  if (claim && !leaseIsCurrent(claim.leaseExpiresAt, now)) {
    claim = null;
    detail = null;
    setNotice('The five-minute claim expired. Sensitive detail was cleared.', 'warning');
    renderWorkspace();
  }
  if (millisecondsUntilExpiry(sessionClock, now) > 0) {
    void renewDatabaseAuthorityIfNeeded();
  }
}, 1_000);

try {
  environment = readEnvironment();
  auth = new OperatorAuth(environment);
  api = new OperatorApi(environment, () => auth.accessToken());
  renderAuth();
} catch (error) {
  renderConfigurationFailure(error);
}
