// PROTOTYPE (#402) R, "Red couplet": a giant 学 brushed on load, the
// five-ways demo on paper, then today's chengyu written in ink on a full
// screen of seal red, like a spring couplet, then the features. The colour is
// each section's own ground, so nothing sits faded behind the content.
// Throwaway.
import React from 'react';

import { colors } from '../../../theme';
import { FullBleed, LandingFooter, LandingGlobals } from './landingShared';
import { BrushHero, ChengyuBrush, Features, FiveWays } from './landingSections';

export const name = 'Red couplet';

const LandingRed: React.FC = () => (
  <>
    <LandingGlobals />
    <BrushHero />
    <FullBleed bg={colors.paper}>
      <FiveWays />
    </FullBleed>
    <FullBleed>
      <ChengyuBrush tone="red" />
    </FullBleed>
    <Features />
    <LandingFooter />
  </>
);

export default LandingRed;
