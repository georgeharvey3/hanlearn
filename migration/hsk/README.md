# HSK 3.0 premade lists

The catalogue of premade lists comes from these files. `npm run build:dict`
reads them, resolves each word to one CC-CEDICT entry, and writes the
catalogue to `web-client/public/premade-lists/`.

## Source

`source/1.min.json` to `source/7.min.json` are the files
`wordlists/exclusive/new/*.min.json` of
[drkameleon/complete-hsk-vocabulary](https://github.com/drkameleon/complete-hsk-vocabulary)
at commit `7ac65bf1a6387d35f1ade478906172a19311c7f9`. File 7 holds bands 7 to 9.
The data is under the MIT license, in `source/LICENSE`. The build copies this
license next to the catalogue, so the deployed app ships it.

## Override table

`overrides.json` settles the words that the rules of
`migration/premadeCatalogue.js` cannot resolve:

- `choose` names one entry for a word. The key is the simplified form and the
  readings of the source, for example `"都 [du1|dou1]"`. The value is the
  traditional form and the pinyin of the entry, for example `"都 [dou1]"`.
- `exclude` lists the words to leave out. These words have no CC-CEDICT entry.

If a word resolves to no entry or to more than one, the build fails. The
failure lists each such word. To settle a word, add it to `choose` or to
`exclude`.

If the source changes the readings of a word, its key changes. The build then
fails on the old key, and a person decides again.
