# Custom comparison examples

**Available from:** `edge`.

These are complete Model Builder definitions. Each starts with a matching problem, explains the change, and identifies checks to make after **Build model**. All selected source fields need a nonempty `comparisons` list. Select the fields listed for an example in **Prepare data**; if you select additional fields, include them in the model too.

## Prepare the fields

Use these scalar column aliases in a Patient ViewDefinition. The aliases are lower-case; FHIR element names keep their usual spelling.

| Column | FHIRPath |
| --- | --- |
| `given` | `name.first().given.join(' ')` |
| `family` | `name.first().family` |
| `birth_date` | `birthDate` |
| `postal_code` | `address.first().postalCode` |
| `identifier` | `identifier.where(system = 'https://example.org/patient-card').first().value` |

Also select `id` with `getResourceKey()`. Replace the example identifier system with the system used by your sources. Joining the ordered FHIR `given` array retains compound names such as María José; choosing only its first element would lose information needed by the dictionary.

Callbacks receive normalized scalar strings, not Patient records. Missing values provide no evidence. `false` means disagreement; `null` means the rule does not apply. Functions must be self-contained and return Boolean or null. Add a function beside `name()` to supplement it; remove `name()` to replace it. The learner estimates their combined effect, so agreement on one comparison does not by itself require a match.

## Names and nicknames

A registration system stores William while another clinic records Bill. The remaining demographic fields are available in both sources.

Add the English name dictionary alongside `name()` for given names.

**Fields:** `given`, `family`, `birth_date`, `postal_code`.

```javascript
const model = {
  type: "probabilistic",
  comparisons: {
    given: [name(), dictionary(["en"])],
    family: [name()],
    birth_date: [date()],
    postal_code: [identifier()]
  }
};
```

Rebuild the model and inspect nickname pairs alongside unrelated patients who share a surname or postal code. A dictionary relation alone does not require the records to match.

## Initials in a legacy export

A legacy export stores a single-letter given name such as J, while the registration system stores John. Both sources also contain complete given names.

Add an initial comparison. Return null when both values are complete names, so the additional rule supplies no observation for that case.

**Fields:** `given`, `family`, `birth_date`, `postal_code`.

```javascript
const model = {
  type: "probabilistic",
  comparisons: {
    given: [
      name(),
      dictionary(["en"]),
      (a, b) => {
        const left = Array.from(a), right = Array.from(b);
        if (left.length !== 1 && right.length !== 1) return null;
        return left[0] === right[0];
      }
    ],
    family: [name()],
    birth_date: [date()],
    postal_code: [identifier()]
  }
};
```

Compare J with John, J with Peter, and John with James. Confirm that complete names still use spelling and dictionary comparisons. The initial result is evidence for training, not a final matching decision.

## Exchanged day and month

Two imports use complete ISO birth dates, but an earlier migration exchanged the day and month in some records: 1980-03-07 became 1980-07-03.

The standard date profile distinguishes exact dates and day/month exchanges. This example treats both as the same agreement and skips partial or invalid ISO dates.

**Fields:** `given`, `family`, `birth_date`, `postal_code`.

```javascript
const model = {
  type: "probabilistic",
  comparisons: {
    given: [name(), dictionary(["en", "es"])],
    family: [name()],
    birth_date: [(a, b) => {
      const parse = value => {
        const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
        if (!match) return null;
        const [year, month, day] = match.slice(1).map(Number);
        const leap = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
        const days = [31, leap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
        return year >= 1 && month >= 1 && month <= 12 && day >= 1 && day <= days[month - 1]
          ? [year, month, day] : null;
      };
      const left = parse(a), right = parse(b);
      if (!left || !right) return null;
      return a === b || (left[0] === right[0] && left[1] === right[2] && left[2] === right[1]);
    }],
    postal_code: [identifier()]
  }
};
```

