from .club import Club
from .user import User, UserRole
from .token_blacklist import TokenBlacklist
from .event import Event, EventStatus, EventAssets
from .template import Template, TemplateType, FieldSlot, StaticElement, TemplateBackground
from .participant import Participant, ParticipantSource
from .certificate import Certificate, CertStatus, CertSnapshot
from .cert_sequence import CertSequence
from .email_log import EmailLog, EmailStatus
from .scan_log import ScanLog
from .credit_rule import CreditRule
from .student_credit import StudentCredit, CreditHistoryEntry
from .image_template import ImageTemplate
from .field_position import FieldPosition
from .dept_asset import DeptAsset, DeptFieldPosition
from .dept_certificate import DeptCertificate
from .dept_event import DeptEvent, DeptEventStatus
from .dept_template import DeptTemplate
from .guest_session import GuestSession
from .role_template_preset import RoleTemplatePreset
from .user_otp import OTPRequest
from ..certificate_config.model import CertificateTemplateConfig

ALL_MODELS = [
    Club,
    User,
    TokenBlacklist,
    Event,
    Template,
    Participant,
    Certificate,
    CertSequence,
    EmailLog,
    ScanLog,
    CreditRule,
    StudentCredit,
    ImageTemplate,
    FieldPosition,
    DeptAsset,
    DeptCertificate,
    DeptEvent,
    DeptTemplate,
    GuestSession,
    RoleTemplatePreset,
    OTPRequest,
    CertificateTemplateConfig,
]

__all__ = [
    "Club",
    "User", "UserRole",
    "TokenBlacklist",
    "Event", "EventStatus", "EventAssets",
    "Template", "TemplateType", "FieldSlot", "StaticElement", "TemplateBackground",
    "Participant", "ParticipantSource",
    "Certificate", "CertStatus", "CertSnapshot",
    "CertSequence",
    "EmailLog", "EmailStatus",
    "ScanLog",
    "CreditRule",
    "StudentCredit", "CreditHistoryEntry",
    "ImageTemplate",
    "FieldPosition",    "DeptAsset", "DeptFieldPosition",
    "DeptCertificate", "DeptTemplate",
    "DeptEvent", "DeptEventStatus",
    "GuestSession",
    "RoleTemplatePreset",
    "ALL_MODELS",
]
