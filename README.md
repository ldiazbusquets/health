# LDB Health

Interactive tools on how AI is used, tested and trusted in healthcare: https://ldiazbusquets.github.io/health/

A sister site to the [LDB Lab](https://ldiazbusquets.github.io/lab/), built with the same design in red, alongside
SCI 359 (AI in Healthcare) at Bryant University.

- `tests.html`: Test Accuracy. Sensitivity, specificity and prevalence on a grid of 1,000 people.
- `outbreak.html`: Outbreak Simulator. An SEIR model with vaccination, distancing and hospital capacity.
- `bias.html`: Algorithm Bias. A logistic regression trained on unbalanced synthetic data, with per-group error rates.

The hero heart (`assets/model/heart.bin.gz`, drawn by `assets/heart3d.js`) is adapted from [BodyParts3D](https://dbarchive.biosciencedbc.jp/en/bodyparts3d/) 4.0,
© The Database Center for Life Science, licensed [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/): the heart walls, coronary
vessels, aorta, pulmonary vessels and superior vena cava were extracted, clipped where they leave the heart, merged and quantised.

Everything runs in the browser with no build step. Data is synthetic or illustrative. Educational only; not medical advice.
