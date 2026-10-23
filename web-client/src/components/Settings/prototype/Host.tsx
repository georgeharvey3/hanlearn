// PROTOTYPE (#407): mounts a Settings variant on /settings. ?variant=A|B|C
// picks the variant; ?state=nospeech shows a browser with no speech support.
// The variants start from the learner's real settings, but every change stays
// in memory. "Sheet" on the switcher opens the variant's session sheet.
// Throwaway.
import React, { useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';

import { RootState } from '../../../types/store';
import { AppDispatch } from '../../../types/actions';
import * as actions from '../../../store/actions/index';
import { getCurrentUser } from '../../../firebase/auth';
import PrototypeSwitcher from '../../UI/PrototypeSwitcher/PrototypeSwitcher';
import { useProtoSettings } from './shared';
import VariantA, { SheetA } from './VariantA';
import VariantB, { SheetB } from './VariantB';
import VariantC, { SheetC } from './VariantC';

export const PROTO_VARIANTS = [
  { key: '', name: 'Current' },
  { key: 'A', name: 'Grouped rows' },
  { key: 'B', name: 'Session recipe' },
  { key: 'C', name: 'Index and detail' },
];

export const PROTO_STATES = [
  { key: '', name: 'Live' },
  { key: 'nospeech', name: 'No speech' },
];

interface Props {
  variant: string;
  state: string;
}

const Variant: React.FC<Props & { sheetOpen: boolean; closeSheet: () => void }> = ({
  variant,
  state,
  sheetOpen,
  closeSheet,
}) => {
  const dispatch = useDispatch<AppDispatch>();
  const speech = useSelector((s: RootState) => s.settings.speechAvailable);
  const synth = useSelector((s: RootState) => s.settings.synthAvailable);
  const noSpeech = state === 'nospeech';
  const p = useProtoSettings({
    speechAvailable: !noSpeech && speech,
    synthAvailable: !noSpeech && synth,
    email: getCurrentUser()?.email ?? null,
    onLogout: () => dispatch(actions.logout()),
  });
  const sheet = { p, open: sheetOpen, onClose: closeSheet };
  if (variant === 'A')
    return (
      <>
        <VariantA p={p} />
        <SheetA {...sheet} />
      </>
    );
  if (variant === 'B')
    return (
      <>
        <VariantB p={p} />
        <SheetB {...sheet} />
      </>
    );
  return (
    <>
      <VariantC p={p} />
      <SheetC {...sheet} />
    </>
  );
};

/** The variant, keyed so a new variant or state starts from fresh settings. */
const Host: React.FC<Props> = (props) => {
  const [sheetOpen, setSheetOpen] = useState(false);
  return (
    <>
      <Variant
        key={`${props.variant}-${props.state}`}
        {...props}
        sheetOpen={sheetOpen}
        closeSheet={() => setSheetOpen(false)}
      />
      <PrototypeSwitcher
        variants={PROTO_VARIANTS}
        states={PROTO_STATES}
        actions={[{ name: 'Sheet', run: () => setSheetOpen(true) }]}
      />
    </>
  );
};

export default Host;
