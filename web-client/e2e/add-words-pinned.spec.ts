import { test, expect, Page } from '@playwright/test';
import {
  clearEmulatorData,
  seedTestUser,
  seedWords,
  seedWordList,
  loginViaUI,
  configureTestSettings,
  TEST_USER,
  TestWord,
} from './fixtures/seed';
import { AddWordsPage } from './pages/add-words.page';

/**
 * The search field and the list chips of Add Words stay in view while a long
 * word list scrolls under them (#477). jsdom has no layout, so only a browser
 * can show that the rows stick, where they stick, and what is on top.
 */

const LONG_LIST: TestWord[] = Array.from({ length: 110 }, (_, i) => ({
  id: 5000 + i,
  simp: `字${i}`,
  trad: `字${i}`,
  pinyin: 'zi4',
  meaning: `filler ${i}`,
}));

const HELLO: TestWord = {
  id: 4001,
  simp: '你好',
  trad: '你好',
  pinyin: 'ni3 hao3',
  meaning: 'hello',
};
const THANKS: TestWord = {
  id: 4002,
  simp: '谢谢',
  trad: '謝謝',
  pinyin: 'xie4 xie4',
  meaning: 'thank you',
  listIds: ['hsk3'],
};

const scrollToBottom = (page: Page) =>
  page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));

/** The element painted at the centre of a locator's box. */
const paintedInside = (page: Page, selector: string, testId: string) =>
  page.evaluate(
    ([sel, id]) => {
      const box = document.querySelector(sel)!.getBoundingClientRect();
      const hit = document.elementFromPoint(box.left + box.width / 2, box.top + box.height / 2);
      return !!hit?.closest(id);
    },
    [selector, testId],
  );

async function openLongList(page: Page) {
  await clearEmulatorData();
  await seedTestUser();
  await seedWordList(TEST_USER.uid, { id: 'default', name: 'General', order: 0 });
  await seedWordList(TEST_USER.uid, { id: 'hsk3', name: 'HSK 3', order: 1 });
  await seedWords(TEST_USER.uid, [HELLO, THANKS, ...LONG_LIST]);
  await configureTestSettings(page);
  await loginViaUI(page);
  const addWords = new AddWordsPage(page);
  await addWords.navigateTo();
  await expect(page.getByRole('heading', { name: 'General · 111 words' })).toBeVisible({
    timeout: 15000,
  });
  return addWords;
}

for (const { name, viewport, topBar } of [
  { name: 'a phone', viewport: { width: 390, height: 844 }, topBar: 48 },
  { name: 'a desktop with the sidebar', viewport: { width: 1280, height: 800 }, topBar: 0 },
]) {
  test.describe(`Pinned search and list chips on ${name}`, () => {
    test.use({ viewport });

    test('stay in view at the bottom of a long list', async ({ page }) => {
      const addWords = await openLongList(page);
      const chips = page.getByRole('tablist', { name: 'Lists' });
      await scrollToBottom(page);
      await expect(page.getByText('字109', { exact: true })).toBeInViewport();

      await expect(addWords.searchInput).toBeInViewport();
      await expect(chips).toBeInViewport();
      // The group sits directly below the top bar, or at the viewport top.
      const group = await page.locator('[data-pinned]').boundingBox();
      expect(Math.round(group!.y)).toBe(topBar);

      // The page tabs and the list heading scrolled away.
      await expect(page.getByRole('tablist', { name: 'Add words' })).not.toBeInViewport();
      await expect(page.getByRole('heading', { name: 'General · 111 words' })).not.toBeInViewport();

      // Nothing paints over the pinned rows, and they paint over no top bar.
      expect(
        await paintedInside(page, '[role="tablist"][aria-label="Lists"]', '[data-pinned]'),
      ).toBe(true);
      if (topBar) expect(await paintedInside(page, 'header', 'header')).toBe(true);
    });

    test('a chip and the search field work while pinned', async ({ page }) => {
      const addWords = await openLongList(page);
      await scrollToBottom(page);

      await page.getByRole('tab', { name: /^HSK 3/ }).click();
      await expect(page.getByRole('heading', { name: 'HSK 3 · 1 word' })).toBeVisible();

      await page.getByRole('tab', { name: /^General/ }).click();
      await expect(page.getByRole('heading', { name: 'General · 111 words' })).toBeVisible();
      await scrollToBottom(page);
      await addWords.searchInput.fill('hello');
      await expect(page.getByText('你好', { exact: true }).first()).toBeVisible();
      await expect(page.getByText('字1', { exact: true })).not.toBeVisible();
    });
  });
}
