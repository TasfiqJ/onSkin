import { Redirect, useLocalSearchParams } from 'expo-router';

// Legacy photo route alias. Single-photo detail routes live under /progress.
export default function PhotosDetailAlias() {
  const { id } = useLocalSearchParams<{ id?: string }>();

  return (
    <Redirect
      href={{
        pathname: '/progress/[id]',
        params: { id: String(id ?? '') },
      }}
    />
  );
}
