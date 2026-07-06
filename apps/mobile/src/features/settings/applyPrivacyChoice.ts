type ApplySettingsPrivacyChoiceDeps = {
  save: () => Promise<void>;
  onSaved: () => void | Promise<void>;
  onFailure: () => void;
  onSettled?: () => Promise<unknown>;
};

export async function applySettingsPrivacyChoice(
  deps: ApplySettingsPrivacyChoiceDeps,
): Promise<boolean> {
  try {
    await deps.save();
  } catch {
    deps.onFailure();
    await deps.onSettled?.().catch(() => undefined);
    return false;
  }

  await deps.onSaved();
  await deps.onSettled?.().catch(() => undefined);
  return true;
}
