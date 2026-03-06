# Widgets Showcase

This page demonstrates all available widgets.

## Hints

{% hint style="info" %}
This is an **info** hint. Use it for general information and tips.
{% endhint %}

{% hint style="success" %}
This is a **success** hint. Use it to highlight successful outcomes or confirmations.
{% endhint %}

{% hint style="warning" %}
This is a **warning** hint. Use it to warn users about potential issues.
{% endhint %}

{% hint style="danger" %}
This is a **danger** hint. Use it for critical warnings and destructive actions.
{% endhint %}

## Tabs

{% tabs %}
{% tab title="First Tab" %}
Content for the first tab. You can include any markdown here.
{% endtab %}
{% tab title="Second Tab" %}
Content for the second tab with a list:

- Item one
- Item two
- Item three
{% endtab %}
{% tab title="Third Tab" %}
Content for the third tab with a code block:

```json
{
  "key": "value"
}
```
{% endtab %}
{% endtabs %}

## Stepper

{% stepper %}
{% step %}
### Create a configuration file

Create a new `config.yaml` file in the root directory.
{% endstep %}
{% step %}
### Add required fields

Fill in the required configuration fields.

```yaml
server:
  host: localhost
  port: 8080
```
{% endstep %}
{% step %}
### Start the application

Run the application with the new configuration.
{% endstep %}
{% endstepper %}

## Code Block with Title

{% code title="docker-compose.yaml" %}
```yaml
version: "3.8"
services:
  app:
    image: mdmbox:latest
    ports:
      - "8080:8080"
```
{% endcode %}

## Embeds

YouTube video embed:

{% embed url="https://www.youtube.com/watch?v=dQw4w9WgXcQ" / %}

Link card embed:

{% embed url="https://example.com" / %}

## Content Reference

{% content-ref %}
[Getting Started](getting-started.md)
{% endcontent-ref %}

## Carousel

{% carousel %}
![First example image](../assets/carousel-1.avif)
![Second example image](../assets/carousel-2.avif)
{% endcarousel %}

## Quote

{% quote author="John Doe" title="Solutions Architect" %}
MDMbox has transformed our master data management workflow. The documentation widgets make it easy to create rich, interactive content.
{% endquote %}

## Markdown Features

### Text Formatting

This is **bold text**, this is *italic text*, and this is ***bold italic text***.

This is ~~strikethrough text~~ and this is `inline code`.

### Links

[External link](https://example.com) and [internal link](getting-started.md).

### Lists

Unordered list:

- First item
- Second item
  - Nested item
  - Another nested item
- Third item

Ordered list:

1. First step
2. Second step
   1. Sub-step A
   2. Sub-step B
3. Third step

### Task List

- [x] Completed task
- [ ] Incomplete task
- [x] Another completed task

### Table

| Column 1 | Column 2 | Column 3 |
| --------- | --------- | --------- |
| Row 1 | Data | Data |
| Row 2 | Data | Data |
| Row 3 | Data | Data |

### Blockquote

> This is a blockquote. It can contain **formatted text** and other elements.
>
> It can also span multiple paragraphs.

### Horizontal Rule

---

### Image

![Example image](../assets/carousel-1.avif)

### Code Blocks

Inline: use the `config.yaml` file.

Fenced code block with syntax highlighting:

```sql
SELECT id, name, status
FROM devices
WHERE status = 'active'
ORDER BY name;
```

```python
def hello(name: str) -> str:
    return f"Hello, {name}!"
```

### Footnote

This text has a footnote[^1].

[^1]: This is the footnote content.

### Mermaid Diagrams

Flowchart:

```mermaid
flowchart LR
    A(Start) --> B{Decision}
    B -->|Yes| C(Action 1)
    B -->|No| D(Action 2)
    C --> E(End)
    D --> E
```

Sequence diagram:

```mermaid
sequenceDiagram
    participant Client
    participant Server
    participant Database
    Client->>Server: POST /api/resource
    Server->>Database: INSERT INTO resources
    Database-->>Server: OK
    Server-->>Client: 201 Created
```

Class diagram:

```mermaid
classDiagram
    class Device {
        +String id
        +String name
        +String status
        +activate()
        +deactivate()
    }
    class Policy {
        +String id
        +String name
        +List~Rule~ rules
        +apply(Device)
    }
    class Rule {
        +String condition
        +String action
    }
    Policy "1" --> "*" Rule
    Policy "1" --> "*" Device
```

State diagram:

```mermaid
stateDiagram-v2
    [*] --> Pending
    Pending --> Active: Approve
    Pending --> Rejected: Reject
    Active --> Suspended: Suspend
    Suspended --> Active: Reactivate
    Active --> [*]: Delete
```

Entity relationship diagram:

```mermaid
erDiagram
    DEVICE ||--o{ ENROLLMENT : has
    DEVICE {
        string id PK
        string name
        string status
    }
    ENROLLMENT {
        string id PK
        string device_id FK
        date enrolled_at
    }
    POLICY ||--o{ DEVICE : applies_to
    POLICY {
        string id PK
        string name
        string description
    }
```

Gantt chart:

```mermaid
gantt
    title Project Timeline
    dateFormat YYYY-MM-DD
    section Phase 1
        Requirements    :done, 2026-01-01, 2026-01-15
        Design          :done, 2026-01-15, 2026-02-01
    section Phase 2
        Development     :active, 2026-02-01, 2026-03-15
        Testing         :2026-03-15, 2026-04-01
    section Phase 3
        Deployment      :2026-04-01, 2026-04-15
```

## Nested Widgets

Widgets can be nested. Here is a hint inside a tab:

{% tabs %}
{% tab title="Important" %}
{% hint style="warning" %}
This warning is nested inside a tab.
{% endhint %}
{% endtab %}
{% tab title="Steps" %}
{% stepper %}
{% step %}
First nested step.
{% endstep %}
{% step %}
Second nested step.
{% endstep %}
{% endstepper %}
{% endtab %}
{% endtabs %}
