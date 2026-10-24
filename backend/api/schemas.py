from pydantic import BaseModel
from typing import Dict, List, Optional, Any

# ----------------- Subsystem Schemas -----------------

class BufferStatusSchema(BaseModel):
    current: int
    max: int

class MissionStatusSchema(BaseModel):
    utc: str
    system: str
    api_latency_ms: int
    last_updated: str
    buffer_status: Optional[BufferStatusSchema] = None

class BaseInstrumentSchema(BaseModel):
    status: str
    message: Optional[str] = None
    timestamp: Optional[str] = None
    processing_ms: Optional[float] = None
    engine_versions: Optional[Dict[str, str]] = None

class SolexsSchema(BaseInstrumentSchema):
    forecast: Optional[str] = None
    probability: Optional[float] = None
    confidence: Optional[float] = None
    forecast_confidence: Optional[float] = None
    trajectory: Optional[str] = None
    expected_severity: Optional[float] = None
    forecast_severity_index: Optional[float] = None
    trend_slope: Optional[float] = None
    forecast_evolution_rate: Optional[float] = None
    entropy: Optional[float] = None
    uncertainty: Optional[float] = None
    margin: Optional[float] = None
    prediction_id: Optional[str] = None
    probability_vector: Optional[List[float]] = None
    model_sha: Optional[str] = None
    multi_horizon: Optional[List[Dict[str, Any]]] = None
    tpr: Optional[float] = None
    far: Optional[float] = None
    tss: Optional[float] = None

class HeliosSchema(BaseInstrumentSchema):
    activity_score: Optional[float] = None
    activity_state: Optional[str] = None
    flux: Optional[float] = None
    recent_bursts: Optional[int] = None
    recent_bursts: Optional[int] = None

class VelcSchema(BaseInstrumentSchema):
    activity_index: Optional[int] = None
    novelty_score: Optional[float] = None
    anomaly_boxes: Optional[int] = None
    similarity_events: Optional[List[Dict[str, Any]]] = None
    similarity_events: Optional[List[Dict[str, Any]]] = None

class CorrelationSchema(BaseInstrumentSchema):
    overall_score: Optional[float] = None
    pairs: Optional[List[Dict[str, Any]]] = None

class FusionSchema(BaseInstrumentSchema):
    prediction: Optional[str] = None
    confidence: Optional[float] = None
    forecast: Optional[str] = None
    forecast_confidence: Optional[float] = None
    alert_level: Optional[str] = None
    priority: Optional[int] = None
    recommended_action: Optional[str] = None

class AlertSchema(BaseModel):
    current_alert: Optional[str] = None
    history: Optional[List[Dict[str, Any]]] = None

class ExplainabilitySchema(BaseInstrumentSchema):
    explainability_method: Optional[str] = None
    shap_available: Optional[bool] = None
    horizons: Optional[Dict[str, List[Dict[str, Any]]]] = None

# ----------------- Dashboard Schema -----------------

class InstrumentsSchema(BaseModel):
    solexs: SolexsSchema
    hel1os: HeliosSchema
    velc: VelcSchema

class AnalyticsSchema(BaseModel):
    correlation: CorrelationSchema
    fusion: FusionSchema
    explainability: ExplainabilitySchema

class DashboardResponse(BaseModel):
    schema_version: Optional[str] = None
    mission_status: MissionStatusSchema
    instruments: InstrumentsSchema
    analytics: AnalyticsSchema
    alerts: AlertSchema
    performance: Optional[Dict[str, float]] = None
    engine_versions: Optional[Dict[str, str]] = None
    history: Optional[List[Dict[str, Any]]] = None

# ----------------- Health Schema -----------------

class HealthResponse(BaseModel):
    cache: str
    models: str
    datasets: str
    api: str
    storage: str
    memory: str
    uptime: str
    latency_ms: float

class SystemResponse(BaseModel):
    available_models: List[str]
    available_datasets: List[str]
    disk_usage: str
    cache_usage: str
    ram: str
    gpu: str
    cpu: str
    version: str

class ModelMetadataResponse(BaseModel):
    status: str
    metadata: Dict[str, Any]

class HistoryResponse(BaseModel):
    status: str
    predictions: List[Dict[str, Any]]
