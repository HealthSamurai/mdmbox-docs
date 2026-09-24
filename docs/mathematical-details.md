---
description: Mathematical foundations of probabilistic record matching in MDMbox.
---

# Mathematical details

See the [fastlink](https://imai.fas.harvard.edu/research/files/linkage.pdf) paper for a detailed treatment.

The algorithm is based on comparisons between pairs of records (FHIR resources).

## Comparison functions

Define a set of comparison functions over pairs of records. Each comparison function returns a single category, for example:

- null (value missing)
- significantly different
- slightly different
- exactly equal

Different comparison functions can have different sets of possible categories. In MDMbox, these correspond to the `case` entries within a feature definition.

An example comparison function for surnames:

- -1, if the surname of one of the records is missing
- 0, if Levenshtein distance between surnames is greater than 2
- 1, if Levenshtein distance is 2
- 2, if Levenshtein distance is 1
- 3, if surnames are equal

## Bayes factors

Two records _match_ if they belong to the same entity (e.g., two records for the same patient).

Using Bayes' theorem, we define the _prior probability_ as the probability that two random records match.

For each comparison function value, define:

- **m-probability**: probability of this value given that records match
- **u-probability**: probability of this value given that records do not match

The ratio m/u is the **Bayes factor**. In MDMbox, the `weight` field in feature cases represents log2 of the Bayes factor.

## Match score

MDMbox adds the weights selected by the model's feature cases:

`match_weight = weight_1 + weight_2 + ... + weight_n`

It converts the raw weight to the FHIR `search.score` in the range 0–1:

`search.score = 1 / (1 + 2^(-match_weight))`

This conversion does not apply a separate prior probability. In Bayesian terms it assumes prior odds of 1; a calibrated posterior would also include the log2 prior odds. Treat `search.score` as a ranking score, not a measured probability that two records are the same person. MDMbox uses the raw weight for threshold filtering and match grades.

## Independence assumption

Adding log Bayes factors assumes the comparisons are independent given whether the records match. Correlated features can count the same evidence more than once; calibrate weights and thresholds against representative data.

## Parameter estimation

The m-probabilities and u-probabilities can be estimated from data using the EM (Expectation-Maximization) algorithm. This is discussed in detail in the fastlink paper. For MDMbox, these parameters are specified directly in the model as feature weights, typically calibrated through a combination of domain expertise and statistical analysis.

## See also

{% content-ref %}
[Matching models](matching-models.md)
{% endcontent-ref %}
