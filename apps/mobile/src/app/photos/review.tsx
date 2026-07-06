import { Redirect } from 'expo-router';

// Legacy photo route alias. Photo progress routes live under /progress.
export default function PhotosReviewAlias() {
  return <Redirect href="/progress/review" />;
}
