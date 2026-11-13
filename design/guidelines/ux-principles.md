# UX principles

## 1. Show the property, then get out of the way

Search results and listing pages lead with price, place and photos. Anything that is not helping someone decide is secondary.

## 2. Tell people where they stand

Every request, application and booking has a visible state and a reference. Use the customer-facing statuses from the specification exactly: Received, Sent to agent/seller, In progress, Responded, Closed, Unable to route. Never imply a person has read something because a notification was accepted by a provider.

## 3. One clear next step

Each screen has one primary action. If two actions compete, one of them is secondary.

## 4. Design every state

A screen is not finished until these exist:

| State | Requirement |
| --- | --- |
| Loading | A skeleton that matches the final layout. No spinners for page content. |
| Empty | Says why it is empty and offers the next step. |
| Error | Says what went wrong in plain words and how to recover. Includes a support reference when the API gives one. |
| Partial | Missing optional data is omitted, not shown as "N/A". |
| Success | Confirms what was saved and what happens next. |

## 5. Mobile first, low bandwidth aware

Design at 360px wide first. Keep pages useful before JavaScript loads: search is a plain form, listings are server rendered. Avoid layout shift by reserving space for media with fixed aspect ratios.

## 6. Forms ask for the minimum

Only ask for what the next step needs. One column. Labels above fields. Validate on submit, then on change for fields that had an error. Never clear what someone typed after a failure.

## 7. Trust is shown, not claimed

Verified badges, sponsored labels, self-recorded versus gateway-confirmed payments, and draft watermarks on leases are part of the interface. Do not style an unverified thing to look verified.

## 8. Built for more than one market

- Always show the currency code with an amount.
- Store and send times in UTC; show them in the market or visitor time zone and say which.
- Do not hard-code address shapes, phone formats or legal text.
- Leave room for longer translations; do not set fixed widths on text.

## 9. Role-aware, not role-cluttered

Customers, agents and administrators see different navigation. A feature that is not available to a role is absent, not disabled, unless explaining it helps them upgrade or ask for access.
