import { spawn } from 'node:child_process';
import { setTimeout as delay } from 'node:timers/promises';

async function waitForProcessGroupExit(pid, timeoutMs) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      process.kill(-pid, 0);
    } catch (error) {
      if (error?.code === 'ESRCH') return true;
      if (error?.code !== 'EPERM') throw error;
    }
    await delay(50);
  }
  return false;
}

export async function terminateProcessTree(
  child,
  { windowsJobContained = false, timeoutMs = 10_000 } = {},
) {
  if (!child?.pid) throw new Error('PROCESS_TREE_PID_UNAVAILABLE');
  if (process.platform === 'win32') {
    if (windowsJobContained && (child.exitCode !== null || child.signalCode !== null)) {
      return;
    }
    const exitCode = await new Promise((resolveTermination, rejectTermination) => {
      const killer = spawn('taskkill.exe', ['/PID', String(child.pid), '/T', '/F'], {
        stdio: 'ignore',
        windowsHide: true,
        shell: false,
      });
      killer.once('error', rejectTermination);
      killer.once('close', resolveTermination);
    });
    if (exitCode !== 0) throw new Error('PROCESS_TREE_TERMINATION_UNCONFIRMED');
    return;
  }
  try {
    process.kill(-child.pid, 'SIGTERM');
  } catch (error) {
    if (error?.code !== 'ESRCH') throw error;
  }
  if (await waitForProcessGroupExit(child.pid, Math.floor(timeoutMs / 2))) return;
  try {
    process.kill(-child.pid, 'SIGKILL');
  } catch (error) {
    if (error?.code !== 'ESRCH') throw error;
  }
  if (!(await waitForProcessGroupExit(child.pid, Math.ceil(timeoutMs / 2)))) {
    throw new Error('PROCESS_TREE_TERMINATION_UNCONFIRMED');
  }
}
