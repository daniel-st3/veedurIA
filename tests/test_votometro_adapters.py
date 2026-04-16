from __future__ import annotations

from unittest.mock import patch

from src.ingestion.votometro.camera_adapter import fetch_camera_directory
from src.ingestion.votometro.normalize import (
    build_initials,
    classify_topic,
    find_best_name_match,
    legislator_id,
    normalize_text,
    party_key,
    slugify,
)
from src.ingestion.votometro.senate_adapter import fetch_senate_payload
from src.ingestion.votometro.sync import _build_metrics


class DummyResponse:
    def __init__(self, payload):
        self._payload = payload

    def raise_for_status(self):
        return None

    def json(self):
        return self._payload


def test_normalization_helpers():
    assert normalize_text("María José Lozano") == "maria jose lozano"
    assert slugify("María José Lozano") == "maria-jose-lozano"
    assert build_initials("María José Lozano") == "MJ"
    assert legislator_id("senado", "María José Lozano") == "leg:senado:maria-jose-lozano:2022-2026"
    assert party_key("camara", "Cambio Radical") == "camara:cambio-radical"
    assert classify_topic("Proyecto de ley de reforma a la salud") == "salud"


def test_best_name_match_requires_threshold():
    options = [
        {"canonical_name": "María José Pizarro", "chamber": "senado", "party": "Pacto Histórico"},
        {"canonical_name": "Carlos Fernando Motoa", "chamber": "senado", "party": "Cambio Radical"},
    ]
    match = find_best_name_match(
        "Maria Jose Pizarro",
        options,
        chamber="senado",
        party="Pacto Historico",
        threshold=0.9,
    )
    assert match is not None
    assert match["canonical_name"] == "María José Pizarro"


@patch("src.ingestion.votometro.camera_adapter.get_optional_socrata_app_token", return_value=None)
@patch("src.ingestion.votometro.camera_adapter.requests.get")
def test_camera_adapter_maps_semantic_columns(mock_get, _mock_token):
    metadata = {
        "rowsUpdatedAt": 1743019199,
        "columns": [
            {"fieldName": "_", "name": "NOMBRES"},
            {"fieldName": "apelidos_y_nombre", "name": "CIRCUNSCRIPCIÓN"},
            {"fieldName": "partido_o_movimiento", "name": "PARTIDO O MOVIMIENTO"},
            {"fieldName": "circunscripcion", "name": "CORREO ELECTRÓNICO"},
            {"fieldName": "comision_const", "name": "OFICINA"},
            {"fieldName": "comision_legal", "name": "EXTENSIÓN"},
        ],
    }
    rows = [
        {
            "_": "Adriana Carolina Arbeláez Giraldo",
            "apelidos_y_nombre": "Bogotá",
            "partido_o_movimiento": "Cambio Radical",
            "circunscripcion": "carolina.arbelaez@camara.gov.co",
            "comision_const": "512 - 513 - Edificio Nuevo del Congreso",
            "comision_legal": "+(57) (601) 8770720 Ext: 3545",
        }
    ]
    mock_get.side_effect = [DummyResponse(metadata), DummyResponse(rows)]

    payload = fetch_camera_directory()

    assert payload["counts"]["members"] == 1
    member = payload["members"][0]
    assert member["canonical_name"] == "Adriana Carolina Arbeláez Giraldo"
    assert member["party"] == "Cambio Radical"
    assert member["contact"]["email"] == "carolina.arbelaez@camara.gov.co"
    assert member["term"]["circunscription"] == "Bogotá"


@patch("src.ingestion.votometro.senate_adapter.requests.get")
def test_senate_adapter_maps_roster_votes_and_socials(mock_get):
    senators = [
        {
            "id": 10,
            "name": "Chacón Camargo Alejandro Carlos",
            "party_name": "Liberal",
            "facebook": "ChaconDialoga",
            "twitter": "ChaconDialoga",
            "phone": "",
            "email": "alejandro.chaconc@senado.gov.co",
            "web": "https://www.senado.gov.co/perfil",
            "image": "https://app.senado.gov.co/backend/thumbnail/image.png",
            "commission_id": "1",
        }
    ]
    commissions = [{"id": 1, "name": "Comisión Primera Constitucional Permanente"}]
    votes = [
        {
            "plenary_id": 7,
            "created_at": "2017-02-14",
            "senator_id": "10",
            "senator_name": "Chacón Camargo Alejandro Carlos",
            "project_id": 3,
            "project_name": "Proyecto de ley de reforma a la salud",
            "vote": "Si",
        }
    ]
    assistances = [
        {
            "plenary_id": "1",
            "plenary_created_at": "2017-01-26",
            "senator_id": "10",
            "senator": "Chacón Camargo Alejandro Carlos",
            "attended": "Si",
        }
    ]
    mock_get.side_effect = [
        DummyResponse(senators),
        DummyResponse(commissions),
        DummyResponse(votes),
        DummyResponse(assistances),
    ]

    payload = fetch_senate_payload()

    assert payload["counts"]["members"] == 1
    member = payload["members"][0]
    assert member["term"]["commission"] == "Comisión Primera Constitucional Permanente"
    assert member["socials"][0]["url"] == "https://facebook.com/ChaconDialoga"
    assert payload["votes"][0]["vote"] == "Si"


def test_build_metrics_uses_approved_match_map():
    legislators = [
        {
            "id": "leg:senado:maria-perez:2022-2026",
            "chamber": "senado",
            "party": "Partido Verde",
            "party_key": "senado:partido-verde",
            "active": True,
        }
    ]
    projects = [
        {
            "id": "project:1",
            "topic_key": "salud",
            "topic_label": "Salud",
        }
    ]
    vote_records = [
        {
            "id": "vote-record:1",
            "vote_event_id": "vote-event:1",
            "legislator_id": "leg:senado:maria-perez:2022-2026",
            "project_id": "project:1",
        },
        {
            "id": "vote-record:2",
            "vote_event_id": "vote-event:2",
            "legislator_id": "leg:senado:maria-perez:2022-2026",
            "project_id": "project:1",
        },
    ]
    attendance_records = [
        {"id": "attendance:1", "legislator_id": "leg:senado:maria-perez:2022-2026", "attended": True},
        {"id": "attendance:2", "legislator_id": "leg:senado:maria-perez:2022-2026", "attended": False},
    ]
    approved_match_map = {
        ("leg:senado:maria-perez:2022-2026", "vote-event:1"): ["coherent"],
        ("leg:senado:maria-perez:2022-2026", "vote-event:2"): ["inconsistent"],
    }

    metrics, parties = _build_metrics(
        legislators,
        projects,
        vote_records,
        attendance_records,
        approved_match_map,
    )

    assert metrics[0]["coherence_score"] == 50.0
    assert metrics[0]["attendance_rate"] == 50.0
    assert metrics[0]["topic_scores"][0]["votes"] == 2
    assert parties[0]["coherence_score"] == 50.0
