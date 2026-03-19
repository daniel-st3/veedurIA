"""
Structured JSON-line logger for VeedurIA ETL pipeline.

Usage:
    from src.utils.logger import get_logger, log_etl_event

    logger = get_logger(__name__)
    logger.info("Starting ingestion")

    log_etl_event("secop_fetch", rows_fetched=1200, dataset="contratos")
"""

from __future__ import annotations

import json
import logging
import sys
from datetime import datetime, timezone
from typing import Any


class _JsonFormatter(logging.Formatter):
    """Formats log records as single-line JSON objects."""

    def format(self, record: logging.LogRecord) -> str:
        payload: dict[str, Any] = {
            "ts": datetime.fromtimestamp(record.created, tz=timezone.utc).isoformat(),
            "level": record.levelname,
            "logger": record.name,
            "msg": record.getMessage(),
        }
        if record.exc_info:
            payload["exc"] = self.formatException(record.exc_info)
        extra = {
            k: v
            for k, v in record.__dict__.items()
            if k not in logging.LogRecord.__dict__ and not k.startswith("_")
            and k not in (
                "args", "created", "exc_info", "exc_text", "filename",
                "funcName", "levelname", "levelno", "lineno", "message",
                "module", "msecs", "msg", "name", "pathname", "process",
                "processName", "relativeCreated", "stack_info", "thread",
                "threadName",
            )
        }
        if extra:
            payload["extra"] = extra
        return json.dumps(payload, ensure_ascii=False, default=str)


def get_logger(name: str) -> logging.Logger:
    """
    Return a logger with JSON-line output to stderr.

    Subsequent calls with the same name return the same logger instance
    (standard Python logging behaviour). Handlers are only attached once.
    """
    log = logging.getLogger(name)
    if log.handlers:
        return log
    handler = logging.StreamHandler(sys.stderr)
    handler.setFormatter(_JsonFormatter())
    log.addHandler(handler)
    log.setLevel(logging.DEBUG)
    log.propagate = False
    return log


# Module-level logger used by log_etl_event()
_etl_logger = get_logger("veeduria.etl")


def log_etl_event(event: str, **kwargs: Any) -> None:
    """
    Emit a structured ETL lifecycle event at INFO level.

    Args:
        event:   Short event identifier, e.g. "secop_fetch_complete".
        **kwargs: Any additional fields to include in the JSON payload.

    Example:
        log_etl_event("secop_fetch_complete", dataset="contratos", rows=4200)
    """
    record = logging.LogRecord(
        name=_etl_logger.name,
        level=logging.INFO,
        pathname="",
        lineno=0,
        msg=event,
        args=(),
        exc_info=None,
    )
    for k, v in kwargs.items():
        setattr(record, k, v)
    _etl_logger.handle(record)
