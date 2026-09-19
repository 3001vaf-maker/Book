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
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP 