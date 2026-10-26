# dsh-insurance-advisor

An agent preset for **individual insurance agents (个险渠道)** on DeepSeek Harness: needs analysis, proposals, suitability matching, sales-recording (双录) checks, and policy servicing.

It ships **10 deterministic tools** and **5 skills**, and mounts **no shell tool** — file read/write is kept, but the model cannot run arbitrary commands against client data.

English | [中文](README.zh.md)

## Install

```sh
dsh plugin --profile <profile> add dsh-insurance-advisor
```

Then restart, open **Settings → Agent presets**, and select **保险顾问（个险展业）**.

The package declares `dsh.bundle`, so `dsh plugin add` reconciles it as a profile layer. To track `main` instead of a release, install from the repository:

```sh
dsh plugin --profile <profile> add github:MagicTangOps/dsh-insurance-advisor
```

This repository is also a DSH plugin market source — add this URL under **Plugins → Discover → 添加索引源** to browse and install it from inside Harness:

```
https://cdn.jsdelivr.net/gh/MagicTangOps/dsh-insurance-advisor@main/index.json
```

## What it adds

### Agent preset

One preset (`insurance-advisor`, order 20) composing the standard tool set — file, web, todo, schedule, present, compaction, delegation — plus the three domain plugins below. `tool-bash`, `tool-pwsh` and the terminal group are deliberately absent.

### Suitability and authorization — `insurance_check_suitability`, `insurance_authorized_products`

Encodes the product-class / agent-level / customer-risk matrix as deterministic rules instead of leaving the model to infer:

| Agent level | Highest product class it may sell |
|---|---|
| none | P1 |
| 4 | P2 |
| 3 | P3 |
| 2 | P4 |
| 1 | P5 |

- A **combination sale** must take the *highest* class among its products (从高不从低).
- **P4 / P5** additionally require the customer's risk level (R1–R5) to be at least the product's risk rating.
- `insurance_authorized_products` answers the inverse question: which product classes this agent may sell.

### Client and policy ledger — `insurance_crm_*`

Six tools over a `storageDomain`-backed table: `insurance_upsert_client`, `insurance_list_clients`, `insurance_add_policy`, `insurance_list_policies`, `insurance_service_due`, `insurance_record_touchpoint`.

Grace periods are computed from the **receipt date (回执签收日)**, inclusive of the day itself:

| Channel | Grace period |
|---|---|
| `individual` | 10 days |
| `bancassurance` | 15 days |
| `internet` | 15 days |
| `telemarketing` | 10 days |

`insurance_service_due` reports policies still inside the grace period (new-business callback owed) and renewals falling due inside a configurable window.

### Sales-recording checklist — `insurance_dual_record_*`

`insurance_dual_record_checklist` builds a customized five-section recording checklist; `insurance_dual_record_validate` rejects a recording that omits any of `identity`, `materials`, `product`, `disclosure`, `no-extra-benefit`.

### Skills

`insurance-needs-analysis`, `insurance-proposal`, `insurance-dual-record`, `insurance-compliance`, `insurance-servicing` — loaded from `skills/` inside this package.

## Host-level and preset-level placement

`insurance-crm` is inserted at the **Host** level, not inside the preset, because it consumes the Host `storageDomain` service. Inside a preset scope it stays pending forever and the preset is reported as broken. The other two plugins live inside the preset, so they activate only when the user selects 保险顾问.

Two consequences worth knowing: the six `insurance_crm_*` tools are available to every agent in the profile, and the CRM ledger is shared per profile rather than per preset.

## Compatibility

- `engines.dsh`: `>=0.2.1-rc.1 <0.3.0-0`
- `@deepseek-ai/dsh-tools` and `@deepseek-ai/dsh-storage-domain` are **peer** dependencies with an explicit prerelease branch, so prerelease harness builds are not silently excluded by node-semver.
- `zod` `^4.4.3` is a regular dependency.

## Deliberately not included

- **No regulatory full-text.** The rules cover the suitability matrix, grace periods and the five mandatory recording sections. Anything else — product filings, carrier-specific clauses — must be checked against the current official text; the preset instructs the model to search for it rather than assert it.
- **No commission, illustration or point-of-sale calculation.** This is not a quoting engine.
- **No client data leaves the machine.** The ledger is local storage; only web search, when the model chooses to use it, reaches the network.

## Testing

```sh
npm test
```

73 assertions across the four rule modules (suitability 25, dates 13, domain 12, dual-record 23). They are pure-function tests and need no harness runtime.

## License

MIT.