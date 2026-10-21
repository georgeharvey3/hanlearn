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
  'components/Test/Test.tsx',
  'components/Test/QuestionDisplay.tsx',
  'components/Test/TestActions.tsx',
  'components/Test/AnswerInput.tsx',
  'components/Test/Study/parts.tsx',
  'components/Test/Study/StudyTop.tsx',
  'components/Test/AudioSettingsDrawer/AudioSettingsDrawer.tsx',
  'components/Test/Study/WordSheet.tsx',
  'components/Test/SentenceRead/SentenceRead.tsx',
  'components/Test/SentenceWrite/SentenceWrite.tsx',
  'components/UI/SimilarityScore/SimilarityScore.tsx',
  'components/Test/ComponentReview/ComponentReview.tsx',
  'components/Test/ComponentReview/CharacterGlosses.tsx',
  'components/Test/ComponentReview/ComponentTree.tsx',
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
