-- Esquema de producción en la versión 17 (la del dump del 17-oct), SIN datos de usuarios.
-- Solo para el CI: Postgres vacío + este archivo + la API migra 18 → 21, igual que en producción
-- (las migraciones 1–17 usan pg_cron, que solo existía en RDS, y no corren en una base vacía).
-- Incluye: el schema public sin pg_cron, schema_migrations = 17, el catálogo global account_types
-- y el REFRESH (vacío) de las vistas materializadas. Generado con pg_restore --no-owner --no-acl
-- y una lista del TOC sin las TABLE DATA de accounts, banks, categories, emails, transactions y user_extra.
-- No editar a mano. No usar para restaurar producción (para eso: infra/scripts/prod/restore-prod.sh).

--
-- PostgreSQL database dump
--


-- Dumped from database version 16.13
-- Dumped by pg_dump version 16.15 (Homebrew)

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
-- Name: whatsapp_state_enum; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.whatsapp_state_enum AS ENUM (
    'verified',
    'failed',
    'pending',
    'blocked'
);


SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: account_types; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.account_types (
    id bigint NOT NULL,
    name character varying(255) NOT NULL,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: account_types_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.account_types_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: account_types_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.account_types_id_seq OWNED BY public.account_types.id;


--
-- Name: accounts; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.accounts (
    id bigint NOT NULL,
    user_id character varying(255) NOT NULL,
    bank_id bigint NOT NULL,
    type_id bigint NOT NULL,
    name character varying(255) NOT NULL,
    last_four_digits character varying(4) NOT NULL,
    initial_balance numeric(10,2) NOT NULL,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    email_id bigint
);


--
-- Name: accounts_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.accounts_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: accounts_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.accounts_id_seq OWNED BY public.accounts.id;


--
-- Name: transactions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.transactions (
    id bigint NOT NULL,
    user_id character varying(255) NOT NULL,
    category_id bigint NOT NULL,
    account_id bigint NOT NULL,
    description character varying(255) NOT NULL,
    expense boolean NOT NULL,
    amount numeric(10,2) NOT NULL,
    date timestamp with time zone NOT NULL,
    automated boolean DEFAULT false NOT NULL,
    should_verify boolean DEFAULT false NOT NULL,
    checked boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    raw_description character varying(255)
);


--
-- Name: user_extra; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.user_extra (
    id bigint NOT NULL,
    user_id character varying(255) NOT NULL,
    utc_offset character varying(255) NOT NULL,
    whatsapp character varying(255) NOT NULL,
    whatsapp_state public.whatsapp_state_enum DEFAULT 'pending'::public.whatsapp_state_enum NOT NULL,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    onboarding_completed boolean DEFAULT false NOT NULL,
    onboarding_created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    email character varying(255) DEFAULT ''::character varying NOT NULL,
    name character varying(255) DEFAULT ''::character varying NOT NULL,
    last_name character varying(255) DEFAULT ''::character varying NOT NULL,
    read_email boolean DEFAULT false NOT NULL,
    config jsonb DEFAULT '{}'::jsonb NOT NULL
);


--
-- Name: balance_by_date; Type: MATERIALIZED VIEW; Schema: public; Owner: -
--

CREATE MATERIALIZED VIEW public.balance_by_date AS
 SELECT t.user_id,
    ((t.date AT TIME ZONE COALESCE(u.utc_offset, 'UTC'::character varying)))::date AS date,
    t.account_id,
    a.type_id,
    (sum(
        CASE
            WHEN (t.expense IS FALSE) THEN t.amount
            ELSE (0)::numeric
        END) - sum(
        CASE
            WHEN (t.expense IS TRUE) THEN t.amount
            ELSE (0)::numeric
        END)) AS balance,
    CURRENT_TIMESTAMP AS updated_at
   FROM ((public.transactions t
     LEFT JOIN public.accounts a ON ((a.id = t.account_id)))
     LEFT JOIN public.user_extra u ON (((t.user_id)::text = (u.user_id)::text)))
  GROUP BY t.user_id, (((t.date AT TIME ZONE COALESCE(u.utc_offset, 'UTC'::character varying)))::date), t.account_id, a.type_id
  ORDER BY t.user_id, (((t.date AT TIME ZONE COALESCE(u.utc_offset, 'UTC'::character varying)))::date) DESC, t.account_id
  WITH NO DATA;


--
-- Name: banks; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.banks (
    id bigint NOT NULL,
    name character varying(255) NOT NULL,
    email character varying(255),
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    user_id character varying(255) NOT NULL
);


--
-- Name: banks_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.banks_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: banks_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.banks_id_seq OWNED BY public.banks.id;


--
-- Name: categories; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.categories (
    id bigint NOT NULL,
    user_id character varying(255) NOT NULL,
    name character varying(255) NOT NULL,
    budget double precision NOT NULL,
    is_editable boolean DEFAULT true NOT NULL,
    emoji character varying(255) NOT NULL,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    income boolean DEFAULT false NOT NULL
);


--
-- Name: categories_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.categories_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: categories_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.categories_id_seq OWNED BY public.categories.id;


--
-- Name: category_predictions; Type: MATERIALIZED VIEW; Schema: public; Owner: -
--

CREATE MATERIALIZED VIEW public.category_predictions AS
 SELECT t.user_id,
    t.raw_description,
    t.category_id,
    c.name AS category_name,
    count(*) AS frequency,
    round((((count(*))::numeric * 100.0) / sum(count(*)) OVER (PARTITION BY t.user_id, t.raw_description)), 2) AS relative_frequency_percent,
    CURRENT_TIMESTAMP AS updated_at
   FROM (public.transactions t
     LEFT JOIN public.categories c ON (((c.id = t.category_id) AND ((c.user_id)::text = (t.user_id)::text))))
  WHERE ((t.raw_description IS NOT NULL) AND ((t.raw_description)::text <> ''::text))
  GROUP BY t.user_id, t.raw_description, t.category_id, c.name
 HAVING (count(*) > 1)
  ORDER BY t.user_id, t.raw_description, (count(*)) DESC
  WITH NO DATA;


--
-- Name: curated_initial_balance; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.curated_initial_balance AS
 SELECT a.user_id,
    COALESCE(u.utc_offset, 'UTC'::character varying) AS utc_offset,
    ((a.created_at AT TIME ZONE COALESCE(u.utc_offset, 'UTC'::character varying)))::date AS date,
    sum(
        CASE
            WHEN (a.type_id = ANY (ARRAY[(1)::bigint, (2)::bigint, (3)::bigint])) THEN a.initial_balance
            ELSE (0)::numeric
        END) AS savings_initial_balance,
    sum(
        CASE
            WHEN (a.type_id = 4) THEN a.initial_balance
            ELSE (0)::numeric
        END) AS credits_initial_balance
   FROM (public.accounts a
     LEFT JOIN public.user_extra u ON (((a.user_id)::text = (u.user_id)::text)))
  GROUP BY a.user_id, u.utc_offset, (((a.created_at AT TIME ZONE COALESCE(u.utc_offset, 'UTC'::character varying)))::date);


--
-- Name: curated_transactions; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.curated_transactions AS
 SELECT ((t.date AT TIME ZONE COALESCE(u.utc_offset, 'UTC'::character varying)))::date AS date,
    t.user_id,
    COALESCE(u.utc_offset, 'UTC'::character varying) AS utc_offset,
    (((
        CASE
            WHEN t.expense THEN '-1'::integer
            ELSE 1
        END)::numeric * t.amount) * (
        CASE
            WHEN ((c.income IS TRUE) AND (a.type_id = ANY (ARRAY[(1)::bigint, (2)::bigint, (3)::bigint]))) THEN 1
            ELSE 0
        END)::numeric) AS income,
    (((
        CASE
            WHEN t.expense THEN '-1'::integer
            ELSE 1
        END)::numeric * t.amount) * (
        CASE
            WHEN ((c.income IS FALSE) AND (a.type_id = ANY (ARRAY[(1)::bigint, (2)::bigint, (4)::bigint]))) THEN 1
            ELSE 0
        END)::numeric) AS expense,
    (((
        CASE
            WHEN t.expense THEN '-1'::integer
            ELSE 1
        END)::numeric * t.amount) * (
        CASE
            WHEN ((c.income IS FALSE) AND (a.type_id = ANY (ARRAY[(1)::bigint, (2)::bigint, (3)::bigint]))) THEN 1
            ELSE 0
        END)::numeric) AS savings_expense,
    (((
        CASE
            WHEN t.expense THEN '-1'::integer
            ELSE 1
        END)::numeric * t.amount) * (
        CASE
            WHEN ((c.income IS FALSE) AND (a.type_id = 4)) THEN 1
            ELSE 0
        END)::numeric) AS debt
   FROM (((public.transactions t
     LEFT JOIN public.accounts a ON (((a.id = t.account_id) AND ((a.user_id)::text = (t.user_id)::text))))
     LEFT JOIN public.user_extra u ON (((t.user_id)::text = (u.user_id)::text)))
     LEFT JOIN public.categories c ON ((t.category_id = c.id)));


--
-- Name: curated_transactions_by_accounts; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.curated_transactions_by_accounts AS
 SELECT t.user_id,
    t.account_id,
    a.name AS account_name,
    ((t.date AT TIME ZONE COALESCE(u.utc_offset, 'UTC'::character varying)))::date AS date,
    COALESCE(u.utc_offset, 'UTC'::character varying) AS utc_offset,
    ((
        CASE
            WHEN t.expense THEN 0
            ELSE 1
        END)::numeric * t.amount) AS income,
    ((
        CASE
            WHEN t.expense THEN '-1'::integer
            ELSE 0
        END)::numeric * t.amount) AS expense
   FROM (((public.transactions t
     LEFT JOIN public.accounts a ON (((a.id = t.account_id) AND ((a.user_id)::text = (t.user_id)::text))))
     LEFT JOIN public.user_extra u ON (((t.user_id)::text = (u.user_id)::text)))
     LEFT JOIN public.categories c ON ((t.category_id = c.id)));


--
-- Name: initial_balance_by_accounts; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.initial_balance_by_accounts AS
 SELECT a.user_id,
    a.id AS account_id,
    a.name AS account_name,
    a.initial_balance,
    ((a.created_at AT TIME ZONE COALESCE(u.utc_offset, 'UTC'::character varying)))::date AS date
   FROM (public.accounts a
     LEFT JOIN public.user_extra u ON (((a.user_id)::text = (u.user_id)::text)));


--
-- Name: daily_accounts_report_summary; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.daily_accounts_report_summary AS
 SELECT COALESCE(c.user_id, i.user_id) AS user_id,
    COALESCE(c.date, i.date) AS date,
    COALESCE(c.account_id, i.account_id) AS account_id,
    COALESCE(c.account_name, i.account_name) AS account_name,
    EXTRACT(year FROM COALESCE(c.date, i.date)) AS year,
    EXTRACT(month FROM COALESCE(c.date, i.date)) AS month,
    COALESCE(i.initial_balance, (0)::numeric) AS initial_balance,
    COALESCE(c.income, (0)::numeric) AS income,
    COALESCE(c.expense, (0)::numeric) AS expense,
    ((COALESCE(i.initial_balance, (0)::numeric) + COALESCE(c.income, (0)::numeric)) + COALESCE(c.expense, (0)::numeric)) AS balance
   FROM (public.curated_transactions_by_accounts c
     FULL JOIN public.initial_balance_by_accounts i ON ((((c.user_id)::text = (i.user_id)::text) AND (c.account_id = i.account_id) AND (c.date = i.date))));


--
-- Name: financial_summary_by_day; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.financial_summary_by_day AS
 SELECT COALESCE(ct.user_id, ci.user_id) AS user_id,
    COALESCE(ct.date, ci.date) AS date,
    EXTRACT(year FROM COALESCE(ct.date, ci.date)) AS year,
    EXTRACT(month FROM COALESCE(ct.date, ci.date)) AS month,
    COALESCE(ct.utc_offset, ci.utc_offset) AS utc_offset,
    sum(COALESCE(ct.income, (0)::numeric)) AS income,
    sum(COALESCE(ct.expense, (0)::numeric)) AS expense,
    (sum(COALESCE(ct.income, (0)::numeric)) + sum(COALESCE(ct.expense, (0)::numeric))) AS savings,
    ((sum(COALESCE(ct.income, (0)::numeric)) + sum(COALESCE(ct.savings_expense, (0)::numeric))) + COALESCE(max(ci.savings_initial_balance), (0)::numeric)) AS savings_balance,
    sum((COALESCE(ct.debt, (0)::numeric) + COALESCE(ci.credits_initial_balance, (0)::numeric))) AS credits_balance
   FROM (public.curated_transactions ct
     FULL JOIN public.curated_initial_balance ci ON (((ci.date = ct.date) AND ((ci.user_id)::text = (ct.user_id)::text))))
  GROUP BY ct.user_id, ci.user_id, ct.date, ci.date, ct.utc_offset, ci.utc_offset
 HAVING (EXTRACT(year FROM COALESCE(ct.date, ci.date)) >= EXTRACT(year FROM (CURRENT_DATE - '1 year'::interval)));


--
-- Name: date_series; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.date_series AS
 SELECT user_id,
    (generate_series((min_date)::timestamp without time zone, (now() AT TIME ZONE utc_offset), '1 day'::interval))::date AS date
   FROM ( SELECT financial_summary_by_day.user_id,
            financial_summary_by_day.utc_offset,
            min(financial_summary_by_day.date) AS min_date
           FROM public.financial_summary_by_day
          GROUP BY financial_summary_by_day.user_id, financial_summary_by_day.utc_offset) min_date;


--
-- Name: daily_financial_summary; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.daily_financial_summary AS
 SELECT ds.user_id,
    ds.date,
    COALESCE(fsb.year, EXTRACT(year FROM ds.date)) AS year,
    COALESCE(fsb.month, EXTRACT(month FROM ds.date)) AS month,
    COALESCE(fsb.income, (0)::numeric) AS income,
    COALESCE(fsb.expense, (0)::numeric) AS expense,
    COALESCE(fsb.savings, (0)::numeric) AS savings,
    COALESCE(fsb.savings_balance, (0)::numeric) AS savings_balance,
    COALESCE(fsb.credits_balance, (0)::numeric) AS credits_balance
   FROM (public.date_series ds
     LEFT JOIN public.financial_summary_by_day fsb ON ((((ds.user_id)::text = (fsb.user_id)::text) AND (ds.date = fsb.date))));


--
-- Name: daily_full_financial_summary; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.daily_full_financial_summary AS
 SELECT user_id,
    date,
    income,
    expense,
    sum(income) OVER (PARTITION BY user_id, year, month ORDER BY date) AS mtd_income,
    sum(expense) OVER (PARTITION BY user_id, year, month ORDER BY date) AS mtd_expense,
    sum(savings) OVER (PARTITION BY user_id, year, month ORDER BY date) AS mtd_savings
   FROM public.daily_financial_summary;


--
-- Name: daily_rolling_balance; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.daily_rolling_balance AS
 SELECT user_id,
    date,
    sum(savings_balance) OVER (PARTITION BY user_id ORDER BY date) AS savings_balance,
    sum(credits_balance) OVER (PARTITION BY user_id ORDER BY date) AS credits_balance
   FROM public.daily_financial_summary;


--
-- Name: daily_analysis; Type: MATERIALIZED VIEW; Schema: public; Owner: -
--

CREATE MATERIALIZED VIEW public.daily_analysis AS
 SELECT drb.user_id,
    drb.date,
    dfs.income,
    dfs.expense,
    dfs.mtd_income,
    dfs.mtd_expense,
    dfs.mtd_savings,
    drb.savings_balance AS running_savings_balance,
    drb.credits_balance AS running_credits_balance,
    CURRENT_TIMESTAMP AS updated_at
   FROM (public.daily_rolling_balance drb
     JOIN public.daily_full_financial_summary dfs ON ((((drb.user_id)::text = (dfs.user_id)::text) AND (drb.date = dfs.date))))
  WITH NO DATA;


--
-- Name: emails; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.emails (
    id bigint NOT NULL,
    user_id character varying(255) NOT NULL,
    email character varying(255) NOT NULL,
    access_token character varying(2000) NOT NULL,
    refresh_token character varying(2000) NOT NULL,
    token_type character varying(50) NOT NULL,
    active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    provider character varying(50) NOT NULL,
    error character varying(50)
);


--
-- Name: emails_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

ALTER TABLE public.emails ALTER COLUMN id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME public.emails_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: last_month_balance; Type: MATERIALIZED VIEW; Schema: public; Owner: -
--

CREATE MATERIALIZED VIEW public.last_month_balance AS
 SELECT t.user_id,
    t.account_id,
    a.type_id,
    (sum(
        CASE
            WHEN (t.expense IS FALSE) THEN t.amount
            ELSE (0)::numeric
        END) - sum(
        CASE
            WHEN (t.expense IS TRUE) THEN t.amount
            ELSE (0)::numeric
        END)) AS balance,
    CURRENT_TIMESTAMP AS updated_at
   FROM ((public.transactions t
     LEFT JOIN public.accounts a ON ((a.id = t.account_id)))
     LEFT JOIN public.user_extra u ON (((t.user_id)::text = (u.user_id)::text)))
  WHERE (((t.date AT TIME ZONE COALESCE(u.utc_offset, 'UTC'::character varying)))::date < (date_trunc('month'::text, (now() AT TIME ZONE COALESCE(u.utc_offset, 'UTC'::character varying))))::date)
  GROUP BY t.user_id, t.account_id, a.type_id
  WITH NO DATA;


--
-- Name: monthly_accounts_summary; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.monthly_accounts_summary AS
 SELECT user_id,
    year,
    month,
    account_id,
    account_name,
    sum(balance) AS balance,
    COALESCE(lag(sum(balance), 1, NULL::numeric) OVER (PARTITION BY user_id, account_id ORDER BY year, month), (0)::numeric) AS balance_past
   FROM public.daily_accounts_report_summary
  GROUP BY user_id, year, month, account_id, account_name;


--
-- Name: monthly_accounts_analysis; Type: MATERIALIZED VIEW; Schema: public; Owner: -
--

CREATE MATERIALIZED VIEW public.monthly_accounts_analysis AS
 SELECT m.user_id,
    m.year,
    m.month,
    m.account_id,
    a.type_id,
    m.account_name,
    sum(m.balance) OVER (PARTITION BY m.user_id, m.account_id ORDER BY m.year, m.month) AS balance,
    sum(m.balance_past) OVER (PARTITION BY m.user_id, m.account_id ORDER BY m.year, m.month) AS balance_past
   FROM (public.monthly_accounts_summary m
     LEFT JOIN public.accounts a ON ((((m.user_id)::text = (a.user_id)::text) AND (m.account_id = a.id))))
  ORDER BY m.user_id, m.account_id, m.account_name, m.year, m.month
  WITH NO DATA;


--
-- Name: monthly_financial_summary; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.monthly_financial_summary AS
 SELECT user_id,
    year,
    month,
    sum(income) AS income,
    sum(expense) AS expense,
    sum(savings) AS savings,
    sum(savings_balance) AS savings_balance,
    sum(credits_balance) AS credits_balance,
    COALESCE(lag(sum(income), 1, NULL::numeric) OVER (PARTITION BY user_id ORDER BY year, month), (0)::numeric) AS income_past,
    COALESCE(lag(sum(expense), 1, NULL::numeric) OVER (PARTITION BY user_id ORDER BY year, month), (0)::numeric) AS expense_past,
    COALESCE(lag(sum(savings), 1, NULL::numeric) OVER (PARTITION BY user_id ORDER BY year, month), (0)::numeric) AS savings_past
   FROM public.daily_financial_summary
  GROUP BY user_id, year, month
  ORDER BY user_id, year, month DESC;


--
-- Name: monthly_rolling_balance_base; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.monthly_rolling_balance_base AS
 SELECT user_id,
    year,
    month,
    sum(savings_balance) OVER (PARTITION BY user_id ORDER BY year, month) AS savings_balance,
    sum(credits_balance) OVER (PARTITION BY user_id ORDER BY year, month) AS credits_balance
   FROM public.monthly_financial_summary;


--
-- Name: monthly_rolling_balance; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.monthly_rolling_balance AS
 SELECT user_id,
    year,
    month,
    savings_balance,
    COALESCE(lag(savings_balance) OVER (PARTITION BY user_id ORDER BY year, month), (0)::numeric) AS savings_balance_past,
    credits_balance,
    COALESCE(lag(credits_balance) OVER (PARTITION BY user_id ORDER BY year, month), (0)::numeric) AS credits_balance_past
   FROM public.monthly_rolling_balance_base;


--
-- Name: monthly_analysis; Type: MATERIALIZED VIEW; Schema: public; Owner: -
--

CREATE MATERIALIZED VIEW public.monthly_analysis AS
 SELECT mfs.user_id,
    mfs.year,
    mfs.month,
    mfs.income,
    mfs.income_past,
    mfs.expense,
    mfs.expense_past,
    mfs.savings,
    mfs.savings_past,
    mrb.savings_balance AS running_savings_balance,
    mrb.savings_balance_past AS running_savings_balance_past,
    mrb.credits_balance AS running_credits_balance,
    mrb.credits_balance_past AS running_credits_balance_past,
    CURRENT_TIMESTAMP AS updated_at
   FROM (public.monthly_financial_summary mfs
     JOIN public.monthly_rolling_balance mrb ON ((((mfs.user_id)::text = (mrb.user_id)::text) AND (mfs.year = mrb.year) AND (mfs.month = mrb.month))))
  WITH NO DATA;


--
-- Name: schema_migrations; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.schema_migrations (
    version bigint NOT NULL,
    dirty boolean NOT NULL
);


--
-- Name: transactions_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

ALTER TABLE public.transactions ALTER COLUMN id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME public.transactions_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: user_extra_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.user_extra_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: user_extra_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.user_extra_id_seq OWNED BY public.user_extra.id;


--
-- Name: account_types id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.account_types ALTER COLUMN id SET DEFAULT nextval('public.account_types_id_seq'::regclass);


--
-- Name: accounts id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.accounts ALTER COLUMN id SET DEFAULT nextval('public.accounts_id_seq'::regclass);


--
-- Name: banks id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.banks ALTER COLUMN id SET DEFAULT nextval('public.banks_id_seq'::regclass);


--
-- Name: categories id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.categories ALTER COLUMN id SET DEFAULT nextval('public.categories_id_seq'::regclass);


--
-- Name: user_extra id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_extra ALTER COLUMN id SET DEFAULT nextval('public.user_extra_id_seq'::regclass);


--
-- Data for Name: account_types; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.account_types (id, name, created_at, updated_at) FROM stdin;
1	Cuenta Ahorros	2025-07-27 13:48:24.079934+00	2025-07-27 13:48:24.079934+00
2	Cuenta Corriente	2025-07-27 13:48:34.418401+00	2025-07-27 13:48:34.418401+00
3	Inversión	2025-07-27 13:48:43.275185+00	2025-07-27 13:48:43.275185+00
4	Tarjeta de Crédito	2025-07-27 13:48:58.888172+00	2025-07-27 13:48:58.888172+00
\.


--
-- Data for Name: schema_migrations; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.schema_migrations (version, dirty) FROM stdin;
17	f
\.


--
-- Name: account_types_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.account_types_id_seq', 4, true);


--
-- Name: account_types account_types_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.account_types
    ADD CONSTRAINT account_types_pkey PRIMARY KEY (id);


--
-- Name: accounts accounts_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.accounts
    ADD CONSTRAINT accounts_pkey PRIMARY KEY (id);


--
-- Name: banks banks_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.banks
    ADD CONSTRAINT banks_pkey PRIMARY KEY (id);


--
-- Name: categories categories_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.categories
    ADD CONSTRAINT categories_pkey PRIMARY KEY (id);


--
-- Name: emails emails_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.emails
    ADD CONSTRAINT emails_pkey PRIMARY KEY (id);


--
-- Name: schema_migrations schema_migrations_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.schema_migrations
    ADD CONSTRAINT schema_migrations_pkey PRIMARY KEY (version);


--
-- Name: transactions transactions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.transactions
    ADD CONSTRAINT transactions_pkey PRIMARY KEY (id);


--
-- Name: accounts unique_account; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.accounts
    ADD CONSTRAINT unique_account UNIQUE (id, user_id);


--
-- Name: account_types unique_account_name; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.account_types
    ADD CONSTRAINT unique_account_name UNIQUE (name);


--
-- Name: account_types unique_account_type; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.account_types
    ADD CONSTRAINT unique_account_type UNIQUE (id, name);


--
-- Name: banks unique_bank; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.banks
    ADD CONSTRAINT unique_bank UNIQUE (id, user_id);


--
-- Name: categories unique_category; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.categories
    ADD CONSTRAINT unique_category UNIQUE (id, user_id);


--
-- Name: emails unique_email; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.emails
    ADD CONSTRAINT unique_email UNIQUE (id, user_id);


--
-- Name: accounts unique_user_account; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.accounts
    ADD CONSTRAINT unique_user_account UNIQUE (user_id, bank_id, last_four_digits);


--
-- Name: banks unique_user_bank; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.banks
    ADD CONSTRAINT unique_user_bank UNIQUE (user_id, name, email);


--
-- Name: categories unique_user_category; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.categories
    ADD CONSTRAINT unique_user_category UNIQUE (user_id, name);


--
-- Name: emails unique_user_email; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.emails
    ADD CONSTRAINT unique_user_email UNIQUE (user_id, email);


--
-- Name: user_extra unique_user_extra; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_extra
    ADD CONSTRAINT unique_user_extra UNIQUE (user_id);


--
-- Name: user_extra user_extra_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_extra
    ADD CONSTRAINT user_extra_pkey PRIMARY KEY (id);


--
-- Name: account_type_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX account_type_idx ON public.account_types USING btree (id);


--
-- Name: account_user; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX account_user ON public.accounts USING btree (user_id);


--
-- Name: category_user; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX category_user ON public.categories USING btree (user_id);


--
-- Name: daily_analysis_user_id_date_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX daily_analysis_user_id_date_idx ON public.daily_analysis USING btree (user_id, date);


--
-- Name: idx_balance_by_date; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX idx_balance_by_date ON public.balance_by_date USING btree (user_id, account_id, date);


--
-- Name: idx_bank; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_bank ON public.banks USING btree (id);


--
-- Name: idx_category_predictions_unique; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX idx_category_predictions_unique ON public.category_predictions USING btree (user_id, raw_description, category_id);


--
-- Name: idx_last_month_balance; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX idx_last_month_balance ON public.last_month_balance USING btree (user_id, account_id);


--
-- Name: idx_transactions_raw_description; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_transactions_raw_description ON public.transactions USING btree (user_id, raw_description);


--
-- Name: monthly_accounts_analysis_user_account_date_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX monthly_accounts_analysis_user_account_date_idx ON public.monthly_accounts_analysis USING btree (user_id, account_id, year, month);


--
-- Name: monthly_analysis_user_id_year_month_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX monthly_analysis_user_id_year_month_idx ON public.monthly_analysis USING btree (user_id, year, month);


--
-- Name: transaction_user; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX transaction_user ON public.transactions USING btree (user_id, date);


--
-- Name: user_email; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX user_email ON public.emails USING btree (user_id);


--
-- Name: user_extra_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX user_extra_user_id ON public.user_extra USING btree (user_id);


--
-- Name: transactions FK_ACCOUNT_TRANSACTION; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.transactions
    ADD CONSTRAINT "FK_ACCOUNT_TRANSACTION" FOREIGN KEY (account_id, user_id) REFERENCES public.accounts(id, user_id) ON UPDATE CASCADE;


--
-- Name: transactions FK_CATEGORY_TRANSACTION; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.transactions
    ADD CONSTRAINT "FK_CATEGORY_TRANSACTION" FOREIGN KEY (category_id, user_id) REFERENCES public.categories(id, user_id) ON UPDATE CASCADE;


--
-- Name: accounts fk_bank_account; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.accounts
    ADD CONSTRAINT fk_bank_account FOREIGN KEY (bank_id, user_id) REFERENCES public.banks(id, user_id) ON UPDATE CASCADE;


--
-- Name: accounts fk_email_account; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.accounts
    ADD CONSTRAINT fk_email_account FOREIGN KEY (email_id, user_id) REFERENCES public.emails(id, user_id) ON UPDATE CASCADE;


--
-- Name: accounts fk_type_account; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.accounts
    ADD CONSTRAINT fk_type_account FOREIGN KEY (type_id) REFERENCES public.account_types(id) ON UPDATE CASCADE;


--
-- Name: balance_by_date; Type: MATERIALIZED VIEW DATA; Schema: public; Owner: -
--

REFRESH MATERIALIZED VIEW public.balance_by_date;


--
-- Name: category_predictions; Type: MATERIALIZED VIEW DATA; Schema: public; Owner: -
--

REFRESH MATERIALIZED VIEW public.category_predictions;


--
-- Name: daily_analysis; Type: MATERIALIZED VIEW DATA; Schema: public; Owner: -
--

REFRESH MATERIALIZED VIEW public.daily_analysis;


--
-- Name: last_month_balance; Type: MATERIALIZED VIEW DATA; Schema: public; Owner: -
--

REFRESH MATERIALIZED VIEW public.last_month_balance;


--
-- Name: monthly_accounts_analysis; Type: MATERIALIZED VIEW DATA; Schema: public; Owner: -
--

REFRESH MATERIALIZED VIEW public.monthly_accounts_analysis;


--
-- Name: monthly_analysis; Type: MATERIALIZED VIEW DATA; Schema: public; Owner: -
--

REFRESH MATERIALIZED VIEW public.monthly_analysis;


--
-- PostgreSQL database dump complete
--


