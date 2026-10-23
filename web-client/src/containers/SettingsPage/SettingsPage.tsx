import React, { useState } from 'react';
import { useSelector } from 'react-redux';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';

import Settings from '../../components/Settings/Settings';
// PROTOTYPE (#407): three Settings variants, picked by ?variant=A|B|C. No
// param shows the current page.
import PrototypeSwitcher, {
  usePrototypeParam,
  useStickyPrototypeParam,
} from '../../components/UI/PrototypeSwitcher/PrototypeSwitcher';
import ProtoHost, { PROTO_STATES, PROTO_VARIANTS } from '../../components/Settings/prototype/Host';
import AudioSettingsDrawer from '../../components/Test/AudioSettingsDrawer/AudioSettingsDrawer';
import { RootState } from '../../types/store';

const SettingsPage: React.FC = () => {
  const protoVariant = useStickyPrototypeParam('variant');
  const protoState = usePrototypeParam('state');
  // PROTOTYPE (#407): the current session sheet, for comparison.
  const [sheetOpen, setSheetOpen] = useState(false);
  const speech = useSelector((s: RootState) => s.settings.speechAvailable);
  const synth = useSelector((s: RootState) => s.settings.synthAvailable);

  if (protoVariant) return <ProtoHost variant={protoVariant} state={protoState} />;

  return (
    <Box sx={{ maxWidth: 520, mx: 'auto', px: 2, pb: 6 }}>
      <Typography variant="h5" sx={{ mt: 4, mb: 3, fontWeight: 700, color: 'text.primary' }}>
        Settings
      </Typography>
      <Settings />
      <AudioSettingsDrawer
        open={sheetOpen}
        onClose={() => setSheetOpen(false)}
        speechAvailable={speech}
        synthAvailable={synth}
      />
      <PrototypeSwitcher
        variants={PROTO_VARIANTS}
        states={PROTO_STATES}
        actions={[{ name: 'Sheet', run: () => setSheetOpen(true) }]}
      />
    </Box>
  );
};

export default SettingsPage;
