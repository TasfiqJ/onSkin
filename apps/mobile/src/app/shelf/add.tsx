import { Redirect } from 'expo-router';

// Compatibility alias for the intuitive add-product path. The canonical shelf
// intake route is /shelf/manual; keeping this static route prevents /shelf/[id]
// from treating "add" as a missing product id.
export default function ShelfAddAlias() {
  return <Redirect href="/shelf/manual" />;
}
