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

The match score is the product of all Bayes factors multiplied by the prior. In log space (as used by MDMbox), this becomes the sum of log2 Bayes factors:

`match_weight = weight_1 + weight_2 + ... + weight_n`

To convert to a probability estimate:

`probability = x / (1 + x)` where `x = 2^match_weight` (or equivalently, `probability = 1 / (1 + 2^(-match_weight))`).

## Independence assumption

Comparison functions are assumed to be mutually independent. In practice, the algorithm is robust to moderate violations of this assumption.

## Parameter estimation

The m-probabilities and u-probabilities can be estimated from data using the EM (Expectation-Maximization) algorithm. This is discussed in detail in the fastlink paper. For MDMbox, these parameters are specified directly in the model as feature weights, typically calibrated through a combination of domain expertise and statistical analysis.

## See also

{% content-ref %}
[Matching models](matching-models.md)
{% endcontent-ref %}
