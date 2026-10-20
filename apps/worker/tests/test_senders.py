"""Hallazgos 1 y 2: remitentes separados por coma y sin Bancolombia fijo."""

from datetime import datetime, timedelta, timezone

import pytest

from worker.providers.senders import gmail_query, outlook_filter, split_senders

BANCOLOMBIA = ("alertasynotificaciones@notificacionesbancolombia.com,alertasynotificaciones@bancolombia.com.co,"
               "alertasynotificaciones@an.notificacionesbancolombia.com")
SINCE = datetime(2026, 10, 17, 8, 0, tzinfo=timezone.utc)


def test_split_senders():
    assert split_senders(BANCOLOMBIA) == [
        "alertasynotificaciones@notificacionesbancolombia.com",
        "alertasynotificaciones@bancolombia.com.co",
        "alertasynotificaciones@an.notificacionesbancolombia.com",
    ]
    assert split_senders(" nu@nu.com.co ") == ["nu@nu.com.co"]
    assert split_senders("a@x.co,,b@y.co, A@X.CO") == ["a@x.co", "b@y.co"]
    assert split_senders("") == [] and split_senders(None) == []


def test_gmail_query_uses_every_sender_and_exact_time():
    query = gmail_query(split_senders(BANCOLOMBIA), SINCE)
    assert query == (
        "from:(alertasynotificaciones@notificacionesbancolombia.com OR alertasynotificaciones@bancolombia.com.co "
        "OR alertasynotificaciones@an.notificacionesbancolombia.com) after:1792224000"
    )


def test_gmail_query_never_adds_bancolombia_to_other_banks():
    # antes: from:('nu@nu.com.co OR alertasynotificaciones@bancolombia.com.co')
    query = gmail_query(split_senders("nu@nu.com.co"), SINCE)
    assert query == "from:(nu@nu.com.co) after:1792224000"
    assert "bancolombia" not in query


def test_gmail_query_before():
    query = gmail_query(["a@x.co"], SINCE, SINCE + timedelta(days=1))
    assert query.endswith("after:1792224000 before:1792310400")


def test_outlook_filter_with_several_senders():
    rappi = "rappi.nreply@rappi.com,noreply@rappicard.co,noreply@rappipay.co"
    assert outlook_filter(split_senders(rappi), SINCE) == (
        "(from/emailAddress/address eq 'rappi.nreply@rappi.com' or from/emailAddress/address eq 'noreply@rappicard.co' "
        "or from/emailAddress/address eq 'noreply@rappipay.co') and receivedDateTime ge 2026-10-17T08:00:00Z"
    )


def test_outlook_filter_converts_to_utc_and_escapes_quotes():
    bogota = timezone(timedelta(hours=-5))
    result = outlook_filter(["o'brien@x.co"], datetime(2026, 10, 17, 3, 0, tzinfo=bogota))
    assert result == "(from/emailAddress/address eq 'o''brien@x.co') and receivedDateTime ge 2026-10-17T08:00:00Z"


def test_empty_senders_rejected():
    with pytest.raises(ValueError):
        gmail_query([], SINCE)
    with pytest.raises(ValueError):
        outlook_filter([], SINCE)
