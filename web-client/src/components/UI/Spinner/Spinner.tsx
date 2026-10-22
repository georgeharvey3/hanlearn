import React from 'react';

import { PageLoading } from '../PageState/PageState';

interface SpinnerProps {
  /** The size of the 学 in px: 96 for a page, less for a small slot. */
  size?: number;
}

const Spinner: React.FC<SpinnerProps> = ({ size }) => <PageLoading size={size} />;

export default Spinner;
