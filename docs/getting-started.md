---
description: Run MDMbox locally with Docker Compose and try matching in the welcome walkthrough.
---

# Getting started

Run MDMbox, Aidbox, and PostgreSQL locally, then try patient matching in the browser. You need Docker Compose and an [Aidbox account](https://aidbox.app/ui/portal) to activate development licenses.

Aidbox serves the FHIR records; MDMbox finds and resolves duplicates in the same database. For Kubernetes, see [Kubernetes deployment](deployment/kubernetes.md). For supported versions and image tags, see [Versions and compatibility](deployment/versions-and-compatibility.md).

## 1. Download the configuration

Save this file as `docker-compose.yml` in an empty directory:

{% file src="/docs/mdmbox/assets/examples/docker-compose.shared.yml?v=1bef672a875b887b" %}
docker-compose.yml
{% endfile %}

This local example uses MDMbox and Aidbox `latest`, development credentials, and a shared database.

## 2. Start the services

From that directory, run:

```bash
docker compose pull
docker compose up -d
```

Initial startup downloads images and FHIR packages and can take several minutes. Follow progress with `docker compose logs -f`.

## 3. Activate and sign in

1. Open `http://localhost:8888` and activate Aidbox following the [Aidbox setup guide](https://www.health-samurai.io/docs/aidbox/getting-started/run-aidbox-locally).
2. Open `http://localhost:8888/mdmbox`. If redirected to Aidbox login, sign in with `postgres` as both the username and password for this example; you return to MDMbox after sign-in.
3. Click **Sign in to activate** if MDMbox needs activation.

For unattended activation, set `MDMBOX_LICENSE`; see [License configuration](config-reference.md#license). If the Admin UI shows **Activate Aidbox**, complete Aidbox activation through its link.

## 4. Try matching in the UI

Open `http://localhost:8888/mdmbox/welcome` and follow the three steps:

1. **Import sample patients:** click **Import 1,000 patients** to load synthetic FHIR records. When the import finishes, the page shows the patient count. If you already have patient data, continue with that dataset.
2. **Install matching model:** click **Install model** to create the example `patient-example` model. Use **Show model JSON** to inspect it or **View in Models** to open it in the Admin UI.
3. **Test Match:** click **Run tests**. MDMbox picks a patient and compares the original details, a name with a typo, and a changed birth date against the database.

The result tabs show the submitted fields, matching records, scores, and grades:

| Test | Expected result |
| --- | --- |
| **Exact match** | The original patient is returned with grade `certain`. |
| **Typo in name** | The original patient is still found despite a spelling error. |
| **Wrong birthdate** | The original patient is found with grade `probable` or `certain`. |

Use **Re-pick patient** to try another record. These tests find matches without merging or deleting patients. The example model demonstrates matching; [tune a model](matching-models.md#tuning) for your own data before using its scores to make decisions.

If **Wrong birthdate** reports `FHIRSchema validation error`, swapping that patient's month and day produced an invalid date. Click **Re-pick patient** and run the tests again.

You can manage models at `http://localhost:8888/mdmbox/admin` and explore API requests at `http://localhost:8888/api/docs`.

## Next steps

- Follow [Match, merge, and unmerge records](tutorials/match-merge-unmerge.md) to resolve a duplicate and restore it through the API.
- Configure [Matching models](matching-models.md) for your records.
- Find pairs across a dataset with [Bulk matching](bulk-match.md).
- See [Updating MDMbox](deployment/updating-mdmbox.md) to stop or update this environment.
