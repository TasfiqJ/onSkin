export type NativeAgeAssuranceModule = Readonly<{
  ageAssuranceContractVersion: 1;
  ageAssuranceReviewStatus: 'launch_blocked';
  ageAssuranceProvider: 'apple_declared_age_range';
  ageAssuranceMinimumAge: 16;
  ageAssuranceMinimumRuntime: 'iOS 26.2';
  ageAssuranceMinimumSdk: 'iOS 26.2';
  ageAssuranceExactBirthDateCollected: false;
  requestDeclaredAgeRangeJSON: (requestId: string) => Promise<string>;
}>;
