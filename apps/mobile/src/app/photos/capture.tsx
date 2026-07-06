import { Redirect } from 'expo-router';

// Legacy photo route alias. Photo progress routes live under /progress.
export default function PhotosCaptureAlias() {
  return <Redirect href="/progress/capture" />;
}
