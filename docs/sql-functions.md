---
description: SQL functions for normalizing values and comparing strings in MDMbox matching models.
---

# SQL functions

Use SQL functions in [matching models](matching-models.md) to normalize extracted values and compare candidate records. `MatchingModel` uses them in `variable.expression` and feature cases; `BulkMatchingModel` uses them in `column.source` and feature cases.

MDMbox installs four matching helpers in the `public` schema and enables the PostgreSQL extensions `unaccent`, `fuzzystrmatch`, and `pg_trgm` during startup. The examples below run against the PostgreSQL database shared by MDMbox and Aidbox. Extension functions can vary with your PostgreSQL version; the comparison functions listed below are available on PostgreSQL 14 and later unless stated otherwise.

The canonical `mdm_` names below are introduced in the next release and are available in development builds. On earlier releases, use the corresponding [legacy names](#legacy-names).

## Normalization helpers

All three helpers accept `text` and return `text`. They preserve SQL `NULL` and return `''` for an empty string.

| Function | Behavior | Example input → output |
| --- | --- | --- |
| `public.mdm_unaccent(text)` | Removes accents while preserving letter case and spaces. | `' José da Silva '` → `' Jose da Silva '` |
| `public.mdm_unaccent_upper(text)` | Removes accents and converts to uppercase, preserving spaces. | `' José da Silva '` → `' JOSE DA SILVA '` |
| `public.mdm_unaccent_upper_no_spaces(text)` | Removes accents, converts to uppercase, and removes ordinary spaces (`U+0020`). | `' José da Silva '` → `'JOSEDASILVA'` |

Accent removal uses the installed [PostgreSQL unaccent dictionary](https://www.postgresql.org/docs/14/unaccent.html), including its rules for ligatures such as `Æ` → `AE`.

The extension also provides `unaccent(text)` and `unaccent(regdictionary, text)`; the latter selects a dictionary explicitly. The MDMbox helpers provide immutable normalization expressions for indexing.

```sql
SELECT
  public.mdm_unaccent(' José da Silva ') AS unaccented,
  public.mdm_unaccent_upper(' José da Silva ') AS uppercase,
  public.mdm_unaccent_upper_no_spaces(' José da Silva ') AS compact;
```

For names where only surrounding spaces should be ignored, use `btrim`:

```sql
SELECT btrim(public.mdm_unaccent_upper(' José da Silva ')) AS trimmed;
-- JOSE DA SILVA
```

The compact helper removes ordinary spaces throughout the value. Tabs and line breaks remain:

```sql
SELECT public.mdm_unaccent_upper_no_spaces(E'José\tda Silva\n')
       = E'JOSE\tDASILVA\n' AS preserves_tabs_and_newlines;
-- true
```

Use normalization consistently on both sides of a comparison. For example, extract a family name in a `MatchingModel`:

```json
{
  "name": "family",
  "expression": "btrim(public.mdm_unaccent_upper(#.resource->'name'->0->>'family'))"
}
```

For a `BulkMatchingModel` column, use the same function with its `source` expression:

```json
{
  "name": "family",
  "type": "text",
  "source": "btrim(public.mdm_unaccent_upper(resource->'name'->0->>'family'))"
}
```

## Jaro–Winkler similarity

`public.mdm_jaro_winkler(text, text)` returns `double precision` between `0` and `1`; higher values mean greater similarity. It compares the supplied characters directly, so normalize case, accents, and spaces before calling it when those differences should be ignored.

| Inputs | Result |
| --- | --- |
| Identical strings, including two empty strings | `1` |
| One empty string and one non-empty string | `0` |
| Either input is SQL `NULL` | SQL `NULL` |
| `'A'`, `'a'` | `0` |
| `'MARTHA'`, `'MARHTA'` | Approximately `0.961111` |
| `'abcdefghijkx'`, `'abcdefghijky'` | Approximately `0.995370` |

This function adds a common-prefix bonus when the Jaro score exceeds `0.7`. The bonus uses the entire matching prefix, with a scaling factor of the smaller of `0.1` and `1 / longest_input_length`. The prefix is not capped at four characters, so results can differ from other Jaro–Winkler libraries.

```sql
SELECT
  public.mdm_jaro_winkler('MARTHA', 'MARHTA') AS transposed,
  public.mdm_jaro_winkler(
    btrim(public.mdm_unaccent_upper(' José ')),
    btrim(public.mdm_unaccent_upper('jose'))
  ) AS normalized;
-- transposed: approximately 0.961111; normalized: 1
```

Similarity values feed feature cases; the selected cases assign the model's match weights. For example, a feature comparing normalized family-name variables could use:

```json
{
  "name": "family",
  "case": [
    { "expression": "l.#family IS NULL OR r.#family IS NULL", "weight": -2 },
    { "expression": "l.#family = r.#family", "weight": 10 },
    { "expression": "public.mdm_jaro_winkler(l.#family, r.#family) >= 0.9", "weight": 3 },
    { "else": -8 }
  ]
}
```

The weights and cutoff above are illustrative. [Tune them](matching-models.md#tuning) against your own records.

## PostgreSQL comparison functions

### Edit distance and phonetic codes

These functions come from [fuzzystrmatch](https://www.postgresql.org/docs/14/fuzzystrmatch.html):

| Function | Returns | Use |
| --- | --- | --- |
| `levenshtein(text, text)` | `integer` | Edit distance; `0` means identical. |
| `levenshtein_less_equal(text, text, integer)` | `integer` | Exact distance up to the third argument's cutoff; a larger result otherwise. |
| `soundex(text)` | `text` | Soundex phonetic code. |
| `difference(text, text)` | `integer` | Matching Soundex code positions, from `0` to `4`. |
| `metaphone(text, integer)` | `text` | Metaphone code, limited to the requested output length. |
| `dmetaphone(text)` | `text` | Primary Double Metaphone code. |
| `dmetaphone_alt(text)` | `text` | Alternate Double Metaphone code. |

Levenshtein also accepts insertion, deletion, and substitution costs in that order; each defaults to `1`. Its cost overload is `levenshtein(text, text, integer, integer, integer)`. The corresponding cutoff overload is `levenshtein_less_equal(text, text, integer, integer, integer, integer)`, with the cutoff last. Levenshtein and Metaphone inputs are limited to 255 characters. Soundex and Metaphone variants have limitations with multibyte text; choose comparisons suited to your names and languages.

```sql
SELECT
  levenshtein('SMITH', 'SMYTH') AS edits,
  levenshtein_less_equal('SMITH', 'SMYTH', 2) AS bounded_edits,
  soundex('Robert') = soundex('Rupert') AS same_soundex,
  difference('Robert', 'Rupert') AS soundex_positions,
  metaphone('Smith', 10) AS metaphone_code,
  dmetaphone('Smith') AS primary_code,
  dmetaphone_alt('Smith') AS alternate_code;
-- 1, 1, true, 4, SM0, SM0, XMT
```

PostgreSQL 16 and later also provide [`daitch_mokotoff(text)`](https://www.postgresql.org/docs/16/fuzzystrmatch.html#FUZZYSTRMATCH-DAITCH-MOKOTOFF), returning `text[]` of possible phonetic codes. Compare arrays with `&&` to test for a shared code.

### Trigram similarity

These functions come from [pg_trgm](https://www.postgresql.org/docs/14/pgtrgm.html):

| Function | Returns | Use |
| --- | --- | --- |
| `similarity(text, text)` | `real` | Whole-string trigram similarity, from `0` to `1`. |
| `word_similarity(text, text)` | `real` | Best similarity to a continuous part of the second argument. |
| `strict_word_similarity(text, text)` | `real` | Best similarity to whole words in the second argument. |
| `show_trgm(text)` | `text[]` | Inspect the trigrams extracted from a value. |

Higher scores mean greater similarity. `pg_trgm` normally ignores case and non-alphanumeric separators; it still distinguishes accented letters. `word_similarity` and `strict_word_similarity` depend on argument order. Use an explicit numeric cutoff in feature expressions, for example `similarity(l.#family, r.#family) >= 0.8`.

The extension also exposes the deprecated `show_limit() → real` and `set_limit(real) → real` for the `%` operator's session threshold. Use explicit comparison cutoffs in matching models; see the PostgreSQL reference for operators and their settings.

```sql
SELECT
  similarity('SMITH', 'smith') AS whole_string,
  word_similarity('SMITH', 'JOHN SMITH') AS within_string,
  strict_word_similarity('SMITH', 'JOHN SMITH') AS whole_word;
-- 1, 1, 1
```

## Missing values and indexes

The matching helpers and comparison functions above return SQL `NULL` when a required input is `NULL`. An empty string is a present value: normalize it to `NULL` with `NULLIF(expression, '')` if your model should treat it as missing. Handle missing values in a feature case before comparing strings; a SQL `NULL` comparison does not satisfy a case.

All four MDMbox helpers are declared `IMMUTABLE`, so they can be used in expression indexes. Of these helpers, `mdm_unaccent_upper` and `mdm_jaro_winkler` are also `PARALLEL SAFE`. Custom SQL functions should be declared `PARALLEL SAFE` only when their operations support parallel queries.

## Legacy names

Use canonical names in new models. Both sets of names belong to the `public` schema; PostgreSQL extension functions keep their existing names.

| Canonical name | Legacy name |
| --- | --- |
| `mdm_unaccent(text)` | `immutable_unaccent(text)` |
| `mdm_unaccent_upper(text)` | `immutable_unaccent_upper(text)` |
| `mdm_unaccent_upper_no_spaces(text)` | `immutable_remove_spaces_unaccent_upper(text)` |
| `mdm_jaro_winkler(text, text)` | `mdmbox_jarowinkler(text, text)` |

When upgrading to the version with canonical names, MDMbox keeps each legacy name that was already installed as a compatibility alias. Existing models, expression indexes, views, and Continuous matching processes keep working; you do not need to rewrite their expressions or rebuild their indexes for this rename. A clean installation of that version creates only canonical names, so a model imported from an older installation must use the canonical names.

Legacy aliases return the same results as their canonical functions. Function ownership and execution permissions are retained during the upgrade.

See [Matching models](matching-models.md) for expression syntax and [Mathematical details](mathematical-details.md) for how feature weights become match scores.
