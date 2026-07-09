import { photoPathBelongsToUser } from './storagePath.ts';

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

Deno.test('photo storage path contract accepts caller-owned app paths', () => {
  const userId = '00000000-0000-4000-8000-000000000001';

  assert(
    photoPathBelongsToUser(userId, `${userId}/progress-photo-2026-07-09.enc`),
    'expected a caller-owned one-segment object path to pass.',
  );
  assert(
    photoPathBelongsToUser(userId, `${userId}/2026/07/photo_01.enc`),
    'expected a caller-owned nested object path to pass.',
  );
});

Deno.test('photo storage path contract rejects cross-user or malformed paths', () => {
  const userId = '00000000-0000-4000-8000-000000000001';

  const rejected = [
    '',
    userId,
    `${userId}/`,
    `${userId}//photo.enc`,
    `${userId}/../other-user/photo.enc`,
    `${userId}/./photo.enc`,
    `${userId}/ photo.enc`,
    `${userId}/%2e%2e/photo.enc`,
    `${userId}/photo.enc?token=secret`,
    `${userId}/photo.enc#fragment`,
    `${userId}/photo\nname.enc`,
    `${userId}\\photo.enc`,
    `00000000-0000-4000-8000-000000000002/photo.enc`,
  ];

  for (const path of rejected) {
    assert(!photoPathBelongsToUser(userId, path), `expected path to be rejected: ${JSON.stringify(path)}`);
  }
});
