import { colors } from '../../../theme';
import { DirectionResult } from '../../../types/models';

// The text of a result, the fill of its bar segment, and the wash of its
// pressed count. Amber text uses the darker shade: #ed6c02 fails on white.
export const resultInk: Record<DirectionResult, string> = {
  pass: colors.success,
  lapse: colors.warningText,
  fail: colors.primaryLight,
};
export const resultFill: Record<DirectionResult, string> = {
  pass: colors.success,
  lapse: colors.warning,
  fail: colors.primaryLight,
};
export const resultSurface: Record<DirectionResult, string> = {
  pass: colors.successSurface,
  lapse: colors.warningSurface,
  fail: colors.errorSurface,
};
