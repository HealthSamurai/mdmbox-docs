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

## File Download

{% file src="/assets/example.pdf" / %}

{% file src="/assets/example.zip" %}
Download Example Archive
{% endfile %}

## Carousel

{% carousel %}
![First example image](../assets/carousel-1.png)
![Second example image](../assets/carousel-2.png)
{% endcarousel %}

## Quote

{% quote author="John Doe" title="Solutions Architect" %}
MDMbox has transformed our master data management workflow. The documentation widgets make it easy to create rich, interactive content.
{% endquote %}

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
