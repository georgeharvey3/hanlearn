import React from 'react';

import { ComprehendIcon, ComposeIcon } from './icons';
import { routes } from './navLinks';
import { copy } from '../../copy';
import { SentenceTab } from '../../utils/sentenceSettings';

/** The links of the sentence tabs, which sit directly below Study (#489). */
export const sentenceLinks = (
  iconSize?: number,
): { tab: SentenceTab; to: string; label: string; icon: React.ReactNode }[] => [
  {
    tab: 'comprehend',
    to: routes.comprehend,
    label: copy.sentenceTabs.comprehend,
    icon: <ComprehendIcon size={iconSize} />,
  },
  {
    tab: 'compose',
    to: routes.compose,
    label: copy.sentenceTabs.compose,
    icon: <ComposeIcon size={iconSize} />,
  },
];
