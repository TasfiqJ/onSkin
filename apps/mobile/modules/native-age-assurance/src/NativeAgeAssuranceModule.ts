import { requireOptionalNativeModule } from 'expo';

import type { NativeAgeAssuranceModule } from './NativeAgeAssurance.types';

export default requireOptionalNativeModule<NativeAgeAssuranceModule>('NativeAgeAssurance');
