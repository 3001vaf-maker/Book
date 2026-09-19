-- Book PostgreSQL baseline
-- Generated from the fully migrated Book schema on 2026-09-19.

--
-- PostgreSQL database dump
--


-- Dumped from database version 16.15
-- Dumped by pg_dump version 16.15

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: BookingRequestStatus; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public."BookingRequestStatus" AS ENUM (
    'PENDING',
    'IMPORTED',
    'REJECTED',
    'CANCELLED'
);


--
-- Name: CapabilityValueType; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public."CapabilityValueType" AS ENUM (
    'BOOLEAN',
    'LIMIT'
);


--
-- Name: MasterInvitationStatus; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public."MasterInvitationStatus" AS ENUM (
    'PENDING',
    'ACCEPTED',
    'REVOKED'
);


--
-- Name: MembershipRole; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public."MembershipRole" AS ENUM (
    'OWNER',
    'ADMIN',
    'MASTER'
);


--
-- Name: TenantAccessStatus; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public."TenantAccessStatus" AS ENUM (
    'ACTIVE',
    'SUSPENDED'
);


--
-- Name: book_reject_document_registry_event_mutation(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.book_reject_document_registry_event_mutation() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  RAISE EXCEPTION '% is append-only', TG_TABLE_NAME;
END;
$$;


SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: BookingAccount; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."BookingAccount" (
    id text NOT NULL,
    "tenantId" text NOT NULL,
    email text NOT NULL,
    "passwordHash" text NOT NULL,
    name text DEFAULT ''::text NOT NULL,
    surname text DEFAULT ''::text NOT NULL,
    phone text DEFAULT ''::text NOT NULL,
    "telegramId" text DEFAULT ''::text NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL,
    "profileData" jsonb DEFAULT '{}'::jsonb NOT NULL,
    uei text DEFAULT ''::text NOT NULL,
    "discountPercent" double precision DEFAULT 0 NOT NULL,
    visits integer DEFAULT 0 NOT NULL,
    "totalSpent" double precision DEFAULT 0 NOT NULL,
    "lastVisit" text DEFAULT ''::text NOT NULL,
    programs jsonb DEFAULT '[]'::jsonb NOT NULL
);


--
-- Name: BookingPublication; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."BookingPublication" (
    id text NOT NULL,
    "tenantId" text NOT NULL,
    data jsonb NOT NULL,
    revision integer DEFAULT 1 NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


--
-- Name: BookingRequest; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."BookingRequest" (
    id text NOT NULL,
    "tenantId" text NOT NULL,
    "accountId" text NOT NULL,
    "workplaceKey" text NOT NULL,
    date text NOT NULL,
    "from" text NOT NULL,
    "to" text NOT NULL,
    procedures jsonb NOT NULL,
    status public."BookingRequestStatus" DEFAULT 'PENDING'::public."BookingRequestStatus" NOT NULL,
    "importedRecordId" text DEFAULT ''::text NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL,
    "recordSnapshot" jsonb
);


--
-- Name: BusinessAuxiliaryState; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."BusinessAuxiliaryState" (
    id text NOT NULL,
    "tenantId" text NOT NULL,
    data jsonb NOT NULL,
    "migrationVerifiedAt" timestamp(3) without time zone,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


--
-- Name: BusinessIdentityState; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."BusinessIdentityState" (
    id text NOT NULL,
    "tenantId" text NOT NULL,
    data jsonb NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


--
-- Name: BusinessOperationalState; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."BusinessOperationalState" (
    id text NOT NULL,
    "tenantId" text NOT NULL,
    data jsonb NOT NULL,
    "migrationVerifiedAt" timestamp(3) without time zone,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


--
-- Name: BusinessPerson; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."BusinessPerson" (
    id text NOT NULL,
    "tenantId" text NOT NULL,
    key text NOT NULL,
    "position" integer DEFAULT 0 NOT NULL,
    data jsonb NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


--
-- Name: BusinessRecord; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."BusinessRecord" (
    id text NOT NULL,
    "tenantId" text NOT NULL,
    "recordId" text NOT NULL,
    "position" integer DEFAULT 0 NOT NULL,
    data jsonb NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


--
-- Name: BusinessRecordEvent; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."BusinessRecordEvent" (
    id text NOT NULL,
    "tenantId" text NOT NULL,
    "eventId" text NOT NULL,
    "recordId" text NOT NULL,
    "position" integer DEFAULT 0 NOT NULL,
    data jsonb NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


--
-- Name: BusinessStateMeta; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."BusinessStateMeta" (
    id text NOT NULL,
    "tenantId" text NOT NULL,
    "migrationVerifiedAt" timestamp(3) without time zone,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


--
-- Name: Capability; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."Capability" (
    id text NOT NULL,
    key text NOT NULL,
    "groupKey" text NOT NULL,
    name text NOT NULL,
    description text DEFAULT ''::text NOT NULL,
    "valueType" public."CapabilityValueType" NOT NULL,
    "defaultEnabled" boolean DEFAULT false NOT NULL,
    "defaultLimit" integer,
    "position" integer DEFAULT 0 NOT NULL,
    "isActive" boolean DEFAULT true NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


--
-- Name: CommunicationBroadcastRun; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."CommunicationBroadcastRun" (
    id text NOT NULL,
    "tenantId" text NOT NULL,
    channel text NOT NULL,
    "requestedCount" integer DEFAULT 0 NOT NULL,
    "eligibleCount" integer DEFAULT 0 NOT NULL,
    "sentCount" integer DEFAULT 0 NOT NULL,
    "failedCount" integer DEFAULT 0 NOT NULL,
    status text DEFAULT 'created'::text NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "finishedAt" timestamp(3) without time zone,
    name text DEFAULT ''::text NOT NULL,
    body text DEFAULT ''::text NOT NULL
);


--
-- Name: CommunicationGroup; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."CommunicationGroup" (
    id text NOT NULL,
    "tenantId" text NOT NULL,
    name text NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: CommunicationGroupMember; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."CommunicationGroupMember" (
    "groupId" text NOT NULL,
    "tenantId" text NOT NULL,
    "personKey" text NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: CommunicationIdentity; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."CommunicationIdentity" (
    id text NOT NULL,
    "tenantId" text NOT NULL,
    "cardPhone" text NOT NULL,
    uei text DEFAULT ''::text NOT NULL,
    channel text NOT NULL,
    "externalUserId" text NOT NULL,
    display text DEFAULT ''::text NOT NULL,
    "verifiedAt" timestamp(3) without time zone,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: CommunicationMessage; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."CommunicationMessage" (
    id text NOT NULL,
    "tenantId" text NOT NULL,
    "cardPhone" text NOT NULL,
    uei text DEFAULT ''::text NOT NULL,
    direction text NOT NULL,
    kind text DEFAULT 'message'::text NOT NULL,
    channel text NOT NULL,
    body text DEFAULT ''::text NOT NULL,
    "externalMessageId" text DEFAULT ''::text NOT NULL,
    "externalThreadId" text DEFAULT ''::text NOT NULL,
    status text DEFAULT 'created'::text NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "sentAt" timestamp(3) without time zone,
    "deliveredAt" timestamp(3) without time zone,
    "readAt" timestamp(3) without time zone,
    "failedAt" timestamp(3) without time zone,
    error text DEFAULT ''::text NOT NULL,
    attachments jsonb DEFAULT '[]'::jsonb NOT NULL,
    purpose text,
    CONSTRAINT "CommunicationMessage_purpose_check" CHECK (((purpose IS NULL) OR (purpose = ANY (ARRAY['SYSTEM'::text, 'SERVICE'::text, 'DIRECT'::text, 'MARKETING'::text]))))
);


--
-- Name: CommunicationPreference; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."CommunicationPreference" (
    id text NOT NULL,
    "tenantId" text NOT NULL,
    "cardPhone" text NOT NULL,
    uei text DEFAULT ''::text NOT NULL,
    "preferredChannels" jsonb DEFAULT '[]'::jsonb NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: CommunicationTemplate; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."CommunicationTemplate" (
    id text NOT NULL,
    "tenantId" text NOT NULL,
    name text NOT NULL,
    body text NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: MasterInvitation; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."MasterInvitation" (
    id text NOT NULL,
    "tenantId" text NOT NULL,
    "createdByAdminId" text NOT NULL,
    email text NOT NULL,
    name text DEFAULT ''::text NOT NULL,
    "tokenHash" text NOT NULL,
    status public."MasterInvitationStatus" DEFAULT 'PENDING'::public."MasterInvitationStatus" NOT NULL,
    "expiresAt" timestamp(3) without time zone NOT NULL,
    "acceptedAt" timestamp(3) without time zone,
    "revokedAt" timestamp(3) without time zone,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


--
-- Name: Membership; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."Membership" (
    id text NOT NULL,
    "tenantId" text NOT NULL,
    "userId" text NOT NULL,
    role public."MembershipRole" DEFAULT 'OWNER'::public."MembershipRole" NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);

--
-- Name: Notification; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."Notification" (
    id text NOT NULL,
    "tenantId" text NOT NULL,
    "cardPhone" text NOT NULL,
    uei text DEFAULT ''::text NOT NULL,
    type text NOT NULL,
    title text NOT NULL,
    body text DEFAULT ''::text NOT NULL,
    "entityType" text DEFAULT ''::text NOT NULL,
    "entityId" text DEFAULT ''::text NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    purpose text,
    CONSTRAINT "Notification_purpose_check" CHECK (((purpose IS NULL) OR (purpose = ANY (ARRAY['SYSTEM'::text, 'SERVICE'::text, 'DIRECT'::text, 'MARKETING'::text]))))
);


--
-- Name: NotificationDelivery; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."NotificationDelivery" (
    id text NOT NULL,
    "tenantId" text NOT NULL,
    "notificationId" text NOT NULL,
    channel text NOT NULL,
    "recipientKey" text NOT NULL,
    status text DEFAULT 'created'::text NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "sentAt" timestamp(3) without time zone,
    "deliveredAt" timestamp(3) without time zone,
    "readAt" timestamp(3) without time zone,
    "failedAt" timestamp(3) without time zone,
    error text DEFAULT ''::text NOT NULL
);


--
-- Name: NotificationRoutingPolicy; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."NotificationRoutingPolicy" (
    id text NOT NULL,
    "tenantId" text NOT NULL,
    "eventType" text NOT NULL,
    mode text DEFAULT 'always'::text NOT NULL,
    channels jsonb DEFAULT '[]'::jsonb NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: Plan; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."Plan" (
    id text NOT NULL,
    key text NOT NULL,
    name text NOT NULL,
    description text DEFAULT ''::text NOT NULL,
    "position" integer DEFAULT 0 NOT NULL,
    "isActive" boolean DEFAULT true NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


--
-- Name: PlanCapability; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."PlanCapability" (
    id text NOT NULL,
    "planId" text NOT NULL,
    "capabilityId" text NOT NULL,
    enabled boolean,
    "limit" integer,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


--
-- Name: PlatformAdmin; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."PlatformAdmin" (
    id text NOT NULL,
    "userId" text NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


--
-- Name: PlatformConsentEvent; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."PlatformConsentEvent" (
    id text NOT NULL,
    "tenantId" text,
    "userId" text NOT NULL,
    "documentVersionId" text NOT NULL,
    action text NOT NULL,
    source text DEFAULT ''::text NOT NULL,
    "technicalEvidence" jsonb DEFAULT '{}'::jsonb NOT NULL,
    "occurredAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    CONSTRAINT "PlatformConsentEvent_action_check" CHECK ((action = ANY (ARRAY['ACCEPTED'::text, 'ACKNOWLEDGED'::text, 'CONSENTED'::text, 'REVOKED'::text, 'DECLINED'::text])))
);


--
-- Name: PlatformDocument; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."PlatformDocument" (
    id text NOT NULL,
    key text NOT NULL,
    type text NOT NULL,
    title text NOT NULL,
    "requiredForRegistration" boolean DEFAULT false NOT NULL,
    "requiredForLive" boolean DEFAULT false NOT NULL,
    "requiredForPublicBooking" boolean DEFAULT false NOT NULL,
    "isActive" boolean DEFAULT true NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: PlatformDocumentVersion; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."PlatformDocumentVersion" (
    id text NOT NULL,
    "documentId" text NOT NULL,
    version integer NOT NULL,
    "contentSnapshot" text NOT NULL,
    "contentHash" text NOT NULL,
    "operatorIdentitySnapshot" jsonb DEFAULT '{}'::jsonb NOT NULL,
    "publishedAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "supersededAt" timestamp(3) without time zone,
    CONSTRAINT "PlatformDocumentVersion_version_check" CHECK ((version > 0))
);


--
-- Name: Profile; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."Profile" (
    id text NOT NULL,
    "tenantId" text NOT NULL,
    "userId" text NOT NULL,
    key text DEFAULT 'profile'::text NOT NULL,
    name text DEFAULT ''::text NOT NULL,
    surname text DEFAULT ''::text NOT NULL,
    phone text DEFAULT ''::text NOT NULL,
    phones jsonb NOT NULL,
    telegrams jsonb NOT NULL,
    emails jsonb NOT NULL,
    about text DEFAULT ''::text NOT NULL,
    photo text DEFAULT ''::text NOT NULL,
    profession text DEFAULT ''::text NOT NULL,
    experience text DEFAULT ''::text NOT NULL,
    "professionAbout" text DEFAULT ''::text NOT NULL,
    "customProfessions" jsonb NOT NULL,
    "migrationVerifiedAt" timestamp(3) without time zone,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


--
-- Name: TelegramBotConnection; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."TelegramBotConnection" (
    id text NOT NULL,
    "tenantId" text NOT NULL,
    "botId" text NOT NULL,
    "botUsername" text DEFAULT ''::text NOT NULL,
    "encryptedToken" text NOT NULL,
    "tokenIv" text NOT NULL,
    "tokenTag" text NOT NULL,
    "webhookKey" text NOT NULL,
    "webhookSecretHash" text NOT NULL,
    status text DEFAULT 'connected'::text NOT NULL,
    "connectedAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: TelegramEntryTicket; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."TelegramEntryTicket" (
    id text NOT NULL,
    "tenantId" text NOT NULL,
    "tokenHash" text NOT NULL,
    "telegramUserId" text NOT NULL,
    username text DEFAULT ''::text NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "expiresAt" timestamp(3) without time zone NOT NULL,
    "usedAt" timestamp(3) without time zone
);


--
-- Name: Tenant; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."Tenant" (
    id text NOT NULL,
    name text NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


--
-- Name: TenantAccess; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."TenantAccess" (
    "tenantId" text NOT NULL,
    "planId" text,
    status public."TenantAccessStatus" DEFAULT 'ACTIVE'::public."TenantAccessStatus" NOT NULL,
    "isOwnerBook" boolean DEFAULT false NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


--
-- Name: TenantCapabilityOverride; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."TenantCapabilityOverride" (
    id text NOT NULL,
    "tenantId" text NOT NULL,
    "capabilityId" text NOT NULL,
    enabled boolean,
    "limit" integer,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


--
-- Name: TenantConsentEvent; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."TenantConsentEvent" (
    id text NOT NULL,
    "tenantId" text NOT NULL,
    "subjectType" text NOT NULL,
    "subjectKey" text NOT NULL,
    "contactType" text DEFAULT ''::text NOT NULL,
    "contactValue" text DEFAULT ''::text NOT NULL,
    "documentId" text NOT NULL,
    "documentVersion" integer DEFAULT 1 NOT NULL,
    status text NOT NULL,
    "acceptedAt" timestamp(3) without time zone,
    "revokedAt" timestamp(3) without time zone,
    source text DEFAULT ''::text NOT NULL,
    "occurredAt" timestamp(3) without time zone NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    CONSTRAINT "TenantConsentEvent_status_check" CHECK ((status = ANY (ARRAY['accepted'::text, 'revoked'::text, 'declined'::text]))),
    CONSTRAINT "TenantConsentEvent_subjectType_check" CHECK (("subjectType" = ANY (ARRAY['BOOKING_ACCOUNT'::text, 'CONTACT_POINT'::text])))
);


--
-- Name: TenantDocumentArchive; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."TenantDocumentArchive" (
    id text NOT NULL,
    "tenantId" text NOT NULL,
    data jsonb NOT NULL,
    "migrationVerifiedAt" timestamp(3) without time zone,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


--
-- Name: User; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."User" (
    id text NOT NULL,
    email text NOT NULL,
    "passwordHash" text NOT NULL,
    "onboardingStep" integer DEFAULT 0 NOT NULL,
    "workspaceUnlocked" boolean DEFAULT false NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


--
-- Name: WebPushSubscription; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."WebPushSubscription" (
    id text NOT NULL,
    "tenantId" text NOT NULL,
    "accountId" text NOT NULL,
    endpoint text NOT NULL,
    p256dh text NOT NULL,
    auth text NOT NULL,
    "userAgent" text DEFAULT ''::text NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: Workplace; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."Workplace" (
    id text NOT NULL,
    "tenantId" text NOT NULL,
    "profileId" text NOT NULL,
    key text NOT NULL,
    "position" integer DEFAULT 0 NOT NULL,
    photo text DEFAULT ''::text NOT NULL,
    name text DEFAULT ''::text NOT NULL,
    color text DEFAULT ''::text NOT NULL,
    city text DEFAULT ''::text NOT NULL,
    address text DEFAULT ''::text NOT NULL,
    phone text DEFAULT ''::text NOT NULL,
    currency text DEFAULT 'RUB'::text NOT NULL,
    "from" text DEFAULT '09:00'::text NOT NULL,
    "to" text DEFAULT '18:00'::text NOT NULL,
    links jsonb NOT NULL,
    about text DEFAULT ''::text NOT NULL,
    "sourceCreatedAt" text DEFAULT ''::text NOT NULL,
    "sourceUpdatedAt" text DEFAULT ''::text NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


--
-- Name: WorkspaceState; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."WorkspaceState" (
    id text NOT NULL,
    "tenantId" text NOT NULL,
    "userId" text NOT NULL,
    data jsonb NOT NULL,
    revision integer DEFAULT 1 NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


--
-- Name: BookingAccount BookingAccount_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."BookingAccount"
    ADD CONSTRAINT "BookingAccount_pkey" PRIMARY KEY (id);


--
-- Name: BookingPublication BookingPublication_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."BookingPublication"
    ADD CONSTRAINT "BookingPublication_pkey" PRIMARY KEY (id);


--
-- Name: BookingRequest BookingRequest_