Inspect swapped dates against the other demographic fields. Check unchanged dates, different years, partial dates and invalid calendar dates. Do not globally rewrite all ambiguous dates in the source data.

## Registry-specific aliases

A local registry uses AM for Alexandra Maria. These registry-specific aliases are maintained by the organisation and are not part of the built-in language dictionaries.

Import a UTF-8 CSV with the header name,variant under clinic-aliases in Name dictionaries, then add its ID alongside the English dictionary.

**Fields:** `given`, `family`, `birth_date`, `postal_code`.

Import this CSV before building:

```csv
name,variant
Alexandra Maria,AM
```

```javascript
const model = {
  type: "probabilistic",
  comparisons: {
    given: [name(), dictionary(["en", "clinic-aliases"])],
    family: [name()],
    birth_date: [date()],
    postal_code: [identifier()]
  }
};
```

Rebuild and save the model after import. Check both a registered alias and an unrelated name with the same initials. Review aliases that are assigned to more than one full name.

## Exact agreement for an identifier

Two exports share numeric card identifiers. A one-digit difference must be recorded as disagreement on this field, while names can still contain spelling errors.

Replace spelling comparison for identifier with equality. Keep the existing comparisons for the other fields.

**Fields:** `given`, `family`, `birth_date`, `identifier`.

```javascript
const model = {
  type: "probabilistic",
  comparisons: {
    given: [name(), dictionary(["en", "es"])],
    family: [name()],
    birth_date: [date()],
    identifier: [(a, b) => a === b]
  }
};
```

Verify that 12345 and 12346 disagree on identifier. This is a probabilistic observation, not a mandatory veto on the final match; an absolute matching rule belongs in a deterministic model.

## Learning from Boolean comparisons only

Two structured exports contain an account identifier, birth date and postal code. The author wants to learn from exact agreement and disagreement only, without treating nearby strings as similar.

List equality functions for every selected field. No spelling comparison is added automatically.

**Fields:** `identifier`, `birth_date`, `postal_code`.

```javascript
const model = {
  type: "probabilistic",
  comparisons: {
    identifier: [(a, b) => a === b],
    birth_date: [(a, b) => a === b],
    postal_code: [(a, b) => a === b]
  }
};
```

Rebuild, inspect agreements and disagreements, and validate before choosing thresholds. A coarse Boolean model may lose recall on transcription errors; three equal fields are not a hand-written requirement for a match.

## A fixed final decision

A policy requires surname agreement and the same first given-name letter. Use a deterministic model when this is the complete matching rule, rather than a signal whose weight should be learned. Prepare scalar `given` and `family` fields.

```javascript
const model = {
  type: "deterministic",
  compare: (a, b) => {
    const normalize = value => String(value ?? "").normalize("NFKC").toLowerCase().trim();
    const leftGiven = normalize(a.given), rightGiven = normalize(b.given);
    const leftFamily = normalize(a.family), rightFamily = normalize(b.family);
    const matches = leftFamily !== "" && leftFamily === rightFamily
      && leftGiven !== "" && rightGiven !== ""
      && Array.from(leftGiven)[0] === Array.from(rightGiven)[0];
    return { score: matches ? 1 : 0, meta: { reason: "same surname and given-name initial" } };
  }
};
```

Check matching and differing initials, different surnames, and missing names. This rule intentionally accepts John Smith and James Smith; use additional evidence if that is too broad for your population. Deterministic functions receive projected records and perform their own normalization.

## Build and verify

Select **Build model**, inspect **Learned comparisons**, then use **Review & save** to inspect candidate pairs and choose thresholds. Save the model and use its ID with [online matching](match-operation.md), [Bulk matching](bulk-match.md) or [Continuous matching](continuous-matching.md). The same saved comparison runs in each mode. A comparison only scores retrieved candidates: check candidate coverage as well as precision, especially for nickname and date-swap cases. Labels used for evaluation must not be used to select a threshold on the final test set.
