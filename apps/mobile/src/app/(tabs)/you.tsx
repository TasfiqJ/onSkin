import { router } from 'expo-router';
import { View } from 'react-native';

import { Button, Card, Screen, Text } from '@/components/ui';
import { useAuth } from '@/lib/auth/AuthProvider';

// You — account + privacy controls. This slice shows account status + sign out;
// biometric app-lock, account deletion, data export, consent center and
// notification preferences (docs/01 §4/§5) are added in the next slice.
export default function YouScreen() {
  const { user, isAnonymous, signOut } = useAuth();
  const email = user?.email ?? null;

  return (
    <Screen edges={['top']}>
      <Text variant="title" className="mt-2">
        You
      </Text>
      <View className="mt-6 gap-4">
        <Card>
          <Text variant="label" tone="muted">
            ACCOUNT
          </Text>
          <Text variant="body" className="mt-2 font-sans-medium">
            {isAnonymous ? 'Guest (not saved)' : (email ?? 'Signed in')}
          </Text>
          {isAnonymous ? (
            <Button
              className="mt-4"
              label="Create an account"
              onPress={() => router.push('/onboarding/account')}
            />
          ) : (
            <Button className="mt-4" label="Sign out" variant="ghost" onPress={() => void signOut()} />
          )}
        </Card>
        <Card>
          <Text variant="bodySm" tone="muted">
            Privacy controls — biometric app-lock, data export, account deletion, and consent
            management — arrive in the next build slice (docs/01 §4/§5).
          </Text>
        </Card>
      </View>
    </Screen>
  );
}
