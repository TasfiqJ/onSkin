import { requireOptionalNativeModule } from 'expo';

import type { NativeLabelOcrModule } from './NativeLabelOcr.types';

export default requireOptionalNativeModule<NativeLabelOcrModule>('NativeLabelOcr');
