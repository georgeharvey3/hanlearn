/**
 * The files below read every string they show from `copy.ts`. This test fails
 * on a prose literal in them: text between JSX tags, or a quoted user-facing
 * attribute. Add a file to the list when its screen moves to the copy file.
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import ts from 'typescript';
import { describe, it, expect } from 'vitest';

const srcDir = path.dirname(fileURLToPath(import.meta.url));

const FILES = [
  'components/Layout/Layout.tsx',
  'components/Layout/SkipLink.tsx',
  'components/Navigation/Toolbar/Toolbar.tsx',
  'components/Navigation/TabBar/TabBar.tsx',
  'components/Navigation/TabBar/MoreSheet.tsx',
  'components/Navigation/Sidebar/Sidebar.tsx',
  'components/Navigation/StudyButton/StudyButton.tsx',
  'components/NotificationSnackbar/NotificationSnackbar.tsx',
  'components/ErrorBoundary/ErrorBoundary.tsx',
  'components/UI/PageState/PageState.tsx',
  'components/UI/Spinner/Spinner.tsx',
  'components/UI/Modal/Modal.tsx',
  'components/KeyboardShortcutsDialog/KeyboardShortcutsDialog.tsx',
  'components/Test/Test.tsx',
  'components/Test/QuestionDisplay.tsx',
  'components/Test/TestActions.tsx',
  'components/Test/AnswerInput.tsx',
  'components/Test/Study/parts.tsx',
  'components/Test/Study/StudyTop.tsx',
  'components/Test/AudioSettingsDrawer/AudioSettingsDrawer.tsx',
  'components/Test/Study/WordSheet.tsx',
  'components/Test/TestSummary/TestSummary.tsx',
  'components/Test/TestSummary/ScoreCard.tsx',
  'components/Test/TestSummary/WordTile.tsx',
  'components/Test/NothingDue/NothingDue.tsx',
  'components/Test/NothingDue/SessionLoading.tsx',
  'components/Test/SentenceRead/SentenceRead.tsx',
  'components/Test/SentenceWrite/SentenceWrite.tsx',
  'components/UI/SimilarityScore/SimilarityScore.tsx',
  'components/Test/ComponentReview/ComponentReview.tsx',
  'components/Test/ComponentReview/CharacterGlosses.tsx',
  'components/Test/ComponentReview/ComponentTree.tsx',
  'components/Test/NewWords/NewWords.tsx',
  'components/Test/NewWords/StepRail.tsx',
  'components/Test/NewWords/WordCard.tsx',
  'components/Test/NewWords/UnderstandStep.tsx',
  'components/Test/NewWords/SpeakStep.tsx',
  'components/Test/NewWords/WriteStep.tsx',
  'components/Logo/Logo.tsx',
  'components/Home/Landing/Landing.tsx',
  'components/Home/Landing/ProductHero.tsx',
  'components/Home/Landing/HeroPhone.tsx',
  'components/Home/Landing/FiveWays.tsx',
  'components/Home/Landing/Features.tsx',
  'components/Home/Landing/layout.tsx',
  'components/Home/Landing/StrokeChar.tsx',
  'containers/AddWords/AddWords.tsx',
  'components/AddWords/SearchField.tsx',
  'components/AddWords/ListChips.tsx',
  'components/AddWords/WordRow.tsx',
  'components/AddWords/SearchResults.tsx',
  'components/AddWords/ListDialogs.tsx',
  'components/AddWords/BankStates.tsx',
  'containers/Dashboard/Dashboard.tsx',
  'containers/Dashboard/widgets/parts.tsx',
  'containers/Dashboard/widgets/TodayCard.tsx',
  'containers/Dashboard/widgets/CalendarCard.tsx',
  'containers/Dashboard/widgets/ProgressCard.tsx',
  'containers/Dashboard/widgets/SkillsCard.tsx',
  'containers/Dashboard/widgets/ChengyuCard.tsx',
];

const USER_FACING_ATTRIBUTES = new Set(['aria-label', 'placeholder', 'alt', 'title']);

// The JSX text and the quoted user-facing attributes that hold a letter.
function proseLiterals(file: string): string[] {
  const source = ts.createSourceFile(
    file,
    readFileSync(path.join(srcDir, file), 'utf8'),
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TSX,
  );
  const found: string[] = [];
  const visit = (node: ts.Node) => {
    if (ts.isJsxText(node) && /[A-Za-z\u4e00-\u9fff]/.test(node.text)) {
      found.push(node.text.trim());
    }
    if (
      ts.isJsxAttribute(node) &&
      USER_FACING_ATTRIBUTES.has(node.name.getText(source)) &&
      node.initializer &&
      ts.isStringLiteral(node.initializer) &&
      /[A-Za-z\u4e00-\u9fff]/.test(node.initializer.text)
    ) {
      found.push(`${node.name.getText(source)}="${node.initializer.text}"`);
    }
    ts.forEachChild(node, visit);
  };
  visit(source);
  return found;
}

describe('copy file', () => {
  it.each(FILES)('%s has no prose literals', (file) => {
    expect(proseLiterals(file)).toEqual([]);
  });
});
