# Getting Started with MDMbox

**Master Data Management (MDM)** ensures **accurate entity identification** by detecting and removing duplicate records. It helps maintain consistent and reliable data across healthcare systems.

**MDMbox enables:**

- Accurate [**matching**](match-operation.md) of records across different systems and facilities
- [**Merging**](merge-and-unmerge.md#merge-operation) of duplicate records into a single record
- [**Unmerging**](merge-and-unmerge.md#unmerge-operation) of incorrectly linked records
- Maintaining the **integrity** of clinical data and treatment history

Using MDMbox **reduces the risk** of lost or duplicated data, errors, and issues with data exchange. This is especially critical in complex ecosystems with many sources — such as clinics, labs, and telemedicine platforms.

The MDM module utilizes a **probabilistic** (score-based or Fellegi-Sunter) method. It is more flexible and can provide better results than rule-based approaches, but at the cost of simplicity.

## Capabilities Overview

### Technical Capabilities

- FHIR R4 support
- Seamless integration with the Aidbox platform
- API-first architecture with a user-friendly web-based UI
- Notifications for external systems via webhooks (non-FHIR format)
- Unlimited scalability — supports any number of records
- Can be deployed in the cloud or on-premises

### Data Safety, Transparency and Consistency

- Role-based access control
- Full traceability of all operations, user actions and API calls
- Supports compliance with security and regulatory standards

### Core Feature Set

- Search for records
- Flexible matching using a probabilistic algorithm
  - Fully configurable for specific data and use cases
  - Handles typos and incomplete data
- Manual record merging with unique merge strategy combining golden record and survivor record approaches
- Unmerge capability
- Ability to mark record pairs as non-duplicates to exclude them from future match results

## Quick Start

1. [Run MDMbox locally](run-locally.md) using Docker Compose
2. [Configure](configuration.md) matching rules for your use case
3. Start [finding duplicates](match-operation.md) and [merging records](merge-and-unmerge.md)

## Next Steps

- [MDM Theory](mdm-theory.md) — understand the concepts behind master data management
- [Matching Model Explanation](matching-model.md) — learn how the matching algorithm works
- [Mathematical Details](mathematical-details.md) — dive into the math behind probabilistic matching
