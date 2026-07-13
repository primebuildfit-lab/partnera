# Inventario de Persistencia — Runtime real (Bloque 1)

> Extraído **del código** (`packages/persistence/src/unit-of-work.ts`), fuente de verdad.
> **59 colecciones**, **14 append-only**, **13 índices únicos**. Este inventario es la base para
> reconciliar el esquema Prisma (Bloque 2). Money = `bigint`/minor units serializado como string;
> fechas = `Date`; tenant = `tenantId`/`businessId` según el dominio.

## Convenciones observadas
- **Append-only**: la `Collection` rechaza UPDATE/DELETE (ledger, auditoría, eventos, versiones).
- **Índice único**: respalda idempotencia / unicidad por tenant.
- **Versión (`version`)**: por fila, para concurrencia optimista (todas las colecciones mutables).
- **PK**: expresión sobre el registro (id simple o clave compuesta).

## Núcleo plataforma / afiliados (28)

| # | Colección | Tipo | PK | Único | Append-only |
|---|---|---|---|---|---|
| 1 | users | User | `id` | email | no |
| 2 | organizations | Organization | `id` | — | no |
| 3 | businesses | Business | `id` | — | no |
| 4 | memberships | Membership | `id` | — | no |
| 5 | roles | Role | `id` | — | no |
| 6 | offers | OfferRow | `id` | — | no |
| 7 | offer_versions | OfferVersionRow | `offerId:version` | — | **sí** |
| 8 | tracking_links | TrackingLinkRow | `id` | tenant_code | no |
| 9 | coupons | CouponRow | `id` | tenant_code | no |
| 10 | tracking_sessions | TrackingSession | `tenantId:token` | — | no |
| 11 | clicks | Click | `id` | — | **sí** |
| 12 | coupon_uses | CouponUse | `couponId:orderId` | — | **sí** |
| 13 | orders | NormalizedOrder | `id` | tenant_platform_order | no |
| 14 | conversions | Conversion | `id` | tenant_order | no |
| 15 | refunds | RefundRow | `id` | — | **sí** |
| 16 | ledger_events | LedgerEvent | `id` | — | **sí** |
| 17 | payout_events | PayoutEvent | `id` | — | **sí** |
| 18 | fraud_signals | FraudSignalRow | `id` | — | **sí** |
| 19 | fraud_scores | RiskScoreRow | `id` | — | **sí** |
| 20 | fraud_cases | FraudCase | `id` | — | no |
| 21 | notifications | QueuedNotification | `id` | — | no |
| 22 | delivery_records | DeliveryRow | `id` | — | **sí** |
| 23 | notification_preferences | NotificationPreference | `userId` | — | no |
| 24 | notification_templates | NotificationTemplate | `key` | — | no |
| 25 | extensions | ExtensionRow | `id` | key_version | no |
| 26 | config_values | ConfigRow | `key[:tenant]` | — | no |
| 27 | audit_log | AuditLogEntry | `id` | — | **sí** |
| 28 | idempotency_keys | IdempotencyRow | `scope::key` | — | **sí** |

## Creator Marketplace (26)

| # | Colección | Tipo | PK | Único | Append-only |
|---|---|---|---|---|---|
| 29 | creator_profiles | CreatorProfile | `id` | user | no |
| 30 | creator_relationships | CreatorCompanyRelationship | `creatorId:businessId` | — | no |
| 31 | creator_programs | CreatorProgram | `id` | tenant_slug | no |
| 32 | content_campaigns | ContentCampaign | `id` | — | no |
| 33 | content_opportunities | ContentOpportunity | `id` | — | no |
| 34 | deliverable_requirements | DeliverableRequirement | `id` | — | no |
| 35 | creator_applications | CreatorApplication | `id` | opp_creator | no |
| 36 | submissions | Submission | `id` | — | no |
| 37 | submission_versions | SubmissionVersion | `id` | — | **sí** |
| 38 | submission_reviews | SubmissionReview | `id` | — | **sí** |
| 39 | content_assets | ContentAsset | `id` | — | no |
| 40 | content_licenses | ContentLicense | `id` | asset | no |
| 41 | rank_unlock_rules | RankUnlockRule | `id` | — | no |
| 42 | creator_payments | CreatorPayment | `id` | — | no |
| 43 | creator_ledger_events | CreatorLedgerEvent | `id` | — | **sí** |
| 44 | creator_disputes | Dispute | `id` | — | no |
| 45 | evaluation_schemes | EvaluationScheme | `id` | program | no |
| 46 | program_capacities | ProgramCapacity | `programId` | — | no |
| 47 | program_budgets | ProgramBudget | `programId` | — | no |
| 48 | submission_dispositions | SubmissionDisposition | `submissionId` | — | no |
| 49 | business_plans | BusinessPlanDefinition | `key` | — | no |
| 50 | business_trials | BusinessTrialState | `businessId` | — | no |
| 51 | promotional_channels | PromotionalChannel | `id` | — | no |
| 52 | promoted_placements | PromotedPlacement | `id` | — | no |
| 53 | program_fee_settings | ProgramFeeSetting | `programId` | — | no |
| 54 | pilot_checklists | PilotChecklist | `businessId` | — | no |

> Nota: "EvaluationCategory" y "ProgramPaymentRule" de la visión están **embebidos** dentro de
> `EvaluationScheme.categories[]` (no son colecciones separadas). "Waiting queue" y
> "ContentReuseStatus" están **embebidos** en `SubmissionDisposition` (campos independientes
> queueState/paymentEligible/libraryStatus/affiliateAccess/…). "Rank definitions" = enum
> `AFFILIATE_RANKS`; las reglas viven en `rank_unlock_rules`.

## Shopify (5)

| # | Colección | Tipo | PK | Único | Append-only |
|---|---|---|---|---|---|
| 55 | shopify_installations | ShopifyInstallation | `id` | shop | no |
| 56 | shopify_sessions | ShopifyOfflineSession | `shop` | — | no |
| 57 | webhook_events | WebhookEvent | `id` | idem (`shop::topic::webhookId`) | no* |
| 58 | onboarding_states | OnboardingState | `id` | — | no |
| 59 | storage_connections | StorageConnection | `id` | — | no |

\* `webhook_events` es conceptualmente append-de-recepción con estado de procesamiento que avanza
(received→processed/failed/dead_letter); su unicidad `idem` garantiza no-doble-aplicación.

## Reglas transversales confirmadas (código)
- **Idempotencia** por índice único: `orders.tenant_platform_order`, `conversions.tenant_order`,
  `webhook_events.idem`, `shopify_installations.shop`, `idempotency_keys.scope::key`,
  `creator_applications.opp_creator`, `evaluation_schemes.program`.
- **Dinero** exacto (`MoneyJSON {currency, minorUnits:string}`), nunca float.
- **Fechas** `Date` reales (serializadas por `serializeStore` Date-aware).
- **Multi-tenant**: registros empresariales llevan `tenantId`/`businessId`; el creador es actor con
  relación por empresa (no tenant).
