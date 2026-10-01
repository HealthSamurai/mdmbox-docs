---
description: Subscribe to merge and unmerge events using Aidbox Topic-Based Subscriptions to keep downstream systems in sync.
---

# Notifications

Use [Aidbox Topic-Based Subscriptions](https://www.health-samurai.io/docs/aidbox/modules/topic-based-subscriptions/aidbox-topic-based-subscriptions) to notify another system when a merge or unmerge completes. Both server-managed and client-plan operations create Tasks that a subscription can watch.

## How it works

Every [merge](merge-operation.md) or [unmerge](unmerge-operation.md) creates a `Task` in the same transaction as its resource changes. Subscribe to Tasks with the operation code `merge` or `unmerge` to receive completed operations.

## What the recipient gets

Read Tasks from `entry[].resource` in the notification Bundle. For payload format and delivery settings, see the [Aidbox webhook guide](https://www.health-samurai.io/docs/aidbox/tutorials/subscriptions-tutorials/webhook-aidboxtopicdestination).

Use each Task to inspect the operation:

- `Task.focus`, `Task.for`, and `Task.businessStatus` identify the target, source, and outcome.
- `GET https://<aidbox-host>/fhir/Provenance?target=Task/<task-id>` returns affected resources, versioned references to their previous states, and the operation timestamp.

## AidboxSubscriptionTopic

Create this topic on the **Aidbox host** to watch newly completed merge Tasks:

```http
PUT https://<aidbox-host>/fhir/AidboxSubscriptionTopic/task-merge
Content-Type: application/fhir+json
```

```json
{
  "resourceType": "AidboxSubscriptionTopic",
  "id": "task-merge",
  "url": "https://mdm.health-samurai.io/fhir/SubscriptionTopic/task-merge",
  "status": "active",
  "trigger": [
    {
      "resource": "Task",
      "supportedInteraction": ["create"],
      "fhirPathCriteria": "code.coding.where(system='https://mdm.health-samurai.io/fhir/CodeSystem/operation-task-code' and code='merge').exists()"
    }
  ]
}
```

To subscribe to unmerge events, create a second topic with `code='unmerge'` in the FHIRPath filter, or broaden the filter to match both.

Use `create` for newly completed operations. Include `update` to also track lifecycle changes, such as the original merge Task changing to `businessStatus=unmerged`.

## AidboxTopicDestination

Configure delivery using the [Aidbox webhook guide](https://www.health-samurai.io/docs/aidbox/tutorials/subscriptions-tutorials/webhook-aidboxtopicdestination). Set the destination's `topic` to `https://mdm.health-samurai.io/fhir/SubscriptionTopic/task-merge` from the example above.

For at-least-once delivery, handle each operation Task ID once to avoid processing repeated notifications.
