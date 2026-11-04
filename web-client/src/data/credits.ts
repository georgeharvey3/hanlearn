/**
 * The sources of the app's data, for the Credits screen (#469). This is
 * attribution data, not UI copy. The licences of the shipped files say the
 * same: `public/sentences/LICENSE.txt` and `public/premade-lists/LICENSE.txt`,
 * which `npm run build:dict` writes.
 */
export interface CreditSource {
  name: string;
  url: string;
  licence: { name: string; url: string };
}

export const creditSources: CreditSource[] = [
  {
    name: 'Tatoeba',
    url: 'https://tatoeba.org',
    licence: { name: 'CC BY 2.0 FR', url: 'https://creativecommons.org/licenses/by/2.0/fr/' },
  },
  {
    name: 'CC-CEDICT',
    url: 'https://cc-cedict.org/wiki/',
    licence: { name: 'CC BY-SA 4.0', url: 'https://creativecommons.org/licenses/by-sa/4.0/' },
  },
  {
    name: 'HSK 3.0 lists',
    url: 'https://github.com/drkameleon/complete-hsk-vocabulary',
    licence: { name: 'MIT', url: '/premade-lists/LICENSE.txt' },
  },
];

/** The files that credit each Tatoeba sentence, and the licence of the sentence files. */
export const sentenceFiles = {
  attribution: '/sentences/ATTRIBUTION.txt',
  licence: '/sentences/LICENSE.txt',
};
