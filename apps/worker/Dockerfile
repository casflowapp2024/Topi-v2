# Worker de correos de Topi (Python 3.12, proceso de larga duración)
FROM python:3.12-slim AS base

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1

WORKDIR /app

COPY requirements.txt .
RUN pip install -r requirements.txt

COPY worker ./worker

# ---------------------------------------------------------------- tests (docker build --target test)
FROM base AS test
COPY requirements-dev.txt pyproject.toml ./
RUN pip install -r requirements-dev.txt
COPY tests ./tests
CMD ["python", "-m", "pytest", "-q", "-p", "no:cacheprovider"]

# ---------------------------------------------------------------- imagen final
FROM base AS final
RUN useradd --system --uid 10001 --no-create-home worker
USER worker

# vivo = el proceso responde y puede importar el paquete; la salud real va en los logs JSON
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
    CMD python -c "import worker" || exit 1

ENTRYPOINT ["python", "-m", "worker"]
CMD ["run"]
